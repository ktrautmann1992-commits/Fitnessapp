/**
 * Inhaltsart „Übung“ (content/exercises). Matrix: Bewegungsmuster × Geräte-Schwerpunkt.
 * Das Modell wählt die ID selbst (Format wie die Dateinamen); Kollisionen mit vorhandenen IDs fängt
 * content-collect ab.
 */
import {
  ALTERNATIVE_REASONS,
  CAUTION_TAGS,
  EQUIPMENT,
  exerciseSchema,
  MOVEMENT_PATTERNS,
  type MovementPattern,
} from '@fitnessapp/core';
import { z } from 'zod';

import { equipmentCatalogText, OUTPUT_FORMAT_TEXT, ROLE_TEXT, textRules } from './prompt-rules';
import type { ContentKindDefinition, GenerationCell, LibraryContext } from './types';

/** max_tokens je Übung (Plan Abschnitt 10/15). */
export const EXERCISE_MAX_TOKENS = 12_000;

/** Geräte-Schwerpunkte der Matrix. */
export const EXERCISE_FOCI = {
  langhantel: {
    labelDe: 'Langhantel',
    aliases: ['barbell'],
    hint: 'mit Langhantel (Rack/Bank nur, wenn nötig)',
  },
  kurzhantel: { labelDe: 'Kurzhanteln', aliases: ['dumbbells'], hint: 'mit Kurzhanteln' },
  kettlebell: { labelDe: 'Kettlebell', aliases: ['kettlebells'], hint: 'mit Kettlebell' },
  kabel_maschine: {
    labelDe: 'Kabelzug/Maschine (Studio)',
    aliases: ['kabel', 'maschine', 'studio'],
    hint: 'am Kabelzug oder an einer Maschine im Studio',
  },
  band: {
    labelDe: 'Widerstandsband',
    aliases: ['baender', 'resistance_bands'],
    hint: 'nur mit Widerstandsband',
  },
  koerpergewicht: {
    labelDe: 'Körpergewicht',
    aliases: ['bodyweight', 'ohne'],
    hint: 'nur mit dem eigenen Körpergewicht, ohne Geräte (höchstens Klimmzugstange oder Flachbank)',
  },
} as const;
export type ExerciseFocus = keyof typeof EXERCISE_FOCI;
const FOCUS_KEYS = Object.keys(EXERCISE_FOCI) as ExerciseFocus[];

const EQUIPMENT_IDS_WITHOUT_OTHER = EQUIPMENT.map((item) => item.id).filter(
  (id) => id !== 'other',
) as [string, ...string[]];

/** Feldreihenfolge der Dateien (wie exerciseSchema). */
const FIELD_ORDER = Object.keys(exerciseSchema.shape);

function cellFor(pattern: MovementPattern, focus: ExerciseFocus): GenerationCell {
  return {
    customId: `ex-${pattern}-${focus}`,
    targetId: null,
    label: `${pattern} · ${EXERCISE_FOCI[focus].labelDe}`,
    values: { movement_pattern: pattern, focus },
  };
}

function patternOf(cell: GenerationCell): MovementPattern {
  const pattern = cell.values.movement_pattern as MovementPattern;
  if (!MOVEMENT_PATTERNS.includes(pattern)) {
    throw new Error(`Unbekanntes Bewegungsmuster in ${cell.customId}.`);
  }
  return pattern;
}

function focusOf(cell: GenerationCell): ExerciseFocus {
  const focus = cell.values.focus as ExerciseFocus;
  if (!FOCUS_KEYS.includes(focus)) {
    throw new Error(`Unbekannter Geräte-Schwerpunkt in ${cell.customId}.`);
  }
  return focus;
}

/** Aktive Übungen (nicht zurückgezogen) mit diesem Bewegungsmuster. */
function samePattern(context: LibraryContext, pattern: MovementPattern) {
  return context.exercises.filter(
    (exercise) => exercise.status !== 'archived' && exercise.movement_pattern === pattern,
  );
}

const S = exerciseSchema.shape;

/** Zod-Schema der Modell-Antwort für eine Zelle (Katalog-IDs als erlaubte Werte). */
export function exerciseOutputSchema(cell: GenerationCell, context: LibraryContext) {
  const pattern = patternOf(cell);
  const alternativeIds = samePattern(context, pattern).map((exercise) => exercise.id);
  const alternativeId =
    alternativeIds.length > 0 ? z.enum(alternativeIds as [string, ...string[]]) : S.id;
  return z.strictObject({
    id: S.id,
    name_de: S.name_de,
    name_en: S.name_en,
    aliases_de: S.aliases_de,
    movement_pattern: z.literal(pattern),
    primary_muscles: S.primary_muscles,
    secondary_muscles: S.secondary_muscles,
    equipment_ids: z.array(z.enum(EQUIPMENT_IDS_WITHOUT_OTHER)).max(4),
    mechanics: S.mechanics,
    load_type: S.load_type,
    unilateral: S.unilateral,
    difficulty: S.difficulty,
    caution_tags: S.caution_tags,
    description_de: S.description_de,
    steps_de: S.steps_de,
    tips_de: S.tips_de,
    common_mistakes_de: S.common_mistakes_de,
    safety_note_de: S.safety_note_de,
    alternatives: z
      .array(
        z.strictObject({
          alternative_id: alternativeId,
          reason: z.enum(ALTERNATIVE_REASONS),
          priority: S.alternatives.element.shape.priority,
        }),
      )
      .max(10),
  });
}

