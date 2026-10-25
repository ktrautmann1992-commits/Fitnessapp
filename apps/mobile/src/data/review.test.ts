import { describe, expect, it } from 'vitest';

import { consent, NOW, rowsWith, seededBackend, USER_ID, VERSIONS } from '../test/fixtures';
import {
  desiredCalendarEvents,
  monthReviewInput,
  weightEntriesFromRows,
  weightTrendContext,
  weightTrendVisibility,
} from './review';
import type { UserRows } from './types';

function metric(date: string, weight: number | null): UserRows['bodyMetrics'][number] {
  return {
    id: `m-${date}`,
    user_id: USER_ID,
    measured_on: date,
    height_cm: weight === null ? 170 : null,
    weight_kg: weight,
    body_fat_pct: null,
    resting_heart_rate_bpm: null,
  } as UserRows['bodyMetrics'][number];
}

describe('weightTrendVisibility', () => {
  const rows = rowsWith();
  it('ohne Einwilligung: no_consent; „Kalorienzahlen aus“: ausgeblendet; sonst Gerät entscheidet', () => {
    expect(weightTrendVisibility({ rows, consentValid: false, hiddenOnDevice: false })).toBe(
      'no_consent',
    );
    const numbersOff = rowsWith({
      nutritionSetup: { show_energy_numbers: false } as UserRows['nutritionSetup'],
    });
    expect(
      weightTrendVisibility({ rows: numbersOff, consentValid: true, hiddenOnDevice: false }),
    ).toBe('hidden_by_numbers');
    expect(weightTrendVisibility({ rows, consentValid: true, hiddenOnDevice: true })).toBe(
      'hidden',
    );
    expect(weightTrendVisibility({ rows, consentValid: true, hiddenOnDevice: false })).toBe(
      'visible',
    );
  });
});

describe('weightTrendContext', () => {
  it('Wunschgewicht, Schwangerschaft (Gesundheits-Check oder Zyklus-Status), Fit im Alter', () => {
    const rows = rowsWith({
      weightGoal: { target_weight_kg: 70 } as UserRows['weightGoal'],
      goals: { goal_type: 'active_aging' } as UserRows['goals'],
    });
    const plain = weightTrendContext({ rows, answers: {}, versions: VERSIONS });
    expect(plain).toMatchObject({
      goal: { targetWeightKg: 70 },
      pregnancy: false,
      maxWeeklyLossFraction: 0.005,
      cycleHint: false,
    });
    expect(
      weightTrendContext({
        rows,
        answers: { healthScreening: { flags: ['pregnancy'] } } as never,
        versions: VERSIONS,
      }).pregnancy,
    ).toBe(true);
    expect(
      weightTrendContext({ rows, answers: {}, versions: VERSIONS, cyclePregnant: true }).pregnancy,
    ).toBe(true);
  });

  it('Zyklus-Hinweis nur mit gültiger Einwilligung cycle_data und nicht bei „männlich“', () => {
    const cycleConsent = {
      ...consent('health_data'),
      id: 'c-cycle',
      consent_type: 'cycle_data',
      version: VERSIONS.cycle_data ?? 1,
    } as UserRows['consents'][number];
    const rows = rowsWith({ consents: [cycleConsent] });
    expect(
      weightTrendContext({ rows, answers: { sex: 'female' } as never, versions: VERSIONS })
        .cycleHint,
    ).toBe(true);
    expect(
      weightTrendContext({ rows, answers: { sex: 'male' } as never, versions: VERSIONS }).cycleHint,
    ).toBe(false);
    expect(
      weightTrendContext({
        rows: rowsWith(),
        answers: { sex: 'female' } as never,
        versions: VERSIONS,
      }).cycleHint,
    ).toBe(false);
  });
});

