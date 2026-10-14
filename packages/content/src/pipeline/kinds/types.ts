/**
 * „Inhaltsarten“ der Content-Pipeline (docs/PLAN-PHASE-2.md Abschnitt 5, Punkt 9).
 *
 * Jede Art bringt mit: Ordner, Höchstlänge der Antwort (max_tokens), Auswahl-Matrix, Anfrage-Texte, das
 * Zod-Schema der Antwort (daraus das JSON-Schema für Structured Outputs) und die Abbildung „Antwort → Datei“.
 * Plausibilitäts-Checks und Seed-Abbildung kommen aus packages/core bzw. seed-package.ts.
 * Rezepte (Phase 5) werden eine weitere Art – ohne Umbau von generate/collect/review. Seit Etappe N9 gibt es die
 * Austausch-Tabelle (`ingredient_substitution`, docs/PLAN-PHASE-5.md 19.7) als erste Ernährungs-Art; eine Antwort
 * kann dort mehrere Dateien ergeben (`toContents`).
 */
import type {
  ContentFileKind,
  Exercise,
  Food,
  IngredientSubstitution,
  PlanTemplate,
} from '@fitnessapp/core';
import type { z } from 'zod';

/** Inhaltsarten der Pipeline: Training (Phase 2) und die Austausch-Tabelle (Phase 5, N9). */
export type PipelineContentKind = ContentFileKind | 'ingredient_substitution';

/** Was die Pipeline über den aktuellen Inhaltsstand weiß (aus `content/`). */
export interface LibraryContext {
  /** Übungen mit gültigem Schema (alle Status). */
  readonly exercises: readonly Exercise[];
  /** Plan-Vorlagen mit gültigem Schema (alle Status). */
  readonly templates: readonly PlanTemplate[];
  /** Lebensmittel mit gültigem Schema, nicht zurückgezogen und katalog-geprüft (R19) – für Katalog-IDs. */
  readonly foods: readonly Food[];
  /** Austausch-Tabelle mit gültigem Schema (alle Status). */
  readonly substitutions: readonly IngredientSubstitution[];
  /** Belegte IDs (Dateinamen ohne `.json`) je Art – auch von Dateien mit Fehlern. */
  readonly takenIds: Readonly<Record<PipelineContentKind, ReadonlySet<string>>>;
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
  readonly kind: PipelineContentKind;
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
  /** Vollständige Inhalte (Dateiformat) aus geprüfter Antwort + Herkunft – eine oder mehrere Dateien je Antwort. */
  toContents(
    output: unknown,
    cell: GenerationCell,
    meta: Record<string, unknown>,
  ): {
    id: string;
    content: Record<string, unknown>;
  }[];
  /** Feste Beispiel-Antworten für den Probelauf. */
  dryRunFixtures(): DryRunFixture[];
}
