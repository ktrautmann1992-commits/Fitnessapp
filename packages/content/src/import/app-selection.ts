/**
 * App-Auswahl des Rezeptbuchs (Gründer-Entscheidung 24.10.2026, docs/PLAN-PHASE-5.md Nachtrag 24.10.2026):
 * Die App enthält nur etwa die Hälfte der Rezepte aus `alpha5-rezepte.json` (je Kategorie/Abschnitt), der Rest
 * bleibt nur im Buch (PDF). Die Liste steht in `content/rezeptbuch-app-auswahl.json`; der Import
 * (`importAlpha5`) übernimmt nur diese Rezepte und nur die dort genannten Meal-Prep-Pläne.
 *
 * Rein, ohne Dateisystem. Prüft die Auswahl gegen die Gründer-Datei: unbekannte/doppelte IDs, Foto je Rezept
 * (Dateiname wie im Rezeptbuch-Baukasten), Meal-Prep-Pläne vollständig.
 */
import { z } from 'zod';

import { type Alpha5File, Alpha5InputError } from './alpha5';

export const APP_SELECTION_PATH = 'content/rezeptbuch-app-auswahl.json';
export const APP_SELECTION_FILE_NAME = 'rezeptbuch-app-auswahl.json';
/** Ordner der Rezeptfotos im Rezeptbuch-Baukasten (Branch `rezeptbuch-baukasten`). */
export const RECIPE_PHOTO_DIR = 'content/rezeptbuch/fotos';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'ID: nur a–z, 0–9 und Bindestriche.');
const str = z.string().min(1);

export const appSelectionSchema = z.strictObject({
  format: z.literal('rezeptbuch-app-auswahl'),
  version: z.number().int().min(1),
  /** Wer hat entschieden, wann („Karsten 24.10.2026“). */
  entschieden: str,
  /** Fassung der Gründer-Datei, für die die Auswahl getroffen wurde („alpha5-rezepte.json@1.1“). */
  quelle: str,
  /** Auswahlregel in Worten (nachvollziehbar, deterministisch). */
  regel: str,
  /** Meal-Prep-Pläne, die in die App kommen (alle ihre Rezepte müssen ausgewählt sein). */
  meal_prep_plaene: z.array(slug),
  fotos: z.strictObject({
    quelle: str,
    /** Foto-Datei je ausgewähltem Rezept (Gründer: nur Rezepte mit Foto). */
    dateien: z.record(
      slug,
      z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/, 'Dateiname: <id>.jpg'),
    ),
  }),
  rezepte: z.array(slug).min(1),
});
export type AppSelection = z.infer<typeof appSelectionSchema>;

/** Slug wie im Rezeptbuch-Baukasten (`design.py` `slug`): Umlaute, „&“ → „und“, sonst Bindestriche. */
export function photoSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/&/g, 'und')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Erlaubte Foto-Dateinamen eines Rezepts: `<id>.jpg`, bzw. – wie im Rezeptbuch-Baukasten (`foto_id`) bei einem Namen,
 * der in mehreren Kapiteln vorkommt – `<kategorie>-<slug(name)>.jpg`.
 */
export function allowedPhotoFiles(recipe: {
  id: string;
  name: string;
  kategorie: string;
}): string[] {
  return [`${recipe.id}.jpg`, `${recipe.kategorie}-${photoSlug(recipe.name)}.jpg`];
}

