import { MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION } from '../constants';

/**
 * Ausdauer-Grenze (CLAUDE.md, docs/PLAN-PHASE-3-ERWEITERUNG.md 5.5 Punkt 2): Der Umfang einer Belastungswoche
 * steigt höchstens auf floor(1,1 × Umfang der letzten Belastungswoche) – ganze Minuten, nie über dem Plan.
 * Ohne Bezugswoche (`previous` ≤ 0, z. B. erste Belastungswoche eines neuen Plans) gilt der Startumfang
 * `start`, nicht der Wunsch. Woche 0 und Erholungswochen übergibt der Aufrufer nie als `previous`.
 */
export function capWeeklyIncrease(previous: number, planned: number, start: number): number {
  const wish = Math.max(0, Math.floor(planned));
  if (!(previous > 0)) {
    return Math.min(wish, Math.max(0, Math.floor(start)));
  }
  return Math.min(wish, increasedMinutes(previous));
}

/** floor((1 + 10 %) × Minuten), in ganzen Prozent gerechnet (keine Gleitkomma-Reste wie 32,99999…). */
export function increasedMinutes(previous: number): number {
  const percent = Math.round((1 + MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION) * 100);
  return Math.floor((Math.floor(previous) * percent) / 100);
}

/** floor(Faktor × Minuten) in ganzen Prozent (z. B. Erholungswoche 60 %). */
export function scaledMinutes(minutes: number, factor: number): number {
  return Math.floor((Math.floor(minutes) * Math.round(factor * 100)) / 100);
}
