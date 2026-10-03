/**
 * Inhaltsart „Plan-Vorlage“ (content/plan-templates).
 * Matrix: Ziel × Level × Tage pro Woche × Studio/Zuhause × Minuten-Spanne (docs/PLAN-PHASE-2.md Abschnitte 9,
 * 14 und 15). Die ID ergibt sich aus der Zelle; vorhandene Vorlagen werden übersprungen.
 */
import {
  EQUIPMENT,
  planTemplateSchema,
  REST_RANGES_S,
  SESSION_DURATION_ESTIMATE,
  SESSION_FOCUSES,
  TEMPLATE_DOSAGE_LIMITS,
  TEMPLATE_EXPERIENCE_LEVELS,
  TEMPLATE_GOAL_TYPES,
  type TemplateExperienceLevel,
  type TemplateGoalType,
  templateExerciseSchema,
  templateSessionSchema,
  WEEKLY_SETS_PER_MUSCLE,
} from '@fitnessapp/core';
import { z } from 'zod';

import { equipmentCatalogText, OUTPUT_FORMAT_TEXT, ROLE_TEXT, textRules } from './prompt-rules';
import type { ContentKindDefinition, GenerationCell, LibraryContext } from './types';

/** max_tokens je Vorlage (Plan Abschnitt 10/15). */
export const PLAN_TEMPLATE_MAX_TOKENS = 24_000;

const GOALS: Record<TemplateGoalType, { de: string; slug: string; aliases: string[] }> = {
  muscle_gain: { de: 'Muskelaufbau', slug: 'muskelaufbau', aliases: ['muskelaufbau'] },
  fat_loss: { de: 'Fettverlust', slug: 'fettverlust', aliases: ['fettverlust'] },
  general_fitness: { de: 'Allgemeine Fitness', slug: 'fitness', aliases: ['fitness'] },
};
const LEVELS: Record<TemplateExperienceLevel, { de: string; slug: string }> = {
  beginner: { de: 'Einsteiger', slug: 'einsteiger' },
  advanced: { de: 'Fortgeschritten', slug: 'fortgeschritten' },
};
const DAYS = ['3', '4'] as const;
const LOCATIONS = {
  gym: { de: 'Studio', slug: 'studio' },
  home: { de: 'Zuhause', slug: 'zuhause' },
} as const;
type TemplateLocation = keyof typeof LOCATIONS;

/** Minuten-Spannen; 45–60 ist der Standard des Startbestands (ID ohne Zusatz). */
export const TEMPLATE_DURATIONS = ['30-45', '45-60', '60-75'] as const;
type TemplateDuration = (typeof TEMPLATE_DURATIONS)[number];
const DEFAULT_DURATION: TemplateDuration = '45-60';

/** Zuhause: Pflicht Kurzhanteln + Bänder, optional Flachbank + Klimmzugstange (Plan Frage 3). */
export const HOME_REQUIRED_EQUIPMENT = ['dumbbells', 'resistance_bands'] as const;
export const HOME_OPTIONAL_EQUIPMENT = ['flat_bench', 'pull_up_bar'] as const;

interface TemplateCellValues {
  goal: TemplateGoalType;
  level: TemplateExperienceLevel;
  days: number;
  location: TemplateLocation;
  minutesMin: number;
  minutesMax: number;
  duration: TemplateDuration;
}

function minutesOf(duration: TemplateDuration): [number, number] {
  const [min, max] = duration.split('-').map(Number) as [number, number];
  return [min, max];
}

/** Inhalts-ID einer Zelle, z. B. `muskelaufbau-einsteiger-3t-studio` bzw. `…-studio-30-45min`. */
export function templateIdFor(values: Omit<TemplateCellValues, 'minutesMin' | 'minutesMax'>) {
  const base = `${GOALS[values.goal].slug}-${LEVELS[values.level].slug}-${values.days}t-${LOCATIONS[values.location].slug}`;
  return values.duration === DEFAULT_DURATION ? base : `${base}-${values.duration}min`;
}

