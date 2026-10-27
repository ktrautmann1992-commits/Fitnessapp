import {
  COMPETITION_BIKE_WORKOUTS,
  COMPETITION_INTENSITY,
  COMPETITION_TRIATHLON,
  COMPETITION_WORKOUTS,
  HYROX_PLAN,
} from '../constants';
import { isoWeekday } from '../dates';
import type { ExperienceLevel } from '../enums';
import { talkTestLevel } from '../log/cardio';
import type { CompetitionDiscipline, CompetitionPhase } from './competition-schema';
import type { EnduranceVariant } from './endurance';
import {
  distanceHint,
  type HardWorkoutLimits,
  hardSeconds,
  isHardWorkoutType,
  type PaceProfile,
  paceTargets,
  weeklyHardBudgetSeconds,
  type WorkoutStep,
  type WorkoutType,
} from './intensity';
import { brickSplit, MULTISPORT_TEXTS_DE, type Sport, sportOfVariant } from './multisport';

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
  /** WP5: Sportart (Standard Laufen). */
  readonly sport?: Sport;
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

/**
 * Lockere Art (easy, recovery, long) – immer möglich. WP5: `sport` Rad bzw. Schwimmen mit eigenen Texten (lange
 * Ausfahrt; Schwimmen ohne „lang“), gleiche Schritte.
 */
