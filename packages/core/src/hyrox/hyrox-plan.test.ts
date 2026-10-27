/**
 * Hyrox (docs/PLAN-SPORTARTEN-STUFE-1.md 2.1, 5, 9 Punkt 4 – Etappe H): Ampel, Wochenbau mit Lauf-, Stations- und
 * Kombi-Einheiten, Simulation, Deload, Sicherheitsregeln, Ersatz-Kette, Schon-/Reise-Modus, Ergebnis. Erwartungen
 * bewusst als feste Zahlen aus dem Plan (nicht aus constants.ts), wo der Plan Zahlen nennt.
 */
import { describe, expect, it } from 'vitest';

import { checkWeekInvariants } from '../adjust/invariants';
import { COMPETITION_LEAD_WEEKS, HYROX_PLAN, HYROX_STATION_EXERCISES } from '../constants';
import { addDays, daysBetween, isoWeekday, startOfIsoWeek } from '../dates';
import { HYROX_SPLIT_SEGMENTS, HYROX_STATIONS, type HyroxStation } from '../enums';
import { applyModesToEndurance } from '../modes/layer';
import { regionsLoadedBy } from '../modes/pain';
import { competitionFeasibility, type CompetitionRequest } from '../plan/competition';
import { fixed, fullPlan, library, type Level, runner } from '../plan/competition-test-helpers';
import { loadWeeksBeforeDeload } from '../plan/deload';
import { equipmentProfile } from '../plan/equipment-profile';
import { generateCompetitionPlan, isCompetitionPlanWithinLimits } from '../plan/generate';
import type { PlanInputsInput } from '../plan/inputs';
import {
  type HardWorkoutLimits,
  hardSeconds,
  isHardSession,
  stepsFitWorkoutType,
  weeklyHardBudgetSeconds,
  workoutStepsSchema,
} from '../plan/intensity';
import { planSafetyRules } from '../plan/safety';
import type { GeneratedSession, PreviousSession } from '../plan/schedule';
import { MONDAY } from '../plan/test-library';
import { intervalCue } from '../routes/voice-cues';
import {
  hyroxComboFraction,
  hyroxComboRunOnly,
  hyroxComboSplit,
  hyroxComboWorkout,
  hyroxTechniqueCombo,
} from './combo';
import {
  allowedHyroxDivisions,
  hyroxDivisionAllowed,
  hyroxExcludedStations,
  hyroxStationAmount,
  hyroxStationCue,
  hyroxStationWeightKg,
} from './format';
import {
  formatRaceTime,
  hyroxResultLogFromInput,
  hyroxSplitsFromInput,
  parseRaceTime,
} from './result';
import {
  hyroxStationExercise,
  hyroxStationNotices,
  hyroxStationSession,
  hyroxStationTravelName,
} from './stations';
import { HYROX_TEXTS_DE } from './texts';

const GENERAL: HardWorkoutLimits = {
  allowed: true,
  effortCap: 8,
  perWeek: 2,
  countWorkOnly: false,
};
const STRICT: HardWorkoutLimits = { allowed: true, effortCap: 8, perWeek: 1, countWorkOnly: true };

const weeks = (n: number, from = MONDAY) => addDays(from, n * 7);
const req = (raceDate: string, extra: Partial<CompetitionRequest> = {}): CompetitionRequest => ({
  competition: { name: 'Hyrox Köln', discipline: 'hyrox', raceDate },
  ...extra,
});

/** Woche mit 3 Lauf-Tagen + 1 Kraft-Tag (Plan 2.1: 4 Tage = 2 Lauf + 1 Station + 1 Kombi). */
const fourDays = fixed(
  [2, 'endurance', 60],
  [4, 'endurance', 60],
  [5, 'strength_gym', 60],
  [7, 'endurance', 90],
);
const generousFive = fixed(
  [1, 'endurance', 75],
  [3, 'endurance', 75],
  [5, 'strength_gym', 60],
  [6, 'endurance', 90],
  [7, 'endurance', 90],
);

function hyroxRunner(level: Level = 'advanced', overrides: Partial<PlanInputsInput> = {}) {
  return runner('hyrox', level, { schedule: fourDays, ...overrides });
}

const isStation = (s: Pick<GeneratedSession, 'focus'>) => s.focus === 'hyrox_stations';
const isCombo = (s: GeneratedSession) =>
  (s.workout_steps ?? []).some((st) => st.kind === 'station');

function planOf(
  inputs: PlanInputsInput,
  raceDate: string,
  extra: Partial<CompetitionRequest> = {},
) {
  return fullPlan(inputs, req(raceDate, extra), MONDAY);
}

