import { describe, expect, it } from 'vitest';

import type { PlannedSessionRow, PlanRowRef } from '../plan/rows';
import {
  type ApplyLogMeta,
  applySessionLog,
  closeMissedSessionRows,
  deleteHealthPlanLogRows,
  deleteSessionLogRows,
  detachLogs,
  EMPTY_LOG_ROWS,
  type ExerciseLogRow,
  logEntriesFromRows,
  logForSession,
  type LogAndPlanRows,
  logRowsOf,
  mergeLogRows,
  neutralizeHealthPlanLogRows,
  removeSessionLog,
  type SessionLogRow,
  type SetLogRow,
  startWeightsFromRows,
} from './rows';
import type { SessionLogPayload } from './schemas';

/**
 * Tagebuch als Zeilen (Etappe A0, PLAN-PHASE-4B 5.1): Eintrag ↔ Tabellen wie die Datenbank-Funktionen, Zeilen →
 * Eingaben der Progression. Reine Abbildung; die App-Tests (apps/mobile/src/data/log-rows.test.ts) laufen
 * unverändert weiter über dieselben Funktionen.
 */

const U = 'u1';

function plannedSession(
  id: string,
  date: string,
  overrides: Partial<PlannedSessionRow> = {},
): PlannedSessionRow {
  return {
    id,
    user_id: U,
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
    name_de: 'A',
    focus: 'full_body',
    endurance_modality: null,
    effort_target: null,
    estimated_minutes: 45,
    warmup_de: '',
    cooldown_de: '',
    ...overrides,
  };
}

function sessionLog(
  id: string,
  plannedSessionId: string | null,
  date: string,
  overrides: Partial<SessionLogRow> = {},
): SessionLogRow {
  return {
    id,
    user_id: U,
    planned_session_id: plannedSessionId,
    kind: 'strength',
    performed_on: date,
    started_at: null,
    finished_at: `${date}T18:00:00Z`,
    status: 'completed',
    session_rpe: null,
    notes: null,
    name_de: 'Ganzkörper A',
    is_intro_week: false,
    is_deload: false,
    from_health_plan: false,
    revision: 1,
    last_write_id: 'w',
    source: 'manual',
    client_updated_at: `${date}T18:00:00Z`,
    created_at: `${date}T18:00:00Z`,
    updated_at: `${date}T18:00:00Z`,
    ...overrides,
  };
}

function exerciseLog(
  id: string,
  logId: string,
  overrides: Partial<ExerciseLogRow> = {},
): ExerciseLogRow {
  return {
    id,
    session_log_id: logId,
    user_id: U,
    order_no: 1,
    planned_exercise_id: null,
    exercise_id: 'goblet-kniebeuge',
    exercise_name_de: 'Goblet-Kniebeuge',
    load_type: 'weight',
    status: 'done',
    target_sets: 3,
    reps_min: 8,
    reps_max: 12,
    target_reps: 8,
    target_extra_set: false,
    target_weight_kg: 20,
    target_duration_s: null,
    target_rpe: 8,
    state_weight_kg: 20,
    state_target_reps: 8,
    state_extra_set: false,
    state_duration_s: null,
    weight_confirmed: true,
    is_return: false,
    ...overrides,
  };
}

function set(exerciseLogId: string, setNo: number, reps = 8): SetLogRow {
  return {
    exercise_log_id: exerciseLogId,
    user_id: U,
    set_no: setNo,
    reps,
    weight_kg: 20,
    duration_s: null,
    rpe: null,
    done: true,
  };
}

function empty(): LogAndPlanRows & { plannedExercises: { id: string }[] } {
  return {
    plans: [],
    plannedSessions: [],
    plannedExercises: [],
    sessionLogs: [],
    exerciseLogs: [],
    setLogs: [],
    cardioLogs: [],
  };
}

