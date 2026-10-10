import { EXERCISE_PREFERENCE_LIMITS, SWAP_RULES } from '../constants';
import type { Exercise } from '../content/schemas';
import {
  EQUIPMENT_LOCATIONS,
  type EquipmentLocation,
  type ExercisePreferenceKind,
  type MovementPattern,
} from '../enums';
import {
  alwaysCandidates,
  type CanExcludeContext,
  type ExercisePair,
  type ExercisePreference,
  preferenceLimitReached,
  preferencesAt,
  removePreference,
  type SwapCandidates,
  swapCandidates,
  type SwapRecord,
  upsertPreference,
} from './preferences';

/**
 * Tausch in der App (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 8.2, Etappe T2): was der Tausch-Dialog anbietet, welche
 * Präferenzen „Ab jetzt immer“ schreibt (und wie „Rückgängig“ sie zurücknimmt) und die Liste „Ausgeschlossene
 * Übungen“ der Einstellungen. Rein und deterministisch – die App bildet nur ab.
 */

// ---------------------------------------------------------------------------------------------------------
// Dialog: Kandidaten „Nur heute“ und „Ab jetzt immer“ je Ort
// ---------------------------------------------------------------------------------------------------------

export interface SwapChoices {
  /**
   * Kandidaten für „Nur heute“ (Heute/Woche: Day-Swap; Trainingsmodus: Alternative im Entwurf) – dieselbe Liste wie
   * allowedAlternatives() im Trainingsmodus (Wächter S1). Mit `harderVariantId` (nur Trainingsmodus) steht die schon
   * vorgeschlagene schwerere Variante am Ende.
   */
  readonly today: readonly Exercise[];
  /** Orte, für die „Ab jetzt immer“ gewählt werden kann: der Ort der Einheit, bei mehrdeutigem Ort beide (4.4). */
  readonly locations: readonly EquipmentLocation[];
  /**
   * IDs der Kandidaten für „Ab jetzt immer“ je wählbarem Ort – genau die, die canExclude() annimmt (leer = „immer“
   * an diesem Ort nicht möglich: kein Kandidat oder Obergrenze erreicht).
   */
  readonly always: ReadonlyMap<EquipmentLocation, ReadonlySet<string>>;
  /** Obergrenze EXERCISE_PREFERENCE_LIMITS.maxPerUser an mindestens einem wählbaren Ort erreicht. */
  readonly limitReached: boolean;
  /** Grund, wenn es gar keinen Kandidaten gibt (wie swapCandidates). */
  readonly reason: SwapCandidates['reason'];
}

export interface SwapChoicesContext extends CanExcludeContext {
  /** Ort der Einheit (sessionLocationInfo); `ambiguousLocation` = geraten, dann beide Orte wählbar. */
  readonly location: EquipmentLocation;
  /** Nur Trainingsmodus: die von progressHintForDisplay() vorgeschlagene schwerere Variante („nur heute“). */
  readonly harderVariantId?: string | null;
  /**
   * Kette X → angezeigt (die angezeigte Übung stammt aus einer Präferenz auf X, preferenceChainFrom): „immer“ bietet
   * dann nur Kandidaten an, die auch für X gelten, wenn die angezeigte Übung ausgeschlossen ist – sonst könnte die
   * Anzeige die Wahl nicht zeigen (X bekäme den ersten Kandidaten, preferenceSaveChanges).
   */
  readonly chainFromId?: string | null;
}

/**
 * Was der Tausch-Dialog für das Paar (S, angezeigt) anbietet. „Nur heute“ prüft mit dem Geräte-Profil des Orts der
 * Einheit (wie die Anzeige); „Ab jetzt immer“ je wählbarem Ort mit DEREN Geräten und ohne die eigene Präferenz auf
 * die angezeigte Übung (wie canExclude, Wächter T1-K3). Die schwerere Variante gibt es nie für „immer“ (3.2).
 */
