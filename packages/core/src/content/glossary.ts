import { z } from 'zod';

import { GLOSSARY_LIMITS } from '../constants';
import type { MovementPattern } from '../enums';
import { findEquipment } from '../equipment';
import type { PlanLibrary } from '../plan/content-pool';
import {
  type EquipmentProfile,
  equipmentProfile,
  isExerciseFeasible,
} from '../plan/equipment-profile';
import { isExerciseAllowed, type PlanSafetyRules } from '../plan/safety';
import { type Exercise, needsExpertReviewLabel } from './schemas';

/**
 * Übungs-Glossar (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 7.1, Etappe G1): Suche, Filter und Anzeigemodell einer Übung –
 * nur Text aus den vorhandenen Feldern (Bilder/Videos folgen in G2). Rein und deterministisch; die Texte der
 * Bereiche, Schwierigkeit usw. stehen in der App (i18n), hier nur Codes.
 *
 * Grundsätze:
 * - Die Liste zeigt nur `library.exercises` (live: `published`; Testmodus: Entwürfe ohne roten Befund). Archivierte
 *   Übungen sind nur per Direkt-ID aus `displayExercises` erreichbar (z. B. aus dem Verlauf), nie in der Liste.
 * - `availableForMe` sagt nur JA/NEIN nach den AKTUELLEN Sicherheitsregeln (isExerciseAllowed) – ohne Grund, damit
 *   die Anzeige keinen Gesundheitsbezug verrät.
 * - „Ähnliche Übungen“ sind nur erlaubte und machbare Übungen mit gleichem Bewegungsmuster, nicht schwerer und ohne
 *   Wechsel Wiederholung ↔ Halten (Regeln S-1 bis S-5 und S-8 aus Abschnitt 4.1, ohne S-6/S-7).
 */

// ---------------------------------------------------------------------------------------------------------
// Bereiche
// ---------------------------------------------------------------------------------------------------------

/** Bereiche des Glossars (Reihenfolge = Anzeige der Filter-Chips). Texte in i18n `glossary.groups`. */
export const GLOSSARY_GROUP_IDS = [
  'legs',
  'hips',
  'push',
  'pull',
  'shoulders',
  'core',
  'calves',
  'conditioning',
] as const;
export type GlossaryGroup = (typeof GLOSSARY_GROUP_IDS)[number];

/** Bereich → Bewegungsmuster. Jedes Muster aus MOVEMENT_PATTERNS steht in GENAU einem Bereich (Test). */
export const GLOSSARY_GROUPS: Readonly<Record<GlossaryGroup, readonly MovementPattern[]>> = {
  legs: ['squat', 'lunge', 'knee_extension', 'knee_flexion'],
  hips: ['hinge', 'hip_extension'],
  push: ['horizontal_push', 'vertical_push', 'elbow_extension'],
  pull: ['horizontal_pull', 'vertical_pull', 'elbow_flexion'],
  shoulders: ['shoulder_isolation'],
  core: ['core_anti_extension', 'core_anti_rotation', 'core_flexion'],
  calves: ['calf_raise'],
  conditioning: ['conditioning', 'mobility', 'carry'],
};

const GROUP_OF = new Map<MovementPattern, GlossaryGroup>(
  GLOSSARY_GROUP_IDS.flatMap((group) =>
    GLOSSARY_GROUPS[group].map((pattern) => [pattern, group] as const),
  ),
);

/** Bereich eines Bewegungsmusters (unbekannt – kann laut Schema nicht vorkommen – zählt zu Ausdauer & Beweglichkeit). */
export function glossaryGroupOf(pattern: MovementPattern): GlossaryGroup {
  return GROUP_OF.get(pattern) ?? 'conditioning';
}

// ---------------------------------------------------------------------------------------------------------
// Suchtext
// ---------------------------------------------------------------------------------------------------------

const UMLAUTS: Readonly<Record<string, string>> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

/**
 * Text für den Vergleich: Kleinschreibung, ä→ae, ö→oe, ü→ue, ß→ss, Akzente weg (é→e), alle übrigen Zeichen
 * (Bindestriche, Satzzeichen, Emoji) werden zu Leerzeichen, Leerraum vereinheitlicht. Ergebnis: Wörter mit genau
 * einem Leerzeichen dazwischen, ohne Leerraum am Rand („Rumänisches  Kreuz-Heben!“ → „rumaenisches kreuz heben“).
 */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äöüß]/g, (char) => UMLAUTS[char] ?? char)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Ohne Wortgrenzen: „Kreuzheben“ und „kreuz heben“ werden gleich („kreuzheben“). */
function compact(text: string): string {
  return normalizeSearchText(text).replace(/ /g, '');
}