function expectValidPlan(
  inputs: PlanInputsInput,
  sessions: readonly PreviousSession[],
  raceDate: string,
  label: string,
) {
  const rules = planSafetyRules(
    {
      experienceLevel: inputs.experienceLevel,
      birthDate: inputs.birthDate,
      healthScreening: inputs.healthScreening ?? null,
    },
    MONDAY,
  );
  // Wochen-Invarianten (10-%-Regel, Erholungswochen, Deload-Dosierung) für jeden Hyrox-Plan.
  const violations = checkWeekInvariants(sessions, {
    maxLoadWeeks: loadWeeksBeforeDeload(inputs.experienceLevel, rules.cautious),
    planStart: MONDAY,
  });
  expect(violations, label).toEqual([]);
  const byWeek = new Map<string, GeneratedSession[]>();
  for (const s of sessions) {
    const key = startOfIsoWeek(s.scheduled_on);
    byWeek.set(key, [...(byWeek.get(key) ?? []), s]);
  }
  for (const [monday, list] of byWeek) {
    expect(list.filter(isStation).length, `${label} ${monday} Stationen`).toBeLessThanOrEqual(1);
    expect(list.filter(isCombo).length, `${label} ${monday} Kombis`).toBeLessThanOrEqual(1);
  }
  const dates = new Map(sessions.map((s) => [s.scheduled_on, s]));
  for (const s of sessions) {
    if (isCombo(s)) {
      if (s.workout_type === 'hyrox_combo') expect(s.endurance_modality, label).toBe('run');
      expect(s.is_deload && s.training_phase !== 'taper', `${label} Kombi in Erholungswoche`).toBe(
        false,
      );
      expect(s.week_no, label).not.toBe(0);
      expect(['race_week', 'recovery']).not.toContain(s.training_phase);
      expect(
        (s.workout_steps ?? []).reduce((sum, st) => sum + st.seconds, 0),
        label,
      ).toBe(s.estimated_minutes * 60);
      // Harte Kombi nie neben langem Lauf, Kraft mit Beinen/Station oder harter Einheit (48-h-Regel).
      const hard = s.workout_type === 'hyrox_combo';
      for (const d of hard ? [addDays(s.scheduled_on, -1), addDays(s.scheduled_on, 1)] : []) {
        const n = dates.get(d);
        if (!n) continue;
        expect(n.workout_type === 'long', `${label} ${s.scheduled_on} neben langem Lauf`).toBe(
          false,
        );
        expect(isStation(n), `${label} ${s.scheduled_on} neben Station`).toBe(false);
        expect(
          isHardSession(n.workout_type, n.workout_steps),
          `${label} ${s.scheduled_on} neben hart`,
        ).toBe(false);
      }
    }
    if (isStation(s)) {
      expect(s.kind).toBe('strength');
      expect(s.template_day_index).toBe(HYROX_PLAN.stationTemplateDayIndex);
      expect(s.exercises.every((e) => e.rpe_target <= rules.rpeMax)).toBe(true);
    }
  }
  const simulations = sessions.filter((s) => s.name_de === HYROX_TEXTS_DE.combo.simulationName);
  expect(simulations.length, `${label} Simulationen`).toBeLessThanOrEqual(1);
  for (const sim of simulations) {
    expect(sim.training_phase).toBe('peak');
    expect(daysBetween(sim.scheduled_on, raceDate)).toBeGreaterThanOrEqual(10);
  }
}

describe('HYROX_FORMAT und Divisionen', () => {
  it('8 Stationen in Rennreihenfolge mit den Mengen aus Plan 2.1', () => {
    expect(HYROX_STATIONS).toHaveLength(8);
    const full = Object.fromEntries(HYROX_STATIONS.map((s) => [s, hyroxStationAmount(s, 1)]));
    expect(full).toEqual({
      ski_erg: 1000,
      sled_push: 50,
      sled_pull: 50,
      burpee_broad_jumps: 80,
      rowing: 1000,
      farmers_carry: 200,
      sandbag_lunges: 100,
      wall_balls: 100,
    });
    expect(hyroxStationAmount('wall_balls', 0.25)).toBe(25);
    expect(hyroxStationAmount('ski_erg', 0.25)).toBe(250);
    expect(hyroxStationAmount('sled_push', 0.01)).toBe(5);
  });

  it('Gewichte je Division/Geschlecht; Doubles und Staffel wie Open; ohne Gewicht null', () => {
    expect(hyroxStationWeightKg('sled_push', 'open', 'male')).toBe(152);
    expect(hyroxStationWeightKg('sled_push', 'pro', 'male')).toBe(202);
    expect(hyroxStationWeightKg('wall_balls', 'open', 'female')).toBe(4);
    expect(hyroxStationWeightKg('farmers_carry', 'pro', 'female')).toBe(24);
    expect(hyroxStationWeightKg('sandbag_lunges', 'doubles', 'male')).toBe(
      hyroxStationWeightKg('sandbag_lunges', 'open', 'male'),
    );
    expect(hyroxStationWeightKg('sled_pull', 'relay', 'female')).toBe(78);
    expect(hyroxStationWeightKg('rowing', 'pro', 'male')).toBeNull();
  });

  it('unter 18 nur Open', () => {
    expect(allowedHyroxDivisions(true)).toEqual(['open']);
    expect(allowedHyroxDivisions(false)).toEqual(['open', 'pro', 'doubles', 'relay']);
    expect(hyroxDivisionAllowed('pro', true)).toBe(false);
    expect(hyroxDivisionAllowed('pro', false)).toBe(true);
  });

  it('Mindestvorlauf 8 Wochen, Einsteiger 12 – gleich in HYROX_PLAN und der Wettkampf-Tabelle', () => {
    expect(HYROX_PLAN.minimumLeadWeeks).toEqual({ beginner: 12, advanced: 8, competitive: 8 });
    expect(COMPETITION_LEAD_WEEKS.minimum.hyrox).toEqual(HYROX_PLAN.minimumLeadWeeks);
  });

  it('Wochenbau je Tage: 3 = 1+1+1, 4 = 2+1+1, 5 = 3+1+1; Summe = Tage', () => {
    expect(HYROX_PLAN.weekPattern[3]).toEqual({ run: 1, station: 1, combo: 1 });
    expect(HYROX_PLAN.weekPattern[4]).toEqual({ run: 2, station: 1, combo: 1 });
    expect(HYROX_PLAN.weekPattern[5]).toEqual({ run: 3, station: 1, combo: 1 });
    for (const [days, p] of Object.entries(HYROX_PLAN.weekPattern)) {
      expect(p.run + p.station + p.combo).toBe(Number(days));
    }
  });

  it('jede Ersatz-Kette endet mit Übungen ohne Spezialgerät aus dem Startbestand', () => {
    for (const station of HYROX_STATIONS) {
      const chain: readonly string[] = HYROX_STATION_EXERCISES[station];
      for (const id of chain) expect(library.exercises.has(id), `${station}: ${id}`).toBe(true);
      const last = library.exercises.get(chain.at(-1) as string);
      expect(last?.status, station).toBe('published');
    }
  });
});

