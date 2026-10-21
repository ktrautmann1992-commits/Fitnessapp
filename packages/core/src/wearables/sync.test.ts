import { describe, expect, it } from 'vitest';

import { WEARABLE_SYNC } from '../constants';
import { daysInRange, shouldAutoSync, syncWindow } from './sync';

const now = '2026-10-21T12:00:00.000Z';

describe('syncWindow (W8-8)', () => {
  it('erster Abgleich: letzte 30 Tage', () => {
    expect(WEARABLE_SYNC.firstSyncDays).toBe(30);
    expect(syncWindow(null, now)).toEqual({ from: '2026-09-21T12:00:00.000Z', to: now });
  });

  it('danach ab letztem Abgleich minus 48 h', () => {
    expect(syncWindow('2026-10-20T12:00:00Z', now).from).toBe('2026-10-18T12:00:00.000Z');
  });

  it('nie weiter zurück als 30 Tage, nie nach jetzt', () => {
    expect(syncWindow('2026-01-01T00:00:00Z', now).from).toBe('2026-09-21T12:00:00.000Z');
    expect(syncWindow('2027-01-01T00:00:00Z', now).from).toBe(now);
    expect(syncWindow('kaputt', now).from).toBe('2026-09-21T12:00:00.000Z');
  });
});

describe('shouldAutoSync (W8-7)', () => {
  it('höchstens alle 15 Minuten', () => {
    expect(shouldAutoSync(null, now)).toBe(true);
    expect(shouldAutoSync('2026-10-21T11:46:00Z', now)).toBe(false);
    expect(shouldAutoSync('2026-10-21T11:45:00Z', now)).toBe(true);
    expect(shouldAutoSync('2026-10-21T13:00:00Z', now)).toBe(true);
  });
});

describe('daysInRange', () => {
  it('Tage einschließlich, höchstens maxDaysPerBatch', () => {
    expect(daysInRange('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(daysInRange('2026-10-02', '2026-10-01')).toEqual([]);
    expect(daysInRange('2025-01-01', '2026-12-31')).toHaveLength(WEARABLE_SYNC.maxDaysPerBatch);
  });
});
