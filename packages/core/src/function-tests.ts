import { z } from 'zod';

import type { AgingRules, StandStage } from './aging-screening';
import { isoDateSchema } from './age';

/**
 * Selbsttests „Mein Fortschritt“ (docs/PLAN-FIT-IM-ALTER.md 10, FA-G12, Etappe FA1 Teil 2): NUR der eigene Verlauf.
 * Keine Normwerte, keine Altersvergleiche, keine Ampel, kein „Risiko“ – und die Ergebnisse steuern NIE den Plan
 * (MDR-Abgrenzung). Die Ergebnisse sind Gesundheitsdaten (Tabelle `function_tests` folgt mit Etappe FA3).
 * Die Wörter „Test“ und „STEADI“ erscheinen in der App nicht (Name „Mein Fortschritt“).
 */

export const FUNCTION_TEST_KINDS = [
  'sit_to_stand_30s',
  'stand_stages',
  'single_leg_stand',
] as const;
export type FunctionTestKind = (typeof FUNCTION_TEST_KINDS)[number];

/** Stand-Stufen in fester Reihenfolge (Füße nebeneinander → Halbtandem → Tandem → Einbeinstand), je bis 10 s. */
export const STAND_STAGES = [
  'side_by_side',
  'semi_tandem',
  'tandem',
  'single_leg',
] as const satisfies readonly StandStage[];

/**
 * Grenzen der Eingaben (Plausibilität, keine Bewertung): Aufstehen 0–60 Mal in 30 s; Einbeinstand 0–30 s je Bein.
 * PRODUKTENTSCHEIDUNG.
 */
export const FUNCTION_TEST_LIMITS = {
  sitToStandMaxCount: 60,
  singleLegMaxS: 30,
  standStageMaxS: 10,
  /** Vorschlag alle 4 Wochen (Erinnerung abschaltbar). */
  suggestEveryDays: 28,
} as const;

const L = FUNCTION_TEST_LIMITS;

export const functionTestResultSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('sit_to_stand_30s'),
    performedOn: isoDateSchema,
    count: z.number().int().min(0).max(L.sitToStandMaxCount),
    /** Mit Armhilfe (wird mitgespeichert, damit der Verlauf vergleichbar bleibt). */
    withArmSupport: z.boolean(),
  }),
  z.strictObject({
    kind: z.literal('stand_stages'),
    performedOn: isoDateSchema,
    /** Höchste geschaffte Stufe; null = keine Stufe geschafft. */
    highestStage: z.enum(STAND_STAGES).nullable(),
  }),
  z.strictObject({
    kind: z.literal('single_leg_stand'),
    performedOn: isoDateSchema,
    leftS: z.number().int().min(0).max(L.singleLegMaxS),
    rightS: z.number().int().min(0).max(L.singleLegMaxS),
  }),
]);
export type FunctionTestResult = z.infer<typeof functionTestResultSchema>;

export type FunctionTestAvailability =
  | { readonly kind: FunctionTestKind; readonly available: true; readonly maxStage?: StandStage }
  | {
      readonly kind: FunctionTestKind;
      readonly available: false;
      readonly reason: 'medical_notice_unconfirmed' | 'not_with_answers';
    };

/**
 * Welche Selbsttests sind möglich (Plan 10, S5)?
 * - Aufstehen gesperrt, solange ein Arzt-Hinweis (`medical_clearance_recommended`) nicht bestätigt ist.
 * - Stand-Stufen bei Sturz, Unsicherheit, Gehhilfe oder Blutverdünnern nur bis Halbtandem.
 * - Einbeinstand nicht bei diesen Angaben.
 */
export function availableFunctionTests(input: {
  readonly medicalClearancePending: boolean;
  readonly aging: Pick<AgingRules, 'standStagesMax'>;
}): FunctionTestAvailability[] {
  const limited = input.aging.standStagesMax !== 'single_leg';
  return [
    input.medicalClearancePending
      ? { kind: 'sit_to_stand_30s', available: false, reason: 'medical_notice_unconfirmed' }
      : { kind: 'sit_to_stand_30s', available: true },
    { kind: 'stand_stages', available: true, maxStage: input.aging.standStagesMax },
    limited
      ? { kind: 'single_leg_stand', available: false, reason: 'not_with_answers' }
      : { kind: 'single_leg_stand', available: true },
  ];
}

/** Ist die gemeldete Stand-Stufe erlaubt (nie über der Grenze aus den Zusatzfragen)? */
export function isStandStageAllowed(stage: StandStage | null, max: StandStage): boolean {
  return stage === null || STAND_STAGES.indexOf(stage) <= STAND_STAGES.indexOf(max);
}

/**
 * Verlauf als neutrale Zahl (Plan 10): nur „Letztes Mal X, heute Y“ – keine Bewertung, keine Richtung „besser/
 * schlechter“, kein Alarm. Gibt nur die Zahlen zurück; den festen Satz bei weniger („Schwankungen sind normal …“)
 * zeigt die App IMMER gleich, ohne Wertung.
 */
export function functionTestProgress(
  results: readonly FunctionTestResult[],
  kind: Extract<FunctionTestKind, 'sit_to_stand_30s'>,
): { readonly previous: number | null; readonly latest: number | null } {
  const own = results
    .filter((r): r is Extract<FunctionTestResult, { kind: 'sit_to_stand_30s' }> => r.kind === kind)
    .sort((a, b) => a.performedOn.localeCompare(b.performedOn));
  return {
    previous: own.at(-2)?.count ?? null,
    latest: own.at(-1)?.count ?? null,
  };
}

/** Wann wird die nächste Fortschritts-Runde vorgeschlagen? (Erinnerungstext ohne Gesundheitsbezug.) */
export function nextFunctionTestSuggestion(lastPerformedOn: string | null, today: string): boolean {
  if (lastPerformedOn === null) return true;
  const days =
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastPerformedOn}T00:00:00Z`)) / 86_400_000;
  return days >= L.suggestEveryDays;
}