function systemPrompt(context: LibraryContext): string {
  const existing = context.exercises
    .filter((exercise) => exercise.status !== 'archived')
    .map(
      (exercise) =>
        `- ${exercise.id}: ${exercise.name_de} | ${exercise.movement_pattern} | Geräte: ${
          exercise.equipment_ids.join(', ') || 'keine'
        }`,
    )
    .join('\n');
  return [
    ROLE_TEXT,
    '',
    'Aufgabe: Beschreibe genau EINE Kraft- oder Fitnessübung für die Übungsbibliothek der App.',
    '',
    textRules(),
    '',
    'Regeln für Übungen:',
    '- id: Kleinbuchstaben, Ziffern und Bindestriche, deutsch, ohne Umlaute (ä → ae, ö → oe, ü → ue, ß → ss), z. B. „rumaenisches-kreuzheben-kurzhantel“. Die ID darf es noch nicht geben (Liste unten).',
    '- name_de: gängiger deutscher Name; name_en: gängige englische Bezeichnung (damit man die Übung im Studio wiedererkennt).',
    '- description_de: 1–3 Sätze, was die Übung ist und wofür sie im Training gut ist (keine Gesundheitsversprechen).',
    '- steps_de: 2–8 kurze Schritte in der Grundform („Füße schulterbreit aufstellen.“). tips_de und common_mistakes_de: je 1–6 kurze Punkte.',
    '- safety_note_de: allgemeiner Sicherheitshinweis zur Technik und Last.',
    '- primary_muscles: 1–4 Hauptmuskeln; secondary_muscles: Nebenmuskeln, nie doppelt mit den Hauptmuskeln.',
    '- equipment_ids: ALLE nötigen Geräte aus dem Katalog; leer bei Übungen ohne Geräte.',
    '- mechanics: compound = Grundübung (mehrere Gelenke), isolation = Isolationsübung.',
    '- load_type: weight (Zusatzgewicht), bodyweight, band oder time (Halteübung/Zeit).',
    '- difficulty: 1 = einfach, 2 = mittel, 3 = anspruchsvoll.',
    `- caution_tags (Eigenschaften, keine Diagnosen): ${CAUTION_TAGS.join(', ')} – high_impact = Sprünge, spinal_loading = schwere Last auf der Wirbelsäule, overhead = Arme über Kopf mit Last, long_supine = lange Rückenlage, high_skill = technisch anspruchsvoll.`,
    '- alternatives: 0–4 vorhandene Übungen mit DEMSELBEN Bewegungsmuster (reason: other_equipment, easier, harder oder home), priority 1 = beste Alternative.',
    '',
    'Geräte-Katalog (ID: Name):',
    equipmentCatalogText(),
    '',
    'Vorhandene Übungen (ID: Name | Bewegungsmuster | Geräte):',
    existing || '- (noch keine)',
    '',
    OUTPUT_FORMAT_TEXT,
  ].join('\n');
}

function userPrompt(cell: GenerationCell, context: LibraryContext): string {
  const pattern = patternOf(cell);
  const focus = focusOf(cell);
  const siblings = samePattern(context, pattern)
    .map((exercise) => exercise.id)
    .join(', ');
  return [
    `Bewegungsmuster: ${pattern}`,
    `Geräte-Schwerpunkt: ${EXERCISE_FOCI[focus].labelDe} – die Übung wird ${EXERCISE_FOCI[focus].hint} ausgeführt.`,
    `Vorhandene Übungen mit diesem Muster: ${siblings || 'keine'}.`,
    'Beschreibe eine sinnvolle, verbreitete Übung, die es in der Bibliothek noch nicht gibt.',
  ].join('\n');
}

function toContent(
  output: unknown,
  _cell: GenerationCell,
  meta: Record<string, unknown>,
): { id: string; content: Record<string, unknown> } {
  const data = output as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...data, version: 1, status: 'draft', meta };
  const content = Object.fromEntries(FIELD_ORDER.map((key) => [key, merged[key]]));
  return { id: String(data.id), content };
}

