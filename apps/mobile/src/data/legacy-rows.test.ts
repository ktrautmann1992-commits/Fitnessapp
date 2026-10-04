import { describe, expect, it } from 'vitest';

import { rowsWith, USER_ID } from '../test/fixtures';
import { upgradeStoredRows } from './legacy-rows';
import type { GoalsRow, TrainingSlotRow, UserEquipmentRow, UserRows } from './types';

const goals: GoalsRow = {
  user_id: USER_ID,
  goal_type: 'endurance',
  discipline: null,
  target_date: null,
  training_location: 'gym',
};
const legacyGoals = (patch: Record<string, unknown>) =>
  ({ ...goals, ...patch }) as unknown as GoalsRow;
const equipment = (equipment_id: string, weights_kg: number[]) =>
  ({
    user_id: USER_ID,
    equipment_id,
    location: 'home',
    weights_kg,
    note: null,
  }) as UserEquipmentRow;
const slot: TrainingSlotRow = {
  user_id: USER_ID,
  slot_no: 1,
  weekday: 5,
  kind: 'endurance',
  minutes: 40,
};

describe('upgradeStoredRows (Gerätespeicher vor Etappe B2)', () => {
  it('altes Zeitbudget mit Wunsch-Tagen = Anzahl → feste Tage, alte Felder entfernt', () => {
    const rows = upgradeStoredRows(
      rowsWith({
        goals: legacyGoals({
          sessions_per_week: 2,
          minutes_per_session: 60,
          preferred_days: [3, 1],
          training_location: 'home',
        }),
      }),
    );
    expect(rows.goals).toEqual({ ...goals, training_location: 'home' });
    expect(rows.trainingSlots.map((s) => [s.slot_no, s.weekday, s.kind, s.minutes])).toEqual([
      [1, 1, 'strength_home', 60],
      [2, 3, 'strength_home', 60],
    ]);
  });

  it('nur Wunsch-Tage (ohne Tage pro Woche/Minuten) → keine Trainingstage, Felder trotzdem entfernt', () => {
    const rows = upgradeStoredRows(
      rowsWith({
        goals: legacyGoals({
          sessions_per_week: null,
          minutes_per_session: null,
          preferred_days: [1, 4],
        }),
      }),
    );
    expect(rows.goals).toEqual(goals);
    expect(rows.trainingSlots).toEqual([]);
  });

  it('vorhandene Trainingstage werden nie überschrieben', () => {
    const rows = upgradeStoredRows(
      rowsWith({
        goals: legacyGoals({ sessions_per_week: 3, minutes_per_session: 45, preferred_days: [] }),
        trainingSlots: [slot],
      }),
    );
    expect(rows.trainingSlots).toEqual([slot]);
    expect(rows.goals).toEqual(goals);
  });

  it('Langhantel-Werte über 25 kg entfernt, Kurzhanteln über 25 kg bleiben; bar_kg ergänzt', () => {
    const rows = upgradeStoredRows(
      rowsWith({
        userEquipment: [
          equipment('barbell', [2.5, 25, 27.5, 60]),
          equipment('dumbbells', [30, 40]),
        ],
      }),
    );
    expect(rows.userEquipment).toEqual([
      { ...equipment('barbell', [2.5, 25]), bar_kg: null },
      { ...equipment('dumbbells', [30, 40]), bar_kg: null },
    ]);
  });

  it('ein Stand im neuen Format bleibt unverändert', () => {
    const current: UserRows = rowsWith({
      goals,
      trainingSlots: [slot],
      userEquipment: [{ ...equipment('barbell', [5, 10]), bar_kg: 15 }],
    });
    expect(upgradeStoredRows(current)).toEqual(current);
  });

  it('fehlende trainingSlots (sehr alter Speicher) → leere Liste', () => {
    const stored = { ...rowsWith(), trainingSlots: undefined } as unknown as UserRows;
    expect(upgradeStoredRows(stored).trainingSlots).toEqual([]);
  });
});