function cellFor(
  goal: TemplateGoalType,
  level: TemplateExperienceLevel,
  days: (typeof DAYS)[number],
  location: TemplateLocation,
  duration: TemplateDuration,
): GenerationCell {
  const [min, max] = minutesOf(duration);
  return {
    customId: `tpl-${goal}-${level}-${days}-${location}-${duration}`,
    targetId: templateIdFor({ goal, level, days: Number(days), location, duration }),
    label: `${GOALS[goal].de} · ${LEVELS[level].de} · ${days} Tage · ${LOCATIONS[location].de} · ${min}–${max} min`,
    values: { goal, level, days, location, duration },
  };
}

function valuesOf(cell: GenerationCell): TemplateCellValues {
  const goal = cell.values.goal as TemplateGoalType;
  const level = cell.values.level as TemplateExperienceLevel;
  const location = cell.values.location as TemplateLocation;
  const duration = cell.values.duration as TemplateDuration;
  const days = Number(cell.values.days);
  if (
    !TEMPLATE_GOAL_TYPES.includes(goal) ||
    !TEMPLATE_EXPERIENCE_LEVELS.includes(level) ||
    !(location in LOCATIONS) ||
    !TEMPLATE_DURATIONS.includes(duration) ||
    !DAYS.includes(String(days) as (typeof DAYS)[number])
  ) {
    throw new Error(`Ungültige Vorlagen-Zelle: ${cell.customId}.`);
  }
  const [minutesMin, minutesMax] = minutesOf(duration);
  return { goal, level, days, location, duration, minutesMin, minutesMax };
}

/** Übungen, die eine Vorlage verwenden darf (nicht zurückgezogen; zu Hause nur Heim-Geräte). */
function allowedExercises(context: LibraryContext, location: TemplateLocation) {
  const allowed = new Set<string>([...HOME_REQUIRED_EQUIPMENT, ...HOME_OPTIONAL_EQUIPMENT]);
  return context.exercises.filter(
    (exercise) =>
      exercise.status !== 'archived' &&
      (location === 'gym' || exercise.equipment_ids.every((id) => allowed.has(id))),
  );
}

const T = planTemplateSchema.shape;
const SESSION = templateSessionSchema.shape;
const ITEM = templateExerciseSchema.shape;
const FIELD_ORDER = Object.keys(planTemplateSchema.shape);
const EQUIPMENT_IDS_WITHOUT_OTHER = EQUIPMENT.map((item) => item.id).filter(
  (id) => id !== 'other',
) as [string, ...string[]];

/** Zod-Schema der Modell-Antwort: Matrix-Werte fest, Übungen und Geräte nur aus dem Katalog. */
export function planTemplateOutputSchema(cell: GenerationCell, context: LibraryContext) {
  const values = valuesOf(cell);
  const exerciseIds = allowedExercises(context, values.location).map((exercise) => exercise.id);
  if (exerciseIds.length === 0) {
    throw new Error('Keine Übungen im Bestand – erst Übungen anlegen, dann Vorlagen erzeugen.');
  }
  const equipmentIds =
    values.location === 'home'
      ? ([...HOME_REQUIRED_EQUIPMENT, ...HOME_OPTIONAL_EQUIPMENT] as [string, ...string[]])
      : EQUIPMENT_IDS_WITHOUT_OTHER;
  const exerciseItem = z.strictObject({
    order_no: ITEM.order_no,
    exercise_id: z.enum(exerciseIds as [string, ...string[]]),
    sets: ITEM.sets,
    reps_min: ITEM.reps_min,
    reps_max: ITEM.reps_max,
    duration_s: ITEM.duration_s,
    rest_s: ITEM.rest_s,
    rpe_target: ITEM.rpe_target,
    superset_group: ITEM.superset_group,
    notes_de: ITEM.notes_de,
  });
  const session = z.strictObject({
    day_index: SESSION.day_index,
    name_de: SESSION.name_de,
    focus: z.enum(SESSION_FOCUSES),
    warmup_de: SESSION.warmup_de,
    cooldown_de: SESSION.cooldown_de,
    exercises: z.array(exerciseItem).min(1).max(TEMPLATE_DOSAGE_LIMITS.maxExercisesPerSession),
  });
  return z.strictObject({
    title_de: T.title_de,
    description_de: T.description_de,
    goal_type: z.literal(values.goal),
    experience_level: z.literal(values.level),
    sessions_per_week: z.literal(values.days),
    minutes_min: z.literal(values.minutesMin),
    minutes_max: z.literal(values.minutesMax),
    location: z.literal(values.location),
    required_equipment_ids: z.array(z.enum(equipmentIds)).max(20),
    optional_equipment_ids: z.array(z.enum(equipmentIds)).max(20),
    sex: z.null(),
    sessions: z.array(session).min(values.days).max(values.days),
  });
}

