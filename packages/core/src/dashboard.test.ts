import { describe, expect, it } from 'vitest';

import {
  type DashboardSession,
  latestBodyWeight,
  trainingToday,
  weekTrainingProgress,
} from './dashboard';

const s = (
  id: string,
  scheduled_on: string,
  status: DashboardSession['status'] = 'planned',
): DashboardSession => ({ id, scheduled_on, status });

// Mittwoch, 2026-10-21; Woche Mo 2026-10-19 bis So 2026-10-25.
const TODAY = '2026-10-21';

describe('trainingToday', () => {
  it('ohne Plan → no_plan', () => {
    expect(trainingToday(null, TODAY)).toEqual({ kind: 'no_plan' });
  });

  it('heutige offene Einheit', () => {
    const result = trainingToday([s('a', '2026-10-20'), s('b', TODAY)], TODAY);
    expect(result).toEqual({ kind: 'session', session: s('b', TODAY), done: false });
  });

  it('offene Einheit geht der erledigten am selben Tag vor', () => {
    const result = trainingToday([s('x', TODAY, 'completed'), s('y', TODAY)], TODAY);
    expect(result.kind === 'session' && result.session.id).toBe('y');
  });

  it('nur erledigt → done', () => {
    const result = trainingToday([s('x', TODAY, 'completed')], TODAY);
    expect(result).toEqual({ kind: 'session', session: s('x', TODAY, 'completed'), done: true });
  });

  it('gestrichene Einheit heute → Ruhetag mit nächster Einheit', () => {
    const result = trainingToday(
      [s('x', TODAY, 'skipped'), s('late', '2026-10-30'), s('soon', '2026-10-23')],
      TODAY,
    );
    expect(result).toEqual({ kind: 'rest', next: s('soon', '2026-10-23') });
  });

  it('Ruhetag ohne weitere Einheiten (Planende)', () => {
    expect(trainingToday([s('a', '2026-10-01', 'completed')], TODAY)).toEqual({
      kind: 'rest',
      next: null,
    });
  });

  it('leerer Plan → Ruhetag ohne nächste Einheit', () => {
    expect(trainingToday([], TODAY)).toEqual({ kind: 'rest', next: null });
  });

  it('nächste Einheit ignoriert vergangene offene Einheiten', () => {
    const result = trainingToday([s('missed', '2026-10-19'), s('next', '2026-10-24')], TODAY);
    expect(result).toEqual({ kind: 'rest', next: s('next', '2026-10-24') });
  });

  it('ungültiges Datum wird abgelehnt', () => {
    expect(() => trainingToday([], '21.10.2026')).toThrow();
  });
});

describe('weekTrainingProgress', () => {
  it('zählt nur die Woche Mo–So, ohne gestrichene', () => {
    const sessions = [
      s('prev', '2026-10-18', 'completed'),
      s('mo', '2026-10-19', 'completed'),
      s('di', '2026-10-20', 'skipped'),
      s('mi', TODAY),
      s('sa', '2026-10-24'),
      s('so', '2026-10-25', 'completed'),
      s('next', '2026-10-26'),
    ];
    expect(weekTrainingProgress(sessions, TODAY)).toEqual({
      weekStart: '2026-10-19',
      planned: 4,
      completed: 2,
      open: 2,
    });
  });

  it('verpasste Einheiten der Woche zählen nicht als offen', () => {
    const result = weekTrainingProgress([s('mo', '2026-10-19'), s('fr', '2026-10-23')], TODAY);
    expect(result.open).toBe(1);
    expect(result.planned).toBe(2);
  });

  it('1 Trainingstag und 7 Trainingstage', () => {
    expect(weekTrainingProgress([s('a', TODAY)], TODAY)).toMatchObject({ planned: 1, open: 1 });
    const seven = Array.from({ length: 7 }, (_, i) =>
      s(`d${i}`, `2026-10-${String(19 + i).padStart(2, '0')}`, i < 2 ? 'completed' : 'planned'),
    );
    expect(weekTrainingProgress(seven, TODAY)).toMatchObject({
      planned: 7,
      completed: 2,
      open: 5,
    });
  });

  it('Sonntag gehört zur laufenden Woche, Montag beginnt eine neue', () => {
    expect(weekTrainingProgress([s('so', '2026-10-25')], '2026-10-25').weekStart).toBe(
      '2026-10-19',
    );
    expect(weekTrainingProgress([s('so', '2026-10-25')], '2026-10-26')).toMatchObject({
      weekStart: '2026-10-26',
      planned: 0,
    });
  });

  it('ohne Einheiten → alles 0', () => {
    expect(weekTrainingProgress([], TODAY)).toEqual({
      weekStart: '2026-10-19',
      planned: 0,
      completed: 0,
      open: 0,
    });
  });
});

describe('latestBodyWeight', () => {
  it('keine Einträge → null', () => {
    expect(latestBodyWeight([])).toBeNull();
  });

  it('nur Einträge ohne Gewicht → null', () => {
    expect(latestBodyWeight([{ measured_on: '2026-10-01', weight_kg: null }])).toBeNull();
  });

  it('jüngstes Datum mit Gewicht, unabhängig von der Reihenfolge', () => {
    expect(
      latestBodyWeight([
        { measured_on: '2026-10-10', weight_kg: 81.5 },
        { measured_on: '2026-10-15', weight_kg: null },
        { measured_on: '2026-09-01', weight_kg: 84 },
      ]),
    ).toEqual({ weightKg: 81.5, measuredOn: '2026-10-10' });
  });

  it('gleicher Tag → späterer Eintrag', () => {
    expect(
      latestBodyWeight([
        { measured_on: '2026-10-10', weight_kg: 80 },
        { measured_on: '2026-10-10', weight_kg: 79.6 },
      ]),
    ).toEqual({ weightKg: 79.6, measuredOn: '2026-10-10' });
  });

  it('sehr leicht und sehr schwer bleiben unverändert', () => {
    expect(latestBodyWeight([{ measured_on: '2026-10-10', weight_kg: 35 }])?.weightKg).toBe(35);
    expect(latestBodyWeight([{ measured_on: '2026-10-10', weight_kg: 250 }])?.weightKg).toBe(250);
  });

  it('unmögliche Werte (0, negativ, NaN) werden übergangen', () => {
    expect(
      latestBodyWeight([
        { measured_on: '2026-10-01', weight_kg: 70 },
        { measured_on: '2026-10-02', weight_kg: 0 },
        { measured_on: '2026-10-03', weight_kg: -5 },
        { measured_on: '2026-10-04', weight_kg: Number.NaN },
      ]),
    ).toEqual({ weightKg: 70, measuredOn: '2026-10-01' });
  });
});