// ---------------------------------------------------------------------------------------------------------
// Suche und Filter
// ---------------------------------------------------------------------------------------------------------

/** Ausrüstungs-Filter: ohne Geräte · machbar mit den eigenen Geräten zu Hause · Studio (braucht Geräte). */
export const GLOSSARY_EQUIPMENT_FILTERS = ['none', 'my_home', 'gym'] as const;
export type GlossaryEquipmentFilter = (typeof GLOSSARY_EQUIPMENT_FILTERS)[number];

/** Such-Optionen (Zod an der Grenze, z. B. für Link-Parameter). Leere Listen = kein Filter. */
export const glossarySearchOptionsSchema = z.strictObject({
  query: z.string().optional(),
  groups: z.array(z.enum(GLOSSARY_GROUP_IDS)).optional(),
  equipment: z.enum(GLOSSARY_EQUIPMENT_FILTERS).nullable().optional(),
  difficulty: z.array(z.number().int().min(1).max(3)).optional(),
});
export type GlossarySearchOptions = z.infer<typeof glossarySearchOptionsSchema>;

export interface GlossarySearchContext {
  /** Geräte zu Hause (Filter `my_home`); fehlt = nur Übungen ohne Geräte. */
  readonly homeProfile?: Pick<EquipmentProfile, 'available'>;
}

/** Worüber eine Übung gefunden wurde – zugleich die Rangfolge (kleiner = weiter oben). */
export const GLOSSARY_MATCHES = ['name_start', 'name', 'alias', 'name_en', 'description'] as const;
export type GlossaryMatch = (typeof GLOSSARY_MATCHES)[number];

export interface GlossaryHit {
  readonly exercise: Exercise;
  readonly group: GlossaryGroup;
  /** null = ohne Suchwort (alle). */
  readonly match: GlossaryMatch | null;
}

const NO_EQUIPMENT: Pick<EquipmentProfile, 'available'> = { available: new Set() };
const GYM_PROFILE = equipmentProfile('gym', []);

/** Suchwort normalisiert und auf GLOSSARY_LIMITS.queryMaxChars gekürzt; leer = keine Suche. */
function queryTokens(query: string | undefined): string[] {
  const normalized = normalizeSearchText((query ?? '').slice(0, GLOSSARY_LIMITS.queryMaxChars));
  return normalized === '' ? [] : normalized.split(' ');
}

/** Alle Wörter des Suchworts kommen im Feld vor (Wortgrenzen egal: „kreuz heben“ findet „Kreuzheben“). */
function containsAll(field: string, tokens: readonly string[]): boolean {
  const value = compact(field);
  return tokens.every((token) => value.includes(token));
}

function matchOf(exercise: Exercise, tokens: readonly string[]): GlossaryMatch | null {
  if (compact(exercise.name_de).startsWith(tokens.join(''))) return 'name_start';
  if (containsAll(exercise.name_de, tokens)) return 'name';
  if (exercise.aliases_de.some((alias) => containsAll(alias, tokens))) return 'alias';
  if (containsAll(exercise.name_en, tokens)) return 'name_en';
  if (containsAll(exercise.description_de, tokens)) return 'description';
  return null;
}

function passesEquipment(
  exercise: Exercise,
  filter: GlossaryEquipmentFilter | null | undefined,
  ctx: GlossarySearchContext,
): boolean {
  switch (filter) {
    case 'none':
      return exercise.equipment_ids.length === 0;
    case 'my_home':
      return isExerciseFeasible(exercise, ctx.homeProfile ?? NO_EQUIPMENT);
    case 'gym':
      return exercise.equipment_ids.length > 0 && isExerciseFeasible(exercise, GYM_PROFILE);
    default:
      return true;
  }
}

const byNameDe = (a: Exercise, b: Exercise) =>
  a.name_de.localeCompare(b.name_de, 'de') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Glossar-Liste: nur `library.exercises` (nie archivierte), gefiltert nach Bereich, Ausrüstung und Schwierigkeit,
 * dann nach Suchwort. Rangfolge: Name beginnt mit dem Suchwort → Name enthält es → Alias → englischer Name →
 * Beschreibung; bei Gleichstand deutscher Name (deutsche Sortierung). Ohne Suchwort: alle, nach Name.
 * Bibliothek fehlt (null) → leere Liste.
 */
