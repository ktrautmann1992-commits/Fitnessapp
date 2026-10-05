import { describe, expect, it } from 'vitest';

import {
  codePointLength,
  exerciseStartWeightSchema,
  type SessionLogPayload,
  sessionLogPayloadSchema,
} from './schemas';

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const strength = (): SessionLogPayload => ({
  id: U(1),
  write_id: U(2),
  base_revision: null,
  planned_session_id: U(3),
  planned_date: '2026-10-05',
  kind: 'strength',
  performed_on: '2026-10-05',
  started_at: '2026-10-05T17:00:00+02:00',
  finished_at: '2026-10-05T18:00:00+02:00',
  status: 'completed',
  session_rpe: 7,
  notes: 'Griff etwas breiter',
  name_de: 'Ganzkörper A',
  is_intro_week: false,
  is_deload: false,
  source: 'manual',
  client_updated_at: '2026-10-05T16:00:00Z',
  cardio: null,
  exercises: [
    {
      id: U(10),
      order_no: 1,
      planned_exercise_id: U(11),
      exercise_id: 'db_bench_press',
      exercise_name_de: 'Kurzhantel-Bankdrücken',
      load_type: 'weight',
      status: 'done',
      target_sets: 3,
      reps_min: 8,
      reps_max: 12,
      target_reps: 10,
      target_extra_set: false,
      target_weight_kg: 22.5,
      target_duration_s: null,
      target_rpe: 8,
      state_weight_kg: 22.5,
      state_target_reps: 10,
      state_extra_set: false,
      state_duration_s: null,
      weight_confirmed: false,
      is_return: false,
      sets: [1, 2, 3].map((set_no) => ({
        set_no,
        reps: 10,
        weight_kg: 22.5,
        duration_s: null,
        rpe: 8.5,
        done: true,
      })),
    },
  ],
});

const endurance = (): SessionLogPayload => ({
  ...strength(),
  kind: 'endurance',
  name_de: 'Lockerer Dauerlauf',
  exercises: [],
  cardio: { modality: 'run', duration_s: 1800, distance_m: 5000, elevation_m: null },
});

const ok = (p: unknown) => sessionLogPayloadSchema.safeParse(p).success;

