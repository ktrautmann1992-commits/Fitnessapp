import { ageInYears, meetsMinimumAge } from '../age';
import { NUTRITION_AGE_RULES, WEIGHT_OUTDATED_AFTER_DAYS } from '../constants';
import type { EnduranceModality, ExperienceLevel } from '../enums';
import { addDays, daysBetween } from '../dates';
import { goalEnergyDirection, hasGoal } from '../goals/profile';
import {
  type WeightGoalDayResult,
  type WeightGoalDayStatus,
  weightGoalDayAdjustment,
  weightGoalPreStatus,
} from '../goals/weight-goal';
import { hasPlannableDeficit, weightGoalCapacity } from '../goals/weight-goal-feasibility';
import type { CompetitionDiscipline } from '../plan/competition-schema';
import { latestBodyValues } from './body-data';
import {
  type CompetitionDay,
  type CompetitionDayKind,
  competitionCarbsGPerKg,
  competitionDayFor,
  type ExpectedRaceMinutesSource,
  raceDaySession,
  type RaceFuelingPlan,
  raceFuelingPlan,
} from './competition';
import { nutritionEligibility } from './eligibility';
import { dayEnergy, sessionsForDay } from './energy';
import { applyGoalAdjustment, clampCalorieTarget, dayLimitContext } from './limits';
import { nutritionMacros } from './macros';
import { stableHashKey } from './stable-hash';
import {
  type CalorieCapCode,
  type NutritionNoticeCode,
  sortNotices,
  sortWeightGoalNotices,
  type WeightGoalNoticeCode,
} from './notices';
import {
  type NutritionInputsInput,
  nutritionInputsSchema,
  type NutritionMode,
  nutritionTargetsOptionsSchema,
  type RecipeExclusion,
  weekStartSchema,
} from './schemas';
import { type MealSlot, mealSlotsForDay, type TrainingWindow, trainingWindows } from './timing';
import { type SlotMacroTarget, slotMacroTargets } from './training-meal-targets';

/**
 * Wochenziele der Ernährung (docs/PLAN-PHASE-5.md 4.10). Rechnet je Tag (Mo–So) neu – die Engine speichert nichts.
 * Ändert sich das Gewicht, ändert sich das Ziel nach derselben Formel (keine Live-Anpassung).
 * Ein 4b-Versatz (`adjustmentKcal`, ±1.000) ist Teil des Vorschlags und läuft immer durch `clampCalorieTarget`.
 */

const MINUTES_PER_DAY = 24 * 60;
/** Wochenbeginn höchstens ein Jahr vor/nach `today` (Plausibilität, Wächter N1 K5). */
const WEEK_START_MAX_DISTANCE_DAYS = 366;

export interface NutritionDaySession {
  readonly sessionId: string;
  readonly kind: 'strength' | 'endurance';
  readonly enduranceModality: EnduranceModality | null;
  readonly minutes: number;
  /** Eigene Uhrzeit (Minuten nach Mitternacht, Nährstoff-Timing T1) – fehlt ohne eigene Uhrzeit. */
  readonly startMinutes?: number;
}

/**
 * Nährstoff-Timing 2 (docs/PLAN-NAEHRSTOFF-TIMING.md, T1): nur an Tagen, an denen eine Einheit eine EIGENE Uhrzeit hat
 * (sonst fehlt das Feld – Altbestand rechnet genau wie bisher). Zeitfenster der Einheiten und – nur mit Zielen,
 * Körpergewicht und ab 18 – die Makro-Anteile je Mahlzeit (Summe = Tageswerte, Energie unverändert).
 */
export interface NutritionDayTrainingTiming {
  readonly windows: readonly TrainingWindow[];
  /** null: ohne Ziele (`no_targets`), ohne Körpergewicht oder unter 18 – dann keine Gramm je Mahlzeit. */
  readonly mealTargets: readonly SlotMacroTarget[] | null;
}

/**
 * Wettkampf-Bezug eines Tages (Etappe W1, docs/PLAN-PHASE-10.md Abschnitt 10). Nur an Tagen rund um einen Wettkampf
 * gesetzt (sonst fehlt das Feld – ohne Wettkampf ist die Ausgabe genau wie vorher).
 */