function systemPrompt(context: LibraryContext): string {
  const exercises = context.exercises
    .filter((exercise) => exercise.status !== 'archived')
    .map(
      (exercise) =>
        `- ${exercise.id}: ${exercise.name_de} | ${exercise.movement_pattern} | ${exercise.mechanics} | Haupt: ${exercise.primary_muscles.join(', ')} | Neben: ${
          exercise.secondary_muscles.join(', ') || '–'
        } | Geräte: ${exercise.equipment_ids.join(', ') || 'keine'}`,
    )
    .join('\n');
  const d = TEMPLATE_DOSAGE_LIMITS;
  const e = SESSION_DURATION_ESTIMATE;
  return [
    ROLE_TEXT,
    '',
    'Aufgabe: Erstelle genau EINE Wochen-Vorlage für einen Krafttrainingsplan. Die App setzt daraus später persönliche Pläne zusammen (Gewichte wählt jede Person selbst).',
    '',
    textRules(),
    '',
    'Regeln für Vorlagen:',
    `- Anzahl Einheiten = Tage pro Woche; day_index 1, 2, 3 … ohne Lücken. 3 Tage: drei Ganzkörper-Einheiten (focus full_body, „Ganzkörper A/B/C“). 4 Tage: Oberkörper/Unterkörper im Wechsel (upper, lower, upper, lower).`,
    `- Pro Einheit höchstens ${d.maxExercisesPerSession} Übungen, order_no 1, 2, 3 … ohne Lücken; zuerst Grundübungen, dann Isolationsübungen.`,
    `- Pro Übung ${d.sets.min}–${d.sets.max} Sätze. Entweder Wiederholungen (reps_min/reps_max zwischen ${d.reps.min} und ${d.reps.max}, duration_s null) ODER Haltedauer (duration_s ${d.durationS.min}–${d.durationS.max} s, reps_min/reps_max null).`,
    `- rpe_target ${d.rpe.min}–${d.rpe.max} in 0,5er-Schritten, Einsteiger höchstens ${d.beginnerRpeMax}. Keine Maximaltests (kein RPE 10, keine 1RM-Tests).`,
    `- Pausen (rest_s): Grundübungen ${REST_RANGES_S.compound.min}–${REST_RANGES_S.compound.max} s, Isolationsübungen ${REST_RANGES_S.isolation.min}–${REST_RANGES_S.isolation.max} s. Supersätze nur sparsam (superset_group „A“, „B“ …), sonst null.`,
    `- Dauer je Einheit wird geschätzt: ${e.warmupMinutes} min Aufwärmen + je Satz ${e.secondsPerRep} s pro Wiederholung (Mittel aus reps_min/reps_max) bzw. die Haltedauer + Pausen zwischen den Sätzen + ${e.transitionSecondsPerExercise} s Wechsel je Übung. Die Schätzung muss in der Minuten-Spanne der Vorlage liegen.`,
    '- Wochensätze je Muskelgruppe: Ein Satz zählt für jeden Hauptmuskel 1,0 und für jeden Nebenmuskel 0,5. Der Zielbereich steht in der Anfrage; große Muskelgruppen (Brust, Latissimus, oberer Rücken, Quadrizeps, Beinbeuger, Gesäß) müssen ihn erreichen, keine Gruppe darf ihn überschreiten.',
    '- Drücken (horizontal_push, vertical_push) und Ziehen (horizontal_pull, vertical_pull) pro Woche etwa 1 : 1.',
    '- notes_de: kurzer Hinweis (z. B. „Wiederholungen je Seite.“) oder null. warmup_de/cooldown_de: 1–2 Sätze.',
    '- title_de im Format „Ziel · Level · N Tage · Ort · Minuten“; description_de: 2–4 Sätze zu Aufbau, Ziel und Steigerung.',
    '- Zuhause: Pflicht-Geräte dumbbells und resistance_bands, optional flat_bench und pull_up_bar; nur Übungen, die damit gehen. Studio: alle nötigen Geräte unter required_equipment_ids, optional_equipment_ids leer.',
    '- sex: null (für alle).',
    '',
    'Geräte-Katalog (ID: Name):',
    equipmentCatalogText(),
    '',
    'Übungen im Bestand (ID: Name | Bewegungsmuster | Grund-/Isolationsübung | Hauptmuskeln | Nebenmuskeln | Geräte):',
    exercises,
    '',
    OUTPUT_FORMAT_TEXT,
  ].join('\n');
}