describe('weightEntriesFromRows und Testmodus loadWeightHistory', () => {
  const rows = rowsWith({
    bodyMetrics: [metric('2026-09-01', 80), metric('2026-09-05', null), metric('2026-09-10', 79.5)],
  });
  it('nur Tage mit Gewicht', () => {
    expect(weightEntriesFromRows(rows)).toEqual([
      { date: '2026-09-01', weightKg: 80 },
      { date: '2026-09-10', weightKg: 79.5 },
    ]);
  });
  it('Testmodus: ab Datum, aufsteigend', async () => {
    const { backend } = seededBackend(rows);
    expect(await backend.loadWeightHistory('2026-09-02')).toEqual([
      { measured_on: '2026-09-10', weight_kg: 79.5 },
    ]);
  });
});

describe('monthReviewInput', () => {
  it('Sätze mit Datum aus dem Eintrag, Ausdauer mit Sportart, Essen nur wenn verfügbar', () => {
    const rows = rowsWith({
      sessionLogs: [{ id: 'l1', performed_on: '2026-10-02', planned_session_id: null } as never],
      exerciseLogs: [
        {
          id: 'e1',
          session_log_id: 'l1',
          exercise_id: 'sq',
          exercise_name_de: 'Kniebeuge',
        } as never,
      ],
      setLogs: [{ exercise_log_id: 'e1', weight_kg: 60, reps: 8, done: true } as never],
      cardioLogs: [{ session_log_id: 'l1', modality: 'run', distance_m: 5000 } as never],
    });
    const input = monthReviewInput({
      rows,
      month: '2026-10',
      today: '2026-10-25',
      foodLogAvailable: false,
      weight: null,
    });
    expect(input.sets).toEqual([
      {
        date: '2026-10-02',
        exerciseId: 'sq',
        exerciseName: 'Kniebeuge',
        weightKg: 60,
        reps: 8,
        done: true,
      },
    ]);
    expect(input.cardio).toEqual([{ date: '2026-10-02', modality: 'run', distanceM: 5000 }]);
    expect(input.food).toBeNull();
    expect(input.weight).toBeNull();
  });
});

describe('desiredCalendarEvents', () => {
  const base = {
    plans: [
      { id: 'p1', status: 'active' },
      { id: 'p0', status: 'replaced' },
    ] as never,
    nutritionSetup: null,
    sessionLogs: [{ id: 'l1', planned_session_id: 's3' }] as never,
  };
  const session = (id: string, plan: string, date: string, status = 'planned') =>
    ({
      id,
      plan_id: plan,
      scheduled_on: date,
      status,
      kind: 'strength',
      name_de: 'Ganzkörper A',
      estimated_minutes: 50,
    }) as never;

  it('nur offene Einheiten des aktiven Plans ohne Eintrag; Standard 18:00', () => {
    const events = desiredCalendarEvents(
      {
        ...base,
        plannedSessions: [
          session('s1', 'p1', '2026-10-27'),
          session('s2', 'p0', '2026-10-28'),
          session('s3', 'p1', '2026-10-29'),
          session('s4', 'p1', '2026-10-30', 'skipped'),
        ],
      },
      '2026-10-26',
      null,
    );
    expect(events).toEqual([
      {
        key: 'alpha5-session-s1',
        title: 'Alpha5: Ganzkörper A',
        date: '2026-10-27',
        startMinutes: 1080,
        durationMinutes: 50,
      },
    ]);
  });

  it('Trainingszeit aus dem Setup bzw. gewählte Uhrzeit; ohne aktiven Plan leer', () => {
    const rows = {
      ...base,
      nutritionSetup: { training_time: 'morning' } as never,
      plannedSessions: [session('s1', 'p1', '2026-10-27')],
    };
    expect(desiredCalendarEvents(rows, '2026-10-26', null)[0]?.startMinutes).toBe(570);
    expect(desiredCalendarEvents(rows, '2026-10-26', 420)[0]?.startMinutes).toBe(420);
    expect(desiredCalendarEvents({ ...rows, plans: [] }, '2026-10-26', null)).toEqual([]);
  });
});

void NOW;
