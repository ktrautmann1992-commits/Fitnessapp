import { describe, expect, it } from 'vitest';

import {
  type DashboardSession,
  latestBodyWeight,
  planNotice,
  type TrainingAttentionFlags,
  trainingAttentionReasons,
  trainingToday,
  weekTrainingProgress,
} from './dashboard';
import type { StoredSession } from './plan/view';

// Nur die Felder, die die Regeln lesen (Tag, Status) – der Rest einer gespeicherten Einheit spielt hier keine Rolle.
const s = (
  id: string,
  scheduled_on: string,
  status: DashboardSession['status'] = 'planned',
): StoredSession => ({ id, scheduled_on, status }) as unknown as StoredSession;

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

describe('planNotice', () => {
  const offer = (o: boolean, stricter = false, reasons: string[] = ['inputs']) =>
    ({ offer: o, stricter, reasons }) as unknown as Parameters<typeof planNotice>[0];

  it('abgelaufen geht allem vor', () => {
    expect(planNotice(offer(true, true), 'ended')).toEqual({ kind: 'ended' });
    expect(planNotice(null, 'ended')).toEqual({ kind: 'ended' });
  });

  it('strenger vor normalem Angebot', () => {
    expect(planNotice(offer(true, true), 'not_due')).toEqual({ kind: 'stricter' });
  });

  it('normales Angebot, nur neue Vorlagen-Version erkannt', () => {
    expect(planNotice(offer(true), 'due')).toEqual({ kind: 'offer', versionOnly: false });
    expect(planNotice(offer(true, false, ['template_version']), 'not_due')).toEqual({
      kind: 'offer',
      versionOnly: true,
    });
  });

  it('kein Angebot (auch ohne Regeln: null) → none', () => {
    expect(planNotice(offer(false), 'not_due')).toEqual({ kind: 'none' });
    expect(planNotice(null, 'due')).toEqual({ kind: 'none' });
  });
});

describe('trainingAttentionReasons', () => {
  const none: TrainingAttentionFlags = {
    planNotice: { kind: 'none' },
    drafts: 0,
    workoutMessage: null,
    planMessage: false,
    reconsent: false,
    foreignData: false,
    sessionExpired: false,
    competitionMismatch: false,
    weightGoalCard: false,
  };

  it('nichts offen → leer', () => {
    expect(trainingAttentionReasons(none)).toEqual([]);
  });

  it('positive Rückmeldungen zählen nicht, Probleme schon', () => {
    for (const kind of ['saved', 'queued', 'orphaned'] as const) {
      expect(trainingAttentionReasons({ ...none, workoutMessage: kind })).toEqual([]);
    }
    for (const kind of ['conflict', 'rejected', 'invalid'] as const) {
      expect(trainingAttentionReasons({ ...none, workoutMessage: kind })).toEqual([
        'workout_problem',
      ]);
    }
  });

  it('alles zugleich in fester Reihenfolge (Wichtigstes zuerst)', () => {
    expect(
      trainingAttentionReasons({
        planNotice: { kind: 'stricter' },
        drafts: 2,
        workoutMessage: 'rejected',
        planMessage: true,
        reconsent: true,
        foreignData: true,
        sessionExpired: true,
        competitionMismatch: true,
        weightGoalCard: true,
      }),
    ).toEqual([
      'plan_stricter',
      'reconsent',
      'foreign_data',
      'session_expired',
      'workout_problem',
      'draft',
      'plan_message',
      'competition_mismatch',
      'weight_goal',
    ]);
  });

  it('Plan abgelaufen bzw. normales Angebot', () => {
    expect(trainingAttentionReasons({ ...none, planNotice: { kind: 'ended' } })).toEqual([
      'plan_ended',
    ]);
    expect(
      trainingAttentionReasons({ ...none, planNotice: { kind: 'offer', versionOnly: false } }),
    ).toEqual(['plan_offer']);
  });
});
