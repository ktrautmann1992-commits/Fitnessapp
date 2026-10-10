import type { Exercise } from '../content/schemas';
import { addDays, isoWeekday, startOfIsoWeek } from '../dates';
import type { EquipmentLocation, PlannedSessionStatus } from '../enums';
import type { TrainingSchedule } from '../training-schedule';
import { applyCurrentEnduranceRules, applyCurrentSafetyRules } from './apply-safety';
import { isBodyweightTemplateId, type PlanLibrary } from './content-pool';
import { type EquipmentProfile, isExerciseFeasible } from './equipment-profile';
import { applyDaySwaps, type DaySwap, type DaySwapLayerResult } from './day-swaps';
import {
  applyExercisePreferences,
  type ExercisePair,
  type ExercisePreference,
  exclusionCountAt,
  pairStoredAndShown,
  type PreferenceLayerResult,
  type PreferenceNotice,
  preferenceNotices,
  type SwapRecord,
} from './preferences';
import { type EnduranceStartGroup, isStricterGroup, type PlanSafetyRules } from './safety';
import { type GeneratedSession, isStrengthKind, locationOfKind } from './schedule';
import { planStartGroup, type PlanStartGroupSource } from './start-group';
import {
  type CurrentState,
  type PlanForUpdate,
  planNeedsUpdate,
  type PlanUpdateReason,
} from './update';

/**
 * Anzeige eines GESPEICHERTEN Plans (docs/PLAN-PHASE-3.md Abschnitt 10.2–10.4): heutige Einheit, Woche,
 * Kennzeichen, Folgeblock fällig, „Plan neu erstellen?“ – reine Funktionen, die App bildet nur ab.
 */

/** Eine gespeicherte Einheit (planned_sessions + planned_exercises) mit ID, Status und Ursprungstag. */
export type StoredSession = GeneratedSession & {
  readonly id: string;
  readonly status: PlannedSessionStatus;
  readonly original_date: string | null;
};

// ---------------------------------------------------------------------------------------------------------
// Einheit anzeigen: aktuelle Sicherheitsregeln IMMER anwenden (Kraft und Ausdauer)
// ---------------------------------------------------------------------------------------------------------

export interface DisplayContext {
  /** AKTUELLE wirksame Sicherheitsregeln (aus Gesundheits-Check und Alter heute bzw. Zwischenspeicher). */
  readonly rules: PlanSafetyRules;
  /** Startgruppe beim Erstellen – bei gespeicherten Plänen immer planStartGroup(). */
  readonly previousStartGroup: EnduranceStartGroup;
  /**
   * Übungen zum Nachschlagen der Merkmale (auch archivierte des laufenden Plans); null = nicht geladen (offline ohne
   * Zwischenspeicher).
   */
  readonly library: ReadonlyMap<string, Exercise> | null;
  /** Woraus ein Ersatz gewählt werden darf – nur freigegebene Inhalte (Standard: `library`). */
  readonly substituteLibrary?: ReadonlyMap<string, Exercise>;
  /** Geräte am Ort der Einheit (für Ersatz); ohne Profil wird eine nicht erlaubte Übung ausgeblendet. */
  readonly profile?: Pick<EquipmentProfile, 'available'>;
  /**
   * Übungs-Tausch (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 7.3.2, Etappe T1). Ohne `swap` laufen keine Tausch-Schichten:
   * `session`, `hidden`, `replaced` und `libraryMissing` sind unverändert, die neuen Felder leer. Präferenzen und
   * Day-Swaps gibt es NUR zusammen mit `swapRules` (Pflichtfeld des Bündels, Wächter T1-S2) – ein Aufrufer kann die
   * Plan-Untergrenze damit nicht vergessen.
   */
  readonly swap?: DisplaySwapOptions;
}

/** „Nur heute“ vor dem Training (nie im PDF). */
export interface DisplayDaySwaps {
  readonly swaps: readonly DaySwap[];
  /** Plan der Einheit (Swaps anderer Pläne fallen weg). */
  readonly planId: string;
  /** Konto (Wächter T1-K2): Swaps anderer Konten fallen weg. */
  readonly ownerUserId: string;
  readonly today: string;
  /** Darf die Einheit heute nachgeholt werden (canCatchUp, N1)? */
  readonly catchUpToday?: boolean;
}

