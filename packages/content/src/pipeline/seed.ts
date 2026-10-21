/**
 * `content-seed` (docs/PLAN-PHASE-2.md Abschnitte 4 Schritt 4 und 5 Punkt 5; Ernährung seit Etappe N7 Teil 2):
 * 1. ALLE Inhalte selbst prüfen (content:validate) – bei einem einzigen blockierenden Fehler wird NICHTS
 *    eingespielt.
 * 2. Einspiel-Paket bauen: nur `published`, je Einheit einer Vorlage `estimated_minutes`
 *    (estimateSessionMinutes aus packages/core).
 * 3. Schutz vor Massen-Archivierung: Würde der Lauf mehr als 50 % der bisher in der Datenbank freigegebenen
 *    Übungen oder Vorlagen (je Inhaltsart) auf `archived` setzen, bricht er ab (Exit 1, nichts eingespielt) –
 *    außer der Workflow wurde per Hand mit `allow_mass_archive: true` gestartet.
 * 4. `seed_content(p_content)` per Supabase-Service-Key aufrufen (eine Transaktion, idempotent).
 * 5. Ernährung (Etappe N7 Teil 2, docs/PLAN-PHASE-5.md „Vorschlag N7 Teil 2“ Nr. 4): Paket aus freigegebenen UND
 *    fachlich geprüften Inhalten (`buildNutritionSeedPackage`, Gründer-Entscheidung 6/G-N7-3) – Inhalte, die noch auf
 *    die Fachprüfung warten oder auf so einen Inhalt verweisen, bleiben draußen und stehen im Bericht.
 *    TESTPHASE (Gründer-Entscheidung 19.10.2026): steht in `content/einspiel-regeln.json`
 *    `"nur_fachlich_geprueft": false`, kommen freigegebene Inhalte auch ohne Fachprüfung mit (Bericht nennt sie) und
 *    `seed_nutrition_content` wird mit `p_require_expert_review = false` aufgerufen. Fehlt die Datei: Livegang-Regel.
 *    Derselbe Schutz vor Massen-Archivierung je Inhaltsart, dann `seed_nutrition_content(p_content)` (eigene Transaktion). Gibt es die
 *    Tabellen noch nicht (vor `db-migrate`), wird die Ernährung mit Hinweis übersprungen.
 * 6. Supplemente (docs/PLAN-PHASE-6.md Abschnitte 6 und 7, Etappe SU3): freigegebene Supplement-Inhalte – mit derselben
 *    Einspiel-Regel wie die Ernährung (Testphase: auch ohne Fachprüfung, sonst nur fachlich geprüft), gleicher Schutz vor
 *    Massen-Archivierung, dann `seed_supplements(p_content)` (eigene Transaktion). Fehlt die Tabelle (vor `db-migrate`),
 *    mit Hinweis übersprungen.
 * 7. Workouts (docs/PLAN-WORKOUTS.md): freigegebene Workouts – mit derselben Einspiel-Regel wie die Ernährung
 *    (Testphase: auch ohne Fachprüfung, sonst nur fachlich geprüft), gleicher Schutz vor Massen-Archivierung, dann
 *    `seed_workouts(p_content)` (eigene Transaktion). Fehlt die Tabelle (vor `db-migrate`), mit Hinweis übersprungen.
 * Ohne SUPABASE_URL/SUPABASE_SECRET_KEY endet es nach der Prüfung grün mit Hinweis.
 */
import {
  type ContentSeedSettings,
  type ContentValidationResult,
  estimateSessionMinutes,
  type Exercise,
  type Food,
  type Guide,
  guideExpertReviewHits,
  type IngredientSubstitution,
  isCatalogReviewed,
  type MealPrepPlan,
  type PackageSize,
  type PlanTemplate,
  type Recipe,
  STRICT_CONTENT_SEED_SETTINGS,
  type SupplementContent,
  type Workout,
} from '@fitnessapp/core';

import {
  blockingCount,
  formatMarkdownSummary,
  type ReportInput,
  seedSettingsText,
  validateRepository,
} from '../validate';

export interface SeedPackage {
  readonly exercises: Exercise[];
  readonly plan_templates: (Omit<PlanTemplate, 'sessions'> & {
    sessions: (PlanTemplate['sessions'][number] & { estimated_minutes: number })[];
  })[];
}

/** Nur freigegebene Inhalte; Vorlagen mit geschätzter Dauer je Einheit. */
export function buildSeedPackage(result: ContentValidationResult): SeedPackage {
  return {
    exercises: result.exercises.filter((exercise) => exercise.status === 'published'),
    plan_templates: result.templates
      .filter((template) => template.status === 'published')
      .map((template) => ({
        ...template,
        sessions: template.sessions.map((session) => ({
          ...session,
          estimated_minutes: estimateSessionMinutes(session),
        })),
      })),
  };
}

/** Paket für `seed_nutrition_content` – Schlüssel = Inhaltsarten der Funktion, Inhalte = Dateien unverändert. */
export interface NutritionSeedPackage {
  readonly foods: Food[];
  readonly recipes: Recipe[];
  readonly ingredient_substitutions: IngredientSubstitution[];
  readonly package_sizes: PackageSize[];
  readonly meal_prep_plans: MealPrepPlan[];
  readonly guides: Guide[];
}

export type NutritionSeedKind = keyof NutritionSeedPackage;

/** Warum ein freigegebener Inhalt (noch) nicht eingespielt wird – ohne Inhalte, nur Art und ID. */
export type NutritionWaitReason =
  | 'not_expert_reviewed'
  | 'not_catalog_reviewed'
  | 'not_reviewed'
  | 'reference_waiting'
  /** Ratgeber mit Dosierungs-Befund (R21H) ohne „fachlich geprüft“ – wartet AUCH in der Testphase (Wächter H1). */
  | 'dosage_needs_expert';

