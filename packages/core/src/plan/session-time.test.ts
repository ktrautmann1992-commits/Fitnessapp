import { describe, expect, it } from 'vitest';

import { SESSION_START_TIME } from '../constants';
import { savePlanSessionSchema } from './payload';
import {
  carryOverSessionStartTimes,
  clockLabel,
  completedSessionStartMinutes,
  minutesToStartTime,
  sessionStartTimeRequestSchema,
  startTimeToMinutes,
  stepStartMinutes,
} from './session-time';

describe('Uhrzeit der Einheit (Nährstoff-Timing T0/T1)', () => {
  it('Text ↔ Minuten, auch mit Sekunden aus Postgres', () => {
    expect(startTimeToMinutes('18:30')).toBe(1110);
    expect(startTimeToMinutes('18:30:00')).toBe(1110);
    expect(startTimeToMinutes('00:00')).toBe(0);
    expect(startTimeToMinutes('23:59')).toBe(1439);
    expect(minutesToStartTime(1110)).toBe('18:30');
    expect(minutesToStartTime(5)).toBe('00:05');
  });

  it('ungültig → null bzw. Fehler', () => {
    for (const bad of ['24:00', '7:05', '18:30:15', 'abc', '']) {
      expect(startTimeToMinutes(bad), bad).toBeNull();
    }
    expect(startTimeToMinutes(null)).toBeNull();
    expect(startTimeToMinutes(undefined)).toBeNull();
    expect(() => minutesToStartTime(1440)).toThrow();
    expect(() => minutesToStartTime(-1)).toThrow();
    expect(() => minutesToStartTime(10.5)).toThrow();
  });

  it('Anzeige begrenzt auf den Tag', () => {
    expect(clockLabel(1500)).toBe('23:59');
    expect(clockLabel(-30)).toBe('00:00');
    expect(clockLabel(1110.4)).toBe('18:30');
  });

  it('Schritte von 5 Minuten, nie über Mitternacht', () => {
    expect(stepStartMinutes(1110, 5)).toBe(1115);
    expect(stepStartMinutes(1112, 0)).toBe(1110);
    expect(stepStartMinutes(0, -5)).toBe(0);
    expect(stepStartMinutes(1435, 5)).toBe(1435);
    expect(stepStartMinutes(1439, 60)).toBe(SESSION_START_TIME.maxMinutes - 4);
  });

  it('Anfrage: HH:MM oder null, strikt', () => {
    expect(
      sessionStartTimeRequestSchema.safeParse({ sessionId: 's', startTime: '06:45' }).success,
    ).toBe(true);
    expect(
      sessionStartTimeRequestSchema.safeParse({ sessionId: 's', startTime: null }).success,
    ).toBe(true);
    expect(
      sessionStartTimeRequestSchema.safeParse({ sessionId: 's', startTime: '6:45' }).success,
    ).toBe(false);
    expect(
      sessionStartTimeRequestSchema.safeParse({ sessionId: 's', startTime: '06:45', x: 1 }).success,
    ).toBe(false);
  });

  it('Uhrzeiten übernehmen: je Wochentag und Art die zuletzt geplante, gestrichene zählen nicht', () => {
    const previous = [
      { scheduled_on: '2026-10-19', kind: 'strength', status: 'completed', start_time: '07:00:00' },
      { scheduled_on: '2026-10-26', kind: 'strength', status: 'planned', start_time: '18:30:00' },
      { scheduled_on: '2026-10-28', kind: 'endurance', status: 'skipped', start_time: '06:00:00' },
      { scheduled_on: '2026-10-30', kind: 'endurance', status: 'planned', start_time: null },
    ];
    const next = carryOverSessionStartTimes(
      [
        { scheduled_on: '2026-11-02', kind: 'strength' },
        { scheduled_on: '2026-11-04', kind: 'endurance' },
        { scheduled_on: '2026-11-06', kind: 'endurance' },
        { scheduled_on: '2026-11-09', kind: 'endurance' },
      ],
      previous,
    );
    expect(next.map((s) => s.start_time)).toEqual(['18:30', undefined, undefined, undefined]);
    // Ohne Vorbild bleibt der Schlüssel weg (Eingabe byte-gleich wie vorher).
    expect('start_time' in (next[1] as object)).toBe(false);
  });

  it('Plan-Payload: start_time optional', () => {
    const base = {
      block_no: 1,
      week_no: 1,
      is_intro_week: false,
      is_deload: false,
      kind: 'endurance',
      template_day_index: null,
      scheduled_on: '2026-11-02',
      name_de: 'Lockerer Dauerlauf',
      focus: null,
      endurance_modality: 'run',
      effort_target: 4,
      estimated_minutes: 40,
      warmup_de: 'Gehen.',
      cooldown_de: 'Auslaufen.',
      exercises: [],
    };
    expect(savePlanSessionSchema.safeParse(base).success).toBe(true);
    expect(savePlanSessionSchema.safeParse({ ...base, start_time: '18:30' }).success).toBe(true);
    expect(savePlanSessionSchema.safeParse({ ...base, start_time: '25:00' }).success).toBe(false);
  });
});

