import { describe, expect, it } from 'vitest';

import type { SetLogRow } from '@/data/types';

import {
  bestSetText,
  cardioDurationText,
  dayStatusText,
  effortText,
  kmText,
  logSummaryText,
  setLineText,
  weekRangeText,
} from './history-format';

const set = (patch: Partial<SetLogRow>): SetLogRow => ({
  exercise_log_id: 'e',
  user_id: 'u',
  set_no: 1,
  reps: 10,
  weight_kg: 22.5,
  duration_s: null,
  rpe: null,
  done: true,
  ...patch,
});

describe('Texte für Woche, Verlauf und Eintrag (Etappe D)', () => {
  it('Status immer mit Zeichen und Wort', () => {
    expect(dayStatusText('done')).toBe('✓ Erledigt');
    expect(dayStatusText('missed')).toBe('! Verpasst');
    expect(dayStatusText('dropped')).toBe('× Entfallen');
  });

  it('Kilometer mit Komma und einer Nachkommastelle', () => {
    expect(kmText(5000)).toBe('5,0');
    expect(kmText(12345)).toBe('12,3');
    expect(kmText(0)).toBe('0,0');
  });

  it('Verlaufszeile: Kraft-Sätze bzw. Ausdauer mit ausgeschriebenen Einheiten', () => {
    const base = {
      id: 'l',
      planned_session_id: null,
      performed_on: '2026-10-07',
      status: 'completed' as const,
      name_de: 'A',
      cardio_duration_s: null,
      cardio_distance_m: null,
    };
    expect(logSummaryText({ ...base, kind: 'strength', done_sets: 1 }).text).toBe('1 Satz');
    expect(
      logSummaryText({
        ...base,
        kind: 'endurance',
        done_sets: 0,
        cardio_duration_s: 1830,
        cardio_distance_m: 5000,
      }),
    ).toEqual({ text: '30 min · 5,0 km', a11y: '30 Minuten, 5,0 Kilometer' });
    expect(
      logSummaryText({ ...base, kind: 'endurance', done_sets: 0, cardio_duration_s: 600 }).text,
    ).toBe('10 min');
  });

  it('bester Satz „Gewicht × Wiederholungen“ (keine 1RM)', () => {
    expect(bestSetText({ kind: 'weight', weightKg: 22.5, reps: 10 })).toEqual({
      text: '22,5 kg × 10',
      a11y: '22,5 Kilogramm mal 10 Wiederholungen',
    });
    expect(bestSetText({ kind: 'time', durationS: 45 }).text).toBe('45 Sekunden gehalten');
    expect(bestSetText(null).text).toBe('kein Satz abgehakt');
  });

  it('Satz-Zeilen: Gewicht, Halten, Wiederholungen, Reserve, nicht abgehakt', () => {
    expect(setLineText(set({}), 'weight').text).toBe('Satz 1: 22,5 kg × 10');
    expect(setLineText(set({ weight_kg: null, reps: null, duration_s: 30 }), 'time').text).toBe(
      'Satz 1: 30 Sekunden',
    );
    expect(setLineText(set({ weight_kg: null, reps: 12 }), 'bodyweight').text).toBe(
      'Satz 1: 12 Wiederholungen',
    );
    expect(setLineText(set({ rpe: 8, done: false }), 'weight')).toEqual({
      text: 'Satz 1: 22,5 kg × 10 (ca. 2 Wiederholungen in Reserve, nicht abgehakt)',
      a11y: 'Satz 1: 22,5 Kilogramm mal 10 Wiederholungen, ca. 2 Wiederholungen in Reserve, nicht abgehakt',
    });
  });

  it('Dauer, Belastung und Zeitraum', () => {
    expect(cardioDurationText(3900)).toEqual({
      text: 'Dauer: 1:05:00',
      a11y: 'Dauer: 1 Stunde 5 Minuten',
    });
    expect(cardioDurationText(1800).a11y).toBe('Dauer: 30 Minuten');
    expect(effortText(7)).toBe('Belastung: 7 – schwer');
    expect(weekRangeText('2026-10-05', '2026-10-11')).toBe('05.10.2026 bis 11.10.2026');
  });
});