export interface NutritionWaiting {
  readonly kind: NutritionSeedKind;
  readonly id: string;
  readonly reason: NutritionWaitReason;
}

/** Freigegebener Inhalt, der in der Testphase OHNE Fachprüfung eingespielt wird (nur Art und ID). */
export interface NutritionUnreviewed {
  readonly kind: NutritionSeedKind;
  readonly id: string;
}

/**
 * Ernährungs-Paket (Etappe N7 Teil 2): nur `published` UND fachlich geprüft (`meta.expert_reviewed`, Gründer-
 * Entscheidung 6) – Lebensmittel zusätzlich mit Katalog-Prüfung (R19), Packungsgrößen mit Prüfvermerk.
 * Testphase (`requireExpertReview: false`, Gründer-Entscheidung 19.10.2026): die Fachprüfung entfällt als Bedingung,
 * alles andere bleibt gleich; solche Inhalte stehen in `unreviewed`. Ausnahme: Ratgeber mit Dosierungs-Befund (R21H,
 * `guideExpertReviewHits`) brauchen auch in der Testphase „fachlich geprüft“ (Grund `dosage_needs_expert`, Wächter-
 * Auflage H1 – in `content:validate` ist R21H nur gelb). Dieselben Regeln
 * wie `seed_nutrition_content` auf dem Server (der lehnt sonst das GANZE Paket ab). Verweise bleiben im Paket: Rezepte,
 * Austausch und Packungsgrößen nur mit eingespielten Lebensmitteln, Lebensmittel nur, wenn auch ihre Ersatzprodukte
 * eingespielt werden (sonst wäre das Lebensmittel in der App rot, R2), Meal-Prep-Pläne nur mit eingespielten Rezepten.
 * Alles andere steht in `waiting` (sichere Richtung: lieber weglassen als ungeprüft ausliefern).
 */
export function buildNutritionSeedPackage(
  result: ContentValidationResult,
  options: { readonly requireExpertReview: boolean } = { requireExpertReview: true },
): {
  package: NutritionSeedPackage;
  waiting: NutritionWaiting[];
  unreviewed: NutritionUnreviewed[];
} {
  const waiting: NutritionWaiting[] = [];
  /** Fachprüfung fehlt: in der Testphase egal, sonst wartet der Inhalt. */
  const lacksExpertReview = (item: { meta: { expert_reviewed: boolean } }) =>
    options.requireExpertReview && !item.meta.expert_reviewed;
  const wait = (kind: NutritionSeedKind, id: string, reason: NutritionWaitReason) =>
    waiting.push({ kind, id, reason });
  const published = <T extends { status: string }>(items: readonly T[]) =>
    items.filter((item) => item.status === 'published');

  let foods = published(result.foods).filter((food) => {
    if (lacksExpertReview(food)) wait('foods', food.id, 'not_expert_reviewed');
    else if (!isCatalogReviewed(food)) wait('foods', food.id, 'not_catalog_reviewed');
    else return true;
    return false;
  });
  // Ersatzprodukte müssen mitkommen (sonst R2 in der App) – bis nichts mehr wegfällt.
  for (;;) {
    const ids = new Set(foods.map((food) => food.id));
    const kept = foods.filter((food) => food.substitutes.every((x) => ids.has(x.food_id)));
    if (kept.length === foods.length) break;
    for (const food of foods.filter((f) => !kept.includes(f))) {
      wait('foods', food.id, 'reference_waiting');
    }
    foods = kept;
  }
  const foodIds = new Set(foods.map((food) => food.id));
  const reviewed = <T extends { id: string; meta: { expert_reviewed: boolean } }>(
    kind: NutritionSeedKind,
    items: readonly T[],
    references: (item: T) => boolean,
  ) =>
    items.filter((item) => {
      if (lacksExpertReview(item)) wait(kind, item.id, 'not_expert_reviewed');
      else if (!references(item)) wait(kind, item.id, 'reference_waiting');
      else return true;
      return false;
    });
  const recipes = reviewed('recipes', published(result.recipes), (recipe) =>
    recipe.ingredients.every((ingredient) => foodIds.has(ingredient.food_id)),
  );
  const recipeIds = new Set(recipes.map((recipe) => recipe.id));
  const substitutions = reviewed(
    'ingredient_substitutions',
    published(result.substitutions),
    (x) => foodIds.has(x.food_id) && foodIds.has(x.substitute_food_id),
  );
  const packageSizes = published(result.packageSizes).filter((entry) => {
    if (entry.meta.reviewed_by === null) wait('package_sizes', entry.id, 'not_reviewed');
    else if (!foodIds.has(entry.food_id)) wait('package_sizes', entry.id, 'reference_waiting');
    else return true;
    return false;
  });
  const mealPrepPlans = reviewed(
    'meal_prep_plans',
    published(result.mealPrepPlans),
    (plan) => plan.recipe_ids.length > 0 && plan.recipe_ids.every((id) => recipeIds.has(id)),
  );
  const guides = reviewed('guides', published(result.guides), () => true).filter((guide) => {
    if (guide.meta.expert_reviewed || guideExpertReviewHits(result.issues, guide.id).length === 0) {
      return true;
    }
    wait('guides', guide.id, 'dosage_needs_expert');
    return false;
  });
  const pkg: NutritionSeedPackage = {
    foods,
    recipes,
    ingredient_substitutions: substitutions,
    package_sizes: packageSizes,
    meal_prep_plans: mealPrepPlans,
    guides,
  };
  // Packungsgrößen haben keine eigene Fachprüfung (nur den Prüfvermerk) – sie zählen hier nicht.
  const unreviewed = (Object.keys(NUTRITION_SEED_TABLES) as NutritionSeedKind[])
    .filter((kind) => kind !== 'package_sizes')
    .flatMap((kind) =>
      (pkg[kind] as readonly { id: string; meta: { expert_reviewed: boolean } }[])
        .filter((item) => !item.meta.expert_reviewed)
        .map((item) => ({ kind, id: item.id })),
    );
  return {
    package: pkg,
    waiting: waiting.sort(byKindAndId),
    unreviewed: unreviewed.sort(byKindAndId),
  };
}