export function swapChoices(
  pair: Pick<ExercisePair, 'stored' | 'shown'>,
  ctx: SwapChoicesContext,
): SwapChoices {
  const { profiles, harderVariantId, chainFromId, ...rest } = ctx;
  const today = swapCandidates(pair, {
    ...rest,
    profile: profiles.get(ctx.location) ?? null,
    mode: 'today',
    harderVariantId: harderVariantId ?? null,
  });
  const locations: EquipmentLocation[] = ctx.ambiguousLocation
    ? [...EQUIPMENT_LOCATIONS]
    : [ctx.location];
  const always = new Map<EquipmentLocation, ReadonlySet<string>>();
  let limitReached = false;
  for (const location of locations) {
    if (preferenceLimitReached(ctx.preferences, pair.shown.exercise_id, location)) {
      limitReached = true;
      always.set(location, new Set());
      continue;
    }
    let ids = alwaysCandidates(pair, location, ctx).candidates.map((c) => c.id);
    const chain =
      chainFromId && chainFromId !== pair.shown.exercise_id
        ? ctx.preferences.find((p) => p.exercise_id === chainFromId && p.location === location)
        : undefined;
    if (chain) {
      // Wie nach dem Speichern: angezeigte Übung an diesem Ort ausgeschlossen, Kandidaten für das Paar (S, X).
      const shownExcluded: ExercisePreference = {
        ...chain,
        exercise_id: pair.shown.exercise_id,
        replacement_exercise_id: null,
      };
      const forChain = new Set(
        alwaysCandidates(
          { stored: pair.stored, shown: { ...pair.shown, exercise_id: chainFromId ?? '' } },
          location,
          {
            ...ctx,
            preferences: [
              ...ctx.preferences.filter(
                (p) => !(p.exercise_id === pair.shown.exercise_id && p.location === location),
              ),
              shownExcluded,
            ],
          },
        ).candidates.map((c) => c.id),
      );
      ids = ids.filter((id) => forChain.has(id));
    }
    always.set(location, new Set(ids));
  }
  return { today: today.candidates, locations, always, limitReached, reason: today.reason };
}

/** Darf der gewählte Kandidat „ab jetzt immer“ an diesem Ort gespeichert werden? */
export function alwaysAllowedFor(
  choices: Pick<SwapChoices, 'always'>,
  location: EquipmentLocation | null,
  candidateId: string | null,
): boolean {
  if (location === null) return [...choices.always.values()].some((ids) => ids.size > 0);
  const ids = choices.always.get(location);
  if (!ids || ids.size === 0) return false;
  return candidateId === null || ids.has(candidateId);
}

// ---------------------------------------------------------------------------------------------------------
// „Ab jetzt immer“ speichern und rückgängig machen
// ---------------------------------------------------------------------------------------------------------

/** Eine Änderung an den Präferenzen (Testmodus: lokaler Bestand; ab T3: Warteschlange). */
export type PreferenceChange =
  | { readonly op: 'upsert'; readonly preference: ExercisePreference }
  | {
      readonly op: 'remove';
      readonly exercise_id: string;
      readonly location: EquipmentLocation;
    };

/** Änderungen der Reihe nach anwenden (rein). */
export function applyPreferenceChanges(
  list: readonly ExercisePreference[],
  changes: readonly PreferenceChange[],
): ExercisePreference[] {
  return changes.reduce<ExercisePreference[]>(
    (current, change) =>
      change.op === 'upsert'
        ? upsertPreference(current, change.preference)
        : removePreference(current, change.exercise_id, change.location),
    [...list],
  );
}

export interface PreferenceSaveInput {
  readonly preferences: readonly ExercisePreference[];
  /** Angezeigte Übung, an der getauscht wurde – an ihr hängt die Präferenz (4.0). */
  readonly shownExerciseId: string;
  /**
   * Stammt die angezeigte Übung selbst aus einer Präferenz (Kette X → Y, `preferenceSwapped` dieser Position), die
   * Übung X davor. Dann bekommt auch die Präferenz auf X den neuen Ersatz – sonst wählte die Anzeige für X den ersten
   * Kandidaten statt der Wahl der Person (Ketten lösen sich sonst nur über die Reihenfolge auf, 5.1).
   */
  readonly chainFromId: string | null;
  readonly location: EquipmentLocation;
  readonly kind: ExercisePreferenceKind;
  readonly replacementId: string;
  /** Zeitstempel (ISO mit Zeitzone). */
  readonly now: string;
}

