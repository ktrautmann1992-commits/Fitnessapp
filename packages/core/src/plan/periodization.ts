import { COMPETITION_PERIODIZATION } from '../constants';
import { addDays, daysBetween, isoWeekday, startOfIsoWeek } from '../dates';
import type { ExperienceLevel } from '../enums';
import type { CompetitionDiscipline, CompetitionPhase } from './competition-schema';
import { loadWeeksBeforeDeload } from './deload';
import type { EnduranceStartGroup } from './safety';
import type { BlockWeekSpec, CompetitionWeekWorkouts } from './schedule';

/** Wochenbau-Angaben ohne Phase (je Woche aus dem Makrozyklus ergänzt). */
export type CompetitionWorkoutBase = Omit<CompetitionWeekWorkouts, 'phase' | 'recoveryWeek'>;

/**
 * Periodisierung rückwärts vom Renntag (docs/PLAN-PHASE-10.md Abschnitte 3.1 und 5, Etappe WP1). Reine Funktionen,
 * nichts wird gespeichert: Jeder Folgeblock rechnet den Makrozyklus aus denselben Eingaben neu (gleiche Eingaben →
 * gleiches Ergebnis). Keine KI.
 */

export interface MacroCycleInputs {
  readonly discipline: CompetitionDiscipline;
  readonly raceDate: string;
  readonly experienceLevel: ExperienceLevel;
  /** Startgruppe Ausdauer (planSafetyRules().enduranceStartGroup) – vorsichtig → 3 : 1 in Aufbau und Spitze. */
  readonly group: EnduranceStartGroup;
  /** Vorsichtiger Plan (planSafetyRules().cautious) – Erholungsrhythmus der Basis wie loadWeeksBeforeDeload. */
  readonly cautious: boolean;
}

/**
 * Neustart des Erholungsrhythmus für einen Folgeblock (Wächter M1): Der Folgeblock beginnt immer am Montag nach der
 * Woche der letzten geplanten Einheit (`fromMonday`); `loadWeeksBefore` = Belastungswochen direkt davor (nach der
 * letzten Erholungswoche). So entsteht nie eine Woche ohne Plan, auch wenn sich der Rhythmus (Gruppe, Level, Flag)
 * geändert hat. Ohne Änderung ergibt der Neustart dieselben Erholungswochen wie der ursprüngliche Zyklus.
 */
export interface CycleRestart {
  readonly fromMonday: string;
  readonly loadWeeksBefore: number;
}

/** Eine Kalenderwoche (Montag bis Sonntag) des Makrozyklus. */
export interface MacroWeek {
  /** 0 = Woche des Planstarts. */
  readonly index: number;
  readonly monday: string;
  readonly phase: CompetitionPhase;
  /** Erholungswoche im Training (nur Basis, Aufbau, Spitze). */
  readonly deload: boolean;
  /** Angebrochene Startwoche (Planstart nicht Montag) = Woche 0: zählt nie als Belastungswoche. */
  readonly partial: boolean;
  /** Umfang relativ zur letzten Belastungswoche (Tapering, Rennwoche, Erholung); sonst null. */
  readonly volumeFactor: number | null;
}

export interface MacroCycle {
  readonly planStart: string;
  readonly raceDate: string;
  readonly discipline: CompetitionDiscipline;
  readonly weeks: readonly MacroWeek[];
  /** Tage Tapering bis zum Renntag (ohne Renntag): 7 × Tapering-Wochen + Tage der Rennwoche davor. */
  readonly taperDays: number;
  /** Tage ohne Einheit: Vortag, Renntag und Rest der Rennwoche. */
  readonly excludedDates: readonly string[];
}

/**
 * Tapering-Wochen vor der Rennwoche: kleinste Zahl n ≥ 1 mit 7 × n + (Wochentag des Rennens − 1) ≥ Mindest-Tage
 * (COMPETITION_PERIODIZATION.taperMinDays). So ist das Tapering nie kürzer als Plan 3.1.
 */
