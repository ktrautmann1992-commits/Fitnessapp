/**
 * Yoga/Pilates/Mobility in der App (Sportarten Stufe 1 · Etappe Y): Testmodus-Bündel mit Flow-Routinen, Posen nur zur
 * Anzeige (nie in der Plan-Engine), Lauf mit angepasster Routine, Tagebuch-Entwurf, Vorschlag „Erholungstag: Mobility“
 * und die Einstellung „Erholungs-Routine vorschlagen“ (save_app_layout).
 */
import {
  buildWorkoutTimerPlan,
  CONSERVATIVE_PLAN_RULES,
  type FlowSafetyInput,
  normalizeLayout,
  type PlanLibrary,
  prepareFlowWorkout,
  toStoredLayout,
  type Workout,
  workoutRunView,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import {
  NOW,
  planPersonRows,
  profile,
  rowsWith,
  seededBackend,
  TODAY,
  USER_ID,
} from '../test/fixtures';
import { isValidOp } from './local-rules';
import { recentActivitiesFromRows, recoverySuggestionFromRows } from './recovery-routine';
import type { AppLayoutRow, UserRows } from './types';
import { applyWriteOps } from './write-ops';
import { startActiveRun, workoutLogDraft } from './workout-run';

async function load(): Promise<{ library: PlanLibrary; workouts: readonly Workout[] }> {
  const { backend } = seededBackend(planPersonRows());
  const library = await backend.loadPlanLibrary({ allowCached: false });
  if (!library) throw new Error('Bibliothek fehlt');
  return { library, workouts: (await backend.loadWorkoutLibrary()).workouts };
}

const APPLY = { now: NOW, newId: () => 'id', flagsFor: () => [], today: TODAY };
const OPEN: FlowSafetyInput = { excludedCautionTags: [], pain: null, holdCap: false };
const CAUTIOUS: FlowSafetyInput = {
  excludedCautionTags: [...CONSERVATIVE_PLAN_RULES.excludedCautionTags, 'long_supine'],
  pain: null,
  holdCap: true,
};

describe('Testmodus: Flow-Routinen und Posen', () => {
  it('Bündel enthält die Flow-Entwürfe; Posen stehen nur in displayExercises', async () => {
    const { library, workouts } = await load();
    const flows = workouts.filter((w) => w.format === 'flow');
    expect(flows.length).toBeGreaterThanOrEqual(14);
    expect(flows.every((w) => w.status === 'draft')).toBe(true);
    expect(library.exercises.has('yoga-baum')).toBe(false);
    expect(library.displayExercises?.has('yoga-baum')).toBe(true);
    // Vorhandene Dehnungen bleiben normale Übungen.
    expect(library.exercises.has('katze-kuh')).toBe(true);
  });

  it('Lauf mit angepasster Routine: Seitenwechsel, Tagebuch-Entwurf mit Posen', async () => {
    const { library, workouts } = await load();
    const lookup = library.displayExercises ?? library.exercises;
    const morning = workouts.find((w) => w.id === 'yoga-sanft-in-den-morgen');
    if (!morning) throw new Error('Routine fehlt');
    const prepared = prepareFlowWorkout(morning, CAUTIOUS, lookup);
    expect(prepared.swapped.map((s) => s.toId)).toContain('yoga-hund-an-der-wand');
    const active = startActiveRun({
      ownerUserId: USER_ID,
      workout: prepared.workout,
      nowMs: 0,
      newId: () => '00000000-0000-4000-8000-0000000000aa',
    });
    expect(active.workout).toBe(prepared.workout);
    expect(active.steps.some((s) => s.kind === 'work' && s.side === 'left')).toBe(true);
    const later = 10 * 60 * 1000;
    const { run } = workoutRunView(active.steps, active.run, later);
    const result = workoutLogDraft({
      active: { ...active, run },
      workout: prepared.workout,
      exercises: lookup,
      nowMs: later,
      today: TODAY,
      sessionRpe: null,
      userNote: '',
      newId: () => '00000000-0000-4000-8000-0000000000bb',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.notes).toContain('Posen');
    expect(result.draft.exercises.map((e) => e.planned.exerciseId)).toContain(
      'yoga-hund-an-der-wand',
    );
    // Andere Formate: kein `workout` im Lauf (unverändert wie bisher).
    const circuit = workouts.find((w) => w.format === 'circuit');
    if (circuit) {
      expect(
        startActiveRun({ ownerUserId: USER_ID, workout: circuit, nowMs: 0, newId: () => 'x' }),
      ).not.toHaveProperty('workout');
      expect(buildWorkoutTimerPlan(circuit).every((s) => !('side' in s))).toBe(true);
    }
  });
});

describe('Erholungstag: Mobility (Heute-Karte)', () => {
  const plan = { id: 'p1', status: 'active' } as UserRows['plans'][number];
  const session = (scheduled_on: string, status = 'planned', is_deload = false) =>
    ({ plan_id: 'p1', scheduled_on, status, is_deload }) as UserRows['plannedSessions'][number];

  it('trainingsfreier Tag → Vorschlag; Trainingstag, ohne Plan, abgeschaltet → keiner', async () => {
    const { library, workouts } = await load();
    const exercises = library.displayExercises ?? library.exercises;
    const base = { today: TODAY, workouts, exercises, safety: OPEN };
    const rest = rowsWith({ plans: [plan], plannedSessions: [session('2026-10-02')] });
    const suggestion = recoverySuggestionFromRows({ ...base, rows: rest });
    expect(suggestion?.workoutId).toBe('erholungstag-15');
    expect(recoverySuggestionFromRows({ ...base, rows: rowsWith() })).toBeNull();
    expect(
      recoverySuggestionFromRows({
        ...base,
        rows: rowsWith({ plans: [plan], plannedSessions: [session(TODAY)] }),
      }),
    ).toBeNull();
    const off: AppLayoutRow = {
      user_id: USER_ID,
      ...toStoredLayout(normalizeLayout(null), null, false),
    };
    expect(recoverySuggestionFromRows({ ...base, rows: { ...rest, appLayout: off } })).toBeNull();
    // Erholungswoche, heutige Einheit erledigt → Vorschlag.
    const deload = rowsWith({
      plans: [plan],
      plannedSessions: [session(TODAY, 'completed', true)],
    });
    expect(recoverySuggestionFromRows({ ...base, rows: deload })?.day).toBe('deload');
  });

  it('Tagebuch → Aktivitäten (Kraft-Übungen, Ausdauer-Art)', () => {
    const rows = rowsWith({
      sessionLogs: [
        { id: 'a', performed_on: TODAY } as UserRows['sessionLogs'][number],
        { id: 'b', performed_on: TODAY } as UserRows['sessionLogs'][number],
      ],
      exerciseLogs: [
        { session_log_id: 'a', exercise_id: 'kniebeuge-koerpergewicht' },
      ] as UserRows['exerciseLogs'],
      cardioLogs: [{ session_log_id: 'b', modality: 'run' }] as UserRows['cardioLogs'],
    });
    expect(recentActivitiesFromRows(rows)).toEqual([
      { performedOn: TODAY, exerciseIds: ['kniebeuge-koerpergewicht'], enduranceModality: null },
      { performedOn: TODAY, exerciseIds: [], enduranceModality: 'run' },
    ]);
  });
});

describe('Einstellung „Erholungs-Routine vorschlagen“ (save_app_layout)', () => {
  const layout = normalizeLayout(null);
  const row = (extra: Partial<AppLayoutRow> = {}): AppLayoutRow => ({
    user_id: USER_ID,
    ...toStoredLayout(layout),
    ...extra,
  });

  it('Regeln wie save_app_layout: Wahrheitswert erlaubt', () => {
    const ctx = { today: TODAY, profile: profile() };
    expect(isValidOp({ kind: 'save_app_layout', row: row({ recovery_routine: false }) }, ctx)).toBe(
      true,
    );
    expect(isValidOp({ kind: 'save_app_layout', row: row() }, ctx)).toBe(true);
  });

  it('ohne Feld bleibt die gespeicherte Einstellung (wie Schrittziel)', () => {
    const off = applyWriteOps(
      rowsWith(),
      [{ kind: 'save_app_layout', row: row({ recovery_routine: false }) }],
      APPLY,
    );
    expect(off.appLayout?.recovery_routine).toBe(false);
    const kept = applyWriteOps(off, [{ kind: 'save_app_layout', row: row() }], APPLY);
    expect(kept.appLayout?.recovery_routine).toBe(false);
  });
});
