import { z } from 'zod';

/**
 * Reine Regeln zu „Nahrungsergänzungsmittel anzeigen“ (06.11.2026, docs/PLAN-SUPPLEMENTE-TRAINING.md) – ohne
 * React Native, damit sie getestet werden können (Speicher: lib/supplement-prefs.ts).
 */

const storedSchema = z.object({ visible: z.boolean().nullable().catch(null) });

/** Gespeicherten Wert lesen (ungültig → noch nicht gewählt). */
export function parseSupplementPrefs(value: unknown): { visible: boolean | null } {
  const parsed = storedSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : { visible: null };
}

/**
 * Sichtbar? Eigene Wahl gewinnt; ohne Wahl AN nur, wenn schon Supplement-Daten gespeichert sind (Bestand), sonst AUS.
 */
export function supplementsVisible(visible: boolean | null, hasSupplementData: boolean): boolean {
  return visible ?? hasSupplementData;
}
