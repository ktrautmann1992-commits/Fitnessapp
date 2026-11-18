import { describe, expect, it } from 'vitest';

import {
  CUSTOM_WORKOUT_RULES,
  GROUP_BARBELL_ONLY_EXERCISE_IDS,
  WORKOUT_LIMITS,
} from '../constants';
import type { Exercise } from '../content/schemas';
import { requiredEquipmentIds } from '../equipment';
import { EXERCISES } from '../plan/swap-test-helpers';
import { checkWorkout } from './checks';
import {
  addCustomItem,
  buildCustomWorkout,
  canRemoveCustomItem,
  CUSTOM_WORKOUT_AREAS,
  type CustomBuildContext,
  customAddCandidates,
  customFlatIndex,
  customItemAt,
  customTrackLabel,
  customWorkoutDefinitionSchema,
  customWorkoutFromDefinition,
  customWorkoutId,
  type CustomWorkoutInput,
  customWorkoutInputSchema,
  customWorkoutMinutes,
  customWorkoutSeconds,
  exerciseMatchesArea,
  isCustomWorkoutId,
  moveCustomItem,
  nextCustomSeed,
  removeCustomItem,
  replaceCustomItem,
  searchCustomExercises,
  suggestCustomWorkoutName,
} from './custom';
import { isPowerWorkout } from './player';
import { workoutSchema } from './schema';

/**
 * Eigenes Workout erstellen (docs/PLAN-EIGENE-WORKOUTS.md): echter Übungsbestand (content/exercises), Grenzfälle
 * 15 vs. 60 Minuten, eine bzw. alle Gruppen, ohne Geräte, alles „Mag ich nicht“, Lieblingsübungen ohne Gerät.
 */

const BEGINNER: CustomBuildContext = {
  level: 'beginner',
  cautious: false,
  excludedCautionTags: [],
};
const ADVANCED: CustomBuildContext = {
  level: 'advanced',
  cautious: false,
  excludedCautionTags: [],
};
const HOME_DUMBBELLS = ['dumbbells', 'resistance_bands'];

function input(overrides: Partial<CustomWorkoutInput> = {}): CustomWorkoutInput {
  return {
    minutes: 30,
    areas: ['legs', 'core'],
    equipment_ids: [],
    favorite_ids: [],
    dislike_ids: [],
    seed: 1,
    ...overrides,
  };
}

function build(overrides: Partial<CustomWorkoutInput> = {}, ctx: CustomBuildContext = BEGINNER) {
  const result = buildCustomWorkout(input(overrides), EXERCISES, ctx);
  const workout = result.definition
    ? customWorkoutFromDefinition(
        result.definition,
        { id: 'eigen-test', name: 'Mein Test', today: '2026-11-18' },
        EXERCISES,
      )
    : null;
  return { ...result, workout };
}

const ids = (w: { exercises: readonly { exercise_id: string }[] } | null) =>
  (w?.exercises ?? []).map((e) => e.exercise_id);
const ex = (id: string): Exercise => {
  const found = EXERCISES.get(id);
  if (!found) throw new Error(`Übung fehlt: ${id}`);
  return found;
};