/** Paket für `seed_workouts` (docs/PLAN-WORKOUTS.md) – Inhalte = Dateien unverändert. */
export interface WorkoutSeedPackage {
  readonly workouts: Workout[];
}

/**
 * Workout-Paket: nur `published`; ohne „fachlich geprüft“ nur in der Testphase (`requireExpertReview: false`) – sonst
 * stehen sie in `waiting`. `unreviewed` = in der Testphase ohne Fachprüfung eingespielt (Bericht).
 */
export function buildWorkoutSeedPackage(
  result: Pick<ContentValidationResult, 'workouts'>,
  options: { readonly requireExpertReview: boolean } = { requireExpertReview: true },
): { package: WorkoutSeedPackage; waiting: string[]; unreviewed: string[] } {
  const published = result.workouts.filter((workout) => workout.status === 'published');
  const ok = (workout: Workout) => !options.requireExpertReview || workout.meta.expert_reviewed;
  return {
    package: { workouts: published.filter(ok) },
    waiting: published
      .filter((w) => !ok(w))
      .map((w) => w.id)
      .sort(),
    unreviewed: published
      .filter((w) => ok(w) && !w.meta.expert_reviewed)
      .map((w) => w.id)
      .sort(),
  };
}

/** Paket für `seed_supplements` (docs/PLAN-PHASE-6.md 7.2) – Inhalte = Dateien unverändert. */
export interface SupplementSeedPackage {
  readonly supplements: SupplementContent[];
}

/**
 * Supplement-Paket: nur `published`; ohne „fachlich geprüft“ nur in der Testphase (`requireExpertReview: false`) –
 * sonst stehen sie in `waiting`. `unreviewed` = in der Testphase ohne Fachprüfung eingespielt (Bericht). Gleiche Regel
 * wie `seed_supplements` auf dem Server (der lehnt sonst das GANZE Paket ab).
 */
export function buildSupplementSeedPackage(
  result: Pick<ContentValidationResult, 'supplements'>,
  options: { readonly requireExpertReview: boolean } = { requireExpertReview: true },
): { package: SupplementSeedPackage; waiting: string[]; unreviewed: string[] } {
  const published = result.supplements.filter((entry) => entry.status === 'published');
  const ok = (entry: SupplementContent) =>
    !options.requireExpertReview || entry.meta.expert_reviewed;
  return {
    package: { supplements: published.filter(ok) },
    waiting: published
      .filter((entry) => !ok(entry))
      .map((entry) => entry.id)
      .sort(),
    unreviewed: published
      .filter((entry) => ok(entry) && !entry.meta.expert_reviewed)
      .map((entry) => entry.id)
      .sort(),
  };
}

/** Wie `findMassArchive`, für die Supplemente (gleiche 50-%-Grenze). */
export function findSupplementMassArchive(
  current: readonly string[],
  pkg: SupplementSeedPackage,
): MassArchiveFinding[] {
  const next = new Set(pkg.supplements.map((entry) => entry.id));
  const published = [...new Set(current)];
  const wouldArchive = published.filter((id) => !next.has(id)).sort();
  return published.length > 0 && wouldArchive.length / published.length > MASS_ARCHIVE_MAX_SHARE
    ? [{ table: 'supplements', published: published.length, wouldArchive }]
    : [];
}

