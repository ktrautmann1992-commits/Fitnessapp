import { z } from 'zod';

/**
 * Lebensmittel-Gruppen für „mag / mag nicht / Unverträglichkeit“ im Onboarding.
 * Enthält die 14 EU-Hauptallergene (LMIV, Anhang II) sowie häufige Unverträglichkeiten und Vorlieben.
 * In Phase 5 werden die Gruppen mit der Lebensmittel-Tabelle (`foods`) verknüpft.
 * Muss zur CHECK-Liste von food_preferences.food_group in
 * supabase/migrations/20261003120500_nutrition_preferences.sql passen (geprüft in db-sync.test.ts).
 */
export const FOOD_GROUPS = [
  { id: 'gluten', nameDe: 'Glutenhaltiges Getreide (Weizen, Roggen, Gerste)' },
  { id: 'dairy', nameDe: 'Milch und Milchprodukte' },
  { id: 'lactose', nameDe: 'Laktose (Milchzucker)' },
  { id: 'eggs', nameDe: 'Eier' },
  { id: 'fish', nameDe: 'Fisch' },
  { id: 'shellfish', nameDe: 'Krebs- und Weichtiere (Garnelen, Muscheln …)' },
  { id: 'poultry', nameDe: 'Geflügel' },
  { id: 'beef', nameDe: 'Rind' },
  { id: 'lamb', nameDe: 'Lamm' },
  { id: 'legumes', nameDe: 'Hülsenfrüchte (Linsen, Bohnen, Kichererbsen)' },
  { id: 'soy', nameDe: 'Soja' },
  { id: 'peanuts', nameDe: 'Erdnüsse' },
  { id: 'tree_nuts', nameDe: 'Schalenfrüchte (Nüsse)' },
  { id: 'sesame', nameDe: 'Sesam' },
  { id: 'celery', nameDe: 'Sellerie' },
  { id: 'mustard', nameDe: 'Senf' },
  { id: 'lupin', nameDe: 'Lupinen' },
  { id: 'sulphites', nameDe: 'Schwefeldioxid und Sulfite' },
  { id: 'fructose', nameDe: 'Fruktose (Fruchtzucker)' },
  { id: 'histamine', nameDe: 'Histaminreiche Lebensmittel' },
  { id: 'mushrooms', nameDe: 'Pilze' },
  { id: 'onion_garlic', nameDe: 'Zwiebeln und Knoblauch' },
  { id: 'spicy', nameDe: 'Scharfes Essen' },
] as const satisfies readonly { id: string; nameDe: string }[];

export type FoodGroupId = (typeof FOOD_GROUPS)[number]['id'];

export const FOOD_GROUP_IDS = FOOD_GROUPS.map((group) => group.id) as [
  FoodGroupId,
  ...FoodGroupId[],
];

export const foodGroupSchema = z.enum(FOOD_GROUP_IDS, { error: 'Unbekannte Lebensmittel-Gruppe.' });
