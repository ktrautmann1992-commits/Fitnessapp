import type { ContentRuleId } from './rules';
import type { SupplementContent } from './supplement-schema';
import { type SupplementContentFile, validateContent } from './validate';

/**
 * Freigabe von Supplement-Inhalten per ID (Workflow content-review, Art „ids“; docs/PLAN-PHASE-6.md 6 und 7, Etappe
 * SU3) – gleiche Logik wie Ernährungs-Inhalte per ID: Gesetzt wird `published` mit Prüfer und Datum nur für Entwürfe,
 * die im Stand NACH der Freigabe keinen roten Befund haben (SK1–SK7; bei „published“ blockiert jeder rote Befund).
 * Häkchen „fachlich geprüft“ setzt `meta.expert_reviewed` (ein gesetztes `true` bleibt). Version und Texte bleiben
 * gleich – Merge durch einen Menschen ist die Freigabe. Zurückziehen bzw. „zurück auf Entwurf“ folgen später (wie bei
 * Ernährungs-Inhalten).
 */

export type SupplementReleaseBlocker =
  /** Nicht (mehr) Entwurf – die Freigabe ändert nur Entwürfe. */
  | { readonly kind: 'not_draft'; readonly status: SupplementContent['status'] }
  /** Rote Befunde im Stand nach der Freigabe. */
  | {
      readonly kind: 'red_issues';
      readonly rules: readonly ContentRuleId[];
      readonly messages: readonly string[];
    };

export interface SupplementReleaseOptions {
  /** Prüfer (Name oder Kürzel). */
  readonly reviewer: string;
  /** Datum der Freigabe (ISO, Europe/Berlin). */
  readonly date: string;
  /** Häkchen „fachlich geprüft“. */
  readonly expertReviewed: boolean;
}

export interface SupplementReleaseDecision {
  readonly original: SupplementContent;
  readonly released: SupplementContent;
  readonly blockers: readonly SupplementReleaseBlocker[];
}

export interface SupplementReleasePlan {
  /** Je gefundener ID in der Reihenfolge der Eingabe. */
  readonly decisions: readonly SupplementReleaseDecision[];
  /** IDs ohne gültigen Supplement-Inhalt (Schema-Fehler zählen als „nicht gefunden“ – SK1 steht im Prüfbericht). */
  readonly unknownIds: readonly string[];
}

/** Stand NACH der Freigabe: Status, Prüfer, Datum, ggf. „fachlich geprüft“. */
export function releasedSupplement(
  entry: SupplementContent,
  options: SupplementReleaseOptions,
): SupplementContent {
  return {
    ...entry,
    status: 'published',
    meta: {
      ...entry.meta,
      reviewed_by: options.reviewer,
      reviewed_at: options.date,
      expert_reviewed: entry.meta.expert_reviewed || options.expertReviewed,
    },
  };
}

/** Kurztext eines Grundes (Pull-Request-Text). */
export function supplementReleaseBlockerText(blocker: SupplementReleaseBlocker): string {
  switch (blocker.kind) {
    case 'not_draft':
      return blocker.status === 'published' ? 'schon freigegeben' : 'zurückgezogen (bleibt so)';
    case 'red_issues':
      return `rote Befunde: ${blocker.rules.join(', ')}`;
  }
}

export function planSupplementRelease(
  files: readonly SupplementContentFile[],
  ids: readonly string[],
  options: SupplementReleaseOptions,
): SupplementReleasePlan {
  const before = validateContent(files);
  const byId = new Map(before.supplements.map((entry) => [entry.id, entry]));
  const wanted = [...new Set(ids)];
  const unknownIds = wanted.filter((id) => !byId.has(id));
  const found = wanted.flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [entry] : [];
  });
  const releasedById = new Map(
    found
      .filter((entry) => entry.status === 'draft')
      .map((entry) => [entry.id, releasedSupplement(entry, options)]),
  );
  const after = validateContent(
    files.map((file) => {
      const id = (file.data as { id?: unknown } | undefined)?.id;
      const released = typeof id === 'string' ? releasedById.get(id) : undefined;
      return released === undefined ? file : { ...file, data: released };
    }),
  );
  const decisions = found.map((original): SupplementReleaseDecision => {
    const released = releasedById.get(original.id);
    if (released === undefined) {
      return {
        original,
        released: original,
        blockers: [{ kind: 'not_draft', status: original.status }],
      };
    }
    const red = after.issues.filter(
      (issue) =>
        issue.kind === 'supplement' && issue.id === original.id && issue.severity === 'error',
    );
    return {
      original,
      released,
      blockers:
        red.length === 0
          ? []
          : [
              {
                kind: 'red_issues',
                rules: [...new Set(red.map((issue) => issue.rule))],
                messages: red.map((issue) => `${issue.rule}: ${issue.message}`),
              },
            ],
    };
  });
  return { decisions, unknownIds };
}
