/**
 * Rad und Triathlon Sprint/Olympisch (docs/PLAN-PHASE-10.md Abschnitt 9, Etappe WP5; W-G2): Tabellen, Ampel, vorsichtige
 * Gruppen, Mittel-/Langdistanz ohne Plan, Koppeltraining und Minuten je Disziplin, Bausteine Rad/Schwimmen, Speichern
 * und Ernährung. Erwartungen bewusst NICHT aus constants.ts (feste Zahlen aus Plan 9 und den Präzisierungen WP5).
 */
import { describe, expect, it } from 'vitest';

import { addDays, startOfIsoWeek } from '../dates';
import { expectedRaceMinutes, raceDaySession } from '../nutrition/competition';
import { applyCurrentEnduranceRules } from './apply-safety';
import {
  type CompetitionFeasibility,
  competitionFeasibility,
  type CompetitionRequest,
  cyclingClass,
  minimumLeadWeeks,
  minorPlanAllowed,
  requiredLongRun,
  requiredPeak,
} from './competition';
import {
  competitionDistanceM,
  storedCompetitionFromRow,
  toSaveCompetitionPayload,
} from './competition-record';
import { checkSaveCompetition, serverMinimumLeadWeeks } from './competition-rules';
import { type CompetitionDiscipline, competitionPlanOffer } from './competition-schema';
import { competitionPaceProfile } from './competition-view';
import { fixed, fullPlan, library, runner } from './competition-test-helpers';
import {
  brickWorkout,
  easyWorkout,
  structuredWorkout,
  techniqueWorkout,
  weekWorkouts,
} from './endurance-workouts';
import { generateCompetitionPlan } from './generate';
import { hardSeconds, type HardWorkoutLimits, isHardWorkoutType } from './intensity';
import {
  brickSplit,
  brickStepSports,
  MULTISPORT_TEXTS_DE,
  sessionSafetyNotices,
  sportMinutes,
  triathlonWeekSports,
  workoutModalityFits,
} from './multisport';
import type { GeneratedSession } from './schedule';
import { MONDAY } from './test-library';

// Feste Tabellen (Plan 9, Präzisierungen WP5) – bewusst nicht aus constants.ts.
const LEAD_TRI = {
  triathlon_sprint: { beginner: 19, advanced: 11, competitive: 7 },
  triathlon_olympic: { beginner: 26, advanced: 18, competitive: 16 },
} as const;
const CYCLING = [
  { km: 60, lead: { beginner: 14, advanced: 6, competitive: 6 }, week: 120, long: 60 },
  { km: 120, lead: { beginner: 20, advanced: 12, competitive: 8 }, week: 180, long: 90 },
  { km: 200, lead: { beginner: 25, advanced: 17, competitive: 14 }, week: 270, long: 135 },
  { km: 300, lead: { beginner: 30, advanced: 22, competitive: 18 }, week: 360, long: 180 },
] as const;
const GENERAL: HardWorkoutLimits = {
  allowed: true,
  effortCap: 8,
  perWeek: 2,
  countWorkOnly: false,
};

type Level = 'beginner' | 'advanced' | 'competitive';

/** Großzügige Woche: 4 Ausdauer-Tage, Sonntag lang (die Kette wird geprüft, nicht der Wunsch). */
const generous = fixed(
  [2, 'endurance', 120],
  [4, 'endurance', 120],
  [6, 'endurance', 120],
  [7, 'endurance', 240],
);

function req(
  discipline: CompetitionDiscipline,
  raceDate: string,
  distanceKm: number | null = null,
): CompetitionRequest {
  return {
    competition: {
      name: 'Wettkampf',
      discipline,
      raceDate,
      ...(distanceKm === null ? {} : { distanceKm }),
    },
  };
}

function feasibility(
  discipline: CompetitionDiscipline,
  raceDate: string,
  options: {
    level?: Level;
    distanceKm?: number | null;
    today?: string;
    overrides?: Parameters<typeof runner>[2];
  } = {},
): CompetitionFeasibility {
  const result = competitionFeasibility(
    runner(discipline, options.level ?? 'beginner', { schedule: generous, ...options.overrides }),
    req(discipline, raceDate, options.distanceKm ?? null),
    options.today ?? MONDAY,
  );
  if (!result.ok) throw new Error(result.error);
  return result.feasibility;
}

const weeks = (n: number, today = MONDAY) => addDays(today, n * 7);

