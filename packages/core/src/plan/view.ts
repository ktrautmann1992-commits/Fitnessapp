import type { Exercise } from '../content/schemas';
import { addDays, isoWeekday, startOfIsoWeek } from '../dates';
import type { EquipmentLocation, PlannedSessionStatus } from '../enums';
import type { TrainingSchedule } from '../training-schedule';
import { applyCurrentEnduranceRules, applyCurrentSafetyRules } from './apply-safety';
import { type EquipmentProfile, isExerciseFeasible } from './equipment-profile';
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
}

export interface DisplaySession<T extends StoredSession> {
  readonly session: T;
  /** Ausgeblendete Übungen (nicht erlaubt und kein Ersatz, oder nicht prüfbar). */
  readonly hidden: readonly string[];
  readonly replaced: readonly string[];
  /**
   * Eigener Zustand „Übungen können gerade nicht geprüft werden“ (Abschnitt 10.3): Kraft-Einheit, deren Übungen
   * alle nicht in der Bibliothek stehen (Bibliothek fehlt) – statt einer leeren Einheit.
   */
  readonly libraryMissing: boolean;
}

/**
 * Pflichtaufruf vor dem Anzeigen JEDER Einheit: applyCurrentEnduranceRules (Ausdauer: Anstrengung, Gehen statt
 * Laufen, Start-Deckel bei strengerer Gruppe) und applyCurrentSafetyRules (Kraft: RPE-Deckel, Ersatz oder
 * Ausblenden). Strengere Regeln wirken so sofort; Lockerungen nie (beide Funktionen senken nur).
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
  return {
    session: safe.session,
    hidden: safe.hidden,
    replaced: safe.replaced,
    libraryMissing,
  };
}

/**
 * Kennzeichen einer angezeigten Übung: „equipment_swap“ = beim Erzeugen getauscht, weil die Vorlagen-Übung am Ort
 * nicht machbar ist („ersetzt (Gerät fehlt)“); „adjusted“ = aus anderem Grund getauscht (Vorsichtsregeln beim
 * Erzeugen oder jetzt beim Anzeigen) – ohne Grund zu nennen (kein Gesundheitsbezug); null = wie in der Vorlage.
 */
export type ExerciseMark = 'equipment_swap' | 'adjusted' | null;

export function exerciseMark(
  exercise: { readonly exercise_id: string; readonly source_exercise_id: string },
  stored: Pick<StoredSession, 'exercises'>,
  ctx: Pick<DisplayContext, 'library' | 'profile'>,
): ExerciseMark {
  if (!stored.exercises.some((e) => e.exercise_id === exercise.exercise_id)) return 'adjusted';
  if (exercise.exercise_id === exercise.source_exercise_id) return null;
  const source = ctx.library?.get(exercise.source_exercise_id);
  return source && ctx.profile && !isExerciseFeasible(source, ctx.profile)
    ? 'equipment_swap'
    : 'adjusted';
}

/**
 * Ort einer gespeicherten Kraft-Einheit (für den Ersatz in der Anzeige): bei festen Tagen die Art des
 * ursprünglichen Wochentags; sonst (Tage egal, unbekannt) „zu Hause“ – die Heim-Geräte sind immer auch im Studio
 * vorhanden, ein Ersatz ist damit an beiden Orten machbar.
 */
export function sessionLocation(
  session: Pick<StoredSession, 'kind' | 'scheduled_on' | 'original_date'>,
  schedule: TrainingSchedule | null,
): EquipmentLocation {
  if (schedule?.mode === 'fixed') {
    const weekday = isoWeekday(session.original_date ?? session.scheduled_on);
    const slot = schedule.slots.find((s) => s.weekday === weekday && isStrengthKind(s.kind));
    if (slot) return locationOfKind(slot.kind);
    const kinds = new Set(
      schedule.slots.filter((s) => isStrengthKind(s.kind)).map((s) => locationOfKind(s.kind)),
    );
    if (kinds.size === 1) return [...kinds][0] as EquipmentLocation;
  } else if (schedule) {
    const kinds = new Set(
      schedule.slots.filter((s) => isStrengthKind(s.kind)).map((s) => locationOfKind(s.kind)),
    );
    if (kinds.size === 1) return [...kinds][0] as EquipmentLocation;
  }
  return 'home';
}

// ---------------------------------------------------------------------------------------------------------
// Heute, Woche, Kennzeichen
// ---------------------------------------------------------------------------------------------------------

const byDate = (a: { scheduled_on: string }, b: { scheduled_on: string }) =>
  a.scheduled_on < b.scheduled_on ? -1 : a.scheduled_on > b.scheduled_on ? 1 : 0;

/** Nicht gestrichene Einheit an diesem Tag (höchstens eine – Regel „nie stapeln“). */
export function sessionOn<T extends StoredSession>(sessions: readonly T[], date: string): T | null {
  return sessions.find((s) => s.scheduled_on === date && s.status !== 'skipped') ?? null;
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
    return {
      date: day,
      weekday: index + 1,
      isToday: day === today,
      isPast: day < today,
      session: sessionOn(sessions, day),
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
