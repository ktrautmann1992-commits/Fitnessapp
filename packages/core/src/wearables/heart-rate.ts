import { HEART_RATE_LIMITS, HR_MAX_FORMULA, HR_ZONE_PERCENTS } from '../constants';
import type { HeartRateSummary } from './schema';

/**
 * Pulszonen und Puls-Zusammenfassung einer Einheit (W8-6, W8-10, docs/PLAN-PHASE-8.md 5.3). Rein, ohne Speicher.
 * Hinweis für die App: Pulszonen sind Schätzwerte; Betablocker u. a. verändern den Puls.
 */

/** Ein Messwert aus Health Connect (HeartRateRecord.samples). */
export interface HeartRateSample {
  /** ISO-Zeitstempel. */
  readonly time: string;
  readonly beatsPerMinute: number;
}

/**
 * HFmax: eigener Wert (z. B. aus einem Leistungstest, 120–230 /min) hat Vorrang, sonst Tanaka 2001
 * (208 − 0,7 × Alter, gerundet). Eigener Wert außerhalb des Bereichs zählt nicht (Schätzung statt Fehler).
 */
export function maxHeartRate(age: number, override?: number | null): number {
  const { min, max } = HEART_RATE_LIMITS.maxOverrideBpm;
  if (override !== null && override !== undefined && Number.isInteger(override)) {
    if (override >= min && override <= max) return override;
  }
  const estimate = Math.round(HR_MAX_FORMULA.intercept - HR_MAX_FORMULA.ageFactor * age);
  return Math.min(max, Math.max(min, estimate));
}

/** Untere Grenzen der Zonen 1–5 in /min (Zone n: von bounds[n−1] bis unter bounds[n]). */
export interface HeartRateZones {
  readonly hfMax: number;
  /** Sechs Grenzen in /min (50 %, 60 %, … 100 % von HFmax), gerundet. */
  readonly bounds: readonly number[];
}

export function hrZones(hfMax: number): HeartRateZones {
  return { hfMax, bounds: HR_ZONE_PERCENTS.map((p) => Math.round((hfMax * p) / 100)) };
}

/** Zone 0–4 (= Zone 1–5) eines Pulswerts; null = unter Zone 1. Über HFmax zählt als Zone 5. */
export function zoneIndex(bpm: number, zones: HeartRateZones): number | null {
  const b = zones.bounds;
  if (bpm < (b[0] ?? 0)) return null;
  for (let i = 1; i < 5; i += 1) {
    if (bpm < (b[i] ?? Infinity)) return i - 1;
  }
  return 4;
}

const plausible = (bpm: number) =>
  Number.isFinite(bpm) &&
  bpm >= HEART_RATE_LIMITS.sampleBpm.min &&
  bpm <= HEART_RATE_LIMITS.sampleBpm.max;

/**
 * Ø, Max und Sekunden je Zone aus den Messwerten INNERHALB der Einheit (`from`–`to`, ISO). Unplausible Werte
 * (< 30 oder > 230 /min) werden verworfen. Zeit je Zone: Abstand bis zum nächsten Messwert, nur Lücken bis 30 s
 * (HEART_RATE_LIMITS.gapMaxS); der letzte Messwert zählt nicht in die Zonen; Sekunden abgerundet (Summe nie länger
 * als die Einheit). Ø = Mittel der Messwerte, gerundet.
 * Keine gültigen Messwerte → null (keine Zusammenfassung).
 */
export function summarizeHeartRate(
  samples: readonly HeartRateSample[],
  zones: HeartRateZones,
  window: { from: string; to: string },
): HeartRateSummary | null {
  const from = Date.parse(window.from);
  const to = Date.parse(window.to);
  const points = samples
    .map((s) => ({ t: Date.parse(s.time), bpm: s.beatsPerMinute }))
    .filter((p) => Number.isFinite(p.t) && p.t >= from && p.t <= to && plausible(p.bpm))
    .sort((a, b) => a.t - b.t);
  if (points.length === 0) return null;
  const zoneS = [0, 0, 0, 0, 0];
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    if (!current || !next) continue;
    const gap = (next.t - current.t) / 1000;
    if (gap <= 0 || gap > HEART_RATE_LIMITS.gapMaxS) continue;
    const zone = zoneIndex(current.bpm, zones);
    if (zone !== null) zoneS[zone] = (zoneS[zone] ?? 0) + gap;
  }
  const total = points.reduce((sum, p) => sum + p.bpm, 0);
  const avg = Math.round(total / points.length);
  const max = Math.round(Math.max(...points.map((p) => p.bpm)));
  return {
    avg_bpm: Math.min(avg, max),
    max_bpm: max,
    zone_s: zoneS.map((s) => Math.floor(s)),
    hf_max_used: zones.hfMax,
  };
}
