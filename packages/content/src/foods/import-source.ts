/**
 * `import-source.ts` (docs/PLAN-PHASE-5.md 5.1, B6a, 19.3): baut die Lebensmittel `content/foods/<id>.json`
 * aus der Zuordnung (Beschreibung, Vorschlag aus einer Claude-Sitzung) und dem Quellauszug (Nährwerte und
 * Bezeichnung der Quelle, maschinell). EINZIGE Schreibstelle für `content/foods/` (S3); läuft nur im Workflow
 * `foods-import`.
 *
 * - Nährwerte und `source.name` kommen nur aus dem Quellauszug (über `source-rows.ts`), nie aus der Zuordnung,
 *   nie aus der Gründer-Datei (deren `pro_100g` ist nur Gegencheck, Bericht > 3 % / > 15 %).
 * - Erwartungsliste `allergen-expectations.json` aus den Gruppen der Zuordnung (bei R19 von Menschen bestätigt).
 * - Unverändert → Datei bleibt byte-gleich. Geändert → `version` + 1, Katalog-Prüfung zurückgesetzt.
 *   Freigegebene Lebensmittel werden nie überschrieben (Bericht).
 */
import {
  ALPHA5_IMPORT_TOLERANCE,
  type AllergenExpectations,
  type Food,
  type FoodGroupId,
  foodSchema,
  type SourceNutrientRow,
  sourceRowKey,
} from '@fitnessapp/core';

import {
  CONFIRMED_DIFFERENCES_PATH,
  type ConfirmedDifference,
  confirmationDraft,
  confirmationMismatches,
} from './confirmed-differences';
import type { FoodMapping, MappingItem } from './mapping';
import type { SourceDefinition } from './sources';

export const FOODS_DIR = 'content/foods';
export const EXPECTATIONS_PATH = `${FOODS_DIR}/allergen-expectations.json`;
/** Ausnahmeliste (R18), von Menschen gepflegt – bewusst außerhalb von content/foods/ (Wächter N2b, S4). */
export const EXCEPTIONS_PATH = 'content/food-mapping/allergen-exceptions.json';

/** `pro_100g` einer Zutat in alpha5-rezepte.json (nur Gegencheck). */
export interface Alpha5Per100g {
  readonly kcal: number;
  readonly eiweiss_g: number;
  readonly kohlenhydrate_g: number;
  readonly fett_g: number;
}

export interface Deviation {
  readonly id: string;
  readonly field: 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g';
  readonly file: number;
  /** Verglichener Quellwert (bei einer Lesart, z. B. „KH + Ballaststoffe“, der umgerechnete Wert). */
  readonly source: number;
  /** Relative Abweichung zur Quelle (0,05 = 5 %). */
  readonly relative: number;
  /**
   * Nur Eiweiß/Kohlenhydrate/Fett: Abweichung als Energie (Gramm × Atwater-Faktor) im Verhältnis zum
   * Energiegehalt (größerer Wert aus Datei und Quelle).
   */
  readonly energyShare?: number;
  /** Lesart der Quellwerte, falls nicht der reine Quellwert am besten passt (z. B. „KH + Ballaststoffe“). */
  readonly reading?: string;
  /**
   * `report` = über 3 %; `review` = „Zuordnung prüfen“ (Energie > 15 % und ≥ 20 kcal; Makro > 15 % und ≥ 15 % der
   * Energie, `ALPHA5_IMPORT_TOLERANCE`).
   */
  readonly level: 'report' | 'review';
}

/** Quellwerte, die der Gegencheck braucht (Lebensmittel je 100 g oder Rezept je Portion). */
export interface CrossCheckValues {
  readonly kcal: number;
  readonly protein_g: number;
  readonly carbs_g: number;
  readonly fat_g: number;
  readonly fiber_g?: number | null;
  readonly polyols_g?: number | null;
}