describe('Tabellen Rad und Triathlon (Plan 9)', () => {
  it('Mindestvorlauf Triathlon je Level; vorsichtige Gruppe = Einsteiger-Spalte', () => {
    for (const d of ['triathlon_sprint', 'triathlon_olympic'] as const) {
      for (const level of ['beginner', 'advanced', 'competitive'] as const) {
        expect(minimumLeadWeeks(d, level)).toBe(LEAD_TRI[d][level]);
      }
    }
    const flagged = feasibility('triathlon_sprint', weeks(18), {
      level: 'competitive',
      overrides: { healthScreening: { flags: ['injury'] } },
    });
    expect(flagged.minimumLeadWeeks).toBe(LEAD_TRI.triathlon_sprint.beginner);
  });

  it('Rad: Distanzklassen an den Grenzen (60/61, 120/121, 200/201, 300 km), ohne Distanz die längste', () => {
    const cases: [number, number][] = [
      [20, 0],
      [60, 0],
      [61, 1],
      [120, 1],
      [121, 2],
      [200, 2],
      [201, 3],
      [300, 3],
    ];
    for (const [km, index] of cases) {
      const c = CYCLING[index] as (typeof CYCLING)[number];
      expect(cyclingClass(km).maxKm, `${km} km`).toBe(c.km);
      for (const level of ['beginner', 'advanced', 'competitive'] as const) {
        expect(minimumLeadWeeks('cycling', level, km)).toBe(c.lead[level]);
      }
      expect(requiredPeak('cycling', 'finish', km)).toEqual({
        weeklyMinutes: c.week,
        longRunMinutes: c.long,
      });
      expect(requiredLongRun('cycling', 'finish', km)).toBe(c.long);
      expect(serverMinimumLeadWeeks('cycling', km)).toBe(c.lead.competitive);
    }
    expect(cyclingClass(null).maxKm).toBe(300);
  });

  it('Triathlon: Spitzenumfang Sprint 180 / Olympisch 300 min (Summe aller Disziplinen), lange Ausfahrt 75 / 120 min; keine Zielzeit-Tabelle', () => {
    expect(requiredPeak('triathlon_sprint')).toEqual({ weeklyMinutes: 180, longRunMinutes: 75 });
    expect(requiredPeak('triathlon_olympic')).toEqual({ weeklyMinutes: 300, longRunMinutes: 120 });
    expect(requiredPeak('triathlon_olympic', 'time')).toEqual(requiredPeak('triathlon_olympic'));
    expect(requiredPeak('cycling', 'time', 100)).toEqual(requiredPeak('cycling', 'finish', 100));
  });

  it('Tabelle passt zur Kette: Einsteiger erreichen „Ankommen“ genau zum Mindestvorlauf (jeder Start- und Renn-Wochentag)', () => {
    const targets: [CompetitionDiscipline, number | null, number][] = [
      ['triathlon_sprint', null, LEAD_TRI.triathlon_sprint.beginner],
      ['triathlon_olympic', null, LEAD_TRI.triathlon_olympic.beginner],
      ...CYCLING.map(
        (c) => ['cycling', c.km, c.lead.beginner] as [CompetitionDiscipline, number, number],
      ),
    ];
    for (const [d, km, lead] of targets) {
      for (let start = 0; start < 7; start += 1) {
        for (let race = 0; race < 7; race += 1) {
          const today = addDays(MONDAY, start);
          const f = feasibility(d, addDays(weeks(lead, today), race), { distanceKm: km, today });
          expect(['ok', 'tight'], `${d} ${km ?? ''} ${today} +${race}`).toContain(f.status);
        }
      }
      // 1 Tag unter dem Mindestvorlauf: zu kurz, nie gestaucht.
      const below = feasibility(d, addDays(weeks(lead), -1), { distanceKm: km });
      expect(below.status).toBe('too_short');
      expect(below.reasons).toContain('lead_time_below_minimum');
    }
  }, 120_000);
});

