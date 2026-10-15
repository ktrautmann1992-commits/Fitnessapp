import { z } from 'zod';

import { INTAKE_ZONES } from '../constants';
import type { NutritionDayTargets } from '../nutrition/targets';

/**
 * Kalorienbalken der Tagesauswertung (docs/PLAN-AUSWERTUNG.md 2.1–2.4, A-G5/A-G6/A-G8, Etappe A2).
 *
 * Rechnet KEINE eigenen Grenzen: Untergrenze U (`floorKcal`), Planband B (`band`), Obergrenze O (`ceilingKcal`) und
 * Tagesziel Z (`targetKcal`) kommen unverändert aus `nutritionTargetsForWeek` (einzige Stelle der Schutzgrenzen:
 * `clampCalorieTarget`). Dazu nur der Faktor aus `INTAKE_ZONES` für R = max(O; Z × 1,2). Strukturtest in
 * `intake-zone.test.ts` (Eigenschaft d).
 *
 * | Zone           | gegessen G       | Ton     |
 * | below_floor    | G < U            | rot     |
 * | below_target   | U ≤ G < G0       | gelb    |
 * | in_range       | G0 ≤ G ≤ B_max   | grün    |
 * | above_target   | B_max < G ≤ R    | gelb    |
 * | well_above     | G > R            | rot     |
 *
 * G0 = Beginn von Grün: B_min; beim Abnehmen (Tag mit Defizit) max(U; Z × 0,95; B_min) – Gründer-Entscheidung G1.
 *
 * Heute (2.2): unter G0 neutral „Noch offen“ (`open`) – nie rot am Morgen. Tage ohne Eintrag: `no_entries` (nie
 * 0 kcal, nie rot). Künftige Tage: `future` (nur Ziel, kein Balken). „Kalorienzahlen aus“ bzw. Schwangerschaft/Stillzeit
 * (`showNumbers = false`): `hidden` – der Typ enthält dann KEINE Zahl und keine Farbe (2.3).
 * Ziele und Zonen werden nie gespeichert (2.7) und nie geloggt.
 */

export const INTAKE_ZONE_IDS = [
  'below_floor',
  'below_target',
  'in_range',
  'above_target',
  'well_above',
] as const;
export type IntakeZoneId = (typeof INTAKE_ZONE_IDS)[number];

/** Farbe als Design-Token-Rolle (danger/warning/success) bzw. neutral = Markenfarbe. */
export type IntakeTone = 'danger' | 'warning' | 'success' | 'neutral';

const ZONE_TONES: Readonly<Record<IntakeZoneId | 'open', IntakeTone>> = {
  below_floor: 'danger',
  below_target: 'warning',
  in_range: 'success',
  above_target: 'warning',
  well_above: 'danger',
  open: 'neutral',
};

export function intakeTone(zone: IntakeZoneId | 'open'): IntakeTone {
  return ZONE_TONES[zone];
}

export interface IntakeZoneInput {
  /** Summe der eingetragenen kcal des Tages (Einträge ohne Wert zählen nicht). */
  readonly eatenKcal: number;
  /** Mindestens ein Eintrag MIT kcal-Wert. */
  readonly hasEntries: boolean;
  readonly day: Pick<
    NutritionDayTargets,
    'mode' | 'targetKcal' | 'band' | 'floorKcal' | 'ceilingKcal' | 'goalAdjustment'
  >;
  readonly isToday: boolean;
  readonly isFuture: boolean;
  readonly showNumbers: boolean;
}

/** Abschnitt der Skala [fromKcal; toKcal] in Reihenfolge von links nach rechts. */
export interface IntakeScaleZone {
  readonly zone: IntakeZoneId;
  readonly tone: IntakeTone;
  readonly fromKcal: number;
  readonly toKcal: number;
}

export interface IntakeBar {
  readonly kind: 'bar';
  readonly zone: IntakeZoneId | 'open';
  readonly tone: IntakeTone;
  readonly eatenKcal: number;
  readonly targetKcal: number;
  readonly scale: { readonly maxKcal: number; readonly zones: readonly IntakeScaleZone[] };
  readonly markers: {
    readonly floorKcal: number;
    readonly bandMinKcal: number;
    /** Beginn von Grün: B_min, beim Abnehmen max(U; Z × 0,95; B_min) (G1). */
    readonly greenFromKcal: number;
    readonly bandMaxKcal: number;
    readonly targetKcal: number;
    /** R = max(O; Z × 1,2): darüber „deutlich über deinem Ziel“. */
    readonly upperKcal: number;
  };
}

/** „Kalorienzahlen aus“ / Schwangerschaft: ohne jede Zahl und ohne Farbe (2.3). */
export interface IntakeHidden {
  readonly kind: 'hidden';
}

export type IntakeZoneResult =
  | IntakeHidden
  /** Kein Tagesziel (keine Körperdaten, keine Einwilligung, `no_targets`). */
  | { readonly kind: 'no_target' }
  /** Künftiger Tag: Vorschau mit Tagesziel, kein Balken. */
  | { readonly kind: 'future'; readonly targetKcal: number }
  /** Nichts (mit kcal) eingetragen: grau, nie 0 kcal, nie rot. */
  | { readonly kind: 'no_entries'; readonly targetKcal: number }
  | IntakeBar;