/** Bericht zu den Supplementen (nur Anzahl und höchstens 20 IDs). */
function supplementMarkdown(
  settings: ContentSeedSettings,
  supplements: { waiting: readonly string[]; unreviewed: readonly string[] },
): string[] {
  const ids = (list: readonly string[]) =>
    `${list
      .slice(0, 20)
      .map((id) => `\`${id}\``)
      .join(', ')}${list.length > 20 ? ` … (+${list.length - 20})` : ''}`;
  return [
    ...(!settings.nur_fachlich_geprueft && supplements.unreviewed.length > 0
      ? [
          '',
          `**🧪 Testphase:** ${supplements.unreviewed.length} Supplemente ohne Fachprüfung – in der App gekennzeichnet „Testphase – noch nicht fachlich geprüft“: ${ids(supplements.unreviewed)}`,
        ]
      : []),
    ...(supplements.waiting.length > 0
      ? [
          '',
          `**Supplemente: ${supplements.waiting.length} freigegebene warten auf die Fachprüfung** (nicht eingespielt): ${ids(supplements.waiting)}`,
        ]
      : []),
  ];
}

/** Wie `findMassArchive`, für die Workouts (gleiche 50-%-Grenze). */
export function findWorkoutMassArchive(
  current: readonly string[],
  pkg: WorkoutSeedPackage,
): MassArchiveFinding[] {
  const next = new Set(pkg.workouts.map((workout) => workout.id));
  const published = [...new Set(current)];
  const wouldArchive = published.filter((id) => !next.has(id)).sort();
  return published.length > 0 && wouldArchive.length / published.length > MASS_ARCHIVE_MAX_SHARE
    ? [{ table: 'workouts', published: published.length, wouldArchive }]
    : [];
}

/** Bericht zu den Workouts (nur Anzahl und höchstens 20 IDs). */
function workoutMarkdown(
  settings: ContentSeedSettings,
  workouts: { waiting: readonly string[]; unreviewed: readonly string[] },
): string[] {
  const ids = (list: readonly string[]) =>
    `${list
      .slice(0, 20)
      .map((id) => `\`${id}\``)
      .join(', ')}${list.length > 20 ? ` … (+${list.length - 20})` : ''}`;
  return [
    ...(!settings.nur_fachlich_geprueft && workouts.unreviewed.length > 0
      ? [
          '',
          `**🧪 Testphase:** ${workouts.unreviewed.length} Workouts ohne Fachprüfung – in der App gekennzeichnet „Testphase – noch nicht fachlich geprüft“: ${ids(workouts.unreviewed)}`,
        ]
      : []),
    ...(workouts.waiting.length > 0
      ? [
          '',
          `**Workouts: ${workouts.waiting.length} freigegebene warten auf die Fachprüfung** (nicht eingespielt): ${ids(workouts.waiting)}`,
        ]
      : []),
  ];
}

function byKindAndId(a: { kind: string; id: string }, b: { kind: string; id: string }): number {
  return a.kind === b.kind ? (a.id < b.id ? -1 : 1) : a.kind < b.kind ? -1 : 1;
}

export interface SeedEnv {
  readonly url?: string;
  readonly secretKey?: string;
  /**
   * true = Massen-Archivierung ausdrücklich erlaubt (Workflow-Eingabe `allow_mass_archive`, nur bei
   * „Run workflow“ per Hand). Standard false.
   */
  readonly allowMassArchive?: boolean;
}

/**
 * Höchstanteil des freigegebenen DB-Bestands (je Inhaltsart), den ein Lauf ohne ausdrückliche Erlaubnis
 * archivieren darf (Wächter-Hinweis Etappe B). Schützt z. B. vor einem versehentlich geleerten `content/`.
 */
export const MASS_ARCHIVE_MAX_SHARE = 0.5;

/** IDs, die in der Datenbank derzeit `published` sind. */
export interface PublishedIds {
  readonly exercises: readonly string[];
  readonly plan_templates: readonly string[];
}

/** Freigegebene Ernährungs-Inhalte in der Datenbank (Etappe N7 Teil 2); Schlüssel = Inhaltsart des Pakets. */
export type PublishedNutritionIds = Record<NutritionSeedKind, readonly string[]>;

/** Tabelle je Inhaltsart (Packungsgrößen heißen in der Datenbank `food_package_sizes`). */
export const NUTRITION_SEED_TABLES: Record<NutritionSeedKind, string> = {
  foods: 'foods',
  recipes: 'recipes',
  ingredient_substitutions: 'ingredient_substitutions',
  package_sizes: 'food_package_sizes',
  meal_prep_plans: 'meal_prep_plans',
  guides: 'guides',
};

export interface MassArchiveFinding {
  readonly table: keyof PublishedIds | NutritionSeedKind | 'workouts' | 'supplements';
  readonly published: number;
  readonly wouldArchive: readonly string[];
}

/** Wie `findMassArchive`, für das Ernährungs-Paket (je Inhaltsart, gleiche 50-%-Grenze). */
export function findNutritionMassArchive(
  current: PublishedNutritionIds,
  pkg: NutritionSeedPackage,
): MassArchiveFinding[] {
  const findings: MassArchiveFinding[] = [];
  for (const table of Object.keys(NUTRITION_SEED_TABLES) as NutritionSeedKind[]) {
    const next = new Set(pkg[table].map((item) => item.id));
    const published = [...new Set(current[table])];
    const wouldArchive = published.filter((id) => !next.has(id)).sort();
    if (published.length > 0 && wouldArchive.length / published.length > MASS_ARCHIVE_MAX_SHARE) {
      findings.push({ table, published: published.length, wouldArchive });
    }
  }
  return findings;
}

/**
 * Welche bisher freigegebenen Inhalte würde der Lauf archivieren (seed_content setzt alles auf `archived`,
 * was freigegeben ist, aber nicht mehr im Paket steht)? Liefert nur Inhaltsarten über der 50-%-Grenze.
 */
export function findMassArchive(current: PublishedIds, pkg: SeedPackage): MassArchiveFinding[] {
  const next: Record<keyof PublishedIds, Set<string>> = {
    exercises: new Set(pkg.exercises.map((exercise) => exercise.id)),
    plan_templates: new Set(pkg.plan_templates.map((template) => template.id)),
  };
  const findings: MassArchiveFinding[] = [];
  for (const table of ['exercises', 'plan_templates'] as const) {
    const published = [...new Set(current[table])];
    const wouldArchive = published.filter((id) => !next[table].has(id)).sort();
    if (published.length > 0 && wouldArchive.length / published.length > MASS_ARCHIVE_MAX_SHARE) {
      findings.push({ table, published: published.length, wouldArchive });
    }
  }
  return findings;
}

export type SeedFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface SeedResult {
  readonly exitCode: number;
  readonly status: 'blocked' | 'skipped' | 'seeded' | 'failed' | 'mass_archive_blocked';
  readonly markdown: string;
  readonly package?: SeedPackage;
  /** Ernährungs-Paket und wartende Inhalte (Etappe N7 Teil 2); `unreviewed` nur in der Testphase gefüllt. */
  readonly nutrition?: {
    package: NutritionSeedPackage;
    waiting: NutritionWaiting[];
    unreviewed: NutritionUnreviewed[];
  };
  /** Einspiel-Regel dieses Laufs (`content/einspiel-regeln.json`). */
  readonly seedSettings?: ContentSeedSettings;
  /** Workout-Paket (docs/PLAN-WORKOUTS.md) mit wartenden bzw. ungeprüft eingespielten IDs. */
  readonly workouts?: { package: WorkoutSeedPackage; waiting: string[]; unreviewed: string[] };
  /** Supplement-Paket (docs/PLAN-PHASE-6.md 7.2) mit wartenden bzw. ungeprüft eingespielten IDs. */
  readonly supplements?: {
    package: SupplementSeedPackage;
    waiting: string[];
    unreviewed: string[];
  };
}

function nutritionCountText(pkg: NutritionSeedPackage): string {
  return (Object.keys(NUTRITION_SEED_TABLES) as NutritionSeedKind[])
    .map((kind) => `${pkg[kind].length} ${TABLE_DE[kind]}`)
    .join(', ');
}

/** Legacy-Schlüssel (`service_role`) sind JWTs; neue Secret Keys (`sb_secret_…`) nur im `apikey`-Header. */
function authHeaders(secretKey: string): Record<string, string> {
  return secretKey.startsWith('eyJ')
    ? { apikey: secretKey, Authorization: `Bearer ${secretKey}` }
    : { apikey: secretKey };
}

interface SupabaseAccess {
  readonly url: string;
  readonly secretKey: string;
}

/** Basis-Adresse; nur https (außer lokal). */
function supabaseBase(url: string): URL {
  const base = new URL(url);
  if (
    base.protocol !== 'https:' &&
    base.hostname !== 'localhost' &&
    base.hostname !== '127.0.0.1'
  ) {
    throw new Error('SUPABASE_URL muss mit https:// beginnen.');
  }
  return base;
}

/**
 * Seitengröße beim Lesen des Bestands (Wächter N7 Teil 2 N2): PostgREST liefert auf Supabase höchstens 1.000 Zeilen je
 * Anfrage (`max-rows`). Gelesen wird deshalb seitenweise (`order=id`, `limit`/`offset`), bis eine Seite kürzer ist –
 * sonst schätzte der Schutz vor Massen-Archivierung ab 1.000 freigegebenen Einträgen nur aus einer Stichprobe.
 */
export const SEED_ID_PAGE_SIZE = 1000;
/** Obergrenze der Seiten (Schutz vor einer Endlosschleife bei einer fehlerhaften Antwort): 1.000 × 1.000 IDs. */
const SEED_ID_MAX_PAGES = 1000;

/**
 * Alle freigegebenen IDs einer Tabelle, seitenweise; null = Tabelle fehlt (nur mit `allowMissing`). Die Gesamtzahl
 * kommt aus `Content-Range` (`Prefer: count=exact`) – so wird auch weitergelesen, wenn der Server je Seite weniger
 * als `SEED_ID_PAGE_SIZE` liefert; ohne Angabe endet das Lesen mit der ersten kürzeren Seite.
 */
async function readPublishedIds(
  env: SupabaseAccess,
  fetchImpl: SeedFetch,
  table: string,
  allowMissing: boolean,
): Promise<string[] | null> {
  const base = supabaseBase(env.url);
  const ids: string[] = [];
  for (let page = 0; page < SEED_ID_MAX_PAGES; page += 1) {
    const endpoint = new URL(`/rest/v1/${table}`, base);
    endpoint.searchParams.set('select', 'id');
    endpoint.searchParams.set('status', 'eq.published');
    endpoint.searchParams.set('order', 'id.asc');
    endpoint.searchParams.set('limit', String(SEED_ID_PAGE_SIZE));
    endpoint.searchParams.set('offset', String(ids.length));
    const response = await fetchImpl(endpoint.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Prefer: 'count=exact',
        ...authHeaders(env.secretKey),
      },
    });
    const text = await response.text();
    if (allowMissing && (response.status === 404 || text.includes('PGRST205'))) return null;
    if (!response.ok) {
      throw new Error(
        `Bestand ${table} nicht lesbar: HTTP ${response.status} – ${text.slice(0, 300)}`,
      );
    }
    const rows = JSON.parse(text) as unknown;
    if (
      !Array.isArray(rows) ||
      !rows.every((row) => typeof (row as { id?: unknown })?.id === 'string')
    ) {
      throw new Error(`Bestand ${table}: unerwartete Antwort.`);
    }
    ids.push(...rows.map((row) => (row as { id: string }).id));
    const total = /\/(\d+)$/.exec(response.headers?.get('content-range') ?? '')?.[1];
    const done =
      rows.length === 0 ||
      (total !== undefined ? ids.length >= Number(total) : rows.length < SEED_ID_PAGE_SIZE);
    if (done) return ids;
  }
  throw new Error(`Bestand ${table}: zu viele Seiten.`);
}

/** Liest die IDs aller derzeit freigegebenen Übungen und Vorlagen (Service-Key, nur IDs, seitenweise). */
export async function fetchPublishedIds(
  env: SupabaseAccess,
  fetchImpl: SeedFetch,
): Promise<PublishedIds> {
  const read = async (table: keyof PublishedIds): Promise<string[]> =>
    (await readPublishedIds(env, fetchImpl, table, false)) ?? [];
  return { exercises: await read('exercises'), plan_templates: await read('plan_templates') };
}

/**
 * Freigegebene Ernährungs-Inhalte (nur IDs, seitenweise). null = Tabellen gibt es noch nicht (PostgREST 404/PGRST205,
 * vor `db-migrate`) – dann wird die Ernährung übersprungen.
 */
export async function fetchPublishedNutritionIds(
  env: SupabaseAccess,
  fetchImpl: SeedFetch,
): Promise<PublishedNutritionIds | null> {
  const out: Partial<Record<NutritionSeedKind, string[]>> = {};
  for (const kind of Object.keys(NUTRITION_SEED_TABLES) as NutritionSeedKind[]) {
    const ids = await readPublishedIds(env, fetchImpl, NUTRITION_SEED_TABLES[kind], true);
    if (ids === null) return null;
    out[kind] = ids;
  }
  return out as PublishedNutritionIds;
}

const TABLE_DE: Record<
  keyof PublishedIds | NutritionSeedKind | 'workouts' | 'supplements',
  string
> = {
  exercises: 'Übungen',
  plan_templates: 'Plan-Vorlagen',
  foods: 'Lebensmittel',
  recipes: 'Rezepte',
  ingredient_substitutions: 'Austausch-Einträge',
  package_sizes: 'Packungsgrößen',
  meal_prep_plans: 'Meal-Prep-Pläne',
  guides: 'Ratgeber',
  workouts: 'Workouts',
  supplements: 'Supplemente',
};

const WAIT_REASON_DE: Record<NutritionWaitReason, string> = {
  not_expert_reviewed: 'wartet auf die Fachprüfung',
  not_catalog_reviewed: 'wartet auf die Katalog-Prüfung',
  not_reviewed: 'ohne Prüfvermerk',
  reference_waiting: 'verweist auf einen Inhalt, der noch wartet',
  dosage_needs_expert: 'Dosierungs-Befund (R21H) – braucht auch in der Testphase die Fachprüfung',
};

/** Bericht der wartenden Inhalte (nur Art, Anzahl und höchstens 20 IDs je Grund). */
function waitingMarkdown(waiting: readonly NutritionWaiting[]): string[] {
  if (waiting.length === 0) return [];
  const groups = new Map<string, string[]>();
  for (const w of waiting) {
    const key = `${TABLE_DE[w.kind]} – ${WAIT_REASON_DE[w.reason]}`;
    groups.set(key, [...(groups.get(key) ?? []), w.id]);
  }
  return [
    '',
    `**Ernährung: ${waiting.length} freigegebene Inhalte nicht eingespielt** (mit Grund):`,
    ...[...groups.entries()].map(([key, ids]) => {
      const shown = ids.slice(0, 20).map((id) => `\`${id}\``);
      const more = ids.length > 20 ? ` … (+${ids.length - 20})` : '';
      return `- ${key}: ${ids.length} – ${shown.join(', ')}${more}`;
    }),
  ];
}

