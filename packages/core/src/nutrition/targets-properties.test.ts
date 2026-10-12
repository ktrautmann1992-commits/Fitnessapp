/**
 * Eigenschaftstests der Schutzgrenzen (docs/PLAN-PHASE-5.md 12.1, W17, W27; Wächter N1, S3) mit UNABHÄNGIGEN
 * Erwartungen: Körperdaten je Feld, Grundumsatz, Gesamtumsatz, Trainingsenergie, Modus, Defizitdeckel und Obergrenze
 * werden hier aus den EINGABEN und den Formeln des Plans (test-helpers.ts) hergeleitet – nicht aus Zwischenwerten der
 * Engine (kein `day.mode`, kein `day.floorKcal`/`day.ceilingKcal` als Erwartung).
 * Geprüft: kein Eingabewert lockert eine Grenze – Ziel und Band-Untergrenze ≥ alle Untergrenzen, Ziel ≤ Obergrenze,
 * Band nicht leer, Modus wie erwartet, Makros passen zur Energie. Variiert: Gewicht 30–300 kg, Größe 100–250 cm,
 * Körperfett 3–60 % (auch Ränder, alt, in der Zukunft), Alter 16–100 (Geburtstag in der Woche), alle
 * Geschlechter/Ziele/Flags/Alltagsfaktoren, Einwilligung ja/nein, 1–3 Körperdaten-Zeilen, 0–11 Einheiten mit Status
 * planned/completed/skipped aus aktivem und ersetztem Plan, Minuten bis 1.440, `today` an jedem Wochentag (auch
 * davor/danach), 4b-Versatz −1.000 bis +1.000, Wochen mit 29.02. und Zeitumstellung.
 */
import { describe, expect, it } from 'vitest';

import { ageInYears } from '../age';
import { addDays, daysBetween } from '../dates';
import { EXPERIENCE_LEVELS, GOAL_TYPES, SEX_OPTIONS } from '../enums';
import type { HealthFlag } from '../health-screening';
import type { NutritionInputsInput, NutritionSessionInput } from './schemas';
import { nutritionTargetsForWeek } from './targets';
import {
  inputs,
  janmahasatian,
  katch,
  mifflin,
  MONDAY,
  PLAN,
  seededRandom,
  session,
  sessionMet,
} from './test-helpers';

const FLAG_SETS: (readonly HealthFlag[] | null)[] = [
  null,
  [],
  ['conservative_plan'],
  ['injury', 'conservative_plan'],
  ['medication', 'conservative_plan'],
  ['medical_clearance_recommended', 'conservative_plan'],
  ['pregnancy', 'conservative_plan'],
];
const LEVELS = ['sedentary', 'light', 'active', 'very_active', null] as const;
const MODALITIES = ['run', 'walk', 'bike', 'swim', null] as const;
const MONDAYS = [MONDAY, '2026-10-19', '2026-10-26', '2028-02-28', '2026-03-23'];
const EPS = 1e-6;

function pick<T>(rnd: () => number, values: readonly T[]): T {
  return values[Math.floor(rnd() * values.length)] as T;
}

/** Unabhängig: neuester Wert je Feld bis `today` (bei gleichem Datum gewinnt die spätere Zeile). */
function latest(
  rows: NonNullable<NutritionInputsInput['bodyMetricsRows']>,
  field: 'heightCm' | 'weightKg' | 'bodyFatPct',
  today: string,
): { v: number; d: string } | null {
  let best: { v: number; d: string } | null = null;
  for (const row of rows) {
    const value = row[field];
    if (value == null || row.measuredOn > today) continue;
    if (best === null || row.measuredOn >= best.d) best = { v: value, d: row.measuredOn };
  }
  return best;
}

