import { COMPETITION_INTENSITY, COMPETITION_WORKOUTS } from '../constants';
import { isoWeekday } from '../dates';
import type { ExperienceLevel } from '../enums';
import { talkTestLevel } from '../log/cardio';
import type { CompetitionDiscipline, CompetitionPhase } from './competition-schema';
import type { EnduranceVariant } from './endurance';
import {
  distanceHint,
  type HardWorkoutLimits,
  hardSeconds,
  type PaceProfile,
  paceTargets,
  weeklyHardBudgetSeconds,
  type WorkoutStep,
  type WorkoutType,
} from './intensity';

/**
 * Einheiten-Bausteine des Wettkampfplans (docs/PLAN-PHASE-10.md Abschnitte 3.4/3.5 und 6, Etappe WP2; W-G8): feste
 * deutsche Textbausteine im Core (keine KI), Schritte für den Timer (WP4) und die Verteilung der Arten in einer Woche
 * (`weekWorkouts`) nach Phase, Level, Sicherheitsregeln, 80/20 und Wochenbau-Regeln. Gilt nur für Laufen (W-G2).
 */

/** Feste Textbausteine (ca. 20, W-G8) – PRODUKTENTSCHEIDUNG, fachliche Prüfung vor Veröffentlichung. */
export const WORKOUT_TEXTS_DE = {
  names: {
    easy: 'Lockerer Dauerlauf',
    recovery: 'Erholungslauf',
    long: 'Langer Lauf',
    strides: 'Lockerer Lauf mit Steigerungen',
    fartlek: 'Fahrtspiel',
    tempo: 'Tempodauerlauf',
    intervals: 'Intervalle',
    race_pace: 'Renntempo-Abschnitte',
  },
  warmupEasy: '5 Minuten zügig gehen oder sehr locker traben.',
  warmupHard: '10 Minuten locker einlaufen, dann 2–3 lockere Steigerungen.',
  cooldownEasy: '5 Minuten locker auslaufen bzw. gehen, leicht dehnen.',
  cooldownHard: '5 Minuten locker auslaufen, dann gehen.',
  main: {
    easy: 'Gleichmäßig locker laufen.',
    recovery: 'Ganz locker laufen – lieber zu langsam als zu schnell.',
    long: 'Gleichmäßig locker laufen, Trinken mitnehmen; die zweite Hälfte nicht schneller.',
    strides: (count: number) =>
      `Locker laufen, am Ende ${count} × 20 Sekunden zügig steigern, dazwischen 1 Minute locker traben.`,
    fartlek: (reps: number) => `${reps} × 1 Minute zügig, dazwischen je 2 Minuten locker.`,
    tempo: (minutes: number, parts: number) =>
      parts > 1
        ? `${parts} × ${minutes / parts} Minuten zügig an der Schwelle, dazwischen 2 Minuten locker traben.`
        : `${minutes} Minuten zügig am Stück an der Schwelle.`,
    intervals: (reps: number) =>
      `${reps} × 3 Minuten schnell, dazwischen je 2 Minuten locker traben. Nie „alles geben“.`,
    race_pace: (reps: number, minutes: number) =>
      `${reps} × ${minutes} Minuten im geplanten Renntempo, dazwischen je 2 Minuten locker.`,
  },
  talkTest: {
    full_sentences: 'Du kannst dich noch in ganzen Sätzen unterhalten.',
    short_sentences: 'Du kannst nur noch kurze Sätze sprechen.',
    few_words: 'Du kannst nur noch einzelne Wörter sprechen.',
    no_talking: 'Sprechen ist kaum möglich – so hart planen wir nie.',
    rest: 'Ruhe.',
  },
  alternative: 'Ausweichen: Laufband (1 % Steigung) mit derselben Anstrengung.',
  safety: 'Bei Schmerzen, Schwindel oder Unwohlsein sofort abbrechen.',
} as const;