export function taperWeekCount(discipline: CompetitionDiscipline, raceDate: string): number {
  const minDays = COMPETITION_PERIODIZATION.taperMinDays[discipline];
  const before = isoWeekday(raceDate) - 1;
  let n = 1;
  while (7 * n + before < minDays) n += 1;
  return n;
}

/** Belastungswochen vor einer Erholungswoche je Phase (W-G3): Aufbau/Spitze 3 : 1 für Einsteiger und vorsichtig. */
export function deloadRhythm(
  phase: CompetitionPhase,
  inputs: Pick<MacroCycleInputs, 'experienceLevel' | 'group' | 'cautious'>,
): number {
  const base = loadWeeksBeforeDeload(inputs.experienceLevel, inputs.cautious);
  if (phase !== 'build' && phase !== 'peak') return base;
  const strict = COMPETITION_PERIODIZATION.buildDeloadAfterLoadWeeks;
  if (inputs.group === 'cautious') return Math.min(base, strict.cautious);
  if (inputs.experienceLevel === 'beginner') return Math.min(base, strict.beginner);
  return base;
}

function taperFactors(count: number): readonly number[] {
  const table: Readonly<Record<number, readonly number[]>> = COMPETITION_PERIODIZATION.taperFactors;
  const factors = table[count];
  if (!factors) {
    throw new RangeError(`Keine Tapering-Stufen für ${count} Wochen.`);
  }
  return factors;
}

/**
 * Makrozyklus ab `planStart` bis zum Ende der Erholung nach dem Rennen (Plan 3.1), rückwärts gefüllt:
 * Erholung (nach der Rennwoche) ← Rennwoche ← Tapering ← Spitze ← Aufbau ← Basis (alle übrigen Wochen am Anfang).
 * Reicht die Zeit nicht, wird zuerst die Basis, dann der Aufbau, dann die Spitze kürzer.
 * Erholungswochen im Training vorwärts nach dem Rhythmus der Phase (deloadRhythm, angebrochene Startwoche zählt nicht);
 * fiele eine in die letzte Woche vor dem Tapering, wird sie eine Woche vorgezogen (nie gestrichen).
 * null = keine einzige volle Belastungswoche vor dem Tapering (kein Plan möglich) oder Renntag nicht nach dem Planstart.
 */
