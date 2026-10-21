import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import {
  dayOfCycle,
  derivePeriodList,
  derivePeriods,
  isRangeComplete,
  longGapQuestionDays,
  normalizeEntries,
} from './periods';
import { dailyEntries, entry, regularCycles } from './test-helpers';

const NONE = { noBleedingConfirmedUntil: null };

describe('Periodenbeginn und Dauer (Plan 3.2)', () => {
  it('leere Liste und ein einziger Eintrag', () => {
    expect(derivePeriodList([])).toEqual([]);
    expect(derivePeriodList([entry('2026-10-01', { bleeding: 'light' })])).toEqual([
      { start: '2026-10-01', end: '2026-10-01', days: 1 },
    ]);
    expect(derivePeriodList([entry('2026-10-01', { energy: 3 })])).toEqual([]);
  });

  it('Schmierblutung allein startet keine Periode', () => {
    expect(derivePeriodList(dailyEntries('2026-10-01', 5, { bleeding: () => 'spotting' }))).toEqual(
      [],
    );
  });

  it('genau 4 vs. 5 Tage Pause: erst nach 5 Tagen ein neuer Beginn', () => {
    const four = [
      ...dailyEntries('2026-10-01', 3, { bleeding: () => 'medium' }),
      entry('2026-10-08', { bleeding: 'light' }),
    ];
    // 03. Ende, 04.–07. = 4 Tage ohne → kein neuer Beginn, nicht Teil der Periode
    expect(derivePeriodList(four).map((p) => p.start)).toEqual(['2026-10-01']);
    const five = [
      ...dailyEntries('2026-10-01', 3, { bleeding: () => 'medium' }),
      entry('2026-10-09', { bleeding: 'light' }),
    ];
    expect(derivePeriodList(five).map((p) => p.start)).toEqual(['2026-10-01', '2026-10-09']);
  });

  it('Lücke 1 Tag wird überbrückt, 2 Tage nicht', () => {
    const gap1 = [
      entry('2026-10-01', { bleeding: 'heavy' }),
      entry('2026-10-03', { bleeding: 'light' }),
    ];
    expect(derivePeriodList(gap1)).toEqual([{ start: '2026-10-01', end: '2026-10-03', days: 3 }]);
    const gap2 = [
      entry('2026-10-01', { bleeding: 'heavy' }),
      entry('2026-10-04', { bleeding: 'light' }),
    ];
    expect(derivePeriodList(gap2)).toEqual([{ start: '2026-10-01', end: '2026-10-01', days: 1 }]);
  });

  it('über den Jahreswechsel und die Zeitumstellung', () => {
    const entries = [
      ...dailyEntries('2026-12-30', 4, { bleeding: () => 'medium' }),
      ...dailyEntries('2027-03-27', 4, { bleeding: () => 'light' }),
    ];
    const periods = derivePeriodList(entries);
    expect(periods).toEqual([
      { start: '2026-12-30', end: '2027-01-02', days: 4 },
      { start: '2027-03-27', end: '2027-03-30', days: 4 },
    ]);
  });

  it('doppelte Tage: der letzte Eintrag gewinnt, Reihenfolge egal', () => {
    const list = normalizeEntries([
      entry('2026-10-02', { energy: 2 }),
      entry('2026-10-01', { energy: 1 }),
      entry('2026-10-02', { energy: 4 }),
    ]);
    expect(list.map((e) => [e.date, e.payload.energy])).toEqual([
      ['2026-10-01', 1],
      ['2026-10-02', 4],
    ]);
  });
});