export interface PreferenceSave {
  /** Der Reihe nach anwenden: erst die angezeigte Übung, dann ggf. die Kette davor. */
  readonly changes: readonly PreferenceChange[];
  /** „Rückgängig“ (ohne Zeitlimit, 8.2): stellt den vorherigen Stand wieder her – in dieser Reihenfolge anwenden. */
  readonly undo: readonly PreferenceChange[];
}

function restoreOf(
  previous: ExercisePreference | undefined,
  exerciseId: string,
  location: EquipmentLocation,
): PreferenceChange {
  return previous
    ? { op: 'upsert', preference: previous }
    : { op: 'remove', exercise_id: exerciseId, location };
}

/**
 * Präferenz-Änderungen für „Ab jetzt immer“ (8.2): Präferenz auf die angezeigte Übung mit Grund und gewähltem Ersatz
 * (`created_at` einer vorhandenen Präferenz bleibt); bei einer Kette X → Y zusätzlich der neue Ersatz für die
 * vorhandene Präferenz auf X am selben Ort (Grund unverändert). `undo` nimmt beides in derselben Reihenfolge zurück
 * (erst Y, dann X – sonst wäre der alte Ersatz Y von X beim Prüfen noch ausgeschlossen).
 */
export function preferenceSaveChanges(input: PreferenceSaveInput): PreferenceSave {
  const find = (exerciseId: string) =>
    input.preferences.find((p) => p.exercise_id === exerciseId && p.location === input.location);
  const own = find(input.shownExerciseId);
  const changes: PreferenceChange[] = [
    {
      op: 'upsert',
      preference: {
        exercise_id: input.shownExerciseId,
        location: input.location,
        kind: input.kind,
        replacement_exercise_id: input.replacementId,
        created_at: own?.created_at ?? input.now,
        updated_at: input.now,
      },
    },
  ];
  const undo: PreferenceChange[] = [restoreOf(own, input.shownExerciseId, input.location)];
  const chain =
    input.chainFromId !== null && input.chainFromId !== input.shownExerciseId
      ? find(input.chainFromId)
      : undefined;
  if (chain && chain.exercise_id !== input.replacementId) {
    changes.push({
      op: 'upsert',
      preference: { ...chain, replacement_exercise_id: input.replacementId, updated_at: input.now },
    });
    undo.push(restoreOf(chain, chain.exercise_id, input.location));
  }
  return { changes, undo };
}

/**
 * Übung X vor einer Präferenz an dieser Position (Kette X → angezeigt), sonst null – aus `preferenceSwapped` der
 * Anzeige. Ein Day-Swap ist keine Kette (er wird vorher zurückgenommen).
 */
export function preferenceChainFrom(
  preferenceSwapped: readonly SwapRecord[] | undefined,
  storedOrderNo: number,
  shownExerciseId: string,
): string | null {
  return (
    preferenceSwapped?.find((r) => r.storedOrderNo === storedOrderNo && r.to === shownExerciseId)
      ?.from ?? null
  );
}

// ---------------------------------------------------------------------------------------------------------
// Einstellungen: „Ausgeschlossene Übungen“
// ---------------------------------------------------------------------------------------------------------

export interface ExclusionEntry {
  readonly exerciseId: string;
  readonly location: EquipmentLocation;
  readonly kind: ExercisePreferenceKind;
  /** Name aus der Bibliothek (auch archivierte); null = unbekannt bzw. Bibliothek fehlt. */
  readonly name: string | null;
  readonly replacementId: string | null;
  readonly replacementName: string | null;
  /**
   * Übung wird noch angeboten (in `library`, S-8)? false = archiviert bzw. nicht mehr freigegeben: Die Präferenz wird
   * ignoriert, die Einstellungen zeigen „nicht mehr verfügbar“ + „Entfernen“ (Wächter T1-K8). null = Bibliothek fehlt.
   */
  readonly available: boolean | null;
  /** Gewählter Ersatz noch angeboten? (null = kein Ersatz gewählt bzw. Bibliothek fehlt) */
  readonly replacementAvailable: boolean | null;
}

