/**
 * Allowlist der Nährwert-Quellen (docs/PLAN-PHASE-5.md 5.1, 5.1.1 b, H1, 19.3).
 *
 * - Jede Quelle zeigt auf eine FESTE, versionierte Original-Datei (nie „neueste Fassung“), nur HTTPS.
 * - `foods-import` lädt die Original-Datei nur von hier; `sources-integrity` liest diese Datei IMMER aus dem
 *   Stand von `main` (nie aus dem Pull Request) und lädt die Original-Datei damit neu.
 * - Änderungen an dieser Datei brauchen die CODEOWNERS-Freigabe (.github/CODEOWNERS, docs/SETUP.md Teil J).
 *
 * WICHTIG: Diese Datei hat bewusst KEINE Imports. `sources-integrity` lädt den Stand von `main` über
 * `git show origin/main:…` in eine temporäre Datei und importiert ihn – ein Import auf andere Dateien des
 * Pull Requests könnte sonst die Allowlist von `main` unterlaufen.
 */

/** Spalte einer Quelle mit einem Nährwert (Kopfzeile beginnt mit `code`, Einheit muss vorkommen). */
export interface SourceNutrientColumn {
  /** Nährstoff-Code am Anfang der Spaltenüberschrift, z. B. „ENERCC“. */
  readonly code: string;
  /** Einheit, die in der Spaltenüberschrift stehen muss (Prüfung gegen Verwechslung), z. B. „kcal“, „g“, „mg“. */
  readonly unit: 'kcal' | 'g' | 'mg';
  /**
   * Umrechnung in die Einheit des Katalogs (nur diese festen Fälle, Plan 5.1 S13):
   * `none` = unverändert; `sodium_mg_to_salt_g` = Natrium (mg) × 2,5 / 1000 (LMIV Anhang I Nr. 11: Salz =
   * Natrium × 2,5).
   */
  readonly convert: 'none' | 'sodium_mg_to_salt_g';
}

/** Felder von `nutrients_per_100g` (Plan 5.1). */
export type SourceNutrientKey =
  'kcal' | 'protein_g' | 'carbs_g' | 'sugar_g' | 'fat_g' | 'sat_fat_g' | 'fiber_g' | 'salt_g';

export interface SourceDefinition {
  /** Kennung wie `SOURCE_DATABASES` in packages/core (food-schema.ts). */
  readonly db: 'bls' | 'ch_naehrwertdatenbank' | 'usda_fdc';
  /** Version der Quelle = Ordnername unter content/sources/<db>/<version>/. */
  readonly version: string;
  /** Anzeigename der Quelle. */
  readonly title: string;
  /** Feste, versionierte Adresse der Original-Datei (nur HTTPS). */
  readonly url: string;
  /**
   * `confirmed` = Adresse im Browser gegengeprüft; `unconfirmed` = aus der Recherche abgeleitet, beim ersten
   * Workflow-Lauf zu bestätigen (docs/PLAN-PHASE-5.md, Umsetzungsstand N2b). Der Workflow läuft trotzdem; ist die
   * Adresse falsch, bricht er mit einer verständlichen Meldung ab.
   */
  readonly urlStatus: 'confirmed' | 'unconfirmed';
  /** Erwarteter Dateiname der Original-Datei (für SOURCE.json). */
  readonly originalFilename: string;
  /** Format der Original-Datei. */
  readonly format: 'xlsx' | 'csv';
  /** Nur xlsx: Name des Tabellenblatts; null = erstes Blatt. */
  readonly sheet: string | null;
  /** Nur csv: Trennzeichen. */
  readonly csvDelimiter: ',' | ';' | '\t';
  /**
   * Optional festgenagelte SHA-256 der Original-Datei (nach dem ersten erfolgreichen Lauf eintragen). null =
   * es zählt die Prüfsumme in SOURCE.json, die `sources-integrity` bei jedem Lauf gegen einen Neudownload prüft.
   */
  readonly originalSha256: string | null;
  /** Spalte (0-basiert) mit der Quell-ID (BLS-Schlüssel). */
  readonly keyColumn: number;
  /** Spalte (0-basiert) mit der deutschen Bezeichnung. */
  readonly nameColumn: number;
  /** Nährwert-Spalten je Feld; mehrere Einträge = Alternativen in dieser Reihenfolge. */
  readonly nutrients: Readonly<Record<SourceNutrientKey, readonly SourceNutrientColumn[]>>;
  /**
   * `confirmed` = Spaltencodes an der Original-Datei geprüft. `unconfirmed` = nach öffentlicher Dokumentation
   * angenommen; der Import prüft die Kopfzeile und bricht mit der Liste der vorhandenen Spalten ab, wenn ein
   * Code oder eine Einheit fehlt (nie geraten).
   */
  readonly columnsStatus: 'confirmed' | 'unconfirmed';
  /** Lizenz (Kurzname) – landet in `source.license` jedes Lebensmittels. */
  readonly license: string;
  readonly licenseUrl: string;
  /** Pflicht-Namensnennung (Wortlaut für „Lizenzen“, PDF-Fuß und ATTRIBUTION.md). */
  readonly attribution: string;
  /** Hinweis auf Änderungen (CC BY 4.0 verlangt, Änderungen kenntlich zu machen). */
  readonly changesNote: string;
}