export interface DisplaySwapOptions {
  /** Regeln für ALLE Kandidaten = displaySwapRules(plan, birthDate, rules) (4.5). Pflicht. */
  readonly swapRules: PlanSafetyRules;
  /** Ort der Einheit (sessionLocationInfo); bei `ambiguousLocation` gelten die Präferenzen beider Orte (4.4). */
  readonly location: EquipmentLocation;
  readonly ambiguousLocation?: boolean;
  /** Alle Präferenzen der Person. */
  readonly preferences?: readonly ExercisePreference[];
  readonly daySwaps?: DisplayDaySwaps;
}

export interface DisplaySession<T extends StoredSession> {
  readonly session: T;
  /**
   * Ausgeblendete Übungen nach den SICHERHEITSREGELN (nicht erlaubt und kein Ersatz, oder nicht prüfbar) –
   * GESPEICHERTE IDs. Nur diese Liste löst den Hinweis „Plan neu erstellen“ aus (Wächter B1b).
   */
  readonly hidden: readonly string[];
  readonly replaced: readonly string[];
  /**
   * Eigener Zustand „Übungen können gerade nicht geprüft werden“ (Abschnitt 10.3): Kraft-Einheit, deren Übungen
   * alle nicht in der Bibliothek stehen (Bibliothek fehlt) – statt einer leeren Einheit.
   */
  readonly libraryMissing: boolean;
  /**
   * Ab Etappe T1 (immer gesetzt von prepareSessionForDisplay; optional nur für ältere Aufrufer/Tests):
   * `storedOrderNos` parallel zu `session.exercises` – zu jeder angezeigten Übung die `order_no` der gespeicherten.
   */
  readonly storedOrderNos?: readonly number[];
  /** Ausgeblendet wegen „Hier nicht machbar“ ohne Kandidat – GESPEICHERTE IDs, eigener neutraler Hinweis. */
  readonly hiddenByPreference?: readonly string[];
  readonly preferenceSwapped?: readonly SwapRecord[];
  readonly daySwapped?: readonly SwapRecord[];
  readonly keptDisliked?: readonly {
    readonly storedOrderNo: number;
    readonly exerciseId: string;
  }[];
  readonly preferenceNotices?: readonly PreferenceNotice[];
  /** Ungültige bzw. verfallene Day-Swaps dieser Einheit – die App räumt sie aus dem Speicher. */
  readonly droppedDaySwaps?: readonly DaySwap[];
  /** Kraft-Einheit, die wegen Präferenzen leer ist (Wächter S9): „Training starten“ deaktiviert, eigener Hinweis. */
  readonly emptyByPreference?: boolean;
}

/**
 * Pflichtaufruf vor dem Anzeigen JEDER Einheit: applyCurrentEnduranceRules (Ausdauer: Anstrengung, Gehen statt
 * Laufen, Start-Deckel bei strengerer Gruppe) und applyCurrentSafetyRules (Kraft: RPE-Deckel, Ersatz oder
 * Ausblenden). Strengere Regeln wirken so sofort; Lockerungen nie (beide Funktionen senken nur).
 *
 * Danach (Etappe T1, 7.3.2): Paare (gespeichert, angezeigt) bilden → Präferenzen → Day-Swaps → neu nummerieren.
 * Beide Tausch-Schichten laufen NACH den Sicherheitsregeln und prüfen jeden Kandidaten neu (Rangfolge Abschnitt 4).
 */