function userPrompt(cell: GenerationCell): string {
  const v = valuesOf(cell);
  const range = WEEKLY_SETS_PER_MUSCLE[v.goal][v.level];
  return [
    `Ziel: ${GOALS[v.goal].de} (${v.goal})`,
    `Level: ${LEVELS[v.level].de} (${v.level})`,
    `Tage pro Woche: ${v.days}`,
    `Ort: ${LOCATIONS[v.location].de} (${v.location})`,
    `Dauer je Einheit: ${v.minutesMin}–${v.minutesMax} Minuten`,
    `Wochensätze je Muskelgruppe: ${range.min}–${range.max}`,
    `Titel: ${GOALS[v.goal].de} · ${LEVELS[v.level].de} · ${v.days} Tage · ${LOCATIONS[v.location].de} · ${v.minutesMin}–${v.minutesMax} min`,
  ].join('\n');
}

function toContent(
  output: unknown,
  cell: GenerationCell,
  meta: Record<string, unknown>,
): { id: string; content: Record<string, unknown> } {
  if (cell.targetId === null) {
    throw new Error(`Vorlagen-Zelle ${cell.customId} ohne Ziel-ID.`);
  }
  const merged: Record<string, unknown> = {
    ...(output as Record<string, unknown>),
    id: cell.targetId,
    version: 1,
    status: 'draft',
    meta,
  };
  const content = Object.fromEntries(FIELD_ORDER.map((key) => [key, merged[key]]));
  return { id: cell.targetId, content };
}

const WARMUP =
  '5 Minuten locker aufwärmen (z. B. zügiges Gehen), dann Hüft-, Schulter- und Armkreisen und 1–2 leichte Aufwärmsätze der ersten Übung.';
const COOLDOWN = '3–5 Minuten locker ausklingen lassen und ruhig atmen.';

function item(order: number, exerciseId: string, sets: number, rest: number, rpe = 6) {
  return {
    order_no: order,
    exercise_id: exerciseId,
    sets,
    reps_min: 10,
    reps_max: 15,
    duration_s: null,
    rest_s: rest,
    rpe_target: rpe,
    superset_group: null,
    notes_de: null,
  };
}

