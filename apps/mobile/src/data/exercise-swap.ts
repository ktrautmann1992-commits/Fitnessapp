import {
  canCatchUp,
  daySwapApplies,
  type DaySwap,
  daySwapSchema,
  displayPairs,
  type DisplaySession,
  displaySwapRules,
  type EquipmentLocation,
  type EquipmentProfile,
  type Exercise,
  type ExercisePair,
  type ExercisePreference,
  type ExercisePreferenceKind,
  type PlanLibrary,
  type PlanSafetyRules,
  preferenceChainFrom,
  type PreferenceSave,
  preferenceSaveChanges,
  prepareSessionForDisplay,
  type SessionLocationInfo,
  sessionLocationInfo,
  type StoredSession,
  type SwapChoices,
  swapChoices,
} from '@fitnessapp/core';

import type { PreferenceSwapContext } from './backend';
import {
  type ActivePlan,
  allSessions,
  planSnapshot,
  profilesFor,
  startGroupOf,
} from './training-plan';
import type { UserRows } from './types';

/**
 * Übungstausch in der App (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 7.3/8.2, Etappe T2): setzt Plan, aktuelle Regeln,
 * Plan-Untergrenze (displaySwapRules), Ort, Präferenzen und Day-Swaps für den EINEN Anzeigeweg
 * prepareSessionForDisplay() zusammen und bereitet den Tausch-Dialog vor. Nur Zusammensetzen – alle Regeln stehen in
 * packages/core (swapChoices, preferenceSaveChanges, applyExercisePreferences, applyDaySwaps). Rein und getestet.
 */

