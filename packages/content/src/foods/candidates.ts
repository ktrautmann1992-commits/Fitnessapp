/**
 * Kandidatensuche für die Zuordnung Zutat → Quell-ID (docs/PLAN-PHASE-5.md 19.3, Etappe N2b).
 *
 * Für Zutaten ohne Quell-ID listet der Workflow `foods-import` (Modus „kandidaten“) passende Zeilen der
 * Original-Datei – nur Quell-ID und Bezeichnung, keine Nährwerte. Ein Mensch (oder eine spätere Claude-Sitzung)
 * trägt die gewählte Quell-ID in die Zuordnungsdatei ein; erst danach importiert der Workflow die Werte.
 * Für Zutaten MIT Quell-ID meldet die Suche, wenn die Bezeichnung der Quelle keinen Suchbegriff enthält.
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
export const MAX_CANDIDATES = 8;

/** Trifft ein Suchbegriff (alle Wörter als Wortanfang/-teil) die Bezeichnung? */
export function matchesSearch(name: string, search: string): boolean {
  const haystack = normalizeFoodText(name);
  return normalizeFoodText(search)
    .split(' ')
    .filter((word) => word.length > 0)
    .every((word) => haystack.includes(word));
}

/** Kandidaten (alle Suchbegriffe, kürzeste Bezeichnung zuerst – meist das Grundlebensmittel). */
export function findCandidates(
  records: readonly (readonly string[])[],
  def: Pick<SourceDefinition, 'keyColumn' | 'nameColumn'>,
  search: readonly string[],
): Candidate[] {
  const found = new Map<string, Candidate>();
  for (const record of records.slice(1)) {
    const ref = record[def.keyColumn] ?? '';
    const name = record[def.nameColumn] ?? '';
    if (ref === '' || found.has(ref)) {
      continue;
    }
    if (search.some((term) => matchesSearch(name, term))) {
      found.set(ref, { ref, name });
    }
  }
  return [...found.values()]
    .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name, 'de'))
    .slice(0, MAX_CANDIDATES);
}

/** Kandidaten für alle Zutaten dieser Quelle ohne Quell-ID und Namensprüfung für die mit Quell-ID. */
export function mappingCandidates(
  mapping: FoodMapping,
  records: readonly (readonly string[])[],
  def: Pick<SourceDefinition, 'db' | 'version' | 'keyColumn' | 'nameColumn'>,
): { open: CandidateResult[]; nameChecks: NameCheck[] } {
  const names = new Map<string, string>();
  for (const record of records.slice(1)) {
    names.set(record[def.keyColumn] ?? '', record[def.nameColumn] ?? '');
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
    `${result.open.length} Zutaten ohne Quell-ID. Gewählte Quell-ID in \`content/food-mapping/alpha5-zuordnung.json\` bei \`source.ref\` eintragen (Pull Request), danach Modus „import“.`,
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