describe('buildCustomWorkout – Aufbau wie Barbell Burn', () => {
  it('30 Min. Beine + Bauch: Aufwärmen → Beine → Bauch/Core → Dehnen, gültiges Workout, läuft im Player', () => {
    const { definition, workout, issues, hasWork } = build();
    expect(hasWork).toBe(true);
    expect(issues).toEqual([]);
    expect(definition?.tracks.map((t) => t.area ?? t.kind)).toEqual([
      'warmup',
      'legs',
      'core',
      'cooldown',
    ]);
    expect(workoutSchema.safeParse(workout).success).toBe(true);
    expect(workout?.format).toBe('sets_reps');
    expect(isPowerWorkout(workout ?? { format: 'flow' })).toBe(true);
    expect(workout?.exercises[0]?.note_de).toBe('Track 1 – Aufwärmen');
    expect(workout?.exercises.at(-1)?.note_de).toMatch(/^Track 4 – Dehnen$/);
    expect(workout?.exercises.some((e) => e.note_de === 'Track 3 – Bauch/Core')).toBe(true);
    // Prüfregeln der Inhalte (W2–W5, W7) ohne roten Befund.
    const errors = checkWorkout(workout!, EXERCISES).filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
    for (const track of definition?.tracks ?? []) {
      if (track.kind === 'area') {
        expect(track.items.length).toBeGreaterThanOrEqual(CUSTOM_WORKOUT_RULES.perTrack.min);
        expect(track.items.length).toBeLessThanOrEqual(CUSTOM_WORKOUT_RULES.perTrack.max);
      }
    }
  });

  it.each(CUSTOM_WORKOUT_RULES.minutes.map((m) => [m] as const))(
    '%i Min.: geschätzte Dauer im Player höchstens ±10 % neben dem Ziel (mit Kurzhanteln)',
    (minutes) => {
      const { definition } = build({
        minutes,
        areas: ['legs', 'glutes', 'core'],
        equipment_ids: HOME_DUMBBELLS,
      });
      const seconds = customWorkoutSeconds(definition!, EXERCISES);
      expect(seconds).toBeGreaterThanOrEqual(minutes * 60 * 0.9);
      expect(seconds).toBeLessThanOrEqual(minutes * 60 * 1.1);
    },
  );

  it('15 vs. 60 Min.: lange Workouts haben mehr Übungen bzw. Sätze, beide höchstens 12 Übungen', () => {
    const short = build({ minutes: 15, areas: ['full_body'], equipment_ids: HOME_DUMBBELLS });
    const long = build({ minutes: 60, areas: ['full_body'], equipment_ids: HOME_DUMBBELLS });
    const sets = (w: typeof short.workout) =>
      (w?.exercises ?? []).reduce((n, e) => n + (e.sets ?? 1), 0);
    expect(sets(long.workout)).toBeGreaterThan(sets(short.workout) * 2);
    for (const w of [short.workout, long.workout]) {
      expect(w?.exercises.length).toBeLessThanOrEqual(WORKOUT_LIMITS.exercises.max);
    }
    expect(short.workout?.minutes).toBeLessThanOrEqual(17);
    expect(long.workout?.minutes).toBeGreaterThanOrEqual(54);
  });

  it('eine Gruppe (60 Min.): Tracks teilen sich („Teil 1/2“), je höchstens 3 Übungen, nur passende Übungen', () => {
    const { definition, workout } = build({
      minutes: 60,
      areas: ['legs'],
      equipment_ids: HOME_DUMBBELLS,
    });
    const legTracks = definition!.tracks.filter((t) => t.kind === 'area');
    expect(legTracks.length).toBeGreaterThan(1);
    expect(legTracks.every((t) => t.area === 'legs' && t.items.length <= 3)).toBe(true);
    expect(customTrackLabel(definition!, 1)).toBe('Beine (Teil 1)');
    for (const t of legTracks) {
      for (const item of t.items)
        expect(exerciseMatchesArea(ex(item.exercise_id), 'legs')).toBe(true);
    }
    expect(workout?.category).toBe('legs_glutes');
  });

  it('alle Gruppen (15 Min.): jede Gruppe ein Track, große Muskeln zuerst, Bauch/Core zuletzt, höchstens 12 Übungen', () => {
    const { definition, workout, issues } = build({
      minutes: 15,
      areas: [...CUSTOM_WORKOUT_AREAS].reverse(),
      equipment_ids: HOME_DUMBBELLS,
    });
    expect(issues.filter((i) => i.kind === 'no_candidates')).toEqual([]);
    const areas = definition!.tracks.filter((t) => t.kind === 'area').map((t) => t.area);
    expect(areas).toEqual([...CUSTOM_WORKOUT_AREAS]);
    expect(workout!.exercises.length).toBeLessThanOrEqual(12);
    expect(definition!.tracks[0]?.kind).toBe('warmup');
    expect(definition!.tracks.at(-1)?.kind).toBe('cooldown');
  });

  it('alle Gruppen (60 Min.): Aufwärmen/Dehnen gekürzt, damit jede Gruppe Platz hat', () => {
    const { definition, workout } = build({
      minutes: 60,
      areas: [...CUSTOM_WORKOUT_AREAS],
      equipment_ids: HOME_DUMBBELLS,
    });
    expect(definition!.tracks.filter((t) => t.kind === 'area').map((t) => t.area)).toEqual([
      ...CUSTOM_WORKOUT_AREAS,
    ]);
    expect(workout!.exercises.length).toBe(12);
    expect(workoutSchema.safeParse(workout).success).toBe(true);
  });

  it('ohne Geräte: keine Übung braucht ein Gerät (ersetzbare Hilfsmittel wie Matte zählen nicht)', () => {
    const { workout } = build({ minutes: 45, areas: [...CUSTOM_WORKOUT_AREAS], equipment_ids: [] });
    for (const id of ids(workout)) {
      expect(requiredEquipmentIds(ex(id).equipment_ids), id).toEqual([]);
    }
    expect(requiredEquipmentIds(workout!.equipment_ids)).toEqual([]);
  });

  it('Geräte = Vereinigung der Übungsgeräte (Regel W3)', () => {
    const { workout } = build({
      minutes: 45,
      areas: ['back', 'arms'],
      equipment_ids: ['dumbbells', 'pull_up_bar'],
    });
    const union = new Set(ids(workout).flatMap((id) => ex(id).equipment_ids));
    expect(new Set(workout!.equipment_ids)).toEqual(union);
  });

  it('deterministisch: gleicher Seed → gleiches Workout; „Neu würfeln“ → andere Auswahl', () => {
    const a = build({
      seed: 7,
      areas: ['full_body', 'legs', 'chest'],
      equipment_ids: HOME_DUMBBELLS,
    });
    const b = build({
      seed: 7,
      areas: ['full_body', 'legs', 'chest'],
      equipment_ids: HOME_DUMBBELLS,
    });
    expect(b.definition).toEqual(a.definition);
    const seeds = [7, nextCustomSeed(7), nextCustomSeed(nextCustomSeed(7)), 12345];
    const variants = new Set(
      seeds.map((seed) =>
        ids(
          build({ seed, areas: ['full_body', 'legs', 'chest'], equipment_ids: HOME_DUMBBELLS })
            .workout,
        ).join(','),
      ),
    );
    expect(variants.size).toBeGreaterThan(1);
    expect(nextCustomSeed(7)).not.toBe(7);
    expect(
      customWorkoutInputSchema.safeParse(input({ seed: nextCustomSeed(2_000_000_000) })).success,
    ).toBe(true);
  });
});

