import { describe, expect, it } from 'vitest';

import { addDays, isoWeekday } from '../dates';
import type { AdaptedSession, PlannedExerciseDraft } from './adapt';
import {
  adjacentPairs,
  baseSessionsFromBlock,
  buildPlanBlock,
  chooseTrainingDays,
  cyclicMinGap,
  dosageForWeek,
  hasBackToBackSessions,
  enduranceReferenceFromBlock,
  type GeneratedSession,
  nextPlanBlock,
  type PreviousSession,
  resolveTrainingWeek,
} from './schedule';
import type { TrainingSchedule } from '../training-schedule';
import { equipmentProfile } from './equipment-profile';
import { type EnduranceStartGroup, planSafetyRules } from './safety';
import { repoLibrary } from './test-library';

const ex = (id: string, overrides: Partial<PlannedExerciseDraft> = {}): PlannedExerciseDraft => ({
  order_no: 1,
  exercise_id: id,
  source_exercise_id: id,
  exercise_name_de: id,
  sets: 3,
  reps_min: 8,
  reps_max: 12,
  duration_s: null,
  rest_s: 120,
  rpe_target: 7,
  superset_group: null,
  notes_de: null,
  target_weight_kg: null,
  ...overrides,
});
const session = (
  i: number,
  focus: AdaptedSession['focus'] = 'full_body',
  id = 'goblet-kniebeuge',
): AdaptedSession => ({
  template_day_index: i,
  name_de: `Einheit ${i}`,
  focus,
  warmup_de: 'Aufwärmen.',
  cooldown_de: 'Ausklingen.',
  exercises: [ex(id)],
});
const FULL = [session(1), session(2), session(3)];
const UL = [session(1, 'upper'), session(2, 'lower'), session(3, 'upper'), session(4, 'lower')];
const RULES = { rpeMax: 9 };
const LIBRARY = repoLibrary().exercises;
const BASE_RULES = planSafetyRules(
  { experienceLevel: 'advanced', birthDate: '1990-01-01', healthScreening: { flags: [] } },
  '2026-10-05',
);

/** Nur Kraft im Studio, 240 Minuten (nichts wird gekürzt) – wie die Blöcke der Engine-Version 1. */
function blockOf(
  sessions: readonly AdaptedSession[],
  trainingDays: readonly number[],
  today: string,
  loadWeeks: number,
  rules: { rpeMax: number },
) {
  return buildPlanBlock({
    days: trainingDays.map((weekday) => ({ weekday, kind: 'strength_gym' as const, minutes: 240 })),
    today,
    loadWeeks,
    context: {
      strength: { primary: 'gym', versions: new Map([['gym', sessions]]), library: LIBRARY },
      endurance: {
        goalType: 'muscle_gain',
        discipline: null,
        experienceLevel: 'advanced',
        rules: BASE_RULES,
      },
      rules: { ...BASE_RULES, ...rules },
      enduranceWishWeekly: 0,
    },
  }).sessions;
}

function nextOf(
  previous: readonly GeneratedSession[],
  trainingDays: readonly number[],
  loadWeeks: number,
  rules: ReturnType<typeof planSafetyRules>,
  profile?: { available: Set<string> },
) {
  return nextPlanBlock(previous, {
    schedule: {
      mode: 'fixed',
      slots: trainingDays.map((weekday) => ({
        weekday,
        kind: 'strength_gym' as const,
        minutes: 240,
      })),
    },
    loadWeeks,
    rules,
    library: LIBRARY,
    profiles: profile ? new Map([['gym', profile]]) : new Map(),
    endurance: { goalType: 'muscle_gain', discipline: null, experienceLevel: 'advanced' },
    previousStartGroup: 'advanced',
  });
}