const payload = (overrides: Partial<SessionLogPayload> = {}): SessionLogPayload => ({
  id: 'l1',
  write_id: 'w2',
  base_revision: null,
  planned_session_id: 'mo',
  planned_date: '2026-10-05',
  kind: 'strength',
  performed_on: '2026-10-05',
  started_at: '2026-10-05T17:00:00Z',
  finished_at: '2026-10-05T18:00:00Z',
  status: 'completed',
  session_rpe: 7,
  notes: null,
  name_de: 'Ganzkörper A',
  is_intro_week: false,
  is_deload: false,
  source: 'manual',
  client_updated_at: '2026-10-05T18:00:00Z',
  cardio: null,
  exercises: [
    {
      id: 'e1',
      order_no: 1,
      planned_exercise_id: 'pe1',
      exercise_id: 'goblet-kniebeuge',
      exercise_name_de: 'Goblet-Kniebeuge',
      load_type: 'weight',
      status: 'done',
      target_sets: 3,
      reps_min: 8,
      reps_max: 12,
      target_reps: 8,
      target_extra_set: false,
      target_weight_kg: 20,
      target_duration_s: null,
      target_rpe: 8,
      state_weight_kg: 20,
      state_target_reps: 8,
      state_extra_set: false,
      state_duration_s: null,
      weight_confirmed: true,
      is_return: false,
      sets: [2, 1].map((set_no) => ({
        set_no,
        reps: 8,
        weight_kg: 20,
        duration_s: null,
        rpe: null,
        done: true,
      })),
    },
  ],
  ...overrides,
});

const meta = (overrides: Partial<ApplyLogMeta> = {}): ApplyLogMeta => ({
  userId: U,
  linked: true,
  keepTargets: true,
  fromHealthPlan: false,
  id: 'l1',
  revision: 1,
  now: '2026-10-05T18:30:00Z',
  isIntroWeek: false,
  isDeload: false,
  ...overrides,
});

describe('applySessionLog', () => {
  it('neu, verknüpft, mit Vorgaben: Zeilen wie save_session_log, geplante Einheit erledigt', () => {
    const rows = { ...empty(), plannedSessions: [plannedSession('mo', '2026-10-05')] };
    const next = applySessionLog(rows, payload(), meta());
    expect(next.sessionLogs).toEqual([
      expect.objectContaining({
        id: 'l1',
        user_id: U,
        planned_session_id: 'mo',
        name_de: 'Ganzkörper A',
        revision: 1,
        last_write_id: 'w2',
        created_at: '2026-10-05T18:30:00Z',
        updated_at: '2026-10-05T18:30:00Z',
      }),
    ]);
    expect(next.exerciseLogs[0]).toMatchObject({
      planned_exercise_id: 'pe1',
      target_weight_kg: 20,
      state_target_reps: 8,
    });
    expect(next.setLogs.map((s) => s.set_no)).toEqual([2, 1]);
    expect(next.cardioLogs).toEqual([]);
    expect(next.plannedSessions[0]?.status).toBe('completed');
    // Eingabe unverändert.
    expect(rows.sessionLogs).toEqual([]);
    expect(rows.plannedSessions[0]?.status).toBe('planned');
  });

  it('auch übersprungene geplante Einheit wird erledigt (W8)', () => {
    const rows = {
      ...empty(),
      plannedSessions: [plannedSession('mo', '2026-10-05', { status: 'skipped' })],
    };
    expect(applySessionLog(rows, payload(), meta()).plannedSessions[0]?.status).toBe('completed');
  });

  it('ersetzen: alte Übungen/Sätze weg, created_at bleibt, Zeitstempel des Geräts höchstens „jetzt“', () => {
    const first = applySessionLog(
      { ...empty(), plannedSessions: [plannedSession('mo', '2026-10-05')] },
      payload(),
      meta(),
    );
    const next = applySessionLog(
      first,
      payload({
        client_updated_at: '2030-01-01T00:00:00Z',
        exercises: [{ ...payload().exercises[0]!, id: 'e2', sets: [] }],
      }),
      meta({ revision: 2, now: '2026-10-06T08:00:00Z' }),
    );
    expect(next.sessionLogs).toHaveLength(1);
    expect(next.sessionLogs[0]).toMatchObject({
      revision: 2,
      created_at: '2026-10-05T18:30:00Z',
      updated_at: '2026-10-06T08:00:00Z',
      client_updated_at: '2026-10-06T08:00:00Z',
    });
    expect(next.exerciseLogs.map((e) => e.id)).toEqual(['e2']);
    expect(next.setLogs).toEqual([]);
  });

  it('nicht verknüpft und ohne Vorgaben: Verweise leer, Vorgaben/Zustand leer, Name neutral, Ist-Werte bleiben', () => {
    const rows = { ...empty(), plannedSessions: [plannedSession('mo', '2026-10-05')] };
    const next = applySessionLog(rows, payload(), meta({ linked: false, keepTargets: false }));
    expect(next.sessionLogs[0]?.planned_session_id).toBeNull();
    expect(next.sessionLogs[0]?.name_de).not.toBe('Ganzkörper A');
    const e = next.exerciseLogs[0]!;
    expect(e.planned_exercise_id).toBeNull();
    expect([
      e.target_sets,
      e.reps_min,
      e.reps_max,
      e.target_reps,
      e.target_extra_set,
      e.target_weight_kg,
      e.target_duration_s,
      e.target_rpe,
      e.state_weight_kg,
      e.state_target_reps,
      e.state_extra_set,
      e.state_duration_s,
    ]).toEqual(Array(12).fill(null));
    expect(e.weight_confirmed).toBe(true);
    expect(next.setLogs).toHaveLength(2);
    expect(next.plannedSessions).toBe(rows.plannedSessions);
  });

  it('Ausdauer: eine cardio_logs-Zeile, Kennzeichen aus meta (Server-Wahrheit)', () => {
    const next = applySessionLog(
      empty(),
      payload({
        kind: 'endurance',
        exercises: [],
        cardio: { modality: 'run', duration_s: 1800, distance_m: 5000, elevation_m: null },
        is_deload: false,
      }),
      meta({ linked: false, isDeload: true, isIntroWeek: true, fromHealthPlan: true }),
    );
    expect(next.cardioLogs).toEqual([
      {
        session_log_id: 'l1',
        user_id: U,
        modality: 'run',
        duration_s: 1800,
        distance_m: 5000,
        elevation_m: null,
      },
    ]);
    expect(next.sessionLogs[0]).toMatchObject({
      is_deload: true,
      is_intro_week: true,
      from_health_plan: true,
    });
  });
});