export function easyWorkout(
  type: 'easy' | 'recovery' | 'long',
  minutes: number,
  easyEffort: number,
  sport: Sport = 'run',
): EnduranceWorkout {
  const effort = type === 'recovery' ? Math.min(I.effort.recovery, easyEffort) : easyEffort;
  if (sport === 'bike') {
    const B = MULTISPORT_TEXTS_DE.bike;
    return {
      type,
      name_de: B.names[type],
      warmup_de: B.warmupEasy,
      main_de: B.main[type],
      cooldown_de: B.cooldownEasy,
      steps: easySteps(minutes, effort),
      effort_target: effort,
    };
  }
  if (sport === 'swim') {
    const S = MULTISPORT_TEXTS_DE.swim;
    const swimType = type === 'long' ? 'easy' : type;
    return {
      type: swimType,
      name_de: S.names[swimType],
      warmup_de: S.warmup,
      main_de: S.main.easy,
      cooldown_de: S.cooldown,
      steps: easySteps(minutes, effort),
      effort_target: effort,
    };
  }
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
 * Schwimmtechnik (WP5, `technique`, locker): Ein- und Ausschwimmen wie eine lockere Einheit, Hauptteil zur Hälfte
 * Technikübungen (`work`, Anstrengung locker-unten) und lockeres Schwimmen. Unter `technique.minMinutes` null → locker.
 */
export function techniqueWorkout(minutes: number, easyEffort: number): EnduranceWorkout | null {
  const T = COMPETITION_TRIATHLON.technique;
  if (minutes < T.minMinutes) return null;
  const base = easySteps(minutes, easyEffort);
  const main = base.find((st) => st.part === 'main');
  if (!main) return null;
  const drillS = Math.floor((main.seconds * T.drillShare) / 60) * 60;
  if (drillS < 60 || main.seconds - drillS < 60) return null;
  const drillEffort = Math.min(ENDURANCE_DRILL_EFFORT, easyEffort);
  const steps: WorkoutStep[] = [];
  for (const st of base) {
    if (st.part !== 'main') {
      steps.push(st);
      continue;
    }
    steps.push(step('main', 'work', drillS, drillEffort));
    steps.push(step('main', 'easy', st.seconds - drillS, easyEffort));
  }
  const S = MULTISPORT_TEXTS_DE.swim;
  return {
    type: 'technique',
    name_de: S.names.technique,
    warmup_de: S.warmup,
    main_de: S.main.technique,
    cooldown_de: S.cooldown,
    steps,
    effort_target: easyEffort,
  };
}

/** Technikübungen locker-unten (Anstrengung 3, ENDURANCE_EFFORT.easyMin). */
const ENDURANCE_DRILL_EFFORT = 3;

/**
 * Koppeltraining Rad → Lauf (WP5, `brick`, locker) als EINE Einheit mit zwei Teilen (brickSplit): Rad mit 5 min
 * Einrollen, direkt danach Laufen (ab 15 min mit 5 min Auslaufen). Unter `brick.minMinutes` null → locker.
 */
export function brickWorkout(minutes: number, easyEffort: number): EnduranceWorkout | null {
  if (minutes < COMPETITION_TRIATHLON.brick.minMinutes) return null;
  const { bike, run } = brickSplit(minutes);
  const warm = W.easyWarmupMinutes * 60;
  const warmEffort = Math.min(2, easyEffort);
  const B = MULTISPORT_TEXTS_DE.brick;
  return {
    type: 'brick',
    name_de: B.name,
    warmup_de: B.warmup,
    main_de: B.main(bike, run),
    cooldown_de: B.cooldown,
    // Lauf-Teil ab 15 min mit 5 min Auslaufen, sonst ganz als Hauptteil (Summe = Dauer).
    steps: [
      step('warmup', 'easy', warm, warmEffort),
      step('main', 'easy', bike * 60 - warm, easyEffort),
      ...(run * 60 >= 3 * warm
        ? [
            step('main', 'easy', run * 60 - warm, easyEffort),
            step('cooldown', 'easy', warm, warmEffort),
          ]
        : [step('main', 'easy', run * 60, easyEffort)]),
    ],
    effort_target: easyEffort,
  };
}

/**
 * Harte Einheit bzw. Steigerungen mit `minutes` Gesamtdauer (Aufwärmen + Hauptteil + Abwärmen = `minutes`). null =
 * passt nicht (zu kurz, Budget zu klein, harte Einheiten nicht erlaubt) → der Aufrufer plant locker. WP5: `sport` Rad –
 * Fahrtspiel, Sweet-Spot (`tempo`, 2 Abschnitte) und Renntempo mit Rad-Texten; Steigerungen und Intervalle nur Laufen.
 */
export function structuredWorkout(
  type: 'strides' | 'fartlek' | 'tempo' | 'intervals' | 'race_pace',
  minutes: number,
  options: WorkoutOptions,
): EnduranceWorkout | null {
  const { limits, easyEffort } = options;
  if (!limits.allowed || limits.effortCap < I.hardEffortMin) return null;
  if (minutes < W.hardMinMinutes) return null;
  if (options.sport === 'bike') return bikeStructured(type, minutes, options);
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

/**
 * Harte Rad-Einheit (WP5, Plan 9 „Sweet-Spot/Tempo“; COMPETITION_BIKE_WORKOUTS): Fahrtspiel (1 min zügig / 2 min locker),
 * Sweet-Spot (`tempo`, 2 gleiche Abschnitte mit 5 min locker dazwischen) und Renntempo-Abschnitte (10 min). Steigerungen
 * und Intervalle gibt es auf dem Rad nicht (null). Aufbau, Budget und Deckel wie beim Laufen.
 */
function bikeStructured(
  type: 'strides' | 'fartlek' | 'tempo' | 'intervals' | 'race_pace',
  minutes: number,
  options: WorkoutOptions,
): EnduranceWorkout | null {
  if (type === 'strides' || type === 'intervals') return null;
  const { limits, easyEffort } = options;
  const workOnly = limits.countWorkOnly;
  const budget = Math.max(0, options.hardBudgetS);
  const capped = (e: number) => Math.min(e, limits.effortCap);
  const warmS = W.hardWarmupMinutes * 60;
  const coolS = W.hardCooldownMinutes * 60;
  const mainS = minutes * 60 - warmS - coolS;
  const BW = COMPETITION_BIKE_WORKOUTS;
  const texts = MULTISPORT_TEXTS_DE.bike;
  const block: WorkoutStep[] = [];
  let mainText: string;
  if (type === 'tempo') {
    const S = BW.sweetSpot;
    // Zwei gleiche Abschnitte in ganzen Minuten; mit Trabpause nur, wenn der ganze Hauptteil zählt (wie Laufen).
    let work = Math.min(S.maxMinutes[options.level] * 60, mainS - S.restS);
    work = Math.min(work, workOnly ? budget : budget - S.restS);
    work = Math.floor(work / 120) * 120;
    if (work < S.minMinutes * 60) return null;
    const effort = capped(S.effort);
    if (effort < I.hardEffortMin) return null;
    block.push(
      step('main', 'work', work / 2, effort),
      step('main', 'rest', S.restS, easyEffort),
      step('main', 'work', work / 2, effort),
    );
    mainText = texts.main.tempo(work / 60);
  } else {
    const spec =
      type === 'fartlek'
        ? { ...W.fartlek, effort: I.effort.fartlek }
        : {
            workS: BW.racePaceWorkS,
            restS: W.racePace.restS,
            minReps: W.racePace.minReps,
            maxReps: W.racePace.maxReps,
            effort: BW.racePaceEffort,
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
      type === 'fartlek' ? texts.main.fartlek(reps) : texts.main.race_pace(reps, spec.workS / 60);
  }
  const used = block.reduce((sum, st) => sum + st.seconds, 0);
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
    name_de: texts.names[type],
    warmup_de: texts.warmupHard,
    main_de: mainText,
    cooldown_de: texts.cooldownHard,
    steps,
    effort_target: Math.max(...block.filter((st) => st.kind === 'work').map((st) => st.effort)),
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
  /** WP5 Triathlon: Koppeltraining Rad → Lauf an diesem Tag (triathlonWeekSports; Variante Rad). */
  readonly brick?: boolean;
}

export interface WeekWorkoutInput {
  readonly phase: CompetitionPhase;
  /** Erholungswoche im Training (nicht Tapering): keine harten Einheiten. */
  readonly recoveryWeek: boolean;
  /** Woche 0 (angebrochene Startwoche, Einstieg): weder harte Einheiten noch Steigerungen (Wächter M1). */
  readonly weekZero?: boolean;
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
  /**
   * Sportarten Stufe 1 (Hyrox): schon vergebene Einheiten je Datum (Kombi bzw. Technik-Kombi). Harte zählen ins
   * 80/20-Budget, in den Wochen-Deckel und gegen harte Nachbartage. Fehlt → wie bisher.
   */
  readonly fixed?: ReadonlyMap<string, EnduranceWorkout>;
}

export interface PlannedWorkout extends EnduranceWorkout {
  readonly date: string;
  readonly minutes: number;
  readonly target_distance_m: number | null;
}

/**
 * Harte Arten je Phase und Level, in Reihenfolge der Vergabe (Plan 3.1/3.4). WP5 Rad (Plan 9 „Sweet-Spot/Tempo“):
 * Aufbau Einsteiger Fahrtspiel, sonst Sweet-Spot; Spitze Einsteiger Sweet-Spot, sonst Sweet-Spot + Renntempo; Tapering
 * Einsteiger Fahrtspiel, sonst Renntempo.
 */
export function hardTypesFor(
  phase: CompetitionPhase,
  level: ExperienceLevel,
  sport: Sport = 'run',
  discipline?: CompetitionDiscipline,
): readonly ('fartlek' | 'tempo' | 'intervals' | 'race_pace')[] {
  const beginner = level === 'beginner';
  // Sportarten Stufe 1 (Hyrox): Lauf ohne Renntempo (das übernimmt die Kombi), HYROX_PLAN.runHardTypes.
  if (discipline === 'hyrox' && sport === 'run') {
    if (phase !== 'build' && phase !== 'peak' && phase !== 'taper') return [];
    return HYROX_PLAN.runHardTypes[phase][beginner ? 'beginner' : 'other'];
  }
  if (sport === 'bike') {
    if (phase === 'build') return beginner ? ['fartlek'] : ['tempo'];
    if (phase === 'peak') return beginner ? ['tempo'] : ['tempo', 'race_pace'];
    if (phase === 'taper') return beginner ? ['fartlek'] : ['race_pace'];
    return [];
  }
  if (sport === 'swim') return [];
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
 * - Steigerungen in der Basis für Fortgeschrittene/Leistungssport (zählen mit ins 80/20-Budget), nie in einer
 *   Erholungswoche oder in Woche 0,
 * - Erholung nach dem Rennen: Erholungsläufe.
 */
/**
 * Tag der langen Einheit, wie weekWorkouts ihn nimmt: nur in Basis, Aufbau, Spitze und Tapering und nur, wenn der
 * Wunsch-/Auswahl-Tag die längste Einheit der Woche ist (sonst keiner).
 */
export function effectiveLongDate(
  days: readonly { readonly date: string; readonly minutes: number }[],
  phase: CompetitionPhase,
  longRunDate: string | null,
): string | null {
  const longest = Math.max(0, ...days.map((d) => d.minutes));
  const longPhase = phase === 'base' || phase === 'build' || phase === 'peak' || phase === 'taper';
  return longPhase &&
    longRunDate !== null &&
    days.some((d) => d.date === longRunDate && d.minutes >= longest)
    ? longRunDate
    : null;
}

export function weekWorkouts(input: WeekWorkoutInput): PlannedWorkout[] {
  const { days, phase, limits } = input;
  const total = days.reduce((sum, d) => sum + d.minutes, 0);
  let budget = weeklyHardBudgetSeconds(total);
  const longDate = effectiveLongDate(days, phase, input.longRunDate);
  const types = new Map<string, EnduranceWorkout>();
  const options = (budgetS: number, sport: Sport = 'run'): WorkoutOptions => ({
    easyEffort: input.easyEffort,
    limits,
    level: input.level,
    discipline: input.discipline,
    hardBudgetS: budgetS,
    ...(sport === 'run' ? {} : { sport }),
  });
  const runnable = (d: WeekEnduranceDay) => d.variant === 'easy_run';
  // WP5: harte Einheiten auch auf dem Rad (nicht Ergometer bei „nur Gehen“ – dort sind harte ohnehin gesperrt), nie
  // im Koppeltraining und nie beim Schwimmen.
  const hardCapable = (d: WeekEnduranceDay) =>
    (d.variant === 'easy_run' || d.variant === 'easy_bike') && d.brick !== true;
  // Erholungswoche und Woche 0: nichts mit Anstrengung ≥ 6 (Plan 3.5; Wächter M1).
  const easyOnly = input.recoveryWeek || input.weekZero === true;
  const typesFor = (sport: Sport) =>
    easyOnly ? [] : hardTypesFor(phase, input.level, sport, input.discipline);
  // Hyrox: vorab vergebene Einheiten (Kombi) – harte zählen ins Budget und in den Deckel (Plan 2.1).
  const fixed = input.fixed ?? new Map<string, EnduranceWorkout>();
  const fixedHard = [...fixed.entries()].filter(([, w]) => isHardWorkoutType(w.type));
  for (const [date, workout] of fixed) {
    types.set(date, workout);
    if (isHardWorkoutType(workout.type)) budget -= hardSeconds(workout.steps, limits.countWorkOnly);
  }
  // Laufen wie bisher (WP2); mit Rad-Tagen zusätzlich die Rad-Arten (Rad: nur diese, Triathlon: beide).
  const sports = new Set(days.filter(hardCapable).map((d) => sportOfVariant(d.variant)));
  const hardTypes = sports.has('bike')
    ? [...(sports.has('run') ? typesFor('run') : []), ...typesFor('bike')]
    : typesFor('run');
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
  // Hyrox: die Kombi ist schon eine harte Einheit dieser Woche.
  hardCount = Math.max(0, Math.min(hardCount, limits.perWeek - fixedHard.length));
  const chosen: string[] = fixedHard.map(([date]) => date);
  const fixedCount = chosen.length;
  const perSport: Record<Sport, number> = { run: 0, bike: 0, swim: 0 };
  if (hardCount > 0) {
    const candidates = days
      .filter(
        (d) =>
          hardCapable(d) &&
          d.date !== longDate &&
          d.minutes >= W.hardMinMinutes &&
          !input.blockedDates.has(d.date) &&
          !(longDate && weekdayNeighbours(d.date, longDate)),
      )
      .sort((a, b) => b.minutes - a.minutes || (a.date < b.date ? -1 : 1));
    for (const d of candidates) {
      if (chosen.length - fixedCount >= hardCount) break;
      if (types.has(d.date)) continue;
      if (chosen.some((c) => weekdayNeighbours(c, d.date))) continue;
      const sport = sportOfVariant(d.variant);
      const sportTypes = typesFor(sport);
      const type = sportTypes[perSport[sport]] ?? sportTypes[0];
      if (!type) continue;
      const workout =
        structuredWorkout(type, d.minutes, options(budget, sport)) ??
        (type === 'fartlek'
          ? null
          : structuredWorkout('fartlek', d.minutes, options(budget, sport)));
      if (!workout) continue;
      perSport[sport] += 1;
      budget -= hardSeconds(workout.steps, limits.countWorkOnly);
      types.set(d.date, workout);
      chosen.push(d.date);
    }
  }
  if (!easyOnly && phase === 'base' && input.level !== 'beginner' && limits.allowed && n >= 3) {
    const easyDay = days
      .filter((d) => runnable(d) && d.date !== longDate && !types.has(d.date))
      .sort((a, b) => b.minutes - a.minutes || (a.date < b.date ? -1 : 1))[0];
    const strides = easyDay ? structuredWorkout('strides', easyDay.minutes, options(budget)) : null;
    // Steigerungen zählen ins 80/20-Budget (oben `options(budget)`); danach wird nichts Hartes mehr vergeben.
    if (easyDay && strides) types.set(easyDay.date, strides);
  }
  // WP5 Triathlon: Koppeltraining an den markierten Tagen; Schwimmtechnik am ersten Schwimm-Tag der Woche (nicht in
  // der Rennwoche und der Erholung nach dem Rennen). Beides locker.
  for (const d of days) {
    if (d.brick !== true || types.has(d.date)) continue;
    const brick = brickWorkout(d.minutes, input.easyEffort);
    if (brick) types.set(d.date, brick);
  }
  if (phase !== 'race_week' && phase !== 'recovery') {
    const swimDay = [...days]
      .filter((d) => sportOfVariant(d.variant) === 'swim' && !types.has(d.date))
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
    const technique = swimDay ? techniqueWorkout(swimDay.minutes, input.easyEffort) : null;
    if (swimDay && technique) types.set(swimDay.date, technique);
  }
  return days.map((d) => {
    const workout =
      types.get(d.date) ??
      easyWorkout(
        d.date === longDate ? 'long' : phase === 'recovery' ? 'recovery' : 'easy',
        d.minutes,
        input.easyEffort,
        sportOfVariant(d.variant),
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
