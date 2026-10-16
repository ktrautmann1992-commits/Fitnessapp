/**
 * Gemeinsame Test-Helfer für den Wettkampfplan (WP1/WP2): ganzer Plan über alle Blöcke und unabhängige Prüfungen
 * (10-%-Kette, Erholungsrhythmus). Erwartungen bewusst NICHT aus constants.ts.
 */
import { addDays, startOfIsoWeek } from '../dates';
import { competitionFollowUpBlock, type CompetitionRequest } from './competition';
import type { CompetitionDiscipline } from './competition-schema';
import { equipmentProfile } from './equipment-profile';
import { generateCompetitionPlan, type GeneratedPlan } from './generate';
import type { PlanInputsInput } from './inputs';
import { type EnduranceStartGroup, planSafetyRules } from './safety';
import { type GeneratedSession, nextPlanBlock, type PreviousSession } from './schedule';
import { FULL_HOME, person, repoLibrary } from './test-library';

export const library = repoLibrary();
export type Kind = 'strength_gym' | 'strength_home' | 'endurance';
export type Level = 'beginner' | 'advanced' | 'competitive';
export const fixed = (...days: [number, Kind, number][]) => ({
  mode: 'fixed' as const,
  slots: days.map(([weekday, kind, minutes]) => ({ weekday, kind, minutes })),
});

// Feste Tabelle (Plan 3.2, Phase 3) – bewusst nicht aus constants.ts.
export const START = { beginner: 60, advanced: 120, competitive: 150, cautious: 45 } as const;
export const MAX_TAPER_FACTOR = 0.75;

export function runner(
  discipline: CompetitionDiscipline,
  level: Level = 'beginner',
  overrides: Partial<PlanInputsInput> = {},
): PlanInputsInput {
  return person({
    goalType: 'endurance',
    discipline,
    experienceLevel: level,
    schedule: fixed([2, 'endurance', 60], [4, 'endurance', 60], [7, 'endurance', 90]),
    homeEquipment: [...FULL_HOME],
    ...overrides,
  });
}

export const request = (
  discipline: CompetitionDiscipline,
  raceDate: string,
): CompetitionRequest => ({
  competition: { name: 'Lauf', discipline, raceDate },
});

/** Eine Woche des fertigen Plans laut Vorgabe (nicht laut Einheiten – leere Erholungswochen zählen mit, N1). */
export interface PlanWeek {
  readonly monday: string;
  readonly phase: string;
  readonly load: boolean;
  readonly group: EnduranceStartGroup;
  readonly level: Level;
  readonly cautious: boolean;
}

/** Ganzer Wettkampfplan: erster Block + alle Folgeblöcke bis zum Ende des Makrozyklus. */
export function fullPlan(
  inputs: PlanInputsInput,
  req: CompetitionRequest,
  today: string,
  laterInputs: (blockNo: number) => { inputs: PlanInputsInput; today: string } = () => ({
    inputs,
    today,
  }),
  options: { readonly logged?: 'none' } = {},
): {
  plan: GeneratedPlan;
  sessions: PreviousSession[];
  endReason: string;
  weeks: PlanWeek[];
  gaps: string[];
} {
  const result = generateCompetitionPlan(inputs, library, today, req);
  if (!result.ok) throw new Error(result.error);
  const plan = result.plan;
  let sessions: PreviousSession[] = [...plan.sessions];
  let previousGroup = plan.safety_rules.enduranceStartGroup;
  const record = (
    infos: readonly { monday: string; week_no: number; phase: string; is_recovery_week: boolean }[],
    p: PlanInputsInput,
    on: string,
  ) => {
    const rules = planSafetyRules(
      {
        experienceLevel: p.experienceLevel,
        birthDate: p.birthDate,
        healthScreening: p.healthScreening ?? null,
      },
      on,
    );
    return infos.map((w) => ({
      monday: w.monday,
      phase: w.phase,
      load: w.week_no >= 1 && !w.is_recovery_week && ['base', 'build', 'peak'].includes(w.phase),
      group: rules.enduranceStartGroup,
      level: p.experienceLevel,
      cautious: rules.cautious,
    }));
  };
  const weeks: PlanWeek[] = record(plan.competition?.block_weeks ?? [], inputs, today);
  const gaps: string[] = [];
  for (let guard = 0; guard < 30; guard += 1) {
    const blockNo = Math.max(...sessions.map((s) => s.block_no)) + 1;
    const later = laterInputs(blockNo);
    const last = sessions
      .map((s) => s.scheduled_on)
      .sort()
      .at(-1) as string;
    const follow = competitionFollowUpBlock(later.inputs, req, {
      planStart: plan.start_date,
      today: later.today,
      previous: sessions,
      effectiveGoal: plan.competition?.feasibility.effectiveGoal ?? 'finish',
    });
    if (!follow.ok) return { plan, sessions, endReason: follow.reason, weeks, gaps };
    if (follow.block.specs[0]?.monday !== addDays(startOfIsoWeek(last), 7)) {
      gaps.push(`Block ${blockNo} beginnt ${follow.block.specs[0]?.monday} nach ${last}`);
    }
    weeks.push(...record(follow.block.weeks, later.inputs, later.today));
    const p = later.inputs;
    const rules = planSafetyRules(
      {
        experienceLevel: p.experienceLevel,
        birthDate: p.birthDate,
        healthScreening: p.healthScreening ?? null,
      },
      later.today,
    );
    const next = nextPlanBlock(sessions, {
      schedule: plan.inputs.schedule,
      loadWeeks: plan.load_weeks,
      rules,
      library: library.exercises,
      profiles: new Map([
        ['home', equipmentProfile('home', [...FULL_HOME])],
        ['gym', equipmentProfile('gym', [])],
      ]),
      endurance: {
        goalType: 'endurance',
        discipline: plan.inputs.discipline,
        experienceLevel: p.experienceLevel,
      },
      previousStartGroup: previousGroup,
      // Belastungswochen aller bisherigen Blöcke (Geh-Lauf-Wechsel der Einsteiger wie in der App).
      loadWeeksBefore: new Set(
        sessions
          .filter((s) => s.week_no >= 1 && !s.is_deload)
          .map((s) => `${s.block_no}:${s.week_no}`),
      ).size,
      competitionWeeks: follow.block.specs,
      ...(options.logged === 'none' ? { loggedEnduranceMinutes: new Map<string, number>() } : {}),
    });
    previousGroup = rules.enduranceStartGroup;
    if (next.length === 0) return { plan, sessions, endReason: 'empty', weeks, gaps };
    sessions = [...sessions, ...next];
  }
  throw new Error('zu viele Blöcke');
}