describe('Löschen und Verweise', () => {
  const base = () => ({
    ...empty(),
    plans: [{ id: 'p1', status: 'active' }] as PlanRowRef[],
    plannedSessions: [
      plannedSession('mo', '2026-10-05', { status: 'completed' }),
      plannedSession('mi', '2026-10-07'),
    ],
    sessionLogs: [sessionLog('l1', 'mo', '2026-10-05'), sessionLog('l2', null, '2026-10-06')],
    exerciseLogs: [exerciseLog('e1', 'l1'), exerciseLog('e2', 'l2')],
    setLogs: [set('e1', 1), set('e2', 1)],
    cardioLogs: [
      {
        session_log_id: 'l1',
        user_id: U,
        modality: 'run' as const,
        duration_s: 60,
        distance_m: null,
        elevation_m: null,
      },
    ],
  });

  it('removeSessionLog: Kaskade nur für diesen Eintrag; unbekannte id ändert nichts', () => {
    const next = removeSessionLog(base(), 'l1');
    expect(next.sessionLogs.map((l) => l.id)).toEqual(['l2']);
    expect(next.exerciseLogs.map((e) => e.id)).toEqual(['e2']);
    expect(next.setLogs.map((s) => s.exercise_log_id)).toEqual(['e2']);
    expect(next.cardioLogs).toEqual([]);
    expect(next.plannedSessions).toHaveLength(2);
    expect(removeSessionLog(base(), 'gibt-es-nicht')).toEqual(base());
  });

  it('deleteSessionLogRows: unbekannt → dieselben Zeilen; ohne Einheit nur weg', () => {
    const rows = base();
    expect(deleteSessionLogRows(rows, 'x', '2026-10-06')).toBe(rows);
    const next = deleteSessionLogRows(rows, 'l2', '2026-10-06');
    expect(next.sessionLogs.map((l) => l.id)).toEqual(['l1']);
    expect(next.plannedSessions).toEqual(rows.plannedSessions);
  });

  it('deleteSessionLogRows: Woche läuft (letzter Tag = heute), Tag frei, Plan aktiv → wieder geplant', () => {
    expect(
      deleteSessionLogRows(base(), 'l1', '2026-10-11').plannedSessions.find((s) => s.id === 'mo')
        ?.status,
    ).toBe('planned');
  });

  it('deleteSessionLogRows: andere Einheit am selben Tag erledigt oder gestrichen → Tag gilt als frei', () => {
    for (const other of ['completed', 'skipped'] as const) {
      const rows = base();
      rows.plannedSessions.push(plannedSession('mo2', '2026-10-05', { status: other }));
      const next = deleteSessionLogRows(rows, 'l1', '2026-10-06');
      expect(next.plannedSessions.find((s) => s.id === 'mo')?.status).toBe('planned');
      expect(next.plannedSessions.find((s) => s.id === 'mo2')?.status).toBe(other);
    }
  });

  it('deleteSessionLogRows: Woche vorbei, Tag belegt oder Plan ersetzt → gestrichen', () => {
    const status = (rows: ReturnType<typeof base>, today: string) =>
      deleteSessionLogRows(rows, 'l1', today).plannedSessions.find((s) => s.id === 'mo')?.status;
    expect(status(base(), '2026-10-12')).toBe('skipped');
    const busy = base();
    busy.plannedSessions.push(plannedSession('mo2', '2026-10-05'));
    expect(status(busy, '2026-10-06')).toBe('skipped');
    expect(status({ ...base(), plans: [{ id: 'p1', status: 'replaced' }] }, '2026-10-06')).toBe(
      'skipped',
    );
    // Ursprungstag zählt für die Woche (verschoben in die Folgewoche bleibt Woche des Ursprungs).
    const moved = base();
    moved.plannedSessions[0] = plannedSession('mo', '2026-10-12', {
      status: 'completed',
      original_date: '2026-10-05',
    });
    expect(status(moved, '2026-10-12')).toBe('skipped');
  });

  it('detachLogs: Verweise auf fehlende Einheiten/Übungen werden null, Einträge bleiben', () => {
    const rows = {
      ...base(),
      plannedSessions: [],
      plannedExercises: [{ id: 'pe-da' }],
      exerciseLogs: [
        exerciseLog('e1', 'l1', { planned_exercise_id: 'pe-weg' }),
        exerciseLog('e2', 'l2', { planned_exercise_id: 'pe-da' }),
      ],
    };
    const next = detachLogs(rows);
    expect(next.sessionLogs.map((l) => l.planned_session_id)).toEqual([null, null]);
    expect(next.exerciseLogs.map((e) => e.planned_exercise_id)).toEqual([null, 'pe-da']);
    expect(next.sessionLogs[0]).not.toBe(rows.sessionLogs[0]);
    expect(next.sessionLogs[1]).toBe(rows.sessionLogs[1]);
  });
});

