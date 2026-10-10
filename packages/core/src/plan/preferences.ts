import { z } from 'zod';

import { EXERCISE_PREFERENCE_LIMITS, REST_RANGES_S, SWAP_RULES } from '../constants';
import { contentIdSchema, type Exercise } from '../content/schemas';
import {
  EQUIPMENT_LOCATIONS,
  EXERCISE_PREFERENCE_KINDS,
  type EquipmentLocation,
  type MovementPattern,
  type PlannedSessionKind,
} from '../enums';
import type { PlannedExerciseDraft } from './adapt';
import { type EquipmentProfile, isExerciseFeasible } from './equipment-profile';
import { isExerciseAllowed, type PlanSafetyRules } from './safety';

/**
 * Übungen tauschen: Präferenzen „Mag ich nicht“ / „Hier nicht machbar“ je Ort und die Tausch-Kandidaten
 * (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md Abschnitte 4, 5.1, 7.2; Etappe T1). Rein und deterministisch.
 *
 * Feste Rangfolge (4): Sicherheitsregeln → Machbarkeit am Ort (Geräte, „Hier nicht machbar“) → „Mag ich nicht“ →
 * „Nur heute“ → Vorlage. Eine Präferenz bzw. ein Day-Swap bringt NIE eine gesperrte Übung zurück und setzt nie etwas
 * Schwereres ein: Jeder Kandidat wird bei JEDER Anzeige neu gegen die Regeln S-1 bis S-8 geprüft.
 *
 * Begriffe (4.0, Wächter B2): S = gespeicherte Übung des Termins (eindeutig über `storedOrderNo`), X = angezeigte
 * Übung nach der vorigen Schicht (Sicherheitsstufe bzw. Präferenz). Die Präferenz hängt an der ANGEZEIGTEN Übung.
 *
 * Datenschutz (Abschnitt 6): Präferenzen sind kein Gesundheitsdatum (nur „mag ich nicht“/„hier nicht machbar“, kein
 * Freitext). Sie werden nur hier für Anzeige und Tausch ausgewertet – nie an Analytics, Logs oder Partner.
 */

// ---------------------------------------------------------------------------------------------------------
// Typen und Schemas
// ---------------------------------------------------------------------------------------------------------

const timestamp = z.iso.datetime({ offset: true });

/**
 * Eine Präferenz (später Tabelle `exercise_preferences`, Etappe T3): Übung (die ANGEZEIGTE, 4.0), Ort, Grund und
 * optional der gewählte Ersatz. Strikt – wird beim Lesen aus Speicher/Datenbank und vor dem Schreiben geprüft.
 */
