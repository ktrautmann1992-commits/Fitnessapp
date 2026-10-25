import { describe, expect, it } from 'vitest';

import { SPORT_CATALOGUE } from '../constants';
import { SPORT_IDS } from '../enums';
import {
  hardLegSessionReason,
  isHighLegLoadLog,
  type LegLoadSession,
  type LegLoadSportLog,
  legLoadHints,
} from './leg-load';

const TODAY = '2026-10-25';
const sportLog = (extra: Partial<LegLoadSportLog> = {}): LegLoadSportLog => ({
  id: 'l1',
  performed_on: '2026-10-25',
  sport: 'football',
  durationS: 5400,
  effort: 7,
  ...extra,
});
const session = (extra: Partial<LegLoadSession> = {}): LegLoadSession => ({
  id: 's1',
  scheduled_on: '2026-10-26',
  status: 'planned',
  kind: 'strength',
  focus: 'lower',
  endurance_modality: null,
  effort_target: null,
  workout_type: null,
  ...extra,
});

describe('hardLegSessionReason', () => {
  it('Kraft: Bein- und Ganzkörper-Fokus hart, Oberkörper/Balance nicht', () => {
    expect(hardLegSessionReason(session({ focus: 'lower' }))).toBe('strength_legs');
    expect(hardLegSessionReason(session({ focus: 'full_body' }))).toBe('strength_legs');
    expect(hardLegSessionReason(session({ focus: 'upper' }))).toBeNull();
    expect(hardLegSessionReason(session({ focus: 'balance' }))).toBeNull();
    expect(hardLegSessionReason(session({ focus: null }))).toBeNull();
  });

  it('Ausdauer: Intervalle/Tempo bzw. Anstrengung über „locker“ hart; locker und Schwimmen nicht', () => {
    const endurance = {
      kind: 'endurance' as const,
      focus: null,
      endurance_modality: 'run' as const,
    };
    expect(hardLegSessionReason(session({ ...endurance, workout_type: 'intervals' }))).toBe(
      'hard_endurance',
    );
    expect(hardLegSessionReason(session({ ...endurance, workout_type: 'tempo' }))).toBe(
      'hard_endurance',
    );
    expect(hardLegSessionReason(session({ ...endurance, effort_target: 6 }))).toBe(
      'hard_endurance',
    );
    expect(hardLegSessionReason(session({ ...endurance, effort_target: 4 }))).toBeNull();
    expect(hardLegSessionReason(session({ ...endurance, workout_type: 'easy' }))).toBeNull();
    expect(
      hardLegSessionReason(
        session({ ...endurance, endurance_modality: 'swim', workout_type: 'intervals' }),
      ),
    ).toBeNull();
    expect(
      hardLegSessionReason(session({ ...endurance, endurance_modality: 'bike', effort_target: 7 })),
    ).toBe('hard_endurance');
  });
});

describe('isHighLegLoadLog', () => {
  it.each(SPORT_IDS)('%s: nur Sportarten mit hoher Beinbelastung', (sport) => {
    expect(isHighLegLoadLog(sportLog({ sport }))).toBe(SPORT_CATALOGUE[sport].legLoad === 'high');
  });

  it('Mindestdauer 30 min und Anstrengung ≥ 5 (ohne Angabe übliche Anstrengung)', () => {
    expect(isHighLegLoadLog(sportLog({ durationS: 1799 }))).toBe(false);
    expect(isHighLegLoadLog(sportLog({ durationS: 1800 }))).toBe(true);
    expect(isHighLegLoadLog(sportLog({ durationS: null }))).toBe(false);
    expect(isHighLegLoadLog(sportLog({ effort: 4 }))).toBe(false);
    expect(isHighLegLoadLog(sportLog({ effort: 5 }))).toBe(true);
    expect(isHighLegLoadLog(sportLog({ effort: null }))).toBe(true);
    // Ski alpin: übliche Anstrengung 4 → ohne Angabe kein Hinweis
    expect(isHighLegLoadLog(sportLog({ sport: 'alpine_skiing', effort: null }))).toBe(false);
    expect(isHighLegLoadLog(sportLog({ sport: null }))).toBe(false);
  });
});

describe('legLoadHints', () => {
  it('Fußball gestern → Hinweis für die heutige harte Bein-Einheit', () => {
    expect(
      legLoadHints({
        today: '2026-10-26',
        logs: [sportLog()],
        sessions: [session()],
      }),
    ).toEqual([
      {
        sessionId: 's1',
        sessionDate: '2026-10-26',
        reason: 'strength_legs',
        sport: 'football',
        sportDate: '2026-10-25',
        sportLogId: 'l1',
      },
    ]);
  });

  it('Fußball heute → Hinweis schon heute für die Einheit morgen', () => {
    expect(legLoadHints({ today: TODAY, logs: [sportLog()], sessions: [session()] })).toHaveLength(
      1,
    );
  });

  it('kein Hinweis: andere Tage, erledigt/gestrichen, alter Plan, Vergangenheit, leichte Einheit', () => {
    const logs = [sportLog()];
    for (const s of [
      session({ scheduled_on: '2026-10-27' }),
      session({ scheduled_on: '2026-10-25' }),
      session({ status: 'completed' }),
      session({ status: 'skipped' }),
      session({ plan_active: false }),
      session({ focus: 'upper' }),
    ]) {
      expect(legLoadHints({ today: TODAY, logs, sessions: [s] }), JSON.stringify(s)).toEqual([]);
    }
    expect(legLoadHints({ today: '2026-10-27', logs, sessions: [session()] })).toEqual([]);
    expect(legLoadHints({ today: TODAY, logs: [], sessions: [session()] })).toEqual([]);
    expect(
      legLoadHints({
        today: TODAY,
        logs: [sportLog({ sport: 'climbing' })],
        sessions: [session()],
      }),
    ).toEqual([]);
  });

  it('je Einheit ein Hinweis (längste Einheit), sortiert nach Datum', () => {
    const hints = legLoadHints({
      today: TODAY,
      logs: [
        sportLog({ id: 'kurz', sport: 'tennis', durationS: 3600 }),
        sportLog({ id: 'lang', sport: 'football', durationS: 5400 }),
        sportLog({ id: 'mo', performed_on: '2026-10-26', sport: 'padel', durationS: 3600 }),
      ],
      sessions: [
        session({
          id: 's2',
          scheduled_on: '2026-10-27',
          kind: 'endurance',
          focus: null,
          endurance_modality: 'run',
          workout_type: 'intervals',
        }),
        session(),
      ],
    });
    expect(hints.map((h) => [h.sessionId, h.sportLogId, h.reason])).toEqual([
      ['s1', 'lang', 'strength_legs'],
      ['s2', 'mo', 'hard_endurance'],
    ]);
  });
});