describe('Gesundheits-Check-Einträge (S1)', () => {
  const rows = () => ({
    ...empty(),
    sessionLogs: [
      sessionLog('h', null, '2026-10-05', { from_health_plan: true }),
      sessionLog('n', null, '2026-10-06'),
    ],
    exerciseLogs: [exerciseLog('eh', 'h'), exerciseLog('en', 'n')],
    setLogs: [set('eh', 1, 9), set('en', 1)],
  });

  it('ohne Gesundheits-Einträge → dieselben Zeilen', () => {
    const plain = { ...empty(), sessionLogs: [sessionLog('n', null, '2026-10-06')] };
    expect(neutralizeHealthPlanLogRows(plain)).toBe(plain);
    expect(deleteHealthPlanLogRows(plain)).toEqual(plain);
  });

  it('neutralisieren: Vorgaben/Zustand leer, Name neutral, Kennzeichen false; Ist-Werte und andere bleiben', () => {
    const before = rows();
    const next = neutralizeHealthPlanLogRows(before);
    expect(next.sessionLogs[0]).toMatchObject({ from_health_plan: false });
    expect(next.sessionLogs[0]?.name_de).not.toBe('Ganzkörper A');
    expect(next.exerciseLogs[0]).toMatchObject({
      target_weight_kg: null,
      state_weight_kg: null,
      target_rpe: null,
      exercise_id: 'goblet-kniebeuge',
      weight_confirmed: true,
    });
    expect(next.exerciseLogs[1]).toBe(before.exerciseLogs[1]);
    expect(next.sessionLogs[1]).toBe(before.sessionLogs[1]);
    expect(next.setLogs).toBe(before.setLogs);
  });

  it('löschen: nur Gesundheits-Einträge samt Kaskade', () => {
    const next = deleteHealthPlanLogRows(rows());
    expect(next.sessionLogs.map((l) => l.id)).toEqual(['n']);
    expect(next.exerciseLogs.map((e) => e.id)).toEqual(['en']);
    expect(next.setLogs.map((s) => s.exercise_log_id)).toEqual(['en']);
  });
});