export interface ImportInput {
  readonly mapping: FoodMapping;
  readonly def: SourceDefinition;
  /** Quellzeilen nach `sourceRowKey`. */
  readonly sourceRows: ReadonlyMap<string, SourceNutrientRow>;
  /** Abrufdatum der Original-Datei (YYYY-MM-DD). */
  readonly retrievedOn: string;
  /** Vorhandene Lebensmittel-Dateien (geparstes JSON) nach ID. */
  readonly existing: ReadonlyMap<string, unknown>;
  /** Gegencheck-Werte aus alpha5-rezepte.json nach Zutat-ID (`alpha5_id`). */
  readonly alpha5: ReadonlyMap<string, Alpha5Per100g>;
  /** Datum für neue Dateien (YYYY-MM-DD). */
  readonly today: string;
  /**
   * Liste „bestätigte Datenunterschiede“ (`confirmed-differences.ts`), nur vom Stand `main` geladen; fehlt = leer.
   */
  readonly confirmations?: readonly ConfirmedDifference[];
}

/** Zutat mit „Zuordnung prüfen“, deren Unterschied ein gültiger Eintrag der Liste bestätigt (🟠). */
export interface ConfirmedInReport {
  readonly id: string;
  readonly reason_de: string;
  readonly confirmed_by: string;
  readonly confirmed_at: string;
}

export interface ImportReport {
  readonly written: string[];
  readonly unchanged: string[];
  readonly skipped: { id: string; reason: string }[];
  readonly deviations: Deviation[];
  /** Zutaten ohne Vergleichswert in der Gründer-Datei (alle vier Werte 0) – kein Gegencheck möglich. */
  readonly noReference: string[];
  /**
   * Zutaten, die in diesem Lauf mit der Gründer-Datei verglichen wurden (inkl. „kein Vergleichswert“) – Nenner der
   * Merge-Regel (Wächter Import-Lauf 1, K6): nicht importierte Zutaten verdünnen den Anteil nicht.
   */
  readonly compared: string[];
  /** Vorhandene Lebensmittel ohne (gültige) Zuordnung mehr – bleiben liegen, nur gemeldet (Wächter N2b, K7). */
  readonly orphaned: string[];
  /** „Zuordnung prüfen“ mit gültiger Bestätigung – sichtbar als 🟠, zählt nicht zur 10-%-Regel (aber zum Deckel). */
  readonly confirmed: ConfirmedInReport[];
  /** Einträge der Liste, deren Bindung nicht mehr passt – die Zutat bleibt „Zuordnung prüfen“ (🔴). */
  readonly invalidConfirmations: { id: string; problems: string[] }[];
  /** Einträge ohne Wirkung (Zutat nicht verglichen oder ohne „Zuordnung prüfen“) – können raus. */
  readonly unusedConfirmations: string[];
  /**
   * Je 🔴-Zutat (offen, auch bei ungültiger Bestätigung) ein kopierfertiger Eintrag für die Liste mit den exakten
   * acht Werten, gegen die `confirmationMismatches` prüft; `reason_de`, `confirmed_by`, `confirmed_at` sind
   * Platzhalter, die das Schema ablehnt, bis sie ausgefüllt sind (Wächter LOD, S2).
   */
  readonly confirmationDrafts: ConfirmedDifference[];
}

export interface ImportOutput {
  /** Lebensmittel, die geschrieben werden (neu oder geändert). */
  readonly foods: Map<string, Food>;
  readonly expectations: AllergenExpectations;
  readonly report: ImportReport;
}

/**
 * Felder, deren Änderung eine neue Version und eine neue Katalog-Prüfung verlangt (alles außer meta, version,
 * status und Abrufdatum).
 */
function substance(food: Food): string {
  // Ein neues Abrufdatum allein ist keine inhaltliche Änderung.
  return canonicalJson({
    ...food,
    meta: undefined,
    version: undefined,
    status: undefined,
    source: { ...food.source, retrieved_at: undefined },
  });
}

