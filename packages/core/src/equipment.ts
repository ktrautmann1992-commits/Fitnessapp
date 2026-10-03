import { z } from 'zod';

import type { EquipmentCategory } from './enums';

export interface EquipmentItem {
  /** Slug, identisch mit `equipment.id` in der Datenbank. */
  readonly id: string;
  readonly nameDe: string;
  readonly category: EquipmentCategory;
  /** true = Gewichtsstufen in kg sind sinnvoll. */
  readonly hasWeights: boolean;
  readonly sortOrder: number;
  /**
   * true = im Onboarding unter „Equipment zu Hause“ auswählbar. Studio-Geräte (Kabelzug, Maschinen …) sind
   * false: Sie dürfen beim Ort „home“ weder hier (equipmentItemSchema) noch in der Datenbank gespeichert werden.
   */
  readonly homeSelectable: boolean;
}

/**
 * Geräte-Katalog (Startliste aus docs/KONZEPT.md Abschnitt 2, Punkt 8; Studio-Geräte ab Phase 2).
 * Muss zu supabase/migrations/20261003120700_seed_equipment.sql und
 * 20261003130100_equipment_home_selectable.sql passen (geprüft in db-sync.test.ts).
 * Annahme bis Phase 9b: „Studio“ = gut ausgestattetes Standard-Studio mit allen Geräten dieser Liste.
 */
export const EQUIPMENT = [
  {
    id: 'dumbbells',
    nameDe: 'Kurzhanteln',
    category: 'free_weights',
    hasWeights: true,
    sortOrder: 10,
    homeSelectable: true,
  },
  {
    id: 'barbell',
    nameDe: 'Langhantel mit Scheiben',
    category: 'free_weights',
    hasWeights: true,
    sortOrder: 20,
    homeSelectable: true,
  },
  {
    id: 'kettlebells',
    nameDe: 'Kettlebells',
    category: 'free_weights',
    hasWeights: true,
    sortOrder: 30,
    homeSelectable: true,
  },
  {
    id: 'flat_bench',
    nameDe: 'Flachbank',
    category: 'bench',
    hasWeights: false,
    sortOrder: 40,
    homeSelectable: true,
  },
  {
    id: 'incline_bench',
    nameDe: 'Schrägbank',
    category: 'bench',
    hasWeights: false,
    sortOrder: 50,
    homeSelectable: true,
  },
  {
    id: 'pull_up_bar',
    nameDe: 'Klimmzugstange',
    category: 'bodyweight',
    hasWeights: false,
    sortOrder: 60,
    homeSelectable: true,
  },
  {
    id: 'resistance_bands',
    nameDe: 'Widerstandsbänder',
    category: 'bands',
    hasWeights: false,
    sortOrder: 70,
    homeSelectable: true,
  },
  {
    id: 'rowing_machine',
    nameDe: 'Rudergerät',
    category: 'cardio',
    hasWeights: false,
    sortOrder: 80,
    homeSelectable: true,
  },
  {
    id: 'bike_ergometer',
    nameDe: 'Ergometer (Fahrrad)',
    category: 'cardio',
    hasWeights: false,
    sortOrder: 90,
    homeSelectable: true,
  },
  {
    id: 'treadmill',
    nameDe: 'Laufband',
    category: 'cardio',
    hasWeights: false,
    sortOrder: 100,
    homeSelectable: true,
  },
  // Studio-Geräte (Phase 2): nicht unter „Equipment zu Hause“ auswählbar.
  {
    id: 'power_rack',
    nameDe: 'Rack (Hantelablage)',
    category: 'free_weights',
    hasWeights: false,
    sortOrder: 200,
    homeSelectable: false,
  },
  {
    id: 'cable_station',
    nameDe: 'Kabelzug',
    category: 'machines',
    hasWeights: false,
    sortOrder: 210,
    homeSelectable: false,
  },
  {
    id: 'lat_pulldown',
    nameDe: 'Latzug',
    category: 'machines',
    hasWeights: false,
    sortOrder: 220,
    homeSelectable: false,
  },
  {
    id: 'leg_press',
    nameDe: 'Beinpresse',
    category: 'machines',
    hasWeights: false,
    sortOrder: 230,
    homeSelectable: false,
  },
  {
    id: 'machine_chest_press',
    nameDe: 'Brustpresse',
    category: 'machines',
    hasWeights: false,
    sortOrder: 240,
    homeSelectable: false,
  },
  {
    id: 'leg_curl_machine',
    nameDe: 'Beinbeuger-Maschine',
    category: 'machines',
    hasWeights: false,
    sortOrder: 250,
    homeSelectable: false,
  },
  {
    id: 'leg_extension_machine',
    nameDe: 'Beinstrecker-Maschine',
    category: 'machines',
    hasWeights: false,
    sortOrder: 260,
    homeSelectable: false,
  },
  {
    id: 'dip_station',
    nameDe: 'Dip-Station',
    category: 'bodyweight',
    hasWeights: false,
    sortOrder: 270,
    homeSelectable: false,
  },
  {
    id: 'other',
    nameDe: 'Sonstiges',
    category: 'other',
    hasWeights: false,
    sortOrder: 1000,
    homeSelectable: true,
  },
] as const satisfies readonly EquipmentItem[];

export type EquipmentId = (typeof EQUIPMENT)[number]['id'];

/** „Sonstiges“: nur hier ist (und muss) ein Freitext angegeben werden. */
export const OTHER_EQUIPMENT_ID = 'other' satisfies EquipmentId;

export const EQUIPMENT_IDS = EQUIPMENT.map((item) => item.id) as [EquipmentId, ...EquipmentId[]];

export const equipmentIdSchema = z.enum(EQUIPMENT_IDS, { error: 'Unbekanntes Gerät.' });

/** Geräte, die unter „Equipment zu Hause“ angeboten werden (Onboarding). */
export const HOME_SELECTABLE_EQUIPMENT = EQUIPMENT.filter((item) => item.homeSelectable);

/** true, wenn das Gerät im Katalog steht und zu Hause auswählbar ist. */
export function isHomeSelectable(id: string): boolean {
  return findEquipment(id)?.homeSelectable === true;
}

/** Katalog-Eintrag zu einer ID (undefined bei unbekannter ID). */
export function findEquipment(id: string): EquipmentItem | undefined {
  return EQUIPMENT.find((item) => item.id === id);
}