/** Feste Beispiel-Antworten für den Probelauf: eine gültig, eine ungültig, eine Ablehnung, ein Fehler. */
function dryRunFixtures() {
  const valid = {
    title_de: 'Allgemeine Fitness · Einsteiger · 3 Tage · Zuhause · 30–45 min (Probelauf)',
    description_de:
      'Beispiel-Entwurf aus dem Probelauf: drei kurze Ganzkörper-Einheiten zu Hause mit Kurzhanteln und Widerstandsbändern. Belastung mit mehreren Wiederholungen Reserve, Steigerung über mehr Wiederholungen.',
    goal_type: 'general_fitness',
    experience_level: 'beginner',
    sessions_per_week: 3,
    minutes_min: 30,
    minutes_max: 45,
    location: 'home',
    required_equipment_ids: ['dumbbells', 'resistance_bands'],
    optional_equipment_ids: ['flat_bench', 'pull_up_bar'],
    sex: null,
    sessions: [
      {
        day_index: 1,
        name_de: 'Ganzkörper A',
        focus: 'full_body',
        warmup_de: WARMUP,
        cooldown_de: COOLDOWN,
        exercises: [
          item(1, 'goblet-kniebeuge', 2, 90),
          item(2, 'bodendruecken-kurzhantel', 2, 90),
          item(3, 'rudern-band', 2, 90),
          item(4, 'glute-bridge', 2, 90),
        ],
      },
      {
        day_index: 2,
        name_de: 'Ganzkörper B',
        focus: 'full_body',
        warmup_de: WARMUP,
        cooldown_de: COOLDOWN,
        exercises: [
          item(1, 'rumaenisches-kreuzheben-kurzhantel', 2, 90),
          item(2, 'schulterdruecken-kurzhantel', 2, 90),
          item(3, 'latziehen-band', 2, 90),
          item(4, 'split-kniebeuge', 2, 90),
        ],
      },
      {
        day_index: 3,
        name_de: 'Ganzkörper C',
        focus: 'full_body',
        warmup_de: WARMUP,
        cooldown_de: COOLDOWN,
        exercises: [
          item(1, 'ausfallschritt-rueckwaerts-kurzhantel', 2, 90),
          item(2, 'liegestuetz', 2, 90),
          item(3, 'vorgebeugtes-rudern-kurzhantel', 2, 90),
          item(4, 'wadenheben-kurzhantel', 2, 60),
        ],
      },
    ],
  };
  // Absichtlich ungültig: JSON-Format stimmt, aber 12 Sätze überschreiten die Schema-Grenze (Zod, Ü1).
  const invalid = {
    ...valid,
    title_de: 'Fettverlust · Einsteiger · 3 Tage · Zuhause · 30–45 min (Probelauf, ungültig)',
    goal_type: 'fat_loss',
    sessions: valid.sessions.map((session, index) =>
      index === 0
        ? { ...session, exercises: [{ ...item(1, 'goblet-kniebeuge', 12, 90) }] }
        : session,
    ),
  };
  return [
    {
      cell: cellFor('general_fitness', 'beginner', '3', 'home', '30-45'),
      response: { kind: 'json' as const, data: valid },
    },
    {
      cell: cellFor('fat_loss', 'beginner', '3', 'home', '30-45'),
      response: { kind: 'json' as const, data: invalid },
    },
    {
      cell: cellFor('muscle_gain', 'advanced', '4', 'gym', '60-75'),
      response: { kind: 'refusal' as const },
    },
    {
      cell: cellFor('fat_loss', 'advanced', '4', 'gym', '60-75'),
      response: { kind: 'errored' as const },
    },
  ];
}

export const planTemplateKind: ContentKindDefinition = {
  kind: 'plan_template',
  inputName: 'plan-templates',
  labelDe: 'Plan-Vorlagen',
  folder: 'plan-templates',
  contentSchema: planTemplateSchema,
  maxTokens: PLAN_TEMPLATE_MAX_TOKENS,
  dimensions: [
    {
      key: 'goal',
      labelDe: 'Ziel',
      values: TEMPLATE_GOAL_TYPES.map((value) => ({ value, aliases: GOALS[value].aliases })),
    },
    {
      key: 'level',
      labelDe: 'Level',
      values: TEMPLATE_EXPERIENCE_LEVELS.map((value) => ({
        value,
        aliases: [LEVELS[value].slug],
      })),
    },
    {
      key: 'days',
      labelDe: 'Tage pro Woche',
      values: DAYS.map((value) => ({ value, aliases: [`${value}t`] })),
    },
    {
      key: 'location',
      labelDe: 'Ort',
      values: (Object.keys(LOCATIONS) as TemplateLocation[]).map((value) => ({
        value,
        aliases: [LOCATIONS[value].slug],
      })),
    },
    {
      key: 'duration',
      labelDe: 'Minuten',
      values: TEMPLATE_DURATIONS.map((value) => ({ value, aliases: [`${value}min`] })),
    },
  ],
  cells: () =>
    TEMPLATE_GOAL_TYPES.flatMap((goal) =>
      TEMPLATE_EXPERIENCE_LEVELS.flatMap((level) =>
        DAYS.flatMap((days) =>
          (Object.keys(LOCATIONS) as TemplateLocation[]).flatMap((location) =>
            TEMPLATE_DURATIONS.map((duration) => cellFor(goal, level, days, location, duration)),
          ),
        ),
      ),
    ),
  isPresent: (cell, context) =>
    cell.targetId !== null && context.takenIds.plan_template.has(cell.targetId),
  systemPrompt,
  userPrompt: (cell) => userPrompt(cell),
  outputSchema: planTemplateOutputSchema,
  toContent,
  dryRunFixtures,
};