/** Sprechtest-Text zur Anstrengung (TALK_TEST_BANDS, log/cardio.ts). */
export function talkTestText(effort: number): string {
  const level = talkTestLevel(effort);
  const texts: Readonly<Record<string, string>> = WORKOUT_TEXTS_DE.talkTest;
  return `Anstrengung ${effort} von 10: ${texts[level] ?? WORKOUT_TEXTS_DE.talkTest.rest}`;
}

/** Eine fertige Einheit des Wettkampfplans. */
export interface EnduranceWorkout {
  readonly type: WorkoutType;
  readonly name_de: string;
  readonly warmup_de: string;
  readonly main_de: string;
  readonly cooldown_de: string;
  readonly steps: readonly WorkoutStep[];
  /** Höchste Anstrengung der harten Abschnitte, sonst Anstrengung des lockeren Teils. */
  readonly effort_target: number;
}

export interface WorkoutOptions {
  /** Anstrengung des lockeren Teils (enduranceEffort: 3–4). */
  readonly easyEffort: number;
  readonly limits: HardWorkoutLimits;
  readonly level: ExperienceLevel;
  readonly discipline: CompetitionDiscipline;
  /** 80/20-Budget, das diese Einheit noch nutzen darf (Sekunden, nach der Zählweise von `limits.countWorkOnly`). */
  readonly hardBudgetS: number;
}

const W = COMPETITION_WORKOUTS;
const I = COMPETITION_INTENSITY;
const step = (
  part: WorkoutStep['part'],
  kind: WorkoutStep['kind'],
  seconds: number,
  effort: number,
): WorkoutStep => ({ part, kind, seconds, effort });

function easySteps(minutes: number, effort: number): WorkoutStep[] {
  if (minutes < W.easyWarmupFromMinutes) return [step('main', 'easy', minutes * 60, effort)];
  const wc = W.easyWarmupMinutes * 60;
  const warmEffort = Math.min(2, effort);
  return [
    step('warmup', 'easy', wc, warmEffort),
    step('main', 'easy', minutes * 60 - 2 * wc, effort),
    step('cooldown', 'easy', wc, warmEffort),
  ];
}

/** Lockere Art (easy, recovery, long) – immer möglich. */
export function easyWorkout(
  type: 'easy' | 'recovery' | 'long',
  minutes: number,
  easyEffort: number,
): EnduranceWorkout {
  const effort = type === 'recovery' ? Math.min(I.effort.recovery, easyEffort) : easyEffort;
  return {
    type,
    name_de: WORKOUT_TEXTS_DE.names[type],
    warmup_de: WORKOUT_TEXTS_DE.warmupEasy,
    main_de: WORKOUT_TEXTS_DE.main[type],
    cooldown_de: WORKOUT_TEXTS_DE.cooldownEasy,
    steps: easySteps(minutes, effort),
    effort_target: effort,
  };
}

/** Wiederholungen r so, dass Haupt-Block (r × work + (r − 1) × rest) in `mainS` und ins Budget passt. */
function fitReps(
  mainS: number,
  workS: number,
  restS: number,
  budgetS: number,
  workOnly: boolean,
  maxReps: number,
): number {
  let r = Math.min(maxReps, Math.floor((mainS + restS) / (workS + restS)));
  const counted = (n: number) => (workOnly ? n * workS : n * workS + (n - 1) * restS);
  while (r > 0 && counted(r) > budgetS) r -= 1;
  return r;
}

/**
 * Harte Einheit bzw. Steigerungen mit `minutes` Gesamtdauer (Aufwärmen + Hauptteil + Abwärmen = `minutes`). null =
 * passt nicht (zu kurz, Budget zu klein, harte Einheiten nicht erlaubt) → der Aufrufer plant locker.
 */