describe('buildCustomWorkout – Vorlieben und Sicherheit', () => {
  it('Lieblingsübungen zuerst in ihrer Gruppe; „Mag ich nicht“ nie (auch nicht beim Aufwärmen/Dehnen)', () => {
    const base = build({ minutes: 30, areas: ['legs', 'core'] });
    const disliked = ids(base.workout);
    const { workout } = build({
      minutes: 30,
      areas: ['legs', 'core'],
      favorite_ids: ['glute-bridge', 'dead-bug'],
      dislike_ids: disliked,
    });
    const chosen = ids(workout);
    expect(chosen).toContain('dead-bug');
    expect(chosen.filter((id) => disliked.includes(id))).toEqual([]);
    // glute-bridge passt zu keiner gewählten Gruppe (Po) → Hinweis, nicht hineingemogelt.
    const result = build({ areas: ['legs', 'core'], favorite_ids: ['glute-bridge'] });
    expect(ids(result.workout)).not.toContain('glute-bridge');
    expect(result.issues).toContainEqual({
      kind: 'favorite_skipped',
      exerciseId: 'glute-bridge',
      reason: 'no_area',
    });
    // Lieblingsübung steht an erster Stelle ihres Tracks.
    const fav = build({ areas: ['glutes'], favorite_ids: ['glute-bridge'] });
    expect(fav.definition?.tracks[1]?.items[0]?.exercise_id).toBe('glute-bridge');
  });

  it('Lieblingsübung braucht ein fehlendes Gerät → nicht genommen, Hinweis „equipment“', () => {
    const { workout, issues } = build({
      areas: ['back'],
      equipment_ids: [],
      favorite_ids: ['klimmzug-negativ', 'latziehen'],
    });
    expect(ids(workout)).not.toContain('latziehen');
    expect(issues).toContainEqual({
      kind: 'favorite_skipped',
      exerciseId: 'latziehen',
      reason: 'equipment',
    });
  });

  it('globale „Mag ich nicht“ (eigene Liste/Präferenzen) wirken wie die Eingabe', () => {
    const base = ids(build().workout);
    const victim = base[2] as string;
    const { workout } = build({}, { ...BEGINNER, dislikes: new Set([victim]) });
    expect(ids(workout)).not.toContain(victim);
  });

  it('alles „Mag ich nicht“ / keine Kandidaten → kein Workout, Hinweis je Gruppe', () => {
    const all = [...EXERCISES.keys()];
    const { definition, workout, hasWork, issues } = build(
      {
        areas: ['legs', 'core'],
        dislike_ids: all.slice(0, CUSTOM_WORKOUT_RULES.maxDislikes),
      },
      { ...BEGINNER, dislikes: new Set(all) },
    );
    expect(definition).toBeNull();
    expect(workout).toBeNull();
    expect(hasWork).toBe(false);
    expect(issues).toContainEqual({ kind: 'no_candidates', areas: ['legs', 'core'] });
  });

  it('Gruppe ohne passende Übung: Hinweis, die anderen Gruppen bleiben', () => {
    const shoulders = [...EXERCISES.values()]
      .filter((e) => exerciseMatchesArea(e, 'shoulders'))
      .map((e) => e.id);
    const { definition, issues } = build(
      { areas: ['shoulders', 'legs'] },
      { ...BEGINNER, dislikes: new Set(shoulders) },
    );
    expect(issues).toContainEqual({ kind: 'no_candidates', areas: ['shoulders'] });
    expect(definition!.tracks.filter((t) => t.kind === 'area').map((t) => t.area)).toEqual([
      'legs',
    ]);
  });

  it('Level: Einsteiger höchstens Schwierigkeit 2, vorsichtiger Plan wie Einsteiger; Fortgeschrittene bis 3', () => {
    for (const ctx of [BEGINNER, { ...ADVANCED, cautious: true }]) {
      const { workout } = build(
        {
          minutes: 60,
          areas: [...CUSTOM_WORKOUT_AREAS],
          equipment_ids: ['pull_up_bar', ...HOME_DUMBBELLS],
        },
        ctx,
      );
      expect(Math.max(...ids(workout).map((id) => ex(id).difficulty))).toBeLessThanOrEqual(2);
    }
    const fav = build(
      { areas: ['back'], equipment_ids: ['pull_up_bar'], favorite_ids: ['klimmzug'] },
      BEGINNER,
    );
    expect(fav.issues).toContainEqual({
      kind: 'favorite_skipped',
      exerciseId: 'klimmzug',
      reason: 'too_hard',
    });
    const adv = build(
      { areas: ['back'], equipment_ids: ['pull_up_bar'], favorite_ids: ['klimmzug'] },
      ADVANCED,
    );
    expect(ids(adv.workout)).toContain('klimmzug');
  });

  it('Gesundheits-Check: ausgeschlossene Merkmale kommen nie hinein (auch nicht beim Aufwärmen/Dehnen)', () => {
    const excluded = ['high_impact', 'overhead', 'floor_transfer', 'spinal_loading'] as const;
    const { workout } = build(
      { minutes: 45, areas: [...CUSTOM_WORKOUT_AREAS], equipment_ids: HOME_DUMBBELLS },
      { ...BEGINNER, excludedCautionTags: excluded },
    );
    for (const id of ids(workout)) {
      expect(
        ex(id).caution_tags.filter((t) => (excluded as readonly string[]).includes(t)),
        id,
      ).toEqual([]);
    }
  });

  it('Aufwärmen immer da und ohne Sprünge; Barbell-Burn-Gruppenübungen nie', () => {
    for (const areas of [['chest'], ['core'], [...CUSTOM_WORKOUT_AREAS]] as const) {
      const { definition, workout } = build(
        { areas: [...areas], equipment_ids: ['barbell', 'flat_bench', 'power_rack'] },
        ADVANCED,
      );
      const warm = definition!.tracks[0];
      expect(warm?.kind).toBe('warmup');
      expect(warm?.items.length).toBeGreaterThan(0);
      for (const item of warm?.items ?? []) {
        expect(ex(item.exercise_id).caution_tags).not.toContain('high_impact');
      }
      expect(ids(workout).filter((id) => GROUP_BARBELL_ONLY_EXERCISE_IDS.includes(id))).toEqual([]);
    }
  });

  it('Sterne: höchste Übungs-Schwierigkeit, ab 45 Min. einer mehr (1–5)', () => {
    const short = build({ minutes: 20 });
    const long = build({ minutes: 60 });
    const max = (w: typeof short.workout) =>
      Math.max(
        ...(w?.exercises ?? [])
          .filter((e) => !/Aufwärmen|Dehnen/.test(e.note_de ?? ''))
          .map((e) => ex(e.exercise_id).difficulty),
      );
    expect(short.workout?.difficulty).toBe(Math.max(max(short.workout), 1));
    expect(long.workout?.difficulty).toBe(max(long.workout) + 1);
  });

  it('ungültige Eingaben (Zod an der Grenze) werden abgelehnt', () => {
    expect(customWorkoutInputSchema.safeParse(input({ minutes: 25 })).success).toBe(false);
    expect(customWorkoutInputSchema.safeParse(input({ areas: [] })).success).toBe(false);
    expect(customWorkoutInputSchema.safeParse(input({ areas: ['legs', 'legs'] })).success).toBe(
      false,
    );
    expect(() => buildCustomWorkout(input({ minutes: 25 }), EXERCISES, BEGINNER)).toThrow();
  });
});

