import { addDays, startOfIsoWeek } from '../dates';
import { SPORT_IDS, type SportId } from '../enums';
import { sessionTrainingLoad } from './load';

/**
 * Wochen-Summen je Sportart und Trainingsbelastung der Woche (docs/PLAN-SPORTARTEN.md 5): Einheiten, Minuten,
 * Kilometer (GPS-Sportarten), kcal (nur bekannte) und Belastungspunkte je Sportart; dazu die Belastung ALLER Einheiten
 * der Woche (Kraft und Ausdauer mit SPORT_LOAD.fallbackEffort ohne Angabe). Rein; die App liefert Dauer und kcal je
 * Eintrag (sportLogDurationS/sessionLogDurationS, sessionCalories).
 */

export interface SportWeekLog {
  readonly id: string;
  readonly performed_on: string;
  /** null = Kraft/Ausdauer (zählt nur zur Gesamt-Belastung). */
  readonly sport: SportId | null;
  readonly durationS: number | null;
  readonly distanceM: number | null;
  /** Anstrengung 0–10 (session_rpe). */
  readonly effort: number | null;
  /** kcal der Einheit (Uhr oder Schätzung); null = keine Zahl. */
  readonly kcal: number | null;
}

export interface SportWeekTotal {
  readonly sport: SportId;
  readonly sessions: number;
  readonly durationS: number;
  /** Summe der Distanzen in Metern; null, wenn keine Einheit eine Distanz hat. */
  readonly distanceM: number | null;
  /** Summe der bekannten kcal; null, wenn keine Einheit eine Zahl hat. */
  readonly kcal: number | null;
  readonly load: number;
}

export interface SportWeekSummary {
  readonly weekStart: string;
  /** Je Sportart, meiste Minuten zuerst (bei Gleichstand Katalog-Reihenfolge). */
  readonly sports: readonly SportWeekTotal[];
  /** Belastungspunkte nur der Sportarten. */
  readonly sportLoad: number;
  /** Belastungspunkte aller Einheiten der Woche. */
  readonly totalLoad: number;
}

export function sportWeekSummary(input: {
  readonly logs: readonly SportWeekLog[];
  /** Ein Tag der gewünschten Woche. */
  readonly weekOf: string;
}): SportWeekSummary {
  const weekStart = startOfIsoWeek(input.weekOf);
  const weekEnd = addDays(weekStart, 6);
  const inWeek = input.logs.filter((l) => l.performed_on >= weekStart && l.performed_on <= weekEnd);
  const totals = new Map<
    SportId,
    {
      sessions: number;
      durationS: number;
      distanceM: number | null;
      kcal: number | null;
      load: number;
    }
  >();
  let totalLoad = 0;
  let sportLoad = 0;
  for (const log of inWeek) {
    const load =
      sessionTrainingLoad({ durationS: log.durationS, effort: log.effort, sport: log.sport }) ?? 0;
    totalLoad += load;
    if (log.sport === null) continue;
    sportLoad += load;
    const t = totals.get(log.sport) ?? {
      sessions: 0,
      durationS: 0,
      distanceM: null,
      kcal: null,
      load: 0,
    };
    totals.set(log.sport, {
      sessions: t.sessions + 1,
      durationS: t.durationS + Math.max(0, log.durationS ?? 0),
      distanceM:
        log.distanceM !== null && log.distanceM > 0
          ? (t.distanceM ?? 0) + log.distanceM
          : t.distanceM,
      kcal: log.kcal !== null ? (t.kcal ?? 0) + log.kcal : t.kcal,
      load: t.load + load,
    });
  }
  const sports = [...totals.entries()]
    .map(([sport, t]) => ({ sport, ...t }))
    .sort(
      (a, b) =>
        b.durationS - a.durationS || SPORT_IDS.indexOf(a.sport) - SPORT_IDS.indexOf(b.sport),
    );
  return { weekStart, sports, sportLoad, totalLoad };
}
