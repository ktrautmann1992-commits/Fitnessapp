/**
 * Engine-Version 2 (docs/PLAN-PHASE-3-ERWEITERUNG.md Abschnitt 6): Art je Einheit, Ort je Tag, Kürzen je Termin,
 * Ausdauer nach festen Regeln. Erwartungen werden UNABHÄNGIG aus den Eingaben hergeleitet (feste Zahlen der
 * Tabellen 5.5/5.6), nicht aus engine-eigenen Zwischenwerten.
 */
import { describe, expect, it } from 'vitest';

import { addDays, isoWeekday, startOfIsoWeek } from '../dates';
import { HEALTH_FLAGS } from '../health-screening';
import { adaptTemplate } from './adapt';
import { equipmentProfile } from './equipment-profile';
import { generatedPlanSchema, generateTrainingPlan, type GeneratedPlan } from './generate';
import { planSafetyRules } from './safety';
import { dosageForWeek, type GeneratedSession } from './schedule';
import { FULL_HOME, MONDAY, person, repoLibrary } from './test-library';

const library = repoLibrary();
type Kind = 'strength_gym' | 'strength_home' | 'endurance';
const fixed = (...days: [number, Kind, number][]) => ({
  mode: 'fixed' as const,
  slots: days.map(([weekday, kind, minutes]) => ({ weekday, kind, minutes })),
});

function plan(overrides: Parameters<typeof person>[0] = {}, today = MONDAY): GeneratedPlan {
  const result = generateTrainingPlan(person(overrides), library, today);
  if (!result.ok) throw new Error(result.error);
  return result.plan;
}

const endurance = (p: GeneratedPlan) => p.sessions.filter((s) => s.kind === 'endurance');
const weekSum = (sessions: readonly GeneratedSession[], week: number) =>
  sessions.filter((s) => s.week_no === week).reduce((sum, s) => sum + s.estimated_minutes, 0);

/** Prüft die 10-%-Regel unabhängig: Bezug = letzte Belastungswoche, Woche 0/Erholung nie Bezug, Deload ≤ 60 %. */
function tenPercentViolations(p: GeneratedPlan, start: number): string[] {
  const runs = endurance(p);
  const errors: string[] = [];
  let reference = 0;
  for (let week = 0; week <= 6; week += 1) {
    const inWeek = runs.filter((s) => s.week_no === week);
    if (inWeek.length === 0) continue;
    const sum = weekSum(runs, week);
    if (week === 0) {
      if (sum > start) errors.push(`Woche 0: ${sum} > Start ${start}`);
      continue;
    }
    if (inWeek.every((s) => s.is_deload)) {
      if (sum > Math.floor(reference * 0.6))
        errors.push(`Erholung: ${sum} > 60 % von ${reference}`);
      continue;
    }
    const limit = reference > 0 ? Math.floor((reference * 110) / 100) : start;
    if (sum > limit) errors.push(`Woche ${week}: ${sum} > ${limit}`);
    reference = sum;
  }
  return errors;
}