/** Prüft jeden Tag einer Woche gegen unabhängig hergeleitete Grenzen; gibt die Zahl geprüfter Tage zurück. */
function checkWeek(input: NutritionInputsInput, monday: string, adjustmentKcal: number): number {
  const week = nutritionTargetsForWeek(input, monday, { adjustmentKcal });
  const consent = input.healthDataConsent;
  const rows = input.bodyMetricsRows ?? [];
  const H = consent ? latest(rows, 'heightCm', input.today) : null;
  const W = consent ? latest(rows, 'weightKg', input.today) : null;
  const BF = consent ? latest(rows, 'bodyFatPct', input.today) : null;
  const flags = consent ? (input.healthFlags?.flags ?? null) : null;
  const sex = input.sex ?? null;
  const level = input.activityLevel ?? null;
  const factor = level === null ? 1.45 : PLAN.factor[level]!;
  const goal = input.goalType;
  let checked = 0;

  for (const day of week.days) {
    const age = ageInYears(input.birthDate, day.date);
    const pregnant = flags?.includes('pregnancy') ?? false;
    if (!consent || pregnant || H === null || W === null) {
      expect(day.mode).toBe('no_targets');
      expect(day.targetKcal).toBeNull();
      expect(day.proteinG).toBeNull();
      continue;
    }
    const kg = W.v;
    const cm = H.v;
    const t = day.targetKcal!;
    // Grenzen: divers/keine Angabe mit dem männlichen Offset (S1); Vorschlag mit −78
    const mLimits = mifflin(kg, cm, age, sex === 'female' ? 'female' : 'male');
    const mNeeds = mifflin(kg, cm, age, sex);
    const bfAge = BF === null ? -1 : daysBetween(BF.d, day.date);
    const k = BF !== null && bfAge >= 0 && bfAge <= 90 ? katch(kg, BF.v) : null;
    const counted = (input.sessions ?? []).filter((s) => {
      if (s.scheduledOn !== day.date || s.status === 'skipped') return false;
      if (day.date < input.today) return s.status === 'completed';
      if (day.date === input.today) {
        return s.status === 'completed' || (s.status === 'planned' && s.planStatus === 'active');
      }
      return s.status === 'planned' && s.planStatus === 'active';
    });
    let net = 0;
    let gross = 0;
    for (const s of counted) {
      net += (sessionMet(s) - 1) * kg * (s.minutes / 60);
      gross += sessionMet(s) * kg * (s.minutes / 60);
    }
    const capped = net > PLAN.trainingMax;
    net = Math.min(net, PLAN.trainingMax);
    const bmrMax = Math.max(mLimits, k ?? -Infinity);
    const tdee = bmrMax * factor + net;
    const tdeeM = mLimits * factor + net;
    const tdeeK = k === null ? -Infinity : k * factor + net;
    const ffm = Math.max(
      janmahasatian(kg, cm, sex === 'female' ? 'female' : 'male'),
      k === null ? 0 : kg * (1 - BF!.v / 100),
    );
    const bmi = kg / (cm / 100) ** 2;
    const minor = age < 18;
    const senior = age >= 65;
    const noCheck = flags === null;
    const medical =
      flags?.includes('medication') === true ||
      flags?.includes('medical_clearance_recommended') === true;
    const deficitGoal = goal === 'fat_loss' || goal === 'definition';
    const underweight = !minor && bmi < 18.5;
    const maintenance = (noCheck && sex !== 'male') || (deficitGoal && (minor || underweight));
    expect(day.mode).toBe(maintenance ? 'maintenance_only' : 'full');

    let deficitCap = 0.25;
    if (noCheck || medical || senior) deficitCap = Math.min(deficitCap, 0.15);
    if (!minor && bmi < 20) deficitCap = Math.min(deficitCap, 0.1);
    if (minor || underweight || capped || maintenance) deficitCap = 0;
    const floors = {
      bmr: bmrMax,
      deficit: tdee * (1 - deficitCap),
      weeklyLoss: tdee - (0.01 * kg * PLAN.kcalPerKg) / 7,
      energyAvailability: Math.min(tdee, 30 * ffm + gross),
    };
    const floor = Math.max(...Object.values(floors));
    for (const lower of [t, day.band!.min]) {
      for (const value of Object.values(floors)) expect(lower).toBeGreaterThanOrEqual(value - EPS);
      // CLAUDE.md wörtlich: nie unter Grundumsatz, höchstens 25 % / ~1 %/Woche unter Gesamtumsatz – nach Mifflin
      // UND nach Katch-McArdle
      expect(lower).toBeGreaterThanOrEqual(0.75 * tdeeM - EPS);
      expect(lower).toBeGreaterThanOrEqual(0.75 * tdeeK - EPS);
      expect(lower).toBeGreaterThanOrEqual(tdeeK - (0.01 * kg * PLAN.kcalPerKg) / 7 - EPS);
    }

    // Obergrenze unabhängig (H3): Überschuss nur bei muscle_gain im vollen Modus
    const surplusCap = minor || noCheck ? 0.05 : 0.1;
    let ceiling: number;
    if (goal === 'muscle_gain' && !maintenance) {
      const base = (k ?? mNeeds) * factor;
      ceiling = Math.max(
        floor,
        base + net + Math.min(surplusCap * base, (0.005 * kg * PLAN.kcalPerKg) / 7),
      );
    } else {
      ceiling = Math.max(floor, tdee * (1 + surplusCap));
    }
    if (ceiling - floor >= 10) expect(t).toBeLessThanOrEqual(ceiling + EPS);
    else expect(t).toBe(Math.ceil(floor / 10 - 1e-9) * 10);
    // Mindestbreite des Bands 20 kcal (Plan 4.6.1, Wächter N3 S1) – unabhängig hier als Zahl.
    expect(day.band!.max).toBeLessThanOrEqual(Math.max(ceiling, t, day.band!.min + 20) + EPS);
    expect(day.band!.max - day.band!.min).toBeGreaterThanOrEqual(20 - EPS);
    expect(day.band!.min).toBeLessThanOrEqual(day.band!.max);
    expect(t % 10).toBe(0);
    // Makros: Energie verbindlich, Fett ≥ 20 %, nichts negativ
    expect(Math.abs(4 * day.proteinG! + 4 * day.carbsG! + 9 * day.fatG! - t)).toBeLessThanOrEqual(
      10,
    );
    expect(9 * day.fatG!).toBeGreaterThanOrEqual(0.2 * t - EPS);
    expect(day.carbsG!).toBeGreaterThanOrEqual(0);
    checked += 1;
  }
  return checked;
}