/** Präferenzen aus den Zeilen (ohne user_id) – Eingabe der Core-Funktionen. */
export function preferencesFromRows(
  rows: Pick<UserRows, 'exercisePreferences'>,
): ExercisePreference[] {
  return rows.exercisePreferences.map((row) => ({
    exercise_id: row.exercise_id,
    location: row.location,
    kind: row.kind,
    replacement_exercise_id: row.replacement_exercise_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export interface SessionDisplay {
  shown: DisplaySession<StoredSession>;
  /** Bibliothek (auch archivierte) und Geräte am Ort – für exerciseMark und die SessionCard. */
  context: { library: ReadonlyMap<string, Exercise> | null; profile?: EquipmentProfile };
  location: SessionLocationInfo;
  /** Regeln für ALLE Tausch-Kandidaten = displaySwapRules(Plan, Geburtsdatum, aktuell) (4.5). */
  swapRules: PlanSafetyRules;
  profiles: ReadonlyMap<EquipmentLocation, EquipmentProfile>;
  /** Tausch-Schichten aktiv (Bibliothek geladen) – ohne Bibliothek kein Tausch, keine Day-Swaps (sonst verworfen). */
  swapReady: boolean;
  /**
   * Würde ein „Nur heute“-Tausch an dieser Einheit wirken (Core daySwapApplies: heute/später oder heute nachholbar,
   * Wächter T2-S1)? Sonst bietet die App „Nur heute“ nicht an.
   */
  daySwapActive: boolean;
}

export interface SessionDisplayInput {
  rows: UserRows;
  active: ActivePlan;
  library: PlanLibrary | null;
  /** AKTUELLE Sicherheitsregeln. */
  rules: PlanSafetyRules;
  session: StoredSession;
  today: string;
  /** Day-Swaps des Kontos (null = nicht anwenden, z. B. PDF bzw. ohne Konto). */
  daySwaps: readonly DaySwap[] | null;
  ownerUserId: string | null;
}

/**
 * Eine Einheit anzeigen (Heute und Trainingsmodus): Sicherheitsregeln → Präferenzen → Day-Swaps. Die Plan-Untergrenze
 * geht immer mit (Pflichtfeld `swapRules`, Wächter T1-S2). Ohne Bibliothek (offline ohne Zwischenspeicher) keine
 * Tausch-Schichten: Präferenzen und Day-Swaps ließen sich nicht prüfen und würden sonst verworfen.
 */
export function sessionDisplay(input: SessionDisplayInput): SessionDisplay {
  const { rows, active, library, rules, session, today } = input;
  const birthDate = rows.profile?.birth_date ?? today;
  const snapshot = planSnapshot(active.plan);
  const profiles = profilesFor(snapshot);
  // Nachschlagen auch archivierter Übungen des laufenden Plans; Ersatz nur aus freigegebenen.
  const lookup = library ? (library.displayExercises ?? library.exercises) : null;
  const location = sessionLocationInfo(session, snapshot?.schedule ?? null, {
    library: lookup,
    homeProfile: profiles.get('home'),
  });
  const profile = profiles.get(location.location);
  const swapRules = displaySwapRules(active.plan, birthDate, rules);
  const catchUpToday = canCatchUp(allSessions(rows), session.id, today);
  const daySwaps =
    input.daySwaps && input.daySwaps.length > 0 && input.ownerUserId
      ? {
          swaps: input.daySwaps,
          planId: active.plan.id,
          ownerUserId: input.ownerUserId,
          today,
          catchUpToday,
        }
      : null;
  const shown = prepareSessionForDisplay(session, {
    rules,
    previousStartGroup: startGroupOf(active, birthDate),
    library: lookup,
    ...(library ? { substituteLibrary: library.exercises } : {}),
    ...(profile ? { profile } : {}),
    ...(library
      ? {
          swap: {
            swapRules,
            location: location.location,
            ambiguousLocation: location.ambiguous,
            preferences: preferencesFromRows(rows),
            ...(daySwaps ? { daySwaps } : {}),
          },
        }
      : {}),
  });
  return {
    shown,
    context: { library: lookup, ...(profile ? { profile } : {}) },
    location,
    swapRules,
    profiles,
    swapReady: library !== null,
    daySwapActive: daySwapApplies(session, { today, catchUpToday }),
  };
}

/**
 * Darf an dieser Einheit getauscht werden (4.6)? Kraft-Einheit, geplant (nicht erledigt/gestrichen), Übungen prüfbar
 * und kein laufender Entwurf („Sobald ein Entwurf läuft, gilt der Entwurf“ – getauscht wird dann im Trainingsmodus).
 */
export function canSwapIn(
  session: Pick<StoredSession, 'kind' | 'status'>,
  display: Pick<SessionDisplay, 'shown' | 'swapReady' | 'daySwapActive'>,
  hasDraft: boolean,
  /** Backend kann „Ab jetzt immer“ (Testmodus; Supabase ab T3). */
  supportsPreferences: boolean,
): boolean {
  return (
    session.kind === 'strength' &&
    session.status === 'planned' &&
    display.swapReady &&
    !display.shown.libraryMissing &&
    !hasDraft &&
    // Vergangener, nicht nachholbarer Termin: „Nur heute“ wirkt dort nie (S1) – bleibt nur „Ab jetzt immer“.
    (display.daySwapActive || supportsPreferences)
  );
}

/** Alles, was der Tausch-Dialog für EINE angezeigte Übung braucht. */
export interface SwapTarget {
  sessionId: string;
  storedOrderNo: number;
  storedExerciseId: string;
  /** Angezeigte Übung (an ihr hängt eine Präferenz, 4.0). */
  shownExerciseId: string;
  shownName: string;
  /** Kette X → angezeigt (Präferenz), für preferenceSaveChanges. */
  chainFromId: string | null;
  choices: SwapChoices;
  location: EquipmentLocation;
  ambiguousLocation: boolean;
  /** Termin liegt nach heute → „Nur bei diesem Training“ statt „Nur heute“. */
  later: boolean;
  /**
   * Übungen der ANDEREN Positionen der Einheit (S-6) – die getauschte Position selbst zählt nicht, sonst wäre beim
   * Rückgängig-Machen einer Kette der alte Ersatz gesperrt (die angezeigte Übung ist ohnehin kein Kandidat).
   */
  inSession: string[];
  /** Nur Trainingsmodus: schwerere Variante in der Liste („nur heute“). */
  harderVariantId: string | null;
  /** „Nur heute“ wirkt hier (daySwapApplies; im Trainingsmodus immer). */
  todayAllowed: boolean;
  /**
   * „Ab jetzt immer“ möglich? Nicht im Trainingsmodus an einer Übung, die vor dem Training nur für heute getauscht
   * wurde – die Präferenz hinge an einer Tagesübung (Abweichung 2).
   */
  alwaysOffered: boolean;
}

function targetFrom(
  pair: ExercisePair,
  params: {
    sessionId: string;
    display: Pick<SessionDisplay, 'shown' | 'location' | 'swapRules' | 'profiles'>;
    library: PlanLibrary;
    preferences: readonly ExercisePreference[];
    inSession: readonly string[];
    later: boolean;
    harderVariantId: string | null;
    todayAllowed: boolean;
    alwaysOffered: boolean;
  },
): SwapTarget {
  const { display, library } = params;
  const lookup = library.displayExercises ?? library.exercises;
  const chainFromId = preferenceChainFrom(
    display.shown.preferenceSwapped,
    pair.storedOrderNo,
    pair.shown.exercise_id,
  );
  const choices = swapChoices(pair, {
    library: library.exercises,
    lookup,
    profiles: display.profiles,
    swapRules: display.swapRules,
    preferences: params.preferences,
    location: display.location.location,
    ambiguousLocation: display.location.ambiguous,
    inSession: new Set(params.inSession),
    harderVariantId: params.harderVariantId,
    chainFromId,
  });
  return {
    sessionId: params.sessionId,
    storedOrderNo: pair.storedOrderNo,
    storedExerciseId: pair.stored.exercise_id,
    shownExerciseId: pair.shown.exercise_id,
    shownName: lookup.get(pair.shown.exercise_id)?.name_de ?? pair.shown.exercise_name_de,
    chainFromId,
    choices,
    location: display.location.location,
    ambiguousLocation: display.location.ambiguous,
    later: params.later,
    inSession: [...params.inSession],
    harderVariantId: choices.today.some((c) => c.id === params.harderVariantId)
      ? params.harderVariantId
      : null,
    todayAllowed: params.todayAllowed,
    alwaysOffered: params.alwaysOffered,
  };
}

/** Tausch-Ziel für die k-te angezeigte Übung auf „Heute“ (Paar über storedOrderNos, nie über die Übungs-ID). */
export function swapTargetFor(
  session: StoredSession,
  display: SessionDisplay,
  library: PlanLibrary,
  rows: UserRows,
  index: number,
  today: string,
): SwapTarget | null {
  const orderNo = display.shown.storedOrderNos?.[index];
  const pair = displayPairs(session, display.shown).find((p) => p.storedOrderNo === orderNo);
  if (!pair) return null;
  return targetFrom(pair, {
    sessionId: session.id,
    display,
    library,
    preferences: preferencesFromRows(rows),
    inSession: display.shown.session.exercises
      .filter((_, i) => i !== index)
      .map((e) => e.exercise_id),
    later: session.scheduled_on > today,
    harderVariantId: null,
    todayAllowed: display.daySwapActive,
    alwaysOffered: true,
  });
}

/**
 * Tausch-Ziel im Trainingsmodus: Paar (gespeichert, im Entwurf geplant) – der laufende Entwurf gilt, auch wenn sich
 * die Anzeige seitdem geändert hat. „In der Einheit“ sind die Übungen des Entwurfs; die schwerere Variante nur, wenn
 * die Anzeige dieselbe Übung zeigt (progressHintForDisplay).
 */
export function workoutSwapTarget(params: {
  session: StoredSession;
  display: SessionDisplay;
  library: PlanLibrary;
  rows: UserRows;
  storedOrderNo: number | null;
  plannedExerciseId: string;
  /** Übungen der ANDEREN Einträge des Entwurfs (jeweils die gemachte bzw. geplante). */
  draftExerciseIds: readonly string[];
  harderVariantId: string | null;
}): SwapTarget | null {
  const stored = params.session.exercises.find((e) => e.order_no === params.storedOrderNo);
  if (!stored) return null;
  const pair: ExercisePair = {
    stored,
    shown: { ...stored, exercise_id: params.plannedExerciseId },
    storedOrderNo: stored.order_no,
  };
  return targetFrom(pair, {
    sessionId: params.session.id,
    display: params.display,
    library: params.library,
    preferences: preferencesFromRows(params.rows),
    inSession: params.draftExerciseIds,
    later: false,
    harderVariantId: params.harderVariantId,
    todayAllowed: true,
    alwaysOffered: !params.display.shown.daySwapped?.some(
      (r) => r.storedOrderNo === stored.order_no && r.to === params.plannedExerciseId,
    ),
  });
}

/** Kontext für die Prüfung beim Speichern (canExclude im Testmodus). */
export function preferenceContextOf(target: SwapTarget): PreferenceSwapContext {
  return {
    sessionId: target.sessionId,
    storedOrderNo: target.storedOrderNo,
    inSession: target.inSession,
    ambiguousLocation: target.ambiguousLocation,
  };
}

/** „Nur heute“ vor dem Training als Day-Swap (Zod an der Grenze; null = ungültig). */
export function newDaySwap(
  target: SwapTarget,
  meta: {
    ownerUserId: string;
    planId: string;
    scheduledOn: string;
    alternativeId: string;
    now: string;
  },
): DaySwap | null {
  const parsed = daySwapSchema.safeParse({
    ownerUserId: meta.ownerUserId,
    planId: meta.planId,
    sessionId: target.sessionId,
    scheduledOn: meta.scheduledOn,
    storedOrderNo: target.storedOrderNo,
    storedExerciseId: target.storedExerciseId,
    alternativeId: meta.alternativeId,
    createdAt: meta.now,
  });
  return parsed.success ? parsed.data : null;
}

/** „Ab jetzt immer“: Änderungen und Rückgängig (preferenceSaveChanges aus packages/core). */
export function preferenceSaveFor(
  target: SwapTarget,
  rows: UserRows,
  choice: {
    location: EquipmentLocation;
    kind: ExercisePreferenceKind;
    replacementId: string;
    now: string;
  },
): PreferenceSave {
  return preferenceSaveChanges({
    preferences: preferencesFromRows(rows),
    shownExerciseId: target.shownExerciseId,
    chainFromId: target.chainFromId,
    location: choice.location,
    kind: choice.kind,
    replacementId: choice.replacementId,
    now: choice.now,
  });
}
