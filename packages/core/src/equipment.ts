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
}

/**
 * Geräte-Katalog (Startliste aus docs/KONZEPT.md Abschnitt 2, Punkt 8).
 * Muss zu supabase/migrations/20261003120700_seed_equipment.sql passen (geprüft in db-sync.test.ts).
 */
export const EQUIPMENT = [
  {
    id: 'dumbbells',
    nameDe: 'Kurzhanteln',
    category: 'free_weights',
    hasWeights: true,
    sortOrder: 10,
  },
  {
    id: 'barbell',
    nameDe: 'Langhantel mit Scheiben',
    category: 'free_weights',
    hasWeights: true,
    sortOrder: 20,
  },
  {
    id: 'kettlebells',
    nameDe: 'Kettlebells',
    category: 'free_weights',
    hasWeights: true,
    sortOrder: 30,
  },
  { id: 'flat_bench', nameDe: 'Flachbank', category: 'bench', hasWeights: false, sortOrder: 40 },
  {
    id: 'incline_bench',
    nameDe: 'Schrägbank',
    category: 'bench',
    hasWeights: false,
    sortOrder: 50,
  },
  {
    id: 'pull_up_bar',
    nameDe: 'Klimmzugstange',
    category: 'bodyweight',
    hasWeights: false,
    sortOrder: 60,
  },
  {
    id: 'resistance_bands',
    nameDe: 'Widerstandsbänder',
    category: 'bands',
    hasWeights: false,
    sortOrder: 70,
  },
  {
    id: 'rowing_machine',
    nameDe: 'Rudergerät',
    category: 'cardio',
    hasWeights: false,
    sortOrder: 80,
  },
  {
    id: 'bike_ergometer',
    nameDe: 'Ergometer (Fahrrad)',
    category: 'cardio',
    hasWeights: false,
    sortOrder: 90,
  },
  { id: 'treadmill', nameDe: 'Laufband', category: 'cardio', hasWeights: false, sortOrder: 100 },
  { id: 'other', nameDe: 'Sonstiges', category: 'other', hasWeights: false, sortOrder: 1000 },
] as const satisfies readonly EquipmentItem[];

export type EquipmentId = (typeof EQUIPMENT)[number]['id'];

/** „Sonstiges“: nur hier ist (und muss) ein Freitext angegeben werden. */
export const OTHER_EQUIPMENT_ID = 'other' satisfies EquipmentId;

export const EQUIPMENT_IDS = EQUIPMENT.map((item) => item.id) as [EquipmentId, ...EquipmentId[]];

export const equipmentIdSchema = z.enum(EQUIPMENT_IDS, { error: 'Unbekanntes Gerät.' });

/** Katalog-Eintrag zu einer ID (undefined bei unbekannter ID). */
export function findEquipment(id: string): EquipmentItem | undefined {
  return EQUIPMENT.find((item) => item.id === id);
}
