import { describe, expect, it, vi } from 'vitest';

import { LEAD_MAGNET_CONSENT } from './consent';
import {
  type DepsFactory,
  handleLeadMagnetSignup,
  handleLinkAction,
  handleSignup,
  LEAD_MAGNET_MESSAGES,
} from './handler';
import { MAIL_TEXTE } from './mail-texte';
import {
  type ConfirmationMail,
  type DownloadMail,
  type NewsletterConfirmationMail,
  renderConfirmationMail,
  renderDownloadMail,
  renderNewsletterConfirmationMail,
} from './mailer';
import {
  createSupabaseWaitlistStore,
  type LeadMagnetConfirmResult,
  type SignupOutcome,
  type SignupParams,
  type WaitlistStore,
} from './store';
import { tokenFromHash } from './token-format';
import {
  createDownloadPass,
  createToken,
  DOWNLOAD_PASS_TTL_MS,
  hashConfirmToken,
  hashUnsubscribeToken,
  isValidDownloadPass,
} from './tokens';
import { leadMagnetSignupSchema } from './validation';

/** „20 Rezepte gratis als PDF“: Liste lead-magnet, Pflicht-Einwilligung, freiwilliges Newsletter-Häkchen. */

const ENV = {
  RESEND_API_KEY: 're_test_123',
  WAITLIST_FROM_EMAIL: 'Alpha5 <warteliste@example.test>',
  WAITLIST_TOKEN_SECRET: 'x'.repeat(40),
  NEXT_PUBLIC_SUPABASE_URL: 'https://projekt.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test',
  NEXT_PUBLIC_SITE_URL: 'https://alpha5.example',
};
const SECRET = ENV.WAITLIST_TOKEN_SECRET;
const NOW = Date.UTC(2026, 9, 11, 12, 0, 0);
const PDF_URL = 'https://alpha5.example/downloads/Alpha5-Gratis-Rezepte.pdf';

const headers = (extra: Record<string, string> = {}) =>
  new Headers({
    origin: 'https://alpha5.example',
    host: 'alpha5.example',
    'x-forwarded-for': '203.0.113.7',
    ...extra,
  });

function fakes(
  outcome: SignupOutcome = 'send',
  confirmed: LeadMagnetConfirmResult = {
    outcome: 'confirmed',
    email: null,
    newsletterOptIn: false,
  },
  deleted = true,
) {
  const signups: SignupParams[] = [];
  const store: WaitlistStore = {
    signup: vi.fn(async (p: SignupParams) => {
      signups.push(p);
      return outcome;
    }),
    confirm: vi.fn(async () => 'confirmed' as const),
    confirmLeadMagnet: vi.fn(async () => confirmed),
    unsubscribe: vi.fn(async () => deleted),
  };
  const mailer = {
    sendConfirmation: vi.fn(async (_mail: ConfirmationMail) => undefined),
    sendDownload: vi.fn(async (_mail: DownloadMail) => undefined),
    sendNewsletterConfirmation: vi.fn(async (_mail: NewsletterConfirmationMail) => undefined),
  };
  const deps: DepsFactory = () => ({ store, mailer });
  return { store, mailer, deps, signups };
}

const body = { email: ' Lena@Beispiel.DE ', consent: true, website: '' };

