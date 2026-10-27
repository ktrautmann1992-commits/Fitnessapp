/**
 * Allowlist der Nährwert-Quellen (docs/PLAN-PHASE-5.md 5.1, 5.1.1 b, H1, 19.3; Umsetzungsstand N2b).
 *
 * - Jede Quelle hat eine FESTE Adresse, nur HTTPS: entweder die versionierte Original-Datei selbst oder – wenn der
 *   Herausgeber nur Links mit wechselndem Code anbietet – die offizielle Download-Seite (`downloadPage`). Dann
 *   liest der Workflow den einzigen passenden Link (gleicher Host, fester Pfad, Parameter) aus der Seite; die
 *   Echtheit der Datei sichert die Prüfsumme `original_sha256` in SOURCE.json (bzw. festgenagelt `originalSha256`).
 * - `foods-import` lädt die Original-Datei nur von hier; `sources-integrity` liest diese Datei IMMER aus dem
 *   Stand von `main` (nie aus dem Pull Request) und lädt die Original-Datei damit neu.
 * - Bot-Sperren, Captchas oder Anmeldeseiten werden NIE umgangen: Der Lauf bricht dann mit einer Meldung ab.
 * - Änderungen an dieser Datei brauchen die CODEOWNERS-Freigabe (.github/CODEOWNERS, docs/SETUP.md Teil J).
 *
 * WICHTIG: Diese Datei hat bewusst KEINE Imports. `sources-integrity` lädt den Stand von `main` über
 * `git show origin/main:…` in eine temporäre Datei und importiert ihn – ein Import auf andere Dateien des
 * Pull Requests könnte sonst die Allowlist von `main` unterlaufen.
 */

/**
 * Download über eine Seite mit wechselndem Link (z. B. `…/download?token=<Code>`). Gezählt werden nur Links auf
 * DENSELBEN Host wie `url` (HTTPS), mit genau diesem Pfad und nicht leerem Parameter; genau ein Treffer, sonst
 * Abbruch.
 */
export interface DownloadPageConfig {
  /** Pfad des Download-Links, z. B. „/download“. */
  readonly linkPath: string;
  /** Name des Parameters mit dem Code, z. B. „token“. */
  readonly tokenParam: string;
  /**
   * Weitere Hosts, auf die der Download-Link weiterleiten darf (z. B. ein Datei-Server des Herausgebers). Leer =
   * nur der Host der Seite selbst. Nur nach Prüfung per Gründer-PR ergänzen.
   */
  readonly redirectHosts: readonly string[];
}

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
  /**
   * Genaue Spaltenüberschrift (statt Code am Anfang). Nötig, wenn die Quelle keine Nährstoff-Codes führt und
   * mehrere Überschriften mit demselben ersten Wort und derselben Einheit hat.
   */
  readonly header?: string;
}

/** Felder von `nutrients_per_100g` (Plan 5.1). */
export type SourceNutrientKey =
  'kcal' | 'protein_g' | 'carbs_g' | 'sugar_g' | 'fat_g' | 'sat_fat_g' | 'fiber_g' | 'salt_g';

/**
 * Zusätzliche energieliefernde Bestandteile (LMIV Anhang XIV), nur für die Atwater-Prüfung R4 (Import-Lauf 1,
 * PR #47): organische Säuren, Alkohol, mehrwertige Alkohole (Polyole).
 */
export type SourceEnergyExtraKey = 'organic_acids_g' | 'alcohol_g' | 'polyols_g';

