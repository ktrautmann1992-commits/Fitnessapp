/**
 * Zugriff auf die Warteliste in Supabase – nur über die drei Datenbank-Funktionen (Migration
 * 20261004130000_waitlist.sql) und nur mit dem geheimen service_role-Schlüssel (nie im Browser).
 * Direkter REST-Aufruf (PostgREST /rpc), kein zusätzliches Paket.
 */
import type { WaitlistConfig } from './config';

export type SignupOutcome = 'send' | 'confirmed' | 'rate_limited';
export type ConfirmOutcome = 'confirmed' | 'expired' | 'invalid';

export interface SignupParams {
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
      });
      if (result === 'send' || result === 'confirmed' || result === 'rate_limited') return result;
      throw new WaitlistStoreError(500);
    },
    async confirm(tokenHash) {
      const result = await rpc('waitlist_confirm', { p_token_hash: tokenHash });
      if (result === 'confirmed' || result === 'expired' || result === 'invalid') return result;
      throw new WaitlistStoreError(500);
    },
    async unsubscribe(unsubscribeTokenHash) {
      const result = await rpc('waitlist_unsubscribe', {
        p_unsubscribe_token_hash: unsubscribeTokenHash,
      });
      return result === true;
    },
  };
}
