import { describe, expect, it, vi } from 'vitest';

import { readWaitlistConfig, type WaitlistConfig } from './config';
import { handleLinkAction, handleSignup, WAITLIST_MESSAGES, type DepsFactory } from './handler';
import { type ConfirmationMail, renderConfirmationMail } from './mailer';
import { createSupabaseWaitlistStore, type SignupParams, type WaitlistStore } from './store';
import { tokenFromHash } from './token-format';
import {
  clientIp,
  createToken,
  hashConfirmToken,
  hashIp,
  hashUnsubscribeToken,
  isWellFormedToken,
  rateLimitIpKey,
  WAITLIST_TOKEN_TTL_MS,
} from './tokens';
import { waitlistSignupSchema } from './validation';

const ENV = {
  RESEND_API_KEY: 're_test_123',
  WAITLIST_FROM_EMAIL: 'Alpha5 <warteliste@example.test>',
  WAITLIST_TOKEN_SECRET: 'x'.repeat(40),
  NEXT_PUBLIC_SUPABASE_URL: 'https://projekt.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test',
  NEXT_PUBLIC_SITE_URL: 'https://alpha5.example',
};
const SECRET = ENV.WAITLIST_TOKEN_SECRET;

const headers = (extra: Record<string, string> = {}) =>
  new Headers({
    origin: 'https://alpha5.example',
    host: 'alpha5.example',
    'x-forwarded-for': '203.0.113.7, 10.0.0.1',
    ...extra,
  });

function fakes(outcome: Awaited<ReturnType<WaitlistStore['signup']>> = 'send') {
  const signups: SignupParams[] = [];
  const store: WaitlistStore = {
    signup: vi.fn(async (p: SignupParams) => {
      signups.push(p);
      return outcome;
    }),
    confirm: vi.fn(async () => 'confirmed' as const),
    unsubscribe: vi.fn(async () => true),
  };
  const mailer = { sendConfirmation: vi.fn(async (_mail: ConfirmationMail) => undefined) };
  const deps: DepsFactory = () => ({ store, mailer });
  return { store, mailer, deps, signups };
}

const NOW = Date.UTC(2026, 9, 4, 12, 0, 0);
const validBody = { email: '  Anna@Beispiel.DE ', consent: true, website: '' };

describe('readWaitlistConfig', () => {
  it('ist ok mit allen Werten (auch SUPABASE_SECRET_KEY statt SERVICE_ROLE_KEY)', () => {
    expect(readWaitlistConfig(ENV).status).toBe('ok');
    const rest: Record<string, string | undefined> = {
      ...ENV,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    };
    expect(readWaitlistConfig({ ...rest, SUPABASE_SECRET_KEY: 'sb_secret_x' }).status).toBe('ok');
  });

  it('ist deaktiviert ohne Werte und nennt nur Namen', () => {
    const config = readWaitlistConfig({});
    expect(config.status).toBe('disabled');
    if (config.status === 'disabled') {
      expect(config.reasons.join(' ')).toContain('RESEND_API_KEY');
      expect(config.reasons).toHaveLength(5);
    }
  });

  it('verlangt ein langes Token-Secret und https', () => {
    expect(readWaitlistConfig({ ...ENV, WAITLIST_TOKEN_SECRET: 'kurz' }).status).toBe('disabled');
    expect(
      readWaitlistConfig({ ...ENV, NEXT_PUBLIC_SUPABASE_URL: 'http://projekt.supabase.co' }).status,
    ).toBe('disabled');
  });
});

