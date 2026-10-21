import { describe, expect, it } from 'vitest';

import { WEARABLE_DUPLICATE } from '../constants';
import {
  candidatesFromLogRows,
  type DuplicateCandidate,
  logGroup,
  matchExisting,
  overlapShare,
} from './duplicates';

const t = (min: number) => new Date(Date.UTC(2026, 9, 20, 6, min)).toISOString();

const subject = {
  group: 'run' as const,
  performedOn: '2026-10-20',
  startedAt: t(0),
  finishedAt: t(40),
  durationS: 2400,
};

const candidate = (over: Partial<DuplicateCandidate> = {}): DuplicateCandidate => ({
  id: 'log-1',
  group: 'run',
  performedOn: '2026-10-20',
  startedAt: t(0),
  finishedAt: t(40),
  durationS: 2400,
  linked: false,
  ...over,
});

describe('overlapShare', () => {
  it('Anteil an der kürzeren Einheit', () => {
    expect(
      overlapShare({ startedAt: t(0), finishedAt: t(40) }, { startedAt: t(10), finishedAt: t(30) }),
    ).toBe(1);
    expect(
      overlapShare({ startedAt: t(0), finishedAt: t(40) }, { startedAt: t(20), finishedAt: t(60) }),
    ).toBe(0.5);
    expect(
      overlapShare({ startedAt: t(0), finishedAt: t(10) }, { startedAt: t(10), finishedAt: t(20) }),
    ).toBe(0);
  });

  it('ungültige oder leere Fenster → 0', () => {
    expect(
      overlapShare({ startedAt: t(0), finishedAt: t(0) }, { startedAt: t(0), finishedAt: t(10) }),
    ).toBe(0);
    expect(
      overlapShare({ startedAt: 'x', finishedAt: t(10) }, { startedAt: t(0), finishedAt: t(10) }),
    ).toBe(0);
  });
});

describe('logGroup', () => {
  it('Ausdauer → Art, sonst Kraft', () => {
    expect(logGroup('endurance', 'bike')).toBe('bike');
    expect(logGroup('strength', null)).toBe('strength');
    expect(logGroup('endurance', null)).toBe('strength');
  });
});

describe('matchExisting (W8-9)', () => {
  it('gleiche Art, ≥ 50 % Überlappung → zusammenführen', () => {
    expect(matchExisting(subject, [candidate()])).toEqual({ kind: 'merge', logId: 'log-1' });
    // genau 50 %: 20 von 40 Minuten
    expect(matchExisting(subject, [candidate({ startedAt: t(20), finishedAt: t(60) })])).toEqual({
      kind: 'merge',
      logId: 'log-1',
    });
  });

  it('20–50 % Überlappung → nachfragen; unter 20 % → neu', () => {
    expect(WEARABLE_DUPLICATE).toEqual({
      autoMergeShare: 0.5,
      askShare: 0.2,
      durationTolerance: 0.2,
    });
    // 10 von 40 Minuten = 25 %
    expect(matchExisting(subject, [candidate({ startedAt: t(30), finishedAt: t(70) })])).toEqual({
      kind: 'ask',
      logId: 'log-1',
    });
    // genau 20 %: 8 von 40
    expect(matchExisting(subject, [candidate({ startedAt: t(32), finishedAt: t(72) })]).kind).toBe(
      'ask',
    );
    // 7 von 40 = 17,5 %
    expect(matchExisting(subject, [candidate({ startedAt: t(33), finishedAt: t(73) })]).kind).toBe(
      'new',
    );
  });

  it('andere Art: nur ab 50 % nachfragen, nie automatisch', () => {
    expect(matchExisting(subject, [candidate({ group: 'bike' })])).toEqual({
      kind: 'ask',
      logId: 'log-1',
    });
    expect(
      matchExisting(subject, [candidate({ group: 'bike', startedAt: t(30), finishedAt: t(70) })])
        .kind,
    ).toBe('new');
  });

  it('Eintrag ohne Uhrzeit: gleiche Art, gleicher Tag, Dauer ±20 % → nur nachfragen', () => {
    const noTime = { startedAt: null, finishedAt: null };
    expect(matchExisting(subject, [candidate({ ...noTime, durationS: 2880 })])).toEqual({
      kind: 'ask',
      logId: 'log-1',
    });
    expect(matchExisting(subject, [candidate({ ...noTime, durationS: 2881 })]).kind).toBe('new');
    expect(matchExisting(subject, [candidate({ ...noTime, durationS: 1920 })]).kind).toBe('ask');
    expect(matchExisting(subject, [candidate({ ...noTime, performedOn: '2026-10-19' })]).kind).toBe(
      'new',
    );
    expect(matchExisting(subject, [candidate({ ...noTime, group: 'walk' })]).kind).toBe('new');
    expect(matchExisting(subject, [candidate({ ...noTime, durationS: null })]).kind).toBe('new');
  });

  it('verknüpfte Einträge sind keine Kandidaten; bester Kandidat gewinnt', () => {
    expect(matchExisting(subject, [candidate({ linked: true })]).kind).toBe('new');
    expect(
      matchExisting(subject, [
        candidate({ id: 'b', startedAt: t(15), finishedAt: t(55) }),
        candidate({ id: 'c', startedAt: t(2), finishedAt: t(42) }),
      ]),
    ).toEqual({ kind: 'merge', logId: 'c' });
  });

  it('keine Einträge → neu', () => {
    expect(matchExisting(subject, [])).toEqual({ kind: 'new' });
  });
});

describe('candidatesFromLogRows', () => {
  it('Gruppe, Dauer und verknüpfte/übernommene Einträge', () => {
    const logs = [
      {
        id: 'a',
        kind: 'endurance' as const,
        performed_on: '2026-10-20',
        started_at: t(0),
        finished_at: t(40),
        source: 'gps',
      },
      {
        id: 'b',
        kind: 'strength' as const,
        performed_on: '2026-10-20',
        started_at: t(0),
        finished_at: t(30),
        source: 'manual',
      },
      {
        id: 'c',
        kind: 'strength' as const,
        performed_on: '2026-10-20',
        started_at: null,
        finished_at: null,
        source: 'manual',
      },
      {
        id: 'd',
        kind: 'endurance' as const,
        performed_on: '2026-10-20',
        started_at: null,
        finished_at: null,
        source: 'health_connect',
      },
    ];
    const cardio = [{ session_log_id: 'a', modality: 'run' as const, duration_s: 2300 }];
    const out = candidatesFromLogRows(logs, cardio, new Set(['b']));
    expect(out.map((c) => [c.id, c.group, c.durationS, c.linked])).toEqual([
      ['a', 'run', 2300, false],
      ['b', 'strength', 1800, true],
      ['c', 'strength', null, false],
      ['d', 'strength', null, true],
    ]);
  });
});
