/**
 * Zuordnungsdatei „Auswärts essen“ (`content/food-mapping/auswaerts-zuordnung.json`, Gründer-Entscheidung G-AV2,
 * docs/PLAN-AUSWAERTS-VORRAT.md) für `content:validate` und `foods-import`.
 *
 * - Schema und Rechnung liegen in packages/core (`eating-out-mapping.ts`, eine Stelle für App und Prüfung).
 * - `content:validate` (blockierend): Schema (inkl. Begründung je Gericht), unbekannte Lebensmittel-IDs (weder im
 *   Katalog noch im Abschnitt `foods` noch in `alpha5-zuordnung.json`), doppelte Zuordnung eines Lebensmittels in
 *   beiden Dateien, neue Lebensmittel, die `foods-import` nicht annehmen würde. Hinweis (nicht blockierend):
 *   Lebensmittel „wartet auf Import“ und offene Quell-IDs.
 * - `foods-import`: Die neuen Lebensmittel laufen wie die Alpha5-Zutaten durch Kandidatensuche und Import
 *   (`withEatingOutFoods`). Nährwerte schreibt weiterhin nur der Workflow aus dem Quellauszug.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  EATING_OUT_MAPPING_PATH,
  type EatingOutFoodMapping,
  type EatingOutMapping,
  parseEatingOutMapping,
} from '@fitnessapp/core';

import { type FoodMapping, type MappingItem, mappingItemSchema } from './mapping';

/** Dateiname unter `content/food-mapping/`. */
export const EATING_OUT_MAPPING_FILE = 'auswaerts-zuordnung.json';
const ALPHA5_MAPPING_FILE = 'alpha5-zuordnung.json';

/**
 * Neues Lebensmittel der Auswärts-Zuordnung als Eintrag der Alpha5-Zuordnung (gleiche Felder; `alpha5_id` =
 * `food_id`, weil es keine Zutat der Gründer-Datei ist – der Gegencheck mit alpha5-rezepte.json entfällt dann).
 */
export function eatingOutFoodAsMappingItem(food: EatingOutFoodMapping): MappingItem {
  return {
    alpha5_id: food.food_id,
    food_id: food.food_id,
    alpha5_name: food.name_de,
    source: food.source,
    name_de: food.name_de,
    aliases_de: food.aliases_de,
    shopping_category: food.shopping_category,
    pantry: food.pantry,
    units: food.units,
    groups: food.groups,
    animal: food.animal,
    meat_kind: food.meat_kind,
    ...(food.gelatin_origin === undefined ? {} : { gelatin_origin: food.gelatin_origin }),
    pregnancy_caution: food.pregnancy_caution,
    alcohol: food.alcohol,
    max_fridge_days: food.max_fridge_days,
    freezable: food.freezable,
    substitutes: food.substitutes,
    reason_de: food.reason_de,
  };
}

/**
 * Alpha5-Zuordnung plus die neuen Lebensmittel der Auswärts-Zuordnung (für foods-import). Ein Lebensmittel darf nur
 * in EINER Datei zugeordnet sein – sonst Fehler (kein stilles Überschreiben).
 */
export function withEatingOutFoods(mapping: FoodMapping, eatingOut: EatingOutMapping): FoodMapping {
  const known = new Set(mapping.items.map((item) => item.food_id));
  const doubled = eatingOut.foods.filter((food) => known.has(food.food_id)).map((f) => f.food_id);
  if (doubled.length > 0) {
    throw new Error(
      `${EATING_OUT_MAPPING_PATH}: Lebensmittel schon in alpha5-zuordnung.json zugeordnet: ${doubled.join(', ')}`,
    );
  }
  return {
    ...mapping,
    items: [...mapping.items, ...eatingOut.foods.map(eatingOutFoodAsMappingItem)],
  };
}

/** Auswärts-Zuordnung aus dem Arbeitsordner lesen (fehlt = undefined; ungültig = Fehler mit Meldungen). */
export function readEatingOutMapping(repoRoot: string): EatingOutMapping | undefined {
  const full = join(repoRoot, EATING_OUT_MAPPING_PATH);
  if (!existsSync(full)) {
    return undefined;
  }
  const parsed = parseEatingOutMapping(JSON.parse(readFileSync(full, 'utf8')));
  if (!parsed.ok) {
    throw new Error(`${EATING_OUT_MAPPING_PATH} ungültig:\n${parsed.errors.join('\n')}`);
  }
  return parsed.mapping;
}

export interface EatingOutMappingCheck {
  /** Blockierende Befunde (wie Datei-Fehler). */
  readonly problems: readonly string[];
  /** Hinweise (nicht blockierend), z. B. „wartet auf Import“. */
  readonly notes: readonly string[];
}