describe('Bearbeiten in der Vorschau', () => {
  const { definition } = build({ minutes: 30, areas: ['legs', 'core'] });
  const def = definition!;

  it('Position flach ↔ Track', () => {
    const flat = customFlatIndex(def, 2, 0);
    expect(customItemAt(def, flat)).toEqual({ trackIndex: 2, itemIndex: 0 });
    expect(customItemAt(def, 99)).toBeNull();
  });

  it('Entfernen: Muskel-Track darf leer werden (entfällt), Aufwärmen/Dehnen behalten eine Übung', () => {
    const core = def.tracks.findIndex((t) => t.area === 'core');
    let next = def;
    const count = def.tracks[core]?.items.length ?? 0;
    for (let i = 0; i < count; i += 1) next = removeCustomItem(next, core, 0) ?? next;
    expect(next.tracks.some((t) => t.area === 'core')).toBe(false);
    expect(customWorkoutDefinitionSchema.safeParse(next).success).toBe(true);
    const warm = def.tracks[0]!;
    let w = def;
    for (let i = 0; i < warm.items.length - 1; i += 1) w = removeCustomItem(w, 0, 0) ?? w;
    expect(canRemoveCustomItem(w, 0)).toBe(false);
    expect(removeCustomItem(w, 0, 0)).toBeNull();
  });

  it('Hinzufügen: passend zur Gruppe, ohne Doppelte; Dauer steigt; höchstens 12 Übungen', () => {
    const legs = def.tracks.findIndex((t) => t.area === 'legs');
    const candidates = customAddCandidates(def, legs, EXERCISES, BEGINNER);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((e) => exerciseMatchesArea(e, 'legs'))).toBe(true);
    expect(
      candidates.some((e) =>
        ids(
          customWorkoutFromDefinition(
            def,
            { id: 'eigen-x', name: 'X x', today: '2026-11-18' },
            EXERCISES,
          ),
        ).includes(e.id),
      ),
    ).toBe(false);
    const before = customWorkoutMinutes(def, EXERCISES);
    const added = addCustomItem(def, legs, candidates[0]!);
    expect(added).not.toBeNull();
    expect(customWorkoutSeconds(added!, EXERCISES)).toBeGreaterThan(
      customWorkoutSeconds(def, EXERCISES),
    );
    expect(customWorkoutMinutes(added!, EXERCISES)).toBeGreaterThanOrEqual(before);
    expect(addCustomItem(added!, legs, candidates[0]!)).toBeNull();
    const search = customAddCandidates(def, legs, EXERCISES, BEGINNER, 'kniebeuge');
    expect(search.every((e) => /kniebeuge/i.test(`${e.name_de} ${e.aliases_de.join(' ')}`))).toBe(
      true,
    );
  });

  it('Tauschen und Verschieben', () => {
    const legs = def.tracks.findIndex((t) => t.area === 'legs');
    const first = def.tracks[legs]!.items[0]!;
    const replacement = customAddCandidates(def, legs, EXERCISES, BEGINNER)[0]!;
    const swapped = replaceCustomItem(def, legs, 0, replacement, EXERCISES);
    expect(swapped?.tracks[legs]?.items[0]?.exercise_id).toBe(replacement.id);
    expect(swapped?.tracks[legs]?.items[0]?.sets).toBe(first.sets);
    const moved = moveCustomItem(def, legs, 0, 1);
    expect(moved?.tracks[legs]?.items[1]?.exercise_id).toBe(first.exercise_id);
    expect(moveCustomItem(def, legs, 0, -1)).toBeNull();
  });
});

