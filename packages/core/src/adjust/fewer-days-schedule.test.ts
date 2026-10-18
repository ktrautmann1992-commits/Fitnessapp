import { describe, expect, it } from 'vitest';

import { droppableWeekdays, scheduleWithFewerDays } from './fewer-days-schedule';

const fixed = {
  mode: 'fixed' as const,
  slots: [
    { weekday: 1, kind: 'strength_gym' as const, minutes: 60 },
    { weekday: 3, kind: 'strength_gym' as const, minutes: 60 },
    { weekday: 5, kind: 'strength_gym' as const, minutes: 60 },
  ],
};

describe('scheduleWithFewerDays (R5 nach Bestätigung)', () => {
  it('feste Tage: der gewählte Wochentag fällt weg', () => {
    expect(scheduleWithFewerDays(fixed, 3)).toEqual({
      mode: 'fixed',
      slots: [fixed.slots[0], fixed.slots[2]],
    });
    expect(droppableWeekdays(fixed)).toEqual([1, 3, 5]);
  });

  it('Wochentag nicht im Plan bzw. nur ein Tag → nicht möglich', () => {
    expect(scheduleWithFewerDays(fixed, 2)).toBeNull();
    expect(scheduleWithFewerDays({ mode: 'fixed', slots: [fixed.slots[0]!] }, 1)).toBeNull();
  });

  it('„Tage egal“: der letzte Eintrag fällt weg, keine Tagesauswahl', () => {
    const flex = {
      mode: 'flex' as const,
      slots: [
        { kind: 'strength_gym' as const, minutes: 60 },
        { kind: 'endurance' as const, minutes: 45 },
      ],
    };
    expect(scheduleWithFewerDays(flex, 1)).toEqual({ mode: 'flex', slots: [flex.slots[0]] });
    expect(droppableWeekdays(flex)).toEqual([]);
  });
});