describe('chooseTrainingDays', () => {
  it.each([
    [1, [], [3], false],
    [2, [], [1, 4], false],
    [3, [], [1, 3, 5], false],
    [4, [], [1, 2, 4, 5], false],
    [3, [2, 4, 6], [2, 4, 6], false],
    [3, [1, 2, 3, 4, 5], [1, 3, 5], false],
    [2, [6, 7], [6, 7], false],
    [3, [1, 2, 3, 4, 5, 6, 7], [1, 3, 5], false],
    [4, [1, 3, 5], [1, 3, 5, 6], true],
    [3, [6], [1, 3, 6], true],
  ] as const)('%i Einheiten, Wunsch %j → %j', (count, preferred, days, added) => {
    expect(chooseTrainingDays(count, preferred)).toEqual({ days, added });
  });

  it('5–7 Tage ohne Wunsch: verteilt', () => {
    for (const n of [5, 6, 7]) {
      expect(chooseTrainingDays(n, []).days).toHaveLength(n);
    }
  });

  it('Kreis-Abstand und Nachbartage (So → Mo zählt)', () => {
    expect(cyclicMinGap([7, 1])).toBe(1);
    expect(cyclicMinGap([3])).toBe(7);
    expect(adjacentPairs([7, 1])).toBe(1);
    expect(adjacentPairs([1, 3, 5])).toBe(0);
  });
});

describe('buildPlanBlock', () => {
  it('Erzeugung am Montag: Woche 1 = Einstiegswoche, 5 + 1 Wochen, Erholungswoche am Ende', () => {
    const block = blockOf(FULL, [1, 3, 5], '2026-10-05', 5, RULES);
    expect(block).toHaveLength(18);
    expect(block[0]?.scheduled_on).toBe('2026-10-05');
    expect(block.filter((s) => s.is_intro_week).map((s) => s.week_no)).toEqual([1, 1, 1]);
    expect(block.filter((s) => s.is_deload).every((s) => s.week_no === 6)).toBe(true);
    expect(Math.max(...block.map((s) => s.week_no))).toBe(6);
    expect(block.every((s) => s.block_no === 1)).toBe(true);
  });

  it('Mittwoch bei Mo/Mi/Fr: Hälfte passt → Woche 1 (angebrochen) ist Einstiegswoche', () => {
    const block = blockOf(FULL, [1, 3, 5], '2026-10-07', 5, RULES);
    expect(block.some((s) => s.week_no === 0)).toBe(false);
    expect(block.filter((s) => s.week_no === 1).map((s) => s.scheduled_on)).toEqual([
      '2026-10-07',
      '2026-10-09',
    ]);
    expect(block.filter((s) => s.week_no === 1).every((s) => s.is_intro_week)).toBe(true);
  });

  it('Freitag bei Mo/Mi/Fr: weniger als die Hälfte → Woche 0 (Einstieg), Woche 1 normal ab Montag', () => {
    const block = blockOf(FULL, [1, 3, 5], '2026-10-09', 4, RULES);
    const week0 = block.filter((s) => s.week_no === 0);
    expect(week0.map((s) => s.scheduled_on)).toEqual(['2026-10-09']);
    expect(week0.every((s) => s.is_intro_week)).toBe(true);
    expect(block.filter((s) => s.week_no === 1).every((s) => !s.is_intro_week)).toBe(true);
    expect(block.find((s) => s.week_no === 1)?.scheduled_on).toBe('2026-10-12');
    expect(Math.max(...block.map((s) => s.week_no))).toBe(5);
  });

  it('Sonntag, nichts mehr frei: Block beginnt Montag mit Einstiegswoche', () => {
    const block = blockOf(FULL, [1, 3, 5], '2026-10-11', 5, RULES);
    expect(block[0]?.scheduled_on).toBe('2026-10-12');
    expect(block[0]?.is_intro_week).toBe(true);
    expect(block[0]?.week_no).toBe(1);
  });

  it('nie Einheiten vor heute, nie zwei an einem Tag, Wochentage stimmen', () => {
    for (let d = 0; d < 7; d += 1) {
      const today = addDays('2026-10-05', d);
      const block = blockOf(UL, [1, 2, 4, 5], today, 4, RULES);
      expect(block.every((s) => s.scheduled_on >= today)).toBe(true);
      expect(new Set(block.map((s) => s.scheduled_on)).size).toBe(block.length);
      expect(block.every((s) => [1, 2, 4, 5].includes(isoWeekday(s.scheduled_on)))).toBe(true);
      expect(Math.max(...block.map((s) => s.week_no))).toBeLessThanOrEqual(6);
    }
  });

  it('Rotation bei 1 Tag: A, B, C, A …', () => {
    const block = blockOf(FULL, [3], '2026-10-05', 5, RULES);
    expect(block.map((s) => s.template_day_index)).toEqual([1, 2, 3, 1, 2, 3]);
  });

  it('Rotation bei 2 Tagen: A+B, C+A, B+C', () => {
    const block = blockOf(FULL, [1, 4], '2026-10-05', 4, RULES);
    expect(block.slice(0, 6).map((s) => s.template_day_index)).toEqual([1, 2, 3, 1, 2, 3]);
  });

  it('Ober-/Unterkörper: nie zweimal derselbe Schwerpunkt an Folgetagen', () => {
    const block = blockOf(UL, [1, 2, 4, 5], '2026-10-05', 4, RULES);
    expect(hasBackToBackSessions(block)).toBe(false);
  });

  it('Ganzkörper an Sa + So → Hinweis back_to_back', () => {
    const block = blockOf(FULL, [6, 7], '2026-10-05', 4, RULES);
    expect(hasBackToBackSessions(block)).toBe(true);
  });

  it('Dosierung: Einstieg RPE −1, Erholungswoche Sätze halbiert (1 → 1) und RPE −2, nie unter 5', () => {
    expect(dosageForWeek(ex('a', { rpe_target: 7 }), 'intro', RULES).rpe_target).toBe(6);
    expect(dosageForWeek(ex('a', { rpe_target: 5 }), 'intro', RULES).rpe_target).toBe(5);
    const deload = dosageForWeek(ex('a', { sets: 3, rpe_target: 6 }), 'deload', RULES);
    expect(deload.sets).toBe(2);
    expect(deload.rpe_target).toBe(5);
    expect(dosageForWeek(ex('a', { sets: 1 }), 'deload', RULES).sets).toBe(1);
    expect(dosageForWeek(ex('a', { rpe_target: 8.5 }), 'load', { rpeMax: 7 }).rpe_target).toBe(7);
  });
});

