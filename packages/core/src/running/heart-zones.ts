import { z } from 'zod';

import {
  BODY_METRIC_LIMITS,
  HEART_RATE_LIMITS,
  HR_RESERVE_ZONES,
  HR_ZONE_PERCENTS,
} from '../constants';
import { addDays } from '../dates';
import { hrZones, type HeartRateZones, maxHeartRate } from '../wearables/heart-rate';

/**
 * Pulszonen mit eigenem Maximalpuls und Herzfrequenz-Reserve (Lauf-Paket 2, docs/PLAN-LAUF-PAKET-2.md 2): fünf Zonen
 * aus HFmax (Alter nach Tanaka bzw. eigener Wert) – oder nach Karvonen (Ruhepuls + % der Reserve), wenn ein Ruhepuls
 * bekannt ist und die Person das nicht abgeschaltet hat. Puls ist ein Gesundheitsdatum: Die App zeigt das nur mit
 * Einwilligung health_data (Uhr-Puls zusätzlich wearable_data) und nie auf dem Story-Bild. Rein, ohne Speicher.
 */

export type PulseZoneMethod = 'hf_max' | 'reserve';

/** Einstellung je Konto auf dem Gerät: eigener Maximalpuls (oder null = aus dem Alter), Ruhepuls einbeziehen. */
export const pulseZoneSettingsSchema = z.strictObject({
  hfMaxOverride: z
    .number()
    .int()
    .min(HEART_RATE_LIMITS.maxOverrideBpm.min)
    .max(HEART_RATE_LIMITS.maxOverrideBpm.max)
    .nullable(),
  useRestingHr: z.boolean(),
});
export type PulseZoneSettings = z.infer<typeof pulseZoneSettingsSchema>;

export const DEFAULT_PULSE_ZONE_SETTINGS: PulseZoneSettings = {
  hfMaxOverride: null,
  useRestingHr: true,
};

/** Gespeicherte Einstellung prüfen – kaputt oder fehlend → Standard (nie raten). */
export function parsePulseZoneSettings(raw: unknown): PulseZoneSettings {
  const parsed = pulseZoneSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_PULSE_ZONE_SETTINGS;
}

/** Zonen mit Herkunft (für den Hinweis-Text in der App). */
export interface PulseZones extends HeartRateZones {
  readonly method: PulseZoneMethod;
  /** Verwendeter Ruhepuls (nur bei `reserve`). */
  readonly restingBpm: number | null;
  /** true = HFmax ist ein eigener Wert (sonst aus dem Alter geschätzt). */
  readonly hfMaxOwn: boolean;
}

/**
 * Karvonen-Grenzen: Ruhepuls + p % × (HFmax − Ruhepuls), gerundet. Reserve unter HR_RESERVE_ZONES.minReserveBpm oder
 * ungültiger Ruhepuls → null (dann gilt % HFmax).
 */
export function reserveZones(hfMax: number, restingBpm: number): HeartRateZones | null {
  const { min, max } = BODY_METRIC_LIMITS.restingHeartRateBpm;
  if (!Number.isFinite(restingBpm) || restingBpm < min || restingBpm > max) return null;
  const reserve = hfMax - restingBpm;
  if (reserve < HR_RESERVE_ZONES.minReserveBpm) return null;
  return {
    hfMax,
    bounds: HR_ZONE_PERCENTS.map((p) => Math.round(restingBpm + (reserve * p) / 100)),
  };
}

/**
 * Zonen für eine Person: HFmax = eigener Wert (Bereich HEART_RATE_LIMITS.maxOverrideBpm) oder Tanaka aus dem Alter;
 * mit Ruhepuls und `useRestingHr` nach Karvonen, sonst % HFmax.
 */
export function pulseZonesFor(input: {
  readonly age: number;
  readonly settings: PulseZoneSettings;
  readonly restingBpm: number | null;
}): PulseZones {
  const own = input.settings.hfMaxOverride;
  const hfMax = maxHeartRate(input.age, own);
  const hfMaxOwn = own !== null && hfMax === own;
  if (input.settings.useRestingHr && input.restingBpm !== null) {
    const zones = reserveZones(hfMax, input.restingBpm);
    if (zones) return { ...zones, method: 'reserve', restingBpm: input.restingBpm, hfMaxOwn };
  }
  return { ...hrZones(hfMax), method: 'hf_max', restingBpm: null, hfMaxOwn };
}

/**
 * Ruhepuls für die Zonen: Median der Tageswerte der Uhr der letzten HR_RESERVE_ZONES.restingWindowDays Tage (bis
 * einschließlich `today`, mind. restingMinValues Werte), sonst der Wert aus den Körperdaten, sonst null.
 */