describe('Beginn einer erledigten Einheit (Essen nach dem Training, 06.11.2026)', () => {
  const day = '2026-10-14';

  it('Beginn laut Tagebuch (Europe/Berlin) vor geplanter Uhrzeit', () => {
    expect(
      completedSessionStartMinutes({
        day,
        startedAt: '2026-10-14T15:12:00Z',
        plannedStartTime: '18:30',
      }),
    ).toBe(17 * 60 + 12);
  });

  it('ohne bzw. unlesbarer Beginn: geplante Uhrzeit, sonst null', () => {
    expect(
      completedSessionStartMinutes({ day, startedAt: null, plannedStartTime: '18:30:00' }),
    ).toBe(1110);
    expect(
      completedSessionStartMinutes({ day, startedAt: 'kaputt', plannedStartTime: '07:00' }),
    ).toBe(420);
    expect(completedSessionStartMinutes({ day })).toBeNull();
    expect(
      completedSessionStartMinutes({ day, startedAt: null, plannedStartTime: null }),
    ).toBeNull();
    expect(completedSessionStartMinutes({ day, plannedStartTime: '25:00' })).toBeNull();
  });

  it('Beginn an einem anderen Tag (Vortag kurz vor Mitternacht) → geplante Uhrzeit bzw. null', () => {
    const lateStart = '2026-10-13T21:55:00Z'; // 23:55 am 13.10.
    expect(completedSessionStartMinutes({ day, startedAt: lateStart })).toBeNull();
    expect(
      completedSessionStartMinutes({ day, startedAt: lateStart, plannedStartTime: '06:00' }),
    ).toBe(360);
  });

  it('nach 23 Uhr und um Mitternacht: innerhalb 00:00–23:59', () => {
    expect(completedSessionStartMinutes({ day, startedAt: '2026-10-14T21:59:00Z' })).toBe(
      SESSION_START_TIME.maxMinutes,
    );
    expect(completedSessionStartMinutes({ day, startedAt: '2026-10-14T21:05:00Z' })).toBe(
      23 * 60 + 5,
    );
    expect(
      completedSessionStartMinutes({ day: '2026-10-15', startedAt: '2026-10-14T22:00:00Z' }),
    ).toBe(SESSION_START_TIME.minMinutes);
  });

  it('Sommerzeit-Umstellung: 25.10.2026 und 29.03.2026', () => {
    expect(
      completedSessionStartMinutes({ day: '2026-10-25', startedAt: '2026-10-25T08:00:00Z' }),
    ).toBe(9 * 60);
    expect(
      completedSessionStartMinutes({ day: '2026-10-24', startedAt: '2026-10-24T08:00:00Z' }),
    ).toBe(10 * 60);
    expect(
      completedSessionStartMinutes({ day: '2026-03-29', startedAt: '2026-03-29T01:30:00Z' }),
    ).toBe(3 * 60 + 30);
  });

  it('andere Zeitzone (Parameter)', () => {
    expect(completedSessionStartMinutes({ day, startedAt: '2026-10-14T10:00:00Z' }, 'UTC')).toBe(
      600,
    );
  });
});