describe('Folgeblock', () => {
  const healthy = planSafetyRules(
    { experienceLevel: 'advanced', birthDate: '1990-01-01', healthScreening: { flags: [] } },
    '2026-10-05',
  );
  const first = blockOf(
    [session(1, 'full_body', 'kniebeuge-langhantel'), session(2), session(3)],
    [1, 3, 5],
    '2026-10-05',
    4,
    { rpeMax: 9 },
  );

  it('lückenlos ab dem Montag nach dem letzten Block, block_no + 1, ohne Einstiegswoche', () => {
    const next = nextOf(first, [1, 3, 5], 4, healthy);
    expect(next[0]?.scheduled_on).toBe('2026-11-09');
    expect(next.every((s) => s.block_no === 2 && !s.is_intro_week && s.week_no >= 1)).toBe(true);
    expect(next.filter((s) => s.is_deload)).toHaveLength(3);
  });

  it('Basis aus Belastungswochen (nicht aus der Erholungswoche)', () => {
    const base = baseSessionsFromBlock(first);
    expect(base.map((s) => s.template_day_index)).toEqual([1, 2, 3]);
    expect(base[0]?.exercises[0]?.sets).toBe(3);
  });

  it('strengere aktuelle Regeln wirken sofort: Langhantel-Kniebeuge ersetzt bzw. ausgeblendet, RPE ≤ 7', () => {
    const cautious = planSafetyRules(
      {
        experienceLevel: 'advanced',
        birthDate: '1990-01-01',
        healthScreening: { flags: ['injury', 'conservative_plan'] },
      },
      '2026-11-09',
    );
    const withProfile = nextOf(first, [1, 3, 5], 4, cautious, {
      available: new Set(['dumbbells']),
    });
    const ids = withProfile.flatMap((s) => s.exercises.map((e) => e.exercise_id));
    expect(ids).not.toContain('kniebeuge-langhantel');
    expect(withProfile.flatMap((s) => s.exercises).every((e) => e.rpe_target <= 7)).toBe(true);
    const offline = nextOf(first, [1, 3, 5], 4, cautious);
    expect(offline.flatMap((s) => s.exercises.map((e) => e.exercise_id))).not.toContain(
      'kniebeuge-langhantel',
    );
  });

  it('Rotation läuft ab der Vorlagen-Einheit NACH der letzten geplanten weiter', () => {
    const rotating = blockOf(FULL, [3], '2026-10-05', 4, { rpeMax: 9 });
    expect(rotating.map((s) => s.template_day_index)).toEqual([1, 2, 3, 1, 2]);
    // Erste Einheit fehlt (z. B. nicht übernommen): Anzahl wäre 4, die letzte Einheit war aber B → weiter mit C.
    const shortened = rotating.slice(1);
    const next = nextOf(shortened, [3], 4, healthy);
    expect(next[0]?.template_day_index).toBe(3);
    expect(next.map((s) => s.template_day_index)).toEqual([3, 1, 2, 3, 1]);
  });

  it('leerer Vorgängerblock → leer', () => {
    expect(nextOf([], [1], 4, healthy)).toEqual([]);
  });
});