const inputSchema = z
  .object({
    eatenKcal: z.number().finite().min(0),
    hasEntries: z.boolean(),
    isToday: z.boolean(),
    isFuture: z.boolean(),
    showNumbers: z.boolean(),
  })
  .refine((v) => !(v.isToday && v.isFuture), { message: 'Ein Tag ist nie heute und künftig.' });

const EPS = 1e-9;

/** Grenzen eines Tages aus den Zielen (nur abgelesen) – null ohne Ziel. */
function dayLimits(day: IntakeZoneInput['day']) {
  const { targetKcal: z0, band, floorKcal: u, ceilingKcal: o } = day;
  if (day.mode === 'no_targets' || z0 === null || band === null || u === null || o === null) {
    return null;
  }
  if (![z0, band.min, band.max, u, o].every((v) => Number.isFinite(v))) {
    throw new RangeError('Ungültige Tagesziele.');
  }
  // Reihenfolge laut Engine: U ≤ B_min ≤ B_max und U ≤ Z. (Z kann durch die gerichtete Rundung knapp über O liegen,
  // wenn U = O.) Alles andere ist ein Datenfehler – nie still raten.
  if (!(u <= band.min + EPS && band.min <= band.max + EPS && u <= z0 + EPS)) {
    throw new RangeError('Ungültige Tagesziele.');
  }
  // R = max(O; Z × 1,2). Das Planband darf laut Engine bis 20 kcal über O reichen (Mindestbreite) – R liegt nie darunter.
  const upper = Math.max(o, z0 * INTAKE_ZONES.upperRedTargetFactor, band.max);
  // Abnehmen (Energie-Richtung Defizit an diesem Tag): Grün erst etwa ab dem Tagesziel (Gründer-Entscheidung G1,
  // 15.10.2026). Nie unter B_min und nie über Z (Z bleibt immer grün).
  const deficit = day.goalAdjustment !== null && day.goalAdjustment < 0;
  const greenFrom = deficit
    ? Math.min(z0, Math.max(band.min, u, z0 * INTAKE_ZONES.lossGreenFromTargetFactor))
    : band.min;
  return { target: z0, floor: u, greenFrom, bandMin: band.min, bandMax: band.max, upper };
}

type Limits = NonNullable<ReturnType<typeof dayLimits>>;

/** Zone einer Menge an einem vergangenen Tag (volle Farbskala, 2.1). */
function zoneOf(eaten: number, l: Limits): IntakeZoneId {
  if (eaten < l.floor) return 'below_floor';
  if (eaten < l.greenFrom) return 'below_target';
  if (eaten <= l.bandMax) return 'in_range';
  if (eaten <= l.upper) return 'above_target';
  return 'well_above';
}

function scaleZones(l: Limits, maxKcal: number): IntakeScaleZone[] {
  const parts: [IntakeZoneId, number, number][] = [
    ['below_floor', 0, l.floor],
    ['below_target', l.floor, l.greenFrom],
    ['in_range', l.greenFrom, l.bandMax],
    ['above_target', l.bandMax, l.upper],
    ['well_above', l.upper, maxKcal],
  ];
  // Leere Abschnitte fallen weg (z. B. keine gelbe Zone unten, wenn U ≥ 0,9 × Z).
  return parts
    .filter(([, from, to]) => to > from + EPS)
    .map(([zone, fromKcal, toKcal]) => ({ zone, tone: ZONE_TONES[zone], fromKcal, toKcal }));
}

export function intakeZone(input: IntakeZoneInput & { readonly showNumbers: false }): IntakeHidden;
export function intakeZone(input: IntakeZoneInput): IntakeZoneResult;
export function intakeZone(input: IntakeZoneInput): IntakeZoneResult {
  const flags = inputSchema.parse({
    eatenKcal: input.eatenKcal,
    hasEntries: input.hasEntries,
    isToday: input.isToday,
    isFuture: input.isFuture,
    showNumbers: input.showNumbers,
  });
  // Ohne Zahlen keine Bewertung – auch keine Farbe und kein Ziel (A-G8).
  if (!flags.showNumbers) return { kind: 'hidden' };
  const limits = dayLimits(input.day);
  if (limits === null) return { kind: 'no_target' };
  if (flags.isFuture) return { kind: 'future', targetKcal: limits.target };
  if (!flags.hasEntries) return { kind: 'no_entries', targetKcal: limits.target };
  const eaten = flags.eatenKcal;
  const past = zoneOf(eaten, limits);
  // Heute: unter B_min neutral „Noch offen“ (2.2, A-G6) – auch unter U (der Tag läuft noch).
  const zone: IntakeZoneId | 'open' = flags.isToday && eaten < limits.greenFrom ? 'open' : past;
  const maxKcal = Math.max(limits.upper * INTAKE_ZONES.scaleHeadroomFactor, eaten);
  return {
    kind: 'bar',
    zone,
    tone: ZONE_TONES[zone],
    eatenKcal: eaten,
    targetKcal: limits.target,
    scale: { maxKcal, zones: scaleZones(limits, maxKcal) },
    markers: {
      floorKcal: limits.floor,
      bandMinKcal: limits.bandMin,
      greenFromKcal: limits.greenFrom,
      bandMaxKcal: limits.bandMax,
      targetKcal: limits.target,
      upperKcal: limits.upper,
    },
  };
}
