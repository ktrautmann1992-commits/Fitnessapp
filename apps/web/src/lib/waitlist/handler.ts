/**
 * Ablauf der Warteliste ohne Next-Abhängigkeit (die Route Handler unter app/api/warteliste/* übersetzen nur).
 * So ist alles per Unit-Test prüfbar (Speicher und Mail-Versand werden im Test ersetzt).
 *
 * Grundsätze:
 * - Herkunftsprüfung (Origin = eigene Adresse) bei jedem POST.
 * - Neutrale Antworten: Ob eine Adresse schon eingetragen/bestätigt ist, verrät die Antwort nie.
 * - Honeypot gefüllt → so tun, als ob alles geklappt hätte.
 * - Keine E-Mail-Adressen, IPs oder Token in Logs (Fehlermeldungen enthalten nur HTTP-Status).
 */
import { type HeaderReader, isSameOriginRequest } from '@/lib/admin/origin';
import { allowedOrigins, mailBaseUrl } from '@/lib/site';

import { readWaitlistConfig, type WaitlistConfig } from './config';
import { WAITLIST_CONSENT } from './consent';
import { createResendMailer, type Mailer } from './mailer';
import { createSupabaseWaitlistStore, type WaitlistStore } from './store';
import {
  clientIp,
  createToken,
  hashConfirmToken,
  hashEmail,
  hashIp,
  hashUnsubscribeToken,
  isWellFormedToken,
  rateLimitIpKey,
  WAITLIST_TOKEN_TTL_MS,
} from './tokens';
import { waitlistSignupSchema } from './validation';

type Env = Readonly<Record<string, string | undefined>>;

export interface WaitlistDeps {
  readonly store: WaitlistStore;
  readonly mailer: Mailer;
}

/** Standard: Supabase + Resend aus der Konfiguration. Tests geben eigene Deps hinein. */
export type DepsFactory = (config: WaitlistConfig) => WaitlistDeps;

export const defaultDeps: DepsFactory = (config) => ({
  store: createSupabaseWaitlistStore(config),
  mailer: createResendMailer(config),
});

export const WAITLIST_MESSAGES = {
  success: 'Fast geschafft. Bitte bestätige den Link in deiner E-Mail.',
  notConfigured: 'Die Warteliste ist bald aktiv. Bitte versuch es in ein paar Tagen noch einmal.',
  forbidden: 'Anfrage abgelehnt: Sie kam nicht von dieser Website.',
  rateLimited: 'Zu viele Versuche. Bitte versuch es später noch einmal.',
  failed: 'Das hat gerade nicht geklappt. Bitte versuch es später noch einmal.',
  invalidRequest: 'Bitte gib eine gültige E-Mail-Adresse ein.',
} as const;

export type SignupCode =
  'ok' | 'invalid' | 'forbidden' | 'not_configured' | 'rate_limited' | 'failed';

export interface SignupResult {
  readonly status: number;
  readonly body: { readonly code: SignupCode; readonly message: string };
}

const result = (status: number, code: SignupCode, message: string): SignupResult => ({
  status,
  body: { code, message },
});

/** Arbeit nach der Antwort (Route: `after` aus next/server). Standard: sofort ausführen (Tests). */
export type Scheduler = (task: () => Promise<void>) => void;

const runNow: Scheduler = (task) => {
  void task();
};

export interface SignupInput {
  readonly env: Env;
  readonly headers: HeaderReader;
  readonly body: unknown;
  readonly now: number;
  readonly deps?: DepsFactory;
  /** Mail-Versand NACH der Antwort: gleiche Antwortzeit, egal ob eine Mail rausgeht (verrät nichts). */
  readonly schedule?: Scheduler;
}

