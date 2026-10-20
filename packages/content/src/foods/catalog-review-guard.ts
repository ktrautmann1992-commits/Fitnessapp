/**
 * CI-Sperre „`catalog_reviewed_*` nur über content-review“ (docs/PLAN-PHASE-5.md 5.1.1 d, R2-K6) – Teil von
 * `sources-integrity` (integrity.ts):
 *
 * - Branch `content-review/katalog-<Lauf-ID>` (Workflow content-review, Art „katalog“): Je geänderter
 *   Lebensmittel-Datei dürfen sich NUR `status` (→ published), `meta.reviewed_by/at` und `meta.catalog_reviewed_by/at`
 *   ändern; Nährwerte, Quelle, Gruppen und alles andere müssen gleich bleiben. Keine neuen oder gelöschten Dateien,
 *   keine anderen Dateien unter `content/foods/` (z. B. Erwartungsliste). Dazu prüft integrity.ts den Lauf
 *   (content-review.yml, per Hand auf main) und jeden Commit (verifiziert, github-actions[bot]).
 * - Branch `foods-import/<Lauf-ID>`: Der Import darf die Katalog-Prüfung nur zurücksetzen (null), nie setzen oder
 *   ändern.
 * - Jeder andere Branch darf `content/foods/**` ohnehin nicht ändern (integrity.ts).
 */
/** JSON mit sortierten Schlüsseln (Reihenfolge der Felder zählt nicht als Änderung). */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

/** Branch-Muster der Katalog-Prüfung (Workflow content-review, Art „katalog“). */
export const CATALOG_REVIEW_BRANCH = /^content-review\/katalog-(\d+)$/;

/** Pfad des Workflows, der diese Branches anlegt (Lauf-Prüfung). */
export const CONTENT_REVIEW_WORKFLOW_PATH = '.github/workflows/content-review.yml';

/** Eine Lebensmittel-Datei (nicht Erwartungsliste o. Ä.). */
const FOOD_FILE =
  /^content\/foods\/(?!allergen-expectations\.json$)[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;

/** Felder unter `meta`, die die Katalog-Prüfung setzen darf. */
export const CATALOG_REVIEW_META_FIELDS = [
  'reviewed_by',
  'reviewed_at',
  'catalog_reviewed_by',
  'catalog_reviewed_at',
] as const;

type Json = Record<string, unknown>;

function parse(buffer: Buffer): Json | string {
  try {
    const data: unknown = JSON.parse(buffer.toString('utf8'));
    return typeof data === 'object' && data !== null && !Array.isArray(data)
      ? (data as Json)
      : 'kein JSON-Objekt';
  } catch (error) {
    return `kein gültiges JSON (${(error as Error).message})`;
  }
}

function metaOf(data: Json): Json {
  const meta = data.meta;
  return typeof meta === 'object' && meta !== null && !Array.isArray(meta) ? (meta as Json) : {};
}

/** Stand ohne die Felder, die die Katalog-Prüfung ändern darf. */
function withoutReviewFields(data: Json): Json {
  const rest: Json = { ...data };
  delete rest.status;
  const meta = { ...metaOf(data) };
  for (const field of CATALOG_REVIEW_META_FIELDS) delete meta[field];
  return { ...rest, meta };
}

function changedKeys(a: Json, b: Json): string[] {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const differ = (x: unknown, y: unknown) => canonicalJson(x) !== canonicalJson(y);
  return keys.flatMap((key) => {
    if (key === 'meta') {
      const ma = metaOf(a);
      const mb = metaOf(b);
      return [...new Set([...Object.keys(ma), ...Object.keys(mb)])]
        .sort()
        .filter((field) => differ(ma[field], mb[field]))
        .map((field) => `meta.${field}`);
    }
    return differ(a[key], b[key]) ? [key] : [];
  });
}

const nonEmptyText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

/**
 * Fehler zu einer geänderten Datei auf einem Branch `content-review/katalog-<Lauf-ID>` (leer = in Ordnung).
 * `base` = Stand auf main, `head` = Stand im Pull Request (undefined = Datei fehlt dort).
 */
export function catalogReviewChangeErrors(
  path: string,
  base: Buffer | undefined,
  head: Buffer | undefined,
): string[] {
  const err = (message: string) => [`${path}: ${message}`];
  if (!FOOD_FILE.test(path)) {
    return err(
      'Katalog-Prüfung darf unter content/foods/ nur Lebensmittel-Dateien ändern (nicht Erwartungsliste o. Ä.).',
    );
  }
  if (base === undefined)
    return err('neue Datei – die Katalog-Prüfung legt keine Lebensmittel an.');
  if (head === undefined) return err('gelöscht – die Katalog-Prüfung löscht keine Lebensmittel.');
  const before = parse(base);
  const after = parse(head);
  if (typeof before === 'string') return err(`Stand auf main: ${before}`);
  if (typeof after === 'string') return err(after);
  const errors: string[] = [];
  const other = changedKeys(withoutReviewFields(before), withoutReviewFields(after));
  if (other.length > 0) {
    errors.push(
      `${path}: Katalog-Prüfung darf nur Status, Prüfvermerk und catalog_reviewed_* ändern – geändert: ${other.join(', ')}.`,
    );
  }
  if (after.status !== 'published' || before.status === 'archived') {
    errors.push(
      `${path}: Status „${String(before.status)}“ → „${String(after.status)}“ – erlaubt ist nur Entwurf/freigegeben → published.`,
    );
  }
  const meta = metaOf(after);
  if (!nonEmptyText(meta.catalog_reviewed_by) || !nonEmptyText(meta.catalog_reviewed_at)) {
    errors.push(`${path}: catalog_reviewed_by/at müssen gesetzt sein.`);
  }
  if (!nonEmptyText(meta.reviewed_by) || !nonEmptyText(meta.reviewed_at)) {
    errors.push(`${path}: freigegeben ohne Prüfvermerk (reviewed_by/at).`);
  }
  return errors;
}

/**
 * Fehler zu einer geänderten Datei auf einem Branch `foods-import/<Lauf-ID>`: `catalog_reviewed_*` dürfen dort nur
 * gleich bleiben oder auf null zurückgesetzt werden (R2-K6).
 */
export function importCatalogFieldErrors(
  path: string,
  base: Buffer | undefined,
  head: Buffer | undefined,
): string[] {
  if (!FOOD_FILE.test(path) || head === undefined) return [];
  const after = parse(head);
  if (typeof after === 'string') return [`${path}: ${after}`];
  const before = base === undefined ? undefined : parse(base);
  const metaBefore = before === undefined || typeof before === 'string' ? {} : metaOf(before);
  const metaAfter = metaOf(after);
  const changed = (['catalog_reviewed_by', 'catalog_reviewed_at'] as const).filter((field) => {
    const value = metaAfter[field] ?? null;
    return value !== null && value !== (metaBefore[field] ?? null);
  });
  return changed.length === 0
    ? []
    : [
        `${path}: foods-import setzt ${changed.join(', ')} – die Katalog-Prüfung setzt nur content-review (Art „katalog“), der Import darf sie nur zurücksetzen.`,
      ];
}