describe('nur Ausdauer (Laufen)', () => {
  const p = plan({
    goalType: 'endurance',
    discipline: '10k',
    experienceLevel: 'advanced',
    schedule: fixed([2, 'endurance', 45], [4, 'endurance', 45], [6, 'endurance', 60]),
  });

  it('Plan ohne Vorlage, keine Übungen, Güte exact', () => {
    expect(p.template_id).toBeNull();
    expect(p.template_title_de).toBeNull();
    expect(p.template_version).toBeNull();
    expect(p.match_quality).toBe('exact');
    expect(p.sessions.every((s) => s.kind === 'endurance' && s.exercises.length === 0)).toBe(true);
    expect(p.sessions.every((s) => s.endurance_modality === 'run' && s.focus === null)).toBe(true);
    expect(generatedPlanSchema.safeParse(p).success).toBe(true);
    expect(p.notes).toEqual(
      expect.arrayContaining(['endurance_volume_ramped', 'endurance_basic_only']),
    );
    expect(p.notes).not.toContain('goal_endurance_not_yet');
  });

  it('Startumfang Fortgeschritten 120 min (nicht der Wunsch 150), +10 % je Woche, Erholung 60 %', () => {
    expect(weekSum(p.sessions, 1)).toBeLessThanOrEqual(120);
    expect(tenPercentViolations(p, 120)).toEqual([]);
    const lastLoad = weekSum(p.sessions, p.load_weeks);
    expect(weekSum(p.sessions, p.load_weeks + 1)).toBeLessThanOrEqual(Math.floor(lastLoad * 0.6));
    expect(Math.max(...p.sessions.map((s) => s.estimated_minutes))).toBeLessThanOrEqual(90);
  });

  it('Anstrengung locker: Einstieg/Erholung 3, sonst 4', () => {
    expect(
      p.sessions.filter((s) => s.is_intro_week || s.is_deload).every((s) => s.effort_target === 3),
    ).toBe(true);
    expect(
      p.sessions
        .filter((s) => !s.is_intro_week && !s.is_deload)
        .every((s) => s.effort_target === 4),
    ).toBe(true);
  });
});

describe('nur Kraft: Regression zur Engine-Version 1', () => {
  it('gleiche Einheiten wie bisher (gleiche Tage, einheitliche Dauer)', () => {
    const p = plan();
    const rules = planSafetyRules(person() as never, MONDAY);
    const template = library.templates.find((t) => t.id === p.template_id);
    if (!template) throw new Error('Vorlage fehlt');
    // Weg der Engine-Version 1: Vorlage einmal anpassen UND auf 60 Minuten kürzen.
    const v1 = adaptTemplate(template, {
      library: library.exercises,
      profile: equipmentProfile('gym', []),
      rules,
      minutesPerSession: 60,
    }).sessions;
    expect(p.template_id).toBe('muskelaufbau-einsteiger-3t-studio');
    expect(p.sessions).toHaveLength(18);
    expect(p.sessions.map((s) => s.template_day_index)).toEqual(
      Array.from({ length: 18 }, (_, i) => (i % 3) + 1),
    );
    for (const s of p.sessions) {
      const base = v1.find((x) => x.template_day_index === s.template_day_index);
      const kind = s.is_deload ? 'deload' : s.is_intro_week ? 'intro' : 'load';
      expect(s.exercises).toEqual(base?.exercises.map((e) => dosageForWeek(e, kind, rules)));
      expect(s.kind).toBe('strength');
      expect(s.endurance_modality).toBeNull();
    }
  });
});

describe('gemischt: Mo Laufen 30, Mi Studio 60, Sa Zuhause 90', () => {
  const home = [...FULL_HOME];
  const p = plan({
    goalType: 'general_fitness',
    experienceLevel: 'advanced',
    homeEquipment: home,
    schedule: fixed([1, 'endurance', 30], [3, 'strength_gym', 60], [6, 'strength_home', 90]),
  });
  const byWeekday = (day: number) => p.sessions.filter((s) => isoWeekday(s.scheduled_on) === day);
  const homeIds = new Set<string>(home.map((e) => e.equipmentId));

  it('Mo Ausdauer, Mi und Sa Kraft; nie zwei Einheiten am Tag', () => {
    expect(byWeekday(1).every((s) => s.kind === 'endurance')).toBe(true);
    expect(byWeekday(3).every((s) => s.kind === 'strength')).toBe(true);
    expect(byWeekday(6).every((s) => s.kind === 'strength')).toBe(true);
    expect(generatedPlanSchema.safeParse(p).success).toBe(true);
  });

  it('Sa = Heim-Fassung (nur eigene Geräte), Mi = Studio-Fassung', () => {
    for (const s of byWeekday(6)) {
      for (const e of s.exercises) {
        const ex = library.exercises.get(e.exercise_id);
        expect(ex?.equipment_ids.every((id) => homeIds.has(id))).toBe(true);
      }
    }
    expect(p.training_week.map((d) => [d.weekday, d.kind])).toEqual([
      [1, 'endurance'],
      [3, 'strength_gym'],
      [6, 'strength_home'],
    ]);
  });

  it('Sa (90 min) nie gekürzt, Mi höchstens 60 min (gekürzt, falls die Vorlage länger ist)', () => {
    expect(byWeekday(6).every((s) => s.estimated_minutes <= 90)).toBe(true);
    expect(
      byWeekday(3)
        .filter((s) => !s.is_deload)
        .every((s) => s.estimated_minutes <= 60),
    ).toBe(true);
  });
});