export interface SourceDefinition {
  /** Kennung wie `SOURCE_DATABASES` in packages/core (food-schema.ts). */
  readonly db: 'bls' | 'ch_naehrwertdatenbank' | 'usda_fdc';
  /** Version der Quelle = Ordnername unter content/sources/<db>/<version>/. */
  readonly version: string;
  /** Anzeigename der Quelle. */
  readonly title: string;
  /**
   * Feste Adresse (nur HTTPS): die versionierte Original-Datei (`downloadPage = null`) bzw. die offizielle
   * Download-Seite. Steht so in SOURCE.json; `sources-integrity` vergleicht sie mit `main`.
   */
  readonly url: string;
  /** null = `url` ist die Datei selbst; sonst Download-Link aus der Seite `url` lesen. */
  readonly downloadPage: DownloadPageConfig | null;
  /**
   * `confirmed` = Adresse im Browser gegengeprüft; `unconfirmed` = aus der Recherche abgeleitet, beim ersten
   * Workflow-Lauf zu bestätigen (docs/PLAN-PHASE-5.md, Umsetzungsstand N2b). Der Workflow läuft trotzdem; ist die
   * Adresse falsch, bricht er mit einer verständlichen Meldung ab.
   */
  readonly urlStatus: 'confirmed' | 'unconfirmed';
  /** `confirmed` = Lizenz-Wortlaut beim Herausgeber gegengeprüft. */
  readonly licenseStatus: 'confirmed' | 'unconfirmed';
  /** Wer hat Adresse/Lizenz wann und wie bestätigt (Nachweis). */
  readonly confirmedBy: string;
  /**
   * Erwarteter Dateiname der Original-Datei (für SOURCE.json, wenn der Server keinen nennt). Liefert der Server
   * ein ZIP-Archiv, wird zuerst ein Eintrag mit genau diesem Namen gewählt.
   */
  readonly originalFilename: string;
  /** Format der Original-Datei. */
  readonly format: 'xlsx' | 'csv';
  /** Nur xlsx: Name des Tabellenblatts; null = erstes Blatt. */
  readonly sheet: string | null;
  /** Nur csv: Trennzeichen. */
  readonly csvDelimiter: ',' | ';' | '\t';
  /**
   * Zeilen VOR der Kopfzeile (Titel, Hinweise), die übersprungen werden; fehlt = 0 (Kopfzeile ist die erste Zeile).
   */
  readonly headerRow?: number;
  /**
   * Festgenagelte SHA-256 der Original-Datei – PFLICHT vor dem ersten Lauf „import“ (aus dem Lauf „kandidaten“
   * per Gründer-PR eintragen; Wächter-Nachtrag blsdb, NB1). null = nur „kandidaten“ möglich; `sources-integrity`
   * prüft dann die Prüfsumme in SOURCE.json gegen einen Neudownload.
   */
  readonly originalSha256: string | null;
  /** Spalte (0-basiert) mit der Quell-ID (BLS-Schlüssel). */
  readonly keyColumn: number;
  /**
   * Format der Quell-ID als regulärer Ausdruck mit ^…$ (BLS 4.0: Großbuchstabe + 6 Ziffern/Großbuchstaben).
   * Zeilen mit abweichender Quell-ID erscheinen weder in Kandidaten noch in der Namensliste, sie werden nur gezählt
   * (Schutz vor Log-Kommandos wie `::stop-commands::` am Zeilenanfang; Wächter-Prüfung Zuordnung S2).
   */
  readonly keyPattern: string;
  /** Spalte (0-basiert) mit der deutschen Bezeichnung. */
  readonly nameColumn: number;
  /** Nährwert-Spalten je Feld; mehrere Einträge = Alternativen in dieser Reihenfolge. */
  readonly nutrients: Readonly<Record<SourceNutrientKey, readonly SourceNutrientColumn[]>>;
  /**
   * Optionale Spalten nur für R4 (`SourceEnergyExtraKey`). Code vorhanden, aber Einheit falsch oder doppelt →
   * Abbruch wie bei `nutrients`; Code fehlt in der Kopfzeile oder nicht eingetragen → Feld fehlt in den
   * Lebensmitteln (R4 dann ohne diesen Anteil).
   */
  readonly energyExtras?: Readonly<
    Partial<Record<SourceEnergyExtraKey, readonly SourceNutrientColumn[]>>
  >;
  /**
   * `confirmed` = Spaltencodes an der Original-Datei geprüft. `unconfirmed` = nach öffentlicher Dokumentation
   * angenommen; der Import prüft die Kopfzeile und bricht mit der Liste der vorhandenen Spalten ab, wenn ein
   * Code oder eine Einheit fehlt (nie geraten).
   */
  readonly columnsStatus: 'confirmed' | 'unconfirmed';
  /** Lizenz (Kurzname) – landet in `source.license` jedes Lebensmittels. */
  readonly license: string;
  readonly licenseUrl: string;
  /** Lizenz-Hinweis des Herausgebers im Wortlaut. */
  readonly licenseText: string;
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
 * Adresse: offizielle Download-Seite des MRI (blsdb.de). Die Seite hat ZWEI Links „Download BLS-Daten“ (Lauf 4,
 * 12.10.2026): den Navigationslink `/download?token=<Code>` (führt nur wieder auf diese Seite) und den Datei-Link
 * `/assets/uploads/BLS_4_0_2025_DE.zip?token=<Code>`. Gewählt wird nur der Datei-Link – Pfad EXAKT, kein Präfix,
 * kein Muster; der Code wechselt je Seitenaufruf. Neuer Dateiname (z. B. `BLS_4_1_…zip`) → Abbruch mit Liste der
 * Links, Anpassung per Gründer-PR (gewollt).
 * Im ZIP wird die xlsx `BLS_4_0_Daten_2025_DE.xlsx` (Name laut BLS-Dokumentation) bevorzugt; heißt sie anders,
 * nimmt die Format-Erkennung genau eine xlsx (mehrere → Abbruch). Die frühere
 * Adresse im Archiv OpenAgrar leitet automatische Abrufe auf eine Bot-Sperre (Proof-of-Work-Challenge) um; diese
 * wird nicht umgangen (Umsetzungsstand N2b, 12.10.2026). Lizenz-Wortlaut und Zitierweise von der Download-Seite,
 * von den Gründern am 12.10.2026 bestätigt (Screenshot). Betreiber von blsdb.de laut Impressum: Max Rubner-Institut
 * (noch nicht maschinell geprüft; Gründer bestätigt per Blick ins Impressum).
 *
 * `originalSha256` MUSS vor dem ersten Lauf „import“ festgenagelt werden (Wächter-Nachtrag blsdb, NB1): Lauf
 * „kandidaten“ → SHA-256 aus der Zusammenfassung hier per Pull Request eintragen → Gründer merged → „import“.
 */
const BLS_4_0: SourceDefinition = {
  db: 'bls',
  version: '4.0',
  title: 'Bundeslebensmittelschlüssel (BLS), Version 4.0',
  url: 'https://blsdb.de/download',
  downloadPage: {
    linkPath: '/assets/uploads/BLS_4_0_2025_DE.zip',
    tokenParam: 'token',
    redirectHosts: [],
  },
  urlStatus: 'confirmed',
  licenseStatus: 'confirmed',
  confirmedBy:
    'bestätigt durch Gründer 12.10.2026 (Screenshot blsdb.de/download); Betreiber laut Impressum Max Rubner-Institut – noch nicht maschinell geprüft, Gründer bestätigt per Blick ins Impressum',
  originalFilename: 'BLS_4_0_Daten_2025_DE.xlsx',
  format: 'xlsx',
  sheet: null,
  csvDelimiter: ',',
  // Festgenagelt aus Lauf „kandidaten“ 38265538146 (12.10.2026): entpackte BLS_4_0_Daten_2025_DE.xlsx,
  // 14.093.078 Bytes, 7140 Zeilen, 418 Spalten (ZIP 14.263.306 Bytes).
  originalSha256: '524bbefe25b691f5cb3de7a9f3e27fa2967aebfeabf217d99414ba7806e78c60',
  keyColumn: 0,
  // Geprüft an allen 994 Codes der Summary des Laufs „kandidaten“ vom 12.10.2026.
  keyPattern: '^[A-Z][0-9A-Z]{6}$',
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
  // Nur für R4 (LMIV Anhang XIV: organische Säuren 3, Alkohol 7, Polyole 2,4 kcal/g). Kopfzeilen geprüft am
  // Auszug des Import-Laufs 38402246877 (13.10.2026): „ALC Alkohol (Ethanol) [g/100g]“ (Spalte 24),
  // „OA Organische Säuren, gesamt [g/100g]“ (27), „POLYL Zuckeralkohole, gesamt [g/100g]“ (183).
  energyExtras: {
    organic_acids_g: [{ code: 'OA', unit: 'g', convert: 'none' }],
    alcohol_g: [{ code: 'ALC', unit: 'g', convert: 'none' }],
    polyols_g: [{ code: 'POLYL', unit: 'g', convert: 'none' }],
  },
  // Spalten-Bericht Lauf 38265538146: alle Codes mit Einheit gefunden (ENERCC 6, PROT625 12, CHO 18, SUGAR 219,
  // FAT 15, FASAT 246, FIBT 21, NACL 120).
  columnsStatus: 'confirmed',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/deed.de',
  licenseText:
    'Die Daten des BLS stehen als Open Data zur freien Verfügung. Die Nutzung ist unter der Lizenz CC BY 4.0 gestattet. Bei Verwendung ist das Max Rubner-Institut als Herausgeber zu nennen.',
  attribution:
    'Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0. Lizenz: CC BY 4.0.',
  changesNote:
    'Auszug: nur die von Alpha5 verwendeten Zeilen, Werte unverändert. In der App: Salz ggf. aus Natrium berechnet (× 2,5), Nährwerte je Rezept aus Zutatenmengen hochgerechnet.',
};

/**
 * Schweizer Nährwertdatenbank (BLV), Version 7.1 – Zweitquelle (Plan 19.3, Gründer-Entscheidung 13.10.2026) für
 * Zutaten ohne passende BLS-Zeile (Gewürze, Proteinpulver …). Jede Zutat hat genau EINE Quelle; BLS hat Vorrang.
 *
 * Adresse: direkte Datei-Adresse von naehrwertdaten.ch/de/downloads (Link „Schweizer Nährwertdatenbank“), vom
 * Gründer am 25.10.2026 aus der Seite kopiert. Sie trägt keine Versionsnummer, nur den Upload-Monat; die Version
 * „7.1“ steht auf der Download-Seite. Ersetzt der BLV die Datei unter derselben Adresse, schlägt die festgenagelte
 * Prüfsumme an (gewollt) → neue Version per Gründer-PR.
 * Lizenz (Download-Seite, Screenshot Gründer 25.10.2026): „Das Herunterladen ist kostenlos und die Daten dürfen unter
 * Angabe eines Quellenvermerks auch für kommerzielle (z.B. Einbindung in Nährwertberechnungssoftware oder
 * Ernährungstagebuch-App) und wissenschaftliche Zwecke verwendet werden.“
 *
 * Aufbau der Datei an der echten Datei geprüft (Lauf „kandidaten“ 40334562401, 26.10.2026): Kopfzeile, Spalten,
 * Quell-ID-Format und Prüfsumme sind festgenagelt.
 */
const CH_7_1: SourceDefinition = {
  db: 'ch_naehrwertdatenbank',
  version: '7.1',
  title: 'Schweizer Nährwertdatenbank, Version 7.1',
  url: 'https://naehrwertdaten.ch/wp-content/uploads/2026/07/Schweizer_Nahrwertdatenbank.xlsx',
  downloadPage: null,
  urlStatus: 'confirmed',
  licenseStatus: 'confirmed',
  confirmedBy:
    'bestätigt durch Gründer 25.10.2026 (Link aus naehrwertdaten.ch/de/downloads kopiert, Screenshot der Nutzungsbedingungen)',
  originalFilename: 'Schweizer_Nahrwertdatenbank.xlsx',
  format: 'xlsx',
  sheet: 'Generische Lebensmittel',
  csvDelimiter: ',',
  // Zeile 0 Titel („Schweizer Nährwertdatenbank – Generische Lebensmittel V 7.1 (01.07.2026)“), Zeile 1 leer,
  // Zeile 2 Kopfzeile (Lauf „kandidaten“ 40334562401, 26.10.2026: 144 Spalten, 1218 Lebensmittel).
  headerRow: 2,
  // Festgenagelt aus Lauf „kandidaten“ 40334562401 (26.10.2026): 941.213 Bytes, Blätter „Generische Lebensmittel“,
  // „Markenprodukte“, „Quellen“, „Nutrient Codes“.
  originalSha256: 'f4bb854944ef811f9b8463984389f8121e73278c4fd24fc3e8d16336cb711270',
  keyColumn: 0,
  // Spalte 0 „ID“ (z. B. 663, 13884); geprüft an der Namensliste des Laufs 40334562401.
  keyPattern: '^[0-9]{1,7}$',
  // Spalte 3 „Name“ (deutsch). Werte je 100 g essbarer Anteil; je Nährstoff drei Spalten Wert/Herleitung/Quelle.
  nameColumn: 3,
  nutrients: {
    kcal: [
      { code: 'Energie,', header: 'Energie, Kilokalorien (kcal)', unit: 'kcal', convert: 'none' },
    ],
    protein_g: [{ code: 'Protein', header: 'Protein (g)', unit: 'g', convert: 'none' }],
    carbs_g: [
      {
        code: 'Kohlenhydrate,',
        header: 'Kohlenhydrate, verfügbar (g)',
        unit: 'g',
        convert: 'none',
      },
    ],
    sugar_g: [{ code: 'Zucker', header: 'Zucker (g)', unit: 'g', convert: 'none' }],
    fat_g: [{ code: 'Fett,', header: 'Fett, total (g)', unit: 'g', convert: 'none' }],
    sat_fat_g: [
      { code: 'Fettsäuren,', header: 'Fettsäuren, gesättigt (g)', unit: 'g', convert: 'none' },
    ],
    fiber_g: [{ code: 'Nahrungsfasern', header: 'Nahrungsfasern (g)', unit: 'g', convert: 'none' }],
    salt_g: [{ code: 'Salz', header: 'Salz (NaCl) (g)', unit: 'g', convert: 'none' }],
  },
  // Nur für R4: Alkohol (Spalte 59). Organische Säuren und Polyole führt die Datei in den ersten 80 Spalten nicht.
  energyExtras: {
    alcohol_g: [{ code: 'Alkohol', header: 'Alkohol (g)', unit: 'g', convert: 'none' }],
  },
  // Kopfzeile geprüft am Lauf „kandidaten“ 40334562401: Energie kcal 11, Fett 14, gesättigte FS 17, verfügbare
  // KH 41, Zucker 44, Nahrungsfasern 50, Protein 53, Salz 56, Alkohol 59.
  columnsStatus: 'confirmed',
  license: 'Nutzung mit Quellenvermerk (auch kommerziell)',
  licenseUrl: 'https://naehrwertdaten.ch/de/downloads/',
  licenseText:
    'Das Herunterladen ist kostenlos und die Daten dürfen unter Angabe eines Quellenvermerks auch für kommerzielle (z.B. Einbindung in Nährwertberechnungssoftware oder Ernährungstagebuch-App) und wissenschaftliche Zwecke verwendet werden.',
  attribution:
    'Schweizer Nährwertdatenbank, Version 7.1, Bundesamt für Lebensmittelsicherheit und Veterinärwesen BLV, naehrwertdaten.ch.',
  changesNote:
    'Auszug: nur die von Alpha5 verwendeten Zeilen, Werte unverändert. In der App: Salz ggf. aus Natrium berechnet (× 2,5), Nährwerte je Rezept aus Zutatenmengen hochgerechnet.',
};

/** Allowlist: genau diese Quellen/Versionen darf `foods-import` laden und `sources-integrity` anerkennen. */
export const SOURCES: readonly SourceDefinition[] = [BLS_4_0, CH_7_1];

/** Quelle nach Datenbank und Version (undefined = nicht in der Allowlist). */
export function findSource(
  sources: readonly SourceDefinition[],
  db: string,
  version: string,
): SourceDefinition | undefined {
  return sources.find((source) => source.db === db && source.version === version);
}