/** Erwarteter Rhythmus unabhängig (W-G3): Basis Einsteiger 5, sonst/vorsichtiger Plan 4; Aufbau/Spitze 3 für Einsteiger/vorsichtig. */
export function rhythmViolations(weeks: readonly PlanWeek[]): string[] {
  const errors: string[] = [];
  let run = 0;
  for (const w of weeks) {
    if (!w.load) {
      run = 0;
      continue;
    }
    run += 1;
    const base = w.cautious ? 4 : w.level === 'beginner' ? 5 : 4;
    const limit =
      (w.phase === 'build' || w.phase === 'peak') &&
      (w.level === 'beginner' || w.group === 'cautious')
        ? Math.min(base, 3)
        : base;
    if (run > limit)
      errors.push(`${w.monday}: ${run} Belastungswochen in Folge (${w.phase}, höchstens ${limit})`);
  }
  // Nie zwei Erholungswochen im Training hintereinander (Neustart des Rhythmus nach einem Gruppenwechsel, Wächter M1).
  for (let k = 1; k < weeks.length; k += 1) {
    const [a, b] = [weeks[k - 1], weeks[k]];
    const recovery = (w: PlanWeek | undefined) =>
      w !== undefined &&
      !w.load &&
      ['base', 'build', 'peak'].includes(w.phase) &&
      w.monday !== weeks[0]?.monday;
    if (recovery(a) && recovery(b)) errors.push(`${b?.monday}: zweite Erholungswoche in Folge`);
  }
  // Lückenlos: jede Woche genau einmal, aufeinanderfolgend.
  for (let k = 1; k < weeks.length; k += 1) {
    if (weeks[k]?.monday !== addDays(weeks[k - 1]?.monday ?? '', 7)) {
      errors.push(`Woche fehlt/doppelt nach ${weeks[k - 1]?.monday}`);
    }
  }
  return errors;
}

export const enduranceByWeek = (sessions: readonly GeneratedSession[]) => {
  const map = new Map<string, number>();
  for (const s of sessions) {
    if (s.kind !== 'endurance') continue;
    const monday = startOfIsoWeek(s.scheduled_on);
    map.set(monday, (map.get(monday) ?? 0) + s.estimated_minutes);
  }
  return map;
};

/**
 * Unabhängige Prüfung der Kette über ALLE Blöcke: Belastungswoche ≤ floor(1,1 × letzte Belastungswoche), erste ≤ Start;
 * Erholungs-/Tapering-/Rennwochen ≤ floor(0,75 × letzte Belastungswoche) und nie Bezug; Woche 0 nie Bezug.
 */
export function chainViolations(
  sessions: readonly GeneratedSession[],
  start: number,
  initialReference = 0,
): string[] {
  const errors: string[] = [];
  const weeks = [...new Set(sessions.map((s) => startOfIsoWeek(s.scheduled_on)))].sort();
  const minutes = enduranceByWeek(sessions);
  let reference = initialReference;
  for (const monday of weeks) {
    const inWeek = sessions.filter((s) => startOfIsoWeek(s.scheduled_on) === monday);
    const sum = minutes.get(monday) ?? 0;
    if (inWeek.every((s) => s.week_no === 0)) {
      if (sum > start) errors.push(`${monday} Woche 0: ${sum} > ${start}`);
      continue;
    }
    if (inWeek.every((s) => s.is_deload)) {
      const limit = Math.floor((reference * MAX_TAPER_FACTOR * 100) / 100);
      if (sum > limit) errors.push(`${monday} Erholung/Tapering: ${sum} > ${limit}`);
      continue;
    }
    const limit = reference > 0 ? Math.floor((reference * 110) / 100) : start;
    if (sum > limit) errors.push(`${monday}: ${sum} > ${limit}`);
    if (sum > 0) reference = sum;
  }
  return errors;
}
