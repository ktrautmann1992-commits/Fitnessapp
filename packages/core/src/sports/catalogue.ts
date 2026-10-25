import { SPORT_CATALOGUE, SPORT_INTENSITY, type SportDefinition } from '../constants';
import { SPORT_CATEGORIES, SPORT_IDS, type SportCategory, type SportId } from '../enums';

/**
 * Sportarten Stufe 2 (docs/PLAN-SPORTARTEN.md): Katalog lesen, suchen, gruppieren, zuletzt genutzte und MET je
 * Anstrengung. Rein, ohne Speicher- oder Netzzugriff.
 */

export function isSportId(value: unknown): value is SportId {
  return typeof value === 'string' && (SPORT_IDS as readonly string[]).includes(value);
}

export function sportDefinition(sport: SportId): SportDefinition {
  return SPORT_CATALOGUE[sport];
}

export function sportName(sport: SportId): string {
  return SPORT_CATALOGUE[sport].nameDe;
}

/** Sportart zum Namen im Tagebuch (feste Liste); unbekannt → null. */
export function sportByName(nameDe: string): SportId | null {
  return SPORT_IDS.find((id) => SPORT_CATALOGUE[id].nameDe === nameDe) ?? null;
}

/** Sportarten mit GPS-Aufzeichnung (Skilanglauf, Skitour, Inline-Skaten, SUP, Kajak/Kanu). */
export function gpsSports(): SportId[] {
  return SPORT_IDS.filter((id) => SPORT_CATALOGUE[id].gps);
}

/** Klein, ohne Akzente/Umlaute-Varianten („Fußball“ = „fussball“), ohne doppelte Leerzeichen. */
export function normalizeSportQuery(text: string): string {
  return text
    .toLocaleLowerCase('de-DE')
    .replaceAll('ß', 'ss')
    .replaceAll('ä', 'a')
    .replaceAll('ö', 'o')
    .replaceAll('ü', 'u')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Suche im Katalog: Name oder Suchbegriff enthält die Eingabe (Groß-/Kleinschreibung, ß/Umlaute egal). Treffer am
 * Namensanfang zuerst, dann Katalog-Reihenfolge. Leere Eingabe → alle. `onlyGps` = nur GPS-Sportarten.
 */
export function searchSports(
  query: string,
  options: { readonly onlyGps?: boolean } = {},
): SportId[] {
  const q = normalizeSportQuery(query);
  const pool = SPORT_IDS.filter((id) => !options.onlyGps || SPORT_CATALOGUE[id].gps);
  if (q === '') return [...pool];
  const scored = pool.flatMap((id) => {
    const def = SPORT_CATALOGUE[id];
    const name = normalizeSportQuery(def.nameDe);
    if (name.startsWith(q)) return [{ id, score: 0 }];
    if (name.includes(q)) return [{ id, score: 1 }];
    const terms = def.searchTerms.map(normalizeSportQuery);
    if (terms.some((t) => t.startsWith(q))) return [{ id, score: 2 }];
    if (terms.some((t) => t.includes(q))) return [{ id, score: 3 }];
    return [];
  });
  return scored
    .sort((a, b) => a.score - b.score || SPORT_IDS.indexOf(a.id) - SPORT_IDS.indexOf(b.id))
    .map((x) => x.id);
}

export interface SportGroup {
  readonly category: SportCategory;
  readonly sports: readonly SportId[];
}

/** Sportarten nach Gruppe (Reihenfolge SPORT_CATEGORIES, darin Katalog-Reihenfolge); leere Gruppen fehlen. */
export function sportsByCategory(sports: readonly SportId[] = SPORT_IDS): SportGroup[] {
  return SPORT_CATEGORIES.flatMap((category) => {
    const inGroup = SPORT_IDS.filter(
      (id) => sports.includes(id) && SPORT_CATALOGUE[id].category === category,
    );
    return inGroup.length > 0 ? [{ category, sports: inGroup }] : [];
  });
}

/**
 * Zuletzt genutzte Sportarten aus dem Tagebuch: neueste zuerst (Datum, dann Erstellung), jede einmal, höchstens
 * `limit`. `onlyGps` = nur GPS-Sportarten.
 */
export function recentSports(
  logs: readonly {
    readonly sport: SportId | null;
    readonly performed_on: string;
    readonly created_at?: string;
  }[],
  options: { readonly limit?: number; readonly onlyGps?: boolean } = {},
): SportId[] {
  const limit = options.limit ?? 4;
  const sorted = logs
    .filter((l): l is typeof l & { sport: SportId } => l.sport !== null && isSportId(l.sport))
    .filter((l) => !options.onlyGps || SPORT_CATALOGUE[l.sport].gps)
    .slice()
    .sort((a, b) =>
      a.performed_on !== b.performed_on
        ? a.performed_on < b.performed_on
          ? 1
          : -1
        : (b.created_at ?? '').localeCompare(a.created_at ?? ''),
    );
  const out: SportId[] = [];
  for (const log of sorted) {
    if (!out.includes(log.sport)) out.push(log.sport);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * MET einer Sportart bei Anstrengung 0–10 (SPORT_INTENSITY): bis lowEffortMax `met.low`, ab highEffortMin `met.high`,
 * dazwischen linear (auf 0,1 gerundet). null = keine Angabe → `met.high` (wie TRAINING_MET.fallback).
 */
export function sportMet(sport: SportId, effort: number | null): number {
  const { low, high } = SPORT_CATALOGUE[sport].met;
  if (effort === null || !Number.isFinite(effort)) return high;
  const { lowEffortMax, highEffortMin } = SPORT_INTENSITY;
  if (effort <= lowEffortMax) return low;
  if (effort >= highEffortMin) return high;
  const share = (effort - lowEffortMax) / (highEffortMin - lowEffortMax);
  return Math.round((low + (high - low) * share) * 10) / 10;
}
