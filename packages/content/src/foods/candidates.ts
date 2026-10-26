/**
 * Kandidatensuche für die Zuordnung Zutat → Quell-ID (docs/PLAN-PHASE-5.md 19.3, Etappe N2b).
 *
 * Für Zutaten ohne Quell-ID listet der Workflow `foods-import` (Modus „kandidaten“) passende Zeilen der
 * Original-Datei – nur Quell-ID und Bezeichnung, keine Nährwerte. Ein Mensch (oder eine spätere Claude-Sitzung)
 * trägt die gewählte Quell-ID in die Zuordnungsdatei ein; erst danach importiert der Workflow die Werte.
 * Für Zutaten MIT Quell-ID meldet die Suche, wenn die Bezeichnung der Quelle keinen Suchbegriff enthält.
 * Zusätzlich gibt der Modus „kandidaten“ die vollständige Namensliste der Quelle (Quell-ID + Bezeichnung) ins
 * Actions-Log aus (`formatNameList`) – damit eine Claude-Sitzung ohne weiteren Lauf passende Einträge findet.
 */
import { normalizeFoodText } from '@fitnessapp/core';

import type { FoodMapping } from './mapping';
import type { SourceDefinition } from './sources';

export interface Candidate {
  readonly ref: string;
  readonly name: string;
}

export interface CandidateResult {
  readonly id: string;
  readonly search: readonly string[];
  readonly candidates: Candidate[];
}

export interface NameCheck {
  readonly id: string;
  readonly ref: string;
  /** Bezeichnung in der Quelle; null = Quell-ID nicht gefunden. */
  readonly sourceName: string | null;
}

/** Höchstens so viele Kandidaten je Zutat. */
export const MAX_CANDIDATES = 15;

/** Höchstlänge einer Bezeichnung im Bericht und in der Namensliste (Zeichen). */
export const MAX_SOURCE_NAME_LENGTH = 160;

/**
 * Bereinigt Text aus der Original-Datei für Bericht und Log: Steuerzeichen (inkl. Tab/Zeilenumbruch) und
 * unsichtbare Formatzeichen werden zu Leerzeichen, Leerraum zusammengefasst, Länge begrenzt („…“). Zusätzlich
 * werden „::“ (GitHub-Workflow-Kommandos wie `::stop-commands::`) und „===“ (Marker der Namensliste) entschärft
 * (Wächter-Prüfung Zuordnung S2/K2).
 */
export function cleanSourceText(value: string, max: number = MAX_SOURCE_NAME_LENGTH): string {
  const clean = value
    .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/:{2,}/g, (colons) => colons.split('').join(' '))
    .replace(/={3,}/g, (signs) => signs.split('').join(' '));
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Prüfregel für Quell-IDs aus `keyPattern` (muss mit ^ beginnen und mit $ enden, sonst Abbruch). */
export function sourceKeyRegex(def: Pick<SourceDefinition, 'keyPattern'>): RegExp {
  const pattern = (def as { keyPattern?: unknown }).keyPattern;
  if (typeof pattern !== 'string' || !pattern.startsWith('^') || !pattern.endsWith('$')) {
    throw new Error(
      'Quelldefinition ohne gültiges keyPattern (^…$) – keine Kandidaten/Namensliste.',
    );
  }
  return new RegExp(pattern);
}

/** Quell-ID einer Zeile, nur wenn sie dem Format der Quelle entspricht (sonst null = Zeile übergehen). */
function validKey(record: readonly string[], keyColumn: number, keyRegex: RegExp): string | null {
  const ref = (record[keyColumn] ?? '').trim();
  return keyRegex.test(ref) ? ref : null;
}

/** Trifft ein Suchbegriff (alle Wörter als Wortanfang/-teil) die Bezeichnung? */
export function matchesSearch(name: string, search: string): boolean {
  const haystack = normalizeFoodText(name);
  return normalizeFoodText(search)
    .split(' ')
    .filter((word) => word.length > 0)
    .every((word) => haystack.includes(word));
}

/** Wörter eines Suchbegriffs (normalisiert). */
function searchWords(search: string): string[] {
  return normalizeFoodText(search)
    .split(' ')
    .filter((word) => word.length > 0);
}

/** Mindestlänge eines Wortes, das bei einer Teil-Übereinstimmung zählt (sonst zu viele Zufallstreffer). */
const PARTIAL_MIN_WORD = 4;

