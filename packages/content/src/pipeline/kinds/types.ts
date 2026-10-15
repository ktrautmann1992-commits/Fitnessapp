/**
 * „Inhaltsarten“ der Content-Pipeline (docs/PLAN-PHASE-2.md Abschnitt 5, Punkt 9).
 *
 * Jede Art bringt mit: Ordner, Höchstzahl Ausgabe-Token, Auswahl-Matrix, Anfrage-Texte, das Zod-Schema der
 * Antwort (daraus das JSON-Schema der strukturierten Ausgabe) und die Abbildung „Antwort → Datei“.
 * Plausibilitäts-Checks und Seed-Abbildung kommen aus packages/core bzw. seed-package.ts.
 * Seit Etappe N9 gibt es die Austausch-Tabelle (`ingredient_substitution`, docs/PLAN-PHASE-5.md 19.7) als erste
 * Ernährungs-Art; eine Antwort kann dort mehrere Dateien ergeben (`toContents`). Seit N11 auch die Packungsgrößen
 * (`package_size`), seit N8 die Rezepte (`recipe`) – ohne Umbau von generate/collect/review.
 */
import type {
  ContentFileKind,
  Exercise,
  Food,
  IngredientSubstitution,
  PackageSize,
  PlanTemplate,
  Recipe,
} from '@fitnessapp/core';
import type { z } from 'zod';

import type { ContentEffort } from '../config';

/** Inhaltsarten der Pipeline: Training (Phase 2), Austausch-Tabelle (N9), Packungsgrößen (N11), Rezepte (N8). */
export type PipelineContentKind =
  ContentFileKind | 'ingredient_substitution' | 'package_size' | 'recipe';

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
  /** Packungsgrößen mit gültigem Schema (alle Status, N11). */
  readonly packageSizes: readonly PackageSize[];
  /** Rezepte mit gültigem Schema (alle Status, N8) – damit neue Rezepte nichts wiederholen. */
  readonly recipes: readonly Recipe[];
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
  /**
   * Standard-Gemini-Modell dieser Art (Gründer-Vorgabe 15.10.2026: so günstig wie für die Art sinnvoll); Workflow-
   * Eingabe „modell“ bzw. GitHub-Variable CONTENT_MODEL gehen vor.
   */
  readonly defaultModel: string;
  /** Standard-Denktiefe dieser Art (so niedrig wie sinnvoll); GitHub-Variable CONTENT_EFFORT geht vor. */
  readonly defaultEffort: ContentEffort;
  /** Höchstzahl Ausgabe-Token je Antwort (inkl. Denk-Token, Gemini `maxOutputTokens`), fest im Code. */
  readonly maxTokens: number;
  readonly dimensions: readonly SelectionDimension[];
  /** Alle Zellen der Matrix in fester Reihenfolge. */
  cells(context: LibraryContext): GenerationCell[];
  /** true = Zelle wird übersprungen, weil der Inhalt schon existiert. */
  isPresent(cell: GenerationCell, context: LibraryContext): boolean;
  /**
   * Grund, warum diese Art gerade nicht erzeugt werden kann (z. B. Rezepte ohne katalog-geprüfte Lebensmittel);
   * null/fehlt = möglich. Gilt nur für echte Läufe (der Probelauf braucht keinen Katalog).
   */
  unavailableReason?(context: LibraryContext): string | null;
  /** Hinweis zur Reihenfolge der Zellen für die Zusammenfassung echter Läufe (z. B. Rotation bei Rezepten). */
  selectionNote?(context: LibraryContext): string;
  /** System-Text (für alle Anfragen eines Laufs gleich). */
  systemPrompt(context: LibraryContext): string;
  /** Anfrage-Text je Zelle. */
  userPrompt(cell: GenerationCell, context: LibraryContext): string;
  /** Vollständiges Datei-Schema (Regel Ü1) aus packages/core. */
  readonly contentSchema: z.ZodType;
  /** Zod-Schema der Modell-Antwort (ohne status, version, meta); daraus das JSON-Schema der strukturierten Ausgabe. */
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
