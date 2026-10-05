import { z } from 'zod';

import {
  DEFAULT_SLOT_MINUTES,
  ENDURANCE_GOAL_SUGGESTION,
  ENDURANCE_START_RULES,
  MAX_STRENGTH_SESSIONS_PER_WEEK,
  SCHEDULE_HINT_LIMITS,
  TRAINING_LIMITS,
  WEEKLY_SESSION_LIMITS,
} from './constants';
import {
  TRAINING_SLOT_KINDS,
  type EnduranceDiscipline,
  type ExperienceLevel,
  type GoalType,
  type TrainingLocation,
  type TrainingSlotKind,
} from './enums';
import { weekdaySchema } from './validation';

/**
 * Schritt „Deine Trainingstage“ (docs/PLAN-PHASE-3-ERWEITERUNG.md Abschnitte 3.2 und 4.1, Etappe B2):
 * je Wochentag Trainingsart + Dauer („Feste Wochentage“) oder nur Anzahl je Art + Dauer („Tage egal“).
 * Ersetzt Zeitbudget (Tage pro Woche, eine Dauer, Wunsch-Tage) und den Schritt „Trainingsort“ – der Ort wird
 * abgeleitet (deriveTrainingLocation). Gespeichert in der Tabelle training_slots (replace_training_slots).
 */

export const trainingSlotKindSchema = z.enum(TRAINING_SLOT_KINDS, {
  error: 'Bitte wähle eine Trainingsart.',
});

const { min: MINUTES_MIN, max: MINUTES_MAX } = TRAINING_LIMITS.minutesPerSession;
const MAX_SLOTS = TRAINING_LIMITS.sessionsPerWeek.max;

/** Dauer einer Einheit: ganze Minuten 10–240 (= CHECK `minutes between 10 and 240`). */
export const slotMinutesSchema = z
  .number({ error: 'Minuten: bitte eine Zahl eingeben.' })
  .int('Minuten: bitte eine ganze Zahl eingeben.')
  .min(MINUTES_MIN, `Minuten: mindestens ${MINUTES_MIN}.`)
  .max(MINUTES_MAX, `Minuten: höchstens ${MINUTES_MAX}.`);

export const fixedSlotSchema = z.strictObject({
  weekday: weekdaySchema,
  kind: trainingSlotKindSchema,
  minutes: slotMinutesSchema,
});
export const flexSlotSchema = z.strictObject({
  kind: trainingSlotKindSchema,
  minutes: slotMinutesSchema,
});
export type FixedSlot = z.infer<typeof fixedSlotSchema>;
export type FlexSlot = z.infer<typeof flexSlotSchema>;

const kindOrder = (kind: TrainingSlotKind) => TRAINING_SLOT_KINDS.indexOf(kind);

/** Feste Tage Mo → So. */
function sortFixed(slots: readonly FixedSlot[]): FixedSlot[] {
  return [...slots].sort((a, b) => a.weekday - b.weekday);
}

/** „Tage egal“: nach Art (Anzeige-Reihenfolge), dann längste Dauer zuerst – deterministisch. */
function sortFlex(slots: readonly FlexSlot[]): FlexSlot[] {
  return [...slots].sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind) || b.minutes - a.minutes);
}

/**
 * Trainingsplan-Wunsch der Woche. Kein gemischter Modus (Frage 1): entweder ALLE Einträge mit Wochentag
 * („fixed“) oder KEINER („flex“). 1–7 Einträge, jeder Wochentag höchstens einmal. Ausgabe sortiert.
 */
export const trainingScheduleSchema = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z.literal('fixed'),
    slots: z
      .array(fixedSlotSchema)
      .min(1, 'Bitte wähle mindestens einen Trainingstag.')
      .max(MAX_SLOTS, `Höchstens ${MAX_SLOTS} Trainingstage pro Woche.`)
      .refine(
        (slots) => new Set(slots.map((slot) => slot.weekday)).size === slots.length,
        'Jeder Wochentag nur einmal.',
      )
      .transform(sortFixed),
  }),
  z.strictObject({
    mode: z.literal('flex'),
    slots: z
      .array(flexSlotSchema)
      .min(1, 'Bitte plane mindestens eine Einheit pro Woche.')
      .max(MAX_SLOTS, `Höchstens ${MAX_SLOTS} Einheiten pro Woche.`)
      .transform(sortFlex),
  }),
]);
export type TrainingSchedule = z.output<typeof trainingScheduleSchema>;
export type TrainingScheduleMode = TrainingSchedule['mode'];

