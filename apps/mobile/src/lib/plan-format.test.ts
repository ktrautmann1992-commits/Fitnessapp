import { describe, expect, it } from 'vitest';

import {
  dayLabel,
  enduranceLines,
  exerciseLines,
  repsRange,
  reserveFromRpe,
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

  it('Übung: Sätze × Wdh., Pause, Reserve, Startgewicht bzw. Halten', () => {
    expect(exerciseLines(exercise)).toEqual([
      '3 × 8–12 Wiederholungen',
      'Pause 2:30 Minuten',
      'ca. 2–3 Wiederholungen in Reserve',
      'Startgewicht finden',
    ]);
    expect(
      exerciseLines({
        ...exercise,
        reps_min: null,
        reps_max: null,
        duration_s: 30,
        target_weight_kg: 12.5,
      }),
    ).toContain('Zielgewicht 12,5 kg');
    expect(exerciseLines({ ...exercise, reps_min: null, reps_max: null, duration_s: 30 })[0]).toBe(
      '3 × 30 Sekunden halten',
    );
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