describe('Zyklen und Vollständigkeit', () => {
  it('regelmäßige 28-Tage-Zyklen mit täglichen Einträgen sind vollständig', () => {
    const entries = regularCycles('2026-06-01', 28, 5, 90);
    const derived = derivePeriods(entries, NONE, '2026-08-29');
    expect(derived.cycles.map((c) => c.length)).toEqual([28, 28, 28, null]);
    expect(derived.cycles.every((c) => c.complete)).toBe(true);
    expect(derived.lastPeriodStart).toBe('2026-08-24');
    expect(derived.cycles[0]?.periodDays).toBe(5);
  });

  it('Einträge an weniger als 50 % der Tage → unvollständig; Rückfrage bestätigt → vollständig', () => {
    const entries = [
      ...dailyEntries('2026-06-01', 4, { bleeding: () => 'medium' }),
      entry('2026-06-15', { energy: 3 }),
      ...dailyEntries('2026-07-01', 4, { bleeding: () => 'medium' }),
    ];
    const derived = derivePeriods(entries, NONE, '2026-07-10');
    expect(derived.cycles[0]).toMatchObject({ length: 30, complete: false });
    const confirmed = derivePeriods(
      entries,
      { noBleedingConfirmedUntil: '2026-06-30' },
      '2026-07-10',
    );
    expect(confirmed.cycles[0]?.complete).toBe(true);
  });

  it('genau 50 % zählt als vollständig', () => {
    const entries = dailyEntries('2026-01-01', 5);
    expect(isRangeComplete(entries, '2026-01-01', '2026-01-10', NONE)).toBe(true);
    expect(isRangeComplete(entries.slice(1), '2026-01-01', '2026-01-10', NONE)).toBe(false);
    expect(isRangeComplete(entries, '2026-01-10', '2026-01-01', NONE)).toBe(false);
  });

  it('zählt starke Tage, starke Krämpfe und Blutung außerhalb der Periode je Zyklus', () => {
    const entries = [
      entry('2026-05-01', { bleeding: 'heavy', symptoms: { cramps: 'strong' } }),
      entry('2026-05-02', { bleeding: 'heavy', symptoms: { cramps: 'strong' } }),
      entry('2026-05-03', { bleeding: 'medium', symptoms: { cramps: 'mild' } }),
      entry('2026-05-15', { bleeding: 'spotting' }),
      entry('2026-05-29', { bleeding: 'light' }),
    ];
    const [first] = derivePeriods(entries, NONE, '2026-06-05').cycles;
    expect(first).toMatchObject({ heavyDays: 2, crampsStrongDays: 2, intermenstrualDays: 1 });
  });

  it('ignoriert Einträge nach heute', () => {
    const derived = derivePeriods([entry('2026-10-30', { bleeding: 'heavy' })], NONE, '2026-10-21');
    expect(derived.periods).toEqual([]);
    expect(derived.lastBleedingDay).toBeNull();
  });
});

describe('Tag im Zyklus und Rückfrage nach 45 Tagen', () => {
  it('Tag X seit Periodenbeginn', () => {
    expect(dayOfCycle('2026-10-10', '2026-10-21')).toBe(12);
    expect(dayOfCycle('2026-10-21', '2026-10-21')).toBe(1);
    expect(dayOfCycle(null, '2026-10-21')).toBeNull();
    expect(dayOfCycle('2026-10-22', '2026-10-21')).toBeNull();
  });

  it('fragt nach 45 Tagen, nicht nach 44; nach Bestätigung erst 45 Tage später wieder', () => {
    const today = '2026-10-21';
    const base = { enabledOn: null, noBleedingConfirmedUntil: null, today };
    expect(longGapQuestionDays({ ...base, lastBleedingDay: addDays(today, -44) })).toBeNull();
    expect(longGapQuestionDays({ ...base, lastBleedingDay: addDays(today, -45) })).toBe(45);
    expect(longGapQuestionDays({ ...base, lastBleedingDay: null })).toBeNull();
    expect(
      longGapQuestionDays({ ...base, lastBleedingDay: null, enabledOn: addDays(today, -50) }),
    ).toBe(50);
    expect(
      longGapQuestionDays({
        ...base,
        lastBleedingDay: addDays(today, -60),
        noBleedingConfirmedUntil: addDays(today, -10),
      }),
    ).toBeNull();
    expect(
      longGapQuestionDays({
        ...base,
        lastBleedingDay: addDays(today, -100),
        noBleedingConfirmedUntil: addDays(today, -45),
      }),
    ).toBe(100);
  });
});