/** Ändern sich Nährwerte, Quell-ID, Gruppen oder Schwangerschafts-Hinweis, gilt die Fachprüfung nicht mehr. */
export function needsExpertReset(previous: Food, next: Food): boolean {
  return (
    canonicalJson(previous.nutrients_per_100g) !== canonicalJson(next.nutrients_per_100g) ||
    previous.source.ref !== next.source.ref ||
    previous.source.db !== next.source.db ||
    previous.source.version !== next.source.version ||
    canonicalJson([...previous.groups].sort()) !== canonicalJson([...next.groups].sort()) ||
    previous.pregnancy_caution !== next.pregnancy_caution
  );
}

/** JSON mit rekursiv sortierten Schlüsseln (Vergleich unabhängig von der Reihenfolge). */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sortedGroups(groups: readonly FoodGroupId[]): FoodGroupId[] {
  return [...groups].sort();
}

function buildFood(
  item: MappingItem,
  row: SourceNutrientRow,
  input: ImportInput,
  previous: Food | undefined,
): Food {
  return {
    id: item.food_id,
    version: previous?.version ?? 1,
    status: previous?.status ?? 'draft',
    name_de: item.name_de,
    aliases_de: item.aliases_de,
    shopping_category: item.shopping_category,
    pantry: item.pantry,
    nutrients_per_100g: row.nutrients_per_100g,
    units: item.units,
    groups: sortedGroups(item.groups),
    animal: item.animal,
    meat_kind: item.meat_kind,
    ...(item.gelatin_origin === undefined ? {} : { gelatin_origin: item.gelatin_origin }),
    pregnancy_caution: item.pregnancy_caution,
    alcohol: item.alcohol,
    max_fridge_days: item.max_fridge_days,
    freezable: item.freezable,
    substitutes: item.substitutes,
    source: {
      db: input.def.db,
      version: input.def.version,
      ref: row.ref,
      name: row.name,
      category: item.source.category,
      license: input.def.license,
      retrieved_at: input.retrievedOn,
    },
    meta: previous?.meta ?? {
      origin: 'claude_session',
      model: input.mapping.model,
      batch_id: null,
      created_on: input.today,
      expert_reviewed: false,
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
      catalog_reviewed_by: null,
      catalog_reviewed_at: null,
    },
  };
}

/**
 * true = die Gründer-Datei hat für diese Zutat keinen Vergleichswert (kcal, Eiweiß, Kohlenhydrate, Fett alle 0;
 * z. B. Pfeffer, Salz, Wasser). Dann ist kein Gegencheck möglich – Stufe „kein Vergleichswert“, nicht „Zuordnung
 * prüfen“ (Import-Lauf 1, PR #47).
 */
export function hasNoReference(file: Alpha5Per100g): boolean {
  return file.kcal === 0 && file.eiweiss_g === 0 && file.kohlenhydrate_g === 0 && file.fett_g === 0;
}

interface Reading {
  readonly value: number;
  readonly label?: string;
}

/**
 * Lesarten der Quellwerte je Feld (Definitionen, keine Toleranz): Kohlenhydrate „verfügbar“ (BLS), inklusive
 * Ballaststoffe (US-Tabellen) oder ohne Zuckeralkohole (ältere Tabellen); Energie auch mit Ballaststoffen als
 * Kohlenhydrat (4 statt 2 kcal/g). Eiweiß und Fett haben nur den Quellwert.
 */
