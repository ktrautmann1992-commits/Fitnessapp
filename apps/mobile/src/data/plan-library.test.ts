import { describe, expect, it } from 'vitest';

import { planSafetyRules, prepareSessionForDisplay, type StoredSession } from '@fitnessapp/core';

import { CONTENT_BUNDLE } from '../generated/content-files';
import {
  contentFromDbRows,
  libraryFromCache,
  libraryFromDbRows,
  libraryToCache,
} from './plan-library';

type Data = Record<string, unknown> & { id: string; status: string };

/** Inhaltsdateien → Zeilen wie in der Datenbank (Übungen + Alternativen, Vorlagen + Einheiten + Übungen). */
function dbRows(publish: boolean, archived: readonly string[] = []) {
  const files = CONTENT_BUNDLE.files.map((f) => f.data as Data);
  const exercises = files.filter((d) => 'movement_pattern' in d);
  const templates = files.filter((d) => 'sessions' in d);
  const status = (d: Data) =>
    archived.includes(d.id) ? 'archived' : publish ? 'published' : d.status;
  const meta = (d: Data) =>
    publish ? { ...(d.meta as object), reviewed_by: 'Test', reviewed_at: '2026-10-01' } : d.meta;
  return {
    exercises: exercises.map(({ alternatives: _a, ...e }) => ({
      ...e,
      status: status(e),
      meta: meta(e),
    })) as never[],
    alternatives: exercises.flatMap((e) =>
      (e.alternatives as { alternative_id: string; reason: string; priority: number }[]).map(
        (a) => ({
          exercise_id: e.id,
          ...a,
        }),
      ),
    ) as never[],
    templates: templates.map(({ sessions: _s, ...t }) => ({
      ...t,
      status: status(t),
      meta: meta(t),
    })) as never[],
    sessions: templates.flatMap((t) =>
      (t.sessions as (Record<string, unknown> & { exercises: Record<string, unknown>[] })[]).map(
        ({ exercises: _e, ...s }) => ({ template_id: t.id, ...s }),
      ),
    ) as never[],
    templateExercises: templates.flatMap((t) =>
      (t.sessions as { day_index: number; exercises: Record<string, unknown>[] }[]).flatMap((s) =>
        s.exercises.map((e) => ({ template_id: t.id, day_index: s.day_index, ...e })),
      ),
    ) as never[],
  };
}

describe('Bibliothek aus der Datenbank', () => {
  it('Zeilen → Inhalte im Format von packages/core (alle 79 Übungen, 24 Vorlagen)', () => {
    const content = contentFromDbRows(dbRows(true));
    expect(content.exercises).toHaveLength(79);
    expect(content.templates).toHaveLength(24);
    expect(content.templates[0]?.sessions[0]?.exercises.length).toBeGreaterThan(0);
  });

  it('nie Entwürfe – auch wenn der Server welche liefern würde (allowDrafts: false)', () => {
    const library = libraryFromDbRows(dbRows(false));
    expect(library.exercises.size).toBe(0);
    expect(library.templates).toHaveLength(0);
    expect(library.containsDrafts).toBe(false);
  });

  it('Zwischenspeicher: nur Übungen, wieder mit Zod geprüft', () => {
    const library = libraryFromDbRows(dbRows(true));
    const cached = libraryFromCache(JSON.parse(JSON.stringify(libraryToCache(library))));
    expect(cached?.exercises.size).toBe(79);
    expect(cached?.templates).toEqual([]);
    expect(libraryFromCache(null)).toBeNull();
  });
});

describe('archivierte Übung im aktiven Plan', () => {
  const exercise = (id: string, order_no: number) => ({
    order_no,
    exercise_id: id,
    source_exercise_id: id,
    exercise_name_de: id,
    sets: 3,
    reps_min: 8,
    reps_max: 12,
    duration_s: null,
    rest_s: 120,
    rpe_target: 7,
    superset_group: null,
    notes_de: null,
    target_weight_kg: null,
  });
  const session = (ids: string[]): StoredSession => ({
    id: 's',
    status: 'planned',
    original_date: null,
    block_no: 1,
    week_no: 1,
    is_intro_week: false,
    is_deload: false,
    kind: 'strength',
    template_day_index: 1,
    scheduled_on: '2026-10-07',
    name_de: 'Ganzkörper A',
    focus: 'full_body',
    endurance_modality: null,
    effort_target: null,
    estimated_minutes: 45,
    warmup_de: 'w',
    cooldown_de: 'c',
    exercises: ids.map((id, i) => exercise(id, i + 1)),
  });
  const library = libraryFromDbRows(dbRows(true, ['goblet-kniebeuge']));
  const ctx = (flags: string[]) => ({
    rules: planSafetyRules(
      {
        experienceLevel: 'advanced',
        birthDate: '1990-01-01',
        healthScreening: { flags: flags as never[] },
      },
      '2026-10-07',
    ),
    previousStartGroup: 'advanced' as const,
    library: library.displayExercises ?? library.exercises,
    substituteLibrary: library.exercises,
    profile: { available: new Set(['dumbbells']) },
  });

  it('wird angezeigt (Merkmale prüfbar), steht aber nicht in der Engine-Bibliothek', () => {
    expect(library.exercises.has('goblet-kniebeuge')).toBe(false);
    const shown = prepareSessionForDisplay(session(['goblet-kniebeuge']), ctx([]));
    expect(shown.libraryMissing).toBe(false);
    expect(shown.hidden).toEqual([]);
    expect(shown.session.exercises[0]?.exercise_id).toBe('goblet-kniebeuge');
  });

  it('wird nie als Ersatz gewählt', () => {
    // Langhantel-Kniebeuge (spinal_loading) bei vorsichtigem Plan → Ersatz, aber nie die archivierte Goblet-Kniebeuge.
    const shown = prepareSessionForDisplay(
      session(['kniebeuge-langhantel']),
      ctx(['injury', 'conservative_plan']),
    );
    expect(shown.session.exercises.map((e) => e.exercise_id)).not.toContain('goblet-kniebeuge');
    const withoutArchive = prepareSessionForDisplay(session(['kniebeuge-langhantel']), {
      ...ctx(['injury', 'conservative_plan']),
      library: libraryFromDbRows(dbRows(true)).exercises,
      substituteLibrary: libraryFromDbRows(dbRows(true)).exercises,
    });
    // Gegenprobe: freigegeben wäre sie der Ersatz.
    expect(withoutArchive.session.exercises.map((e) => e.exercise_id)).toContain(
      'goblet-kniebeuge',
    );
  });
});