describe('„Mo 20 / Sa 90“: dieselbe Vorlagen-Einheit verschieden gekürzt', () => {
  const p = plan({
    goalType: 'muscle_gain',
    experienceLevel: 'beginner',
    schedule: fixed([1, 'strength_gym', 20], [6, 'strength_gym', 90]),
  });

  it('Mo kürzer als Sa bei gleicher Vorlagen-Einheit; Hinweis minutes_shortened', () => {
    const load = p.sessions.filter((s) => !s.is_deload && !s.is_intro_week);
    const sets = (s: GeneratedSession) => s.exercises.reduce((sum, e) => sum + e.sets, 0);
    let compared = 0;
    for (const mo of load.filter((s) => isoWeekday(s.scheduled_on) === 1)) {
      const sa = load.find(
        (s) => isoWeekday(s.scheduled_on) === 6 && s.template_day_index === mo.template_day_index,
      );
      if (!sa) continue;
      compared += 1;
      expect(sets(mo)).toBeLessThan(sets(sa));
      expect(mo.estimated_minutes).toBeLessThan(sa.estimated_minutes);
      // 20 Minuten reichen nicht immer für 3 Übungen → dann zusätzlich minutes_below_minimum.
      if (mo.estimated_minutes > 20) expect(p.notes).toContain('minutes_below_minimum');
    }
    expect(compared).toBeGreaterThan(0);
    expect(p.notes).toContain('minutes_shortened');
  });
});

describe('10 und 240 Minuten', () => {
  it('Kraft 10 min → minutes_below_minimum; Ausdauer 10 min → 10-Minuten-Einheiten', () => {
    const p = plan({
      experienceLevel: 'advanced',
      schedule: fixed([1, 'strength_gym', 10], [4, 'endurance', 10]),
    });
    expect(p.notes).toContain('minutes_below_minimum');
    expect(endurance(p).every((s) => s.estimated_minutes === 10)).toBe(true);
  });

  it('240 min: nichts ergänzt, Ausdauer-Start trotzdem gedeckelt', () => {
    const p = plan({
      experienceLevel: 'competitive',
      schedule: fixed([1, 'strength_gym', 240], [4, 'endurance', 240]),
    });
    const template = library.templates.find((t) => t.id === p.template_id);
    const maxPerSession = Math.max(...(template?.sessions.map((s) => s.exercises.length) ?? [0]));
    expect(p.sessions.every((s) => s.exercises.length <= maxPerSession)).toBe(true);
    const runs = endurance(p);
    expect(runs.filter((s) => s.week_no === 1)[0]?.estimated_minutes).toBeLessThanOrEqual(90);
    expect(tenPercentViolations(p, 150)).toEqual([]);
  });
});