describe('Ampel Hyrox (competitionFeasibility)', () => {
  const feasibility = (inputs: PlanInputsInput, raceDate: string, extra = {}, today = MONDAY) => {
    const result = competitionFeasibility(inputs, req(raceDate, extra), today);
    if (!result.ok) throw new Error('invalid');
    return result.feasibility;
  };

  it('Tabelle passt zur Kette: Einsteiger erreichen „Ankommen“ zum Mindestvorlauf (jeder Start-/Renn-Wochentag)', () => {
    for (let start = 0; start < 7; start += 1) {
      for (let race = 0; race < 7; race += 1) {
        const today = addDays(MONDAY, start);
        const f = feasibility(hyroxRunner('beginner'), addDays(weeks(12, today), race), {}, today);
        expect(['ok', 'tight'], `${today} +${race}`).toContain(f.status);
      }
    }
    const below = feasibility(hyroxRunner('beginner'), addDays(weeks(12), -1));
    expect(below.status).toBe('too_short');
    expect(below.reasons).toContain('lead_time_below_minimum');
    expect(below.suggestions.some((s) => s.kind === 'later_date')).toBe(true);
    expect(below.suggestions.at(-1)).toEqual({ kind: 'without_competition' });
  });

  it('Fortgeschritten ab 8 Wochen, darunter zu kurz', () => {
    expect(feasibility(hyroxRunner('advanced'), weeks(8)).status).toBe('ok');
    expect(feasibility(hyroxRunner('competitive'), weeks(8)).status).toBe('ok');
    const short = feasibility(hyroxRunner('advanced'), addDays(weeks(8), -1));
    expect(short.status).toBe('too_short');
    expect(short.minimumLeadWeeks).toBe(8);
  });

  it('Schwangerschaft → kein Hyrox-Plan; ohne Check → erst Check', () => {
    const pregnant = feasibility(
      hyroxRunner('advanced', { healthScreening: { flags: ['pregnancy', 'conservative_plan'] } }),
      weeks(16),
    );
    expect(pregnant.status).toBe('not_available');
    expect(pregnant.reasons).toContain('pregnancy');
    const plan = generateCompetitionPlan(
      hyroxRunner('advanced', { healthScreening: { flags: ['pregnancy', 'conservative_plan'] } }),
      library,
      MONDAY,
      req(weeks(16)),
    );
    expect(plan.ok).toBe(false);
    const noCheck = feasibility(hyroxRunner('advanced', { healthScreening: null }), weeks(16));
    expect(noCheck.reasons).toContain('health_check_required');
  });

  it('ab 65 nur mit Bestätigung; dann ohne Sprünge (Hinweis), 80 Jahre ebenso', () => {
    for (const birthDate of ['1961-01-01', '1946-06-01']) {
      const senior = hyroxRunner('beginner', { birthDate });
      const without = feasibility(senior, weeks(20));
      expect(without.status).toBe('not_available');
      expect(without.reasons).toEqual(['hyrox_senior_confirmation']);
      expect(without.suggestions.some((s) => s.kind === 'later_date')).toBe(false);
      const confirmed = feasibility(senior, weeks(20), { hyroxSeniorConfirmed: true });
      expect(['ok', 'tight']).toContain(confirmed.status);
      expect(confirmed.notices).toContain('hyrox_no_jumps');
      expect(confirmed.notices).toContain('medical_clearance');
    }
  });

  it('16 Jahre: Plan erlaubt (Division Open prüft der Server), Hinweis ohne Zielzeit', () => {
    const minor = hyroxRunner('advanced', { birthDate: '2010-01-01' });
    const f = feasibility(minor, weeks(16));
    expect(['ok', 'tight']).toContain(f.status);
    expect(f.notices).toContain('minor_no_target_time');
  });

  it('ohne Kraft-Tag: Hinweis „keine Stations-Einheit“; Arzt-Hinweis: Technik-Kombi', () => {
    const noStrength = hyroxRunner('advanced', {
      schedule: fixed([2, 'endurance', 60], [4, 'endurance', 60], [7, 'endurance', 90]),
    });
    expect(feasibility(noStrength, weeks(16)).notices).toContain('hyrox_no_station_day');
    const medical = hyroxRunner('advanced', {
      healthScreening: { flags: ['medical_clearance_recommended', 'conservative_plan'] },
    });
    expect(feasibility(medical, weeks(16)).notices).toContain('hyrox_technique_combo');
  });

  it('Lauf-Referenzzeit ist bei Hyrox erlaubt (nur „Ankommen“)', () => {
    const result = competitionFeasibility(
      hyroxRunner('advanced'),
      {
        competition: {
          name: 'Hyrox',
          discipline: 'hyrox',
          raceDate: weeks(16),
          reference: { discipline: '10k', timeS: 50 * 60, date: addDays(MONDAY, -30) },
        },
      },
      MONDAY,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.feasibility.notices).not.toContain('reference_distance_too_far');
  });
});

