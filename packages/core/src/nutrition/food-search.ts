import { FOOD_HOUSEHOLD_LIMITS } from '../constants';
import { normalizeFoodText } from '../content/allergen-rules';
import type { Food } from '../content/food-schema';
import { FOOD_KEYWORD_GROUPS, type FoodKeywordGroup } from './food-household-table';

/**
 * Lebensmittel-Suche beim Eintragen (Gründer-Rückmeldung 14.11.2026): „Käse“ findet alle Käse, „Brot“ alle Brote,
 * „kase“ findet „Käse“, „Gauda“ findet „Gouda“. Reine Logik, deterministisch, ohne KI.
 *
 * Rang (kleiner = weiter oben), danach alphabetisch:
 * 0 Name beginnt mit der Eingabe · 1 ein Wort im Namen beginnt damit · 2 Suchbegriff (Alias) beginnt damit bzw. ein
 * Wort darin · 3 Lebensmittel-Art passt („Käse“ → Gouda) · 4 Eingabe steckt mitten im Namen/Alias (ab 3 Zeichen) ·
 * 5 leichter Tippfehler (ab 5 Zeichen, 1 Abweichung, ab 8 Zeichen 2) – nur, wenn es weniger als 3 andere Treffer gibt.
 *
 * Vergleich „locker“: wie `normalizeFoodText` (klein, ä→ae, ß→ss, ohne Akzente) und zusätzlich ae→a, oe→o, ue→u,
 * ss→s – so finden „kase“, „kaese“ und „Käse“ dasselbe.
 */

/** Lockere Form für den Vergleich (siehe oben). */
export function looseFoodText(value: string): string {
  return normalizeFoodText(value)
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
    .replace(/ss/g, 's');
}

/** true = a und b unterscheiden sich um höchstens `max` Zeichen (Einfügen, Löschen, Ersetzen; Levenshtein). */
export function withinEditDistance(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      row.push(value);
      best = Math.min(best, value);
    }
    if (best > max) return false;
    prev = row;
  }
  return (prev[b.length] ?? Infinity) <= max;
}

const S = FOOD_HOUSEHOLD_LIMITS;

function fuzzyMax(query: string): number {
  if (query.length < S.fuzzyMinChars) return -1;
  return query.length >= S.fuzzyTwoFrom ? 2 : 1;
}

/** Wörter einer lockeren Form (Leerzeichen und Bindestrich trennen). */
function words(text: string): string[] {
  return text.split(/[\s-]+/).filter((w) => w.length > 0);
}

/** Tippfehler: ein Wort (bzw. dessen Anfang in Länge der Eingabe) liegt nah an der Eingabe. */
function fuzzyHit(text: string, query: string): boolean {
  const max = fuzzyMax(query);
  if (max < 0) return false;
  return words(text).some(
    (word) =>
      withinEditDistance(word, query, max) ||
      (word.length > query.length && withinEditDistance(word.slice(0, query.length), query, max)),
  );
}

/** Rang einer lockeren Bezeichnung: 0 Anfang, 1 Wortanfang, 2 im Wort, null = kein Treffer. */
function textRank(text: string, query: string): 0 | 1 | 2 | null {
  const at = text.indexOf(query);
  if (at < 0) return null;
  if (at === 0) return 0;
  const before = text[at - 1];
  return before === ' ' || before === '-' ? 1 : 2;
}

/** true = das Lebensmittel gehört zur Art (siehe `FoodKeywordGroup`). */
export function foodInKeywordGroup(
  food: Pick<Food, 'id' | 'name_de' | 'source'>,
  group: FoodKeywordGroup,
): boolean {
  if (group.excludeIds?.includes(food.id) === true) return false;
  if (group.ids?.includes(food.id) === true) return true;
  if (group.categories === undefined || !group.categories.includes(food.source.category)) {
    return false;
  }
  if (group.nameWords === undefined) return true;
  const name = normalizeFoodText(food.name_de);
  return group.nameWords.some((word) => name.includes(word));
}

/** Arten, zu denen ein Lebensmittel gehört (Reihenfolge wie `FOOD_KEYWORD_GROUPS`). */
export function foodKeywordGroups(
  food: Pick<Food, 'id' | 'name_de' | 'source'>,
): FoodKeywordGroup[] {
  return FOOD_KEYWORD_GROUPS.filter((group) => foodInKeywordGroup(food, group));
}

/** Arten, deren Suchbegriff zur Eingabe passt (ab 3 Zeichen; Anfang des Begriffs oder leichter Tippfehler). */
export function keywordGroupsForQuery(query: string): FoodKeywordGroup[] {
  const q = looseFoodText(query);
  if (q.length < S.groupMinChars) return [];
  return FOOD_KEYWORD_GROUPS.filter((group) =>
    group.terms.some((term) => {
      const t = looseFoodText(term);
      return t.startsWith(q) || fuzzyHit(t, q);
    }),
  );
}

/**
 * Rang eines Lebensmittels für die Eingabe (siehe Kopf), null = kein Treffer. `groups` = Ergebnis von
 * `keywordGroupsForQuery` (einmal je Eingabe gerechnet).
 */
export function foodSearchRank(
  food: Pick<Food, 'id' | 'name_de' | 'aliases_de' | 'source'>,
  query: string,
  groups: readonly FoodKeywordGroup[] = keywordGroupsForQuery(query),
): number | null {
  const q = looseFoodText(query);
  if (q.length === 0) return null;
  const name = looseFoodText(food.name_de);
  const aliases = food.aliases_de.map(looseFoodText);
  const nameRank = textRank(name, q);
  if (nameRank === 0 || nameRank === 1) return nameRank;
  const aliasRanks = aliases.map((a) => textRank(a, q));
  if (aliasRanks.some((r) => r === 0 || r === 1)) return 2;
  if (groups.some((group) => foodInKeywordGroup(food, group))) return 3;
  // Mitten im Wort erst ab 3 Zeichen („Ei“ soll nicht „Reis“ und „Heidelbeeren“ finden).
  if (q.length >= S.groupMinChars && (nameRank === 2 || aliasRanks.some((r) => r === 2))) return 4;
  if ([name, ...aliases].some((text) => fuzzyHit(text, q))) return 5;
  return null;
}

/**
 * Lebensmittel zur Eingabe, beste zuerst (Rang, dann Name alphabetisch, dann id), höchstens `max`. Ohne Eingabe bzw.
 * unter `minChars` Zeichen leer.
 */
export function searchFoods<T extends Pick<Food, 'id' | 'name_de' | 'aliases_de' | 'source'>>(
  foods: Iterable<T>,
  query: string,
  options: { readonly minChars: number; readonly max: number },
): T[] {
  const q = looseFoodText(query);
  if (q.length < options.minChars) return [];
  const groups = keywordGroupsForQuery(query);
  const hits: { food: T; rank: number }[] = [];
  for (const food of foods) {
    const rank = foodSearchRank(food, query, groups);
    if (rank !== null) hits.push({ food, rank });
  }
  // Tippfehler-Treffer (Rang 5) nur, wenn es kaum echte Treffer gibt („Milch“ soll nicht „Mischung“ zeigen).
  const exact = hits.filter((hit) => hit.rank < 5).length;
  return hits
    .filter((hit) => hit.rank < 5 || exact < S.fuzzyOnlyBelow)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.food.name_de.localeCompare(b.food.name_de, 'de') ||
        (a.food.id < b.food.id ? -1 : a.food.id > b.food.id ? 1 : 0),
    )
    .slice(0, options.max)
    .map((hit) => hit.food);
}