export interface NutritionCompetitionDay {
  /** `normal` nur an Tagen der Wettkampfwoche ohne eigene Rolle (dann `noDeficit`). */
  readonly kind: CompetitionDayKind;
  readonly competitionId: string;
  readonly discipline: CompetitionDiscipline;
  readonly raceDate: string;
  readonly expectedMinutes: number;
  readonly minutesSource: ExpectedRaceMinutesSource;
  /** Carb-Loading-Tag laut Regel (≥ 90 min, 1–2 Tage vor dem Renntag). */
  readonly carbLoading: boolean;
  /** Die Makros wurden zu mehr Kohlenhydraten verschoben (nicht im Modus `no_targets`, nicht unter 18). */
  readonly carbsShifted: boolean;
  /** Carb-Loading-Richtwert (8 g/kg) erreicht? null ohne Verschiebung. */
  readonly carbLoadingReached: boolean | null;
  /** Ohne Defizit geplant (Wettkampfwoche, Plan 10 1.6 Nr. 2); ein Abnehmziel ruht. */
  readonly noDeficit: boolean;
  /** Renntag: geschätzte Renn-Energie ist im Tagesbedarf (heute/künftig, kein Ergebnis-Eintrag vorhanden). */
  readonly raceEnergyIncluded: boolean;
  /** Ein aktives Abnehmziel ruht an diesem Tag wegen des Wettkampfs (läuft danach von selbst weiter, N4). */
  readonly weightGoalPaused?: true;
  /**
   * Nur am Renntag: Gel-/Trinkplan (feste Bausteine). Ohne Ziele (`no_targets`) und unter 18 nur allgemein; Gramm fürs
   * Frühstück nur mit Körpergewicht (Einwilligung). Die App zeigt Gramm nur mit „Kalorienzahlen anzeigen“.
   */
  readonly fueling?: RaceFuelingPlan;
}

export interface NutritionDayTargets {
  readonly date: string;
  readonly mode: NutritionMode;
  readonly ageYears: number;
  /** Grundumsatz für die Grenzen (max(Mifflin, Katch)), gerundet; null bei `no_targets`. */
  readonly bmrKcal: number | null;
  /** Gesamtumsatz für die Grenzen (TagesbedarfGrenze), gerundet; null bei `no_targets`. */
  readonly tdeeKcal: number | null;
  /** Trainingsenergie netto (gedeckelt), gerundet; null bei `no_targets`. */
  readonly trainingKcal: number | null;
  readonly sessions: readonly NutritionDaySession[];
  /** Gerichtet gerundetes Tagesziel; null bei `no_targets`. */
  readonly targetKcal: number | null;
  /** Planband (nur intern, ungerundet). */
  readonly band: { readonly min: number; readonly max: number } | null;
  readonly floorKcal: number | null;
  readonly ceilingKcal: number | null;
  readonly proteinG: number | null;
  readonly carbsG: number | null;
  readonly fatG: number | null;
  readonly appliedCaps: readonly CalorieCapCode[];
  readonly slots: readonly MealSlot[];
  readonly notices: readonly NutritionNoticeCode[];
  readonly recipeExclusions: readonly RecipeExclusion[];
  /**
   * Deckel aus den Sonderfällen (4.9) – nur zum Abgleich bei der automatischen Neuplanung (6.6: „Modus oder Deckel
   * geändert“). Die Grenzen selbst gelten ausschließlich in `clampCalorieTarget`.
   */
  readonly deficitCap: number;
  readonly surplusCap: number;
  /**
   * Energie-Anpassung des Tages als Anteil des Grundbedarfs ohne Training (Standard des Ziel-Profils bzw. mit
   * konkretem Abnehmziel kleiner, docs/PLAN-ZIELE.md 2.4); null bei `no_targets`.
   */
  readonly goalAdjustment: number | null;
  /** Stand des konkreten Abnehmziels an diesem Tag; null ohne Ziel bzw. ohne Einwilligung. */
  readonly weightGoalStatus: WeightGoalDayStatus | null;
  /** Das Ziel wird an diesem Tag langsamer geplant als benötigt (Standard-Tempo oder eine Schutzgrenze bremst). */
  readonly weightGoalPaceCapped: boolean;
  /**
   * Kennung des gespeicherten Ziels (Hash aus Start, Zieldatum, Zielgewicht und Eingabeart, nie im Klartext) – nur an
   * Tagen mit Ziel-Stand. Für den Abgleich des Essensplans (Etappe Z5, Wächter H1): Neuplanung, wenn sich Ziel oder
   * Stand ändern, aber nicht bei jeder neuen Gewichtsangabe (die läuft weiter über das Planband).
   */
  readonly weightGoalKey?: string;
  /** Wettkampf-Bezug (Etappe W1); fehlt an Tagen ohne Wettkampf-Bezug. */
  readonly competition?: NutritionCompetitionDay;
  /** Nährstoff-Timing (T1): nur an Tagen mit eigener Uhrzeit einer Einheit. */
  readonly trainingTiming?: NutritionDayTrainingTiming;
}