describe('Hyrox-Plan: Wochenbau, Invarianten, Simulation (ganzer Makrozyklus)', () => {
  it('Raster Level × Tage (1–7) × mit/ohne Kraft-Tag: gültig, Invarianten, höchstens 1 Station/Kombi je Woche', () => {
    const schedules: Record<string, ReturnType<typeof fixed>> = {
      '1 Tag': fixed([6, 'endurance', 90]),
      '2 Tage': fixed([3, 'strength_gym', 60], [6, 'endurance', 90]),
      '3 Tage': fixed([2, 'endurance', 60], [4, 'strength_gym', 60], [7, 'endurance', 90]),
      '4 Tage': fourDays,
      '5 Tage': generousFive,
      '7 Tage': fixed(
        [1, 'endurance', 60],
        [2, 'strength_gym', 45],
        [3, 'endurance', 60],
        [4, 'endurance', 60],
        [5, 'strength_home', 45],
        [6, 'endurance', 90],
        [7, 'endurance', 60],
      ),
      'ohne Kraft': fixed([2, 'endurance', 60], [4, 'endurance', 60], [7, 'endurance', 90]),
    };
    for (const level of ['beginner', 'advanced', 'competitive'] as const) {
      for (const [name, schedule] of Object.entries(schedules)) {
        const inputs = hyroxRunner(level, { schedule });
        const raceDate = addDays(weeks(16), 5);
        const f = competitionFeasibility(inputs, req(raceDate), MONDAY);
        if (!f.ok || !['ok', 'tight'].includes(f.feasibility.status)) continue;
        const { plan, sessions } = planOf(inputs, raceDate);
        expect(isCompetitionPlanWithinLimits(plan), `${level} ${name}`).toBe(true);
        expectValidPlan(inputs, sessions, raceDate, `${level} ${name}`);
        const strengthDays = schedule.slots.filter((s) => s.kind !== 'endurance').length;
        if (strengthDays === 0) expect(sessions.some(isStation), name).toBe(false);
        else expect(sessions.some(isStation), `${level} ${name}`).toBe(true);
      }
    }
  }, 240_000);

  it('Kombi ab Aufbau; Einsteiger in der Basis ohne Kombi, Fortgeschrittene schon in der Basis', () => {
    const race = addDays(weeks(18), 5);
    const beginner = planOf(hyroxRunner('beginner'), race).sessions;
    expect(beginner.filter((s) => isCombo(s) && s.training_phase === 'base')).toEqual([]);
    expect(beginner.some((s) => isCombo(s) && s.training_phase === 'build')).toBe(true);
    const advanced = planOf(hyroxRunner('advanced', { schedule: generousFive }), race).sessions;
    expect(advanced.some((s) => isCombo(s) && s.training_phase === 'base')).toBe(true);
    for (const s of advanced.filter(isCombo)) {
      expect(s.workout_type).toBe('hyrox_combo');
      expect(stepsFitWorkoutType('hyrox_combo', s.workout_steps ?? [])).toBe(true);
      expect(workoutStepsSchema.safeParse(s.workout_steps).success).toBe(true);
    }
  });

  it('Stations-Mengen der Kombi steigen höchstens 10 % je Belastungswoche', () => {
    for (const level of ['beginner', 'advanced', 'competitive'] as const) {
      let previous = hyroxComboFraction(level, 1);
      for (let w = 2; w <= 30; w += 1) {
        const next = hyroxComboFraction(level, w);
        expect(next).toBeGreaterThanOrEqual(previous);
        expect(next).toBeLessThanOrEqual(previous * 1.1 + 1e-9);
        expect(next).toBeLessThanOrEqual(HYROX_PLAN.combo.maxFraction);
        previous = next;
      }
    }
  });

  it('Simulation: höchstens einmal, in der Spitze, nie in den letzten 10 Tagen – mit langen Tagen genau einmal', () => {
    const long = fixed(
      [1, 'endurance', 90],
      [3, 'endurance', 90],
      [4, 'strength_gym', 60],
      [6, 'endurance', 90],
      [7, 'endurance', 120],
    );
    for (const raceOffset of [0, 3, 6]) {
      const race = addDays(weeks(16), raceOffset);
      const { sessions } = planOf(hyroxRunner('competitive', { schedule: long }), race);
      const sims = sessions.filter((s) => s.name_de === HYROX_TEXTS_DE.combo.simulationName);
      // Renntag Montag: die einzige Belastungswoche der Spitze endet 8 Tage vor dem Rennen → keine Simulation.
      expect(sims.length, `Rennen +${raceOffset}`).toBe(raceOffset === 0 ? 0 : 1);
      for (const sim of sims) {
        // Am Tag des langen Laufs, kontrolliert (zählt nicht ins 80/20-Budget), keine zweite Kombi in der Woche.
        expect(isoWeekday(sim.scheduled_on)).toBe(7);
        expect(sim.effort_target).toBe(5);
        expect(hardSeconds(sim.workout_steps ?? [], false)).toBe(0);
        expect(sim.training_phase).toBe('peak');
        expect(daysBetween(sim.scheduled_on, race)).toBeGreaterThanOrEqual(10);
        const stations = (sim.workout_steps ?? []).filter((st) => st.kind === 'station');
        expect(stations.map((st) => st.station)).toEqual([...HYROX_STATIONS]);
      }
    }
  });

  it('Deload: Kraft-Sätze halbiert, RPE −2, keine Kombi in der Erholungswoche', () => {
    const { sessions } = planOf(hyroxRunner('advanced', { schedule: generousFive }), weeks(20));
    const recovery = sessions.filter(
      (s) => s.is_deload && ['base', 'build', 'peak'].includes(s.training_phase ?? ''),
    );
    expect(recovery.length).toBeGreaterThan(0);
    expect(recovery.some(isCombo)).toBe(false);
    const deloadStation = sessions.find((s) => isStation(s) && s.is_deload);
    const loadStation = [...sessions]
      .filter(
        (s) => isStation(s) && !s.is_deload && s.scheduled_on < (deloadStation?.scheduled_on ?? ''),
      )
      .at(-1);
    expect(loadStation && deloadStation).toBeTruthy();
    if (loadStation && deloadStation) {
      for (const e of deloadStation.exercises) {
        const ref = loadStation.exercises.find((x) => x.exercise_id === e.exercise_id);
        if (!ref) continue;
        expect(e.sets).toBeLessThanOrEqual(Math.ceil(ref.sets / 2));
        expect(e.rpe_target).toBeLessThanOrEqual(Math.max(5, ref.rpe_target - 2));
      }
    }
  });
});