export function searchExercises(
  library: Pick<PlanLibrary, 'exercises'> | null,
  options: GlossarySearchOptions,
  ctx: GlossarySearchContext = {},
): GlossaryHit[] {
  if (!library) return [];
  const tokens = queryTokens(options.query);
  const groups = new Set(options.groups ?? []);
  const difficulty = new Set(options.difficulty ?? []);
  const hits: GlossaryHit[] = [];
  for (const exercise of library.exercises.values()) {
    const group = glossaryGroupOf(exercise.movement_pattern);
    if (groups.size > 0 && !groups.has(group)) continue;
    if (difficulty.size > 0 && !difficulty.has(exercise.difficulty)) continue;
    if (!passesEquipment(exercise, options.equipment, ctx)) continue;
    const match = tokens.length === 0 ? null : matchOf(exercise, tokens);
    if (tokens.length > 0 && match === null) continue;
    hits.push({ exercise, group, match });
  }
  const rank = (hit: GlossaryHit) => (hit.match === null ? 0 : GLOSSARY_MATCHES.indexOf(hit.match));
  return hits.sort((a, b) => rank(a) - rank(b) || byNameDe(a.exercise, b.exercise));
}

// ---------------------------------------------------------------------------------------------------------
// Anzeigemodell einer Übung
// ---------------------------------------------------------------------------------------------------------

export type GlossaryDifficulty = 'easy' | 'medium' | 'hard';

export interface GlossaryEquipmentName {
  readonly id: string;
  /** Name aus dem Geräte-Katalog; unbekannte ID → die ID selbst. */
  readonly name: string;
}

export interface GlossaryEntry {
  readonly id: string;
  readonly name: string;
  readonly nameEn: string;
  readonly aliases: readonly string[];
  readonly description: string;
  readonly steps: readonly string[];
  readonly tips: readonly string[];
  readonly mistakes: readonly string[];
  readonly safetyNote: string;
  readonly group: GlossaryGroup;
  readonly equipment: readonly GlossaryEquipmentName[];
  readonly difficulty: GlossaryDifficulty;
  /** Wiederholungen oder Halten (Halteübung = `load_type: time`). */
  readonly loadType: 'reps' | 'hold';
  readonly unilateral: boolean;
  /** KI-Entwurf ohne fachliche Prüfung (needsExpertReviewLabel) → Kennzeichen „Noch nicht fachlich geprüft“. */
  readonly notReviewed: boolean;
  /** Entwurf (nur im Testmodus in der Bibliothek) → Kennzeichen „Testinhalt“. */
  readonly isDraft: boolean;
  /** Zurückgezogen – nur per Direkt-ID (z. B. aus dem Verlauf) erreichbar. */
  readonly archived: boolean;
  readonly feasible: { readonly home: boolean; readonly gym: boolean };
  /** Kommt im aktiven Plan vor. */
  readonly inMyPlan: boolean;
  /**
   * Nimmt die App die Übung nach den AKTUELLEN Sicherheitsregeln in den Plan auf? Ohne Grund (kein
   * Gesundheitsbezug); null = Regeln unbekannt (keine Aussage).
   */
  readonly availableForMe: boolean | null;
  /** Erlaubte, machbare Übungen mit gleichem Muster, nicht schwerer (höchstens GLOSSARY_LIMITS.similarMax). */
  readonly similar: readonly { readonly id: string; readonly name: string }[];
}

export interface GlossaryContext {
  /** Bibliothek (Liste aus `exercises`, Direkt-ID auch aus `displayExercises`); null = nicht geladen. */
  readonly library: Pick<PlanLibrary, 'exercises' | 'displayExercises'> | null;
  /** AKTUELLE Sicherheitsregeln; null = unbekannt → availableForMe null, keine ähnlichen Übungen. */
  readonly rules: Pick<PlanSafetyRules, 'excludedCautionTags' | 'cautious'> | null;
  /** Geräte zu Hause; fehlt = keine Geräte. */
  readonly homeProfile?: Pick<EquipmentProfile, 'available'>;
  /**
   * Geräte an den Orten, an denen die Person trainiert („Ähnliche Übungen“ müssen an mindestens einem machbar sein);
   * fehlt bzw. leer = Studio.
   */
  readonly trainingProfiles?: readonly Pick<EquipmentProfile, 'available'>[];
  /** Übungs-IDs des aktiven Plans. */
  readonly planExerciseIds?: ReadonlySet<string>;
}

const DIFFICULTY: Readonly<Record<number, GlossaryDifficulty>> = {
  1: 'easy',
  2: 'medium',
  3: 'hard',
};

/** Geräte-Namen aus dem Katalog (Reihenfolge wie in der Übung). */
export function equipmentNames(ids: readonly string[]): GlossaryEquipmentName[] {
  return ids.map((id) => ({ id, name: findEquipment(id)?.nameDe ?? id }));
}

/** Übung zu einer ID: zuerst die Bibliothek, sonst (archiviert) die Anzeige-Bibliothek; null = unbekannt. */
export function findGlossaryExercise(
  library: GlossaryContext['library'],
  exerciseId: string,
): Exercise | null {
  if (!library) return null;
  return library.exercises.get(exerciseId) ?? library.displayExercises?.get(exerciseId) ?? null;
}