export function structuredWorkout(
  type: 'strides' | 'fartlek' | 'tempo' | 'intervals' | 'race_pace',
  minutes: number,
  options: WorkoutOptions,
): EnduranceWorkout | null {
  const { limits, easyEffort } = options;
  if (!limits.allowed || limits.effortCap < I.hardEffortMin) return null;
  if (minutes < W.hardMinMinutes) return null;
  const workOnly = limits.countWorkOnly;
  const budget = Math.max(0, options.hardBudgetS);
  const capped = (e: number) => Math.min(e, limits.effortCap);
  if (type === 'strides') {
    const S = W.strides;
    let count = S.count;
    const counted = (n: number) => (workOnly ? n * S.workS : n * S.workS + (n - 1) * S.restS);
    while (count >= S.minCount && counted(count) > budget) count -= 1;
    if (count < S.minCount) return null;
    const block = count * (S.workS + S.restS);
    const base = easySteps(minutes, easyEffort);
    const main = base.find((s) => s.part === 'main');
    if (!main || main.seconds - block < 5 * 60) return null;
    const steps: WorkoutStep[] = [];
    for (const s of base) {
      if (s.part !== 'main') {
        steps.push(s);
        continue;
      }
      steps.push(step('main', 'easy', s.seconds - block, easyEffort));
      for (let k = 0; k < count; k += 1) {
        steps.push(step('main', 'work', S.workS, capped(I.effort.strides)));
        steps.push(step('main', 'rest', S.restS, easyEffort));
      }
    }
    return {
      type,
      name_de: WORKOUT_TEXTS_DE.names.strides,
      warmup_de: WORKOUT_TEXTS_DE.warmupEasy,
      main_de: WORKOUT_TEXTS_DE.main.strides(count),
      cooldown_de: WORKOUT_TEXTS_DE.cooldownEasy,
      steps,
      effort_target: easyEffort,
    };
  }
  const warmS = W.hardWarmupMinutes * 60;
  const coolS = W.hardCooldownMinutes * 60;
  const mainS = minutes * 60 - warmS - coolS;
  const block: WorkoutStep[] = [];
  let mainText: string;
  if (type === 'tempo') {
    const T = W.tempo;
    const split = options.level === 'beginner';
    const rest = split ? T.beginnerRestS : 0;
    let work = Math.min(T.maxMinutes[options.level] * 60, mainS - rest);
    work = Math.floor(work / 60) * 60;
    if (!workOnly) work = Math.min(work, Math.floor((budget - rest) / 60) * 60);
    else work = Math.min(work, Math.floor(budget / 60) * 60);
    if (split) work = Math.floor(work / 120) * 120;
    if (work < T.minMinutes * 60) return null;
    const effort = capped(I.effort.tempo);
    block.push(
      ...(split
        ? [
            step('main', 'work', work / 2, effort),
            step('main', 'rest', rest, easyEffort),
            step('main', 'work', work / 2, effort),
          ]
        : [step('main', 'work', work, effort)]),
    );
    mainText = WORKOUT_TEXTS_DE.main.tempo(work / 60, split ? 2 : 1);
  } else {
    const spec =
      type === 'fartlek'
        ? { ...W.fartlek, effort: I.effort.fartlek }
        : type === 'intervals'
          ? { ...W.intervals, effort: I.effort.intervals }
          : {
              workS: W.racePace.workS[options.discipline],
              restS: W.racePace.restS,
              minReps: W.racePace.minReps,
              maxReps: W.racePace.maxReps,
              effort: I.effort.racePace[options.discipline],
            };
    const reps = fitReps(mainS, spec.workS, spec.restS, budget, workOnly, spec.maxReps);
    if (reps < spec.minReps) return null;
    const effort = capped(spec.effort);
    if (effort < I.hardEffortMin) return null;
    for (let k = 0; k < reps; k += 1) {
      if (k > 0) block.push(step('main', 'rest', spec.restS, easyEffort));
      block.push(step('main', 'work', spec.workS, effort));
    }
    mainText =
      type === 'fartlek'
        ? WORKOUT_TEXTS_DE.main.fartlek(reps)
        : type === 'intervals'
          ? WORKOUT_TEXTS_DE.main.intervals(reps)
          : WORKOUT_TEXTS_DE.main.race_pace(reps, spec.workS / 60);
  }
  const used = block.reduce((sum, s) => sum + s.seconds, 0);
  const filler = mainS - used;
  if (filler < 0) return null;
  const steps: WorkoutStep[] = [
    step('warmup', 'easy', warmS, easyEffort),
    ...(filler >= 10 ? [step('main', 'easy', filler, easyEffort)] : []),
    ...block,
    step('cooldown', 'easy', coolS + (filler > 0 && filler < 10 ? filler : 0), easyEffort),
  ];
  return {
    type,
    name_de: WORKOUT_TEXTS_DE.names[type],
    warmup_de: WORKOUT_TEXTS_DE.warmupHard,
    main_de: mainText,
    cooldown_de: WORKOUT_TEXTS_DE.cooldownHard,
    steps,
    effort_target: Math.max(...block.filter((s) => s.kind === 'work').map((s) => s.effort)),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Wochenbau (Plan 3.5)
// ---------------------------------------------------------------------------------------------------------

/** Eine geplante Ausdauer-Einheit der Woche (Minuten > 0). */
export interface WeekEnduranceDay {
  readonly date: string;
  readonly minutes: number;
  readonly variant: EnduranceVariant;
}

export interface WeekWorkoutInput {
  readonly phase: CompetitionPhase;
  /** Erholungswoche im Training (nicht Tapering): keine harten Einheiten. */
  readonly recoveryWeek: boolean;
  readonly level: ExperienceLevel;
  readonly limits: HardWorkoutLimits;
  readonly discipline: CompetitionDiscipline;
  readonly easyEffort: number;
  readonly days: readonly WeekEnduranceDay[];
  /** Tag des langen Laufs (null = keiner in dieser Woche). */
  readonly longRunDate: string | null;
  /** Tage, an denen keine harte Einheit liegen darf (neben Kraft mit Beinen, neben harten/langen Einheiten davor). */
  readonly blockedDates: ReadonlySet<string>;
  readonly pace: PaceProfile | null;
}

export interface PlannedWorkout extends EnduranceWorkout {
  readonly date: string;
  readonly minutes: number;
  readonly target_distance_m: number | null;
}

/** Harte Arten je Phase und Level, in Reihenfolge der Vergabe (Plan 3.1/3.4). */
export function hardTypesFor(
  phase: CompetitionPhase,
  level: ExperienceLevel,
): readonly ('fartlek' | 'tempo' | 'intervals' | 'race_pace')[] {
  const beginner = level === 'beginner';
  if (phase === 'build') return beginner ? ['fartlek'] : ['tempo', 'intervals'];
  if (phase === 'peak') return beginner ? ['tempo'] : ['race_pace', 'intervals'];
  if (phase === 'taper') return beginner ? ['fartlek'] : ['race_pace'];
  return [];
}

/** Nachbartage in der Woche als Kreis (So ↔ Mo), damit auch die Wochengrenze bei gleichem Muster passt. */
function weekdayNeighbours(a: string, b: string): boolean {
  const d = Math.abs(isoWeekday(a) - isoWeekday(b));
  return d === 1 || d === 6;
}

/**
 * Arten einer Woche verteilen (Plan 3.4/3.5, 80/20):
 * - langer Lauf am Tag `longRunDate`, wenn er die längste Einheit ist (Basis, Aufbau, Spitze, Tapering),
 * - harte Einheiten nur in Aufbau, Spitze und Tapering (Tapering höchstens 1, „Intensität bleibt“), nie in einer
 *   Erholungswoche, der Rennwoche oder der Erholung nach dem Rennen; höchstens `limits.perWeek`; Einsteiger erst ab 3
 *   Ausdauer-Einheiten; immer mindestens eine lockere Einheit neben dem langen Lauf (bei ≥ 3 Einheiten),
 * - nie zwei harte Tage hintereinander, nie direkt vor oder nach dem langen Lauf, nie neben Kraft mit Beinen
 *   (`blockedDates`), nur im Lauf-Variante (nicht im Geh-Lauf-Wechsel oder beim Gehen),
 * - 80/20: harte Minuten ≤ floor(20 % der Wochenminuten); passt keine Struktur ins Budget → locker,
 * - Steigerungen in der Basis für Fortgeschrittene/Leistungssport (zählen mit ins 80/20-Budget),
 * - Erholung nach dem Rennen: Erholungsläufe.
 */
export function weekWorkouts(input: WeekWorkoutInput): PlannedWorkout[] {
  const { days, phase, limits } = input;
  const total = days.reduce((sum, d) => sum + d.minutes, 0);
  let budget = weeklyHardBudgetSeconds(total);
  const longest = Math.max(0, ...days.map((d) => d.minutes));
  const longPhase = phase === 'base' || phase === 'build' || phase === 'peak' || phase === 'taper';
  const longDate =
    longPhase &&
    input.longRunDate !== null &&
    days.some((d) => d.date === input.longRunDate && d.minutes >= longest)
      ? input.longRunDate
      : null;
  const types = new Map<string, EnduranceWorkout>();
  const options = (budgetS: number): WorkoutOptions => ({
    easyEffort: input.easyEffort,
    limits,
    level: input.level,
    discipline: input.discipline,
    hardBudgetS: budgetS,
  });
  const runnable = (d: WeekEnduranceDay) => d.variant === 'easy_run';
  const hardTypes = input.recoveryWeek ? [] : hardTypesFor(phase, input.level);
  const n = days.length;
  const minSessions = input.level === 'beginner' ? I.beginnerMinEnduranceSessions : 2;
  let hardCount = 0;
  if (limits.allowed && hardTypes.length > 0 && n >= minSessions) {
    hardCount = Math.min(
      limits.perWeek,
      phase === 'taper' ? 1 : hardTypes.length,
      n - (longDate ? 1 : 0) - (n >= 3 ? 1 : 0),
    );
  }
  const chosen: string[] = [];
  if (hardCount > 0) {
    const candidates = days
      .filter(
        (d) =>
          runnable(d) &&
          d.date !== longDate &&
          d.minutes >= W.hardMinMinutes &&
          !input.blockedDates.has(d.date) &&
          !(longDate && weekdayNeighbours(d.date, longDate)),
      )
      .sort((a, b) => b.minutes - a.minutes || (a.date < b.date ? -1 : 1));
    for (const d of candidates) {
      if (chosen.length >= hardCount) break;
      if (chosen.some((c) => weekdayNeighbours(c, d.date))) continue;
      const type = hardTypes[chosen.length] ?? hardTypes[0];
      if (!type) break;
      const workout =
        structuredWorkout(type, d.minutes, options(budget)) ??
        (type === 'fartlek' ? null : structuredWorkout('fartlek', d.minutes, options(budget)));
      if (!workout) continue;
      budget -= hardSeconds(workout.steps, limits.countWorkOnly);
      types.set(d.date, workout);
      chosen.push(d.date);
    }
  }
  if (phase === 'base' && input.level !== 'beginner' && limits.allowed && n >= 3) {
    const easyDay = days
      .filter((d) => runnable(d) && d.date !== longDate && !types.has(d.date))
      .sort((a, b) => b.minutes - a.minutes || (a.date < b.date ? -1 : 1))[0];
    const strides = easyDay ? structuredWorkout('strides', easyDay.minutes, options(budget)) : null;
    // Steigerungen zählen ins 80/20-Budget (oben `options(budget)`); danach wird nichts Hartes mehr vergeben.
    if (easyDay && strides) types.set(easyDay.date, strides);
  }
  return days.map((d) => {
    const workout =
      types.get(d.date) ??
      easyWorkout(
        d.date === longDate ? 'long' : phase === 'recovery' ? 'recovery' : 'easy',
        d.minutes,
        input.easyEffort,
      );
    const pace = paceTargets(input.pace, workout.type);
    const continuous =
      workout.type === 'easy' || workout.type === 'recovery' || workout.type === 'long';
    return {
      ...workout,
      date: d.date,
      minutes: d.minutes,
      target_distance_m: continuous && runnable(d) ? distanceHint(d.minutes, pace) : null,
    };
  });
}