/** Testphase: welche freigegebenen Inhalte OHNE Fachprüfung eingespielt werden (Art, Anzahl, höchstens 20 IDs). */
function unreviewedMarkdown(
  settings: ContentSeedSettings,
  unreviewed: readonly NutritionUnreviewed[],
): string[] {
  if (settings.nur_fachlich_geprueft) return [];
  const groups = new Map<NutritionSeedKind, string[]>();
  for (const u of unreviewed) groups.set(u.kind, [...(groups.get(u.kind) ?? []), u.id]);
  return [
    '',
    `**🧪 Testphase:** ${unreviewed.length} freigegebene Ernährungs-Inhalte ohne Fachprüfung – in der App gekennzeichnet`,
    '„Testphase – noch nicht fachlich geprüft“. Vor dem Livegang in `content/einspiel-regeln.json`',
    '`"nur_fachlich_geprueft": true` setzen (docs/HANDY-ANLEITUNG.md, Teil 7t).',
    ...[...groups.entries()].map(([kind, ids]) => {
      const shown = ids.slice(0, 20).map((id) => `\`${id}\``);
      const more = ids.length > 20 ? ` … (+${ids.length - 20})` : '';
      return `- ${TABLE_DE[kind]}: ${ids.length} – ${shown.join(', ')}${more}`;
    }),
  ];
}