function readJson(path: string): { data?: unknown; error?: string } {
  try {
    return { data: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/**
 * Prüft `content/food-mapping/auswaerts-zuordnung.json` gegen den Katalog (`catalogIds` = IDs in `content/foods/`).
 * Ohne Datei: keine Befunde.
 */
export function checkEatingOutMapping(
  contentDir: string,
  catalogIds: ReadonlySet<string>,
): EatingOutMappingCheck {
  const label = `food-mapping/${EATING_OUT_MAPPING_FILE}`;
  const path = join(contentDir, 'food-mapping', EATING_OUT_MAPPING_FILE);
  if (!existsSync(path)) {
    return { problems: [], notes: [] };
  }
  const { data, error } = readJson(path);
  if (error !== undefined) {
    return { problems: [`${label}: kein gültiges JSON (${error})`], notes: [] };
  }
  const parsed = parseEatingOutMapping(data);
  if (!parsed.ok) {
    return { problems: parsed.errors.map((e) => `${label}: ${e}`), notes: [] };
  }
  const mapping = parsed.mapping;
  const problems: string[] = [];
  const notes: string[] = [];

  // Alpha5-Zuordnung (dort zugeordnete Lebensmittel sind bekannt, auch wenn sie noch nicht importiert sind).
  const alpha5Path = join(contentDir, 'food-mapping', ALPHA5_MAPPING_FILE);
  const alpha5Ids = new Set<string>();
  if (existsSync(alpha5Path)) {
    const alpha5 = readJson(alpha5Path);
    const items = (alpha5.data as { items?: unknown } | undefined)?.items;
    if (Array.isArray(items)) {
      for (const item of items) {
        const id = (item as { food_id?: unknown }).food_id;
        if (typeof id === 'string') alpha5Ids.add(id);
      }
    }
  }

  const newIds = new Set(mapping.foods.map((food) => food.food_id));
  for (const food of mapping.foods) {
    if (alpha5Ids.has(food.food_id)) {
      problems.push(
        `${label}: Lebensmittel „${food.food_id}“ ist schon in ${ALPHA5_MAPPING_FILE} zugeordnet – nur EINE Zuordnung je Lebensmittel.`,
      );
    }
    const asItem = mappingItemSchema.safeParse(eatingOutFoodAsMappingItem(food));
    if (!asItem.success) {
      problems.push(
        `${label}: Lebensmittel „${food.food_id}“ würde von foods-import abgelehnt (${asItem.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}).`,
      );
    }
  }

  const waiting = new Map<string, string[]>();
  for (const dish of mapping.dishes) {
    for (const item of dish.items) {
      if (catalogIds.has(item.food_id)) continue;
      if (!newIds.has(item.food_id) && !alpha5Ids.has(item.food_id)) {
        problems.push(
          `${label}: Gericht „${dish.id}“ nutzt unbekanntes Lebensmittel „${item.food_id}“ – weder im Katalog (content/foods) noch unter „foods“ noch in ${ALPHA5_MAPPING_FILE}.`,
        );
        continue;
      }
      waiting.set(item.food_id, [...(waiting.get(item.food_id) ?? []), dish.id]);
    }
  }

  if (waiting.size > 0) {
    const affected = new Set([...waiting.values()].flat());
    const list = [...waiting.entries()]
      .sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))
      .map(([id, dishes]) => `${id} (${dishes.length})`);
    notes.push(
      `${label}: ${waiting.size} Lebensmittel warten auf Import (Workflow foods-import), ${affected.size} von ${mapping.dishes.length} Gerichten bleiben bis dahin ohne Werte: ${list.join(', ')}.`,
    );
  }
  const openRefs = mapping.foods.filter(
    (food) => food.source.ref === null && !catalogIds.has(food.food_id),
  );
  if (openRefs.length > 0) {
    notes.push(
      `${label}: ${openRefs.length} neue Lebensmittel ohne Quell-ID – zuerst foods-import Modus „kandidaten“, Quell-ID per Pull Request eintragen, dann Modus „import“: ${openRefs.map((f) => f.food_id).join(', ')}.`,
    );
  }
  const releasedWaiting = mapping.dishes.filter(
    (dish) => dish.status === 'released' && dish.items.some((item) => waiting.has(item.food_id)),
  );
  for (const dish of releasedWaiting) {
    notes.push(
      `${label}: Gericht „${dish.id}“ ist freigegeben, aber eine Zutat wartet auf Import – erscheint in der App erst danach.`,
    );
  }
  return { problems, notes };
}