/**
 * Stufe der Übereinstimmung (kleiner = besser, null = kein Treffer):
 * 0 = alle Wörter eines Suchbegriffs, jeweils am Wortanfang („Reis“ in „Reis Mehl“);
 * 1 = alle Wörter eines Suchbegriffs, mindestens eines nur im Wortinneren („Reis“ in „Erdbeereis“);
 * 2 = nur ein Teil der Wörter eines mehrteiligen Suchbegriffs, am Wortanfang (z. B. „Kokosmilch“ für
 *     „Kokosmilch fettreduziert“, wenn die Quelle keine fettreduzierte Variante hat).
 */
export function matchTier(name: string, search: readonly string[]): number | null {
  const haystack = normalizeFoodText(name);
  const nameWords = haystack.split(' ');
  const atStart = (word: string) => nameWords.some((w) => w.startsWith(word));
  let best: number | null = null;
  for (const term of search) {
    const words = searchWords(term);
    if (words.length === 0) {
      continue;
    }
    let tier: number | null = null;
    if (words.every((word) => haystack.includes(word))) {
      tier = words.every(atStart) ? 0 : 1;
    } else if (
      words.length > 1 &&
      words.some((word) => word.length >= PARTIAL_MIN_WORD && atStart(word))
    ) {
      tier = 2;
    }
    if (tier !== null && (best === null || tier < best)) {
      best = tier;
    }
  }
  return best;
}

/** Zubereitungs-Wörter (ganzes Wort): Treffer damit sind meist zubereitete Formen, nicht das Grundprodukt. */
const PREPARED_WORDS = new Set(
  [
    'mit',
    'gekocht',
    'gebraten',
    'gebacken',
    'gegrillt',
    'gedünstet',
    'gedämpft',
    'geschmort',
    'frittiert',
    'pochiert',
    'gratiniert',
    'überbacken',
    'paniert',
    'gefüllt',
    'zubereitet',
    'eis',
  ].map(normalizeFoodText),
);
/** Wortenden typischer Gerichte („Karottensuppe“, „Tomatensauce“, „Quarkauflauf“, „Honigkuchen“ …). */
const DISH_SUFFIXES = ['suppe', 'sauce', 'eintopf', 'auflauf', 'kuchen', 'torte', 'ragout'].map(
  normalizeFoodText,
);

/**
 * Heuristik „Grundprodukt vor Gericht“ (kleiner = eher Grundprodukt): 0 = Bezeichnung enthält das Wort „roh“;
 * 1 = neutral; 2 = Zubereitungs-Wort (gekocht, mit …), Gerichte-Endung (…suppe, …sauce …) oder BLS-Schlüssel der
 * Gerichte-Gruppen X/Y.
 */
export function preparationRank(name: string, ref: string): number {
  const words = normalizeFoodText(name).split(' ');
  if (words.includes('roh')) {
    return 0;
  }
  const prepared =
    /^[XY]/.test(ref) ||
    words.some((w) => PREPARED_WORDS.has(w) || DISH_SUFFIXES.some((suffix) => w.endsWith(suffix)));
  return prepared ? 2 : 1;
}

/**
 * Kandidaten (höchstens MAX_CANDIDATES). Reihenfolge: zuerst Treffer mit allen Wörtern eines Suchbegriffs
 * (Wortanfang vor Wortinnerem), dann Teil-Treffer; innerhalb einer Stufe Grundprodukt/„roh“ vor zubereitet,
 * dann kürzere Bezeichnung, dann alphabetisch. Bezeichnungen bereinigt (cleanSourceText).
 */
export function findCandidates(
  records: readonly (readonly string[])[],
  def: Pick<SourceDefinition, 'keyColumn' | 'keyPattern' | 'nameColumn'>,
  search: readonly string[],
): Candidate[] {
  const keyRegex = sourceKeyRegex(def);
  const found = new Map<string, Candidate & { tier: number; prep: number }>();
  for (const record of records.slice(1)) {
    const ref = validKey(record, def.keyColumn, keyRegex);
    if (ref === null || found.has(ref)) {
      continue;
    }
    const name = cleanSourceText(record[def.nameColumn] ?? '');
    const tier = matchTier(name, search);
    if (tier !== null) {
      found.set(ref, { ref, name, tier, prep: preparationRank(name, ref) });
    }
  }
  return [...found.values()]
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        a.prep - b.prep ||
        a.name.length - b.name.length ||
        a.name.localeCompare(b.name, 'de'),
    )
    .slice(0, MAX_CANDIDATES)
    .map(({ ref, name }) => ({ ref, name }));
}

/** Feste Marker der Namensliste im Actions-Log (Modus „kandidaten“), zum Ausschneiden aus dem Log. */
export function nameListMarkers(db: string): { begin: string; end: string } {
  const label = `${db.toUpperCase()}-NAMENSLISTE`;
  return { begin: `=== ${label} BEGINN ===`, end: `=== ${label} ENDE ===` };
}