function readings(
  field: Deviation['field'],
  source: CrossCheckValues,
  fiberInCarbs: boolean,
): Reading[] {
  const fiber = source.fiber_g ?? null;
  const polyols = source.polyols_g ?? null;
  if (field === 'kcal') {
    // Nur wenn (1) die Kohlenhydrate der Datei selbst „inklusive Ballaststoffe“ gemeint sind (eine Definition je
    // Zutat) UND (2) das Lebensmittel ballaststoffbetont ist (Ballaststoffe ≥ verfügbare KH, z. B. Knoblauch,
    // Sesam, Tahin) – nur dort verschiebt die Definition die Energie spürbar. Sonst würde z. B. Vollkornbrot statt
    // Weißbrot (mehr Ballaststoffe, weniger KH) über die Lesart durchrutschen (Wächter Import-Lauf 1, S1).
    return [
      { value: source.kcal },
      ...(fiberInCarbs && fiber !== null && fiber > 0 && fiber >= source.carbs_g
        ? [{ value: source.kcal + 2 * fiber, label: 'Ballaststoffe als KH (4 kcal/g)' }]
        : []),
    ];
  }
  if (field === 'carbs_g') {
    return [
      { value: source.carbs_g },
      ...(fiber !== null && fiber > 0
        ? [{ value: source.carbs_g + fiber, label: 'KH + Ballaststoffe' }]
        : []),
      ...(polyols !== null && polyols > 0
        ? [{ value: Math.max(source.carbs_g - polyols, 0), label: 'KH ohne Zuckeralkohole' }]
        : []),
    ];
  }
  return [{ value: source[field] }];
}

const ENERGY_FACTOR = { protein_g: 4, carbs_g: 4, fat_g: 9 } as const;

/**
 * Gegencheck Datei-Wert ↔ Quellwert (Plan 19.3 (a), fair seit Import-Lauf 1, PR #47 – Regeln und Begründung bei
 * `ALPHA5_IMPORT_TOLERANCE`). Je Feld zählt die am besten passende Lesart der Quellwerte.
 */
export function alpha5Deviations(
  id: string,
  file: Alpha5Per100g,
  source: CrossCheckValues,
): Deviation[] {
  const pairs: [Deviation['field'], number][] = [
    ['kcal', file.kcal],
    ['protein_g', file.eiweiss_g],
    ['carbs_g', file.kohlenhydrate_g],
    ['fat_g', file.fett_g],
  ];
  const T = ALPHA5_IMPORT_TOLERANCE;
  const energyBase = Math.max(file.kcal, source.kcal, 1);
  const bestReading = (options: readonly Reading[], fileValue: number): Reading => {
    let best = options[0] as Reading;
    for (const option of options) {
      if (Math.abs(fileValue - option.value) < Math.abs(fileValue - best.value)) {
        best = option;
      }
    }
    return best;
  };
  const fiberInCarbs =
    bestReading(readings('carbs_g', source, false), file.kohlenhydrate_g).label ===
    'KH + Ballaststoffe';
  const result: Deviation[] = [];
  for (const [field, fileValue] of pairs) {
    const best = bestReading(readings(field, source, fiberInCarbs), fileValue);
    const sourceValue = Math.round(best.value * 1e6) / 1e6;
    const absolute = Math.abs(fileValue - sourceValue);
    const minimum = field === 'kcal' ? T.minKcal : T.minGrams;
    if (absolute <= minimum) {
      continue;
    }
    const relative = sourceValue === 0 ? Number.POSITIVE_INFINITY : absolute / sourceValue;
    if (relative <= T.relative) {
      continue;
    }
    const energyShare =
      field === 'kcal' ? undefined : (absolute * ENERGY_FACTOR[field]) / energyBase;
    const review =
      relative > T.reviewRelative &&
      (energyShare === undefined
        ? absolute >= T.reviewMinKcal
        : energyShare >= T.reviewEnergyShare);
    result.push({
      id,
      field,
      file: fileValue,
      source: sourceValue,
      relative,
      ...(energyShare === undefined ? {} : { energyShare }),
      ...(best.label === undefined ? {} : { reading: best.label }),
      level: review ? 'review' : 'report',
    });
  }
  return result;
}

/** Kurzbeschreibung der Regel für Berichte (PR-Text, Import-Bericht). */
export const ALPHA5_REVIEW_RULE_NOTE = `> ${Math.round(ALPHA5_IMPORT_TOLERANCE.relative * 100)} % gemeldet; „Zuordnung prüfen“: Energie > ${Math.round(ALPHA5_IMPORT_TOLERANCE.reviewRelative * 100)} % und ≥ ${ALPHA5_IMPORT_TOLERANCE.reviewMinKcal} kcal, Eiweiß/KH/Fett > ${Math.round(ALPHA5_IMPORT_TOLERANCE.reviewRelative * 100)} % und ≥ ${Math.round(ALPHA5_IMPORT_TOLERANCE.reviewEnergyShare * 100)} % der Energie`;

