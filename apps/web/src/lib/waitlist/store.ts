/**
 * Zugriff auf die Warteliste in Supabase – nur über die Datenbank-Funktionen (Migrationen
 * 20261004130000_waitlist.sql und 20261011120000_waitlist_lead_magnet.sql) und nur mit dem geheimen
 * service_role-Schlüssel (nie im Browser). Direkter REST-Aufruf (PostgREST /rpc), kein zusätzliches Paket.
 */
import type { WaitlistConfig } from './config';
import type { WaitlistSource } from './mailer';

/**
 * 'send' = Bestätigungs-Mail schicken (nennt bei den Gratis-Rezepten den Newsletter-Status),
 * 'confirmed' = Warteliste schon bestätigt (keine Mail), 'rate_limited',
 * 'resend_download'/'resend_download_newsletter' = Gratis-Rezepte schon bestätigt (ohne/mit Newsletter) →
 * Download-Link noch einmal schicken,
 * 'newsletter_confirm' = Gratis-Rezepte schon bestätigt, Newsletter-Häkchen NEU → eigenes Double-Opt-in nur für
 * den Newsletter (Mail mit Bestätigungs-Link und Download-Link).
 */
export type SignupOutcome =
  | 'send'
  | 'confirmed'
  | 'rate_limited'
  | 'resend_download'
  | 'resend_download_newsletter'
  | 'newsletter_confirm';

const SIGNUP_OUTCOMES: readonly unknown[] = [
  'send',
  'confirmed',
  'rate_limited',
  'resend_download',
  'resend_download_newsletter',
  'newsletter_confirm',
] satisfies readonly SignupOutcome[];
export type ConfirmOutcome = 'confirmed' | 'expired' | 'invalid';

/**
 * Ergebnis der Bestätigung der Gratis-Rezepte. `email` nur beim ERSTEN Bestätigen (dann Download-Mail).
 * 'newsletter' = Newsletter nachträglich bestätigt. `newsletterOptIn`: Stand danach (null bei expired/invalid).
 */
export interface LeadMagnetConfirmResult {
  readonly outcome: ConfirmOutcome | 'newsletter';
  readonly email: string | null;
  readonly newsletterOptIn: boolean | null;
}

export interface SignupParams {
  readonly source: WaitlistSource;
  /** Newsletter-Häkchen (nur Gratis-Rezepte). Warteliste immer false – eigener Zweck: Infos zum Start. */
  readonly newsletterOptIn: boolean;
  readonly email: string;
  readonly consentTextVersion: number;
  readonly ipHash: string;
  readonly emailHash: string;
  readonly tokenHash: string;
  readonly unsubscribeTokenHash: string;
  readonly tokenExpiresAt: Date;
}

export interface WaitlistStore {
  signup(params: SignupParams): Promise<SignupOutcome>;
  confirm(tokenHash: string): Promise<ConfirmOutcome>;
  /** Bestätigt Gratis-Rezepte (oder den Newsletter); speichert beim ersten Mal das Abmelde-Token der Download-Mail. */
  confirmLeadMagnet(
    tokenHash: string,
    newUnsubscribeTokenHash: string,
  ): Promise<LeadMagnetConfirmResult>;
  unsubscribe(unsubscribeTokenHash: string): Promise<boolean>;
}

export class WaitlistStoreError extends Error {
  constructor(status: number) {
    // Keine Antwort-Inhalte übernehmen – könnten E-Mail-Adressen enthalten.
    super(`Supabase-Aufruf fehlgeschlagen (HTTP ${status}).`);
    this.name = 'WaitlistStoreError';
  }
}

type FetchFn = typeof fetch;

export function createSupabaseWaitlistStore(
  config: Pick<WaitlistConfig, 'supabaseUrl' | 'supabaseServiceKey'>,
  fetchFn: FetchFn = fetch,
): WaitlistStore {
  async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    const headers: Record<string, string> = {
      apikey: config.supabaseServiceKey,
      'Content-Type': 'application/json',
    };
    // Alter service_role-Schlüssel ist ein JWT und gehört zusätzlich in Authorization; der neue sb_secret_… nicht.
    if (config.supabaseServiceKey.startsWith('eyJ')) {
      headers.Authorization = `Bearer ${config.supabaseServiceKey}`;
    }
    const response = await fetchFn(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new WaitlistStoreError(response.status);
    }
    return response.json();
  }

  return {
    async signup(p) {
      const result = await rpc('waitlist_signup', {
        p_email: p.email,
        p_consent_text_version: p.consentTextVersion,
        p_ip_hash: p.ipHash,
        p_email_hash: p.emailHash,
        p_token_hash: p.tokenHash,
        p_unsubscribe_token_hash: p.unsubscribeTokenHash,
        p_token_expires_at: p.tokenExpiresAt.toISOString(),
        // Warteliste: Standardwerte der Datenbank-Funktion (source = 'warteliste', kein Newsletter) – so
        // funktioniert die Warteliste auch, falls die Website kurz vor der Migration live geht.
        ...(p.source === 'warteliste'
          ? {}
          : { p_source: p.source, p_newsletter_opt_in: p.newsletterOptIn }),
      });
      if (SIGNUP_OUTCOMES.includes(result)) return result as SignupOutcome;
      throw new WaitlistStoreError(500);
    },
    async confirm(tokenHash) {
      const result = await rpc('waitlist_confirm', { p_token_hash: tokenHash });
      if (result === 'confirmed' || result === 'expired' || result === 'invalid') return result;
      throw new WaitlistStoreError(500);
    },
    async confirmLeadMagnet(tokenHash, newUnsubscribeTokenHash) {
      const result = (await rpc('lead_magnet_confirm', {
        p_token_hash: tokenHash,
        p_unsubscribe_token_hash: newUnsubscribeTokenHash,
      })) as { result?: unknown; email?: unknown; newsletter_opt_in?: unknown } | null;
      const outcome = result?.result;
      if (
        outcome !== 'confirmed' &&
        outcome !== 'newsletter' &&
        outcome !== 'expired' &&
        outcome !== 'invalid'
      ) {
        throw new WaitlistStoreError(500);
      }
      return {
        outcome,
        email: typeof result?.email === 'string' ? result.email : null,
        newsletterOptIn:
          typeof result?.newsletter_opt_in === 'boolean' ? result.newsletter_opt_in : null,
      };
    },
    async unsubscribe(unsubscribeTokenHash) {
      const result = await rpc('waitlist_unsubscribe', {
        p_unsubscribe_token_hash: unsubscribeTokenHash,
      });
      return result === true;
    },
  };
}