describe('closeMissedSessionRows', () => {
  const rows = () => ({
    plans: [
      { id: 'p1', status: 'active' as const },
      { id: 'alt', status: 'replaced' as const },
    ],
    plannedSessions: [
      plannedSession('mo', '2026-10-05'),
      plannedSession('fertig', '2026-10-06', { status: 'completed' }),
      plannedSession('alt', '2026-09-28', { plan_id: 'alt' }),
      plannedSession('verschoben', '2026-10-12', { original_date: '2026-10-05' }),
    ],
  });

  it('Woche läuft noch (Sonntag = heute) bzw. kein aktiver Plan → dieselben Zeilen', () => {
    const r = rows();
    expect(closeMissedSessionRows(r, '2026-10-11')).toBe(r);
    const none = { ...rows(), plans: [] };
    expect(closeMissedSessionRows(none, '2030-01-01')).toBe(none);
  });

  it('nach Wochenende: nur geplante Einheiten des aktiven Plans, Woche nach Ursprungstag', () => {
    const next = closeMissedSessionRows(rows(), '2026-10-12');
    expect(next.plannedSessions.map((s) => [s.id, s.status])).toEqual([
      ['mo', 'skipped'],
      ['fertig', 'completed'],
      ['alt', 'planned'],
      ['verschoben', 'skipped'],
    ]);
  });
});

describe('Zeilen → Eingaben der Progression', () => {
  const rows = () => ({
    sessionLogs: [
      sessionLog('l1', 'mo', '2026-10-05', { is_intro_week: true }),
      sessionLog('l2', null, '2026-10-07', {
        finished_at: null,
        client_updated_at: '2026-10-07T09:00:00Z',
        is_deload: true,
      }),
    ],
    exerciseLogs: [
      exerciseLog('e1', 'l1', { is_return: true }),
      exerciseLog('e2', 'l2', {
        state_weight_kg: null,
        state_target_reps: null,
        state_extra_set: null,
        state_duration_s: null,
      }),
      exerciseLog('e3', 'l2', {
        state_extra_set: null,
        state_weight_kg: null,
        state_target_reps: null,
        state_duration_s: 45,
        load_type: 'time',
      }),
      exerciseLog('verwaist', 'gibt-es-nicht'),
    ],
    setLogs: [set('e1', 3, 6), set('e1', 1, 10), set('e1', 2, 8)],
  });

  it('leer → leer', () => {
    expect(logEntriesFromRows(EMPTY_LOG_ROWS)).toEqual([]);
  });

  it('Sätze nach set_no, Kennzeichen, Zustand; verwaiste Übungs-Zeilen fallen weg', () => {
    const entries = logEntriesFromRows(rows());
    expect(entries).toHaveLength(3);
    const [first, second, third] = entries;
    expect(first).toMatchObject({
      exerciseId: 'goblet-kniebeuge',
      performedOn: '2026-10-05',
      loggedAt: '2026-10-05T18:00:00Z',
      isIntroWeek: true,
      isDeload: false,
      isReturn: true,
      targetSets: 3,
      targetWeightKg: 20,
      targetReps: 8,
      targetExtraSet: false,
      targetRpe: 8,
      weightConfirmed: true,
      state: { weightKg: 20, targetReps: 8, extraSet: false, durationS: null },
    });
    expect(first?.sets.map((s) => s.reps)).toEqual([10, 8, 6]);
    expect(first?.sets[0]).toEqual({
      reps: 10,
      weightKg: 20,
      durationS: null,
      rpe: null,
      done: true,
    });
    // Ohne finished_at zählt client_updated_at; ohne state_* kein Zustand; extra_set null → false.
    expect(second).toMatchObject({ loggedAt: '2026-10-07T09:00:00Z', isDeload: true, state: null });
    expect(second?.sets).toEqual([]);
    expect(third?.state).toEqual({
      weightKg: null,
      targetReps: null,
      extraSet: false,
      durationS: 45,
    });
  });

  it('ausgeschlossener Eintrag (gerade in Bearbeitung) fehlt; Eingabe bleibt unsortiert', () => {
    const r = rows();
    expect(logEntriesFromRows(r, 'l1').map((e) => e.performedOn)).toEqual([
      '2026-10-07',
      '2026-10-07',
    ]);
    expect(r.setLogs.map((s) => s.set_no)).toEqual([3, 1, 2]);
  });

  it('Startgewichte je Übung; leer → leere Map', () => {
    expect(startWeightsFromRows({ startWeights: [] }).size).toBe(0);
    const map = startWeightsFromRows({
      startWeights: [
        { exercise_id: 'a', user_id: U, weight_kg: 12.5, updated_at: '2026-10-01T00:00:00Z' },
        { exercise_id: 'b', user_id: U, weight_kg: 0, updated_at: '2026-10-01T00:00:00Z' },
      ],
    });
    expect([...map]).toEqual([
      ['a', 12.5],
      ['b', 0],
    ]);
  });

  it('logForSession: Eintrag zur geplanten Einheit oder null', () => {
    expect(logForSession(rows(), 'mo')?.id).toBe('l1');
    expect(logForSession(rows(), 'di')).toBeNull();
    expect(logForSession(EMPTY_LOG_ROWS, 'mo')).toBeNull();
  });
});