export interface ExclusionGroup {
  readonly location: EquipmentLocation;
  readonly entries: readonly ExclusionEntry[];
  /** Ab EXERCISE_PREFERENCE_LIMITS.manyExclusionsNotice Ausschlüssen an diesem Ort: Hinweis „einseitiger“. */
  readonly manyExclusions: boolean;
}

/**
 * Liste „Ausgeschlossene Übungen“ (8.2): je Ort (zu Hause, dann Studio; leere Orte entfallen), nach Name sortiert
 * (deutsche Sortierung, dann ID), mit Verfügbarkeit (archiviert = „nicht mehr verfügbar“, K8).
 */
export function exclusionOverview(
  prefs: readonly ExercisePreference[],
  libraries: {
    /** Angebotene Übungen (Engine; S-8) – null = Bibliothek fehlt. */
    readonly library: ReadonlyMap<string, Exercise> | null;
    /** Zum Nachschlagen der Namen (auch archivierte); Standard `library`. */
    readonly lookup?: ReadonlyMap<string, Exercise> | null;
  },
): ExclusionGroup[] {
  const library = libraries.library;
  const lookup = libraries.lookup ?? library;
  const nameOf = (id: string) => lookup?.get(id)?.name_de ?? library?.get(id)?.name_de ?? null;
  return EQUIPMENT_LOCATIONS.flatMap((location) => {
    // Doppelte Einträge (kaputter Speicher) nur einmal – wie preferencesAt() (not_feasible gewinnt).
    const entries = [...preferencesAt(prefs, location).values()]
      .map((p): ExclusionEntry => ({
        exerciseId: p.exercise_id,
        location,
        kind: p.kind,
        name: nameOf(p.exercise_id),
        replacementId: p.replacement_exercise_id,
        replacementName:
          p.replacement_exercise_id === null ? null : nameOf(p.replacement_exercise_id),
        available: library ? library.has(p.exercise_id) : null,
        replacementAvailable:
          library && p.replacement_exercise_id !== null
            ? library.has(p.replacement_exercise_id)
            : null,
      }))
      .sort(
        (a, b) =>
          (a.name ?? a.exerciseId).localeCompare(b.name ?? b.exerciseId, 'de') ||
          (a.exerciseId < b.exerciseId ? -1 : a.exerciseId > b.exerciseId ? 1 : 0),
      );
    return entries.length > 0
      ? [
          {
            location,
            entries,
            manyExclusions: entries.length >= EXERCISE_PREFERENCE_LIMITS.manyExclusionsNotice,
          },
        ]
      : [];
  });
}

// ---------------------------------------------------------------------------------------------------------
// Grundbausteine (4.2): fehlende Gruppen als Code für den ausdrücklichen Hinweis
// ---------------------------------------------------------------------------------------------------------

/** Namen der Gruppen aus SWAP_RULES.keyPatternGroups (gleiche Reihenfolge): Zug, Hüftbeuge. */
export const KEY_PATTERN_GROUP_CODES = ['pull', 'hinge'] as const;
export type KeyPatternGroupCode = (typeof KEY_PATTERN_GROUP_CODES)[number];

/** Welche Grundbaustein-Gruppen fehlen (aus DisplaySession.missingKeyPattern), je Gruppe einmal, feste Reihenfolge. */
export function missingKeyGroups(
  patterns: readonly MovementPattern[] | undefined,
): KeyPatternGroupCode[] {
  return KEY_PATTERN_GROUP_CODES.filter((_, i) => {
    const group = SWAP_RULES.keyPatternGroups[i] as readonly MovementPattern[] | undefined;
    return group !== undefined && (patterns ?? []).some((p) => group.includes(p));
  });
}