function corner(rnd: () => number, min: number, max: number): number {
  const r = rnd();
  if (r < 0.2) return min;
  if (r < 0.4) return max;
  return Math.round((min + rnd() * (max - min)) * 10) / 10;
}

function randomPerson(rnd: () => number, monday: string): NutritionInputsInput {
  const today = addDays(monday, Math.floor(rnd() * 9) - 1);
  const age = 16 + Math.floor(rnd() * 85);
  let birthDate = addDays(today, -Math.round(age * 365.25) - Math.floor(rnd() * 365));
  if (ageInYears(birthDate, today) < 16) birthDate = addDays(birthDate, -366);
  const rows: NonNullable<NutritionInputsInput['bodyMetricsRows']> = [];
  const rowCount = 1 + Math.floor(rnd() * 3);
  for (let r = 0; r < rowCount; r += 1) {
    const row = {
      measuredOn: addDays(today, -Math.floor(rnd() * 200) + (rnd() < 0.1 ? 3 : 0)),
      heightCm: rnd() < 0.85 ? corner(rnd, 100, 250) : null,
      weightKg: rnd() < 0.85 ? corner(rnd, 30, 300) : null,
      bodyFatPct: rnd() < 0.6 ? corner(rnd, 3, 60) : null,
    };
    if (row.heightCm === null && row.weightKg === null && row.bodyFatPct === null)
      row.weightKg = 70;
    rows.push(row);
  }
  const sessions: NutritionSessionInput[] = [];
  const count = Math.floor(rnd() * 12);
  for (let i = 0; i < count; i += 1) {
    const endurance = rnd() < 0.6;
    sessions.push(
      session(addDays(monday, Math.floor(rnd() * 7)), {
        planId: rnd() < 0.7 ? 'aktiv' : 'alt',
        planStatus: rnd() < 0.7 ? 'active' : 'replaced',
        kind: endurance ? 'endurance' : 'strength',
        enduranceModality: endurance ? pick(rnd, MODALITIES) : null,
        effortTarget: endurance ? pick(rnd, [1, 2, 3, 4, null]) : null,
        minutes: rnd() < 0.1 ? 1440 : Math.floor(rnd() * 300),
        status: pick(rnd, ['planned', 'completed', 'skipped'] as const),
      }),
    );
  }
  const flags = pick(rnd, FLAG_SETS);
  return inputs({
    today,
    birthDate,
    sex: pick(rnd, [...SEX_OPTIONS, null]),
    goalType: pick(rnd, GOAL_TYPES),
    experienceLevel: pick(rnd, EXPERIENCE_LEVELS),
    healthDataConsent: rnd() < 0.9,
    bodyMetricsRows: rows,
    healthFlags: flags === null ? null : { flags: [...flags] },
    activityLevel: pick(rnd, LEVELS),
    trainingTime: pick(rnd, ['early', 'morning', 'midday', 'afternoon', 'evening', 'varies', null]),
    mealsPerDay: 1 + Math.floor(rnd() * 8),
    sessions,
  });
}