describe('leadMagnetSignupSchema', () => {
  it('Newsletter ist standardmäßig aus', () => {
    expect(leadMagnetSignupSchema.parse(body).newsletter).toBe(false);
    expect(leadMagnetSignupSchema.parse({ ...body, newsletter: true }).newsletter).toBe(true);
  });

  it('nur echtes true/false zählt für den Newsletter', () => {
    expect(leadMagnetSignupSchema.safeParse({ ...body, newsletter: 'on' }).success).toBe(false);
    expect(leadMagnetSignupSchema.safeParse({ ...body, newsletter: 'true' }).success).toBe(false);
    expect(leadMagnetSignupSchema.safeParse({ ...body, newsletter: 1 }).success).toBe(false);
  });

  it('Pflicht-Einwilligung für den Download-Link, gültige Adresse', () => {
    const ohne = leadMagnetSignupSchema.safeParse({ ...body, consent: false });
    expect(ohne.success).toBe(false);
    expect(ohne.error?.issues[0]?.message).toBe(
      'Bitte bestätige, dass wir dir den Download-Link schicken dürfen.',
    );
    expect(leadMagnetSignupSchema.safeParse({ ...body, email: 'keine-mail' }).success).toBe(false);
  });

  it('Einwilligungstext nennt die Frist ab Bestätigung', () => {
    expect(LEAD_MAGNET_CONSENT.download).toContain('30 Tage nach der Bestätigung');
  });
});