export function macroCycle(
  inputs: MacroCycleInputs,
  planStart: string,
  restart?: CycleRestart,
): MacroCycle | null {
  if (inputs.raceDate <= planStart) return null;
  const startMonday = startOfIsoWeek(planStart);
  const raceMonday = startOfIsoWeek(inputs.raceDate);
  const raceIndex = daysBetween(startMonday, raceMonday) / 7;
  const partialStart = planStart !== startMonday;
  const taperCount = taperWeekCount(inputs.discipline, inputs.raceDate);
  const preTaper = raceIndex - taperCount;
  const firstCounted = partialStart ? 1 : 0;
  if (preTaper - firstCounted < 1) return null;

  // Phasen rückwärts (nur Wochen vor dem Tapering).
  const P = COMPETITION_PERIODIZATION;
  const peakLen = Math.min(P.peakWeeks[inputs.discipline], preTaper);
  const buildLen = Math.min(P.buildWeeks[inputs.discipline], preTaper - peakLen);
  const phaseAt = (i: number): CompetitionPhase =>
    i >= preTaper - peakLen ? 'peak' : i >= preTaper - peakLen - buildLen ? 'build' : 'base';

  // Erholungswochen vorwärts (beim Folgeblock ab dem Neustart, Zähler = Belastungswochen direkt davor).
  const deload: boolean[] = Array.from({ length: preTaper }, () => false);
  const restartIndex = restart
    ? daysBetween(startMonday, startOfIsoWeek(restart.fromMonday)) / 7
    : 0;
  const from = restart ? Math.max(firstCounted, restartIndex) : firstCounted;
  let count = restart ? Math.max(0, Math.floor(restart.loadWeeksBefore)) : 0;
  for (let i = from; i < preTaper; i += 1) {
    if (count >= deloadRhythm(phaseAt(i), inputs)) {
      deload[i] = true;
      count = 0;
    } else {
      count += 1;
    }
  }
  const last = preTaper - 1;
  if (deload[last] && last - 1 >= from) {
    // Vorziehen: die Woche davor wird Erholungswoche (sie ist immer eine volle Belastungswoche, weil vor einer
    // Erholungswoche mindestens deloadRhythm ≥ 3 Belastungswochen liegen). Liegt sie vor dem Neustart eines
    // Folgeblocks (schon geplant), bleibt die Erholungswoche, wo sie ist – Erholung geht vor (nie gestrichen).
    deload[last] = false;
    deload[last - 1] = true;
  }

  const weeks: MacroWeek[] = [];
  for (let i = 0; i < preTaper; i += 1) {
    weeks.push({
      index: i,
      monday: addDays(startMonday, 7 * i),
      phase: phaseAt(i),
      deload: deload[i] ?? false,
      partial: partialStart && i === 0,
      volumeFactor: null,
    });
  }
  taperFactors(taperCount).forEach((factor, k) => {
    const i = preTaper + k;
    weeks.push({
      index: i,
      monday: addDays(startMonday, 7 * i),
      phase: 'taper',
      deload: false,
      partial: false,
      volumeFactor: factor,
    });
  });
  weeks.push({
    index: raceIndex,
    monday: raceMonday,
    phase: 'race_week',
    deload: false,
    partial: false,
    volumeFactor: P.raceWeekFactor,
  });
  for (let k = 0; k < P.recoveryWeeks[inputs.discipline]; k += 1) {
    const i = raceIndex + 1 + k;
    weeks.push({
      index: i,
      monday: addDays(startMonday, 7 * i),
      phase: 'recovery',
      deload: false,
      partial: false,
      volumeFactor: P.recoveryFactors[Math.min(k, P.recoveryFactors.length - 1)] as number,
    });
  }

  // Vortag (bei einem Rennen am Montag der Sonntag der letzten Tapering-Woche), Renntag und Rest der Rennwoche.
  const excluded: string[] = [];
  const raceEnd = addDays(raceMonday, 6);
  for (let d = addDays(inputs.raceDate, -P.restDaysBeforeRace); d <= raceEnd; d = addDays(d, 1)) {
    excluded.push(d);
  }
  return {
    planStart,
    raceDate: inputs.raceDate,
    discipline: inputs.discipline,
    weeks,
    taperDays: 7 * taperCount + isoWeekday(inputs.raceDate) - 1,
    excludedDates: excluded,
  };
}

/** Belastungswoche im Sinne der 10-%-Kette (nicht angebrochen, keine Erholung, kein Tapering/Rennen/Erholung). */
export function isLoadWeek(week: MacroWeek): boolean {
  return !week.partial && !week.deload && week.volumeFactor === null;
}

/** Ein Block des Wettkampfplans: Wochen des Makrozyklus und ihre Vorgabe für die Plan-Engine. */
export interface CompetitionBlock {
  readonly weeks: readonly MacroWeek[];
  /** Vorgabe für buildPlanBlock (`weeks`) bzw. nextPlanBlock (`competitionWeeks`). */
  readonly specs: readonly BlockWeekSpec[];
}

/**
 * Teilt den Makrozyklus in Blöcke (höchstens Woche 0 + 6 Wochen, PLAN_BLOCK_LIMITS.weekNo): Schnitt nach jeder
 * Erholungswoche und vor dem Tapering; Tapering, Rennwoche und Erholung bilden den letzten Block. Die angebrochene
 * Startwoche ist Woche 0 des ersten Blocks (Einstiegswoche), sonst ist dessen Woche 1 die Einstiegswoche; Folgeblöcke
 * haben weder Woche 0 noch Einstiegswoche (wie append_plan_block). Belastungswochen bekommen das Plateau
 * `peakTarget` (Spitzenumfang erreicht → bleibt), Tapering/Rennwoche/Erholung ihren Umfangs-Faktor, die Rennwoche
 * die freien Tage (Vortag, Renntag, Rest).
 */