describe('Ampel Rad und Triathlon', () => {
  it('Triathlon braucht 3 Ausdauer-Tage: mit 2 Tagen zu kurz, kein späteres Datum, kein Plan', () => {
    const two = fixed([3, 'endurance', 90], [7, 'endurance', 180]);
    const f = feasibility('triathlon_sprint', weeks(30), {
      level: 'advanced',
      overrides: { schedule: two },
    });
    expect(f.status).toBe('too_short');
    expect(f.reasons).toEqual(['triathlon_days_too_few']);
    expect(f.suggestions.some((s) => s.kind === 'later_date')).toBe(false);
    expect(f.suggestions.at(-1)).toEqual({ kind: 'without_competition' });
    const plan = generateCompetitionPlan(
      runner('triathlon_sprint', 'advanced', { schedule: two }),
      library,
      MONDAY,
      req('triathlon_sprint', weeks(30)),
    );
    expect(plan).toMatchObject({ ok: false, error: 'competition_not_feasible' });
    // Ein einziger Tag (Grenzfall 1 vs. 7 Tage): ebenso.
    const one = feasibility('triathlon_olympic', weeks(40), {
      overrides: { schedule: fixed([7, 'endurance', 240]) },
    });
    expect(one.reasons).toContain('triathlon_days_too_few');
  });

  it('Triathlon: Hinweis Freiwasser; Einsteiger Olympisch bzw. Rad über 120 km mit eigenem Hinweis', () => {
    expect(feasibility('triathlon_sprint', weeks(26)).notices).toContain('open_water_safety');
    expect(feasibility('triathlon_olympic', weeks(30)).notices).toEqual([
      'open_water_safety',
      'beginner_long_event',
    ]);
    expect(feasibility('cycling', weeks(30), { distanceKm: 121 }).notices).toEqual([
      'beginner_long_event',
    ]);
    expect(feasibility('cycling', weeks(30), { distanceKm: 120 }).notices).toEqual([]);
    expect(
      feasibility('cycling', weeks(30), { distanceKm: 200, level: 'advanced' }).notices,
    ).toEqual([]);
  });

  it('Vorschlag „kürzere Distanz“ bleibt in der Sportart (Olympisch → Sprint, Rad → kleinere Klasse)', () => {
    const olympic = feasibility('triathlon_olympic', weeks(20));
    expect(olympic.status).toBe('too_short');
    expect(olympic.suggestions).toContainEqual({
      kind: 'shorter_distance',
      discipline: 'triathlon_sprint',
    });
    const ride = feasibility('cycling', weeks(21), { distanceKm: 250 });
    expect(ride.status).toBe('too_short');
    expect(ride.suggestions).toContainEqual({
      kind: 'shorter_distance',
      discipline: 'cycling',
      distanceKm: 120,
    });
    expect(feasibility('triathlon_sprint', weeks(10)).suggestions.map((s) => s.kind)).not.toContain(
      'shorter_distance',
    );
  });

  it('Mittel-/Langdistanz und Schwimm-Wettkampf: kein Plan (ungültige Eingabe, Hinweis Trainer/Verein)', () => {
    for (const d of ['triathlon_middle', 'triathlon_long', 'swimming'] as const) {
      expect(competitionPlanOffer(d)).toBe('coach');
      const inputs = runner('triathlon_sprint', 'competitive', {
        schedule: generous,
        discipline: d,
      });
      const result = competitionFeasibility(
        inputs,
        { competition: { name: 'Lang', discipline: d as never, raceDate: weeks(40) } },
        MONDAY,
      );
      expect(result).toEqual({ ok: false, error: 'invalid_inputs' });
      const plan = generateCompetitionPlan(inputs, library, MONDAY, {
        competition: { name: 'Lang', discipline: d as never, raceDate: weeks(40) },
      });
      expect(plan.ok).toBe(false);
    }
  });
});