describe('Alter, Schwangerschaft, ohne Check, Arzt-Hinweis', () => {
  const runner = (overrides: Parameters<typeof person>[0]) =>
    plan({
      goalType: 'endurance',
      discipline: 'half_marathon',
      experienceLevel: 'advanced',
      schedule: fixed([2, 'endurance', 40], [5, 'endurance', 40]),
      ...overrides,
    });

  it.each([
    ['16 Jahre', '2010-06-01', 'run', 4],
    ['17 Jahre', '2009-06-01', 'run', 4],
    ['18 Jahre', '2008-06-01', 'run', 4],
    ['64 Jahre', '1962-06-01', 'run', 4],
    ['65 Jahre', '1961-10-05', 'walk', 3],
    ['95 Jahre', '1931-01-01', 'walk', 3],
  ] as const)('%s: %s, Anstrengung ≤ %i', (_l, birthDate, modality, effort) => {
    const p = runner({ birthDate });
    expect(p.sessions.every((s) => s.endurance_modality === modality)).toBe(true);
    expect(Math.max(...p.sessions.map((s) => s.effort_target ?? 0))).toBeLessThanOrEqual(effort);
    if (modality === 'walk') expect(p.notes).toContain('endurance_walk');
  });

  it('unter 18 und ab 65: vorsichtiger Startumfang 45 min, Start-Deckel 20 min je Einheit', () => {
    for (const birthDate of ['2009-06-01', '1955-01-01']) {
      const p = runner({ birthDate });
      expect(weekSum(endurance(p), 1)).toBeLessThanOrEqual(45);
      expect(
        endurance(p)
          .filter((s) => s.week_no === 1)
          .every((s) => s.estimated_minutes <= 20),
      ).toBe(true);
    }
  });

  it('Schwangerschaft: nur Gehen bzw. Ergometer, nie Rad im Freien; Arzt-Hinweis', () => {
    for (const discipline of ['10k', 'cycling', 'triathlon_olympic'] as const) {
      const p = runner({
        discipline,
        healthScreening: { flags: ['pregnancy', 'conservative_plan'] },
      });
      for (const s of p.sessions) {
        expect(['walk', 'bike']).toContain(s.endurance_modality);
        if (s.endurance_modality === 'bike') expect(s.name_de).toBe('Ergometer locker');
        expect(s.effort_target).toBeLessThanOrEqual(3);
      }
      expect(p.medical_notice).toBe(true);
    }
    const swim = runner({
      discipline: 'swimming',
      healthScreening: { flags: ['pregnancy', 'conservative_plan'] },
    });
    expect(swim.sessions.every((s) => s.endurance_modality === 'swim')).toBe(true);
  });

  it('ohne Check: Geh-Lauf-Wechsel, Anstrengung ≤ 3, Start 45 min, keine Gesundheitsdaten', () => {
    const p = runner({ healthScreening: null });
    expect(p.sessions.every((s) => s.name_de === 'Geh-Lauf-Wechsel')).toBe(true);
    expect(p.sessions.every((s) => (s.effort_target ?? 0) <= 3)).toBe(true);
    expect(weekSum(p.sessions, 1)).toBeLessThanOrEqual(45);
    expect(p.uses_health_data).toBe(false);
    expect(p.notes).not.toContain('endurance_walk');
  });

  it.each(HEALTH_FLAGS)('Flag %s: Arzt-Hinweis auch über Ausdauer-Einheiten, Gehen', (flag) => {
    const p = runner({ healthScreening: { flags: [flag] } });
    expect(p.medical_notice).toBe(true);
    expect(p.sessions.every((s) => s.endurance_modality !== 'run')).toBe(true);
  });

  it('Ziel Ausdauer ohne Ausdauer-Tag → goal_endurance_not_yet', () => {
    const p = runner({ schedule: fixed([2, 'strength_gym', 45]) });
    expect(p.notes).toContain('goal_endurance_not_yet');
    expect(p.notes).not.toContain('endurance_basic_only');
  });
});

describe('Gesamt-Deckel und Ruhetage', () => {
  it('7 Tage Einsteiger → höchstens 5 Einheiten je Woche, week_total_capped', () => {
    const p = plan({
      schedule: fixed(
        [1, 'strength_gym', 60],
        [2, 'endurance', 30],
        [3, 'strength_gym', 60],
        [4, 'endurance', 30],
        [5, 'strength_gym', 60],
        [6, 'endurance', 30],
        [7, 'endurance', 30],
      ),
    });
    expect(p.notes).toContain('week_total_capped');
    for (let w = 1; w <= p.load_weeks + 1; w += 1) {
      expect(p.sessions.filter((s) => s.week_no === w).length).toBeLessThanOrEqual(5);
    }
  });
});

