import { z } from 'zod';

import { CADENCE } from '../constants';

/**
 * Kadenz (Schritte je Minute, Lauf-Paket 2, docs/PLAN-LAUF-PAKET-2.md 6): Schritte der Uhr im Zeitraum der Einheit ÷
 * Dauer. Nur Anzeige mit sanftem Hinweis-Bereich (CADENCE) – keine Regel, kein Ziel. Rein.
 */

export type CadenceSport = 'run' | 'walk';

/** Ø Kadenz in Schritten/min (gerundet); null ohne Schritte, zu kurz oder unplausibel (Messfehler). */
export function averageCadence(input: {
  readonly steps: number | null | undefined;
  readonly durationS: number;
  readonly sport: CadenceSport;
}): number | null {
  const { steps, durationS } = input;
  if (steps === null || steps === undefined || !Number.isFinite(steps) || steps <= 0) return null;
  if (!Number.isFinite(durationS) || durationS < CADENCE.minDurationS) return null;
  const spm = Math.round(steps / (durationS / 60));
  const range = CADENCE.plausibleSpm[input.sport];
  return spm >= range.min && spm <= range.max ? spm : null;
}

/** Hinweis-Bereich beim Laufen (Gehen: keiner). */
export type CadenceHint = 'low' | 'typical' | 'high';

export function cadenceHint(spm: number, sport: CadenceSport): CadenceHint | null {
  if (sport !== 'run' || !Number.isFinite(spm)) return null;
  if (spm < CADENCE.hint.lowBelow) return 'low';
  if (spm > CADENCE.hint.highAbove) return 'high';
  return 'typical';
}

/**
 * Gemerkte Kadenz je Uhr-Einheit (nur auf dem Gerät, Schlüssel = Health-Connect-id der Einheit): Prüfung beim Lesen –
 * kaputte Einträge fallen weg.
 */
export const cadenceStoreSchema = z.record(
  z.string().min(1).max(200),
  z.number().int().min(CADENCE.plausibleSpm.walk.min).max(CADENCE.plausibleSpm.run.max),
);
export type CadenceStore = z.infer<typeof cadenceStoreSchema>;

export function parseCadenceStore(raw: unknown): CadenceStore {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: CadenceStore = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const one = cadenceStoreSchema.safeParse({ [key]: value });
    if (one.success) Object.assign(out, one.data);
  }
  return out;
}