function massArchiveMarkdown(findings: readonly MassArchiveFinding[]): string {
  return [
    '### ⚠️ content-seed abgebrochen – zu viele Inhalte würden zurückgezogen, nichts eingespielt',
    '',
    `Dieser Lauf würde mehr als ${MASS_ARCHIVE_MAX_SHARE * 100} % der bisher freigegebenen Inhalte auf „archived“ setzen:`,
    '',
    ...findings.map((finding) => {
      const ids = finding.wouldArchive.slice(0, 50).map((id) => `\`${id}\``);
      const more =
        finding.wouldArchive.length > 50 ? ` … (+${finding.wouldArchive.length - 50})` : '';
      return `- **${TABLE_DE[finding.table]}:** ${finding.wouldArchive.length} von ${finding.published} – ${ids.join(', ')}${more}`;
    }),
    '',
    'Das passiert z. B., wenn Inhaltsdateien versehentlich gelöscht oder auf „draft“ gesetzt wurden. Bitte prüfen.',
    'Erwartet ist es direkt nach dem Umstellen von der Testphase auf „nur fachlich geprüft“ (content/einspiel-regeln.json):',
    'dann werden die noch nicht fachlich geprüften Ernährungs-Inhalte zurückgezogen.',
    'Ist das wirklich gewollt: GitHub-App → **Actions → content-seed → Run workflow** → Häkchen',
    '**allow_mass_archive** setzen → **Run workflow**.',
    '',
  ].join('\n');
}

/** Ruft `public.seed_content` über die REST-Schnittstelle (PostgREST) auf. */
export async function callSeedContent(
  env: SupabaseAccess,
  pkg: SeedPackage,
  fetchImpl: SeedFetch,
): Promise<unknown> {
  return callSeedFunction(env, 'seed_content', pkg, fetchImpl);
}

/**
 * Ruft `public.seed_nutrition_content` auf (Etappe N7 Teil 2; eigene Transaktion, idempotent). Nur in der Testphase
 * geht `p_require_expert_review: false` mit; sonst gilt der Standard der Datenbank-Funktion (true = nur fachlich
 * geprüft) – so funktioniert die Livegang-Regel auch mit einer Datenbank ohne den neuen Parameter.
 */
export async function callSeedNutritionContent(
  env: SupabaseAccess,
  pkg: NutritionSeedPackage,
  fetchImpl: SeedFetch,
  settings: ContentSeedSettings = STRICT_CONTENT_SEED_SETTINGS,
): Promise<unknown> {
  return callSeedFunction(
    env,
    'seed_nutrition_content',
    pkg,
    fetchImpl,
    settings.nur_fachlich_geprueft ? {} : { p_require_expert_review: false },
  );
}