describe('Hyrox-Sicherheitsregeln im Plan', () => {
  const race = addDays(weeks(18), 5);

  it('Arzt-Hinweis: keine harte Kombi, stattdessen lockere Technik-Kombi (Art easy)', () => {
    const inputs = hyroxRunner('advanced', {
      schedule: generousFive,
      healthScreening: { flags: ['medical_clearance_recommended', 'conservative_plan'] },
    });
    const { plan, sessions } = planOf(inputs, race);
    expect(isCompetitionPlanWithinLimits(plan)).toBe(true);
    expect(sessions.some((s) => s.workout_type === 'hyrox_combo')).toBe(false);
    const technique = sessions.filter(isCombo);
    expect(technique.length).toBeGreaterThan(0);
    for (const s of technique) {
      expect(s.workout_type).toBe('easy');
      expect((s.workout_steps ?? []).every((st) => st.effort <= 4)).toBe(true);
      expect(isHardSession(s.workout_type, s.workout_steps)).toBe(false);
    }
    expectValidPlan(inputs, sessions, race, 'Arzt-Hinweis');
  });

  it('ab 65 (bestätigt): keine Burpee-Weitsprünge – weder als Übung noch in der Kombi', () => {
    const inputs = hyroxRunner('beginner', { birthDate: '1958-03-01', schedule: generousFive });
    const { sessions } = fullPlan(inputs, req(race, { hyroxSeniorConfirmed: true }), MONDAY);
    expect(sessions.length).toBeGreaterThan(0);
    const ids = sessions.flatMap((s) => s.exercises.map((e) => e.exercise_id));
    expect(ids).not.toContain('burpee-weitsprung');
    const stations = sessions.flatMap((s) =>
      (s.workout_steps ?? []).filter((st) => st.kind === 'station').map((st) => st.station),
    );
    expect(stations).not.toContain('burpee_broad_jumps');
    expectValidPlan(inputs, sessions, race, 'ab 65');
  });

  it('unter 18: RPE höchstens 8 in allen Stations-Einheiten', () => {
    const inputs = hyroxRunner('competitive', { birthDate: '2010-01-01', schedule: generousFive });
    const { sessions } = planOf(inputs, race);
    const station = sessions.filter(isStation);
    expect(station.length).toBeGreaterThan(0);
    for (const s of station)
      for (const e of s.exercises) expect(e.rpe_target).toBeLessThanOrEqual(8);
    expectValidPlan(inputs, sessions, race, 'unter 18');
  });
});

