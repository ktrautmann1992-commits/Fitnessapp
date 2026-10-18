import type { AppSupabaseClient } from '@fitnessapp/db';
import { z } from 'zod';

/**
 * Live-Anpassung im SUPABASE-MODUS – nur VORBEREITET (Phase 4b, Etappe D; Server-Route und Datenbank kommen mit den
 * Etappen B und C, docs/PLAN-PHASE-4B.md 6.1, 8.2). Bis dahin ist der Aufruf im Supabase-Backend ausgeschaltet
 * (`liveAdjustServer` fehlt in create-backend.ts) – die Live-Anpassung ist dort ausgeblendet, nichts wird gerechnet.
 * Im Testmodus wird diese Datei nie benutzt (der rechnet auf dem Gerät).
 *
 * Schritt 4 nach dem Sync (8.2): nur mit Adresse von apps/web (EXPO_PUBLIC_WEB_URL) UND laut Server aktiver
 * Live-Anpassung (`live_adjustment_status().active`, die Wahrheit prüft die Route erneut) `POST /api/live-anpassung` mit
 * dem Login-Token. Fehler sind still („später erneut“), nie blockierend; die Antwort enthält keine Inhalte.
 */
export type LiveAdjustRequestResult =
  /** Keine Adresse (EXPO_PUBLIC_WEB_URL fehlt) bzw. nicht aktiv – kein Aufruf. */
  | 'skipped'
  | 'requested'
  /** Netz, Ratenbegrenzung (429) oder Serverfehler – beim nächsten Sync still erneut. */
  | 'failed';

const statusSchema = z.object({
  active: z.boolean(),
  reason: z.enum(['ok', 'flag_off', 'no_entitlement']),
});

export async function requestLiveAdjustment(options: {
  client: AppSupabaseClient;
  /** readWebUrl(EXPO_PUBLIC_WEB_URL); null = kein Aufruf. */
  webUrl: string | null;
  fetchFn: (url: string, init: RequestInit) => Promise<Response>;
}): Promise<LiveAdjustRequestResult> {
  const { client, webUrl, fetchFn } = options;
  if (webUrl === null) return 'skipped';
  try {
    // Funktion aus Etappe B (noch nicht in database.types.ts) – deshalb ohne Typ-Bindung aufgerufen.
    const untyped = client as unknown as {
      rpc: (name: string) => PromiseLike<{ data: unknown; error: unknown }>;
    };
    const status = await untyped.rpc('live_adjustment_status');
    const parsed = statusSchema.safeParse(status.data);
    if (status.error || !parsed.success || !parsed.data.active) return 'skipped';
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return 'skipped';
    const response = await fetchFn(`${webUrl}/api/live-anpassung`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    return response.ok ? 'requested' : 'failed';
  } catch {
    return 'failed';
  }
}