export const exercisePreferenceSchema = z
  .strictObject({
    exercise_id: contentIdSchema,
    location: z.enum(EQUIPMENT_LOCATIONS),
    kind: z.enum(EXERCISE_PREFERENCE_KINDS),
    replacement_exercise_id: contentIdSchema.nullable(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .refine((p) => p.replacement_exercise_id !== p.exercise_id, {
    path: ['replacement_exercise_id'],
    message: 'Der Ersatz muss eine andere Übung sein.',
  });

export type ExercisePreference = z.output<typeof exercisePreferenceSchema>;

/**
 * Paar aus gespeicherter (S) und angezeigter Übung (X) einer Einheit (Wächter B1/B2): `storedOrderNo` ist die
 * `order_no` der gespeicherten Übung – darüber bekommt jeder Tagebuch-Eintrag die richtige `planned_exercise_id`.
 */
export interface ExercisePair {
  readonly stored: PlannedExerciseDraft;
  readonly shown: PlannedExerciseDraft;
  readonly storedOrderNo: number;
}

/** Ein Tausch einer Schicht (Präferenz bzw. Day-Swap): gespeicherte Position, vorher angezeigte und neue Übung. */
export interface SwapRecord {
  readonly storedOrderNo: number;
  readonly from: string;
  readonly to: string;
}

// ---------------------------------------------------------------------------------------------------------
// Präferenzen je Ort
// ---------------------------------------------------------------------------------------------------------

/**
 * Präferenzen eines Orts als Map exercise_id → Präferenz. Bei MEHRDEUTIGEM Ort (4.4, Wächter S4) die Vereinigung
 * beider Orte: bei Konflikt gilt `not_feasible` vor `dislike` (mehr Ausschluss ist die vorsichtige Richtung); der
 * gewählte Ersatz kommt zuerst aus dem Eintrag des (geratenen) Orts `location`, sonst aus dem anderen.
 */
export function preferencesAt(
  prefs: readonly ExercisePreference[],
  location: EquipmentLocation,
  ambiguous = false,
): ReadonlyMap<string, ExercisePreference> {
  const result = new Map<string, ExercisePreference>();
  // Erst der (geratene) Ort, dann – nur bei mehrdeutigem Ort – der andere. Doppelte Einträge (kaputter Speicher)
  // werden genauso zusammengeführt: `not_feasible` vor `dislike`, der erste gewählte Ersatz gewinnt.
  const ordered = [
    ...prefs.filter((p) => p.location === location),
    ...(ambiguous ? prefs.filter((p) => p.location !== location) : []),
  ];
  for (const pref of ordered) {
    const own = result.get(pref.exercise_id);
    result.set(
      pref.exercise_id,
      own
        ? {
            ...own,
            kind:
              own.kind === 'not_feasible' || pref.kind === 'not_feasible'
                ? 'not_feasible'
                : 'dislike',
            replacement_exercise_id: own.replacement_exercise_id ?? pref.replacement_exercise_id,
          }
        : pref,
    );
  }
  return result;
}

/** Wie viele Ausschlüsse an einem Ort (Hinweis „viele Ausschlüsse“; bei mehrdeutigem Ort die Vereinigung). */
export function exclusionCountAt(
  prefs: readonly ExercisePreference[],
  location: EquipmentLocation,
  ambiguous = false,
): number {
  return preferencesAt(prefs, location, ambiguous).size;
}

/** Präferenz anlegen bzw. ersetzen (Schlüssel: Übung + Ort). Rein – für Testmodus und Warteschlange. */
export function upsertPreference(
  list: readonly ExercisePreference[],
  pref: ExercisePreference,
): ExercisePreference[] {
  return [
    ...list.filter((p) => !(p.exercise_id === pref.exercise_id && p.location === pref.location)),
    pref,
  ];
}

/** Präferenz entfernen („Wieder zulassen“). */
export function removePreference(
  list: readonly ExercisePreference[],
  exerciseId: string,
  location: EquipmentLocation,
): ExercisePreference[] {
  return list.filter((p) => !(p.exercise_id === exerciseId && p.location === location));
}

// ---------------------------------------------------------------------------------------------------------
// Kandidaten (4.1)
// ---------------------------------------------------------------------------------------------------------

export type SwapMode = 'today' | 'always';

export interface SwapContext {
  /** Woraus ein Kandidat kommen darf (S-8): nur `PlanLibrary.exercises`, nie archivierte Übungen. */
  readonly library: ReadonlyMap<string, Exercise>;
  /** Zum Nachschlagen von S und X (auch archivierte des laufenden Plans); Standard: `library`. */
  readonly lookup?: ReadonlyMap<string, Exercise>;
  /** Geräte am Ort der Einheit (S-5); fehlt es, gibt es keinen Kandidaten. */
  readonly profile: Pick<EquipmentProfile, 'available'> | null;
  /** `displaySwapRules(plan, birthDate, aktuell)` (4.5, S-2). */
  readonly swapRules: Pick<PlanSafetyRules, 'excludedCautionTags' | 'cautious'>;
  /** Alle Präferenzen der Person (S-7); ausgewertet am Ort (bei mehrdeutigem Ort an beiden). */
  readonly preferences: readonly ExercisePreference[];
  readonly location: EquipmentLocation;
  readonly ambiguousLocation?: boolean;
  /** Übungen, die in der (angezeigten) Einheit schon stehen (S-6). */
  readonly inSession: ReadonlySet<string>;
  readonly mode: SwapMode;
  /**
   * Nur `mode: 'today'` im Trainingsmodus: die von progressHintForDisplay() schon vorgeschlagene schwerere Variante
   * (S-3-Ausnahme, beachtet W8 über den Vorschlag selbst und S-2, S-5, S-6, S-7).
   */
  readonly harderVariantId?: string | null;
}

export interface SwapCandidates {
  readonly candidates: readonly Exercise[];
  /** „Ab jetzt immer“ nur, wenn es am Ort mindestens einen gleichwertigen Kandidaten gibt (4.2). */
  readonly alwaysAllowed: boolean;
  readonly reason: null | 'no_candidate' | 'library_missing';
}

function sharesPrimaryMuscle(a: Exercise, b: Exercise): boolean {
  return a.primary_muscles.some((m) => b.primary_muscles.includes(m));
}

const compareIds = (a: Exercise, b: Exercise) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function sortAlternatives(alternatives: Exercise['alternatives'], cautious: boolean) {
  return [...alternatives].sort((a, b) => {
    if (cautious) {
      const ea = a.reason === 'easier' ? 0 : 1;
      const eb = b.reason === 'easier' ? 0 : 1;
      if (ea !== eb) return ea - eb;
    }
    return a.priority - b.priority || (a.alternative_id < b.alternative_id ? -1 : 1);
  });
}

/**
 * Kandidaten für das Paar (S, X) als fertige Übungen (S und X schon nachgeschlagen). Regeln (4.1):
 * - S-1 gleiches Muster wie S; Sonderfall Stufe-5-Ersatz (Muster X ≠ Muster S): Muster S ODER X und mindestens ein
 *   gemeinsamer Hauptmuskel mit S,
 * - S-2 erlaubt nach `swapRules`, S-3 `difficulty` ≤ min(S, X), S-4 gleiche Belastungsart (Halten ↔ Wdh. nie),
 * - S-5 machbar am Ort, S-6 nicht schon in der Einheit, S-7 nicht ausgeschlossen am Ort, S-8 nur aus `library`.
 * Reihenfolge: Alternativen von S (bei vorsichtigen Regeln `easier` zuerst), dann von X; Alternativen der
 * Alternativen; Bibliothek mit gleichem Muster und gemeinsamem Hauptmuskel (Rang wie findSubstitute). Höchstens
 * SWAP_RULES.maxCandidates; die schwerere Variante (nur „heute“ im Trainingsmodus) steht immer am Ende.
 */
export function swapCandidatesFor(
  stored: Exercise,
  shown: Exercise,
  ctx: SwapContext,
): SwapCandidates {
  const prefs = preferencesAt(ctx.preferences, ctx.location, ctx.ambiguousLocation ?? false);
  const profile = ctx.profile;
  const stage5 = shown.movement_pattern !== stored.movement_pattern;
  const maxDifficulty = Math.min(stored.difficulty, shown.difficulty);
  const isTime = stored.load_type === 'time';
  const baseOk = (c: Exercise | undefined): c is Exercise =>
    c !== undefined &&
    ctx.library.get(c.id) === c &&
    c.id !== stored.id &&
    c.id !== shown.id &&
    !ctx.inSession.has(c.id) &&
    !prefs.has(c.id) &&
    profile !== null &&
    isExerciseFeasible(c, profile) &&
    isExerciseAllowed(c, ctx.swapRules);
  const patternOk = (c: Exercise) =>
    stage5
      ? (c.movement_pattern === stored.movement_pattern ||
          c.movement_pattern === shown.movement_pattern) &&
        sharesPrimaryMuscle(c, stored)
      : c.movement_pattern === stored.movement_pattern;
  const ok = (c: Exercise | undefined): c is Exercise =>
    baseOk(c) &&
    patternOk(c) &&
    c.difficulty <= maxDifficulty &&
    (c.load_type === 'time') === isTime;

  const result: Exercise[] = [];
  const seen = new Set<string>();
  const push = (c: Exercise | undefined) => {
    if (ok(c) && !seen.has(c.id)) {
      seen.add(c.id);
      result.push(c);
    }
  };
  const cautious = ctx.swapRules.cautious;
  const firstLevel = [
    ...sortAlternatives(stored.alternatives, cautious),
    ...(shown.id !== stored.id ? sortAlternatives(shown.alternatives, cautious) : []),
  ];
  // Stufe 1: Alternativen von S, dann von X
  for (const alt of firstLevel) push(ctx.library.get(alt.alternative_id));
  // Stufe 2: Alternativen der Alternativen
  for (const alt of firstLevel) {
    const parent = ctx.library.get(alt.alternative_id) ?? ctx.lookup?.get(alt.alternative_id);
    if (!parent) continue;
    for (const second of sortAlternatives(parent.alternatives, cautious)) {
      push(ctx.library.get(second.alternative_id));
    }
  }
  // Stufe 3: Bibliothek – gleiches Muster (bzw. Muster S oder X beim Stufe-5-Ersatz) + gemeinsamer Hauptmuskel
  const rank = (a: Exercise, b: Exercise) =>
    b.difficulty - a.difficulty ||
    Number(b.load_type === stored.load_type) - Number(a.load_type === stored.load_type) ||
    compareIds(a, b);
  [...ctx.library.values()]
    .filter((c) => sharesPrimaryMuscle(c, stored))
    .sort(rank)
    .forEach(push);

  const regular = result.slice(0, SWAP_RULES.maxCandidates);
  let candidates: Exercise[] = regular;
  if (ctx.mode === 'today' && ctx.harderVariantId) {
    const variant = ctx.library.get(ctx.harderVariantId);
    if (baseOk(variant) && !seen.has(variant.id)) {
      candidates = [...result.slice(0, SWAP_RULES.maxCandidates - 1), variant];
    }
  }
  return {
    candidates,
    alwaysAllowed: regular.length > 0,
    reason: regular.length > 0 ? null : 'no_candidate',
  };
}

/** Kandidaten für ein Paar (S, X) aus der Einheit; S und X über `lookup` (bzw. `library`) nachgeschlagen. */
export function swapCandidates(
  pair: Pick<ExercisePair, 'stored' | 'shown'>,
  ctx: SwapContext,
): SwapCandidates {
  const lookup = ctx.lookup ?? ctx.library;
  const stored = lookup.get(pair.stored.exercise_id) ?? ctx.library.get(pair.stored.exercise_id);
  const shown = lookup.get(pair.shown.exercise_id) ?? ctx.library.get(pair.shown.exercise_id);
  if (!stored || !shown) {
    return { candidates: [], alwaysAllowed: false, reason: 'library_missing' };
  }
  return swapCandidatesFor(stored, shown, ctx);
}

export type CanExcludeResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | 'invalid'
        | 'library_missing'
        | 'no_candidate'
        | 'limit_reached'
        | 'replacement_not_candidate';
    };

/**
 * Darf „Ab jetzt immer“ gespeichert werden (7.2)? Gemeinsame Prüfung für UI und Testmodus-Regeln (local-rules):
 * gültige Eingabe (Zod), Kandidat vorhanden (4.2), Obergrenze EXERCISE_PREFERENCE_LIMITS.maxPerUser (eine Änderung
 * derselben Übung am selben Ort zählt nicht neu) und der gewählte Ersatz ist ein Kandidat.
 */
export function canExclude(
  pair: Pick<ExercisePair, 'stored' | 'shown'>,
  pref: unknown,
  ctx: Omit<SwapContext, 'mode' | 'harderVariantId' | 'location' | 'profile'> & {
    /**
     * Geräte je Ort (Wächter T1-K3): geprüft wird mit dem Profil des GEWÄHLTEN Orts der Präferenz – bei mehrdeutigem
     * Ort kann die Person im Dialog einen anderen Ort wählen als den geratenen.
     */
    readonly profiles: ReadonlyMap<EquipmentLocation, Pick<EquipmentProfile, 'available'>>;
  },
): CanExcludeResult {
  const parsed = exercisePreferenceSchema.safeParse(pref);
  if (!parsed.success || parsed.data.exercise_id !== pair.shown.exercise_id) {
    return { ok: false, reason: 'invalid' };
  }
  const p = parsed.data;
  const others = ctx.preferences.filter(
    (o) => !(o.exercise_id === p.exercise_id && o.location === p.location),
  );
  if (others.length >= EXERCISE_PREFERENCE_LIMITS.maxPerUser) {
    return { ok: false, reason: 'limit_reached' };
  }
  const { profiles, ...rest } = ctx;
  const result = swapCandidates(pair, {
    ...rest,
    profile: profiles.get(p.location) ?? null,
    location: p.location,
    // Die eigene (alte) Präferenz auf X schließt keine Kandidaten aus.
    preferences: others,
    mode: 'always',
  });
  if (result.reason !== null) return { ok: false, reason: result.reason };
  if (
    p.replacement_exercise_id !== null &&
    !result.candidates.some((c) => c.id === p.replacement_exercise_id)
  ) {
    return { ok: false, reason: 'replacement_not_candidate' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------------------
// Präferenz-Schicht (7.2)
// ---------------------------------------------------------------------------------------------------------

/** Übung im Termin durch einen Kandidaten ersetzen: Dosierung bleibt, `superset_group` bleibt, Pause geklemmt. */
export function replaceShownExercise(
  shown: PlannedExerciseDraft,
  previous: Pick<Exercise, 'movement_pattern' | 'mechanics'> | undefined,
  chosen: Exercise,
): PlannedExerciseDraft {
  const range = REST_RANGES_S[chosen.mechanics];
  const changed =
    previous === undefined ||
    chosen.movement_pattern !== previous.movement_pattern ||
    chosen.mechanics !== previous.mechanics;
  return {
    ...shown,
    exercise_id: chosen.id,
    exercise_name_de: chosen.name_de,
    rest_s: changed ? Math.min(range.max, Math.max(range.min, shown.rest_s)) : shown.rest_s,
  };
}

export type PreferenceContext = Omit<SwapContext, 'inSession' | 'mode' | 'harderVariantId'>;

export interface PreferenceLayerResult {
  readonly pairs: readonly ExercisePair[];
  /** Ausgeblendet wegen „Hier nicht machbar“ ohne Kandidat – GESPEICHERTE IDs (Wächter B1a). */
  readonly hiddenByPreference: readonly string[];
  readonly swapped: readonly SwapRecord[];
  /** „Mag ich nicht“ ohne Kandidat: Übung bleibt stehen (weiche Regel, 4.2). */
  readonly keptDisliked: readonly { readonly storedOrderNo: number; readonly exerciseId: string }[];
  /** Muster weggefallener Übungen, deren Grundbaustein-Gruppe in der Einheit jetzt fehlt (4.2). */
  readonly missingKeyPattern: readonly MovementPattern[];
  /** Kraft-Einheit, von der wegen Präferenzen keine Übung mehr übrig ist (Wächter S9). */
  readonly emptyByPreference: boolean;
}

/**
 * Präferenz-Schicht (läuft NACH applyCurrentSafetyRules, Eingabe sind die Paare (S, X), 7.2):
 * - `kind !== 'strength'` → unverändert (Wächter S10).
 * - Präferenz auf X → gewählter Ersatz, wenn er für (S, X) noch alle Regeln erfüllt; sonst der erste Kandidat nach 4.1
 *   (alle Ausschlüsse des Orts und die Übungen der Einheit sind ausgeschlossen – Ketten und Kreise lösen sich so auf).
 * - Ohne Kandidat: `dislike` bleibt stehen (`keptDisliked`), `not_feasible` wird ausgeblendet
 *   (`hiddenByPreference` mit der GESPEICHERTEN ID von S).
 */
export function applyExercisePreferences(
  pairs: readonly ExercisePair[],
  session: { readonly kind: PlannedSessionKind; readonly exerciseCount: number },
  ctx: PreferenceContext,
): PreferenceLayerResult {
  const empty: PreferenceLayerResult = {
    pairs,
    hiddenByPreference: [],
    swapped: [],
    keptDisliked: [],
    missingKeyPattern: [],
    emptyByPreference: false,
  };
  if (session.kind !== 'strength' || ctx.preferences.length === 0) return empty;
  const prefs = preferencesAt(ctx.preferences, ctx.location, ctx.ambiguousLocation ?? false);
  const lookup = ctx.lookup ?? ctx.library;
  const result: (ExercisePair | null)[] = [...pairs];
  const hidden: string[] = [];
  const hiddenPatterns: MovementPattern[] = [];
  const swapped: SwapRecord[] = [];
  const kept: { storedOrderNo: number; exerciseId: string }[] = [];
  const inSession = () => new Set(result.flatMap((p) => (p === null ? [] : [p.shown.exercise_id])));

  result.forEach((pair, index) => {
    if (pair === null) return;
    const pref = prefs.get(pair.shown.exercise_id);
    if (!pref) return;
    // Eine Präferenz auf eine archivierte bzw. nicht mehr freigegebene Übung wird ignoriert (S-8, Wächter S6).
    if (!ctx.library.has(pair.shown.exercise_id)) return;
    const found = swapCandidates(pair, { ...ctx, inSession: inSession(), mode: 'always' });
    const chosen =
      found.candidates.find((c) => c.id === pref.replacement_exercise_id) ?? found.candidates[0];
    if (chosen) {
      result[index] = {
        ...pair,
        shown: replaceShownExercise(pair.shown, lookup.get(pair.shown.exercise_id), chosen),
      };
      swapped.push({
        storedOrderNo: pair.storedOrderNo,
        from: pair.shown.exercise_id,
        to: chosen.id,
      });
      return;
    }
    if (pref.kind === 'dislike') {
      kept.push({ storedOrderNo: pair.storedOrderNo, exerciseId: pair.shown.exercise_id });
      return;
    }
    hidden.push(pair.stored.exercise_id);
    const pattern = lookup.get(pair.shown.exercise_id)?.movement_pattern;
    if (pattern) hiddenPatterns.push(pattern);
    result[index] = null;
  });

  const remaining = result.filter((p): p is ExercisePair => p !== null);
  const remainingPatterns = new Set(
    remaining.flatMap((p) => {
      const pattern = lookup.get(p.shown.exercise_id)?.movement_pattern;
      return pattern ? [pattern] : [];
    }),
  );
  const missingKeyPattern = [...new Set(hiddenPatterns)].filter((pattern) =>
    SWAP_RULES.keyPatternGroups.some(
      (group) =>
        (group as readonly MovementPattern[]).includes(pattern) &&
        !group.some((p) => remainingPatterns.has(p)),
    ),
  );
  return {
    pairs: remaining,
    hiddenByPreference: hidden,
    swapped,
    keptDisliked: kept,
    missingKeyPattern,
    emptyByPreference: session.exerciseCount > 0 && remaining.length === 0 && hidden.length > 0,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Hinweise
// ---------------------------------------------------------------------------------------------------------

export const PREFERENCE_NOTICES = [
  'preference_kept_no_alternative',
  'preference_removed_no_alternative',
  'preference_key_pattern_missing',
  'preference_session_empty',
  'many_exclusions',
] as const;
/** Anzeige-Codes der Präferenz-Schicht (7.2) – werden NIE gespeichert (keine Migration an `plan_note`). */
export type PreferenceNotice = (typeof PREFERENCE_NOTICES)[number];

export function preferenceNotices(
  result: Pick<
    PreferenceLayerResult,
    'keptDisliked' | 'hiddenByPreference' | 'missingKeyPattern' | 'emptyByPreference'
  >,
  exclusionCount: number,
): PreferenceNotice[] {
  const notices: PreferenceNotice[] = [];
  if (result.keptDisliked.length > 0) notices.push('preference_kept_no_alternative');
  if (result.hiddenByPreference.length > 0) notices.push('preference_removed_no_alternative');
  if (result.missingKeyPattern.length > 0) notices.push('preference_key_pattern_missing');
  if (result.emptyByPreference) notices.push('preference_session_empty');
  if (exclusionCount >= EXERCISE_PREFERENCE_LIMITS.manyExclusionsNotice) {
    notices.push('many_exclusions');
  }
  return notices;
}

// ---------------------------------------------------------------------------------------------------------
// Zuordnung gespeichert ↔ angezeigt (7.3.1, Wächter B1)
// ---------------------------------------------------------------------------------------------------------

/**
 * Paare (S, X) direkt nach der Sicherheitsstufe: applyCurrentSafetyRules blendet aus (`hidden` = GESPEICHERTE IDs)
 * und nummeriert neu, die Reihenfolge bleibt – die k-te angezeigte Übung ist die k-te nicht ausgeblendete
 * gespeicherte.
 */
export function pairStoredAndShown(
  stored: readonly PlannedExerciseDraft[],
  shown: readonly PlannedExerciseDraft[],
  hidden: readonly string[],
): ExercisePair[] {
  const rest = [...hidden];
  const visible = stored.filter((e) => {
    const index = rest.indexOf(e.exercise_id);
    if (index === -1) return true;
    rest.splice(index, 1);
    return false;
  });
  return shown.flatMap((e, i) => {
    const original = visible[i];
    return original ? [{ stored: original, shown: e, storedOrderNo: original.order_no }] : [];
  });
}