describe('Stations-Einheit und Ersatz-Kette', () => {
  const gym = equipmentProfile('gym', []);
  const nothing = equipmentProfile('home', []);
  const base = {
    library: library.exercises,
    excludedCautionTags: [] as const,
    level: 'advanced' as const,
    phase: 'peak' as const,
    cautious: false,
    rpeMax: 9,
    minutes: 90,
  };

  it('Studio: Spezialgerät unbekannt → Ersatz mit Hinweis; Rudergerät ist die Station selbst', () => {
    const session = hyroxStationSession({ ...base, available: gym.available });
    const ids = session.exercises.map((e) => e.exercise_id);
    expect(ids).toContain('hyrox-rudergeraet');
    expect(ids).toContain('burpee-weitsprung');
    expect(ids).not.toContain('hyrox-schlitten-schieben');
    expect(session.replaced).toContain('sled_push');
    expect(session.exercises.length).toBeLessThanOrEqual(8);
    expect(new Set(ids).size).toBe(ids.length);
    const notices = hyroxStationNotices({ focus: 'hyrox_stations', exercises: session.exercises });
    expect(notices).toContain('sled_replaced');
    expect(HYROX_TEXTS_DE.replacedNotice.sled).toBe('Ohne Schlitten – wir ersetzen die Station.');
  });

  it('ohne Geräte: nur Körpergewicht-Übungen, Einheit entsteht trotzdem', () => {
    const session = hyroxStationSession({ ...base, available: nothing.available });
    expect(session.exercises.length).toBeGreaterThanOrEqual(4);
    for (const e of session.exercises) {
      expect(library.exercises.get(e.exercise_id)?.equipment_ids, e.exercise_id).toEqual([]);
    }
  });

  it('nur freigegebene Übungen (Supabase-Modus ohne die Entwürfe): Kette endet im Startbestand', () => {
    const published = new Map([...library.exercises].filter(([, e]) => e.status === 'published'));
    for (const available of [gym.available, nothing.available]) {
      const session = hyroxStationSession({ ...base, library: published, available });
      expect(session.exercises.length).toBeGreaterThanOrEqual(4);
      for (const e of session.exercises) {
        expect(published.has(e.exercise_id)).toBe(true);
      }
    }
  });

  it('Dosierung: doppelte Progression (Wdh.-Bereich), Zeit-Übungen mit Dauer, RPE-Deckel, Einsteiger 2 Sätze in der Basis', () => {
    const session = hyroxStationSession({
      ...base,
      level: 'beginner',
      phase: 'base',
      rpeMax: 6,
      available: gym.available,
    });
    for (const e of session.exercises) {
      expect(e.sets).toBe(2);
      expect(e.rpe_target).toBeLessThanOrEqual(6);
      const ex = library.exercises.get(e.exercise_id);
      if (ex?.load_type === 'time' || ex?.movement_pattern === 'carry') {
        expect(e.duration_s).not.toBeNull();
        expect(e.reps_min).toBeNull();
      } else {
        expect(e.reps_min).toBeLessThan(e.reps_max as number);
      }
    }
  });

  it('kurzer Tag (20 min): gekürzt, aber nie leer', () => {
    const session = hyroxStationSession({ ...base, minutes: 20, available: gym.available });
    expect(session.shortened).toBe(true);
    expect(session.exercises.length).toBeGreaterThan(0);
  });

  it('Ausschluss Sprünge (ab 65/vorsichtig) entfernt die Burpee-Station', () => {
    expect(hyroxExcludedStations(['high_impact'])).toEqual(['burpee_broad_jumps']);
    expect(hyroxExcludedStations(['overhead'])).toEqual([]);
    const session = hyroxStationSession({
      ...base,
      excludedCautionTags: ['high_impact', 'high_skill'],
      available: gym.available,
    });
    expect(session.exercises.map((e) => e.exercise_id)).not.toContain('burpee-weitsprung');
    expect(session.exercises.map((e) => e.exercise_id)).not.toContain('burpee-ohne-sprung');
  });

  it('Reise-Modus: Station als Körpergewicht-Zirkel', () => {
    const ctx = {
      library: library.exercises,
      available: new Set<string>(),
      excludedCautionTags: [],
    };
    expect(hyroxStationTravelName('wall_balls', ctx)).toBe('Kniebeuge mit Körpergewicht');
    expect(hyroxStationExercise('ski_erg', ctx)?.replaced).toBe(true);
    for (const s of HYROX_STATIONS) expect(hyroxStationTravelName(s, ctx), s).not.toBeNull();
  });
});

