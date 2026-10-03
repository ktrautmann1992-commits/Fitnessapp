/**
 * Testdaten für die Inhalts-Tests (nur in *.test.ts benutzt). Eine kleine, in sich stimmige Bibliothek und
 * eine Vorlage, die ALLE Regeln erfüllt – jeder Test verändert genau eine Stelle.
 */
import type { MovementPattern, MuscleGroup } from '../enums';
import type { Exercise, PlanTemplate, TemplateExercise, TemplateSession } from './schemas';

export const META = {
  origin: 'claude_session',
  model: 'claude-opus-5-5',
  batch_id: null,
  created_on: '2026-10-03',
  expert_reviewed: false,
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
} as const satisfies Exercise['meta'];

export function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'kniebeuge-test',
    version: 1,
    status: 'draft',
    name_de: 'Kniebeuge',
    name_en: 'Squat',
    aliases_de: [],
    movement_pattern: 'squat',
    primary_muscles: ['quadriceps', 'glutes'],
    secondary_muscles: [],
    equipment_ids: ['barbell'],
    mechanics: 'compound',
    load_type: 'weight',
    unilateral: false,
    difficulty: 2,
    caution_tags: [],
    description_de: 'Grundübung für die Beine: Hüfte und Knie beugen, dann wieder aufrichten.',
    steps_de: ['Füße etwa schulterbreit aufstellen.', 'In die Hocke gehen und wieder aufstehen.'],
    tips_de: ['Knie zeigen in Richtung der Fußspitzen.'],
    common_mistakes_de: ['Fersen heben vom Boden ab.'],
    safety_note_de: 'Gewicht so wählen, dass jede Wiederholung sauber gelingt.',
    alternatives: [],
    meta: { ...META },
    ...overrides,
  };
}

/** Kurzform für Bibliotheks-Übungen. */
function ex(
  id: string,
  pattern: MovementPattern,
  primary: MuscleGroup[],
  secondary: MuscleGroup[],
  extra: Partial<Exercise> = {},
): Exercise {
  return makeExercise({
    id,
    movement_pattern: pattern,
    primary_muscles: primary,
    secondary_muscles: secondary,
    mechanics: 'compound',
    equipment_ids: [],
    load_type: 'bodyweight',
    ...extra,
  });
}

const iso = { mechanics: 'isolation' } as const;

/** Bibliothek: jede Übung ohne Geräte (Körpergewicht) – Ü5 ist damit für jedes Muster erfüllt. */
export const LIBRARY: Exercise[] = [
  ex('brustdruecken', 'horizontal_push', ['chest'], ['triceps', 'front_delts']),
  ex('rudern', 'horizontal_pull', ['upper_back', 'lats'], ['biceps', 'rear_delts']),
  ex('kniebeuge', 'squat', ['quadriceps', 'glutes'], []),
  ex('kreuzheben', 'hinge', ['hamstrings', 'glutes'], []),
  ex('schulterdruecken', 'vertical_push', ['front_delts'], ['triceps', 'side_delts']),
  ex('latziehen', 'vertical_pull', ['lats'], ['biceps', 'upper_back']),
  ex('seitheben', 'shoulder_isolation', ['side_delts'], [], iso),
  ex('reverse-fly', 'shoulder_isolation', ['rear_delts'], [], iso),
  ex('wadenheben', 'calf_raise', ['calves'], [], iso),
  ex('unterarmstuetz', 'core_anti_extension', ['abs'], [], { ...iso, load_type: 'time' }),
];

export const libraryMap = (exercises: Exercise[] = LIBRARY) =>
  new Map(exercises.map((exercise) => [exercise.id, exercise]));

export function item(
  order_no: number,
  exercise_id: string,
  sets: number,
  overrides: Partial<TemplateExercise> = {},
): TemplateExercise {
  return {
    order_no,
    exercise_id,
    sets,
    reps_min: 10,
    reps_max: 12,
    duration_s: null,
    rest_s: 120,
    rpe_target: 7,
    superset_group: null,
    notes_de: null,
    ...overrides,
  };
}

const ISO = { rest_s: 60 } as const;
const PLANK = { reps_min: null, reps_max: null, duration_s: 30, rest_s: 60 } as const;

function session(day_index: number, extras: TemplateExercise[]): TemplateSession {
  return {
    day_index,
    name_de: `Ganzkörper ${day_index}`,
    focus: 'full_body',
    warmup_de: '5 Minuten locker aufwärmen, dann leichte Sätze der ersten Übung.',
    cooldown_de: '5 Minuten locker ausklingen lassen.',
    exercises: [
      item(1, 'kniebeuge', 2),
      item(2, 'brustdruecken', 2),
      item(3, 'rudern', 2),
      item(4, 'kreuzheben', 2),
      item(5, 'schulterdruecken', 1),
      item(6, 'latziehen', 1),
      ...extras,
    ],
  };
}

/**
 * Allgemeine Fitness, Einsteiger, 3 Tage (Zielbereich 4–12 Wochensätze) – erfüllt alle Regeln:
 * große Gruppen 6–12, kleine Gruppen ≥ 4, Drücken 9 : Ziehen 9, Dauer im Fenster 30–45 min ±15 %.
 */
export function makeTemplate(overrides: Partial<PlanTemplate> = {}): PlanTemplate {
  return {
    id: 'fitness-einsteiger-3t-test',
    version: 1,
    status: 'draft',
    title_de: 'Allgemeine Fitness · Einsteiger · 3 Tage',
    description_de: 'Drei Ganzkörper-Einheiten pro Woche für einen sicheren Einstieg.',
    goal_type: 'general_fitness',
    experience_level: 'beginner',
    sessions_per_week: 3,
    minutes_min: 30,
    minutes_max: 45,
    location: 'gym',
    required_equipment_ids: [],
    optional_equipment_ids: [],
    sex: null,
    sessions: [
      session(1, [item(7, 'wadenheben', 2, ISO), item(8, 'unterarmstuetz', 2, PLANK)]),
      session(2, [item(7, 'seitheben', 3, ISO), item(8, 'reverse-fly', 2, ISO)]),
      session(3, [item(7, 'wadenheben', 2, ISO), item(8, 'unterarmstuetz', 2, PLANK)]),
    ],
    meta: { ...META },
    ...overrides,
  };
}