export interface NutritionWeekTargets {
  readonly weekStart: string;
  readonly days: readonly NutritionDayTargets[];
  /** true, sobald Körperdaten oder Flags (oder ein Check) eingeflossen sind (7.1). */
  readonly usesHealthData: boolean;
  /**
   * Hinweise zum Abnehmziel – einmal je Woche, nur für die Ernährungs-Übersicht (Wächter K10: `weight_goal_pace_capped`
   * höchstens einmal pro Woche, kein täglicher Hinweis auf „Heute“).
   */
  readonly weightGoalNotices: readonly WeightGoalNoticeCode[];
}

const EPS = 1e-9;
/** Unter 18 (wie `nutritionEligibility`): Gel-/Trinkplan nur allgemein (Plan 10 Abschnitt 10). */
const MINOR_BELOW_AGE = NUTRITION_AGE_RULES.minorBelowAge;

const WEIGHT_GOAL_STATUS_NOTICE: Partial<Record<WeightGoalDayStatus, WeightGoalNoticeCode>> = {
  invalid: 'weight_goal_invalid',
  no_deficit: 'weight_goal_no_deficit',
  reached: 'weight_goal_reached',
  date_passed: 'weight_goal_date_passed',
};

/** Ziele für die ISO-Woche ab `weekStart` (Montag). */
export function nutritionTargetsForWeek(
  rawInputs: NutritionInputsInput,
  weekStart: string,
  options?: { readonly adjustmentKcal?: number },
): NutritionWeekTargets {
  const inputs = nutritionInputsSchema.parse(rawInputs);
  if (!meetsMinimumAge(inputs.birthDate, inputs.today)) {
    throw new RangeError('Die Ernährungs-Engine ist erst ab dem Mindestalter nutzbar.');
  }
  const monday = weekStartSchema.parse(weekStart);
  if (Math.abs(daysBetween(inputs.today, monday)) > WEEK_START_MAX_DISTANCE_DAYS) {
    throw new RangeError('Die Woche liegt mehr als ein Jahr von heute entfernt.');
  }
  const { adjustmentKcal } = nutritionTargetsOptionsSchema.parse(options ?? {});
  const body = inputs.healthDataConsent
    ? latestBodyValues(inputs.bodyMetricsRows, inputs.today)
    : { height: null, weight: null, bodyFat: null };
  const flags = inputs.healthDataConsent ? (inputs.healthFlags?.flags ?? null) : null;
  // Ziel-Profil (docs/PLAN-ZIELE.md 4.4): Haupt- und optionales Nebenziel.
  const goals = { primary: inputs.goalType, secondary: inputs.secondaryGoalType };
  // Konkretes Abnehmziel (docs/PLAN-ZIELE.md 2.4) nur mit Einwilligung und Körperdaten. Die Kapazität (Wächter K-d)
  // hängt innerhalb der Woche nur am Alter des Tages – sie wird je Alter einmal gerechnet.
  const weightGoal =
    inputs.healthDataConsent && body.height !== null && body.weight !== null
      ? inputs.weightGoal
      : null;
  const noDeficitByAge = new Map<number, boolean>();
  const noDeficit = (date: string, ageYears: number) => {
    if (weightGoal === null) return false;
    let value = noDeficitByAge.get(ageYears);
    if (value === undefined) {
      value = !hasPlannableDeficit(weightGoalCapacity(inputs, weightGoal, { ageOn: date }).kcal);
      noDeficitByAge.set(ageYears, value);
    }
    return value;
  };
  const weightGoalNotices = new Set<WeightGoalNoticeCode>();
  const goalKey =
    weightGoal === null
      ? null
      : String(
          stableHashKey(
            'weight_goal',
            weightGoal.startDate,
            weightGoal.targetDate,
            weightGoal.targetWeightKg,
            weightGoal.amountMode,
            weightGoal.timeMode,
          ),
        );

  const days: NutritionDayTargets[] = [];
  let usesHealthData = false;
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(monday, i);
    const ageYears = date < inputs.birthDate ? 0 : ageInYears(inputs.birthDate, date);
    const bodyForDay =
      body.height !== null && body.weight !== null
        ? { weightKg: body.weight.value, heightCm: body.height.value }
        : null;
    const eligibility = nutritionEligibility({
      ageYears,
      sex: inputs.sex,
      goalType: inputs.goalType,
      secondaryGoalType: inputs.secondaryGoalType,
      healthDataConsent: inputs.healthDataConsent,
      body: bodyForDay,
      healthFlags: flags,
    });
    usesHealthData ||= eligibility.usesHealthData;
    const counted = sessionsForDay(inputs.sessions, date, inputs.today);
    const timing = mealSlotsForDay({
      mealsPerDay: inputs.mealsPerDay,
      trainingTime: inputs.trainingTime,
      sessions: counted,
    });
    const sessions = counted.map((s) => ({
      sessionId: s.sessionId,
      kind: s.kind,
      enduranceModality: s.enduranceModality,
      minutes: s.minutes,
      ...(s.startMinutes !== null && s.startMinutes !== undefined
        ? { startMinutes: s.startMinutes }
        : {}),
    }));
    // Nährstoff-Timing (T1): Zeitfenster nur, wenn eine Einheit eine eigene Uhrzeit hat (sonst wie bisher).
    const explicitWindows = counted.some(
      (s) => s.startMinutes !== null && s.startMinutes !== undefined,
    )
      ? trainingWindows(counted, inputs.trainingTime)
      : null;
    // Wettkampf (Etappe W1): Art des Tages; ohne Wettkämpfe gar nicht gerechnet (Ausgabe wie vorher).
    const competitionDay =
      inputs.competitions.length === 0
        ? null
        : competitionDayFor(inputs.competitions, date, inputs.experienceLevel);
    const competition =
      competitionDay !== null &&
      competitionDay.competition !== null &&
      (competitionDay.kind !== 'normal' || competitionDay.noDeficit)
        ? competitionDay
        : null;

    if (eligibility.mode === 'no_targets' || bodyForDay === null) {
      const pre =
        weightGoal === null
          ? null
          : weightGoalPreStatus({
              goal: weightGoal,
              date,
              birthDate: inputs.birthDate,
              losesWeight: hasGoal(goals, 'fat_loss'),
              heightCm: body.height?.value ?? null,
              mode: 'no_targets',
            });
      const noTargetsStatus = pre === 'ok' ? 'paused' : pre;
      if (noTargetsStatus === 'invalid') weightGoalNotices.add('weight_goal_invalid');
      days.push({
        date,
        mode: 'no_targets',
        ageYears,
        bmrKcal: null,
        tdeeKcal: null,
        trainingKcal: null,
        sessions,
        targetKcal: null,
        band: null,
        floorKcal: null,
        ceilingKcal: null,
        proteinG: null,
        carbsG: null,
        fatG: null,
        appliedCaps: [],
        slots: timing.slots,
        notices: sortNotices([...eligibility.notices, ...timing.notices]),
        recipeExclusions: eligibility.recipeExclusions,
        deficitCap: eligibility.deficitCap,
        surplusCap: eligibility.surplusCap,
        goalAdjustment: null,
        // Schwangerschaft u. Ä.: Das Ziel ruht (Plan 2.3) – außer vor dem Start bzw. wenn es ungültig ist.
        weightGoalStatus: noTargetsStatus,
        weightGoalPaceCapped: false,
        ...(noTargetsStatus !== null && goalKey !== null ? { weightGoalKey: goalKey } : {}),
        ...(explicitWindows === null
          ? {}
          : { trainingTiming: { windows: explicitWindows, mealTargets: null } }),
        // `no_targets`: nur die Art des Tages (allgemeine Hinweise), keine Verschiebung, keine Zahlen.
        ...(competition === null
          ? {}
          : {
              competition: competitionView(competition, {
                carbsShifted: false,
                carbLoadingReached: null,
                raceEnergyIncluded: false,
                ...fuelingFor(competition, inputs.experienceLevel, {
                  generalOnly: true,
                  weightKg: null,
                }),
              }),
            }),
      });
      continue;
    }

    // Renntag (W1): Der Wettkampf ist keine geplante Einheit (Plan 10 3.5) – seine geschätzte Energie geht nur hier als
    // Eingabe in den Tagesbedarf (Deckel TRAINING_KCAL_DAY_MAX wie immer), nicht in Timing oder `sessions`.
    const race = competition === null ? null : raceDaySession(competition, inputs.today);
    const energy = dayEnergy({
      day: date,
      weightKg: bodyForDay.weightKg,
      heightCm: bodyForDay.heightCm,
      ageYears,
      sex: inputs.sex,
      bodyFat: body.bodyFat,
      activityLevel: inputs.activityLevel,
      sessions: race === null ? counted : [...counted, race],
    });
    const notices: NutritionNoticeCode[] = [...eligibility.notices, ...timing.notices];
    if (
      body.weight !== null &&
      daysBetween(body.weight.measuredOn, date) > WEIGHT_OUTDATED_AFTER_DAYS
    ) {
      notices.push('weight_outdated');
    }
    if (inputs.activityLevel === null) notices.push('activity_level_default');
    if (energy.training.capped) notices.push('training_energy_capped');

    const mode = eligibility.mode;
    const standardAdjustment = applyGoalAdjustment(goals, inputs.experienceLevel, mode);
    // Konkretes Abnehmziel (F5): kann die Anpassung nur Richtung 0 verschieben, nie darüber hinaus.
    const rawGoalDay: WeightGoalDayResult | null =
      weightGoal === null
        ? null
        : weightGoalDayAdjustment({
            goal: weightGoal,
            date,
            today: inputs.today,
            birthDate: inputs.birthDate,
            mode,
            losesWeight: hasGoal(goals, 'fat_loss'),
            standardAdjustment,
            baseNeeds: energy.baseNeeds,
            latestWeightKg: bodyForDay.weightKg,
            latestWeightMeasuredOn: body.weight?.measuredOn ?? date,
            heightCm: bodyForDay.heightCm,
            bodyMetricsRows: inputs.bodyMetricsRows,
            noDeficit: noDeficit(date, ageYears),
          });
    // Wettkampfwoche ohne Defizit (Plan 10 1.6 Nr. 2): Ein aktives Abnehmziel ruht an diesen Tagen.
    const raceWeekNoDeficit = competition?.noDeficit === true;
    const carbsShifted = competition?.carbLoading === true && ageYears >= MINOR_BELOW_AGE;
    const weightGoalPaused = raceWeekNoDeficit && rawGoalDay?.status === 'active';
    const goalDay: WeightGoalDayResult | null = weightGoalPaused
      ? { status: 'paused', adjustment: 0, slowerThanRequired: false }
      : rawGoalDay;
    const profileAdjustment =
      goalDay === null ? standardAdjustment : Math.max(standardAdjustment, goalDay.adjustment);
    // Erhalt statt Defizit; ein Überschuss des Ziel-Profils bleibt (Grenzen gelten unverändert in clampCalorieTarget).
    const adjustment = raceWeekNoDeficit ? Math.max(profileAdjustment, 0) : profileAdjustment;
    // 4b-Versatz (19.7 W1, G1): an Carb-Loading-Tagen 0, an den übrigen Tagen ohne Defizit nie negativ.
    const dayOffsetKcal =
      competition?.carbLoading === true
        ? 0
        : raceWeekNoDeficit
          ? Math.max(adjustmentKcal, 0)
          : adjustmentKcal;
    const proposed = energy.baseNeeds * (1 + adjustment) + energy.training.netKcal + dayOffsetKcal;
    const context = dayLimitContext({
      energy,
      eligibility,
      weightKg: bodyForDay.weightKg,
      // Energie-Richtung des Ziel-Profils (Vorzeichen, Wächter S11) – nie „Muskelaufbau ist eines der Ziele“.
      goalIsSurplus: goalEnergyDirection(goals) === 'surplus',
    });
    const clamped = clampCalorieTarget(proposed, context);
    // „Langsamer als gewünscht“ (Plan 2.4 Nr. 6): Standard-Tempo bremst oder eine Schutzgrenze hebt das Ziel an.
    const paceCapped =
      goalDay?.status === 'active' &&
      (goalDay.slowerThanRequired || clamped.unroundedKcal > proposed + EPS);
    if (goalDay !== null) {
      const code = WEIGHT_GOAL_STATUS_NOTICE[goalDay.status];
      if (code !== undefined) weightGoalNotices.add(code);
      if (paceCapped) weightGoalNotices.add('weight_goal_pace_capped');
    }
    if (clamped.appliedCaps.includes('energy_availability_cap')) {
      notices.push('energy_availability_cap');
    }
    const macros = nutritionMacros({
      targetKcal: clamped.targetKcal,
      goalType: inputs.goalType,
      secondaryGoalType: inputs.secondaryGoalType,
      weightKg: bodyForDay.weightKg,
      heightCm: bodyForDay.heightCm,
      proteinMin: eligibility.proteinMin,
      proteinCap: eligibility.proteinCap,
      // Tagessumme kann über 24 h liegen (mehrere Einheiten, Datenfehler) – nie die ganze Woche abbrechen (S2).
      trainingMinutes: Math.min(energy.training.minutes, MINUTES_PER_DAY),
      // Carb-Loading (W1): mehr Kohlenhydrate nur innerhalb des Tagesziels (Fett ≥ 20 %, Eiweiß unverändert) – unter 18
      // keine Verschiebung (Wächter W1 M1, W1-G4), nur Erhalt und der allgemeine Hinweis.
      carbsTargetGPerKg:
        carbsShifted && competition !== null ? competitionCarbsGPerKg(competition) : null,
    });
    days.push({
      date,
      mode,
      ageYears,
      bmrKcal: Math.round(energy.bmrForFloor),
      tdeeKcal: Math.round(energy.limitNeeds),
      trainingKcal: Math.round(energy.training.netKcal),
      sessions,
      targetKcal: clamped.targetKcal,
      band: clamped.band,
      floorKcal: clamped.floorKcal,
      ceilingKcal: clamped.ceilingKcal,
      proteinG: macros.proteinG,
      carbsG: macros.carbsG,
      fatG: macros.fatG,
      appliedCaps: clamped.appliedCaps,
      slots: timing.slots,
      notices: sortNotices([...notices, ...macros.notices]),
      recipeExclusions: eligibility.recipeExclusions,
      deficitCap: eligibility.deficitCap,
      surplusCap: eligibility.surplusCap,
      goalAdjustment: adjustment,
      weightGoalStatus: goalDay?.status ?? null,
      weightGoalPaceCapped: paceCapped,
      ...(goalDay !== null && goalKey !== null ? { weightGoalKey: goalKey } : {}),
      ...(explicitWindows === null
        ? {}
        : {
            trainingTiming: {
              windows: explicitWindows,
              // Gramm je Mahlzeit nur ab 18 (Plan 8) – darunter nur Zeitfenster und Gerichte.
              mealTargets:
                ageYears < MINOR_BELOW_AGE
                  ? null
                  : slotMacroTargets({
                      slots: timing.slots,
                      targetKcal: clamped.targetKcal,
                      proteinG: macros.proteinG,
                      carbsG: macros.carbsG,
                      fatG: macros.fatG,
                      referenceWeightKg: macros.referenceWeightKg,
                      weightKg: bodyForDay.weightKg,
                      ageYears,
                      windows: explicitWindows,
                    }),
            },
          }),
      ...(competition === null
        ? {}
        : {
            competition: competitionView(competition, {
              carbsShifted,
              carbLoadingReached: carbsShifted ? (macros.carbsTargetReached ?? false) : null,
              ...(weightGoalPaused ? { weightGoalPaused: true } : {}),
              raceEnergyIncluded: race !== null,
              ...fuelingFor(competition, inputs.experienceLevel, {
                generalOnly: ageYears < MINOR_BELOW_AGE,
                weightKg: bodyForDay.weightKg,
              }),
            }),
          }),
    });
  }
  return {
    weekStart: monday,
    days,
    usesHealthData,
    weightGoalNotices: sortWeightGoalNotices(weightGoalNotices),
  };
}

/** Gel-/Trinkplan nur am Renntag (sonst kein Feld). */
function fuelingFor(
  day: CompetitionDay,
  level: ExperienceLevel,
  options: { readonly generalOnly: boolean; readonly weightKg: number | null },
): { fueling?: RaceFuelingPlan } {
  if (day.kind !== 'race_day' || day.competition === null) return {};
  return { fueling: raceFuelingPlan(day.competition.expectedMinutes, level, options) };
}

function competitionView(
  day: CompetitionDay,
  extra: Pick<
    NutritionCompetitionDay,
    'carbsShifted' | 'carbLoadingReached' | 'raceEnergyIncluded' | 'fueling' | 'weightGoalPaused'
  >,
): NutritionCompetitionDay {
  const c = day.competition;
  if (c === null) throw new RangeError('Wettkampf-Tag ohne Wettkampf.');
  return {
    kind: day.kind,
    competitionId: c.id,
    discipline: c.discipline,
    raceDate: c.raceDate,
    expectedMinutes: c.expectedMinutes,
    minutesSource: c.minutesSource,
    carbLoading: day.carbLoading,
    noDeficit: day.noDeficit,
    ...extra,
  };
}