describe('Kombi-Einheit (hyroxComboWorkout)', () => {
  const options = {
    level: 'advanced' as const,
    limits: GENERAL,
    easyEffort: 4,
    hardBudgetS: 3600,
    loadWeek: 1,
    stationOffset: 0,
    excludedCautionTags: [] as const,
  };

  it('Schritte ergeben genau die Minuten, harte Art, Station-Schritte mit Station', () => {
    for (const minutes of [25, 30, 45, 60, 90]) {
      const w = hyroxComboWorkout({ ...options, minutes });
      expect(w, String(minutes)).not.toBeNull();
      if (!w) continue;
      expect(w.type).toBe('hyrox_combo');
      expect(w.steps.reduce((sum, st) => sum + st.seconds, 0)).toBe(minutes * 60);
      expect(workoutStepsSchema.safeParse(w.steps).success).toBe(true);
      const split = hyroxComboSplit(w.steps);
      expect(split.runS + split.stationS).toBe(minutes * 60);
      expect(split.stationS).toBeGreaterThan(0);
    }
  });

  it('zu kurz, nicht erlaubt oder Budget zu klein → null', () => {
    expect(hyroxComboWorkout({ ...options, minutes: 20 })).toBeNull();
    expect(
      hyroxComboWorkout({ ...options, minutes: 60, limits: { ...GENERAL, allowed: false } }),
    ).toBeNull();
    expect(hyroxComboWorkout({ ...options, minutes: 60, hardBudgetS: 60 })).toBeNull();
  });

  it('80/20: harte Zeit nie über dem Budget (Einsteiger zählen nur harte Abschnitte)', () => {
    for (const budgetMin of [8, 12, 20, 30]) {
      const w = hyroxComboWorkout({
        ...options,
        level: 'beginner',
        limits: STRICT,
        minutes: 60,
        hardBudgetS: budgetMin * 60,
      });
      if (w) expect(hardSeconds(w.steps, true)).toBeLessThanOrEqual(budgetMin * 60);
    }
    expect(weeklyHardBudgetSeconds(150)).toBe(1800);
  });

  it('Simulation: alle 8 Stationen in Rennreihenfolge; zu kurz → normale Kombi', () => {
    const sim = hyroxComboWorkout({ ...options, minutes: 75, simulation: true });
    expect(sim?.name_de).toBe(HYROX_TEXTS_DE.combo.simulationName);
    expect(
      sim?.steps.filter((st) => st.kind === 'station').map((st) => st.station as HyroxStation),
    ).toEqual([...HYROX_STATIONS]);
    const short = hyroxComboWorkout({ ...options, minutes: 30, simulation: true });
    expect(short?.name_de).toBe(HYROX_TEXTS_DE.combo.name);
  });

  it('Technik-Kombi: locker (≤ 4), Art easy, passt zu den Regeln für lockere Arten', () => {
    const w = hyroxTechniqueCombo({
      minutes: 40,
      level: 'beginner',
      easyEffort: 3,
      stationOffset: 2,
      excludedCautionTags: [],
    });
    expect(w?.type).toBe('easy');
    expect(w && stepsFitWorkoutType('easy', w.steps)).toBe(true);
    expect(w?.steps.every((st) => st.effort <= 3)).toBe(true);
    expect(w?.steps.reduce((sum, st) => sum + st.seconds, 0)).toBe(40 * 60);
    expect(
      hyroxTechniqueCombo({
        minutes: 15,
        level: 'beginner',
        easyEffort: 3,
        stationOffset: 0,
        excludedCautionTags: [],
      }),
    ).toBeNull();
  });

  it('Timer: Ansage nennt Station und Menge', () => {
    const w = hyroxComboWorkout({ ...options, minutes: 45 });
    const steps = w?.steps ?? [];
    const index = steps.findIndex((st) => st.kind === 'station');
    const start = steps.slice(0, index).reduce((sum, st) => sum + st.seconds, 0);
    const cue = intervalCue(steps, start + 1, index - 1);
    const station = steps[index];
    expect(cue.text).toBe(
      `${hyroxStationCue(station?.station as HyroxStation, station?.seconds ?? 0)}.`,
    );
    expect(cue.text).toMatch(/^Station: \d+ /);
  });
});