export function prepareSessionForDisplay<T extends StoredSession>(
  session: T,
  ctx: DisplayContext,
): DisplaySession<T> {
  const endurance = applyCurrentEnduranceRules(session, ctx.rules, {
    previousStartGroup: ctx.previousStartGroup,
  });
  const library = ctx.library ?? new Map<string, Exercise>();
  const safe = applyCurrentSafetyRules(endurance, ctx.rules, {
    library,
    ...(ctx.substituteLibrary ? { substituteLibrary: ctx.substituteLibrary } : {}),
    ...(ctx.profile ? { profile: ctx.profile } : {}),
  });
  const libraryMissing =
    session.kind === 'strength' &&
    session.exercises.length > 0 &&
    session.exercises.every((e) => !library.has(e.exercise_id));

  let pairs: readonly ExercisePair[] = pairStoredAndShown(
    endurance.exercises,
    safe.session.exercises,
    safe.hidden,
  );
  const swap = ctx.swap;
  let changed = false;
  let prefs: PreferenceLayerResult | null = null;
  let days: DaySwapLayerResult | null = null;
  if (swap) {
    const layerCtx = {
      library: ctx.substituteLibrary ?? library,
      lookup: library,
      profile: ctx.profile ?? null,
      swapRules: swap.swapRules,
      preferences: swap.preferences ?? [],
      location: swap.location,
      ambiguousLocation: swap.ambiguousLocation ?? false,
    } as const;
    if (layerCtx.preferences.length > 0) {
      prefs = applyExercisePreferences(
        pairs,
        { kind: session.kind, exerciseCount: session.exercises.length },
        layerCtx,
      );
      changed = prefs.swapped.length > 0 || prefs.hiddenByPreference.length > 0;
      pairs = prefs.pairs;
    }
    const day = swap.daySwaps;
    if (day && day.swaps.length > 0) {
      days = applyDaySwaps(pairs, session, day.swaps, {
        ...layerCtx,
        planId: day.planId,
        ownerUserId: day.ownerUserId,
        today: day.today,
        catchUpToday: day.catchUpToday ?? false,
      });
      changed = changed || days.daySwapped.length > 0;
      pairs = days.pairs;
    }
  }
  const exclusions = swap?.preferences
    ? exclusionCountAt(swap.preferences, swap.location, swap.ambiguousLocation ?? false)
    : 0;
  const emptyLayer = {
    keptDisliked: [],
    hiddenByPreference: [],
    missingKeyPattern: [],
    emptyByPreference: false,
  };
  return {
    // Ohne Tausch bleibt die Einheit der Sicherheitsstufe unverändert (Regression „ohne Präferenzen identisch“).
    session: changed
      ? {
          ...safe.session,
          exercises: pairs.map((p, i) => ({ ...p.shown, order_no: i + 1 })),
        }
      : safe.session,
    hidden: safe.hidden,
    replaced: safe.replaced,
    libraryMissing,
    storedOrderNos: pairs.map((p) => p.storedOrderNo),
    hiddenByPreference: prefs?.hiddenByPreference ?? [],
    preferenceSwapped: prefs?.swapped ?? [],
    daySwapped: days?.daySwapped ?? [],
    keptDisliked: prefs?.keptDisliked ?? [],
    preferenceNotices:
      session.kind === 'strength' ? preferenceNotices(prefs ?? emptyLayer, exclusions) : [],
    droppedDaySwaps: days?.droppedDaySwaps ?? [],
    emptyByPreference: prefs?.emptyByPreference ?? false,
  };
}

/**
 * Paare (gespeichert, angezeigt, storedOrderNo) der ANGEZEIGTEN Einheit – Eingabe für swapCandidates()/canExclude()
 * im Tausch-Dialog (die Präferenz hängt an der angezeigten Übung, 4.0). Ohne `storedOrderNos` (ältere Aufrufer)
 * über die Vereinigung aus `hidden` und `hiddenByPreference`.
 */
export function displayPairs(
  stored: Pick<StoredSession, 'exercises'>,
  shown: Pick<
    DisplaySession<StoredSession>,
    'session' | 'hidden' | 'hiddenByPreference' | 'storedOrderNos'
  >,
): ExercisePair[] {
  if (shown.storedOrderNos && shown.storedOrderNos.length === shown.session.exercises.length) {
    const orderNos = shown.storedOrderNos;
    return shown.session.exercises.flatMap((e, i) => {
      const original = stored.exercises.find((s) => s.order_no === orderNos[i]);
      return original ? [{ stored: original, shown: e, storedOrderNo: original.order_no }] : [];
    });
  }
  return pairStoredAndShown(stored.exercises, shown.session.exercises, [
    ...shown.hidden,
    ...(shown.hiddenByPreference ?? []),
  ]);
}