export function restingHeartRateFor(input: {
  readonly daily: readonly { readonly day: string; readonly resting_hr_bpm: number | null }[];
  readonly bodyMetricBpm: number | null;
  readonly today: string;
}): number | null {
  const from = addDays(input.today, -(HR_RESERVE_ZONES.restingWindowDays - 1));
  const { min, max } = BODY_METRIC_LIMITS.restingHeartRateBpm;
  const values = input.daily
    .filter((d) => d.day >= from && d.day <= input.today)
    .map((d) => d.resting_hr_bpm)
    .filter((v): v is number => v !== null && Number.isFinite(v) && v >= min && v <= max)
    .sort((a, b) => a - b);
  if (values.length >= HR_RESERVE_ZONES.restingMinValues) {
    const mid = Math.floor(values.length / 2);
    const median =
      values.length % 2 === 1
        ? (values[mid] as number)
        : ((values[mid - 1] as number) + (values[mid] as number)) / 2;
    return Math.round(median);
  }
  const body = input.bodyMetricBpm;
  return body !== null && Number.isFinite(body) && body >= min && body <= max
    ? Math.round(body)
    : null;
}

/** Eine Zeile der Zonen-Tabelle: Bereich in /min und Zeit. */
export interface PulseZoneRow {
  /** 1–5. */
  readonly zone: number;
  readonly fromBpm: number;
  /** Obergrenze (ausschließlich); Zone 5 = HFmax. */
  readonly toBpm: number;
  readonly seconds: number;
  /** Anteil an der Zeit in allen Zonen (0–1). */
  readonly share: number;
}

/** Tabelle „Zone · Bereich · Zeit“ aus Grenzen und Sekunden je Zone (zone_s der Puls-Zusammenfassung). */
export function pulseZoneRows(
  zones: Pick<HeartRateZones, 'bounds'>,
  zoneS: readonly number[],
): PulseZoneRow[] {
  const valid = zoneS.map((s) => (Number.isFinite(s) && s > 0 ? s : 0));
  const total = valid.reduce((a, b) => a + b, 0);
  return [0, 1, 2, 3, 4].map((i) => ({
    zone: i + 1,
    fromBpm: zones.bounds[i] ?? 0,
    toBpm: zones.bounds[i + 1] ?? 0,
    seconds: valid[i] ?? 0,
    share: total > 0 ? (valid[i] ?? 0) / total : 0,
  }));
}

/**
 * Zonen für die Anzeige einer gespeicherten Einheit: Die Zeiten je Zone wurden beim Abgleich mit `hf_max_used` und –
 * bei Herzfrequenz-Reserve – mit dem damaligen Ruhepuls gerechnet (`restingUsed`, gemerkt auf dem Gerät). Ohne
 * Ruhepuls bzw. zu kleine Reserve: % HFmax. `hfMaxOverride` nur für den Hinweis „eigener Wert“.
 */
export function zonesForSummary(input: {
  readonly hfMaxUsed: number;
  readonly restingUsed: number | null;
  readonly hfMaxOverride: number | null;
}): PulseZones {
  const hfMaxOwn = input.hfMaxOverride === input.hfMaxUsed;
  if (input.restingUsed !== null) {
    const zones = reserveZones(input.hfMaxUsed, input.restingUsed);
    if (zones) return { ...zones, method: 'reserve', restingBpm: input.restingUsed, hfMaxOwn };
  }
  return { ...hrZones(input.hfMaxUsed), method: 'hf_max', restingBpm: null, hfMaxOwn };
}

/**
 * Gemerkte Grundlage der Zonen je Uhr-Einheit (nur auf dem Gerät, Schlüssel = Health-Connect-id): verwendeter
 * Ruhepuls bei Herzfrequenz-Reserve, null = % HFmax. So zeigt die App die Bereiche, mit denen die Zeit je Zone beim
 * Abgleich gerechnet wurde – auch wenn sich Einstellung oder Ruhepuls später ändern. Fehlt eine Einheit (älterer
 * Abgleich, anderes Gerät) → % HFmax wie vor dem Lauf-Paket 2.
 */
export const zoneBasisStoreSchema = z.record(
  z.string().min(1).max(200),
  z
    .number()
    .int()
    .min(BODY_METRIC_LIMITS.restingHeartRateBpm.min)
    .max(BODY_METRIC_LIMITS.restingHeartRateBpm.max)
    .nullable(),
);
export type ZoneBasisStore = z.infer<typeof zoneBasisStoreSchema>;

/** Gespeicherte Grundlagen prüfen – kaputte Einträge fallen weg. */
export function parseZoneBasisStore(raw: unknown): ZoneBasisStore {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: ZoneBasisStore = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const one = zoneBasisStoreSchema.safeParse({ [key]: value });
    if (one.success) Object.assign(out, one.data);
  }
  return out;
}