describe('Eigenschaften über viele Kombinationen (Arten × Tage × Minuten × Level × Flags)', () => {
  it('10-%-Regel, nie zwei Einheiten am Tag, ≤ 4 Kraft-Einheiten je Woche, Schema-Grenzen', () => {
    const KINDS: Kind[][] = [
      ['endurance'],
      ['strength_gym'],
      ['strength_home', 'endurance'],
      ['strength_gym', 'endurance', 'strength_home'],
      ['endurance', 'endurance', 'strength_gym'],
    ];
    const DAY_SETS = [[3], [1, 4], [1, 3, 5], [1, 2, 4, 6], [1, 2, 3, 4, 5, 6, 7]];
    const MINUTES = [10, 30, 90, 240];
    const SCREENINGS: ({ flags: (typeof HEALTH_FLAGS)[number][] } | null)[] = [
      { flags: [] },
      null,
      { flags: ['pregnancy', 'conservative_plan'] },
      { flags: ['injury', 'conservative_plan'] },
    ];
    const START = { beginner: 60, advanced: 120, competitive: 150, cautious: 45 } as const;
    const violations: string[] = [];
    let count = 0;
    for (const kinds of KINDS) {
      for (const days of DAY_SETS) {
        for (const minutes of MINUTES) {
          for (const experienceLevel of ['beginner', 'advanced', 'competitive'] as const) {
            for (const healthScreening of SCREENINGS) {
              for (const mode of ['fixed', 'flex'] as const) {
                const slots = days.map((weekday, i) => ({
                  weekday,
                  kind: kinds[i % kinds.length] as Kind,
                  minutes: minutes + (i % 2) * 5,
                }));
                const schedule =
                  mode === 'fixed'
                    ? { mode, slots }
                    : {
                        mode,
                        slots: slots.map(({ kind, minutes: m }) => ({
                          kind,
                          minutes: Math.min(240, m),
                        })),
                      };
                const today = addDays(MONDAY, count % 7);
                count += 1;
                const result = generateTrainingPlan(
                  person({
                    goalType: 'endurance',
                    discipline: '10k',
                    experienceLevel,
                    healthScreening: healthScreening as never,
                    homeEquipment: [...FULL_HOME],
                    schedule: {
                      mode: schedule.mode,
                      slots: schedule.slots.map((s) => ({
                        ...s,
                        minutes: Math.min(240, s.minutes),
                      })),
                    } as never,
                  }),
                  library,
                  today,
                );
                const label = `${kinds.join('+')}/${days.join('')}/${minutes}/${experienceLevel}/${JSON.stringify(healthScreening)}/${mode}`;
                if (!result.ok) {
                  violations.push(`${label}: ${result.error}`);
                  continue;
                }
                const p = result.plan;
                if (!generatedPlanSchema.safeParse(p).success) violations.push(`${label}: Schema`);
                const group =
                  healthScreening === null || healthScreening.flags.length > 0
                    ? 'cautious'
                    : experienceLevel;
                const wish = p.training_week
                  .filter((d) => d.kind === 'endurance')
                  .reduce((sum, d) => sum + d.minutes, 0);
                tenPercentViolations(p, Math.min(wish, START[group])).forEach((v) =>
                  violations.push(`${label}: ${v}`),
                );
                const perWeek = new Map<string, number>();
                for (const s of p.sessions) {
                  if (s.kind !== 'strength') continue;
                  const key = startOfIsoWeek(s.scheduled_on);
                  perWeek.set(key, (perWeek.get(key) ?? 0) + 1);
                }
                if ([...perWeek.values()].some((n) => n > 4))
                  violations.push(`${label}: > 4 Kraft`);
                if (new Set(p.sessions.map((s) => s.scheduled_on)).size !== p.sessions.length) {
                  violations.push(`${label}: zwei am Tag`);
                }
                if (
                  healthScreening !== null &&
                  healthScreening.flags.includes('pregnancy') &&
                  p.sessions.some((s) => s.endurance_modality === 'run')
                ) {
                  violations.push(`${label}: Laufen in der Schwangerschaft`);
                }
              }
            }
          }
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
    expect(count).toBe(5 * 5 * 4 * 3 * 4 * 2);
  }, 120_000);
});