/**
 * Kennzeichen einer angezeigten Übung: „equipment_swap“ = beim Erzeugen getauscht, weil die Vorlagen-Übung am Ort
 * nicht machbar ist („ersetzt (Gerät fehlt)“); „adjusted“ = aus anderem Grund getauscht (Vorsichtsregeln beim
 * Erzeugen oder jetzt beim Anzeigen) – ohne Grund zu nennen (kein Gesundheitsbezug); null = wie in der Vorlage.
 * Ab Etappe T1: „preference“ = „getauscht (deine Wahl)“ (Präferenz), „day_swap“ = „heute getauscht“.
 */
export type ExerciseMark = 'equipment_swap' | 'adjusted' | 'preference' | 'day_swap' | null;

/**
 * Prüfreihenfolge (Wächter K6): 1. `storedOrderNo` in `daySwapped` → 'day_swap'; 2. in `preferenceSwapped` →
 * 'preference' (auch „Sicherheits-Ersatz, danach Präferenz“ – die angezeigte Übung stammt aus der Wahl der Person,
 * D-4); 3. nicht in der gespeicherten Einheit → 'adjusted'; 4. `equipment_swap` beim Erzeugen bzw. null. Zuordnung
 * über `storedOrderNo`, nicht über die Übungs-ID. Ohne `at` (ältere Aufrufer) wie bisher.
 */
export function exerciseMark(
  exercise: { readonly exercise_id: string; readonly source_exercise_id: string },
  stored: Pick<StoredSession, 'exercises'>,
  ctx: Pick<DisplayContext, 'library' | 'profile'>,
  at?: {
    readonly storedOrderNo: number;
    readonly display: Pick<DisplaySession<StoredSession>, 'preferenceSwapped' | 'daySwapped'>;
  },
): ExerciseMark {
  if (at) {
    const matches = (r: SwapRecord) =>
      r.storedOrderNo === at.storedOrderNo && r.to === exercise.exercise_id;
    if (at.display.daySwapped?.some(matches)) return 'day_swap';
    if (at.display.preferenceSwapped?.some(matches)) return 'preference';
  }
  if (!stored.exercises.some((e) => e.exercise_id === exercise.exercise_id)) return 'adjusted';
  if (exercise.exercise_id === exercise.source_exercise_id) return null;
  const source = ctx.library?.get(exercise.source_exercise_id);
  return source && ctx.profile && !isExerciseFeasible(source, ctx.profile)
    ? 'equipment_swap'
    : 'adjusted';
}

/** Zum Auflösen eines mehrdeutigen Orts: Übungs-Merkmale und Geräte zu Hause. */
export interface SessionLocationContext {
  readonly library: ReadonlyMap<string, Exercise> | null;
  readonly homeProfile?: Pick<EquipmentProfile, 'available'>;
}

/** Ort einer Einheit und ob er nur geraten ist (Wächter S4). */
export interface SessionLocationInfo {
  readonly location: EquipmentLocation;
  /**
   * true = der Ort folgt NICHT aus festen Tagen oder einem einzigen Kraft-Ort, sondern ist aus der Fassung geraten
   * („Tage egal“ mit beiden Orten, verschobener Tag ohne Eintrag, Angaben unlesbar). Dann wendet die Anzeige die
   * Präferenzen beider Orte an und der Tausch-Dialog fragt bei „immer“ den Ort ab (4.4).
   */
  readonly ambiguous: boolean;
}

