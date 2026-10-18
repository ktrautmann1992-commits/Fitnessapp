import type { TrainingSchedule } from '../training-schedule';

/**
 * R5 „weniger Trainingstage“ nach der Bestätigung (docs/PLAN-PHASE-4B.md 8.1 Punkt 3): neue Trainingstage für
 * `save_training_plan`. Feste Tage: der gewählte Wochentag (ISO 1–7) fällt weg; „Tage egal“: der letzte Eintrag fällt
 * weg (es gibt keinen Wochentag). null = nicht möglich (nur noch ein Tag bzw. Wochentag nicht im Plan).
 */
export function scheduleWithFewerDays(
  schedule: TrainingSchedule,
  dropWeekday: number,
): TrainingSchedule | null {
  if (schedule.slots.length <= 1) return null;
  if (schedule.mode === 'flex') {
    return { mode: 'flex', slots: schedule.slots.slice(0, -1) };
  }
  const slots = schedule.slots.filter((slot) => slot.weekday !== dropWeekday);
  if (slots.length === schedule.slots.length || slots.length === 0) return null;
  return { mode: 'fixed', slots };
}

/** Wochentage (ISO), die beim Umstellen wegfallen können: alle festen Trainingstage; „Tage egal“ → keine Auswahl. */
export function droppableWeekdays(schedule: TrainingSchedule): number[] {
  return schedule.mode === 'fixed' ? [...new Set(schedule.slots.map((s) => s.weekday))].sort() : [];
}