/** Prüft die Auswahl gegen die Gründer-Datei; leere Liste = in Ordnung. */
export function appSelectionProblems(selection: AppSelection, file: Alpha5File): string[] {
  const problems: string[] = [];
  const recipes = new Map(file.rezepte.map((r) => [r.id, r]));
  const plans = new Map(file.meal_prep_plaene.map((p) => [p.id, p]));
  const selected = new Set<string>();
  for (const id of selection.rezepte) {
    if (selected.has(id)) problems.push(`rezepte: „${id}“ doppelt.`);
    selected.add(id);
    if (!recipes.has(id)) problems.push(`rezepte: „${id}“ fehlt in alpha5-rezepte.json.`);
  }
  // Foto je Rezept (harte Bedingung der Gründer).
  for (const id of selected) {
    const recipe = recipes.get(id);
    const photo = selection.fotos.dateien[id];
    if (photo === undefined) {
      problems.push(
        `fotos.dateien: kein Foto für „${id}“ (nur Rezepte mit Foto kommen in die App).`,
      );
    } else if (recipe !== undefined && !allowedPhotoFiles(recipe).includes(photo)) {
      problems.push(
        `fotos.dateien: „${photo}“ passt nicht zu „${id}“ (erlaubt: ${allowedPhotoFiles(recipe).join(', ')}).`,
      );
    }
  }
  for (const id of Object.keys(selection.fotos.dateien)) {
    if (!selected.has(id)) problems.push(`fotos.dateien: „${id}“ ist nicht ausgewählt.`);
  }
  // Meal-Prep-Pläne: Plan in der App ⇔ alle seine Rezepte in der App.
  const listedPlans = new Set(selection.meal_prep_plaene);
  for (const id of listedPlans) {
    const plan = plans.get(id);
    if (plan === undefined) {
      problems.push(`meal_prep_plaene: „${id}“ fehlt in alpha5-rezepte.json.`);
      continue;
    }
    const missing = plan.rezepte.filter((r) => !selected.has(r));
    if (missing.length > 0) {
      problems.push(
        `meal_prep_plaene: Plan „${id}“ braucht auch ${missing.map((m) => `„${m}“`).join(', ')}.`,
      );
    }
  }
  for (const id of selected) {
    const planId = recipes.get(id)?.meal_prep_plan;
    if (planId !== undefined && !listedPlans.has(planId)) {
      problems.push(
        `rezepte: „${id}“ gehört zum Meal-Prep-Plan „${planId}“, der nicht in der App ist – Plan aufnehmen oder Rezept streichen.`,
      );
    }
  }
  return problems;
}

/** Prüft Aufbau und Inhalt der Auswahl; wirft `Alpha5InputError` (dann wird nichts geschrieben). */
export function parseAppSelection(data: unknown, file: Alpha5File): AppSelection {
  const parsed = appSelectionSchema.safeParse(data);
  if (!parsed.success) {
    throw new Alpha5InputError(
      parsed.error.issues.map((issue) => `${issue.path.join('.') || '(Datei)'}: ${issue.message}`),
      APP_SELECTION_FILE_NAME,
    );
  }
  const problems = appSelectionProblems(parsed.data, file);
  if (problems.length > 0) {
    throw new Alpha5InputError(problems, APP_SELECTION_FILE_NAME);
  }
  return parsed.data;
}

/** Gruppe (Kategorie/Abschnitt), die immer abgerundet wird – sonst läge die Summe bei 154 (Regel der Auswahl). */
export const APP_SELECTION_ALWAYS_DOWN = { kategorie: 'fleisch', abschnitt: 'Abendessen' } as const;

/**
 * Soll-Anzahl je Kategorie/Abschnitt nach der Regel der Auswahl (Gründer 24.10.2026): gerade n → n/2; ungerade n in
 * Datei-Reihenfolge abwechselnd ab- und aufgerundet (beginnend mit abrunden); n = 1 → 1;
 * `APP_SELECTION_ALWAYS_DOWN` immer abgerundet und nicht im Wechsel. Schlüssel: `kategorie|abschnitt`.
 */
export function appSelectionQuotas(file: Alpha5File): Map<string, number> {
  const sizes = new Map<string, number>();
  for (const r of file.rezepte) {
    const key = `${r.kategorie}|${r.abschnitt}`;
    sizes.set(key, (sizes.get(key) ?? 0) + 1);
  }
  const quotas = new Map<string, number>();
  let up = false;
  for (const [key, n] of sizes) {
    if (n === 1) quotas.set(key, 1);
    else if (
      key === `${APP_SELECTION_ALWAYS_DOWN.kategorie}|${APP_SELECTION_ALWAYS_DOWN.abschnitt}`
    )
      quotas.set(key, Math.floor(n / 2));
    else if (n % 2 === 0) quotas.set(key, n / 2);
    else {
      quotas.set(key, up ? Math.ceil(n / 2) : Math.floor(n / 2));
      up = !up;
    }
  }
  return quotas;
}