describe('resolveTrainingWeek (Erweiterungsplan 5.2)', () => {
  const fixed = (...days: [number, 'strength_gym' | 'strength_home' | 'endurance', number][]) => ({
    mode: 'fixed' as const,
    slots: days.map(([weekday, kind, minutes]) => ({ weekday, kind, minutes })),
  });
  const all = (kind: 'strength_gym' | 'endurance', minutes = 60) =>
    fixed(...[1, 2, 3, 4, 5, 6, 7].map((d) => [d, kind, minutes] as [number, typeof kind, number]));

  it('1 Tag bleibt 1 Tag', () => {
    expect(resolveTrainingWeek(fixed([3, 'endurance', 20]), 'beginner').days).toEqual([
      { weekday: 3, kind: 'endurance', minutes: 20 },
    ]);
  });

  it('7 × Kraft (Fortgeschritten) → 4 Kraft-Tage mit größtem Abstand + 3 Ruhetage', () => {
    const week = resolveTrainingWeek(all('strength_gym'), 'advanced');
    // 4 von 7: Abstand immer 1 irgendwo; wenigste Nachbarpaare, dann lexikografisch kleinste Auswahl.
    expect(week.days.map((d) => d.weekday)).toEqual([1, 2, 4, 6]);
    expect(week.notes.has('days_capped')).toBe(true);
    expect(week.notes.has('week_total_capped')).toBe(false);
  });

  it.each(['beginner', 'cautious'] as const)(
    '7 Tage bei %s → höchstens 5 Einheiten, week_total_capped',
    (group) => {
      const week = resolveTrainingWeek(
        fixed(
          [1, 'strength_gym', 60],
          [2, 'endurance', 20],
          [3, 'strength_gym', 60],
          [4, 'endurance', 40],
          [5, 'strength_gym', 60],
          [6, 'endurance', 30],
          [7, 'strength_home', 60],
        ),
        group,
      );
      expect(week.days.length).toBeLessThanOrEqual(5);
      expect(week.notes.has('week_total_capped')).toBe(true);
      // zuerst die kürzesten Ausdauer-Tage
      expect(week.days.some((d) => d.weekday === 2)).toBe(false);
    },
  );

  it('7 × Laufen Einsteiger → Ausdauer-Deckel 4 (endurance_days_capped)', () => {
    const week = resolveTrainingWeek(all('endurance', 30), 'beginner');
    expect(week.days.filter((d) => d.kind === 'endurance')).toHaveLength(4);
    expect(week.notes.has('endurance_days_capped')).toBe(true);
  });

  it('7 × Laufen Leistungssport → 6 Ausdauer-Tage, kein Gesamt-Deckel', () => {
    expect(resolveTrainingWeek(all('endurance', 30), 'competitive').days).toHaveLength(6);
  });

  it('„Tage egal“: deterministisch, Kraft nach Standardmuster, Ausdauer mit Abstand, nie zwei am Tag', () => {
    const schedule = {
      mode: 'flex' as const,
      slots: [
        { kind: 'strength_gym' as const, minutes: 45 },
        { kind: 'strength_gym' as const, minutes: 45 },
        { kind: 'endurance' as const, minutes: 30 },
        { kind: 'endurance' as const, minutes: 30 },
      ],
    };
    const a = resolveTrainingWeek(schedule, 'advanced');
    expect(a).toEqual(resolveTrainingWeek(schedule, 'advanced'));
    expect(a.days.filter((d) => d.kind === 'strength_gym').map((d) => d.weekday)).toEqual([1, 4]);
    const endurance = a.days.filter((d) => d.kind === 'endurance').map((d) => d.weekday);
    expect(endurance).toHaveLength(2);
    expect(new Set(a.days.map((d) => d.weekday)).size).toBe(4);
    // Gleichstand beim Abstand: nicht direkt nach einem Kraft-Tag (Di, Fr gemieden).
    expect(endurance).not.toContain(2);
    expect(endurance).not.toContain(5);
  });

  it('„Tage egal“ 7 Einheiten bei Einsteiger → 5', () => {
    const week = resolveTrainingWeek(
      {
        mode: 'flex',
        slots: [
          ...Array.from({ length: 3 }, () => ({ kind: 'strength_gym' as const, minutes: 60 })),
          ...Array.from({ length: 4 }, () => ({ kind: 'endurance' as const, minutes: 30 })),
        ],
      },
      'beginner',
    );
    expect(week.days).toHaveLength(5);
  });
});