// ---------------------------------------------------------------------------------------------------------
// Zeilen der Tabelle training_slots = Eingabe von public.replace_training_slots(p_items)
// ---------------------------------------------------------------------------------------------------------

/** Ein Eintrag wie in der Datenbank (Feldnamen = Schlüssel in replace_training_slots, db-sync.test.ts). */
export const trainingSlotItemSchema = z.strictObject({
  slot_no: z.number().int().min(1).max(MAX_SLOTS),
  /** null = „Tag egal“ */
  weekday: weekdaySchema.nullable(),
  kind: trainingSlotKindSchema,
  minutes: slotMinutesSchema,
});
export type TrainingSlotItem = z.infer<typeof trainingSlotItemSchema>;

/**
 * Alle Trainingstage einer Person – dieselben Regeln wie public.replace_training_slots: 1–7 Einträge,
 * slot_no lückenlos 1…n, alle oder keiner mit Wochentag, Wochentag eindeutig.
 */
export const trainingSlotsSchema = z
  .array(trainingSlotItemSchema)
  .min(1)
  .max(MAX_SLOTS)
  .superRefine((items, ctx) => {
    const numbers = items.map((item) => item.slot_no).sort((a, b) => a - b);
    if (numbers.some((no, index) => no !== index + 1)) {
      ctx.addIssue({ code: 'custom', message: 'Trainingstage: Nummern lückenlos ab 1.' });
    }
    const withDay = items.filter((item) => item.weekday !== null);
    if (withDay.length !== 0 && withDay.length !== items.length) {
      ctx.addIssue({ code: 'custom', message: 'Entweder alle Tage fest oder alle „Tag egal“.' });
    }
    if (new Set(withDay.map((item) => item.weekday)).size !== withDay.length) {
      ctx.addIssue({ code: 'custom', message: 'Jeder Wochentag nur einmal.' });
    }
  });

/** Wochenplan → Tabellenzeilen (slot_no in Anzeige-Reihenfolge). Erwartet einen geprüften Plan. */
export function scheduleToSlots(schedule: TrainingSchedule): TrainingSlotItem[] {
  if (schedule.mode === 'fixed') {
    return sortFixed(schedule.slots).map((slot, index) => ({
      slot_no: index + 1,
      weekday: slot.weekday,
      kind: slot.kind,
      minutes: slot.minutes,
    }));
  }
  return sortFlex(schedule.slots).map((slot, index) => ({
    slot_no: index + 1,
    weekday: null,
    kind: slot.kind,
    minutes: slot.minutes,
  }));
}

