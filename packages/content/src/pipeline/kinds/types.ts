/**
 * „Inhaltsarten“ der Content-Pipeline (docs/PLAN-PHASE-2.md Abschnitt 5, Punkt 9).
 *
 * Jede Art bringt mit: Ordner, Höchstlänge der Antwort (max_tokens), Auswahl-Matrix, Anfrage-Texte, das
 * Zod-Schema der Antwort (daraus das JSON-Schema für Structured Outputs) und die Abbildung „Antwort → Datei“.
 * Plausibilitäts-Checks und Seed-Abbildung kommen aus packages/core bzw. seed-package.ts.
 * Rezepte (Phase 5) werden eine weitere Art – ohne Umbau von generate/collect/review.
 */
import type { ContentFileKind, Exercise, PlanTemplate } from '@fitnessapp/core';
import type { z } from 'zod';

/** Was die Pipeline über den aktuellen Inhaltsstand weiß (aus `content/`). */
export interface LibraryContext {
  /** Übungen mit gültigem Schema (alle Status). */
  readonly exercises: readonly Exercise[];
  /** Plan-Vorlagen mit gültigem Schema (alle Status). */
  readonly templates: readonly PlanTemplate[];
  /** Belegte IDs (Dateinamen ohne `.json`) je Art – auch von Dateien mit Fehlern. */
  readonly takenIds: Readonly<Record<ContentFileKind, ReadonlySet<string>>>;
}

/** Eine Achse der Auswahl-Matrix (z. B. Ziel, Level, Bewegungsmuster). */
export interface SelectionDimension {
  readonly key: string;
  /** Anzeige im Bericht, z. B. „Ziel“. */
  readonly labelDe: string;
  readonly values: readonly { readonly value: string; readonly aliases: readonly string[] }[];
}

/** Eine Zelle der Matrix = eine Anfrage im Batch. */
export interface GenerationCell {
  /** Eindeutige, kurze ID im Batch (nur a–z, A–Z, 0–9, _ und -; höchstens 64 Zeichen). */
  readonly customId: string;
  /** Feste Inhalts-ID, falls die Art sie vorgibt (Vorlagen); null = das Modell wählt sie (Übungen). */
  readonly targetId: string | null;
  /** Kurzbeschreibung für Berichte, z. B. „Muskelaufbau · Einsteiger · 3 Tage · Studio · 30–45 min“. */
  readonly label: string;
  /** Werte je Achse (Schlüssel = SelectionDimension.key). */
  readonly values: Readonly<Record<string, string>>;
}

/** Fest hinterlegte Antwort für den Probelauf (ohne KI). */
export type DryRunResponse =
  | { readonly kind: 'json'; readonly data: unknown }
  | { readonly kind: 'refusal' }
  | { readonly kind: 'max_tokens' }
  | { readonly kind: 'errored' };

export interface DryRunFixture {
  readonly cell: GenerationCell;
  readonly response: DryRunResponse;
}

export interface ContentKindDefinition {
  readonly kind: ContentFileKind;
  /** Name in der Workflow-Eingabe, z. B. `exercises`. */
  readonly inputName: string;
  readonly labelDe: string;
  /** Ordner unter `content/`. */
  readonly folder: string;
  /** Höchstlänge der Antwort (inkl. Denk-Token), fest im Code (Plan Abschnitt 10). */
  readonly maxTokens: number;
  readonly dimensions: readonly SelectionDimension[];
  /** Alle Zellen der Matrix in fester Reihenfolge. */
  cells(context: LibraryContext): GenerationCell[];
  /** true = Zelle wird übersprungen, weil der Inhalt schon existiert. */
  isPresent(cell: GenerationCell, context: LibraryContext): boolean;
  /** System-Text (für alle Anfragen eines Laufs gleich). */
  systemPrompt(context: LibraryContext): string;
  /** Anfrage-Text je Zelle. */
  userPrompt(cell: GenerationCell, context: LibraryContext): string;
  /** Vollständiges Datei-Schema (Regel Ü1) aus packages/core. */
  readonly contentSchema: z.ZodType;
  /** Zod-Schema der Modell-Antwort (ohne status, version, meta). */
  outputSchema(cell: GenerationCell, context: LibraryContext): z.ZodType;
  /** Vollständiger Inhalt (Dateiformat) aus geprüfter Antwort + Herkunft. */
  toContent(
    output: unknown,
    cell: GenerationCell,
    meta: Record<string, unknown>,
  ): {
    id: string;
    content: Record<string, unknown>;
  };
  /** Feste Beispiel-Antworten für den Probelauf. */
  dryRunFixtures(): DryRunFixture[];
}