describe('Folgeblock mit Ausdauer und „Tage egal“', () => {
  const run = (
    weekday: number,
    week: number,
    minutes: number,
    status: 'planned' | 'skipped' = 'planned',
    original: string | null = null,
  ): PreviousSession => ({
    block_no: 1,
    week_no: week,
    is_intro_week: false,
    is_deload: false,
    kind: 'endurance',
    template_day_index: null,
    scheduled_on: addDays('2026-10-05', (week - 1) * 7 + weekday - 1),
    name_de: 'Lockerer Dauerlauf',
    focus: null,
    endurance_modality: 'run',
    effort_target: 4,
    estimated_minutes: minutes,
    warmup_de: 'A.',
    cooldown_de: 'B.',
    exercises: [],
    status,
    original_date: original,
  });
  const schedule = {
    mode: 'flex' as const,
    slots: [
      { kind: 'endurance' as const, minutes: 40 },
      { kind: 'endurance' as const, minutes: 40 },
      { kind: 'endurance' as const, minutes: 40 },
    ],
  };
  const options = (
    rules = BASE_RULES,
    previousStartGroup: EnduranceStartGroup = 'advanced',
    plan: TrainingSchedule = schedule,
  ) => ({
    schedule: plan,
    loadWeeks: 4,
    rules,
    library: LIBRARY,
    profiles: new Map(),
    endurance: {
      goalType: 'endurance' as const,
      discipline: '10k' as const,
      experienceLevel: 'advanced' as const,
    },
    previousStartGroup,
  });

  it('Tage und Arten aus der letzten Belastungswoche – auch nach einer Verschiebung (ursprünglicher Tag)', () => {
    const previous = [
      run(1, 4, 30),
      run(3, 4, 30),
      // Freitag auf Samstag verschoben → zählt als Freitag
      { ...run(6, 4, 30), original_date: addDays('2026-10-05', 3 * 7 + 4) },
      { ...run(1, 5, 18), is_deload: true },
    ];
    const next = nextPlanBlock(previous, options());
    const firstWeek = next.filter((s) => s.week_no === 1);
    expect(firstWeek.map((s) => isoWeekday(s.scheduled_on))).toEqual([1, 3, 5]);
    expect(next.every((s) => s.kind === 'endurance' && s.exercises.length === 0)).toBe(true);
    // Bezug 90 → höchstens 99 in der ersten Woche des neuen Blocks
    expect(firstWeek.reduce((sum, s) => sum + s.estimated_minutes, 0)).toBeLessThanOrEqual(99);
  });

  it('gestrichene Einheiten zählen nicht: eine von drei gestrichen → Bezug nur aus zwei', () => {
    const previous = [run(1, 4, 30), run(3, 4, 30, 'skipped'), run(5, 4, 30)];
    expect(enduranceReferenceFromBlock(previous)).toEqual({ volume: 60, sessionCap: 30 });
    const next = nextPlanBlock(previous, options());
    const firstWeek = next.filter((s) => s.week_no === 1);
    // Tag bleibt im Muster (geplant war er), Umfang aber nur floor(1,1 × 60) = 66
    expect(firstWeek).toHaveLength(3);
    expect(firstWeek.reduce((sum, s) => sum + s.estimated_minutes, 0)).toBeLessThanOrEqual(66);
  });

  it('Erholungswoche des Folgeblocks = floor(0,6 × letzte Belastungswoche)', () => {
    const next = nextPlanBlock([run(1, 4, 30), run(3, 4, 30), run(5, 4, 30)], options());
    const load = next
      .filter((s) => s.week_no === 4)
      .reduce((sum, s) => sum + s.estimated_minutes, 0);
    const deload = next.filter((s) => s.is_deload).reduce((sum, s) => sum + s.estimated_minutes, 0);
    expect(deload).toBeLessThanOrEqual(Math.floor(load * 0.6));
  });

  it('Probe des Wächters: Leistungssport 7 × 60 → danach 76 Jahre und schwanger → alle Deckel des neuen Blocks', () => {
    const seven = {
      mode: 'flex' as const,
      slots: Array.from({ length: 7 }, () => ({ kind: 'endurance' as const, minutes: 60 })),
    };
    const previous = [1, 2, 3, 4, 5, 6].map((d) => run(d, 4, 36));
    const strict = planSafetyRules(
      {
        experienceLevel: 'competitive',
        birthDate: '1950-01-01',
        healthScreening: { flags: ['pregnancy', 'conservative_plan'] },
      },
      '2026-11-02',
    );
    const next = nextPlanBlock(previous, options(strict, 'competitive', seven));
    for (let week = 1; week <= 5; week += 1) {
      const inWeek = next.filter((s) => s.week_no === week);
      expect(inWeek.length).toBeLessThanOrEqual(3); // Ausdauer-Deckel vorsichtig
      expect(inWeek.every((s) => s.endurance_modality === 'walk')).toBe(true);
      expect(inWeek.every((s) => (s.effort_target ?? 0) <= 3)).toBe(true);
    }
    const week1 = next.filter((s) => s.week_no === 1);
    // Bezug = min(216, Startumfang vorsichtig 45) → höchstens floor(1,1 × 45) = 49; Deckel je Einheit 20.
    expect(week1.reduce((sum, s) => sum + s.estimated_minutes, 0)).toBeLessThanOrEqual(49);
    expect(week1.every((s) => s.estimated_minutes <= 20)).toBe(true);
  });

  it('65. Geburtstag zwischen den Blöcken: Gesamt-Deckel 5 auch für Kraft + Ausdauer', () => {
    const strengthDay = (weekday: number): PreviousSession => ({
      ...run(weekday, 4, 45),
      kind: 'strength',
      template_day_index: 1,
      focus: 'full_body',
      endurance_modality: null,
      effort_target: null,
      name_de: 'Ganzkörper A',
      exercises: [],
    });
    const previous = [
      strengthDay(1),
      run(2, 4, 40),
      strengthDay(3),
      run(4, 4, 40),
      strengthDay(5),
      run(6, 4, 40),
      run(7, 4, 40),
    ];
    const senior = planSafetyRules(
      { experienceLevel: 'advanced', birthDate: '1961-10-20', healthScreening: { flags: [] } },
      '2026-11-02',
    );
    expect(senior.enduranceStartGroup).toBe('cautious');
    const next = nextPlanBlock(previous, options(senior, 'advanced'));
    for (let week = 1; week <= 5; week += 1) {
      expect(next.filter((s) => s.week_no === week).length).toBeLessThanOrEqual(5);
    }
  });

  it('Kraft-Basis je Ort aus der Fassung desselben Orts (Mo Studio, Sa zu Hause)', () => {
    const strength = (weekday: number, exercise: string): PreviousSession => ({
      ...run(weekday, 4, 45),
      kind: 'strength',
      template_day_index: 1,
      focus: 'full_body',
      endurance_modality: null,
      effort_target: null,
      name_de: 'Ganzkörper A',
      exercises: [ex(exercise)],
    });
    const previous = [strength(1, 'kniebeuge-langhantel'), strength(6, 'goblet-kniebeuge')];
    const mixed = {
      mode: 'fixed' as const,
      slots: [
        { weekday: 1, kind: 'strength_gym' as const, minutes: 240 },
        { weekday: 6, kind: 'strength_home' as const, minutes: 240 },
      ],
    };
    const next = nextPlanBlock(previous, {
      ...options(BASE_RULES, 'advanced', mixed),
      profiles: new Map([
        ['gym', equipmentProfile('gym', [])],
        ['home', equipmentProfile('home', [{ equipmentId: 'dumbbells', weightsKg: [] }])],
      ]),
    });
    const ids = (weekday: number) =>
      next
        .filter((s) => isoWeekday(s.scheduled_on) === weekday)
        .flatMap((s) => s.exercises.map((e) => e.exercise_id));
    expect(new Set(ids(1))).toEqual(new Set(['kniebeuge-langhantel']));
    expect(new Set(ids(6))).toEqual(new Set(['goblet-kniebeuge']));
  });
});
