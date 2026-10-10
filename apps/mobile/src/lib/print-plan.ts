import {
  buildTrainingPlanDocument,
  displaySwapRules,
  type PlanLibrary,
  type PlanSafetyRules,
  PRINT_EXPORT,
  trainingPlanExportOptionsSchema,
  type TrainingPlanExportOptionsInput,
} from '@fitnessapp/core';
import { renderPrintHtml } from '@fitnessapp/ui/print';

import { preferencesFromRows } from '@/data/exercise-swap';
import { type ActivePlan, planSnapshot, profilesFor, startGroupOf } from '@/data/training-plan';
import type { UserRows } from '@/data/types';
import { t } from '@/i18n';

import { translatePrintDocument } from './print-document';

/**
 * Plan als PDF (docs/PLAN-PDF-EXPORT.md §6, P3/P4): verbindet den gespeicherten Plan mit dem Dokumentmodell aus
 * packages/core, der Übersetzung (B11) und dem HTML-Renderer aus packages/ui. Keine Fachlogik – nur Zusammenstecken
 * mit DENSELBEN Anzeige-Regeln wie „Heute“ (prepareSessionForDisplay läuft im Core).
 *
 * Datenschutz: Das Ergebnis bleibt im Speicher; es wird nie geloggt, gespeichert oder hochgeladen.
 */

/** Wo gedruckt wird: Web (Druckansicht, gemischtes Hoch-/Querformat) oder nativ (expo-print, nur hochkant). */
export type PrintTarget = 'web' | 'native';

/** Einstellungen aus der Druckansicht (nichts davon wird gespeichert). */
export interface PrintFormState {
  readonly includeName: boolean;
  readonly name: string;
  /** Leere Mitschreib-Spalten; > 4 nur quer (B9). */
  readonly logColumns: number;
}

export const DEFAULT_PRINT_FORM: PrintFormState = {
  includeName: false,
  name: '',
  logColumns: PRINT_EXPORT.defaultLogColumns,
};

export interface LogColumnChoice {
  readonly value: number;
  readonly label: string;
  readonly description?: string;
}

/**
 * Auswahl der Mitschreib-Spalten. Querformat (8 Spalten) nur im Web: Nativ rendert expo-print das HTML auf
 * EINE feste Seitengröße (595 × 842, WKWebView bzw. Android-WebView) – gemischte Ausrichtung je Seite
 * (`@page quer`) wird dort nicht unterstützt (P4-Prüfung, siehe docs/PLAN-PDF-EXPORT.md §13).
 */
export function logColumnChoices(target: PrintTarget): LogColumnChoice[] {
  const p = t.printView;
  const portrait: LogColumnChoice[] = [0, 2, PRINT_EXPORT.maxLogColumnsPortrait].map((value) => ({
    value,
    label: value === 0 ? p.columnsNone : p.columnsCount(value),
    ...(value === PRINT_EXPORT.defaultLogColumns ? { description: p.columnsDefault } : {}),
  }));
  if (target === 'native') return portrait;
  return [
    ...portrait,
    {
      value: PRINT_EXPORT.maxLogColumnsLandscape,
      label: p.columnsLandscape(PRINT_EXPORT.maxLogColumnsLandscape),
      description: p.columnsLandscapeHint,
    },
  ];
}

/** Formular → Optionen für buildTrainingPlanDocument (Querformat genau dann, wenn mehr als 4 Spalten). */
export function exportOptions(form: PrintFormState, today: string): TrainingPlanExportOptionsInput {
  return {
    onDate: today,
    includeName: form.includeName,
    name: form.includeName ? form.name : null,
    logColumns: form.logColumns,
    landscape: form.logColumns > PRINT_EXPORT.maxLogColumnsPortrait,
  };
}

export type PlanPrintResult =
  | {
      readonly ok: true;
      readonly html: string;
      /** Titel ohne Namen (B7) – Browser-Tab bzw. Vorschlag für den Dateinamen. */
      readonly title: string;
      readonly landscape: boolean;
    }
  | { readonly ok: false; readonly error: 'invalid_options'; readonly nameError: string | null }
  | { readonly ok: false; readonly error: 'no_sessions' | 'library_missing' };