export interface NameList {
  /** Text fürs Log (Marker + Zeilen). */
  readonly text: string;
  /** Ausgegebene Zeilen. */
  readonly written: number;
  /** Zeilen mit leerer oder abweichender Quell-ID (nicht ausgegeben, nur gezählt). */
  readonly skipped: number;
}

/**
 * Vollständige Namensliste der Quelle für das Actions-Log: je Zeile `Quell-ID<TAB>Bezeichnung`, Quell-ID im Format
 * der Quelle (`keyPattern`, sonst nur gezählt), Bezeichnung bereinigt wie die Kandidaten, eingerahmt von festen
 * Markern. NUR Schlüssel und Bezeichnung – nie Nährwerte.
 */
export function formatNameList(
  records: readonly (readonly string[])[],
  def: Pick<SourceDefinition, 'db' | 'keyColumn' | 'keyPattern' | 'nameColumn'>,
): NameList {
  const keyRegex = sourceKeyRegex(def);
  const { begin, end } = nameListMarkers(def.db);
  const lines = [begin];
  let skipped = 0;
  for (const record of records.slice(1)) {
    const ref = validKey(record, def.keyColumn, keyRegex);
    if (ref === null) {
      skipped += 1;
      continue;
    }
    lines.push(`${ref}\t${cleanSourceText(record[def.nameColumn] ?? '')}`);
  }
  lines.push(end);
  return { text: lines.join('\n'), written: lines.length - 2, skipped };
}

/** Kandidaten für alle Zutaten dieser Quelle ohne Quell-ID und Namensprüfung für die mit Quell-ID. */
export function mappingCandidates(
  mapping: FoodMapping,
  records: readonly (readonly string[])[],
  def: Pick<SourceDefinition, 'db' | 'version' | 'keyColumn' | 'keyPattern' | 'nameColumn'>,
): { open: CandidateResult[]; nameChecks: NameCheck[] } {
  const names = new Map<string, string>();
  for (const record of records.slice(1)) {
    names.set(record[def.keyColumn] ?? '', cleanSourceText(record[def.nameColumn] ?? ''));
  }
  const open: CandidateResult[] = [];
  const nameChecks: NameCheck[] = [];
  for (const item of mapping.items) {
    if (item.source.db !== def.db || item.source.version !== def.version) {
      continue;
    }
    if (item.source.ref === null) {
      open.push({
        id: item.food_id,
        search: item.source.search,
        candidates: findCandidates(records, def, item.source.search),
      });
      continue;
    }
    const sourceName = names.get(item.source.ref) ?? null;
    if (sourceName === null || !item.source.search.some((s) => matchesSearch(sourceName, s))) {
      nameChecks.push({ id: item.food_id, ref: item.source.ref, sourceName });
    }
  }
  return { open, nameChecks };
}

/** Bericht (Markdown) – nur IDs und Bezeichnungen der Quelle, keine Nährwerte. */
export function formatCandidates(result: {
  open: CandidateResult[];
  nameChecks: NameCheck[];
}): string {
  const esc = (value: string) => value.replace(/\|/g, '\\|');
  const lines = [
    '#### Zuordnung: Kandidaten aus der Quelle',
    '',
    `${result.open.length} Zutaten ohne Quell-ID. Gewählte Quell-ID in \`content/food-mapping/alpha5-zuordnung.json\` bzw. – für Lebensmittel aus „Auswärts essen“ – in \`content/food-mapping/auswaerts-zuordnung.json\` (Abschnitt \`foods\`) bei \`source.ref\` eintragen (Pull Request), danach Modus „import“.`,
    '',
  ];
  if (result.open.length > 0) {
    lines.push(
      '| Zutat | Suchbegriffe | Kandidaten (Quell-ID: Bezeichnung) |',
      '| --- | --- | --- |',
    );
    for (const item of result.open) {
      const candidates =
        item.candidates.length === 0
          ? '– keine –'
          : item.candidates.map((c) => `\`${esc(c.ref)}\`: ${esc(c.name)}`).join('<br>');
      lines.push(`| \`${item.id}\` | ${esc(item.search.join(' / '))} | ${candidates} |`);
    }
    lines.push('');
  }
  if (result.nameChecks.length > 0) {
    lines.push(
      '#### Zuordnung prüfen: Bezeichnung der Quelle enthält keinen Suchbegriff',
      '',
      '| Zutat | Quell-ID | Bezeichnung in der Quelle |',
      '| --- | --- | --- |',
      ...result.nameChecks.map(
        (c) =>
          `| \`${c.id}\` | \`${esc(c.ref)}\` | ${c.sourceName === null ? '– fehlt –' : esc(c.sourceName)} |`,
      ),
      '',
    );
  }
  return lines.join('\n');
}
