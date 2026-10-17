import { describe, expect, it } from 'vitest';

import type { EquipmentLocation } from '../enums';
import { isoWeekday, startOfIsoWeek } from '../dates';
import { equipmentProfile } from '../plan/equipment-profile';
import { generateTrainingPlan } from '../plan/generate';
import type { WorkoutStep } from '../plan/intensity';
import { planSafetyRules } from '../plan/safety';
import { MONDAY, person, repoLibrary } from '../plan/test-library';
import type { StoredSession } from '../plan/view';
import { type PrintBlock, type PrintDocument, printDocumentSchema } from './document';
import { buildTrainingPlanDocument } from './training-plan-document';

/**
 * PDF des Wettkampfplans (Wächter WP4 M1): gleiche Aufbereitung wie die App – Wochenzahl harter Einheiten nach dem
 * aktuellen Level (applyCompetitionWeekLimits) und Art/Ablauf je Einheit.
 */

const library = repoLibrary();
const inputs = person({
  goalType: 'endurance',
  discipline: '10k',
  experienceLevel: 'advanced',
  schedule: {
    mode: 'fixed',
    slots: [
      { weekday: 2, kind: 'endurance', minutes: 45 },
      { weekday: 4, kind: 'endurance', minutes: 45 },
      { weekday: 7, kind: 'endurance', minutes: 60 },
    ],
  },
});
const plan = (() => {
  const r = generateTrainingPlan(inputs, library, MONDAY);
  if (!r.ok) throw new Error(r.error);
  return r.plan;
})();
const tempoSteps: WorkoutStep[] = [
  { part: 'warmup', kind: 'easy', seconds: 600, effort: 3 },
  { part: 'main', kind: 'work', seconds: 1800, effort: 7 },
  { part: 'cooldown', kind: 'easy', seconds: 300, effort: 3 },
];
// Zwei harte Einheiten in derselben Woche (Di, Do der ersten vollen Woche), Rest locker mit Art.
const firstWeek = startOfIsoWeek(plan.sessions.find((s) => s.week_no >= 1)?.scheduled_on ?? MONDAY);
const sessions: StoredSession[] = plan.sessions.map((s, i) => {
  const hard =
    startOfIsoWeek(s.scheduled_on) === firstWeek &&
    s.kind === 'endurance' &&
    [2, 4].includes(isoWeekday(s.scheduled_on));
  return {
    ...s,
    id: `s${i}`,
    status: 'planned',
    original_date: null,
    workout_type: hard ? 'tempo' : 'easy',
    training_phase: 'build',
    workout_steps: hard
      ? tempoSteps
      : [{ part: 'main', kind: 'easy', seconds: s.estimated_minutes * 60, effort: 3 }],
    target_distance_m: null,
    effort_target: hard ? 7 : 3,
    estimated_minutes: hard ? 45 : s.estimated_minutes,
  };
});

function doc(competitionLevel?: 'beginner' | 'advanced'): PrintDocument {
  const rules = planSafetyRules({ ...inputs, experienceLevel: 'advanced' }, MONDAY);
  const result = buildTrainingPlanDocument(
    plan,
    sessions,
    {
      rules,
      previousStartGroup: rules.enduranceStartGroup,
      library: library.exercises,
      profiles: new Map<EquipmentLocation, ReturnType<typeof equipmentProfile>>([
        ['gym', equipmentProfile('gym', [])],
        ['home', equipmentProfile('home', [])],
      ]),
      ...(competitionLevel ? { competitionLevel } : {}),
    },
    null,
    { onDate: firstWeek },
  );
  if (!result.ok) throw new Error(result.error);
  expect(printDocumentSchema.safeParse(result.document).success).toBe(true);
  return result.document;
}

const workoutTypes = (d: PrintDocument) =>
  d.sections
    .filter((b): b is Extract<PrintBlock, { type: 'table' }> => b.type === 'table')
    .filter((t) => t.caption.kind === 'text' && t.caption.code === 'endurance.heading')
    .flatMap((t) => t.rows)
    .filter((r) => {
      const h = r.header[0];
      const date = h?.kind === 'text' ? (h.params as { date?: string }).date : undefined;
      return date !== undefined && startOfIsoWeek(date) === firstWeek;
    })
    .flatMap((r) => r.cells[1] ?? [])
    .flatMap((c) => (c.kind === 'text' && c.code === 'endurance.workout' ? [c.params] : []));

describe('PDF Wettkampfplan', () => {
  it('Fortgeschritten: beide harten Einheiten der Woche, Art und Ablauf stehen im PDF', () => {
    const d = doc('advanced');
    const types = workoutTypes(d).map((p) => (p as { type: string }).type);
    expect(types.filter((t) => t === 'tempo')).toHaveLength(2);
    expect(JSON.stringify(d)).toContain('"code":"endurance.steps"');
  });
  it('jetzt Einsteiger: nur die frühere bleibt hart, die spätere ist locker (wie in der App)', () => {
    const types = workoutTypes(doc('beginner')).map((p) => (p as { type: string }).type);
    expect(types.filter((t) => t === 'tempo')).toHaveLength(1);
  });
});