/** Tabellenzeilen → Wochenplan; null = keine oder ungültige Zeilen. */
export function scheduleFromSlots(
  items: readonly Pick<TrainingSlotItem, 'slot_no' | 'weekday' | 'kind' | 'minutes'>[],
): TrainingSchedule | null {
  if (items.length === 0) {
    return null;
  }
  const sorted = [...items].sort((a, b) => a.slot_no - b.slot_no);
  const fixed = sorted.every((item) => item.weekday !== null);
  const parsed = trainingScheduleSchema.safeParse(
    fixed
      ? {
          mode: 'fixed',
          slots: sorted.map((i) => ({ weekday: i.weekday, kind: i.kind, minutes: i.minutes })),
        }
      : { mode: 'flex', slots: sorted.map((i) => ({ kind: i.kind, minutes: i.minutes })) },
  );
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------------------------------------
// Ableitungen
// ---------------------------------------------------------------------------------------------------------

/**
 * Trainingsort aus den Arten (Abschnitt 3.1): nur Studio → gym, nur zu Hause → home, beides → both,
 * nur Ausdauer → null (kein Kraft-Ort). Wird als goals.training_location gespeichert.
 */
export function deriveTrainingLocation(schedule: TrainingSchedule): TrainingLocation | null {
  const gym = schedule.slots.some((slot) => slot.kind === 'strength_gym');
  const home = schedule.slots.some((slot) => slot.kind === 'strength_home');
  if (gym && home) {
    return 'both';
  }
  return gym ? 'gym' : home ? 'home' : null;
}

/** Mindestens ein Tag „Kraft zu Hause“? Dann folgt der Schritt „Equipment“. */
export function hasHomeStrength(schedule: TrainingSchedule): boolean {
  return schedule.slots.some((slot) => slot.kind === 'strength_home');
}

/** Vorschlag für die erste Karte: Ziel Ausdauer → Ausdauer, sonst Kraft im Studio. */
export function suggestedSlotKind(goalType: GoalType | null | undefined): TrainingSlotKind {
  return goalType === 'endurance' ? 'endurance' : 'strength_gym';
}

const TRIATHLONS: readonly EnduranceDiscipline[] = [
  'triathlon_sprint',
  'triathlon_olympic',
  'triathlon_middle',
  'triathlon_long',
];

/** Startgruppe wie die Plan-Engine: vorsichtig, unter 18, ab 65 oder Alter unbekannt → vorsichtig. */
function suggestionGroup(input: {
  experienceLevel: ExperienceLevel | null | undefined;
  ageYears: number | null;
  cautious: boolean;
}): 'cautious' | ExperienceLevel {
  const { ageYears } = input;
  if (
    input.cautious ||
    ageYears === null ||
    ageYears < WEEKLY_SESSION_LIMITS.minorBelowAge ||
    ageYears >= WEEKLY_SESSION_LIMITS.seniorFromAge
  ) {
    return 'cautious';
  }
  return input.experienceLevel ?? 'beginner';
}

/** Kraft-Tage mit größtmöglichem Abstand (rund um die Woche), lieber unter der Woche, sonst früher. */
function pickStrengthDays(days: readonly number[], count: number): number[] {
  if (count <= 0) return [];
  let best: number[] = [];
  let bestKey: [number, number] | null = null;
  const choose = (start: number, picked: number[]) => {
    if (picked.length === count) {
      const gaps = picked.map((day, i) => {
        const nextDay = picked[(i + 1) % picked.length] ?? day;
        return picked.length === 1 ? 7 : (nextDay - day + 7) % 7 || 7;
      });
      const key: [number, number] = [Math.min(...gaps), -picked.filter((day) => day >= 6).length];
      if (!bestKey || key[0] > bestKey[0] || (key[0] === bestKey[0] && key[1] > bestKey[1])) {
        best = [...picked];
        bestKey = key;
      }
      return;
    }
    for (let i = start; i < days.length; i += 1) {
      choose(i + 1, [...picked, days[i] as number]);
    }
  };
  choose(0, []);
  return best;
}

/**
 * Feste Wochentage für `endurance` Ausdauer- und `strength` Kraft-Einheiten (zusammen 1–7, sonst leer):
 * Tage aus ENDURANCE_GOAL_SUGGESTION.weekdays, Kraft mit größtem Abstand, Dauer DEFAULT_SLOT_MINUTES.
 */
export function suggestedWeekSlots(
  endurance: number,
  strength: number,
  strengthKind: Exclude<TrainingSlotKind, 'endurance'> = 'strength_gym',
): FixedSlot[] {
  const total = endurance + strength;
  if (endurance < 0 || strength < 0 || total < 1 || total > MAX_SLOTS) {
    return [];
  }
  const days =
    ENDURANCE_GOAL_SUGGESTION.weekdays[total as keyof typeof ENDURANCE_GOAL_SUGGESTION.weekdays];
  const strengthDays = new Set(pickStrengthDays(days, strength));
  return days.map((weekday) => {
    const kind: TrainingSlotKind = strengthDays.has(weekday) ? strengthKind : 'endurance';
    return { weekday, kind, minutes: DEFAULT_SLOT_MINUTES[kind] };
  });
}

/**
 * Vorbelegung „Deine Trainingstage“ beim Ziel Ausdauer (ENDURANCE_GOAL_SUGGESTION): Ausdauer- und Kraft-Tage
 * nach Startgruppe und Disziplin, gekürzt auf den Wochen-Deckel (weeklySessionCap) und den Ausdauer-Deckel der
 * Startgruppe (ENDURANCE_START_RULES). Andere Ziele → null (keine Vorbelegung). Nur ein Vorschlag – die App
 * belegt damit nur vor, solange noch keine Trainingstage gewählt sind.
 */
export function suggestedTrainingSlots(input: {
  goalType: GoalType | null | undefined;
  discipline: EnduranceDiscipline | null | undefined;
  experienceLevel: ExperienceLevel | null | undefined;
  ageYears: number | null;
  cautious: boolean;
  /** Ort der Kraft-Tage (bisherige Auswahl); ohne Angabe Studio. */
  strengthKind?: Exclude<TrainingSlotKind, 'endurance'>;
}): TrainingSchedule | null {
  if (input.goalType !== 'endurance') {
    return null;
  }
  const group = suggestionGroup(input);
  const triathlon = input.discipline != null && TRIATHLONS.includes(input.discipline);
  const base = ENDURANCE_GOAL_SUGGESTION.perGroup[group];
  let endurance: number = base.endurance;
  let strength: number = base.strength;
  if (triathlon && group !== 'cautious') {
    const extra: Partial<Record<ExperienceLevel, number>> =
      ENDURANCE_GOAL_SUGGESTION.triathlonExtraEndurance;
    const strengthOverride: Partial<Record<ExperienceLevel, number>> =
      ENDURANCE_GOAL_SUGGESTION.triathlonStrength;
    endurance += extra[group] ?? 0;
    strength = strengthOverride[group] ?? strength;
  }
  endurance = Math.min(endurance, ENDURANCE_START_RULES.maxSessionsPerWeek[group]);
  const cap = Math.min(weeklySessionCap(input) ?? MAX_SLOTS, MAX_SLOTS);
  const minEndurance = SCHEDULE_HINT_LIMITS.recommendedMinEnduranceDays;
  while (endurance + strength > cap) {
    if (strength > 1) strength -= 1;
    else if (endurance > minEndurance) endurance -= 1;
    else if (strength > 0) strength -= 1;
    else endurance -= 1;
  }
  return trainingScheduleSchema.parse({
    mode: 'fixed',
    slots: suggestedWeekSlots(endurance, strength, input.strengthKind),
  });
}

/** Untertitel der Art „Ausdauer“ (Wunsch-Sportart, Abschnitt 3.2); Texte in der App (i18n). */
export type EnduranceSubtitle = 'running' | 'cycling' | 'swimming' | 'running_cycling';

export function enduranceSlotSubtitle(
  discipline: EnduranceDiscipline | null | undefined,
): EnduranceSubtitle {
  switch (discipline) {
    case 'cycling':
      return 'cycling';
    case 'swimming':
      return 'swimming';
    case 'triathlon_sprint':
    case 'triathlon_olympic':
    case 'triathlon_middle':
    case 'triathlon_long':
      return 'running_cycling';
    default:
      // ohne Disziplin, 5 km bis Marathon
      return 'running';
  }
}

export interface ScheduleTotals {
  sessions: number;
  minutesPerWeek: number;
  byKind: Record<TrainingSlotKind, number>;
}

/** Live-Zusammenfassung: Einheiten, Minuten pro Woche, Anzahl je Art. */
export function scheduleTotals(schedule: { slots: readonly FlexSlot[] }): ScheduleTotals {
  const byKind: Record<TrainingSlotKind, number> = {
    strength_gym: 0,
    strength_home: 0,
    endurance: 0,
  };
  let minutesPerWeek = 0;
  for (const slot of schedule.slots) {
    byKind[slot.kind] += 1;
    minutesPerWeek += slot.minutes;
  }
  return { sessions: schedule.slots.length, minutesPerWeek, byKind };
}

export interface SlotGroup {
  kind: TrainingSlotKind;
  minutes: number;
  count: number;
}

/** Gleiche Art + Dauer zusammengefasst („2× Kraft im Studio à 60 min“), in Anzeige-Reihenfolge. */
export function groupSlots(slots: readonly FlexSlot[]): SlotGroup[] {
  const groups: SlotGroup[] = [];
  for (const slot of sortFlex(slots)) {
    const last = groups.at(-1);
    if (last && last.kind === slot.kind && last.minutes === slot.minutes) {
      last.count += 1;
    } else {
      groups.push({ kind: slot.kind, minutes: slot.minutes, count: 1 });
    }
  }
  return groups;
}

/**
 * Gesamt-Deckel der Woche (WEEKLY_SESSION_LIMITS): Einsteiger, vorsichtig (Gesundheits-Flag oder ohne
 * Gesundheits-Check), unter 18 oder ab 65 → 5 Einheiten; sonst kein Deckel (null).
 * `ageYears` null = unbekannt → vorsichtshalber wie mit Deckel.
 */
export function weeklySessionCap(input: {
  experienceLevel: ExperienceLevel | null | undefined;
  ageYears: number | null;
  cautious: boolean;
}): number | null {
  const { ageYears } = input;
  const capped =
    input.cautious ||
    input.experienceLevel == null ||
    input.experienceLevel === 'beginner' ||
    ageYears === null ||
    ageYears < WEEKLY_SESSION_LIMITS.minorBelowAge ||
    ageYears >= WEEKLY_SESSION_LIMITS.seniorFromAge;
  return capped ? WEEKLY_SESSION_LIMITS.cautiousMaxSessions : null;
}

/** Hinweis-Codes im Schritt „Deine Trainingstage“ (nie blockierend, Texte in der App). */
export const SCHEDULE_HINTS = [
  'endurance_goal_no_endurance',
  'strength_goal_no_strength',
  'strength_days_over_max',
  'strength_back_to_back',
  'no_rest_day',
  'week_total_capped',
] as const;
export type ScheduleHint = (typeof SCHEDULE_HINTS)[number];

const STRENGTH_GOALS: readonly GoalType[] = ['muscle_gain', 'definition'];
const isStrength = (kind: TrainingSlotKind) => kind !== 'endurance';

/**
 * Freundliche Hinweise zum Wochenplan (Abschnitt 3.2, Frage 13: nur Hinweis, nie blockieren).
 * `weeklySessionCap` aus weeklySessionCap(); bei Deckel und mehr Einheiten → week_total_capped, sonst bei
 * 7 Tagen no_rest_day.
 */
export function scheduleHints(
  schedule: TrainingSchedule,
  context: { goalType: GoalType | null | undefined; weeklySessionCap: number | null },
): ScheduleHint[] {
  const totals = scheduleTotals(schedule);
  const strength = totals.byKind.strength_gym + totals.byKind.strength_home;
  const hints: ScheduleHint[] = [];
  if (
    context.goalType === 'endurance' &&
    totals.byKind.endurance < SCHEDULE_HINT_LIMITS.recommendedMinEnduranceDays
  ) {
    hints.push('endurance_goal_no_endurance');
  }
  if (
    context.goalType != null &&
    STRENGTH_GOALS.includes(context.goalType) &&
    strength < SCHEDULE_HINT_LIMITS.recommendedMinStrengthDays
  ) {
    hints.push('strength_goal_no_strength');
  }
  if (strength > MAX_STRENGTH_SESSIONS_PER_WEEK) {
    hints.push('strength_days_over_max');
  }
  if (schedule.mode === 'fixed') {
    const days = new Set(schedule.slots.filter((s) => isStrength(s.kind)).map((s) => s.weekday));
    // Auch Sonntag → Montag der Folgewoche.
    if ([...days].some((day) => days.has((day % 7) + 1))) {
      hints.push('strength_back_to_back');
    }
  }
  const cap = context.weeklySessionCap;
  if (cap !== null && totals.sessions > cap) {
    hints.push('week_total_capped');
  } else if (totals.sessions >= MAX_SLOTS) {
    hints.push('no_rest_day');
  }
  return hints;
}

/**
 * NUR für den Gerätespeicher des Testmodus (Abschnitt 4.2): alte goals-Felder (bis Etappe B2) → Wochenplan –
 * dieselbe Regel wie die Übernahme in der Migration …_training_slots.sql:
 * Art aus dem Ort (home → Kraft zu Hause, sonst Kraft im Studio), Minuten = minutes_per_session;
 * Anzahl Wunsch-Tage = Tage pro Woche → feste Tage, sonst „Tage egal“ (die Wunsch-Tage entfallen).
 * null = kein (vollständiges) altes Zeitbudget.
 */
export function scheduleFromLegacyGoals(goals: {
  sessions_per_week?: number | null;
  minutes_per_session?: number | null;
  preferred_days?: readonly number[] | null;
  training_location?: TrainingLocation | null;
}): TrainingSchedule | null {
  const sessions = goals.sessions_per_week;
  const minutes = goals.minutes_per_session;
  if (sessions == null || minutes == null) {
    return null;
  }
  const kind: TrainingSlotKind =
    goals.training_location === 'home' ? 'strength_home' : 'strength_gym';
  const days = [...new Set(goals.preferred_days ?? [])].sort((a, b) => a - b);
  const parsed = trainingScheduleSchema.safeParse(
    days.length === sessions
      ? { mode: 'fixed', slots: days.map((weekday) => ({ weekday, kind, minutes })) }
      : { mode: 'flex', slots: Array.from({ length: sessions }, () => ({ kind, minutes })) },
  );
  return parsed.success ? parsed.data : null;
}
