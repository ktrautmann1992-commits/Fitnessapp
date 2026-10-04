import { z } from 'zod';

import { BARBELL_PLATE_MAX_KG, PLANNED_LOAD_LIMITS } from './constants';
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
  /**
   * Typische Gewichte zum Antippen im Onboarding (Mehrfachauswahl, aufsteigend). Nur bei Geräten mit Gewichten.
   * Kurzhanteln: Gewicht JE HANTEL; Langhantel: SCHEIBEN je Paar (≤ BARBELL_PLATE_MAX_KG, die Stange steht
   * getrennt in bar_kg); Kettlebells: je Kugel. Nur App-Daten, nicht in der Datenbank.
   * Quelle: übliche Handelsgrößen (Kurzhantel-Sets, Hantelscheiben 1,25–25 kg, Kettlebells in 2/4-kg-Schritten) –
   * PRODUKTENTSCHEIDUNG (Erweiterungsplan Abschnitt 3.3).
   */
  readonly weightPresetsKg?: readonly number[];
}

/** Kurzhanteln je Hantel: 1–10 kg in 1-kg-Schritten, danach übliche Größen bis 40 kg (33 Werte). */
const DUMBBELL_PRESETS_KG = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 12.5, 14, 15, 16, 17.5, 18, 20, 22, 22.5, 24, 25, 26, 27.5, 28,
  30, 32, 32.5, 34, 35, 36, 37.5, 40,
] as const;

/** Hantelscheiben je Paar. */
const BARBELL_PLATE_PRESETS_KG = [1.25, 2.5, 5, 10, 15, 20, 25] as const;

/** Kettlebells je Kugel. */
const KETTLEBELL_PRESETS_KG = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32] as const;

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
    weightPresetsKg: DUMBBELL_PRESETS_KG,
  },
  {
    id: 'barbell',
    nameDe: 'Langhantel mit Scheiben',
    category: 'free_weights',
    hasWeights: true,
    sortOrder: 20,
    homeSelectable: true,
    weightPresetsKg: BARBELL_PLATE_PRESETS_KG,
  },
  {
    id: 'kettlebells',
    nameDe: 'Kettlebells',
    category: 'free_weights',
    hasWeights: true,
    sortOrder: 30,
    homeSelectable: true,
    weightPresetsKg: KETTLEBELL_PRESETS_KG,
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

/** Langhantel: Stange in bar_kg, Scheiben in weights_kg (je Paar, höchstens BARBELL_PLATE_MAX_KG). */
export const BARBELL_ID = 'barbell' satisfies EquipmentId;

/** Typische Gewichte eines Geräts zum Antippen (leer bei Geräten ohne Gewichte). */
export function weightPresetsFor(id: string): readonly number[] {
  return findEquipment(id)?.weightPresetsKg ?? [];
}

/** Rechen-Einheit 0,01 kg = Speichergenauigkeit (numeric(5,2)); jede gültige Scheibe ist eine ganze Zahl davon. */
const UNITS_PER_KG = 100;

/**
 * Alle ladbaren Gesamtgewichte einer Langhantel (Erweiterungsplan 4.3, Wächter-Befund 7):
 * Stange + 2 × Teilsumme der Scheiben. Annahme (Frage 8): von jedem angetippten Gewicht genau EIN PAAR – also
 * je Seite jede Scheibe höchstens einmal (vorsichtig, eher zu leicht).
 *
 * Verfahren: Teilsummen-DP über ganze Einheiten (0,01 kg – feiner als das übliche 0,25-kg-Raster und exakt für
 * jede speicherbare Scheibe), daher keine Gleitkomma-Reste und keine Aufzählung aller 2^n Teilmengen. Laufzeit
 * O(n · S) mit S = höchstens (PLANNED_LOAD_LIMITS.max − Stange) / 2 je Seite.
 * Ergebnis: aufsteigend, eindeutig, gedeckelt auf PLANNED_LOAD_LIMITS.targetWeightKg.max. Ohne Scheiben = nur
 * die Stange. Scheiben über BARBELL_PLATE_MAX_KG, ≤ 0 oder doppelte werden ignoriert (das Schema lehnt sie ab).
 */
export function barbellLoadSteps(barKg: number, plates: readonly number[]): number[] {
  const bar = Math.round(barKg * UNITS_PER_KG);
  const cap = Math.round(PLANNED_LOAD_LIMITS.targetWeightKg.max * UNITS_PER_KG);
  if (!Number.isFinite(bar) || bar <= 0 || bar > cap) {
    return [];
  }
  const perSideMax = Math.floor((cap - bar) / 2);
  const units = [
    ...new Set(
      plates
        .filter((kg) => Number.isFinite(kg) && kg > 0 && kg <= BARBELL_PLATE_MAX_KG)
        .map((kg) => Math.round(kg * UNITS_PER_KG)),
    ),
  ];
  // reachable[s] = true, wenn sich je Seite genau s Einheiten laden lassen.
  const reachable = new Uint8Array(perSideMax + 1);
  reachable[0] = 1;
  let highest = 0;
  for (const plate of units) {
    if (plate > perSideMax) {
      continue;
    }
    // Rückwärts, damit jede Scheibe je Seite höchstens einmal zählt (0/1-Teilsumme).
    for (let s = Math.min(highest, perSideMax - plate); s >= 0; s -= 1) {
      if (reachable[s] === 1) {
        reachable[s + plate] = 1;
      }
    }
    highest = Math.min(perSideMax, highest + plate);
  }
  const steps: number[] = [];
  for (let s = 0; s <= highest; s += 1) {
    if (reachable[s] === 1) {
      steps.push((bar + 2 * s) / UNITS_PER_KG);
    }
  }
  return steps;
}
