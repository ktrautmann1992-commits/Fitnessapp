import { describe, expect, it } from 'vitest';

import { planInputsSchema, planInputsSnapshot } from './inputs';
import {
  activePlan,
  allSessions,
  type PlannedExerciseRow,
  type PlannedSessionRow,
  planSnapshot,
  profilesFor,
  storedSessionFromRows,
} from './rows';
import { person } from './test-library';

/** Plan-Zeilen → Eingaben der Engine (Etappe A0, PLAN-PHASE-4B 5.1): reine Abbildung, keine Regeln. */

function session(
  id: string,
  date: string,
  overrides: Partial<PlannedSessionRow> = {},
): PlannedSessionRow {
  return {
    id,
    user_id: 'u1',
    plan_id: 'p1',
    block_no: 1,
    week_no: 1,
    is_intro_week: false,
    is_deload: false,
    kind: 'strength',
    template_day_index: 0,
    scheduled_on: date,
    original_date: null,
    status: 'planned',
    name_de: `Einheit ${id}`,
    focus: 'full_body',
    endurance_modality: null,
    effort_target: null,
    estimated_minutes: 45,
    warmup_de: 'Aufwärmen',
    cooldown_de: 'Abwärmen',
    ...overrides,
  };
}

function exercise(
  id: string,
  sessionId: string,
  orderNo: number,
  overrides: Partial<PlannedExerciseRow> = {},
): PlannedExerciseRow {
  return {
    id,
    user_id: 'u1',
    session_id: sessionId,
    order_no: orderNo,
    exercise_id: `uebung-${id}`,
    source_exercise_id: `quelle-${id}`,
    exercise_name_de: `Übung ${id}`,
    sets: 3,
    reps_min: 8,
    reps_max: 12,
    duration_s: null,
    rest_s: 90,
    rpe_target: 8,
    superset_group: null,
    notes_de: null,
    target_weight_kg: null,
    ...overrides,
  };
}

const plan = (id: string, status: 'active' | 'replaced', extra = 'x') => ({ id, status, extra });

describe('storedSessionFromRows', () => {
  it('übernimmt alle Spalten, Übungen nur dieser Einheit, nach order_no; ohne id/user_id/session_id', () => {
    const s = session('s1', '2026-10-05', {
      status: 'completed',
      original_date: '2026-10-04',
      is_intro_week: true,
      focus: null,
    });
    const stored = storedSessionFromRows(
      [
        exercise('b', 's1', 2, { target_weight_kg: 20, superset_group: 'A', notes_de: 'langsam' }),
        exercise('fremd', 's2', 1),
        exercise('a', 's1', 1, { duration_s: 30, reps_min: null, reps_max: null }),
      ],
      s,
    );
    const expected: Record<string, unknown> = { ...s, exercises: expect.any(Array) };
    delete expected.user_id;
    delete expected.plan_id;
    expect(stored).toEqual(expected);
    expect(stored.exercises.map((e) => e.exercise_id)).toEqual(['uebung-a', 'uebung-b']);
    expect(stored.exercises[0]).toEqual({
      order_no: 1,
      exercise_id: 'uebung-a',
      source_exercise_id: 'quelle-a',
      exercise_name_de: 'Übung a',
      sets: 3,
      reps_min: null,
      reps_max: null,
      duration_s: 30,
      rest_s: 90,
      rpe_target: 8,
      superset_group: null,
      notes_de: null,
      target_weight_kg: null,
    });
    expect(stored.exercises[1]).toMatchObject({
      target_weight_kg: 20,
      superset_group: 'A',
      notes_de: 'langsam',
    });
  });

  it('Ausdauer-Einheit ohne Übungen → leere Liste', () => {
    const s = session('e1', '2026-10-06', {
      kind: 'endurance',
      focus: null,
      endurance_modality: 'run',
      effort_target: 3,
    });
    const stored = storedSessionFromRows([], s);
    expect(stored.exercises).toEqual([]);
    expect(stored).toMatchObject({
      kind: 'endurance',
      endurance_modality: 'run',
      effort_target: 3,
    });
  });
});

describe('activePlan / allSessions', () => {
  const rows = {
    plans: [plan('alt', 'replaced'), plan('p1', 'active')],
    plannedSessions: [
      session('mi', '2026-10-07'),
      session('alt1', '2026-09-30', { plan_id: 'alt' }),
      session('mo', '2026-10-05'),
    ],
    plannedExercises: [exercise('x', 'mo', 1)],
  };

  it('kein aktiver Plan → null (auch ohne Pläne)', () => {
    expect(activePlan({ ...rows, plans: [plan('alt', 'replaced')] })).toBeNull();
    expect(activePlan({ plans: [], plannedSessions: [], plannedExercises: [] })).toBeNull();
  });

  it('aktiver Plan: Zeile unverändert durchgereicht, nur seine Einheiten, nach Datum', () => {
    const active = activePlan(rows);
    expect(active?.plan).toBe(rows.plans[1]);
    expect(active?.plan.extra).toBe('x');
    expect(active?.sessions.map((s) => s.id)).toEqual(['mo', 'mi']);
    expect(active?.sessions[0]?.exercises).toHaveLength(1);
    // Eingabe unverändert (keine Sortierung an Ort und Stelle).
    expect(rows.plannedSessions.map((s) => s.id)).toEqual(['mi', 'alt1', 'mo']);
  });

  it('aktiver Plan ohne Einheiten → leere Liste', () => {
    expect(activePlan({ ...rows, plannedSessions: [] })?.sessions).toEqual([]);
  });

  it('allSessions: alle Pläne, nach Datum, Eingabe unverändert', () => {
    expect(allSessions(rows).map((s) => s.id)).toEqual(['alt1', 'mo', 'mi']);
    expect(rows.plannedSessions.map((s) => s.id)).toEqual(['mi', 'alt1', 'mo']);
    expect(allSessions({ plannedSessions: [], plannedExercises: [] })).toEqual([]);
  });
});

describe('planSnapshot / profilesFor', () => {
  const snapshot = planInputsSnapshot(planInputsSchema.parse(person()));

  it('gültige user_plans.inputs → Schnappschuss; unlesbar → null', () => {
    expect(planSnapshot({ inputs: snapshot })).toEqual(snapshot);
    expect(planSnapshot({ inputs: null })).toBeNull();
    expect(planSnapshot({ inputs: { ...snapshot, goalType: 'unbekannt' } })).toBeNull();
    expect(planSnapshot({ inputs: { ...snapshot, sessionsPerWeek: 3 } })).toBeNull();
  });

  it('Geräte-Profile: Studio und Zuhause; ohne Schnappschuss Zuhause leer', () => {
    const none = profilesFor(null);
    expect([...none.keys()]).toEqual(['gym', 'home']);
    expect(none.get('home')?.available.size).toBe(0);
    expect(none.get('gym')?.available.size).toBeGreaterThan(0);
  });

  it('Geräte-Profile: Heim-Geräte mit Gewichten; unbekannte Geräte-IDs fallen weg', () => {
    const profiles = profilesFor({
      ...snapshot,
      homeEquipment: [
        { equipmentId: 'dumbbells', weightsKg: [10, 12.5], barKg: null },
        { equipmentId: 'gibt-es-nicht', weightsKg: [], barKg: null },
      ],
    });
    expect([...(profiles.get('home')?.available ?? [])]).toEqual(['dumbbells']);
  });
});