/**
 * Ruft `public.seed_workouts` auf (eigene Transaktion, idempotent); Testphase wie die Ernährung mit
 * `p_require_expert_review: false`.
 */
export async function callSeedWorkouts(
  env: SupabaseAccess,
  pkg: WorkoutSeedPackage,
  fetchImpl: SeedFetch,
  settings: ContentSeedSettings = STRICT_CONTENT_SEED_SETTINGS,
): Promise<unknown> {
  return callSeedFunction(
    env,
    'seed_workouts',
    pkg,
    fetchImpl,
    settings.nur_fachlich_geprueft ? {} : { p_require_expert_review: false },
  );
}

/**
 * Ruft `public.seed_supplements` auf (eigene Transaktion, idempotent); Testphase wie Workouts und Ernährung mit
 * `p_require_expert_review: false`.
 */
export async function callSeedSupplements(
  env: SupabaseAccess,
  pkg: SupplementSeedPackage,
  fetchImpl: SeedFetch,
  settings: ContentSeedSettings = STRICT_CONTENT_SEED_SETTINGS,
): Promise<unknown> {
  return callSeedFunction(
    env,
    'seed_supplements',
    pkg,
    fetchImpl,
    settings.nur_fachlich_geprueft ? {} : { p_require_expert_review: false },
  );
}

async function callSeedFunction(
  env: SupabaseAccess,
  name: 'seed_content' | 'seed_nutrition_content' | 'seed_workouts' | 'seed_supplements',
  pkg: SeedPackage | NutritionSeedPackage | WorkoutSeedPackage | SupplementSeedPackage,
  fetchImpl: SeedFetch,
  extraArgs: Record<string, unknown> = {},
): Promise<unknown> {
  const base = supabaseBase(env.url);
  const endpoint = new URL(`/rest/v1/rpc/${name}`, base);
  const response = await fetchImpl(endpoint.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(env.secretKey) },
    body: JSON.stringify({ p_content: pkg, ...extraArgs }),
  });
  const text = await response.text();
  if (!response.ok) {
    // Fehlermeldungen von seed_content enthalten nur Inhalts-IDs (keine Nutzerdaten).
    let message = text.slice(0, 1000);
    try {
      const parsed = JSON.parse(text) as { message?: string };
      message = parsed.message ?? message;
    } catch {
      // Text bleibt wie geliefert.
    }
    throw new Error(`${name}: HTTP ${response.status} – ${message}`);
  }
  return text === '' ? null : (JSON.parse(text) as unknown);
}