describe('Vorsichtige Gruppen (Tabelle 3.3 sinngemäß)', () => {
  it('Schwangerschaft: kein Plan; ohne Gesundheits-Check: erst nach dem Check', () => {
    const pregnant = feasibility('cycling', weeks(30), {
      distanceKm: 60,
      overrides: { healthScreening: { flags: ['pregnancy'] } },
    });
    expect(pregnant).toMatchObject({ status: 'not_available', reasons: ['pregnancy'] });
    const noCheck = feasibility('triathlon_sprint', weeks(30), {
      overrides: { healthScreening: null },
    });
    expect(noCheck.status).toBe('not_available');
    expect(noCheck.reasons).toContain('health_check_required');
  });

  it('unter 18: Triathlon nur Sprint, Rad höchstens 100 km (Vorschlag 100 km)', () => {
    const minor = { birthDate: '2009-12-01' };
    expect(minorPlanAllowed('triathlon_sprint')).toBe(true);
    expect(minorPlanAllowed('triathlon_olympic')).toBe(false);
    expect(minorPlanAllowed('cycling', 100)).toBe(true);
    expect(minorPlanAllowed('cycling', 101)).toBe(false);
    expect(minorPlanAllowed('cycling', null)).toBe(false);
    expect(minorPlanAllowed('half_marathon')).toBe(true);
    expect(minorPlanAllowed('marathon')).toBe(false);
    const olympic = feasibility('triathlon_olympic', weeks(30), { overrides: minor });
    expect(olympic).toMatchObject({ status: 'not_available', reasons: ['minor_distance_limit'] });
    expect(olympic.suggestions[0]).toEqual({
      kind: 'shorter_distance',
      discipline: 'triathlon_sprint',
    });
    const ride = feasibility('cycling', weeks(30), { distanceKm: 150, overrides: minor });
    expect(ride.status).toBe('not_available');
    expect(ride.suggestions[0]).toEqual({
      kind: 'shorter_distance',
      discipline: 'cycling',
      distanceKm: 100,
    });
    expect(
      ['ok', 'tight'].includes(
        feasibility('cycling', weeks(30), { distanceKm: 100, overrides: minor }).status,
      ),
    ).toBe(true);
  });

  it('Gesundheits-Flag / ab 65: höchstens „knapp“, nur locker, Rad nur Ergometer, kein Koppeltraining', () => {
    for (const overrides of [
      { healthScreening: { flags: ['injury' as const] } },
      { birthDate: '1955-01-01' },
    ]) {
      for (const [d, km] of [
        ['cycling', 60],
        ['triathlon_sprint', null],
      ] as const) {
        const inputs = runner(d, 'advanced', { schedule: generous, ...overrides });
        const r = req(d, weeks(40), km);
        const f = competitionFeasibility(inputs, r, MONDAY);
        if (!f.ok) throw new Error('ungültig');
        expect(f.feasibility.status).toBe('tight');
        expect(f.feasibility.notices).toContain('walk_only_plan');
        expect(f.feasibility.notices).toContain('medical_clearance');
        const { sessions } = fullPlan(inputs, r, MONDAY);
        const endurance = sessions.filter((s) => s.kind === 'endurance') as GeneratedSession[];
        expect(endurance.length).toBeGreaterThan(20);
        for (const s of endurance) {
          expect(isHardWorkoutType(s.workout_type), s.name_de).toBe(false);
          expect(s.workout_type).not.toBe('brick');
          expect(s.effort_target ?? 0).toBeLessThanOrEqual(4);
          if (s.endurance_modality === 'bike') expect(s.name_de).toMatch(/^Ergometer locker/);
          expect(s.endurance_modality).not.toBe('run');
        }
      }
    }
  }, 60_000);
});

