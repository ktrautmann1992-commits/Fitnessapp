/**
 * Ablauf der Warteliste und der Gratis-Rezepte (Lead-Magnet) ohne Next-Abhängigkeit (die Route Handler unter
 * app/api/warteliste/* und app/api/gratis-rezepte/* übersetzen nur).
 * So ist alles per Unit-Test prüfbar (Speicher und Mail-Versand werden im Test ersetzt).
 *
 * Grundsätze:
 * - Herkunftsprüfung (Origin = eigene Adresse) bei jedem POST.
 * - Neutrale Antworten: Ob eine Adresse schon eingetragen/bestätigt ist, verrät die Antwort nie.
 * - Honeypot gefüllt → so tun, als ob alles geklappt hätte.
 * - Keine E-Mail-Adressen, IPs oder Token in Logs (Fehlermeldungen enthalten nur HTTP-Status).
 */
import { type HeaderReader, isSameOriginRequest } from '@/lib/admin/origin';
import { allowedOrigins, GRATIS_REZEPTE_PDF, mailBaseUrl } from '@/lib/site';

import { readWaitlistConfig, type WaitlistConfig } from './config';
import { LEAD_MAGNET_CONSENT, WAITLIST_CONSENT } from './consent';
import { createResendMailer, type Mailer, type WaitlistSource } from './mailer';
import { createSupabaseWaitlistStore, type WaitlistStore } from './store';
import {
  clientIp,
  createDownloadPass,
  createToken,
  hashConfirmToken,
  hashEmail,
  hashIp,
  hashUnsubscribeToken,
  isWellFormedToken,
  rateLimitIpKey,
  WAITLIST_TOKEN_TTL_MS,
} from './tokens';
import { leadMagnetSignupSchema, waitlistSignupSchema } from './validation';

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

export const LEAD_MAGNET_MESSAGES = {
  ...WAITLIST_MESSAGES,
  success:
    'Fast geschafft. Bitte bestätige den Link in deiner E-Mail – danach schicken wir dir die Rezepte.',
  notConfigured: 'Der Download ist bald verfügbar. Bitte versuch es in ein paar Tagen noch einmal.',
} as const;

type Messages = Readonly<Record<keyof typeof WAITLIST_MESSAGES, string>>;

/** Pfad der Seiten zu den Mail-Links (Bestätigen/Abmelden) je Liste. */
export const LINK_BASE_PATH = {
  warteliste: '/warteliste',
  'lead-magnet': '/gratis-rezepte',
} as const satisfies Record<WaitlistSource, string>;

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

/** Gemeinsame Eingabe nach der Prüfung: normalisierte Adresse, Honeypot, Newsletter-Häkchen. */
interface ParsedSignup {
  readonly email: string;
  readonly website: string;
  readonly newsletterOptIn: boolean;
}

interface SignupSpec {
  readonly source: WaitlistSource;
  readonly consentTextVersion: number;
  readonly messages: Messages;
  readonly parse: (
    body: unknown,
  ) => { ok: true; data: ParsedSignup } | { ok: false; message: string };
}

/** Warteliste: POST /api/warteliste. */
export function handleSignup(input: SignupInput): Promise<SignupResult> {
  return signup(input, {
    source: 'warteliste',
    consentTextVersion: WAITLIST_CONSENT.version,
    messages: WAITLIST_MESSAGES,
    parse: (body) => {
      const parsed = waitlistSignupSchema.safeParse(body);
      return parsed.success
        ? { ok: true, data: { ...parsed.data, newsletterOptIn: false } }
        : {
            ok: false,
            message: parsed.error.issues[0]?.message ?? WAITLIST_MESSAGES.invalidRequest,
          };
    },
  });
}

/**
 * Gratis-Rezepte (Lead-Magnet): POST /api/gratis-rezepte. Pflicht ist nur die Einwilligung zur Zusendung des
 * Download-Links; das Newsletter-Häkchen ist freiwillig und wird als newsletter_opt_in gespeichert.
 */
export function handleLeadMagnetSignup(input: SignupInput): Promise<SignupResult> {
  return signup(input, {
    source: 'lead-magnet',
    consentTextVersion: LEAD_MAGNET_CONSENT.version,
    messages: LEAD_MAGNET_MESSAGES,
    parse: (body) => {
      const parsed = leadMagnetSignupSchema.safeParse(body);
      return parsed.success
        ? {
            ok: true,
            data: {
              email: parsed.data.email,
              website: parsed.data.website,
              newsletterOptIn: parsed.data.newsletter,
            },
          }
        : {
            ok: false,
            message: parsed.error.issues[0]?.message ?? WAITLIST_MESSAGES.invalidRequest,
          };
    },
  });
}

