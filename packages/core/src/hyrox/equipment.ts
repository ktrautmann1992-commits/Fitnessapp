import { GYM_OPTIONAL_EQUIPMENT_IDS } from '../equipment';
import type { HyroxStation } from '../enums';
import type { WorkoutStep } from '../plan/intensity';
import { type HyroxStationContext, hyroxStationTravelName } from './stations';

/**
 * Hyrox-Geräte und Reise-Modus (Sportarten Stufe 1 · Restpunkte, 27.10.2026, docs/PLAN-SPORTARTEN-STUFE-1.md 2.1):
 * - „Hyrox-Geräte im Studio“: ausdrückliche Angabe wie „Im Studio auch rudern“ – gespeichert als user_equipment-Zeilen
 *   mit Ort `gym` für alle Geräte aus GYM_OPTIONAL_EQUIPMENT_IDS (Schlitten, Ski-Ergometer, Sandsack, Wall Ball).
 *   Standard aus; ein Studio gilt sonst als voll ausgestattet, aber OHNE diese Spezialgeräte.
 * - Reise-Modus: In der Kombi wird jeder Stations-Schritt zu einer Zirkel-Übung mit den Reise-Geräten („Lauf +
 *   Körpergewicht-Zirkel“); gleiche Zeit, nie schwerer (Ersatz-Kette HYROX_STATION_EXERCISES). Rein.
 */

/** Eine Geräte-Zeile (user_equipment) – Ort und Gerät. */
export interface GymEquipmentRow {
  readonly equipment_id: string;
  readonly location: string;
}

/** Angabe „Hyrox-Geräte im Studio“ aus den gespeicherten Geräten (mindestens eines der Geräte mit Ort `gym`). */
export function gymHyroxFromRows(rows: readonly GymEquipmentRow[]): boolean {
  return rows.some(
    (row) => row.location === 'gym' && GYM_OPTIONAL_EQUIPMENT_IDS.includes(row.equipment_id),
  );
}

/** Geräte-IDs zur Angabe (alle vier oder keine). */
export function gymHyroxEquipmentIds(enabled: boolean): readonly string[] {
  return enabled ? GYM_OPTIONAL_EQUIPMENT_IDS : [];
}

/**
 * Reise-Modus im Timer: je Schritt der Name der Zirkel-Übung (nur Stations-Schritte; andere Schritte null). Ein
 * Stations-Schritt ohne passende Übung bekommt ebenfalls null – die App sagt dann „locker weiterlaufen“. Die Liste ist
 * gleich lang wie `steps`.
 */
export function hyroxTravelStationNames(
  steps: readonly WorkoutStep[],
  ctx: HyroxStationContext,
): (string | null)[] {
  const cache = new Map<HyroxStation, string | null>();
  return steps.map((step) => {
    if (step.kind !== 'station' || !step.station) return null;
    if (!cache.has(step.station))
      cache.set(step.station, hyroxStationTravelName(step.station, ctx));
    return cache.get(step.station) ?? null;
  });
}