describe('Koppeltraining, Minuten je Disziplin, Bausteine', () => {
  it('brickSplit: Lauf-Teil 30 % (10–30 min), Rad = Rest; Summe = Dauer', () => {
    expect(brickSplit(25)).toEqual({ bike: 15, run: 10 });
    expect(brickSplit(30)).toEqual({ bike: 20, run: 10 });
    expect(brickSplit(40)).toEqual({ bike: 28, run: 12 });
    expect(brickSplit(100)).toEqual({ bike: 70, run: 30 });
    expect(brickSplit(200)).toEqual({ bike: 170, run: 30 });
    for (let m = 25; m <= 240; m += 1) {
      const s = brickSplit(m);
      expect(s.bike + s.run).toBe(m);
    }
  });

  it('Koppeltraining zählt in BEIDE Disziplinen-Minuten; Summe = Ausdauer-Minuten (10-%-Regel über die Summe)', () => {
    const base = { kind: 'endurance', workout_type: null } as const;
    const week = [
      { ...base, endurance_modality: 'swim' as const, estimated_minutes: 30 },
      {
        ...base,
        endurance_modality: 'bike' as const,
        estimated_minutes: 40,
        workout_type: 'brick' as const,
      },
      { ...base, endurance_modality: 'walk' as const, estimated_minutes: 20 },
      { ...base, endurance_modality: 'bike' as const, estimated_minutes: 90 },
      { ...base, endurance_modality: 'run' as const, estimated_minutes: 25, status: 'skipped' },
      { kind: 'strength', endurance_modality: null, estimated_minutes: 60 },
    ];
    expect(sportMinutes(week)).toEqual({ swim: 30, bike: 90 + 28, run: 20 + 12 });
  });

  it('Bausteine: Koppeltraining (zwei Teile, locker), Schwimmtechnik (locker), Rad mit eigenen Texten', () => {
    const brick = brickWorkout(40, 4);
    expect(brick?.type).toBe('brick');
    expect(brick?.steps.reduce((t, st) => t + st.seconds, 0)).toBe(40 * 60);
    expect(brick?.steps.every((st) => st.effort <= 4)).toBe(true);
    expect(brick?.main_de).toContain('Teil 1: 28 Minuten');
    expect(brickStepSports(brick?.steps ?? [], 40)).toEqual(['bike', 'bike', 'run']);
    expect(brickStepSports(brickWorkout(60, 4)?.steps ?? [], 60)).toEqual([
      'bike',
      'bike',
      'run',
      'run',
    ]);
    expect(brickWorkout(24, 4)).toBeNull();
    expect(brickWorkout(25, 4)?.steps.reduce((t, st) => t + st.seconds, 0)).toBe(25 * 60);
    const technique = techniqueWorkout(30, 4);
    expect(technique?.type).toBe('technique');
    expect(technique?.steps.reduce((t, st) => t + st.seconds, 0)).toBe(30 * 60);
    expect(technique?.steps.every((st) => st.effort <= 4)).toBe(true);
    expect(techniqueWorkout(19, 4)).toBeNull();
    expect(easyWorkout('long', 120, 4, 'bike').name_de).toBe('Lange Ausfahrt');
    expect(easyWorkout('long', 60, 4, 'swim')).toMatchObject({
      type: 'easy',
      name_de: 'Lockeres Schwimmen',
    });
  });

  it('Rad hart: Sweet-Spot in zwei Abschnitten (Anstrengung 6), Budget 80/20; keine Steigerungen/Intervalle auf dem Rad', () => {
    const opts = {
      easyEffort: 4,
      limits: GENERAL,
      level: 'advanced' as const,
      discipline: 'cycling' as const,
      hardBudgetS: 30 * 60,
      sport: 'bike' as const,
    };
    const tempo = structuredWorkout('tempo', 75, opts);
    expect(tempo?.name_de).toBe('Sweet-Spot auf dem Rad');
    const work = tempo?.steps.filter((st) => st.kind === 'work') ?? [];
    expect(work).toHaveLength(2);
    expect(work.every((st) => st.effort === 6)).toBe(true);
    expect(hardSeconds(tempo?.steps ?? [], false)).toBeLessThanOrEqual(30 * 60);
    expect(tempo?.steps.reduce((t, st) => t + st.seconds, 0)).toBe(75 * 60);
    expect(structuredWorkout('strides', 75, opts)).toBeNull();
    expect(structuredWorkout('intervals', 75, opts)).toBeNull();
    expect(structuredWorkout('tempo', 75, { ...opts, hardBudgetS: 10 * 60 })).toBeNull();
    expect(structuredWorkout('race_pace', 60, opts)?.name_de).toBe('Renntempo auf dem Rad');
  });

  it('Triathlon-Woche: lange Einheit Rad, Disziplinen im Wechsel, Koppeltraining nur in Aufbau/Spitze', () => {
    const days = [2, 3, 4, 5, 6, 7].map((wd) => ({
      date: addDays(MONDAY, wd - 1),
      minutes: wd === 7 ? 120 : 45,
    }));
    const sunday = addDays(MONDAY, 6);
    const build = triathlonWeekSports(days, sunday, {
      phase: 'build',
      recoveryWeek: false,
      weekZero: false,
      brickAllowed: true,
    });
    expect(build).toEqual(['swim', 'run', 'brick', 'run', 'swim', 'bike']);
    const base = triathlonWeekSports(days, sunday, {
      phase: 'base',
      recoveryWeek: false,
      weekZero: false,
      brickAllowed: true,
    });
    expect(base).toEqual(['swim', 'run', 'bike', 'run', 'swim', 'bike']);
    for (const blocked of [
      { phase: 'build' as const, recoveryWeek: true, weekZero: false, brickAllowed: true },
      { phase: 'peak' as const, recoveryWeek: false, weekZero: true, brickAllowed: true },
      { phase: 'peak' as const, recoveryWeek: false, weekZero: false, brickAllowed: false },
      { phase: 'taper' as const, recoveryWeek: false, weekZero: false, brickAllowed: true },
    ]) {
      expect(triathlonWeekSports(days, sunday, blocked)).not.toContain('brick');
    }
    // 3 Tage: je Disziplin einer; ohne langen Tag beginnt die Woche mit Schwimmen.
    expect(triathlonWeekSports(days.slice(3), sunday, { ...blocked3 })).toEqual([
      'swim',
      'run',
      'bike',
    ]);
    expect(triathlonWeekSports(days.slice(0, 3), null, { ...blocked3 })).toEqual([
      'swim',
      'run',
      'bike',
    ]);
    // 3 Tage im Aufbau: kein Koppeltraining – der einzige Lauf-Tag bleibt ein Lauf (Koppeltraining erst ab 4 Tagen).
    expect(triathlonWeekSports(days.slice(3), sunday, { ...blocked3, phase: 'build' })).toEqual([
      'swim',
      'run',
      'bike',
    ]);
    // Rad-Tag unter 25 min: kein Koppeltraining.
    const short = days.map((d) => ({ ...d, minutes: d.date === sunday ? 120 : 24 }));
    expect(triathlonWeekSports(short, sunday, { ...blocked3, phase: 'build' })).not.toContain(
      'brick',
    );
  });

  it('Wochenbau: harte Einheit nie beim Schwimmen oder im Koppeltraining; Technik am ersten Schwimm-Tag', () => {
    const day = (wd: number, minutes: number, variant: 'easy_swim' | 'easy_bike' | 'easy_run') => ({
      date: addDays(MONDAY, wd - 1),
      minutes,
      variant,
    });
    const planned = weekWorkouts({
      phase: 'peak',
      recoveryWeek: false,
      level: 'advanced',
      limits: GENERAL,
      discipline: 'triathlon_olympic',
      easyEffort: 4,
      days: [
        day(1, 45, 'easy_swim'),
        { ...day(2, 60, 'easy_bike'), brick: true },
        day(3, 45, 'easy_swim'),
        day(4, 60, 'easy_run'),
        day(5, 45, 'easy_bike'),
        day(7, 150, 'easy_bike'),
      ],
      longRunDate: addDays(MONDAY, 6),
      blockedDates: new Set(),
      pace: null,
    });
    expect(planned.map((p) => p.type)).toEqual([
      'technique',
      'brick',
      'easy',
      'race_pace',
      'easy',
      'long',
    ]);
    expect(planned[3]?.name_de).toBe('Renntempo-Abschnitte');
    expect(planned.filter((p) => isHardWorkoutType(p.type))).toHaveLength(1);
  });

  it('Freiwasser-Hinweis bei jeder Schwimm-Einheit; Modalität passt zur Art', () => {
    expect(sessionSafetyNotices({ kind: 'endurance', endurance_modality: 'swim' })).toEqual([
      'open_water',
    ]);
    expect(sessionSafetyNotices({ kind: 'endurance', endurance_modality: 'bike' })).toEqual([]);
    expect(MULTISPORT_TEXTS_DE.openWater).toMatch(/nie allein/);
    expect(MULTISPORT_TEXTS_DE.openWater).toMatch(/Neopren/);
    expect(MULTISPORT_TEXTS_DE.openWater).toMatch(/Begleitung/);
    expect(workoutModalityFits('brick', 'bike')).toBe(true);
    expect(workoutModalityFits('brick', 'run')).toBe(false);
    expect(workoutModalityFits('technique', 'swim')).toBe(true);
    expect(workoutModalityFits('technique', 'bike')).toBe(false);
    expect(workoutModalityFits('easy', 'walk')).toBe(true);
  });

  it('apply-safety: Koppeltraining wird bei neuem Flag lockeres Ergometer; Technik bleibt gültig bei kürzerer Dauer', () => {
    const brick = brickWorkout(45, 4);
    if (!brick) throw new Error('kein Koppeltraining');
    const session = {
      kind: 'endurance' as const,
      name_de: brick.name_de,
      endurance_modality: 'bike' as const,
      effort_target: 4,
      estimated_minutes: 45,
      warmup_de: brick.warmup_de,
      cooldown_de: brick.cooldown_de,
      workout_type: 'brick' as const,
      workout_steps: brick.steps,
    };
    const rules = {
      enduranceEffortMax: 3,
      enduranceWalkOnly: true,
      pregnancyNotice: false,
      noHealthCheck: false,
      enduranceStartGroup: 'cautious' as const,
      medicalNotice: true,
    };
    const shown = applyCurrentEnduranceRules(session, rules, { previousStartGroup: 'advanced' });
    expect(shown.workout_type).toBe('easy');
    expect(shown.name_de).toBe('Ergometer locker');
    expect(shown.estimated_minutes).toBe(20);
    expect(shown.workout_steps?.reduce((t, st) => t + st.seconds, 0)).toBe(20 * 60);
    const technique = techniqueWorkout(40, 4);
    if (!technique) throw new Error('keine Technik');
    const swim = applyCurrentEnduranceRules(
      {
        ...session,
        name_de: technique.name_de,
        endurance_modality: 'swim' as const,
        estimated_minutes: 40,
        workout_type: 'technique' as const,
        workout_steps: technique.steps,
      },
      rules,
      { previousStartGroup: 'advanced' },
    );
    expect(swim.workout_type).toBe('technique');
    expect(swim.endurance_modality).toBe('swim');
    expect(swim.workout_steps?.reduce((t, st) => t + st.seconds, 0)).toBe(20 * 60);
    expect(swim.workout_steps?.every((st) => st.effort <= 3)).toBe(true);
  });
});

