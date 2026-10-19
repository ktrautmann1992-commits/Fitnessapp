import { describe, expect, it } from 'vitest';

import { recommendSupplements } from './eligibility';
import { supplementSchedule, type ScheduleDay } from './schedule';
import { supplementTestInputs as base } from './test-helpers';

function weekWith(trainingWeekdays: readonly number[]): ScheduleDay[] {
  // 19.–25.10.2026 = Montag bis Sonntag.
  return [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    date: `2026-10-${String(18 + weekday)}`,
    hasTraining: trainingWeekdays.includes(weekday),
  }));
}

const allChosen = ['creatine', 'caffeine', 'protein_powder', 'vitamin_d', 'omega3'] as const;

describe('Zeitplan (Plan 3.5, SU6)', () => {
  const recommendation = recommendSupplements(base({ dietType: 'vegan', proteinGap: true }));

  it('1 Trainingstag: Kreatin, Vitamin D, Omega-3 täglich; Proteinpulver nur am Trainingstag; nie Koffein', () => {
    const days = supplementSchedule(recommendation, weekWith([3]), allChosen);
    expect(days).toHaveLength(7);
    for (const day of days) {
      expect(day.entries.map((entry) => entry.supplementId)).not.toContain('caffeine');
      expect(day.entries).toContainEqual({ supplementId: 'creatine', timing: 'daily_with_meal' });
      expect(day.entries).toContainEqual({ supplementId: 'vitamin_d', timing: 'daily_with_meal' });
      expect(day.entries).toContainEqual({ supplementId: 'omega3', timing: 'daily_with_meal' });
    }
    const protein = days.filter((day) =>
      day.entries.some((entry) => entry.supplementId === 'protein_powder'),
    );
    expect(protein.map((day) => day.date)).toEqual(['2026-10-21']);
    expect(days[2]!.entries).toContainEqual({
      supplementId: 'protein_powder',
      timing: 'after_training',
    });
  });

  it('7 Trainingstage: Proteinpulver jeden Tag nach dem Training', () => {
    const days = supplementSchedule(recommendation, weekWith([1, 2, 3, 4, 5, 6, 7]), allChosen);
    for (const day of days) {
      expect(day.entries).toContainEqual({
        supplementId: 'protein_powder',
        timing: 'after_training',
      });
    }
  });

  it('Ruhetag: Kreatin trotzdem täglich', () => {
    const [restDay] = supplementSchedule(recommendation, weekWith([]), ['creatine']);
    expect(restDay!.entries).toEqual([{ supplementId: 'creatine', timing: 'daily_with_meal' }]);
  });

  it('nichts gewählt → leere Tage; nur Koffein gewählt → leer', () => {
    for (const chosen of [[], ['caffeine']] as const) {
      for (const day of supplementSchedule(recommendation, weekWith([1, 3]), chosen)) {
        expect(day.entries).toEqual([]);
      }
    }
  });

  it('Flag kommt hinzu → Zeile verschwindet (Schwangerschaft, Niere)', () => {
    const pregnant = recommendSupplements(
      base({
        dietType: 'vegan',
        proteinGap: true,
        healthFlags: ['pregnancy', 'conservative_plan'],
      }),
    );
    for (const day of supplementSchedule(pregnant, weekWith([1]), allChosen)) {
      expect(day.entries).toEqual([]);
    }
    const kidney = recommendSupplements(
      base({ dietType: 'vegan', proteinGap: true, supplementFlags: ['kidney'] }),
    );
    expect(supplementSchedule(kidney, weekWith([1]), allChosen)[0]!.entries).toEqual([
      { supplementId: 'omega3', timing: 'daily_with_meal' },
    ]);
  });

  it('nur Info (z. B. Kreatin beim Ziel Fettabbau) → keine Zeile; „ab 18“ → keine Zeile', () => {
    const info = recommendSupplements(base({ goalType: 'fat_loss' }));
    expect(supplementSchedule(info, weekWith([1]), ['creatine'])[0]!.entries).toEqual([]);
    const minor = recommendSupplements(base({ birthDate: '2009-05-01' }));
    expect(supplementSchedule(minor, weekWith([1]), ['creatine'])[0]!.entries).toEqual([]);
  });

  it('mehr als 7 Tage oder doppelte Auswahl → Fehler', () => {
    const eight = [...weekWith([]), { date: '2026-10-26', hasTraining: false }];
    expect(() => supplementSchedule(recommendation, eight, [])).toThrow();
    expect(() =>
      supplementSchedule(recommendation, weekWith([]), ['creatine', 'creatine']),
    ).toThrow();
  });
});