async function signup(input: SignupInput, spec: SignupSpec): Promise<SignupResult> {
  const { messages } = spec;
  if (!isSameOriginRequest(input.headers, allowedOrigins(input.env))) {
    return result(403, 'forbidden', messages.forbidden);
  }
  const parsed = spec.parse(input.body);
  if (!parsed.ok) {
    return result(400, 'invalid', parsed.message);
  }
  if (parsed.data.website.trim() !== '') {
    // Honeypot: Bot – nichts speichern, nichts senden, aber „Erfolg“ melden.
    return result(200, 'ok', messages.success);
  }
  const configResult = readWaitlistConfig(input.env);
  if (configResult.status !== 'ok') {
    return result(503, 'not_configured', messages.notConfigured);
  }
  const { config } = configResult;
  const { store, mailer } = (input.deps ?? defaultDeps)(config);
  const email = parsed.data.email;

  const confirmToken = createToken();
  const unsubscribeToken = createToken();
  try {
    const outcome = await store.signup({
      source: spec.source,
      newsletterOptIn: parsed.data.newsletterOptIn,
      email,
      consentTextVersion: spec.consentTextVersion,
      ipHash: hashIp(config.tokenSecret, rateLimitIpKey(clientIp(input.headers))),
      emailHash: hashEmail(config.tokenSecret, email),
      tokenHash: hashConfirmToken(config.tokenSecret, confirmToken),
      unsubscribeTokenHash: hashUnsubscribeToken(config.tokenSecret, unsubscribeToken),
      tokenExpiresAt: new Date(input.now + WAITLIST_TOKEN_TTL_MS),
    });
    if (outcome === 'rate_limited') {
      return result(429, 'rate_limited', messages.rateLimited);
    }
    // Links nur aus fester Adresse (nie aus Kopfzeilen). Token im #Fragment: wird nie an Server gesendet,
    // steht nicht in Server-Logs und nicht im Referer.
    const base = mailBaseUrl(input.env);
    const linkBase = `${base}${LINK_BASE_PATH[spec.source]}`;
    const unsubscribeUrl = `${linkBase}/abmelden#token=${unsubscribeToken}`;
    if (outcome === 'send') {
      const mail = {
        to: email,
        source: spec.source,
        confirmUrl: `${linkBase}/bestaetigen#token=${confirmToken}`,
        unsubscribeUrl,
        // Gratis-Rezepte: Mail nennt den Newsletter-Status ausdrücklich (Klick bestätigt ihn mit).
        ...(spec.source === 'lead-magnet' ? { newsletterOptIn: parsed.data.newsletterOptIn } : {}),
      };
      scheduleMail(input.schedule, () => mailer.sendConfirmation(mail));
    } else if (spec.source === 'lead-magnet' && outcome === 'newsletter_confirm') {
      // Schon bestätigt, Newsletter-Häkchen neu: eigenes Double-Opt-in nur für den Newsletter + Download-Link.
      const mail = {
        to: email,
        confirmUrl: `${linkBase}/bestaetigen#token=${confirmToken}`,
        downloadUrl: `${base}${GRATIS_REZEPTE_PDF}`,
        unsubscribeUrl,
      };
      scheduleMail(input.schedule, () => mailer.sendNewsletterConfirmation(mail));
    } else if (
      spec.source === 'lead-magnet' &&
      (outcome === 'resend_download' || outcome === 'resend_download_newsletter')
    ) {
      // Gratis-Rezepte schon bestätigt: Download-Link erneut (Adresse ist für diesen Zweck bestätigt).
      const mail = {
        to: email,
        downloadUrl: `${base}${GRATIS_REZEPTE_PDF}`,
        unsubscribeUrl,
        newsletterOptIn: outcome === 'resend_download_newsletter',
      };
      scheduleMail(input.schedule, () => mailer.sendDownload(mail));
    }
    // 'confirmed': schon bestätigt – keine Mail, aber dieselbe Antwort (verrät nichts).
    return result(200, 'ok', messages.success);
  } catch (error) {
    console.error('Warteliste: Eintragen fehlgeschlagen –', (error as Error).message);
    return result(502, 'failed', messages.failed);
  }
}

/** Mail NACH der Antwort senden; Fehler nur mit HTTP-Status loggen (nie Adresse oder Token). */
function scheduleMail(schedule: Scheduler | undefined, send: () => Promise<void>) {
  (schedule ?? runNow)(async () => {
    try {
      await send();
    } catch (error) {
      console.error('Warteliste: Mail-Versand fehlgeschlagen –', (error as Error).message);
    }
  });
}

// ---------------------------------------------------------------------------------------------------------
// Bestätigen und Abmelden (Formular-POST von den Seiten /warteliste/bestaetigen und /warteliste/abmelden)
// ---------------------------------------------------------------------------------------------------------