const blocked3 = {
  phase: 'base' as const,
  recoveryWeek: false,
  weekZero: false,
  brickAllowed: true,
};

describe('Speichern, Regeln des Servers, Ernährung', () => {
  it('Rad-Distanz im Datensatz (distance_km ↔ distance_m), ohne Pace-Profil', () => {
    const payload = toSaveCompetitionPayload({
      id: null,
      competition: {
        name: 'Radmarathon',
        discipline: 'cycling',
        distanceKm: 150,
        raceDate: weeks(30),
      },
      plan: { effectiveGoal: 'finish' },
    });
    expect(payload.distance_km).toBe(150);
    expect(competitionDistanceM('cycling', 150)).toBe(150_000);
    expect(competitionDistanceM('triathlon_olympic')).toBe(51_500);
    expect(() => competitionDistanceM('cycling')).toThrow(RangeError);
    const stored = storedCompetitionFromRow({
      ...payload,
      id: 'c1',
      status: 'planned',
      distance_m: 150_000,
      result_session_log_id: null,
      hyrox_division: null,
    });
    expect(stored?.competition).toMatchObject({ discipline: 'cycling', distanceKm: 150 });
    expect(competitionPaceProfile({ discipline: 'cycling', reference: null })).toBeNull();
    expect(
      storedCompetitionFromRow({
        ...payload,
        id: 'c1',
        status: 'planned',
        distance_m: 150_500,
        result_session_log_id: null,
        hyrox_division: null,
      }),
    ).toBeNull();
  });

  it('checkSaveCompetition: unter 18 mit Plan-Bezug, Mindestvorlauf je Klasse, Distanz ändern prüft das Datum neu', () => {
    const today = '2026-10-07';
    const ctx = (birthDate = '1990-01-01', existing: never[] = []) => ({
      today,
      birthDate,
      usesHealthData: true,
      medicalNotice: false,
      pregnancy: false,
      existing,
    });
    const payload = (discipline: CompetitionDiscipline, raceDate: string, km: number | null) =>
      toSaveCompetitionPayload({
        id: null,
        competition: {
          name: 'W',
          discipline,
          raceDate,
          ...(km === null ? {} : { distanceKm: km }),
        },
        plan: { effectiveGoal: 'finish' },
      });
    expect(
      checkSaveCompetition(payload('triathlon_olympic', '2027-03-07', null), ctx('2009-06-01')),
    ).toMatchObject({
      reason: 'not_allowed',
    });
    expect(
      checkSaveCompetition(payload('triathlon_sprint', '2027-03-07', null), ctx('2009-06-01')).ok,
    ).toBe(true);
    expect(
      checkSaveCompetition(payload('cycling', '2027-03-07', 101), ctx('2009-06-01')),
    ).toMatchObject({
      reason: 'not_allowed',
    });
    expect(checkSaveCompetition(payload('cycling', '2027-03-07', 100), ctx('2009-06-01')).ok).toBe(
      true,
    );
    // 200 km: lockerste Spalte 14 Wochen.
    expect(checkSaveCompetition(payload('cycling', addDays(today, 14 * 7), 200), ctx()).ok).toBe(
      true,
    );
    expect(
      checkSaveCompetition(payload('cycling', addDays(today, 14 * 7 - 1), 200), ctx()),
    ).toMatchObject({ reason: 'race_date' });
    const existing = {
      id: '11111111-1111-4111-8111-111111111111',
      status: 'planned' as const,
      discipline: 'cycling' as const,
      distance_m: 100_000,
      race_date: addDays(today, 9 * 7),
      reference_discipline: null,
      reference_time_s: null,
      reference_date: null,
    };
    const edit = (km: number) => ({
      ...payload('cycling', existing.race_date, km),
      id: existing.id,
    });
    expect(checkSaveCompetition(edit(100), ctx(undefined, [existing as never])).ok).toBe(true);
    expect(checkSaveCompetition(edit(200), ctx(undefined, [existing as never]))).toMatchObject({
      reason: 'race_date',
    });
  });

  it('Ernährung: erwartete Dauer Rad aus Distanz und Tempo, Triathlon geschätzt; Renn-Energie mit Rad-MET', () => {
    expect(
      expectedRaceMinutes(
        { discipline: 'cycling', distanceKm: 100, targetTimeS: null, reference: null },
        'beginner',
      ),
    ).toEqual({ minutes: 300, source: 'estimate' });
    expect(
      expectedRaceMinutes(
        { discipline: 'cycling', distanceKm: 20, targetTimeS: null, reference: null },
        'competitive',
      ),
    ).toEqual({ minutes: 43, source: 'estimate' });
    expect(
      expectedRaceMinutes(
        { discipline: 'triathlon_sprint', targetTimeS: null, reference: null },
        'advanced',
      ),
    ).toEqual({ minutes: 85, source: 'estimate' });
    expect(() =>
      expectedRaceMinutes(
        { discipline: 'cycling', targetTimeS: null, reference: null },
        'advanced',
      ),
    ).toThrow();
    const raceDay = {
      date: '2027-05-02',
      kind: 'race_day' as const,
      carbLoading: false,
      noDeficit: true,
      competition: {
        id: 'c1',
        discipline: 'cycling' as const,
        raceDate: '2027-05-02',
        expectedMinutes: 300,
        minutesSource: 'estimate' as const,
        resultSessionLogId: null,
      },
    };
    expect(raceDaySession(raceDay, '2027-05-01')?.enduranceModality).toBe('bike');
    expect(
      raceDaySession(
        { ...raceDay, competition: { ...raceDay.competition, discipline: '10k' } },
        '2027-05-01',
      )?.enduranceModality,
    ).toBe('run');
  });
});

