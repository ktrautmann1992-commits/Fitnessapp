import {
  type Exercise,
  exerciseSchema,
  type PlanLibrary,
  planLibraryFromContent,
  type PlanTemplate,
  planTemplateSchema,
} from '@fitnessapp/core';
import type { Tables } from '@fitnessapp/db';

/**
 * Übungs- und Vorlagen-Bibliothek der Plan-Engine (docs/PLAN-PHASE-3.md 5.2/10.1).
 * - Supabase-Modus: aus den freigegebenen Tabellen (RLS zeigt nur `published`), IMMER allowDrafts: false
 *   (planLibraryFromContent). Entwürfe gibt es nur im Testmodus – und dort nur in createLocalBackend().
 * - Offline: Übungen aus dem Zwischenspeicher (keine Nutzerdaten, nur Inhalte), damit die Sicherheitsregeln beim
 *   Anzeigen prüfbar bleiben.
 * Rein und getestet (plan-library.test.ts).
 */

export interface LibraryDbRows {
  exercises: readonly Omit<Tables<'exercises'>, 'created_at' | 'updated_at'>[];
  alternatives: readonly Tables<'exercise_alternatives'>[];
  templates: readonly Omit<Tables<'plan_templates'>, 'created_at' | 'updated_at'>[];
  sessions: readonly Tables<'template_sessions'>[];
  templateExercises: readonly Tables<'template_exercises'>[];
}

/** Datenbank-Zeilen → Inhalte im Format von packages/core (ungültige Zeilen werden übergangen). */
export function contentFromDbRows(rows: LibraryDbRows): {
  exercises: Exercise[];
  templates: PlanTemplate[];
} {
  const exercises = rows.exercises.flatMap((row) => {
    const { ...fields } = row as Record<string, unknown>;
    delete fields.created_at;
    delete fields.updated_at;
    const parsed = exerciseSchema.safeParse({
      ...fields,
      alternatives: rows.alternatives
        .filter((a) => a.exercise_id === row.id)
        .sort((a, b) => a.priority - b.priority)
        .map((a) => ({ alternative_id: a.alternative_id, reason: a.reason, priority: a.priority })),
    });
    return parsed.success ? [parsed.data] : [];
  });
  const templates = rows.templates.flatMap((row) => {
    const { ...fields } = row as Record<string, unknown>;
    delete fields.created_at;
    delete fields.updated_at;
    const parsed = planTemplateSchema.safeParse({
      ...fields,
      sessions: rows.sessions
        .filter((s) => s.template_id === row.id)
        .sort((a, b) => a.day_index - b.day_index)
        .map((s) => ({
          day_index: s.day_index,
          name_de: s.name_de,
          focus: s.focus,
          warmup_de: s.warmup_de,
          cooldown_de: s.cooldown_de,
          exercises: rows.templateExercises
            .filter((e) => e.template_id === row.id && e.day_index === s.day_index)
            .sort((a, b) => a.order_no - b.order_no)
            .map((e) => ({
              order_no: e.order_no,
              exercise_id: e.exercise_id,
              sets: e.sets,
              reps_min: e.reps_min,
              reps_max: e.reps_max,
              duration_s: e.duration_s,
              rest_s: e.rest_s,
              rpe_target: e.rpe_target,
              superset_group: e.superset_group,
              notes_de: e.notes_de,
            })),
        })),
    });
    return parsed.success ? [parsed.data] : [];
  });
  return { exercises, templates };
}

/** Bibliothek im Supabase-Modus: nur freigegebene Inhalte, nie Entwürfe (allowDrafts: false). */
/**
 * Zeilen dürfen `published` UND `archived` enthalten: Die Engine (Erzeugen, Ersatz, Folgeblock) bekommt über
 * planLibraryFromContent ausschließlich freigegebene Inhalte; archivierte Übungen stehen nur in `displayExercises`,
 * damit laufende Pläne mit inzwischen archivierten Übungen angezeigt und geprüft werden können.
 */
export function libraryFromDbRows(rows: LibraryDbRows): PlanLibrary {
  const { exercises, templates } = contentFromDbRows(rows);
  const library = planLibraryFromContent(exercises, templates);
  const display = new Map(library.exercises);
  for (const e of exercises) {
    if (e.status === 'archived') display.set(e.id, e);
  }
  return { ...library, displayExercises: display };
}

/** Für den Zwischenspeicher: nur die Übungen (Anzeige offline braucht keine Vorlagen). */
export interface CachedLibrary {
  exercises: Exercise[];
  containsDrafts: boolean;
}

export function libraryToCache(library: PlanLibrary): CachedLibrary {
  return {
    exercises: [...(library.displayExercises ?? library.exercises).values()],
    containsDrafts: library.containsDrafts,
  };
}

/** Bibliothek aus dem Zwischenspeicher (Übungen erneut mit Zod geprüft, keine Vorlagen → kein Neu-Erzeugen). */
export function libraryFromCache(cached: CachedLibrary | null): PlanLibrary | null {
  if (!cached || !Array.isArray(cached.exercises)) return null;
  const exercises = cached.exercises.flatMap((e) => {
    const parsed = exerciseSchema.safeParse(e);
    return parsed.success ? [parsed.data] : [];
  });
  return {
    // Ersatz nie aus archivierten Übungen; die stehen nur zur Anzeige bereit.
    exercises: new Map(
      exercises.filter((e) => e.status !== 'archived').map((e) => [e.id, e] as const),
    ),
    displayExercises: new Map(exercises.map((e) => [e.id, e] as const)),
    templates: [],
    containsDrafts: cached.containsDrafts === true,
  };
}
