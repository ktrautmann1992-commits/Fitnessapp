/**
 * Auswahl aus der Matrix (Workflow-Eingabe „auswahl“), z. B. `muscle_gain, einsteiger, 30-45` oder `alle`.
 * Begriffe aus derselben Achse sind ODER-verknüpft, verschiedene Achsen UND-verknüpft.
 */
import type { ContentKindDefinition, GenerationCell, LibraryContext } from './kinds';

export type Selection = ReadonlyMap<string, ReadonlySet<string>>;

const ALL_WORDS = new Set(['', 'alle', 'all', '*']);

export function parseSelection(kind: ContentKindDefinition, raw: string): Selection {
  const tokens = raw
    .split(/[\s,;]+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);
  const selection = new Map<string, Set<string>>();
  if (tokens.every((token) => ALL_WORDS.has(token))) {
    return selection;
  }
  for (const token of tokens) {
    if (ALL_WORDS.has(token)) {
      continue;
    }
    const matches = kind.dimensions.flatMap((dimension) =>
      dimension.values
        .filter((value) => value.value === token || value.aliases.includes(token))
        .map((value) => ({ dimension: dimension.key, value: value.value })),
    );
    if (matches.length === 0) {
      const allowed = kind.dimensions
        .map(
          (dimension) =>
            `${dimension.labelDe}: ${dimension.values.map((value) => value.value).join(', ')}`,
        )
        .join(' · ');
      throw new Error(`Auswahl: „${token}“ ist unbekannt. Erlaubt: ${allowed} (oder „alle“).`);
    }
    for (const match of matches) {
      const set = selection.get(match.dimension) ?? new Set<string>();
      set.add(match.value);
      selection.set(match.dimension, set);
    }
  }
  return selection;
}

export function matchesSelection(cell: GenerationCell, selection: Selection): boolean {
  for (const [dimension, values] of selection) {
    const value = cell.values[dimension];
    if (value === undefined || !values.has(value)) {
      return false;
    }
  }
  return true;
}

export interface PlannedCells {
  /** Zellen, die angefragt werden (höchstens `count`). */
  readonly cells: GenerationCell[];
  /** Ausgewählte Zellen, die schon existieren (übersprungen). */
  readonly present: GenerationCell[];
  /** Ausgewählte, fehlende Zellen, die wegen `count` nicht angefragt werden. */
  readonly deferred: number;
}

/** Ausgewählte Zellen ohne vorhandene Inhalte, gekürzt auf `count`. */
export function planCells(
  kind: ContentKindDefinition,
  context: LibraryContext,
  selection: Selection,
  count: number,
): PlannedCells {
  const selected = kind.cells(context).filter((cell) => matchesSelection(cell, selection));
  const present = selected.filter((cell) => kind.isPresent(cell, context));
  const missing = selected.filter((cell) => !kind.isPresent(cell, context));
  return {
    cells: missing.slice(0, count),
    present,
    deferred: Math.max(0, missing.length - count),
  };
}