describe('Ganzer Plan – Beispiele', () => {
  it('Triathlon Sprint (Fortgeschritten, 4 Tage): Koppeltraining in Aufbau/Spitze, Schwimmtechnik, harte Einheit nur Rad/Laufen', () => {
    const inputs = runner('triathlon_sprint', 'advanced', {
      schedule: fixed(
        [2, 'endurance', 60],
        [4, 'endurance', 60],
        [6, 'endurance', 60],
        [7, 'endurance', 150],
      ),
    });
    const { sessions } = fullPlan(inputs, req('triathlon_sprint', weeks(16)), MONDAY);
    const endurance = sessions.filter((s) => s.kind === 'endurance') as GeneratedSession[];
    const bricks = endurance.filter((s) => s.workout_type === 'brick');
    expect(bricks.length).toBeGreaterThanOrEqual(3);
    for (const b of bricks) {
      expect(['build', 'peak']).toContain(b.training_phase);
      expect(b.is_deload).toBe(false);
      expect(b.endurance_modality).toBe('bike');
      expect(b.name_de).toBe('Koppeltraining Rad → Lauf');
    }
    expect(endurance.some((s) => s.workout_type === 'technique')).toBe(true);
    for (const s of endurance.filter((x) => isHardWorkoutType(x.workout_type))) {
      expect(['bike', 'run']).toContain(s.endurance_modality);
    }
    const byWeek = new Map<string, GeneratedSession[]>();
    for (const s of endurance) {
      const w = startOfIsoWeek(s.scheduled_on);
      byWeek.set(w, [...(byWeek.get(w) ?? []), s]);
    }
    for (const [w, list] of byWeek) {
      if (list.length < 3 || list.some((s) => s.training_phase === 'recovery')) continue;
      const m = sportMinutes(list);
      expect(m.swim > 0 && m.bike > 0 && m.run > 0, w).toBe(true);
    }
  });
});