export type LinkAction = 'bestaetigen' | 'abmelden';
/**
 * Ergebnis auf der Seite. Gratis-Rezepte zusätzlich: 'ok-newsletter' (Adresse + Newsletter bestätigt),
 * 'newsletter' (Newsletter nachträglich bestätigt). Abmelden: 'unbekannt' = nichts (mehr) gefunden.
 */
export type LinkOutcome =
  | 'ok'
  | 'ok-newsletter'
  | 'newsletter'
  | 'ungueltig'
  | 'abgelaufen'
  | 'inaktiv'
  | 'fehler'
  | 'unbekannt';

export interface LinkResult {
  readonly kind: 'redirect' | 'forbidden';
  readonly location?: string;
}

export interface LinkInput {
  readonly env: Env;
  readonly headers: HeaderReader;
  readonly token: unknown;
  readonly deps?: DepsFactory;
  /** Download-Mail nach der Bestätigung NACH der Antwort senden (Route: `after`). */
  readonly schedule?: Scheduler;
  /** Seiten, auf die zurückgeleitet wird. Standard: Warteliste. */
  readonly source?: WaitlistSource;
  /** Jetzt (ms) – für den signierten Download-Nachweis. Standard: Date.now(). */
  readonly now?: number;
}

const linkRedirect = (
  action: LinkAction,
  outcome: LinkOutcome,
  source: WaitlistSource = 'warteliste',
  downloadPass?: string,
): LinkResult => ({
  kind: 'redirect',
  location:
    `${LINK_BASE_PATH[source]}/${action}?ergebnis=${outcome}` +
    (downloadPass ? `&download=${downloadPass}` : ''),
});

export async function handleLinkAction(action: LinkAction, input: LinkInput): Promise<LinkResult> {
  if (!isSameOriginRequest(input.headers, allowedOrigins(input.env))) {
    return { kind: 'forbidden' };
  }
  const source = input.source ?? 'warteliste';
  if (!isWellFormedToken(input.token)) {
    return linkRedirect(action, 'ungueltig', source);
  }
  const configResult = readWaitlistConfig(input.env);
  if (configResult.status !== 'ok') {
    return linkRedirect(action, 'inaktiv', source);
  }
  const { config } = configResult;
  const deps = (input.deps ?? defaultDeps)(config);
  const { store } = deps;
  try {
    if (action === 'bestaetigen' && source === 'warteliste') {
      const outcome = await store.confirm(hashConfirmToken(config.tokenSecret, input.token));
      return linkRedirect(action, confirmOutcome(outcome), source);
    }
    if (action === 'bestaetigen') {
      // Gratis-Rezepte: beim ERSTEN Bestätigen weiteres Abmelde-Token speichern und die Download-Mail schicken.
      const unsubscribeToken = createToken();
      const confirmed = await store.confirmLeadMagnet(
        hashConfirmToken(config.tokenSecret, input.token),
        hashUnsubscribeToken(config.tokenSecret, unsubscribeToken),
      );
      if (confirmed.outcome === 'confirmed' && confirmed.email) {
        const base = mailBaseUrl(input.env);
        const mail = {
          to: confirmed.email,
          downloadUrl: `${base}${GRATIS_REZEPTE_PDF}`,
          unsubscribeUrl: `${base}${LINK_BASE_PATH[source]}/abmelden#token=${unsubscribeToken}`,
          newsletterOptIn: confirmed.newsletterOptIn === true,
        };
        const { mailer } = deps;
        scheduleMail(input.schedule, () => mailer.sendDownload(mail));
      }
      if (confirmed.outcome === 'confirmed' || confirmed.outcome === 'newsletter') {
        // Nur nach echter Bestätigung: signierter, kurzlebiger Nachweis → Seite zeigt den Download-Knopf.
        const pass = createDownloadPass(config.tokenSecret, input.now ?? Date.now());
        const outcome: LinkOutcome =
          confirmed.outcome === 'newsletter'
            ? 'newsletter'
            : confirmed.newsletterOptIn
              ? 'ok-newsletter'
              : 'ok';
        return linkRedirect(action, outcome, source, pass);
      }
      return linkRedirect(action, confirmOutcome(confirmed.outcome), source);
    }
    // Abmelden: ehrlich melden, ob etwas gelöscht wurde (Link aus jeder unserer Mails gilt bis zur Löschung).
    const deleted = await store.unsubscribe(hashUnsubscribeToken(config.tokenSecret, input.token));
    return linkRedirect(action, deleted ? 'ok' : 'unbekannt', source);
  } catch (error) {
    console.error(`Warteliste: ${action} fehlgeschlagen –`, (error as Error).message);
    return linkRedirect(action, 'fehler', source);
  }
}

const confirmOutcome = (outcome: 'confirmed' | 'expired' | 'invalid'): LinkOutcome =>
  outcome === 'confirmed' ? 'ok' : outcome === 'expired' ? 'abgelaufen' : 'ungueltig';

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