describe('Schon-Modus und Belastungs-Regionen', () => {
  it('Kombi im Schon-Modus → nur Lauf-Teil (Stationen entfallen), Hinweis', () => {
    const w = hyroxComboWorkout({
      minutes: 45,
      level: 'advanced',
      limits: GENERAL,
      easyEffort: 4,
      hardBudgetS: 3600,
      loadWeek: 3,
      stationOffset: 1,
      excludedCautionTags: [],
    });
    const session = {
      kind: 'endurance' as const,
      estimated_minutes: 45,
      effort_target: 7,
      workout_steps: w?.steps ?? [],
    };
    const result = applyModesToEndurance(session, {
      pain: {
        regions: [{ region: 'wrist', intensity: 'mild' }],
        conservative: false,
        advice: [],
      } as never,
    });
    expect(result.notices).toEqual(['pain_combo_run_only']);
    expect(
      (result.session.workout_steps as readonly { kind: string }[]).some(
        (st) => st.kind === 'station',
      ),
    ).toBe(false);
    expect(result.session.estimated_minutes).toBeLessThan(45);
    expect(hyroxComboRunOnly(w?.steps ?? [], { easy: true }).every((st) => st.effort <= 4)).toBe(
      true,
    );
    // Ohne Modus unverändert.
    expect(applyModesToEndurance(session, {}).session).toBe(session);
  });

  it('PAIN_REGION_LOAD: Wall Balls Knie/Schulter, Burpees Handgelenk/Knie/Sprunggelenk, Farmer’s Carry Handgelenk/unterer Rücken', () => {
    const regions = (id: string) => {
      const e = library.exercises.get(id);
      if (!e) throw new Error(id);
      return regionsLoadedBy(e);
    };
    expect(regions('wall-balls')).toEqual(expect.arrayContaining(['knee', 'shoulder']));
    expect(regions('burpee-weitsprung')).toEqual(
      expect.arrayContaining(['wrist', 'knee', 'ankle']),
    );
    expect(regions('farmers-carry-kurzhantel')).toEqual(
      expect.arrayContaining(['wrist', 'lower_back']),
    );
  });
});

describe('Ergebnis Hyrox-Rennen', () => {
  const base = {
    id: '00000000-0000-4000-8000-000000000011',
    writeId: '00000000-0000-4000-8000-000000000012',
    performedOn: '2026-10-25',
    today: '2026-10-27',
    now: '2026-10-27T12:00:00+01:00',
    notes: '',
    sessionRpe: 8,
  };

  it('Zeiten lesen und schreiben', () => {
    expect(parseRaceTime('1:23:45')).toBe(5025);
    expect(parseRaceTime('4:05')).toBe(245);
    expect(parseRaceTime('59')).toBe(59);
    expect(parseRaceTime('1:60')).toBeNull();
    expect(parseRaceTime('abc')).toBeNull();
    expect(formatRaceTime(5025)).toBe('1:23:45');
    expect(formatRaceTime(245)).toBe('4:05');
  });

  it('Gesamtzeit + optionale Teilzeiten (≤ 17) → gültiger freier Eintrag „Hyrox-Rennen“', () => {
    const splits = hyroxSplitsFromInput({ run_1: '4:30', ski_erg: '4:50', roxzone: '6:00' });
    expect(splits.ok).toBe(true);
    if (!splits.ok) return;
    const result = hyroxResultLogFromInput({ ...base, totalS: 5025, splits: splits.splits });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.name_de).toBe('Hyrox-Rennen');
      expect(result.payload.cardio?.duration_s).toBe(5025);
      expect(result.payload.cardio?.modality).toBe('run');
      expect(result.payload.hyrox_splits).toHaveLength(3);
    }
    const all = Object.fromEntries(HYROX_SPLIT_SEGMENTS.map((s) => [s, '4:00']));
    const full = hyroxSplitsFromInput(all);
    expect(full.ok && full.splits.length).toBe(17);
    const none = hyroxResultLogFromInput({ ...base, totalS: 4000, splits: [] });
    expect(none.ok && none.payload.hyrox_splits).toEqual([]);
  });

  it('Teilzeiten über der Gesamtzeit, ungültige Zeiten, Zukunft → Fehler', () => {
    expect(
      hyroxResultLogFromInput({
        ...base,
        totalS: 600,
        splits: [{ segment: 'run_1', duration_s: 700 }],
      }),
    ).toEqual({ ok: false, errors: ['splits_exceed_total'] });
    expect(hyroxResultLogFromInput({ ...base, totalS: null, splits: [] })).toEqual({
      ok: false,
      errors: ['total_invalid'],
    });
    expect(hyroxSplitsFromInput({ run_2: '2:61' })).toEqual({ ok: false, invalid: ['run_2'] });
    const future = hyroxResultLogFromInput({
      ...base,
      performedOn: '2026-10-28',
      totalS: 4000,
      splits: [],
    });
    expect(future.ok).toBe(false);
  });
});

describe('Pläne ohne Hyrox bleiben unverändert', () => {
  it('10-km-Plan hat keine Stations- oder Kombi-Einheiten', () => {
    const { sessions } = fullPlan(
      runner('10k', 'advanced', { schedule: fourDays }),
      { competition: { name: 'Lauf', discipline: '10k', raceDate: weeks(16) } },
      MONDAY,
    );
    expect(sessions.some(isStation)).toBe(false);
    expect(sessions.some(isCombo)).toBe(false);
    expect(isoWeekday(MONDAY)).toBe(1);
  });
});