describe('handleLeadMagnetSignup', () => {
  it('ohne Newsletter: source lead-magnet, newsletterOptIn false, Mail nennt „kein Newsletter“', async () => {
    const f = fakes('send');
    const res = await handleLeadMagnetSignup({
      env: ENV,
      headers: headers(),
      body,
      now: NOW,
      deps: f.deps,
    });
    expect(res).toEqual({
      status: 200,
      body: { code: 'ok', message: LEAD_MAGNET_MESSAGES.success },
    });
    const saved = f.signups[0]!;
    expect(saved.source).toBe('lead-magnet');
    expect(saved.newsletterOptIn).toBe(false);
    expect(saved.email).toBe('lena@beispiel.de');
    expect(saved.consentTextVersion).toBe(LEAD_MAGNET_CONSENT.version);

    const mail = vi.mocked(f.mailer.sendConfirmation).mock.calls[0]![0];
    expect(mail.source).toBe('lead-magnet');
    expect(mail.newsletterOptIn).toBe(false);
    expect(
      mail.confirmUrl.startsWith('https://alpha5.example/gratis-rezepte/bestaetigen#token='),
    ).toBe(true);
    expect(
      mail.unsubscribeUrl.startsWith('https://alpha5.example/gratis-rezepte/abmelden#token='),
    ).toBe(true);
    expect(hashConfirmToken(SECRET, tokenFromHash(new URL(mail.confirmUrl).hash)!)).toBe(
      saved.tokenHash,
    );
    expect(renderConfirmationMail(mail).text).toContain(
      MAIL_TEXTE.gratisRezepteBestaetigen.ohneNewsletter,
    );
    expect(f.mailer.sendDownload).not.toHaveBeenCalled();
  });

  it('mit Newsletter-Häkchen: newsletterOptIn true, Mail sagt „bestätigst auch den Newsletter“', async () => {
    const f = fakes('send');
    await handleLeadMagnetSignup({
      env: ENV,
      headers: headers(),
      body: { ...body, newsletter: true },
      now: NOW,
      deps: f.deps,
    });
    expect(f.signups[0]!.newsletterOptIn).toBe(true);
    const mail = vi.mocked(f.mailer.sendConfirmation).mock.calls[0]![0];
    expect(mail.newsletterOptIn).toBe(true);
    const rendered = renderConfirmationMail(mail);
    expect(rendered.text).toContain(MAIL_TEXTE.gratisRezepteBestaetigen.mitNewsletter);
    expect(rendered.html).toContain(MAIL_TEXTE.gratisRezepteBestaetigen.knopfMitNewsletter);
    expect(rendered.text).not.toContain(MAIL_TEXTE.gratisRezepteBestaetigen.ohneNewsletter);
  });

  it('ohne Pflicht-Einwilligung: 400, nichts gespeichert', async () => {
    const f = fakes();
    const res = await handleLeadMagnetSignup({
      env: ENV,
      headers: headers(),
      body: { ...body, consent: false, newsletter: true },
      now: NOW,
      deps: f.deps,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Bitte bestätige, dass wir dir den Download-Link schicken dürfen.',
    );
    expect(f.store.signup).not.toHaveBeenCalled();
  });

  it('Spamschutz wie Warteliste: fremde Herkunft 403, Honeypot „Erfolg“ ohne Speichern, Rate-Limit 429', async () => {
    const f = fakes();
    expect(
      (
        await handleLeadMagnetSignup({
          env: ENV,
          headers: headers({ origin: 'https://boese.example' }),
          body,
          now: NOW,
          deps: f.deps,
        })
      ).status,
    ).toBe(403);
    const bot = await handleLeadMagnetSignup({
      env: ENV,
      headers: headers(),
      body: { ...body, website: 'spam' },
      now: NOW,
      deps: f.deps,
    });
    expect(bot.body.message).toBe(LEAD_MAGNET_MESSAGES.success);
    expect(f.store.signup).not.toHaveBeenCalled();
    const limit = fakes('rate_limited');
    expect(
      (
        await handleLeadMagnetSignup({
          env: ENV,
          headers: headers(),
          body,
          now: NOW,
          deps: limit.deps,
        })
      ).status,
    ).toBe(429);
    expect(limit.mailer.sendConfirmation).not.toHaveBeenCalled();
  });

  it('ohne Einstellungen: 503 „bald verfügbar“', async () => {
    const res = await handleLeadMagnetSignup({
      env: { NEXT_PUBLIC_SITE_URL: ENV.NEXT_PUBLIC_SITE_URL },
      headers: headers(),
      body,
      now: NOW,
    });
    expect(res).toEqual({
      status: 503,
      body: { code: 'not_configured', message: LEAD_MAGNET_MESSAGES.notConfigured },
    });
  });

  it('schon bestätigt: Download-Link erneut (gleiche Antwort), Hinweis je nach Newsletter', async () => {
    for (const [outcome, newsletter] of [
      ['resend_download', false],
      ['resend_download_newsletter', true],
    ] as const) {
      const f = fakes(outcome);
      const res = await handleLeadMagnetSignup({
        env: ENV,
        headers: headers(),
        body,
        now: NOW,
        deps: f.deps,
      });
      expect(res.body.message).toBe(LEAD_MAGNET_MESSAGES.success);
      expect(f.mailer.sendConfirmation).not.toHaveBeenCalled();
      const mail = vi.mocked(f.mailer.sendDownload).mock.calls[0]![0];
      expect(mail.downloadUrl).toBe(PDF_URL);
      expect(mail.newsletterOptIn).toBe(newsletter);
      expect(hashUnsubscribeToken(SECRET, tokenFromHash(new URL(mail.unsubscribeUrl).hash)!)).toBe(
        f.signups[0]!.unsubscribeTokenHash,
      );
    }
  });

  it('schon bestätigt + Newsletter-Häkchen neu: eigenes Double-Opt-in nur für den Newsletter', async () => {
    const f = fakes('newsletter_confirm');
    const res = await handleLeadMagnetSignup({
      env: ENV,
      headers: headers(),
      body: { ...body, newsletter: true },
      now: NOW,
      deps: f.deps,
    });
    expect(res.body.message).toBe(LEAD_MAGNET_MESSAGES.success);
    expect(f.mailer.sendDownload).not.toHaveBeenCalled();
    const mail = vi.mocked(f.mailer.sendNewsletterConfirmation).mock.calls[0]![0];
    expect(mail.downloadUrl).toBe(PDF_URL);
    expect(hashConfirmToken(SECRET, tokenFromHash(new URL(mail.confirmUrl).hash)!)).toBe(
      f.signups[0]!.tokenHash,
    );
    const rendered = renderNewsletterConfirmationMail(mail);
    expect(rendered.subject).toBe(MAIL_TEXTE.gratisRezepteNewsletter.betreff);
    expect(rendered.text).toContain(mail.confirmUrl);
    expect(rendered.text).toContain(PDF_URL);
    expect(rendered.text).toContain('Newsletter');
  });

  it('Warteliste: nie Newsletter, nie Download-Mail', async () => {
    const f = fakes('resend_download');
    await handleSignup({ env: ENV, headers: headers(), body, now: NOW, deps: f.deps });
    expect(f.mailer.sendDownload).not.toHaveBeenCalled();
    expect(f.signups[0]!.source).toBe('warteliste');
    expect(f.signups[0]!.newsletterOptIn).toBe(false);
  });
});

describe('Bestätigen der Gratis-Rezepte', () => {
  const token = createToken();

  it('erstes Bestätigen: Download-Mail mit weiterem Abmelde-Token, nach der Antwort; Nachweis für den Knopf', async () => {
    const f = fakes('send', {
      outcome: 'confirmed',
      email: 'lena@beispiel.de',
      newsletterOptIn: false,
    });
    const tasks: Array<() => Promise<void>> = [];
    const res = await handleLinkAction('bestaetigen', {
      env: ENV,
      headers: headers(),
      token,
      deps: f.deps,
      source: 'lead-magnet',
      now: NOW,
      schedule: (task) => tasks.push(task),
    });
    const location = new URL(res.location!, 'https://alpha5.example');
    expect(location.pathname).toBe('/gratis-rezepte/bestaetigen');
    expect(location.searchParams.get('ergebnis')).toBe('ok');
    expect(isValidDownloadPass(SECRET, location.searchParams.get('download'), NOW)).toBe(true);
    expect(f.store.confirm).not.toHaveBeenCalled();
    const [tokenHash, newUnsubscribeHash] = vi.mocked(f.store.confirmLeadMagnet).mock.calls[0]!;
    expect(tokenHash).toBe(hashConfirmToken(SECRET, token));
    expect(f.mailer.sendDownload).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(1);
    await tasks[0]!();
    const mail = vi.mocked(f.mailer.sendDownload).mock.calls[0]![0];
    expect(mail).toMatchObject({
      to: 'lena@beispiel.de',
      downloadUrl: PDF_URL,
      newsletterOptIn: false,
    });
    expect(
      mail.unsubscribeUrl.startsWith('https://alpha5.example/gratis-rezepte/abmelden#token='),
    ).toBe(true);
    expect(hashUnsubscribeToken(SECRET, tokenFromHash(new URL(mail.unsubscribeUrl).hash)!)).toBe(
      newUnsubscribeHash,
    );
  });

  it('Ergebnis nennt, was bestätigt wurde: mit Newsletter bzw. nur Newsletter', async () => {
    const mit = fakes('send', { outcome: 'confirmed', email: null, newsletterOptIn: true });
    const input = { env: ENV, headers: headers(), token, source: 'lead-magnet', now: NOW } as const;
    expect((await handleLinkAction('bestaetigen', { ...input, deps: mit.deps })).location).toMatch(
      /^\/gratis-rezepte\/bestaetigen\?ergebnis=ok-newsletter&download=/,
    );
    const nur = fakes('send', { outcome: 'newsletter', email: null, newsletterOptIn: true });
    expect((await handleLinkAction('bestaetigen', { ...input, deps: nur.deps })).location).toMatch(
      /^\/gratis-rezepte\/bestaetigen\?ergebnis=newsletter&download=/,
    );
    expect(nur.mailer.sendDownload).not.toHaveBeenCalled();
  });

  it('zweiter Klick (keine Adresse zurück): ok, aber keine Mail', async () => {
    const f = fakes();
    const res = await handleLinkAction('bestaetigen', {
      env: ENV,
      headers: headers(),
      token,
      deps: f.deps,
      source: 'lead-magnet',
    });
    expect(res.location).toMatch(/^\/gratis-rezepte\/bestaetigen\?ergebnis=ok&download=/);
    expect(f.mailer.sendDownload).not.toHaveBeenCalled();
  });

  it('abgelaufen, ungültig, nicht eingerichtet → eigene Seiten, ohne Download-Nachweis', async () => {
    const f = fakes('send', { outcome: 'expired', email: null, newsletterOptIn: null });
    const input = {
      env: ENV,
      headers: headers(),
      token,
      deps: f.deps,
      source: 'lead-magnet',
    } as const;
    expect((await handleLinkAction('bestaetigen', input)).location).toBe(
      '/gratis-rezepte/bestaetigen?ergebnis=abgelaufen',
    );
    expect((await handleLinkAction('bestaetigen', { ...input, token: 'kaputt' })).location).toBe(
      '/gratis-rezepte/bestaetigen?ergebnis=ungueltig',
    );
    expect(
      (
        await handleLinkAction('abmelden', {
          ...input,
          env: { NEXT_PUBLIC_SITE_URL: ENV.NEXT_PUBLIC_SITE_URL },
        })
      ).location,
    ).toBe('/gratis-rezepte/abmelden?ergebnis=inaktiv');
  });

  it('abmelden: ok nur wenn wirklich gelöscht, sonst ehrlich „unbekannt“', async () => {
    const f = fakes();
    const res = await handleLinkAction('abmelden', {
      env: ENV,
      headers: headers(),
      token,
      deps: f.deps,
      source: 'lead-magnet',
    });
    expect(res.location).toBe('/gratis-rezepte/abmelden?ergebnis=ok');
    expect(f.store.unsubscribe).toHaveBeenCalledWith(hashUnsubscribeToken(SECRET, token));
    const nichts = fakes('send', undefined, false);
    expect(
      (
        await handleLinkAction('abmelden', {
          env: ENV,
          headers: headers(),
          token,
          deps: nichts.deps,
          source: 'lead-magnet',
        })
      ).location,
    ).toBe('/gratis-rezepte/abmelden?ergebnis=unbekannt');
  });
});

describe('Download-Nachweis (Knopf auf der Bestätigungsseite)', () => {
  it('gültig nur mit richtigem Schlüssel und innerhalb der Frist', () => {
    const pass = createDownloadPass(SECRET, NOW);
    expect(isValidDownloadPass(SECRET, pass, NOW + DOWNLOAD_PASS_TTL_MS - 1)).toBe(true);
    expect(isValidDownloadPass(SECRET, pass, NOW + DOWNLOAD_PASS_TTL_MS + 1)).toBe(false);
    expect(isValidDownloadPass('y'.repeat(40), pass, NOW)).toBe(false);
    const [ablauf] = pass.split('.');
    expect(
      isValidDownloadPass(SECRET, `${Number(ablauf) + 999999}.${pass.split('.')[1]}`, NOW),
    ).toBe(false);
    expect(isValidDownloadPass(SECRET, undefined, NOW)).toBe(false);
    expect(isValidDownloadPass(SECRET, 'ok', NOW)).toBe(false);
  });
});

describe('Mails und Datenbank-Aufruf', () => {
  it('Bestätigungs-Mail der Gratis-Rezepte: eigene Texte, beide Links', () => {
    const mail = renderConfirmationMail({
      to: 'a@b.de',
      source: 'lead-magnet',
      newsletterOptIn: false,
      confirmUrl: 'https://alpha5.example/gratis-rezepte/bestaetigen#token=abc',
      unsubscribeUrl: 'https://alpha5.example/gratis-rezepte/abmelden#token=def',
    });
    expect(mail.subject).toBe(MAIL_TEXTE.gratisRezepteBestaetigen.betreff);
    expect(mail.text).toContain('/gratis-rezepte/bestaetigen#token=abc');
    expect(mail.text).toContain('/gratis-rezepte/abmelden#token=def');
    expect(mail.html).toContain(MAIL_TEXTE.gratisRezepteBestaetigen.knopfOhneNewsletter);
  });

  it('Download-Mail: ohne Newsletter Hinweis „keine weiteren Mails“, mit Newsletter Abbestell-Text', () => {
    const basis = {
      to: 'a@b.de',
      downloadUrl: PDF_URL,
      unsubscribeUrl: 'https://alpha5.example/gratis-rezepte/abmelden#token=x',
    };
    const ohne = renderDownloadMail({ ...basis, newsletterOptIn: false });
    expect(ohne.text).toContain(PDF_URL);
    expect(ohne.text).toContain(MAIL_TEXTE.gratisRezepteDownload.ohneNewsletter);
    expect(ohne.text).not.toContain(MAIL_TEXTE.gratisRezepteDownload.mitNewsletter);
    const mit = renderDownloadMail({ ...basis, newsletterOptIn: true });
    expect(mit.text).toContain(MAIL_TEXTE.gratisRezepteDownload.mitNewsletter);
    expect(mit.html).toContain(MAIL_TEXTE.gratisRezepteDownload.abmeldenMitNewsletter);
  });

  it('Mail-Texte sind ausgefüllt und ohne Platzhalter', () => {
    const texte: string[] = [];
    const sammeln = (wert: unknown) => {
      if (typeof wert === 'string') texte.push(wert);
      else if (wert && typeof wert === 'object') Object.values(wert).forEach(sammeln);
    };
    sammeln(MAIL_TEXTE);
    expect(texte.length).toBeGreaterThan(10);
    for (const text of texte) {
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text.length).toBeLessThan(400);
      expect(text).not.toMatch(/[{}<>]|TODO|https?:/);
    }
  });

  it('Datenbank: source + Newsletter nur für Gratis-Rezepte, Bestätigung über lead_magnet_confirm', async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.endsWith('/lead_magnet_confirm')
        ? Response.json({ result: 'newsletter', email: null, newsletter_opt_in: true })
        : Response.json('newsletter_confirm'),
    );
    const store = createSupabaseWaitlistStore(
      { supabaseUrl: 'https://p.supabase.co', supabaseServiceKey: 'sb_secret_x' },
      fetchFn as unknown as typeof fetch,
    );
    const params = {
      email: 'lena@beispiel.de',
      consentTextVersion: 1,
      ipHash: 'a'.repeat(64),
      emailHash: 'b'.repeat(64),
      tokenHash: 'c'.repeat(64),
      unsubscribeTokenHash: 'd'.repeat(64),
      tokenExpiresAt: new Date(NOW),
    };
    expect(await store.signup({ ...params, source: 'lead-magnet', newsletterOptIn: false })).toBe(
      'newsletter_confirm',
    );
    await store.signup({ ...params, source: 'warteliste', newsletterOptIn: false });
    const args = fetchFn.mock.calls.map(
      (call) => JSON.parse((call as unknown as [string, RequestInit])[1].body as string) as object,
    );
    expect(args[0]).toMatchObject({ p_source: 'lead-magnet', p_newsletter_opt_in: false });
    // Warteliste: Standardwerte der Datenbank-Funktion (funktioniert auch vor der Migration)
    expect(args[1]).not.toHaveProperty('p_source');
    expect(args[1]).not.toHaveProperty('p_newsletter_opt_in');

    expect(await store.confirmLeadMagnet('e'.repeat(64), 'f'.repeat(64))).toEqual({
      outcome: 'newsletter',
      email: null,
      newsletterOptIn: true,
    });
    const [url, init] = fetchFn.mock.calls[2] as unknown as [string, RequestInit];
    expect(url).toBe('https://p.supabase.co/rest/v1/rpc/lead_magnet_confirm');
    expect(JSON.parse(init.body as string)).toEqual({
      p_token_hash: 'e'.repeat(64),
      p_unsubscribe_token_hash: 'f'.repeat(64),
    });
  });

  it('unerwartete Antwort der Datenbank → Fehler', async () => {
    const fetchFn = vi.fn(async () => Response.json({ result: 'komisch' }));
    const store = createSupabaseWaitlistStore(
      { supabaseUrl: 'https://p.supabase.co', supabaseServiceKey: 'sb_secret_x' },
      fetchFn as unknown as typeof fetch,
    );
    await expect(store.confirmLeadMagnet('e'.repeat(64), 'f'.repeat(64))).rejects.toThrow(
      'HTTP 500',
    );
  });
});