/**
 * Verständliche Meldung zum Namen (Wächter K11) – die Prüfung selbst macht das Zod-Schema aus packages/core.
 * null = Name in Ordnung (bzw. nicht gewählt).
 */
export function nameErrorText(form: PrintFormState, today: string): string | null {
  const parsed = trainingPlanExportOptionsSchema.safeParse(exportOptions(form, today));
  if (parsed.success) return null;
  const issue = parsed.error.issues.find((i) => i.path[0] === 'name');
  if (!issue) return null;
  if (issue.code === 'too_big') return t.printView.nameTooLong(PRINT_EXPORT.nameMaxLength);
  if (issue.code === 'custom') return t.printView.nameMissing;
  return t.printView.nameInvalid;
}

export interface PlanPrintInput {
  readonly rows: UserRows;
  readonly active: ActivePlan;
  readonly library: PlanLibrary;
  readonly rules: PlanSafetyRules;
  readonly today: string;
  readonly form: PrintFormState;
  readonly target: PrintTarget;
}

/** Baut das Druck-HTML des aktiven Plans – mit denselben Regeln und Geräten je Ort wie die Plan-Ansicht. */
export function buildPlanPrint(input: PlanPrintInput): PlanPrintResult {
  const { rows, active, library, rules, today, target } = input;
  // Nativ kein Querformat (siehe logColumnChoices) – auch bei veraltetem Formularstand.
  const form =
    target === 'native' && input.form.logColumns > PRINT_EXPORT.maxLogColumnsPortrait
      ? { ...input.form, logColumns: PRINT_EXPORT.maxLogColumnsPortrait }
      : input.form;
  const nameError = nameErrorText(form, today);
  if (nameError) return { ok: false, error: 'invalid_options', nameError };

  const snapshot = planSnapshot(active.plan);
  const birthDate = rows.profile?.birth_date ?? today;
  const result = buildTrainingPlanDocument(
    {
      notes: active.plan.notes,
      inputs: snapshot
        ? {
            goalType: snapshot.goalType,
            discipline: snapshot.discipline,
            schedule: snapshot.schedule,
          }
        : null,
    },
    active.sessions,
    {
      rules,
      // Wächter K9: Startgruppe des gespeicherten Plans IMMER aus planStartGroup() – wie „Heute“.
      previousStartGroup: startGroupOf(active, birthDate),
      // Nachschlagen auch archivierter Übungen des laufenden Plans; Ersatz nur aus freigegebenen (wie „Heute“).
      library: library.displayExercises ?? library.exercises,
      substituteLibrary: library.exercises,
      profiles: profilesFor(snapshot),
      // „Ab jetzt immer“ gilt auch im PDF (Etappe T2), mit der Plan-Untergrenze (Wächter T1-S2); NIE Day-Swaps.
      swap: {
        swapRules: displaySwapRules(active.plan, birthDate, rules),
        preferences: preferencesFromRows(rows),
      },
    },
    // Phase-4-Gewichte gibt es in der App noch nicht (Trainingstagebuch folgt) → Gewichts-Spalte leer.
    null,
    exportOptions(form, today),
  );
  if (!result.ok) {
    return result.error === 'invalid_options'
      ? { ok: false, error: 'invalid_options', nameError: null }
      : { ok: false, error: result.error };
  }
  const translated = translatePrintDocument(result.document);
  return {
    ok: true,
    html: renderPrintHtml(translated),
    title: translated.title,
    landscape: form.logColumns > PRINT_EXPORT.maxLogColumnsPortrait,
  };
}

/** Fehler → deutscher Text für die Druckansicht. */
export function planPrintErrorText(result: Extract<PlanPrintResult, { ok: false }>): string {
  switch (result.error) {
    case 'invalid_options':
      return result.nameError ?? t.printView.failed;
    case 'no_sessions':
      return t.printView.noSessions;
    case 'library_missing':
      return t.printView.libraryMissing;
  }
}