export async function handleSignup(input: SignupInput): Promise<SignupResult> {
  if (!isSameOriginRequest(input.headers, allowedOrigins(input.env))) {
    return result(403, 'forbidden', WAITLIST_MESSAGES.forbidden);
  }
  const parsed = waitlistSignupSchema.safeParse(input.body);
  if (!parsed.success) {
    return result(
      400,
      'invalid',
      parsed.error.issues[0]?.message ?? WAITLIST_MESSAGES.invalidRequest,
    );
  }
  if (parsed.data.website.trim() !== '') {
    // Honeypot: Bot – nichts speichern, nichts senden, aber „Erfolg“ melden.
    return result(200, 'ok', WAITLIST_MESSAGES.success);
  }
  const configResult = readWaitlistConfig(input.env);
  if (configResult.status !== 'ok') {
    return result(503, 'not_configured', WAITLIST_MESSAGES.notConfigured);
  }
  const { config } = configResult;
  const { store, mailer } = (input.deps ?? defaultDeps)(config);
  const email = parsed.data.email;

  const confirmToken = createToken();
  const unsubscribeToken = createToken();
  try {
    const outcome = await store.signup({
      email,
      consentTextVersion: WAITLIST_CONSENT.version,
      ipHash: hashIp(config.tokenSecret, rateLimitIpKey(clientIp(input.headers))),
      emailHash: hashEmail(config.tokenSecret, email),
      tokenHash: hashConfirmToken(config.tokenSecret, confirmToken),
      unsubscribeTokenHash: hashUnsubscribeToken(config.tokenSecret, unsubscribeToken),
      tokenExpiresAt: new Date(input.now + WAITLIST_TOKEN_TTL_MS),
    });
    if (outcome === 'rate_limited') {
      return result(429, 'rate_limited', WAITLIST_MESSAGES.rateLimited);
    }
    if (outcome === 'send') {
      // Links nur aus fester Adresse (nie aus Kopfzeilen). Token im #Fragment: wird nie an Server gesendet,
      // steht nicht in Server-Logs und nicht im Referer.
      const base = mailBaseUrl(input.env);
      const mail = {
        to: email,
        confirmUrl: `${base}/warteliste/bestaetigen#token=${confirmToken}`,
        unsubscribeUrl: `${base}/warteliste/abmelden#token=${unsubscribeToken}`,
      };
      (input.schedule ?? runNow)(async () => {
        try {
          await mailer.sendConfirmation(mail);
        } catch (error) {
          console.error('Warteliste: Mail-Versand fehlgeschlagen –', (error as Error).message);
        }
      });
    }
    // 'confirmed': schon bestätigt – keine Mail, aber dieselbe Antwort (verrät nichts).
    return result(200, 'ok', WAITLIST_MESSAGES.success);
  } catch (error) {
    console.error('Warteliste: Eintragen fehlgeschlagen –', (error as Error).message);
    return result(502, 'failed', WAITLIST_MESSAGES.failed);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Bestätigen und Abmelden (Formular-POST von den Seiten /warteliste/bestaetigen und /warteliste/abmelden)
// ---------------------------------------------------------------------------------------------------------

export type LinkAction = 'bestaetigen' | 'abmelden';
export type LinkOutcome = 'ok' | 'ungueltig' | 'abgelaufen' | 'inaktiv' | 'fehler';

export interface LinkResult {
  readonly kind: 'redirect' | 'forbidden';
  readonly location?: string;
}

export interface LinkInput {
  readonly env: Env;
  readonly headers: HeaderReader;
  readonly token: unknown;
  readonly deps?: DepsFactory;
}

const linkRedirect = (action: LinkAction, outcome: LinkOutcome): LinkResult => ({
  kind: 'redirect',
  location: `/warteliste/${action}?ergebnis=${outcome}`,
});

export async function handleLinkAction(action: LinkAction, input: LinkInput): Promise<LinkResult> {
  if (!isSameOriginRequest(input.headers, allowedOrigins(input.env))) {
    return { kind: 'forbidden' };
  }
  if (!isWellFormedToken(input.token)) {
    return linkRedirect(action, 'ungueltig');
  }
  const configResult = readWaitlistConfig(input.env);
  if (configResult.status !== 'ok') {
    return linkRedirect(action, 'inaktiv');
  }
  const { config } = configResult;
  const { store } = (input.deps ?? defaultDeps)(config);
  try {
    if (action === 'bestaetigen') {
      const outcome = await store.confirm(hashConfirmToken(config.tokenSecret, input.token));
      return linkRedirect(
        action,
        outcome === 'confirmed' ? 'ok' : outcome === 'expired' ? 'abgelaufen' : 'ungueltig',
      );
    }
    // Abmelden: Ergebnis immer „ok“ – auch wenn nichts (mehr) eingetragen war.
    await store.unsubscribe(hashUnsubscribeToken(config.tokenSecret, input.token));
    return linkRedirect(action, 'ok');
  } catch (error) {
    console.error(`Warteliste: ${action} fehlgeschlagen –`, (error as Error).message);
    return linkRedirect(action, 'fehler');
  }
}

/** JSON-Antwort der Eintragen-Route. Nie zwischenspeichern. */
export function toJsonResponse(res: SignupResult): Response {
  return Response.json(res.body, {
    status: res.status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/** 303 (nach POST immer GET) bzw. 403 für Bestätigen/Abmelden. */
export function toLinkResponse(res: LinkResult): Response {
  const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  if (res.kind === 'forbidden') {
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    return new Response(WAITLIST_MESSAGES.forbidden, { status: 403, headers });
  }
  headers.set('Location', res.location ?? '/');
  return new Response(null, { status: 303, headers });
}