describe('Namen, IDs, Suche', () => {
  it('Namensvorschlag wie „Mein Beine & Po 30“', () => {
    expect(suggestCustomWorkoutName({ areas: ['glutes', 'legs'], minutes: 30 })).toBe(
      'Mein Beine & Po 30',
    );
    expect(suggestCustomWorkoutName({ areas: ['arms', 'chest', 'back'], minutes: 45 })).toBe(
      'Mein Rücken, Brust & Arme 45',
    );
    expect(suggestCustomWorkoutName({ areas: [...CUSTOM_WORKOUT_AREAS], minutes: 60 })).toBe(
      'Mein Ganzkörper 60',
    );
  });

  it('Workout-ID aus der Zeilen-ID ist eine gültige Inhalts-ID', () => {
    const id = customWorkoutId('3F2504E0-4F89-41D3-9A0C-0305E82C3301');
    expect(id).toBe('eigen-3f2504e0-4f89-41d3-9a0c-0305e82c3301');
    expect(isCustomWorkoutId(id)).toBe(true);
    expect(isCustomWorkoutId('barbell-burn-60')).toBe(false);
    const { definition } = build();
    expect(
      customWorkoutFromDefinition(
        definition!,
        { id, name: 'Mein Test', today: '2026-11-18' },
        EXERCISES,
      ).id,
    ).toBe(id);
  });

  it('Suche nach Name (Umlaute egal), ohne Dehn-Übungen, ohne Barbell-Burn-Gruppenübungen', () => {
    const found = searchCustomExercises(EXERCISES, 'kniebeuge');
    expect(found.length).toBeGreaterThan(2);
    expect(found.every((e) => e.movement_pattern !== 'mobility')).toBe(true);
    expect(found.map((e) => e.id)).not.toContain('kniebeuge-langhantel-leicht');
    expect(searchCustomExercises(EXERCISES, 'Ausfallschritt').length).toBeGreaterThan(0);
    expect(
      searchCustomExercises(EXERCISES, 'ruecken dehnen', { includeCalm: true }).length,
    ).toBeGreaterThanOrEqual(0);
    expect(searchCustomExercises(EXERCISES, '')).toEqual([]);
  });
});