/**
 * Bundeslebensmittelschlüssel (BLS) 4.0, Max Rubner-Institut – Hauptquelle (Plan 16 B (f), Recherche 11.10.2026,
 * Quellen im Umsetzungsstand N2b): Open Data unter CC BY 4.0, Namensnennung „Max Rubner-Institut“, DOI
 * 10.25826/Data20251217-134202-0. Hauptdatei laut BLS-4.0-Dokumentation `BLS_4_0_Daten_2025_DE.xlsx`
 * (Spalte 1 BLS-Schlüssel, 2 deutsche, 3 englische Bezeichnung; je Nährstoff drei Spalten Wert/Herkunft/Referenz;
 * Werte je 100 g essbarer Anteil).
 *
 * Adresse: archivierte Fassung im Repositorium OpenAgrar (dieselbe Ablage wie die BLS-4.0-Dokumentation,
 * openagrar_derivate_00069363) – fest und versioniert. Noch NICHT im Browser bestätigt (siehe `urlStatus`).
 */
const BLS_4_0: SourceDefinition = {
  db: 'bls',
  version: '4.0',
  title: 'Bundeslebensmittelschlüssel (BLS), Version 4.0',
  url: 'https://www.openagrar.de/servlets/MCRFileNodeServlet/openagrar_derivate_00069363/BLS_4_0_Daten_2025_DE.xlsx',
  urlStatus: 'unconfirmed',
  originalFilename: 'BLS_4_0_Daten_2025_DE.xlsx',
  format: 'xlsx',
  sheet: null,
  csvDelimiter: ',',
  originalSha256: null,
  keyColumn: 0,
  nameColumn: 1,
  nutrients: {
    kcal: [{ code: 'ENERCC', unit: 'kcal', convert: 'none' }],
    protein_g: [{ code: 'PROT625', unit: 'g', convert: 'none' }],
    carbs_g: [{ code: 'CHO', unit: 'g', convert: 'none' }],
    sugar_g: [{ code: 'SUGAR', unit: 'g', convert: 'none' }],
    fat_g: [{ code: 'FAT', unit: 'g', convert: 'none' }],
    sat_fat_g: [{ code: 'FASAT', unit: 'g', convert: 'none' }],
    fiber_g: [{ code: 'FIBT', unit: 'g', convert: 'none' }],
    salt_g: [
      { code: 'NACL', unit: 'g', convert: 'none' },
      { code: 'NA', unit: 'mg', convert: 'sodium_mg_to_salt_g' },
    ],
  },
  columnsStatus: 'unconfirmed',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/deed.de',
  attribution:
    'Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 – Deutsche Nährstoffdatenbank. DOI: 10.25826/Data20251217-134202-0. Lizenz: CC BY 4.0.',
  changesNote:
    'Auszug: nur die von Alpha5 verwendeten Zeilen, Werte unverändert. In der App: Salz ggf. aus Natrium berechnet (× 2,5), Nährwerte je Rezept aus Zutatenmengen hochgerechnet.',
};

/** Allowlist: genau diese Quellen/Versionen darf `foods-import` laden und `sources-integrity` anerkennen. */
export const SOURCES: readonly SourceDefinition[] = [BLS_4_0];

/** Quelle nach Datenbank und Version (undefined = nicht in der Allowlist). */
export function findSource(
  sources: readonly SourceDefinition[],
  db: string,
  version: string,
): SourceDefinition | undefined {
  return sources.find((source) => source.db === db && source.version === version);
}