/** Baut Lebensmittel und Erwartungsliste (rein, ohne Dateizugriff – testbar). */
export function importFoods(input: ImportInput): ImportOutput {
  const foods = new Map<string, Food>();
  const expectations: Record<string, FoodGroupId[]> = {};
  const report: ImportReport = {
    written: [],
    unchanged: [],
    skipped: [],
    deviations: [],
    noReference: [],
    compared: [],
    orphaned: [],
    confirmed: [],
    invalidConfirmations: [],
    unusedConfirmations: [],
    confirmationDrafts: [],
  };
  const confirmations = new Map((input.confirmations ?? []).map((c) => [c.alpha5_id, c]));
  const usedConfirmations = new Set<string>();

  for (const item of input.mapping.items) {
    const id = item.food_id;
    if (item.source.db !== input.def.db || item.source.version !== input.def.version) {
      report.skipped.push({
        id,
        reason: `andere Quelle (${item.source.db} ${item.source.version}) – eigener Lauf nötig`,
      });
      continue;
    }
    if (item.source.ref === null) {
      report.skipped.push({ id, reason: 'noch keine Quell-ID zugeordnet (Kandidaten im Bericht)' });
      continue;
    }
    const row = input.sourceRows.get(
      sourceRowKey({ db: input.def.db, version: input.def.version, ref: item.source.ref }),
    );
    if (row === undefined) {
      report.skipped.push({
        id,
        reason: `Quell-ID „${item.source.ref}“ nicht im Auszug (fehlt in der Quelle oder Wert unvollständig)`,
      });
      continue;
    }

    const previousRaw = input.existing.get(id);
    let previous: Food | undefined;
    if (previousRaw !== undefined) {
      const parsed = foodSchema.safeParse(previousRaw);
      if (!parsed.success) {
        report.skipped.push({
          id,
          reason: 'vorhandene Datei ist ungültig – bitte prüfen, nicht überschrieben',
        });
        continue;
      }
      previous = parsed.data;
    }

    let food = buildFood(item, row, input, previous);
    if (previous !== undefined) {
      if (substance(previous) === substance(food)) {
        report.unchanged.push(id);
        expectations[id] = sortedGroups(item.groups);
        continue;
      }
      if (previous.status === 'published') {
        report.skipped.push({
          id,
          reason:
            'freigegeben – wird nie überschrieben; erst über content-review zurück auf Entwurf setzen',
        });
        expectations[id] = sortedGroups(previous.groups);
        continue;
      }
      // Fachlich wichtige Änderung (Werte, Quell-ID, Gruppen, Schwangerschaft) → auch die Fachprüfung zurücksetzen
      // (Wächter N2b, S6); sonst nur die Katalog-Prüfung.
      const expertReset = needsExpertReset(previous, food);
      food = {
        ...food,
        version: previous.version + 1,
        meta: {
          ...previous.meta,
          catalog_reviewed_by: null,
          catalog_reviewed_at: null,
          ...(expertReset
            ? { expert_reviewed: false, reviewed_by: null, reviewed_at: null, review_note: null }
            : {}),
        },
      };
    }
    const checked = foodSchema.safeParse(food);
    if (!checked.success) {
      report.skipped.push({
        id,
        reason: `Schemafehler: ${checked.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      });
      continue;
    }
    foods.set(id, checked.data);
    expectations[id] = sortedGroups(item.groups);
    report.written.push(id);

    const fileValues = input.alpha5.get(item.alpha5_id);
    if (fileValues !== undefined) {
      report.compared.push(id);
      if (hasNoReference(fileValues)) {
        report.noReference.push(id);
      } else {
        const deviations = alpha5Deviations(id, fileValues, row.nutrients_per_100g);
        report.deviations.push(...deviations);
        const entry = confirmations.get(item.alpha5_id);
        const needsReview = deviations.some((d) => d.level === 'review');
        const target = {
          db: row.db,
          version: row.version,
          ref: row.ref,
          source: row.nutrients_per_100g,
          file: fileValues,
        };
        const mismatches = entry === undefined ? undefined : confirmationMismatches(entry, target);
        if (needsReview && mismatches?.length !== 0) {
          // 🔴 offen: Vorlage mit den Rohwerten der Quelle (nicht dem Wert einer Lesart) – genau die Bindung.
          report.confirmationDrafts.push(confirmationDraft(item.alpha5_id, target));
        }
        if (entry !== undefined && mismatches !== undefined && needsReview) {
          usedConfirmations.add(item.alpha5_id);
          if (mismatches.length === 0) {
            report.confirmed.push({
              id,
              reason_de: entry.reason_de,
              confirmed_by: entry.confirmed_by,
              confirmed_at: entry.confirmed_at,
            });
          } else {
            report.invalidConfirmations.push({ id, problems: mismatches });
          }
        }
      }
    }
  }
  report.unusedConfirmations.push(
    ...[...confirmations.keys()].filter((key) => !usedConfirmations.has(key)).sort(),
  );

  // Verwaiste Lebensmittel: Datei vorhanden, aber nicht (mehr) importiert – Erwartungen aus der Datei behalten,
  // damit R18 sie weiter prüft; im Bericht melden.
  for (const [id, raw] of input.existing) {
    if (expectations[id] !== undefined) {
      continue;
    }
    report.orphaned.push(id);
    const parsed = foodSchema.safeParse(raw);
    if (parsed.success) {
      expectations[id] = sortedGroups(parsed.data.groups);
    }
  }
  report.orphaned.sort();

  const sortedExpectations: Record<string, FoodGroupId[]> = {};
  for (const key of Object.keys(expectations).sort()) {
    sortedExpectations[key] = expectations[key] ?? [];
  }
  return { foods, expectations: sortedExpectations, report };
}

/** Bericht als Markdown (PR-Text, Zusammenfassung des Laufs). */
export function formatImportReport(report: ImportReport, missingRefs: readonly string[]): string {
  const pct = (value: number) =>
    Number.isFinite(value) ? `${(value * 100).toFixed(1).replace('.', ',')} %` : '∞';
  const lines = [
    '#### Lebensmittel',
    '',
    `- neu oder geändert: **${report.written.length}**`,
    `- unverändert: ${report.unchanged.length}`,
    `- nicht importiert: ${report.skipped.length}`,
    `- Quell-IDs ohne Zeile in der Original-Datei: ${missingRefs.length === 0 ? 'keine' : missingRefs.join(', ')}`,
    `- verwaist (Datei vorhanden, keine gültige Zuordnung mehr – bitte prüfen): ${report.orphaned.length === 0 ? 'keine' : report.orphaned.join(', ')}`,
    '',
  ];
  if (report.skipped.length > 0) {
    lines.push('| Zutat | Grund |', '| --- | --- |');
    for (const s of report.skipped) {
      lines.push(`| \`${s.id}\` | ${s.reason.replace(/\|/g, '\\|')} |`);
    }
    lines.push('');
  }
  const confirmedIds = new Set(report.confirmed.map((c) => c.id));
  const review = report.deviations.filter((d) => d.level === 'review');
  const reviewFoods = new Set(review.map((d) => d.id));
  const openFoods = [...reviewFoods].filter((id) => !confirmedIds.has(id));
  lines.push(
    `#### Gegencheck alpha5-rezepte.json ↔ Quelle (${ALPHA5_REVIEW_RULE_NOTE})`,
    '',
    `${report.deviations.length} Abweichungen, davon ${review.length} „Zuordnung prüfen“ bei ${reviewFoods.size} Zutaten (🔴 offen: ${openFoods.length}, 🟠 bestätigt: ${confirmedIds.size}). Maßgeblich ist immer die Quelle. Lesarten (KH + Ballaststoffe, KH ohne Zuckeralkohole, Ballaststoffe als KH) gleichen nur Definitionen der Gründer-Datei aus.`,
    '',
  );
  if (report.noReference.length > 0) {
    lines.push(
      `⚪ Kein Vergleichswert (Gründer-Datei 0 kcal / 0 g, z. B. Gewürze): ${report.noReference.map((id) => `\`${id}\``).join(', ')} – zählt nicht als „Zuordnung prüfen“, bei R19 prüfen.`,
      '',
    );
  }
  if (report.deviations.length > 0) {
    lines.push(
      '| Zutat | Wert | Datei | Quelle | Abweichung | Energieanteil | Lesart |',
      '| --- | --- | --- | --- | --- | --- | --- |',
    );
    const ordered = [...report.deviations].sort((a, b) =>
      a.level === b.level ? a.id.localeCompare(b.id) : a.level === 'review' ? -1 : 1,
    );
    for (const d of ordered) {
      const mark = d.level === 'review' ? (confirmedIds.has(d.id) ? '🟠' : '🔴') : '🟡';
      lines.push(
        `| ${mark} \`${d.id}\` | ${d.field} | ${d.file} | ${d.source} | ${pct(d.relative)} | ${d.energyShare === undefined ? '–' : pct(d.energyShare)} | ${d.reading ?? '–'} |`,
      );
    }
    lines.push('');
  }
  if (report.confirmed.length > 0) {
    lines.push(
      '#### 🟠 Bestätigte Datenunterschiede (content/food-mapping/bestaetigte-abweichungen.json, zählen nicht zur 10-%-Regel)',
      '',
      '| Zutat | Grund | bestätigt von (Angabe, kein Nachweis – Nachweis ist der Gründer-Merge) | am |',
      '| --- | --- | --- | --- |',
      ...report.confirmed.map(
        (c) =>
          `| 🟠 \`${c.id}\` | ${c.reason_de.replace(/\|/g, '\\|')} | ${c.confirmed_by.replace(/\|/g, '\\|')} | ${c.confirmed_at} |`,
      ),
      '',
    );
  }
  if (report.invalidConfirmations.length > 0) {
    lines.push(
      '#### ⚠️ Bestätigungen ungültig (Werte oder Quell-ID geändert – Zutat bleibt 🔴 „Zuordnung prüfen“)',
      '',
      ...report.invalidConfirmations.map((c) => `- \`${c.id}\`: ${c.problems.join('; ')}`),
      '',
    );
  }
  if (report.unusedConfirmations.length > 0) {
    lines.push(
      `Bestätigungen ohne Wirkung (Zutat nicht verglichen oder ohne „Zuordnung prüfen“, können aus der Liste): ${report.unusedConfirmations.map((id) => `\`${id}\``).join(', ')}`,
      '',
    );
  }
  if (report.confirmationDrafts.length > 0) {
    lines.push(
      '<details>',
      `<summary>📋 Kopierfertige Einträge für ${CONFIRMED_DIFFERENCES_PATH} (🔴 offen: ${report.confirmationDrafts.length})</summary>`,
      '',
      'Nur für Zutaten, deren Unterschied nach Prüfung **echt** ist (andere Ware, grober Wert in alpha5-rezepte.json) – nie für eine falsche Datei oder Quell-ID. Die acht Werte sind exakt die Bindung (Rohwerte der Quelle, nicht der Wert einer Lesart) und werden **nicht** geändert. Nur `reason_de`, `confirmed_by` (Angabe, kein Nachweis) und `confirmed_at` ausfüllen; mit Platzhalter lehnt das Schema den Eintrag ab. Den Bestätigungs-Pull-Request merged nur ein Gründer selbst (docs/SETUP.md J3).',
      '',
      '```json',
      JSON.stringify(report.confirmationDrafts, null, 2),
      '```',
      '',
      '</details>',
      '',
    );
  }
  return lines.join('\n');
}