/** Feste Beispiel-Antworten für den Probelauf: zwei gültig, eine ungültig (Grenzen), eine Ablehnung. */
function dryRunFixtures() {
  return [
    {
      cell: cellFor('squat', 'koerpergewicht'),
      response: {
        kind: 'json' as const,
        data: {
          id: 'probelauf-wandsitzen',
          name_de: 'Wandsitzen (Probelauf)',
          name_en: 'Wall Sit',
          aliases_de: [],
          movement_pattern: 'squat',
          primary_muscles: ['quadriceps'],
          secondary_muscles: ['glutes'],
          equipment_ids: [],
          mechanics: 'compound',
          load_type: 'time',
          unilateral: false,
          difficulty: 1,
          caution_tags: [],
          description_de:
            'Beispiel-Entwurf aus dem Probelauf: Halteübung mit dem Rücken an der Wand, die Oberschenkel sind etwa waagerecht.',
          steps_de: [
            'Mit dem Rücken an eine Wand lehnen, Füße etwa einen Schritt vor der Wand.',
            'An der Wand nach unten gleiten, bis die Knie etwa im rechten Winkel sind.',
            'Position halten und ruhig weiteratmen.',
          ],
          tips_de: ['Gewicht gleichmäßig auf beide Füße verteilen.'],
          common_mistakes_de: ['Knie fallen nach innen.'],
          safety_note_de:
            'Nur so tief gehen, wie es angenehm bleibt. Bei Schmerzen, Schwindel oder ungewohnten Beschwerden die Übung beenden.',
          alternatives: [
            { alternative_id: 'kniebeuge-koerpergewicht', reason: 'other_equipment', priority: 1 },
          ],
        },
      },
    },
    {
      cell: cellFor('core_anti_rotation', 'koerpergewicht'),
      response: {
        kind: 'json' as const,
        data: {
          id: 'probelauf-seitstuetz',
          name_de: 'Seitstütz (Probelauf)',
          name_en: 'Side Plank',
          aliases_de: [],
          movement_pattern: 'core_anti_rotation',
          primary_muscles: ['obliques'],
          secondary_muscles: ['abs'],
          equipment_ids: [],
          mechanics: 'isolation',
          load_type: 'time',
          unilateral: true,
          difficulty: 1,
          caution_tags: [],
          description_de:
            'Beispiel-Entwurf aus dem Probelauf: seitliche Halteübung auf Unterarm und Füßen für eine stabile Körpermitte.',
          steps_de: [
            'Seitlich auf den Unterarm stützen, der Ellbogen ist unter der Schulter.',
            'Hüfte anheben, bis Kopf, Hüfte und Füße eine Linie bilden.',
            'Position halten, danach die Seite wechseln.',
          ],
          tips_de: ['Bauch und Gesäß leicht anspannen.'],
          common_mistakes_de: ['Hüfte sinkt Richtung Boden.'],
          safety_note_de:
            'Haltedauer langsam steigern. Bei Schmerzen, Schwindel oder ungewohnten Beschwerden die Übung beenden.',
          alternatives: [
            { alternative_id: 'pallof-press-band', reason: 'other_equipment', priority: 1 },
          ],
        },
      },
    },
    {
      // Absichtlich ungültig: hält das JSON-Format ein, verletzt aber Längen-Grenzen (prüft Zod, Ü1).
      cell: cellFor('hinge', 'band'),
      response: {
        kind: 'json' as const,
        data: {
          id: 'probelauf-ungueltig',
          name_de: 'Ungültiger Entwurf (Probelauf)',
          name_en: 'Invalid Draft',
          aliases_de: [],
          movement_pattern: 'hinge',
          primary_muscles: ['hamstrings'],
          secondary_muscles: [],
          equipment_ids: ['resistance_bands'],
          mechanics: 'compound',
          load_type: 'band',
          unilateral: false,
          difficulty: 1,
          caution_tags: [],
          description_de: 'Zu kurz.',
          steps_de: ['Nur ein Schritt.'],
          tips_de: ['Tipp.'],
          common_mistakes_de: ['Fehler.'],
          safety_note_de: 'Kurz.',
          alternatives: [],
        },
      },
    },
    { cell: cellFor('carry', 'kurzhantel'), response: { kind: 'refusal' as const } },
  ];
}

export const exerciseKind: ContentKindDefinition = {
  kind: 'exercise',
  inputName: 'exercises',
  labelDe: 'Übungen',
  folder: 'exercises',
  contentSchema: exerciseSchema,
  maxTokens: EXERCISE_MAX_TOKENS,
  dimensions: [
    {
      key: 'movement_pattern',
      labelDe: 'Bewegungsmuster',
      values: MOVEMENT_PATTERNS.map((value) => ({ value, aliases: [] })),
    },
    {
      key: 'focus',
      labelDe: 'Geräte-Schwerpunkt',
      values: FOCUS_KEYS.map((value) => ({ value, aliases: EXERCISE_FOCI[value].aliases })),
    },
  ],
  cells: () => MOVEMENT_PATTERNS.flatMap((pattern) => FOCUS_KEYS.map((f) => cellFor(pattern, f))),
  // Übungen werden nie übersprungen: Pro Zelle kann es mehrere sinnvolle Übungen geben.
  isPresent: () => false,
  systemPrompt,
  userPrompt,
  outputSchema: exerciseOutputSchema,
  toContent,
  dryRunFixtures,
};