/**
 * Ort einer gespeicherten Kraft-Einheit (für Ersatz, Gewichtsstufen und Druck): bei festen Tagen die Art des
 * ursprünglichen Wochentags; bei nur einem Kraft-Ort dieser Ort.
 * Mehrdeutig („Tage egal“ mit Studio UND Zuhause, verschobener Tag ohne Eintrag): Der Ort wird nicht gespeichert,
 * darum aus der Fassung abgeleitet (PDF-Wächter S1) – ist eine Übung mit den Heim-Geräten nicht machbar, ist es die
 * Studio-Fassung; sonst „zu Hause“ (die Heim-Geräte sind immer auch im Studio vorhanden, Ersatz an beiden Orten
 * machbar; bei gleichem Inhalt beider Fassungen gelten die vorsichtigeren Heim-Gewichtsstufen). Ohne Kontext bzw.
 * ohne Bibliothek: „zu Hause“.
 */
export function sessionLocationInfo(
  session: Pick<StoredSession, 'kind' | 'scheduled_on' | 'original_date'> & {
    readonly exercises?: StoredSession['exercises'];
  },
  schedule: TrainingSchedule | null,
  ctx?: SessionLocationContext,
): SessionLocationInfo {
  if (schedule) {
    if (schedule.mode === 'fixed') {
      const weekday = isoWeekday(session.original_date ?? session.scheduled_on);
      const slot = schedule.slots.find((s) => s.weekday === weekday && isStrengthKind(s.kind));
      if (slot) return { location: locationOfKind(slot.kind), ambiguous: false };
    }
    const kinds = new Set(
      schedule.slots.filter((s) => isStrengthKind(s.kind)).map((s) => locationOfKind(s.kind)),
    );
    if (kinds.size === 1) {
      return { location: [...kinds][0] as EquipmentLocation, ambiguous: false };
    }
  }
  const library = ctx?.library;
  const home = ctx?.homeProfile;
  if (library && home && session.exercises && session.exercises.length > 0) {
    const needsGym = session.exercises.some((e) => {
      const exercise = library.get(e.exercise_id);
      return exercise !== undefined && !isExerciseFeasible(exercise, home);
    });
    if (needsGym) return { location: 'gym', ambiguous: true };
  }
  return { location: 'home', ambiguous: true };
}

/** Ort einer gespeicherten Kraft-Einheit – siehe sessionLocationInfo() (unverändert seit Phase 3/PDF). */
export function sessionLocation(
  session: Pick<StoredSession, 'kind' | 'scheduled_on' | 'original_date'> & {
    readonly exercises?: StoredSession['exercises'];
  },
  schedule: TrainingSchedule | null,
  ctx?: SessionLocationContext,
): EquipmentLocation {
  return sessionLocationInfo(session, schedule, ctx).location;
}

// ---------------------------------------------------------------------------------------------------------
// Heute, Woche, Kennzeichen
// ---------------------------------------------------------------------------------------------------------

const byDate = (a: { scheduled_on: string }, b: { scheduled_on: string }) =>
  a.scheduled_on < b.scheduled_on ? -1 : a.scheduled_on > b.scheduled_on ? 1 : 0;

/**
 * Nicht gestrichene Einheit an diesem Tag. „Nie stapeln“ gilt in der Datenbank seit Phase 4 nur für `planned`
 * (PLAN-PHASE-4 Umsetzungsstand B, Festlegung 1): Eine erledigte (`completed`) Einheit belegt ihren Tag nicht mehr,
 * an demselben Tag kann z. B. eine geplante Einheit eines neuen Plans liegen. Dann zählt die noch offene
 * (`planned`) Einheit; sonst die erledigte.
 */
export function sessionOn<T extends StoredSession>(sessions: readonly T[], date: string): T | null {
  const onDay = sessions.filter((s) => s.scheduled_on === date && s.status !== 'skipped');
  return onDay.find((s) => s.status === 'planned') ?? onDay[0] ?? null;
}

/** Erledigte Einheiten an diesem Tag (Anzeige „erledigt“ neben einer offenen Einheit). */
export function completedOn<T extends StoredSession>(sessions: readonly T[], date: string): T[] {
  return sessions.filter((s) => s.scheduled_on === date && s.status === 'completed');
}

