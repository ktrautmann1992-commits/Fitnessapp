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
  nextPlanBlock,
} from './schedule';
import { planSafetyRules } from './safety';
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
    const block = buildPlanBlock({
      sessions: FULL,
      trainingDays: [1, 3, 5],
      today: '2026-10-05',
      loadWeeks: 5,
      rules: RULES,
    });
    expect(block).toHaveLength(18);
    expect(block[0]?.scheduled_on).toBe('2026-10-05');
    expect(block.filter((s) => s.is_intro_week).map((s) => s.week_no)).toEqual([1, 1, 1]);
    expect(block.filter((s) => s.is_deload).every((s) => s.week_no === 6)).toBe(true);
    expect(Math.max(...block.map((s) => s.week_no))).toBe(6);
    expect(block.every((s) => s.block_no === 1)).toBe(true);
  });

  it('Mittwoch bei Mo/Mi/Fr: Hälfte passt → Woche 1 (angebrochen) ist Einstiegswoche', () => {
    const block = buildPlanBlock({
      sessions: FULL,
      trainingDays: [1, 3, 5],
      today: '2026-10-07',
      loadWeeks: 5,
      rules: RULES,
    });
    expect(block.some((s) => s.week_no === 0)).toBe(false);
    expect(block.filter((s) => s.week_no === 1).map((s) => s.scheduled_on)).toEqual([
      '2026-10-07',
      '2026-10-09',
    ]);
    expect(block.filter((s) => s.week_no === 1).every((s) => s.is_intro_week)).toBe(true);
  });

  it('Freitag bei Mo/Mi/Fr: weniger als die Hälfte → Woche 0 (Einstieg), Woche 1 normal ab Montag', () => {
    const block = buildPlanBlock({
      sessions: FULL,
      trainingDays: [1, 3, 5],
      today: '2026-10-09',
      loadWeeks: 4,
      rules: RULES,
    });
    const week0 = block.filter((s) => s.week_no === 0);
    expect(week0.map((s) => s.scheduled_on)).toEqual(['2026-10-09']);
    expect(week0.every((s) => s.is_intro_week)).toBe(true);
    expect(block.filter((s) => s.week_no === 1).every((s) => !s.is_intro_week)).toBe(true);
    expect(block.find((s) => s.week_no === 1)?.scheduled_on).toBe('2026-10-12');
    expect(Math.max(...block.map((s) => s.week_no))).toBe(5);
  });

  it('Sonntag, nichts mehr frei: Block beginnt Montag mit Einstiegswoche', () => {
    const block = buildPlanBlock({
      sessions: FULL,
      trainingDays: [1, 3, 5],
      today: '2026-10-11',
      loadWeeks: 5,
      rules: RULES,
    });
    expect(block[0]?.scheduled_on).toBe('2026-10-12');
    expect(block[0]?.is_intro_week).toBe(true);
    expect(block[0]?.week_no).toBe(1);
  });

  it('nie Einheiten vor heute, nie zwei an einem Tag, Wochentage stimmen', () => {
    for (let d = 0; d < 7; d += 1) {
      const today = addDays('2026-10-05', d);
      const block = buildPlanBlock({
        sessions: UL,
        trainingDays: [1, 2, 4, 5],
        today,
        loadWeeks: 4,
        rules: RULES,
      });
      expect(block.every((s) => s.scheduled_on >= today)).toBe(true);
      expect(new Set(block.map((s) => s.scheduled_on)).size).toBe(block.length);
      expect(block.every((s) => [1, 2, 4, 5].includes(isoWeekday(s.scheduled_on)))).toBe(true);
      expect(Math.max(...block.map((s) => s.week_no))).toBeLessThanOrEqual(6);
    }
  });

  it('Rotation bei 1 Tag: A, B, C, A …', () => {
    const block = buildPlanBlock({
      sessions: FULL,
      trainingDays: [3],
      today: '2026-10-05',
      loadWeeks: 5,
      rules: RULES,
    });
    expect(block.map((s) => s.template_day_index)).toEqual([1, 2, 3, 1, 2, 3]);
  });

  it('Rotation bei 2 Tagen: A+B, C+A, B+C', () => {
    const block = buildPlanBlock({
      sessions: FULL,
      trainingDays: [1, 4],
      today: '2026-10-05',
      loadWeeks: 4,
      rules: RULES,
    });
    expect(block.slice(0, 6).map((s) => s.template_day_index)).toEqual([1, 2, 3, 1, 2, 3]);
  });

  it('Ober-/Unterkörper: nie zweimal derselbe Schwerpunkt an Folgetagen', () => {
    const block = buildPlanBlock({
      sessions: UL,
      trainingDays: [1, 2, 4, 5],
      today: '2026-10-05',
      loadWeeks: 4,
      rules: RULES,
    });
    expect(hasBackToBackSessions(block)).toBe(false);
  });

  it('Ganzkörper an Sa + So → Hinweis back_to_back', () => {
    const block = buildPlanBlock({
      sessions: FULL,
      trainingDays: [6, 7],
      today: '2026-10-05',
      loadWeeks: 4,
      rules: RULES,
    });
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
  const library = repoLibrary().exercises;
  const healthy = planSafetyRules(
    { experienceLevel: 'advanced', birthDate: '1990-01-01', healthScreening: { flags: [] } },
    '2026-10-05',
  );
  const first = buildPlanBlock({
    sessions: [session(1, 'full_body', 'kniebeuge-langhantel'), session(2), session(3)],
    trainingDays: [1, 3, 5],
    today: '2026-10-05',
    loadWeeks: 4,
    rules: { rpeMax: 9 },
  });

  it('lückenlos ab dem Montag nach dem letzten Block, block_no + 1, ohne Einstiegswoche', () => {
    const next = nextPlanBlock(first, {
      trainingDays: [1, 3, 5],
      loadWeeks: 4,
      rules: healthy,
      library,
    });
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
    const withProfile = nextPlanBlock(first, {
      trainingDays: [1, 3, 5],
      loadWeeks: 4,
      rules: cautious,
      library,
      profile: { available: new Set(['dumbbells']) },
    });
    const ids = withProfile.flatMap((s) => s.exercises.map((e) => e.exercise_id));
    expect(ids).not.toContain('kniebeuge-langhantel');
    expect(withProfile.flatMap((s) => s.exercises).every((e) => e.rpe_target <= 7)).toBe(true);
    const offline = nextPlanBlock(first, {
      trainingDays: [1, 3, 5],
      loadWeeks: 4,
      rules: cautious,
      library,
    });
    expect(offline.flatMap((s) => s.exercises.map((e) => e.exercise_id))).not.toContain(
      'kniebeuge-langhantel',
    );
  });

  it('Rotation läuft ab der Vorlagen-Einheit NACH der letzten geplanten weiter', () => {
    const rotating = buildPlanBlock({
      sessions: FULL,
      trainingDays: [3],
      today: '2026-10-05',
      loadWeeks: 4,
      rules: { rpeMax: 9 },
    });
    expect(rotating.map((s) => s.template_day_index)).toEqual([1, 2, 3, 1, 2]);
    // Erste Einheit fehlt (z. B. nicht übernommen): Anzahl wäre 4, die letzte Einheit war aber B → weiter mit C.
    const shortened = rotating.slice(1);
    const next = nextPlanBlock(shortened, {
      trainingDays: [3],
      loadWeeks: 4,
      rules: healthy,
      library,
    });
    expect(next[0]?.template_day_index).toBe(3);
    expect(next.map((s) => s.template_day_index)).toEqual([3, 1, 2, 3, 1]);
  });

  it('leerer Vorgängerblock → leer', () => {
    expect(nextPlanBlock([], { trainingDays: [1], loadWeeks: 4, rules: healthy, library })).toEqual(
      [],
    );
  });
});