export async function runSeed(options: {
  repoRoot: string;
  env: SeedEnv;
  fetchImpl?: SeedFetch;
}): Promise<SeedResult> {
  const report: ReportInput = validateRepository({ cwd: options.repoRoot });
  const blocking = blockingCount(report);
  if (blocking > 0) {
    return {
      exitCode: 1,
      status: 'blocked',
      markdown: [
        `### ❌ content-seed: ${blocking} blockierende Fehler – nichts eingespielt`,
        '',
        formatMarkdownSummary(report),
      ].join('\n'),
    };
  }
  const pkg = buildSeedPackage(report.result);
  const seedSettings = report.seedSettings ?? STRICT_CONTENT_SEED_SETTINGS;
  const nutrition = buildNutritionSeedPackage(report.result, {
    requireExpertReview: seedSettings.nur_fachlich_geprueft,
  });
  const workouts = buildWorkoutSeedPackage(report.result, {
    requireExpertReview: seedSettings.nur_fachlich_geprueft,
  });
  const supplements = buildSupplementSeedPackage(report.result, {
    requireExpertReview: seedSettings.nur_fachlich_geprueft,
  });
  const ruleLine = `Einspiel-Regel: ${seedSettingsText(seedSettings)}.`;
  const counts = `${pkg.exercises.length} Übungen, ${pkg.plan_templates.length} Plan-Vorlagen (nur „published“)`;
  const nutritionCounts = nutritionCountText(nutrition.package);
  const url = options.env.url?.trim();
  const secretKey = options.env.secretKey?.trim();
  if (!url || !secretKey) {
    return {
      exitCode: 0,
      status: 'skipped',
      package: pkg,
      nutrition,
      workouts,
      supplements,
      seedSettings,
      markdown: [
        '### ⏭️ content-seed übersprungen – Supabase fehlt',
        '',
        `Inhalte geprüft ✅ · Einspiel-Paket: ${counts}; Ernährung: ${nutritionCounts}; ${workouts.package.workouts.length} Workouts; ${supplements.package.supplements.length} Supplemente.`,
        ruleLine,
        'Es fehlen die GitHub-Secrets SUPABASE_URL und/oder SUPABASE_SECRET_KEY (docs/SETUP.md Teile A und B).',
        ...unreviewedMarkdown(seedSettings, nutrition.unreviewed),
        ...waitingMarkdown(nutrition.waiting),
        ...workoutMarkdown(seedSettings, workouts),
        ...supplementMarkdown(seedSettings, supplements),
        '',
      ].join('\n'),
    };
  }
  const fetchImpl: SeedFetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  try {
    const access = { url, secretKey };
    const current = await fetchPublishedIds(access, fetchImpl);
    // Ernährung: Tabellen erst nach db-migrate (N7) – sonst übersprungen.
    const currentNutrition = await fetchPublishedNutritionIds(access, fetchImpl);
    // Workouts: Tabelle erst nach db-migrate (docs/PLAN-WORKOUTS.md) – sonst übersprungen.
    const currentWorkouts = await readPublishedIds(access, fetchImpl, 'workouts', true);
    // Supplemente: Tabelle erst nach db-migrate (docs/PLAN-PHASE-6.md 7.2) – sonst übersprungen.
    const currentSupplements = await readPublishedIds(access, fetchImpl, 'supplements', true);
    // Schutz vor Massen-Archivierung für ALLE Inhaltsarten, bevor irgendetwas eingespielt wird.
    const findings = [
      ...findMassArchive(current, pkg),
      ...(currentNutrition === null
        ? []
        : findNutritionMassArchive(currentNutrition, nutrition.package)),
      ...(currentWorkouts === null
        ? []
        : findWorkoutMassArchive(currentWorkouts, workouts.package)),
      ...(currentSupplements === null
        ? []
        : findSupplementMassArchive(currentSupplements, supplements.package)),
    ];
    if (findings.length > 0) {
      if (options.env.allowMassArchive !== true) {
        return {
          exitCode: 1,
          status: 'mass_archive_blocked',
          package: pkg,
          nutrition,
          workouts,
          supplements,
          seedSettings,
          markdown: massArchiveMarkdown(findings),
        };
      }
      console.warn(
        `content-seed: Massen-Archivierung ausdrücklich erlaubt (allow_mass_archive) – ${findings
          .map((f) => `${f.wouldArchive.length}/${f.published} ${TABLE_DE[f.table]}`)
          .join(', ')}.`,
      );
    }
    const response = await callSeedContent(access, pkg, fetchImpl);
    const r = (response ?? {}) as Record<string, unknown>;
    const lines = [
      '### ✅ content-seed: Inhalte eingespielt',
      '',
      `Eingespielt: ${String(r.exercises ?? pkg.exercises.length)} Übungen, ${String(r.plan_templates ?? pkg.plan_templates.length)} Plan-Vorlagen.`,
      `Zurückgezogen (archived): ${String(r.archived_exercises ?? 0)} Übungen, ${String(r.archived_plan_templates ?? 0)} Plan-Vorlagen.`,
      ruleLine,
    ];
    if (currentNutrition === null) {
      lines.push(
        '',
        'Ernährung übersprungen: Die Tabellen gibt es in der Datenbank noch nicht (erst nach `db-migrate`).',
      );
    } else {
      try {
        const nr =
          (await callSeedNutritionContent(access, nutrition.package, fetchImpl, seedSettings)) ??
          {};
        const archived = ((nr as Record<string, unknown>).archived ?? {}) as Record<
          string,
          unknown
        >;
        const archivedTotal = Object.values(archived).reduce<number>(
          (sum, n) => sum + (typeof n === 'number' ? n : 0),
          0,
        );
        lines.push(
          `Ernährung eingespielt: ${nutritionCounts}; zurückgezogen (archived): ${archivedTotal}.`,
        );
      } catch (error) {
        // Übungen sind schon eingespielt (eigene Transaktion) – Ernährung: nichts eingespielt.
        return {
          exitCode: 1,
          status: 'failed',
          package: pkg,
          nutrition,
          seedSettings,
          markdown: [
            ...lines,
            '',
            `### ❌ Ernährung nicht eingespielt (eine Transaktion, nichts geändert)`,
            '',
            (error as Error).message,
            '',
          ].join('\n'),
        };
      }
    }
    if (currentWorkouts === null) {
      lines.push(
        '',
        'Workouts übersprungen: Die Tabelle gibt es in der Datenbank noch nicht (erst nach `db-migrate`).',
      );
    } else {
      try {
        const wr = ((await callSeedWorkouts(access, workouts.package, fetchImpl, seedSettings)) ??
          {}) as Record<string, unknown>;
        lines.push(
          `Workouts eingespielt: ${String(wr.workouts ?? workouts.package.workouts.length)}; zurückgezogen (archived): ${String(wr.archived ?? 0)}.`,
        );
      } catch (error) {
        return {
          exitCode: 1,
          status: 'failed',
          package: pkg,
          nutrition,
          workouts,
          seedSettings,
          markdown: [
            ...lines,
            '',
            '### ❌ Workouts nicht eingespielt (eine Transaktion, nichts geändert)',
            '',
            (error as Error).message,
            '',
          ].join('\n'),
        };
      }
    }
    if (currentSupplements === null) {
      lines.push(
        '',
        'Supplemente übersprungen: Die Tabelle gibt es in der Datenbank noch nicht (erst nach `db-migrate`).',
      );
    } else {
      try {
        const sr = ((await callSeedSupplements(
          access,
          supplements.package,
          fetchImpl,
          seedSettings,
        )) ?? {}) as Record<string, unknown>;
        lines.push(
          `Supplemente eingespielt: ${String(sr.supplements ?? supplements.package.supplements.length)}; zurückgezogen (archived): ${String(sr.archived ?? 0)}.`,
        );
      } catch (error) {
        return {
          exitCode: 1,
          status: 'failed',
          package: pkg,
          nutrition,
          workouts,
          supplements,
          seedSettings,
          markdown: [
            ...lines,
            '',
            '### ❌ Supplemente nicht eingespielt (eine Transaktion, nichts geändert)',
            '',
            (error as Error).message,
            '',
          ].join('\n'),
        };
      }
    }
    return {
      exitCode: 0,
      status: 'seeded',
      package: pkg,
      nutrition,
      workouts,
      supplements,
      seedSettings,
      markdown: [
        ...lines,
        ...unreviewedMarkdown(seedSettings, nutrition.unreviewed),
        ...waitingMarkdown(nutrition.waiting),
        ...workoutMarkdown(seedSettings, workouts),
        ...supplementMarkdown(seedSettings, supplements),
        '',
      ].join('\n'),
    };
  } catch (error) {
    return {
      exitCode: 1,
      status: 'failed',
      package: pkg,
      nutrition,
      seedSettings,
      markdown: `### ❌ content-seed fehlgeschlagen – nichts eingespielt (eine Transaktion)\n\n${(error as Error).message}\n`,
    };
  }
}