/** Nächste geplante Einheit NACH `today`. */
export function nextPlannedSession<T extends StoredSession>(
  sessions: readonly T[],
  today: string,
): T | null {
  return (
    [...sessions].sort(byDate).find((s) => s.status === 'planned' && s.scheduled_on > today) ?? null
  );
}

export interface WeekDay<T extends StoredSession> {
  readonly date: string;
  /** 1 = Montag … 7 = Sonntag. */
  readonly weekday: number;
  readonly isToday: boolean;
  readonly isPast: boolean;
  /** Nicht gestrichene Einheit des Tages oder null (Ruhetag). */
  readonly session: T | null;
  /** An diesem Tag gestrichene Einheiten (Anzeige „entfällt“). */
  readonly skipped: readonly T[];
  /** Einheiten, die von diesem Tag weg verschoben wurden. */
  readonly movedAway: readonly T[];
  /**
   * Weitere erledigte Einheiten des Tages neben `session` (completedOn(), Wächter B S4 / Etappe D): z. B. das heute
   * erledigte Training des alten Plans neben der geplanten Einheit eines neuen Plans – „außerdem erledigt“.
   */
  readonly alsoCompleted: readonly T[];
}

/** Wochenübersicht Montag–Sonntag der ISO-Woche von `date` (Standard: heute). */
export function weekOverview<T extends StoredSession>(
  sessions: readonly T[],
  today: string,
  date: string = today,
): WeekDay<T>[] {
  const monday = startOfIsoWeek(date);
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(monday, index);
    const session = sessionOn(sessions, day);
    return {
      date: day,
      weekday: index + 1,
      isToday: day === today,
      isPast: day < today,
      session,
      alsoCompleted: completedOn(sessions, day).filter((s) => s.id !== session?.id),
      skipped: sessions.filter((s) => s.scheduled_on === day && s.status === 'skipped'),
      movedAway: sessions.filter(
        (s) => s.original_date === day && s.scheduled_on !== day && s.status !== 'skipped',
      ),
    };
  });
}

export interface BlockWeek {
  readonly blockNo: number;
  /** 0 = Woche 0 (zum Reinschnuppern). */
  readonly weekNo: number;
  /** Wochen des Blocks ohne Woche 0 (Belastungswochen + Erholungswoche). */
  readonly weeksInBlock: number;
  readonly isIntroWeek: boolean;
  readonly isDeload: boolean;
}

/**
 * Kopf „Woche 2 von 6“: Block und Woche der ISO-Woche von `today` (aus einer Einheit dieser Woche, sonst der
 * nächsten geplanten). null = keine Einheit mehr.
 */
