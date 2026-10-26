import { describe, expect, it } from 'vitest';

import {
  dayLabel,
  longDayLabel,
  enduranceLines,
  exerciseSummary,
  repsRange,
  reserveFromRpe,
  restShort,
  restSpoken,
  restText,
} from './plan-format';

const exercise = {
  order_no: 1,
  exercise_id: 'x',
  source_exercise_id: 'x',
  exercise_name_de: 'X',
  sets: 3,
  reps_min: 8,
  reps_max: 12,
  duration_s: null,
  rest_s: 150,
  rpe_target: 7.5,
  superset_group: null,
  notes_de: null,
  target_weight_kg: null,
};

describe('Plan-Texte', () => {
  it('Tage, Wiederholungen, Pausen, Reserve', () => {
    expect(dayLabel('2026-10-08')).toBe('Donnerstag, 08.10.');
    expect(repsRange(8, 12)).toBe('8–12');
    expect(repsRange(10, 10)).toBe('10');
    expect(restText(45)).toBe('45 Sekunden');
    expect(restText(60)).toBe('1 Minute');
    expect(restText(150)).toBe('2:30 Minuten');
    expect(reserveFromRpe(7)).toBe('3');
    expect(reserveFromRpe(7.5)).toBe('2–3');
  });

  it('kurze und gesprochene Pausen', () => {
    expect(restShort(45)).toBe('45 s');
    expect(restShort(60)).toBe('1:00');
    expect(restShort(90)).toBe('1:30');
    expect(restShort(150)).toBe('2:30');
    expect(restSpoken(45)).toBe('45 Sekunden');
    expect(restSpoken(90)).toBe('90 Sekunden');
    expect(restSpoken(60)).toBe('1 Minute');
    expect(restSpoken(180)).toBe('3 Minuten');
  });

  it('Übung (kompakte Liste): Sätze × Wdh., Pause, Reserve, Gewicht bzw. „selbst finden“', () => {
    expect(exerciseSummary(exercise)).toEqual({
      sets: 3,
      dose: '3 × 8–12',
      rest: '2:30 Pause',
      reserve: '2–3 in Reserve',
      weight: null,
      findWeight: 'find',
      notes: [],
      a11y: '3 Sätze à 8–12 Wiederholungen, Pause 150 Sekunden, 2–3 Wiederholungen in Reserve, Gewicht selbst finden',
    });
    const hold = exerciseSummary({
      ...exercise,
      sets: 1,
      reps_min: null,
      reps_max: null,
      duration_s: 30,
      target_weight_kg: 12.5,
    });
    expect(hold.dose).toBe('1 × 30 s');
    expect(hold.weight).toBe('12,5 kg');
    expect(hold.findWeight).toBeNull();
    expect(hold.a11y).toContain('1 Satz à 30 Sekunden halten');
    // Halteübung ohne Gewicht: nichts zu finden.
    expect(
      exerciseSummary({ ...exercise, reps_min: null, reps_max: null, duration_s: 30 }).findWeight,
    ).toBeNull();
  });

  it('Übung: „Gewicht selbst finden“ nur bei Gewichtsübungen, wenn die Bibliothek die Art kennt', () => {
    expect(exerciseSummary(exercise, 'weight').findWeight).toBe('find');
    expect(exerciseSummary(exercise, 'bodyweight').findWeight).toBeNull();
    expect(exerciseSummary(exercise, 'band').findWeight).toBeNull();
    expect(exerciseSummary({ ...exercise, reps_min: 10, reps_max: 10 }).dose).toBe('3 × 10');
    expect(exerciseSummary({ ...exercise, sets: 7 }).a11y).toMatch(/^7 Sätze à/);
  });

  it('Ausdauer: Minuten, Gesprächstest, Geh-Lauf-Muster, Ausweichen (Schwangerschaft)', () => {
    const session = {
      kind: 'endurance' as const,
      name_de: 'Geh-Lauf-Wechsel',
      endurance_modality: 'run' as const,
      effort_target: 3,
      estimated_minutes: 20,
      warmup_de: '',
      cooldown_de: '',
    };
    const lines = enduranceLines(session, null);
    expect(lines[0]).toBe('20 Minuten');
    expect(lines.join(' ')).toContain('Anstrengung 3 von 10');
    expect(lines.join(' ')).toContain('1 Minute laufen, 2 Minuten gehen');
    expect(
      enduranceLines(
        { ...session, name_de: 'Zügiges Gehen', endurance_modality: 'walk' },
        { pregnancyNotice: true },
      ).at(-1),
    ).toContain('Laufband im Gehtempo');
  });
});

describe('longDayLabel', () => {
  it('schreibt Wochentag, Tag und Monat aus', () => {
    expect(longDayLabel('2026-10-20')).toBe('Dienstag, 20. Oktober');
    expect(longDayLabel('2026-03-01')).toBe('Sonntag, 1. März');
  });
});
