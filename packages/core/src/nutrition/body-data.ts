import { z } from 'zod';

import { isoDateSchema } from '../age';

import { bodyMetricsRowSchema, type BodyMetricsRowInput } from './schemas';

/** Ein Körperwert mit eigenem Messdatum. */
export interface DatedValue {
  readonly value: number;
  readonly measuredOn: string;
}

export interface LatestBodyValues {
  readonly height: DatedValue | null;
  readonly weight: DatedValue | null;
  readonly bodyFat: DatedValue | null;
}

/**
 * Neueste Körperdaten JE FELD (docs/PLAN-PHASE-5.md 4.2, S6): Größe, Gewicht und Körperfett kommen jeweils aus der
 * neuesten Zeile, in der DIESES Feld einen Wert hat – jedes mit eigenem Messdatum. Bei gleichem Datum gewinnt die
 * spätere Zeile der Liste (deterministisch). Mit `asOf` zählen Zeilen mit Messdatum NACH diesem Tag nicht
 * (Wächter N1, K3: ein Eintrag in der Zukunft darf die laufende Woche nicht bestimmen).
 */
export function latestBodyValues(
  rows: readonly BodyMetricsRowInput[],
  asOf?: string,
): LatestBodyValues {
  const limit = asOf === undefined ? undefined : isoDateSchema.parse(asOf);
  const parsed = z
    .array(bodyMetricsRowSchema)
    .parse(rows)
    .filter((row) => limit === undefined || row.measuredOn <= limit);
  let height: DatedValue | null = null;
  let weight: DatedValue | null = null;
  let bodyFat: DatedValue | null = null;
  const newer = (current: DatedValue | null, measuredOn: string) =>
    current === null || measuredOn >= current.measuredOn;
  for (const row of parsed) {
    if (row.heightCm !== null && newer(height, row.measuredOn)) {
      height = { value: row.heightCm, measuredOn: row.measuredOn };
    }
    if (row.weightKg !== null && newer(weight, row.measuredOn)) {
      weight = { value: row.weightKg, measuredOn: row.measuredOn };
    }
    if (row.bodyFatPct !== null && newer(bodyFat, row.measuredOn)) {
      bodyFat = { value: row.bodyFatPct, measuredOn: row.measuredOn };
    }
  }
  return { height, weight, bodyFat };
}

/** BMI = kg / m². */
export function bodyMassIndex(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}