/**
 * „Ähnliche Übungen“ (Regeln aus 4.1 ohne S-6/S-7): gleiches Muster (S-1), erlaubt nach den aktuellen Regeln (S-2),
 * nicht schwerer (S-3), kein Wechsel Wiederholung ↔ Halten (S-4), machbar an einem Trainingsort (S-5), nur aus
 * `library.exercises` (S-8). Reihenfolge wie findSubstitute: Alternativen (vorsichtig: `easier` zuerst, sonst
 * Priorität) → Alternativen der Alternativen → Bibliothek mit gleichem Muster und gemeinsamem Hauptmuskel
 * (schwierigste zuerst, gleiche Belastungsart, ID). Ohne Regeln: keine (vorsichtig).
 */
export function similarExercises(original: Exercise, ctx: GlossaryContext): Exercise[] {
  const library = ctx.library?.exercises;
  const rules = ctx.rules;
  if (!library || !rules) return [];
  const profiles =
    ctx.trainingProfiles && ctx.trainingProfiles.length > 0 ? ctx.trainingProfiles : [GYM_PROFILE];
  const isTime = original.load_type === 'time';
  const ok = (candidate: Exercise | undefined): candidate is Exercise =>
    candidate !== undefined &&
    candidate.id !== original.id &&
    candidate.movement_pattern === original.movement_pattern &&
    candidate.difficulty <= original.difficulty &&
    (candidate.load_type === 'time') === isTime &&
    isExerciseAllowed(candidate, rules) &&
    profiles.some((profile) => isExerciseFeasible(candidate, profile));
  const sortAlternatives = (alternatives: Exercise['alternatives']) =>
    [...alternatives].sort((a, b) => {
      if (rules.cautious) {
        const ea = a.reason === 'easier' ? 0 : 1;
        const eb = b.reason === 'easier' ? 0 : 1;
        if (ea !== eb) return ea - eb;
      }
      return a.priority - b.priority || (a.alternative_id < b.alternative_id ? -1 : 1);
    });
  const result: Exercise[] = [];
  const add = (candidate: Exercise | undefined) => {
    if (ok(candidate) && !result.some((e) => e.id === candidate.id)) result.push(candidate);
  };
  const firstLevel = sortAlternatives(original.alternatives);
  firstLevel.forEach((alt) => add(library.get(alt.alternative_id)));
  for (const alt of firstLevel) {
    const parent = library.get(alt.alternative_id);
    if (parent)
      sortAlternatives(parent.alternatives).forEach((s) => add(library.get(s.alternative_id)));
  }
  const sharesPrimary = (c: Exercise) =>
    c.primary_muscles.some((m) => original.primary_muscles.includes(m));
  [...library.values()]
    .filter((c) => ok(c) && sharesPrimary(c))
    .sort(
      (a, b) =>
        b.difficulty - a.difficulty ||
        Number(b.load_type === original.load_type) - Number(a.load_type === original.load_type) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .forEach(add);
  return result.slice(0, GLOSSARY_LIMITS.similarMax);
}

/** Anzeigemodell einer Übung für die Glossar-Detailseite; null = unbekannte ID oder Bibliothek fehlt. */
export function glossaryEntry(exerciseId: string, ctx: GlossaryContext): GlossaryEntry | null {
  const exercise = findGlossaryExercise(ctx.library, exerciseId);
  if (!exercise) return null;
  return {
    id: exercise.id,
    name: exercise.name_de,
    nameEn: exercise.name_en,
    aliases: exercise.aliases_de,
    description: exercise.description_de,
    steps: exercise.steps_de,
    tips: exercise.tips_de,
    mistakes: exercise.common_mistakes_de,
    safetyNote: exercise.safety_note_de,
    group: glossaryGroupOf(exercise.movement_pattern),
    equipment: equipmentNames(exercise.equipment_ids),
    difficulty: DIFFICULTY[exercise.difficulty] ?? 'hard',
    loadType: exercise.load_type === 'time' ? 'hold' : 'reps',
    unilateral: exercise.unilateral,
    notReviewed: needsExpertReviewLabel(exercise.meta),
    isDraft: exercise.status === 'draft',
    archived: exercise.status === 'archived',
    feasible: {
      home: isExerciseFeasible(exercise, ctx.homeProfile ?? NO_EQUIPMENT),
      gym: isExerciseFeasible(exercise, GYM_PROFILE),
    },
    inMyPlan: ctx.planExerciseIds?.has(exercise.id) ?? false,
    availableForMe: ctx.rules ? isExerciseAllowed(exercise, ctx.rules) : null,
    similar: similarExercises(exercise, ctx).map((e) => ({ id: e.id, name: e.name_de })),
  };
}