export function competitionBlocks(
  cycle: MacroCycle,
  peakTarget: number,
  fromMonday?: string,
  workouts?: CompetitionWorkoutBase,
): CompetitionBlock[] {
  const groups: MacroWeek[][] = [];
  let current: MacroWeek[] = [];
  // Folgeblock: nur Wochen ab `fromMonday`; dann gibt es weder Woche 0 noch Einstiegswoche.
  const followUp = fromMonday !== undefined;
  for (const week of cycle.weeks) {
    if (followUp && week.monday < fromMonday) continue;
    if (week.phase === 'taper' && current.length > 0 && current.at(-1)?.phase !== 'taper') {
      groups.push(current);
      current = [];
    }
    current.push(week);
    if (week.deload) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length > 0) groups.push(current);
  return groups.map((weeks, blockIndex) => {
    const hasWeekZero = !followUp && blockIndex === 0 && weeks[0]?.partial === true;
    const specs = weeks.map((week, k): BlockWeekSpec => {
      const weekNo = hasWeekZero ? k : k + 1;
      const first = !followUp && blockIndex === 0 && k === 0;
      const build = workouts
        ? { workouts: { ...workouts, phase: week.phase, recoveryWeek: week.deload } }
        : {};
      if (week.deload || week.volumeFactor !== null) {
        return {
          weekNo,
          monday: week.monday,
          kind: 'deload',
          ...build,
          ...(week.volumeFactor === null ? {} : { enduranceVolumeFactor: week.volumeFactor }),
          ...(week.phase === 'race_week' || week.phase === 'taper'
            ? { excludedDates: cycle.excludedDates }
            : {}),
        };
      }
      return {
        weekNo,
        monday: week.monday,
        kind: first ? 'intro' : 'load',
        enduranceMaxBudget: peakTarget,
        ...build,
      };
    });
    return { weeks, specs };
  });
}

/**
 * Wochen des nächsten Blocks: beginnt am Montag nach der Woche der letzten geplanten Einheit (`lastScheduledOn`). Den
 * Zyklus dafür mit demselben Neustart rechnen (macroCycle `restart.fromMonday`), sonst können Wochen fehlen.
 * null = Makrozyklus zu Ende (danach weiter mit dem Grundlagen-Plan).
 */
export function nextCompetitionBlock(
  cycle: MacroCycle,
  peakTarget: number,
  lastScheduledOn: string,
  workouts?: CompetitionWorkoutBase,
): CompetitionBlock | null {
  const fromMonday = addDays(startOfIsoWeek(lastScheduledOn), 7);
  return competitionBlocks(cycle, peakTarget, fromMonday, workouts)[0] ?? null;
}

/**
 * Belastungswochen direkt vor dem Neustart (für CycleRestart): Kalenderwochen rückwärts ab der Woche der letzten
 * Einheit, solange die Woche Einheiten hat, keine Erholungs-/Tapering-Woche (`is_deload`) und nicht Woche 0 ist.
 */
export function trailingLoadWeeks(
  previous: readonly {
    readonly scheduled_on: string;
    readonly week_no: number;
    readonly is_deload: boolean;
  }[],
): number {
  if (previous.length === 0) return 0;
  const byWeek = new Map<string, { deload: boolean; weekZero: boolean }>();
  for (const s of previous) {
    const monday = startOfIsoWeek(s.scheduled_on);
    const week = byWeek.get(monday) ?? { deload: true, weekZero: true };
    byWeek.set(monday, {
      deload: week.deload && s.is_deload,
      weekZero: week.weekZero && s.week_no === 0,
    });
  }
  let monday = [...byWeek.keys()].sort().at(-1) as string;
  let count = 0;
  for (;;) {
    const week = byWeek.get(monday);
    if (!week || week.deload || week.weekZero) return count;
    count += 1;
    monday = addDays(monday, -7);
  }
}