describe('Eigenschaftstest: kein Eingabewert lockert eine Grenze (12.1, W17, W27, Wächter N1 S3)', () => {
  it('zufällige Personen (fester Seed) mit 4b-Versatz −1.000 / +1.000 / 0 / zufällig / −999,99', () => {
    const rnd = seededRandom(20261012);
    let checked = 0;
    for (let i = 0; i < 2500; i += 1) {
      const monday = pick(rnd, MONDAYS);
      const person = randomPerson(rnd, monday);
      const adjustment = pick(rnd, [-1000, 1000, 0, Math.round(rnd() * 2000 - 1000), -999.99]);
      checked += checkWeek(person, monday, adjustment);
    }
    expect(checked).toBeGreaterThan(5000);
  }, 60_000);

  it('Raster W17: Körperfett 3–60 % × Gewicht × Größe × Alter × alle Ziele × 0/7 Einheiten × ±1.000', () => {
    let checked = 0;
    for (const bodyFatPct of [3, 20, 40, 60]) {
      for (const kg of [30, 80, 300]) {
        for (const cm of [100, 175, 250]) {
          for (const age of [16, 40, 100]) {
            for (const goalType of GOAL_TYPES) {
              for (const sessions of [
                [] as NutritionSessionInput[],
                Array.from({ length: 7 }, (_, i) =>
                  session(addDays(MONDAY, i), {
                    kind: 'endurance',
                    enduranceModality: 'run',
                    effortTarget: 4,
                    minutes: 240,
                  }),
                ),
              ]) {
                for (const adjustment of [-1000, 1000]) {
                  checked += checkWeek(
                    inputs({
                      birthDate: `${2026 - age}-01-01`,
                      sex: 'female',
                      goalType,
                      bodyMetricsRows: [
                        { measuredOn: '2026-10-01', heightCm: cm, weightKg: kg, bodyFatPct },
                      ],
                      sessions,
                    }),
                    MONDAY,
                    adjustment,
                  );
                }
              }
            }
          }
        }
      }
    }
    expect(checked).toBe(4 * 3 * 3 * 3 * 5 * 2 * 2 * 7);
  }, 60_000);

  it('gezielt: BMI 18,5–20 (≤ 10 %), Untergewicht (kein Defizit), muscle_gain-Obergrenze, divers', () => {
    for (const sex of ['female', 'diverse', null] as const) {
      for (const [kg, goalType] of [
        [55, 'fat_loss'],
        [52, 'fat_loss'],
        [50, 'definition'],
        [70, 'muscle_gain'],
        [52, 'muscle_gain'],
      ] as const) {
        for (const adjustment of [-1000, 0, 1000]) {
          checkWeek(
            inputs({
              sex,
              goalType,
              bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 170, weightKg: kg }],
            }),
            MONDAY,
            adjustment,
          );
        }
      }
    }
  });
});
