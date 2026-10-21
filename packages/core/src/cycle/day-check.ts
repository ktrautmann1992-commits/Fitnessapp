import { CYCLE_RULES } from '../constants';
import { addDays } from '../dates';
import type { CycleEntryPayload, CycleEntry } from './schemas';

/**
 * Tages-Check → Angebot „Heute leichter?“ (docs/PLAN-PHASE-9.md 3.3). Nur weniger, nie mehr; nichts passiert
 * automatisch – die Person wählt „Heute leichter“, „Wie geplant“ oder „Verschieben“. Keine Phasen-Regeln: dieselbe
 * Logik für jeden Status.
 */

/** Was heute im Plan steht (aus Sicht des Angebots). */
export type PlannedTodayState =
  /** Keine geplante Einheit heute. */
  | 'none'
  /** Geplante Einheit, noch nicht begonnen (kein Entwurf, kein Eintrag). */
  | 'planned'
  /** Schon begonnen oder eingetragen. */
  | 'started';

export interface CycleDayContext {
  readonly planned: PlannedTodayState;
  /** Renntag (Phase 10): kein Angebot, Hinweis nur im Zyklus-Bildschirm. */
  readonly raceDay: boolean;
  /** Modul aktiv (nicht pausiert, nicht in der Schwangerschafts-Pause). */
  readonly moduleActive: boolean;
}

export type CycleDayHint =
  /** An ≥ 4 von 14 Tagen leichter angeboten → einmaliger Arzt-Hinweis. */
  | 'lighter_often'
  /** Renntag: „Die Periode am Renntag ist häufig …“ (nur im Zyklus-Bildschirm). */
  | 'race_day';

export interface CycleDayAssessment {
  readonly lighterOffer: boolean;
  readonly hints: readonly CycleDayHint[];
}

/**
 * Würde dieser Eintrag ein „leichter“ nahelegen? Energie ≤ 2, eine Beschwerde „stark“ oder Blutung „stark“ mit
 * Energie ≤ 3.
 */
export function entrySuggestsLighter(payload: CycleEntryPayload | null | undefined): boolean {
  if (!payload) return false;
  const energy = payload.energy ?? null;
  if (energy !== null && energy <= CYCLE_RULES.lighterOffer.maxEnergy) return true;
  if (Object.values(payload.symptoms ?? {}).some((intensity) => intensity === 'strong')) {
    return true;
  }
  return (
    payload.bleeding === 'heavy' &&
    energy !== null &&
    energy <= CYCLE_RULES.lighterOffer.heavyBleedingMaxEnergy
  );
}

/** Tage der letzten 14, an denen der Eintrag „leichter“ nahelegte. */
export function lighterSuggestionDays(entries: readonly CycleEntry[], today: string): number {
  const from = addDays(today, -(CYCLE_RULES.lighterCluster.windowDays - 1));
  return entries.filter((e) => e.date >= from && e.date <= today && entrySuggestsLighter(e.payload))
    .length;
}

/**
 * Bewertung für heute: Angebot nur mit aktivem Modul, geplanter und noch nicht begonnener Einheit und nicht am
 * Renntag. Hinweise unabhängig von der geplanten Einheit.
 */
export function cycleDayAssessment(
  today: CycleEntry | null,
  recentEntries: readonly CycleEntry[],
  context: CycleDayContext,
): CycleDayAssessment {
  if (!context.moduleActive) return { lighterOffer: false, hints: [] };
  const hints: CycleDayHint[] = [];
  if (context.raceDay) hints.push('race_day');
  const date = today?.date;
  if (
    date !== undefined &&
    lighterSuggestionDays(recentEntries, date) >= CYCLE_RULES.lighterCluster.minDays
  ) {
    hints.push('lighter_often');
  }
  const lighterOffer =
    context.planned === 'planned' && !context.raceDay && entrySuggestsLighter(today?.payload);
  return { lighterOffer, hints };
}