describe('Token und Hashes', () => {
  it('erzeugt zufällige, wohlgeformte Token', () => {
    const a = createToken();
    expect(isWellFormedToken(a)).toBe(true);
    expect(createToken()).not.toBe(a);
    expect(isWellFormedToken('kurz')).toBe(false);
    expect(isWellFormedToken(42)).toBe(false);
  });

  it('hasht je Zweck verschieden (64 Hex-Zeichen)', () => {
    const t = createToken();
    expect(hashConfirmToken(SECRET, t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashConfirmToken(SECRET, t)).not.toBe(hashUnsubscribeToken(SECRET, t));
    expect(hashConfirmToken(SECRET, t)).not.toBe(hashConfirmToken('y'.repeat(40), t));
  });

  it('kürzt IPv6 für das Rate-Limit auf /64, IPv4 bleibt', () => {
    expect(rateLimitIpKey('2001:db8:abcd:12:1111:2222:3333:4444')).toBe('2001:db8:abcd:12::/64');
    expect(rateLimitIpKey('2001:DB8:ABCD:0012::1')).toBe('2001:db8:abcd:12::/64');
    expect(rateLimitIpKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(rateLimitIpKey('[2001:db8:abcd:12::5]')).toBe('2001:db8:abcd:12::/64');
    expect(rateLimitIpKey('::1')).toBe('0:0:0:0::/64');
    expect(rateLimitIpKey('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(rateLimitIpKey('203.0.113.7')).toBe('203.0.113.7');
    // zwei Adressen aus demselben /64 → derselbe Schlüssel
    expect(rateLimitIpKey('2001:db8:1:2::a')).toBe(rateLimitIpKey('2001:db8:1:2:ffff::b'));
  });

  it('Token aus dem #Fragment', () => {
    const t = createToken();
    expect(tokenFromHash(`#token=${t}`)).toBe(t);
    expect(tokenFromHash('#token=kaputt')).toBeNull();
    expect(tokenFromHash('')).toBeNull();
  });

  it('nimmt die erste IP aus X-Forwarded-For', () => {
    expect(clientIp(headers())).toBe('203.0.113.7');
    expect(clientIp(new Headers({ 'x-real-ip': '198.51.100.1' }))).toBe('198.51.100.1');
    expect(clientIp(new Headers())).toBe('unbekannt');
  });
});

describe('waitlistSignupSchema', () => {
  it('normalisiert die E-Mail', () => {
    expect(waitlistSignupSchema.parse(validBody).email).toBe('anna@beispiel.de');
  });

  it('lehnt ungültige Adressen, fehlende Zustimmung und überlange Adressen ab', () => {
    expect(waitlistSignupSchema.safeParse({ ...validBody, email: 'keine-mail' }).success).toBe(
      false,
    );
    expect(waitlistSignupSchema.safeParse({ ...validBody, consent: false }).success).toBe(false);
    expect(waitlistSignupSchema.safeParse({ email: 'a@b.de' }).success).toBe(false);
    expect(
      waitlistSignupSchema.safeParse({ ...validBody, email: `${'a'.repeat(250)}@b.de` }).success,
    ).toBe(false);
  });
});

describe('handleSignup', () => {
  it('lehnt fremde Herkunft ab', async () => {
    const f = fakes();
    const res = await handleSignup({
      env: ENV,
      headers: headers({ origin: 'https://boese.example' }),
      body: validBody,
      now: NOW,
      deps: f.deps,
    });
    expect(res.status).toBe(403);
    expect(f.store.signup).not.toHaveBeenCalled();
  });

  it('meldet ungültige Eingaben mit verständlichem Text', async () => {
    const res = await handleSignup({
      env: ENV,
      headers: headers(),
      body: { ...validBody, consent: false },
      now: NOW,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Bitte bestätige, dass wir dich per E-Mail informieren dürfen.');
    const keinJson = await handleSignup({ env: ENV, headers: headers(), body: null, now: NOW });
    expect(keinJson.status).toBe(400);
  });

  it('Honeypot gefüllt: Erfolg melden, nichts speichern, nichts senden', async () => {
    const f = fakes();
    const res = await handleSignup({
      env: ENV,
      headers: headers(),
      body: { ...validBody, website: 'https://spam.example' },
      now: NOW,
      deps: f.deps,
    });
    expect(res).toEqual({ status: 200, body: { code: 'ok', message: WAITLIST_MESSAGES.success } });
    expect(f.store.signup).not.toHaveBeenCalled();
    expect(f.mailer.sendConfirmation).not.toHaveBeenCalled();
  });

  it('ohne Einstellungen: 503 „bald aktiv“', async () => {
    const res = await handleSignup({
      env: { NEXT_PUBLIC_SITE_URL: ENV.NEXT_PUBLIC_SITE_URL },
      headers: headers(),
      body: validBody,
      now: NOW,
    });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ code: 'not_configured', message: WAITLIST_MESSAGES.notConfigured });
  });

  it('neuer Eintrag: speichert nur Hashes und schickt Mail mit Token-Links', async () => {
    const f = fakes('send');
    const res = await handleSignup({
      env: ENV,
      headers: headers(),
      body: validBody,
      now: NOW,
      deps: f.deps,
    });
    expect(res.status).toBe(200);
    const saved = f.signups[0]!;
    expect(saved.email).toBe('anna@beispiel.de');
    expect(saved.consentTextVersion).toBe(1);
    expect(saved.ipHash).toBe(hashIp(SECRET, '203.0.113.7'));
    expect(saved.tokenExpiresAt.getTime()).toBe(NOW + WAITLIST_TOKEN_TTL_MS);

    const mail = vi.mocked(f.mailer.sendConfirmation).mock.calls[0]![0];
    expect(mail.to).toBe('anna@beispiel.de');
    const confirmToken = tokenFromHash(new URL(mail.confirmUrl).hash)!;
    const unsubscribeToken = tokenFromHash(new URL(mail.unsubscribeUrl).hash)!;
    expect(mail.confirmUrl.startsWith('https://alpha5.example/warteliste/bestaetigen#token=')).toBe(
      true,
    );
    expect(hashConfirmToken(SECRET, confirmToken)).toBe(saved.tokenHash);
    expect(hashUnsubscribeToken(SECRET, unsubscribeToken)).toBe(saved.unsubscribeTokenHash);
    expect(JSON.stringify(saved)).not.toContain(confirmToken);
  });

  it('schon bestätigt: gleiche Antwort, aber keine Mail', async () => {
    const f = fakes('confirmed');
    const res = await handleSignup({
      env: ENV,
      headers: headers(),
      body: validBody,
      now: NOW,
      deps: f.deps,
    });
    expect(res.body.message).toBe(WAITLIST_MESSAGES.success);
    expect(f.mailer.sendConfirmation).not.toHaveBeenCalled();
  });

  it('Rate-Limit: 429', async () => {
    const f = fakes('rate_limited');
    const res = await handleSignup({
      env: ENV,
      headers: headers(),
      body: validBody,
      now: NOW,
      deps: f.deps,
    });
    expect(res.status).toBe(429);
    expect(f.mailer.sendConfirmation).not.toHaveBeenCalled();
  });

  it('Datenbank-Fehler: 502 ohne Details', async () => {
    const f = fakes('send');
    vi.mocked(f.store.signup).mockRejectedValueOnce(new Error('HTTP 500'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await handleSignup({
      env: ENV,
      headers: headers(),
      body: validBody,
      now: NOW,
      deps: f.deps,
    });
    expect(res).toEqual({
      status: 502,
      body: { code: 'failed', message: WAITLIST_MESSAGES.failed },
    });
    expect(f.mailer.sendConfirmation).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('Mail geht erst NACH der Antwort raus (after); Mail-Fehler ändern die Antwort nicht', async () => {
    const f = fakes('send');
    vi.mocked(f.mailer.sendConfirmation).mockRejectedValueOnce(new Error('HTTP 500'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const tasks: Array<() => Promise<void>> = [];
    const res = await handleSignup({
      env: ENV,
      headers: headers(),
      body: validBody,
      now: NOW,
      deps: f.deps,
      schedule: (task) => tasks.push(task),
    });
    expect(res.status).toBe(200);
    expect(f.mailer.sendConfirmation).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(1);
    await tasks[0]!();
    expect(f.mailer.sendConfirmation).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(spy.mock.calls)).not.toContain('anna@beispiel.de');
    spy.mockRestore();
  });

  it('Antwort für neue und schon bestätigte Adressen ist gleich (nichts geplant bei „confirmed“)', async () => {
    const neu = fakes('send');
    const alt = fakes('confirmed');
    const tasksNeu: Array<() => Promise<void>> = [];
    const tasksAlt: Array<() => Promise<void>> = [];
    const a = await handleSignup({
      env: ENV,
      headers: headers(),
      body: validBody,
      now: NOW,
      deps: neu.deps,
      schedule: (t) => tasksNeu.push(t),
    });
    const b = await handleSignup({
      env: ENV,
      headers: headers(),
      body: validBody,
      now: NOW,
      deps: alt.deps,
      schedule: (t) => tasksAlt.push(t),
    });
    expect(a).toEqual(b);
    expect(tasksNeu).toHaveLength(1);
    expect(tasksAlt).toHaveLength(0);
  });

  it('Mail-Links nur aus fester Adresse – nie aus Origin/X-Forwarded-Host', async () => {
    const f = fakes('send');
    // Origin passt nicht zur Allowlist → 403, auch wenn X-Forwarded-Host „passt“
    const boese = await handleSignup({
      env: ENV,
      headers: headers({ origin: 'https://boese.example', 'x-forwarded-host': 'boese.example' }),
      body: validBody,
      now: NOW,
      deps: f.deps,
    });
    expect(boese.status).toBe(403);
    // Vorschau: Links zur festen Vercel-Adresse dieses Branches
    const vorschau = {
      ...ENV,
      NEXT_PUBLIC_SITE_URL: undefined,
      VERCEL_ENV: 'preview',
      VERCEL_BRANCH_URL: 'fitnessapp-web-git-test.vercel.app',
    };
    await handleSignup({
      env: vorschau,
      headers: headers({
        origin: 'https://fitnessapp-web-git-test.vercel.app',
        host: 'fitnessapp-web-git-test.vercel.app',
      }),
      body: validBody,
      now: NOW,
      deps: f.deps,
    });
    const mail = vi.mocked(f.mailer.sendConfirmation).mock.calls[0]![0];
    expect(
      mail.confirmUrl.startsWith('https://fitnessapp-web-git-test.vercel.app/warteliste/'),
    ).toBe(true);
  });
});

describe('handleLinkAction', () => {
  const token = createToken();

  it('bestätigt mit gehashtem Token', async () => {
    const f = fakes();
    const res = await handleLinkAction('bestaetigen', {
      env: ENV,
      headers: headers(),
      token,
      deps: f.deps,
    });
    expect(res).toEqual({ kind: 'redirect', location: '/warteliste/bestaetigen?ergebnis=ok' });
    expect(f.store.confirm).toHaveBeenCalledWith(hashConfirmToken(SECRET, token));
  });

  it('abgelaufen und ungültig', async () => {
    const f = fakes();
    vi.mocked(f.store.confirm).mockResolvedValueOnce('expired');
    expect(
      (await handleLinkAction('bestaetigen', { env: ENV, headers: headers(), token, deps: f.deps }))
        .location,
    ).toBe('/warteliste/bestaetigen?ergebnis=abgelaufen');
    expect(
      (
        await handleLinkAction('bestaetigen', {
          env: ENV,
          headers: headers(),
          token: 'x',
          deps: f.deps,
        })
      ).location,
    ).toBe('/warteliste/bestaetigen?ergebnis=ungueltig');
  });

  it('abmelden löscht über gehashtes Abmelde-Token', async () => {
    const f = fakes();
    const res = await handleLinkAction('abmelden', {
      env: ENV,
      headers: headers(),
      token,
      deps: f.deps,
    });
    expect(res.location).toBe('/warteliste/abmelden?ergebnis=ok');
    expect(f.store.unsubscribe).toHaveBeenCalledWith(hashUnsubscribeToken(SECRET, token));
  });

  it('fremde Herkunft und fehlende Einstellungen', async () => {
    expect(
      await handleLinkAction('abmelden', {
        env: ENV,
        headers: headers({ origin: 'https://boese.example' }),
        token,
      }),
    ).toEqual({ kind: 'forbidden' });
    expect(
      (
        await handleLinkAction('abmelden', {
          env: { NEXT_PUBLIC_SITE_URL: ENV.NEXT_PUBLIC_SITE_URL },
          headers: headers(),
          token,
        })
      ).location,
    ).toBe('/warteliste/abmelden?ergebnis=inaktiv');
  });
});

describe('Mail und Supabase-Aufruf', () => {
  it('Mail enthält beide Links, HTML ist maskiert', () => {
    const mail = renderConfirmationMail({
      to: 'a@b.de',
      confirmUrl: 'https://alpha5.example/warteliste/bestaetigen?token=abc&x="1"',
      unsubscribeUrl: 'https://alpha5.example/warteliste/abmelden?token=def',
    });
    expect(mail.text).toContain('/warteliste/bestaetigen?token=abc');
    expect(mail.text).toContain('/warteliste/abmelden?token=def');
    expect(mail.html).toContain('token=abc&amp;x=&quot;1&quot;');
    expect(mail.subject).toContain('Alpha5');
  });

  it('ruft die Datenbank-Funktion mit service_role-Schlüssel auf', async () => {
    const config: Pick<WaitlistConfig, 'supabaseUrl' | 'supabaseServiceKey'> = {
      supabaseUrl: 'https://projekt.supabase.co',
      supabaseServiceKey: 'eyJ.legacy.jwt',
    };
    const fetchFn = vi.fn(async () => Response.json('expired'));
    const store = createSupabaseWaitlistStore(config, fetchFn as unknown as typeof fetch);
    expect(await store.confirm('a'.repeat(64))).toBe('expired');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://projekt.supabase.co/rest/v1/rpc/waitlist_confirm');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer eyJ.legacy.jwt');
    expect(JSON.parse(init.body as string)).toEqual({ p_token_hash: 'a'.repeat(64) });
  });

  it('wirft bei HTTP-Fehler ohne Antwortinhalt', async () => {
    const fetchFn = vi.fn(async () => new Response('anna@beispiel.de', { status: 500 }));
    const store = createSupabaseWaitlistStore(
      { supabaseUrl: 'https://p.supabase.co', supabaseServiceKey: 'sb_secret_x' },
      fetchFn as unknown as typeof fetch,
    );
    await expect(store.unsubscribe('a'.repeat(64))).rejects.toThrow('HTTP 500');
    const init = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});