describe('sessionLogPayloadSchema (strikt, verschachtelt)', () => {
  it('gültige Kraft- und Ausdauer-Einträge', () => {
    expect(ok(strength())).toBe(true);
    expect(ok(endurance())).toBe(true);
  });

  it('unbekannte bzw. Server-Felder werden abgelehnt (from_health_plan, user_id, revision, Grund)', () => {
    expect(ok({ ...strength(), from_health_plan: true })).toBe(false);
    expect(ok({ ...strength(), user_id: U(9) })).toBe(false);
    expect(ok({ ...strength(), revision: 2 })).toBe(false);
    const p = strength();
    expect(ok({ ...p, exercises: [{ ...p.exercises[0], skip_reason: 'pain' }] })).toBe(false);
    expect(
      ok({
        ...p,
        exercises: [{ ...p.exercises[0], sets: [{ ...p.exercises[0]?.sets[0], note: 'x' }] }],
      }),
    ).toBe(false);
  });

  it('Art: Kraft mit Übungen ohne Ausdauer, Ausdauer ohne Übungen', () => {
    expect(ok({ ...strength(), exercises: [] })).toBe(false);
    expect(ok({ ...endurance(), cardio: null })).toBe(false);
    expect(ok({ ...endurance(), exercises: strength().exercises })).toBe(false);
  });

  it('Grenzen: Gewicht 0–500 (2 Nachkommastellen), Wdh. 0–100, Sätze 1–10, RPE 5–10 in 0,5', () => {
    const withSet = (patch: Record<string, unknown>) => {
      const p = strength();
      const e = p.exercises[0] as SessionLogPayload['exercises'][number];
      return { ...p, exercises: [{ ...e, sets: [{ ...e.sets[0], ...patch }] }] };
    };
    expect(ok(withSet({ weight_kg: 0 }))).toBe(true);
    expect(ok(withSet({ weight_kg: 500 }))).toBe(true);
    expect(ok(withSet({ weight_kg: 500.01 }))).toBe(false);
    expect(ok(withSet({ weight_kg: 22.555 }))).toBe(false);
    expect(ok(withSet({ reps: 0 }))).toBe(true);
    expect(ok(withSet({ reps: 100 }))).toBe(true);
    expect(ok(withSet({ reps: 101 }))).toBe(false);
    expect(ok(withSet({ rpe: 10 }))).toBe(true);
    expect(ok(withSet({ rpe: 9.25 }))).toBe(false);
    expect(ok(withSet({ rpe: 4.5 }))).toBe(false);
    expect(ok(withSet({ set_no: 11 }))).toBe(false);
    expect(ok(withSet({ duration_s: 30 }))).toBe(false); // Dauer nicht bei Gewichtsübung
    const p = strength();
    const e = p.exercises[0] as SessionLogPayload['exercises'][number];
    const tenSets = Array.from({ length: 10 }, (_, i) => ({ ...e.sets[0], set_no: i + 1 }));
    expect(ok({ ...p, exercises: [{ ...e, sets: tenSets }] })).toBe(true);
    expect(
      ok({ ...p, exercises: [{ ...e, sets: [...tenSets, { ...e.sets[0], set_no: 11 }] }] }),
    ).toBe(false);
    expect(ok({ ...p, exercises: [{ ...e, sets: [e.sets[0], e.sets[0]] }] })).toBe(false);
  });

  it('„nicht gemacht“ ohne Sätze, sonst mindestens einer', () => {
    const p = strength();
    const e = p.exercises[0] as SessionLogPayload['exercises'][number];
    expect(ok({ ...p, exercises: [{ ...e, status: 'skipped', sets: [] }] })).toBe(true);
    expect(ok({ ...p, exercises: [{ ...e, status: 'skipped' }] })).toBe(false);
    expect(ok({ ...p, exercises: [{ ...e, sets: [] }] })).toBe(false);
  });

  it('Alternative mit eigener Vorgabe und eigenem Zustand (R2)', () => {
    const p = strength();
    const e = p.exercises[0] as SessionLogPayload['exercises'][number];
    expect(ok({ ...p, exercises: [{ ...e, status: 'alternative' }] })).toBe(true);
    expect(ok({ ...p, exercises: [{ ...e, status: 'alternative', target_weight_kg: null }] })).toBe(
      true,
    );
  });

  it('Gewichtsübung: abgehakter Satz braucht Wiederholungen; exercise_id höchstens 100 Zeichen', () => {
    const p = strength();
    const e = p.exercises[0] as SessionLogPayload['exercises'][number];
    const noReps = { ...e, sets: [{ ...e.sets[0], reps: null }] };
    expect(ok({ ...p, exercises: [noReps] })).toBe(false);
    expect(
      ok({ ...p, exercises: [{ ...noReps, sets: [{ ...noReps.sets[0], done: false }] }] }),
    ).toBe(true);
    expect(ok({ ...p, exercises: [{ ...e, exercise_id: 'x'.repeat(100) }] })).toBe(true);
    expect(ok({ ...p, exercises: [{ ...e, exercise_id: 'x'.repeat(101) }] })).toBe(false);
  });

  it('Halteübung: Dauer, kein Gewicht; Körpergewicht: weder noch', () => {
    const p = strength();
    const e = p.exercises[0] as SessionLogPayload['exercises'][number];
    const hold = {
      ...e,
      load_type: 'time' as const,
      target_weight_kg: null,
      state_weight_kg: null,
      sets: [{ set_no: 1, reps: null, weight_kg: null, duration_s: 600, rpe: null, done: true }],
    };
    expect(ok({ ...p, exercises: [hold] })).toBe(true);
    expect(
      ok({ ...p, exercises: [{ ...hold, sets: [{ ...hold.sets[0], duration_s: 601 }] }] }),
    ).toBe(false);
    expect(ok({ ...p, exercises: [{ ...hold, sets: [{ ...hold.sets[0], weight_kg: 5 }] }] })).toBe(
      false,
    );
    const bw = {
      ...hold,
      load_type: 'bodyweight' as const,
      sets: [{ ...hold.sets[0], duration_s: null, reps: 10 }],
    };
    expect(ok({ ...p, exercises: [bw] })).toBe(true);
  });

  it('Notiz 280 Zeichen in Code-Points (Emoji = 1 Zeichen wie char_length)', () => {
    expect(codePointLength('💪')).toBe(1);
    expect(ok({ ...strength(), notes: '💪'.repeat(280) })).toBe(true);
    expect(ok({ ...strength(), notes: 'a'.repeat(281) })).toBe(false);
  });

  it('Belastungsempfinden 0–10 ganzzahlig, Zeitstempel, IDs, Ende nach Beginn', () => {
    expect(ok({ ...strength(), session_rpe: 0 })).toBe(true);
    expect(ok({ ...strength(), session_rpe: 10.5 })).toBe(false);
    expect(ok({ ...strength(), session_rpe: 11 })).toBe(false);
    expect(ok({ ...strength(), write_id: 'abc' })).toBe(false);
    expect(ok({ ...strength(), base_revision: 0 })).toBe(false);
    expect(ok({ ...strength(), base_revision: 3 })).toBe(true);
    expect(ok({ ...strength(), client_updated_at: '2026-10-05 16:00' })).toBe(false);
    expect(ok({ ...strength(), finished_at: '2026-10-05T16:00:00+02:00' })).toBe(false);
    expect(ok({ ...strength(), planned_session_id: null })).toBe(true);
  });

  it('Ausdauer: 1 min – 12 h, Distanz 0–500 km, Höhenmeter 0–10 000 m', () => {
    const c = (patch: Record<string, unknown>) => ({
      ...endurance(),
      cardio: { ...endurance().cardio, ...patch },
    });
    expect(ok(c({ duration_s: 60 }))).toBe(true);
    expect(ok(c({ duration_s: 59 }))).toBe(false);
    expect(ok(c({ duration_s: 43_200 }))).toBe(true);
    expect(ok(c({ duration_s: 43_201 }))).toBe(false);
    expect(ok(c({ distance_m: 0 }))).toBe(true);
    expect(ok(c({ distance_m: 500_001 }))).toBe(false);
    expect(ok(c({ elevation_m: 10_001 }))).toBe(false);
    expect(ok(c({ heart_rate: 150 }))).toBe(false); // keine Herzfrequenz (Phase 8)
  });

  it('höchstens 12 Übungen, Reihenfolge eindeutig', () => {
    const p = strength();
    const e = p.exercises[0] as SessionLogPayload['exercises'][number];
    const many = Array.from({ length: 13 }, (_, i) => ({ ...e, id: U(100 + i), order_no: i + 1 }));
    expect(
      ok({
        ...p,
        exercises: many.slice(0, 12).map((x) => ({ ...x, order_no: Math.min(x.order_no, 12) })),
      }),
    ).toBe(true);
    expect(ok({ ...p, exercises: many })).toBe(false);
    expect(ok({ ...p, exercises: [e, { ...e, id: U(50) }] })).toBe(false);
  });
});

describe('exerciseStartWeightSchema', () => {
  it('0,5–500 kg, strikt', () => {
    expect(exerciseStartWeightSchema.safeParse({ exercise_id: 'x', weight_kg: 0.5 }).success).toBe(
      true,
    );
    expect(exerciseStartWeightSchema.safeParse({ exercise_id: 'x', weight_kg: 500 }).success).toBe(
      true,
    );
    expect(exerciseStartWeightSchema.safeParse({ exercise_id: 'x', weight_kg: 501 }).success).toBe(
      false,
    );
    expect(exerciseStartWeightSchema.safeParse({ exercise_id: 'x', weight_kg: 0.4 }).success).toBe(
      false,
    );
    expect(
      exerciseStartWeightSchema.safeParse({ exercise_id: 'x', weight_kg: 20, user_id: 'u' })
        .success,
    ).toBe(false);
  });
});
