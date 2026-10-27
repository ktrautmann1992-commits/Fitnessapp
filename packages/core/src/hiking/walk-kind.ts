import { FREE_SESSION, HIKING_SAFETY } from '../constants';
import type { TrackedRouteSport, WalkKind } from '../enums';

/**
 * Art einer Geh-Einheit (Sportarten Stufe 1 · Etappe W, docs/PLAN-SPORTARTEN-STUFE-1.md 2.2): „Gehen | Wandern |
 * Bergwandern“ beim Start der Geh-Aufzeichnung (wie „Fahrrad | E-Bike“). Die Sportart bleibt `walk`; null in der
 * Datenbank = Gehen. Eine Wanderung ist eine freie Ausdauer-Einheit und erzeugt keine geplanten Einheiten – sie zählt
 * NICHT für die 10-%-Kette des Plans (wie alle freien Einheiten), nur für den Bein-Hinweis am Folgetag (leg-load.ts).
 */

/** Wanderung oder Bergwanderung (nicht der Spaziergang). */
export type HikeKind = Exclude<WalkKind, 'walk'>;

/** null/fehlend = Gehen. */
export function effectiveWalkKind(kind: WalkKind | null | undefined): WalkKind {
  return kind ?? 'walk';
}

export function isHikeKind(kind: WalkKind | null | undefined): kind is HikeKind {
  return kind === 'hike' || kind === 'mountain_hike';
}

/** Name der freien Einheit je Art („Spaziergang“, „Wanderung“, „Bergwanderung“ – gleich wie der Server). */
export function walkKindName(kind: WalkKind | null | undefined): string {
  return FREE_SESSION.names.walkKinds[effectiveWalkKind(kind)];
}

/**
 * Wert für walk_kind beim Speichern: Gehen → null (wie bisher, ältere Daten bleiben gleich), sonst die Art; andere
 * Sportarten immer null.
 */
export function walkKindToStore(
  sport: TrackedRouteSport | string,
  kind: WalkKind | null | undefined,
): WalkKind | null {
  return sport === 'walk' && isHikeKind(kind) ? kind : null;
}

/** SAC-Wanderskala: T1–T3 begleitet die App; ab T4 nur ein Hinweis (nie Sperre, Entscheidung 10). */
export type SacGuidance = 'accompanied' | 'outside_app';

export function sacGuidance(grade: number): SacGuidance {
  return grade <= HIKING_SAFETY.sac.accompaniedMax ? 'accompanied' : 'outside_app';
}

/**
 * SAC-Stufe zum Speichern (tracked_routes.sac_grade 1–3, nur Wandern/Bergwandern): T4+ und ungültige Werte → null
 * (die App zeigt den Hinweis, speichert aber nur, was sie begleitet).
 */
export function sacGradeToStore(
  kind: WalkKind | null | undefined,
  grade: number | null | undefined,
): number | null {
  if (!isHikeKind(kind) || grade == null || !Number.isInteger(grade)) return null;
  return grade >= HIKING_SAFETY.sac.min && grade <= HIKING_SAFETY.sac.accompaniedMax ? grade : null;
}
