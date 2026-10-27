/**
 * Test-Hilfen der Ernährungs-Engine. Die Formeln hier sind bewusst UNABHÄNGIG von constants.ts aus dem Plan
 * abgeschrieben (docs/PLAN-PHASE-5.md 4.3–4.6), damit ein Fehler in den Konstanten auffällt.
 */
import { ageInYears } from '../age';
import type { NutritionInputsInput, NutritionSessionInput } from './schemas';

export const PLAN = {
  mifflinOffset: { male: 5, female: -161, diverse: -78, unspecified: -78 } as Record<
    string,
    number
  >,
  factor: { sedentary: 1.45, light: 1.65, active: 1.85, very_active: 2.2 } as Record<
    string,
    number
  >,
  met: {
    strength: 3.5,
    run: [6.0, 7.0],
    walk: [3.5, 4.3],
    bike: [5.5, 6.8],
    swim: [5.0, 5.8],
    // Sportarten Stufe 1 (Rudern, TRAINING_MET.endurance.row).
    row: [4.8, 8.5],
    unknown: 7.0,
  },
  trainingMax: 3000,
  kcalPerKg: 7700,
} as const;

export function mifflin(kg: number, cm: number, age: number, sex: string | null): number {
  return 10 * kg + 6.25 * cm - 5 * age + (PLAN.mifflinOffset[sex ?? 'unspecified'] ?? -78);
}

export function katch(kg: number, bodyFatPct: number): number {
  return 370 + 21.6 * kg * (1 - bodyFatPct / 100);
}

export function janmahasatian(kg: number, cm: number, sex: string | null): number {
  const bmi = kg / (cm / 100) ** 2;
  const male = (9270 * kg) / (6680 + 216 * bmi);
  const female = (9270 * kg) / (8780 + 244 * bmi);
  return sex === 'male' ? male : sex === 'female' ? female : (male + female) / 2;
}

export function sessionMet(s: {
  kind: 'strength' | 'endurance';
  enduranceModality?: 'run' | 'walk' | 'bike' | 'swim' | 'row' | null;
  effortTarget?: number | null;
}): number {
  if (s.kind === 'strength') return PLAN.met.strength;
  if (!s.enduranceModality) return PLAN.met.unknown;
  const [low, high] = PLAN.met[s.enduranceModality];
  return s.effortTarget != null && s.effortTarget <= 2 ? low : high;
}

let counter = 0;
/** Geplante Einheit des aktiven Plans. */
export function session(
  scheduledOn: string,
  overrides: Partial<NutritionSessionInput> = {},
): NutritionSessionInput {
  counter += 1;
  return {
    sessionId: `s${counter}`,
    planId: 'plan-active',
    planStatus: 'active',
    scheduledOn,
    kind: 'strength',
    enduranceModality: null,
    effortTarget: null,
    minutes: 60,
    isDeload: false,
    status: 'planned',
    ...overrides,
  };
}

export function run(scheduledOn: string, minutes: number, effortTarget = 3): NutritionSessionInput {
  return session(scheduledOn, {
    kind: 'endurance',
    enduranceModality: 'run',
    effortTarget,
    minutes,
  });
}

/** Montag 12.10.2026 (keine Zeitumstellung, kein Feiertag-Sonderfall). */
export const MONDAY = '2026-10-12';

export function inputs(overrides: Partial<NutritionInputsInput> = {}): NutritionInputsInput {
  return {
    today: MONDAY,
    birthDate: '1990-01-01',
    sex: 'male',
    goalType: 'general_fitness',
    experienceLevel: 'beginner',
    healthDataConsent: true,
    bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 180, weightKg: 80 }],
    healthFlags: { flags: [] },
    activityLevel: 'sedentary',
    sessions: [],
    ...overrides,
  };
}

/** Deterministischer Zufall (mulberry32) für Eigenschaftstests – kein Math.random. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface IndependentLimits {
  /** Nie unter Grundumsatz, höchstens 25 % unter Gesamtumsatz (CLAUDE.md). */
  readonly lower: number;
  /** Gesamtumsatz + höchstens 10 % (unter 18: 5 %) Überschuss + 20 kcal Mindestbreite/Rundung. */
  readonly upper: number;
}

/**
 * Kalorien-Grenzen UNABHÄNGIG von der Engine (Wächter N13 S5): Mifflin-St-Jeor und Aktivitätsfaktor aus den
 * Test-Hilfen (aus dem Plan abgeschrieben). Nur für Eingaben OHNE Einheiten und ohne Körperfett (eine Messung);
 * die Engine-Grenzen dürfen nur enger sein.
 */
export function independentLimits(
  o: Partial<NutritionInputsInput>,
  date: string,
): IndependentLimits | null {
  const i = inputs(o);
  const row = i.bodyMetricsRows?.[0];
  const flags = i.healthFlags?.flags ?? [];
  if (!i.healthDataConsent || flags.includes('pregnancy') || row === undefined) return null;
  const age = ageInYears(i.birthDate, date);
  const bmr = mifflin(
    row.weightKg as number,
    row.heightCm as number,
    age,
    i.sex === 'female' ? 'female' : 'male',
  );
  const tdee = bmr * (PLAN.factor[i.activityLevel ?? 'sedentary'] as number);
  const surplus = age < 18 ? 0.05 : 0.1;
  return { lower: Math.max(bmr, 0.75 * tdee) - 1e-6, upper: tdee * (1 + surplus) + 20 };
}