describe('Tagebuch-Zeilen auswählen und zusammenführen', () => {
  it('logRowsOf: nur die vier Tagebuch-Tabellen', () => {
    const rows = { ...empty(), sessionLogs: [sessionLog('l1', null, '2026-10-05')] };
    expect(Object.keys(logRowsOf(rows)).sort()).toEqual([
      'cardioLogs',
      'exerciseLogs',
      'sessionLogs',
      'setLogs',
    ]);
    expect(logRowsOf(rows).sessionLogs).toBe(rows.sessionLogs);
  });

  it('mergeLogRows: ohne Dubletten, bei gleicher id gewinnt der erste Stand; leer neutral', () => {
    const a = {
      ...EMPTY_LOG_ROWS,
      sessionLogs: [sessionLog('l1', null, '2026-10-05', { revision: 2 })],
      exerciseLogs: [exerciseLog('e1', 'l1')],
      setLogs: [set('e1', 1)],
    };
    const b = {
      ...EMPTY_LOG_ROWS,
      sessionLogs: [
        sessionLog('l1', null, '2026-10-05', { revision: 1 }),
        sessionLog('l0', null, '2026-08-01'),
      ],
      exerciseLogs: [exerciseLog('e1', 'l1'), exerciseLog('e0', 'l0')],
      setLogs: [set('e1', 1, 99), set('e1', 2), set('e0', 1)],
    };
    const merged = mergeLogRows(a, b);
    expect(merged.sessionLogs.map((l) => [l.id, l.revision])).toEqual([
      ['l1', 2],
      ['l0', 1],
    ]);
    expect(merged.exerciseLogs.map((e) => e.id)).toEqual(['e1', 'e0']);
    expect(merged.setLogs.map((s) => [s.exercise_log_id, s.set_no, s.reps])).toEqual([
      ['e1', 1, 8],
      ['e1', 2, 8],
      ['e0', 1, 8],
    ]);
    expect(mergeLogRows(EMPTY_LOG_ROWS, EMPTY_LOG_ROWS)).toEqual(EMPTY_LOG_ROWS);
    expect(mergeLogRows(a, EMPTY_LOG_ROWS)).toEqual(a);
  });
});