export function blockWeekFor(sessions: readonly StoredSession[], today: string): BlockWeek | null {
  const monday = startOfIsoWeek(today);
  const sunday = addDays(monday, 6);
  const sorted = [...sessions].sort(byDate);
  const reference =
    sorted.find((s) => s.scheduled_on >= monday && s.scheduled_on <= sunday) ??
    sorted.find((s) => s.scheduled_on > sunday);
  if (!reference) return null;
  const inBlock = sessions.filter((s) => s.block_no === reference.block_no);
  return {
    blockNo: reference.block_no,
    weekNo: reference.week_no,
    weeksInBlock: Math.max(...inBlock.map((s) => s.week_no)),
    isIntroWeek: reference.is_intro_week,
    isDeload: reference.is_deload,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Folgeblock (Abschnitt 5.10): fällig, sobald die letzte Woche des letzten Blocks beginnt
// ---------------------------------------------------------------------------------------------------------

export type FollowUpState =
  /** Noch nicht nötig. */
  | 'not_due'
  /** Jetzt erzeugen (append_plan_block). */
  | 'due'
  /** Plan ist abgelaufen (erste Woche des Folgeblocks schon vorbei) → „Plan neu erstellen“ anbieten. */
  | 'ended';

export function followUpBlockState(
  sessions: readonly StoredSession[],
  today: string,
): FollowUpState {
  if (sessions.length === 0) return 'not_due';
  const lastBlock = Math.max(...sessions.map((s) => s.block_no));
  const block = sessions.filter((s) => s.block_no === lastBlock);
  const lastWeekNo = Math.max(...block.map((s) => s.week_no));
  const lastWeek = block.filter((s) => s.week_no === lastWeekNo);
  const firstDay = lastWeek.map((s) => s.original_date ?? s.scheduled_on).sort()[0] as string;
  const lastDate = sessions
    .map((s) => s.scheduled_on)
    .sort()
    .at(-1) as string;
  const nextMonday = addDays(startOfIsoWeek(lastDate), 7);
  if (today > addDays(nextMonday, 6)) return 'ended';
  return today >= startOfIsoWeek(firstDay) ? 'due' : 'not_due';
}

/** Einheiten eines Folgeblocks, die nicht in der Vergangenheit liegen (die Datenbank nimmt nur ab heute an). */
export function dropPastSessions<T extends { scheduled_on: string }>(
  sessions: readonly T[],
  today: string,
): T[] {
  return sessions.filter((s) => s.scheduled_on >= today);
}

// ---------------------------------------------------------------------------------------------------------
// „Plan neu erstellen?“ (Abschnitt 10.4) – nie stilles Ersetzen
// ---------------------------------------------------------------------------------------------------------

export type PlanOfferReason = PlanUpdateReason | 'stricter_rules';

export interface PlanUpdateOffer {
  readonly offer: boolean;
  readonly reasons: readonly PlanOfferReason[];
  /**
   * Strengere Regeln (strengere Startgruppe: neues Gesundheits-Flag, 65. Geburtstag; oder neuer Check mit Flag) –
   * „deutlich“ anbieten. Die Anzeige wendet sie ohnehin sofort an. Lockerungen (18. Geburtstag, Flag entfällt)
   * zählen nicht als strenger.
   */
  readonly stricter: boolean;
}

export function planUpdateOffer(
  plan: PlanForUpdate & PlanStartGroupSource,
  current: CurrentState,
  rules: Pick<PlanSafetyRules, 'enduranceStartGroup' | 'medicalNotice'>,
  today: string,
): PlanUpdateOffer {
  const base = planNeedsUpdate(plan, current, today);
  const reasons: PlanOfferReason[] = [...base.reasons];
  const stricterGroup = isStricterGroup(
    rules.enduranceStartGroup,
    planStartGroup(plan, current.birthDate),
  );
  if (stricterGroup) reasons.push('stricter_rules');
  return {
    offer: reasons.length > 0,
    reasons,
    stricter:
      stricterGroup ||
      (reasons.includes('health_check_newer') && rules.medicalNotice && !plan.medical_notice),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Feste Plan-Hinweise (kein Hinweis-Code der Engine, sondern aus der Vorlage abgeleitet)
// ---------------------------------------------------------------------------------------------------------

/**
 * `bodyweight_limits`: Plan aus einer Körpergewicht-Vorlage (docs/PLAN-KOERPERGEWICHT.md §1, Etappe K4, A9) –
 * die App sagt ehrlich, wo die Grenze des Trainingsreizes ohne Geräte liegt und was Geräte ändern.
 */
export type PlanInfoNotice = 'bodyweight_limits';

/**
 * Welche festen Hinweise zu einem gespeicherten Plan gehören. Entscheidung allein über das Vorlagen-Kennzeichen
 * (isBodyweightTemplate bzw. ID-Endung, wenn die Vorlage nicht in der Bibliothek steht – Bibliothek noch nicht
 * geladen, offline, archiviert; `library = null` heißt „nicht geladen“). Reiner Ausdauer-Plan (`template_id` null)
 * und gemischte Wochen (Studio-Vorlage) → kein Hinweis.
 */
export function planInfoNotices(
  plan: { readonly template_id: string | null },
  library: Pick<PlanLibrary, 'templates'> | null,
): PlanInfoNotice[] {
  return isBodyweightTemplateId(library ?? { templates: [] }, plan.template_id)
    ? ['bodyweight_limits']
    : [];
}
