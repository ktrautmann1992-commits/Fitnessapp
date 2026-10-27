import { z } from 'zod';

import { isoDateSchema } from '../age';
import {
  COMPETITION_CYCLING,
  COMPETITION_INPUT_LIMITS,
  COMPETITION_LEAD_WEEKS,
  COMPETITION_OWN_START,
  TRAINING_LIMITS,
} from '../constants';
import { addDays } from '../dates';
import type { EnduranceDiscipline, ExperienceLevel } from '../enums';

/**
 * Wettkampf-Eingaben (docs/PLAN-PHASE-10.md Abschnitt 5, Etappe WP1), an der Grenze mit Zod geprüft.
 * Gespeichert in der Tabelle `competitions` (WP3, plan/competition-record.ts) – dieselben Grenzen als CHECK
 * (db-sync.test.ts).
 */

/** Lauf-Disziplinen (WP1–WP4): nur hier gibt es Zielzeit, Referenzzeit, Riegel und Pace (W-G6). */
export const RUN_COMPETITION_DISCIPLINES = ['5k', '10k', 'half_marathon', 'marathon'] as const;
export type RunCompetitionDiscipline = (typeof RUN_COMPETITION_DISCIPLINES)[number];

/** Triathlon mit Wettkampfplan (WP5, W-G2): Sprint und Olympisch. */
export const TRIATHLON_COMPETITION_DISCIPLINES = ['triathlon_sprint', 'triathlon_olympic'] as const;
export type TriathlonCompetitionDiscipline = (typeof TRIATHLON_COMPETITION_DISCIPLINES)[number];

/**
 * Disziplinen mit Wettkampfplan (W-G2): Laufen 5 km bis Marathon (WP1), dazu mit WP5 Rad (freie Distanz 20–300 km,
 * `distanceKm`) und Triathlon Sprint/Olympisch. Teilmenge von ENDURANCE_DISCIPLINES; Reihenfolge = Postgres-Enum
 * `competition_discipline` (WP5 per `add value`).
 */
export const COMPETITION_DISCIPLINES = [
  ...RUN_COMPETITION_DISCIPLINES,
  'cycling',
  ...TRIATHLON_COMPETITION_DISCIPLINES,
  // Sportarten Stufe 1 (docs/PLAN-SPORTARTEN-STUFE-1.md 2.1, per `add value` in 20261027100000): 8 × (1 km + Station),
  // Division in competitions.hyrox_division; Wochenbau, Ampel und Regeln in Etappe H (HYROX_PLAN, packages/core/src/hyrox).
  'hyrox',
] as const;
export type CompetitionDiscipline = (typeof COMPETITION_DISCIPLINES)[number];

/**
 * Ausdauer-Disziplinen OHNE Wettkampfplan (W-G2): Triathlon Mittel-/Langdistanz und Schwimm-Wettkämpfe – die App zeigt
 * den Hinweis „Trainer bzw. Verein“; der Grundlagen-Plan (Phase 3) bleibt.
 */
export const COMPETITION_NO_PLAN_DISCIPLINES = [
  'triathlon_middle',
  'triathlon_long',
  'swimming',
] as const satisfies readonly EnduranceDiscipline[];

/**
 * Vorbelegung der Distanz in „Mein Wettkampf“ aus dem Ziel: Hauptziel Ausdauer mit Wettkampf-Disziplin → diese;
 * Triathlon Mittel-/Langdistanz (kein Plan, W-G2) → die längste Triathlon-Distanz mit Plan (olympisch); sonst
 * (kein Ausdauer-Ziel, keine Disziplin, Schwimmen) der Halbmarathon wie bisher (WP4).
 */
export function defaultCompetitionDiscipline(
  goal: { readonly goalType: string; readonly discipline: EnduranceDiscipline | null } | null,
): CompetitionDiscipline {
  if (goal === null || goal.goalType !== 'endurance') return 'half_marathon';
  if (isCompetitionDiscipline(goal.discipline)) return goal.discipline;
  if (goal.discipline === 'triathlon_middle' || goal.discipline === 'triathlon_long') {
    return 'triathlon_olympic';
  }
  return 'half_marathon';
}

/** Lauf-Disziplin (Zielzeit, Referenzzeit, Pace)? */
export function isRunCompetitionDiscipline(value: unknown): value is RunCompetitionDiscipline {
  return (RUN_COMPETITION_DISCIPLINES as readonly unknown[]).includes(value);
}

/** Triathlon Sprint/Olympisch? */
export function isTriathlonCompetitionDiscipline(
  value: unknown,
): value is TriathlonCompetitionDiscipline {
  return (TRIATHLON_COMPETITION_DISCIPLINES as readonly unknown[]).includes(value);
}

/**
 * Wettkampfplan für diese Ausdauer-Disziplin des Ziels? `plan` = ja; `coach` = bewusst kein Plan (Mittel-/Langdistanz,
 * Schwimmen – Hinweis Trainer/Verein, W-G2); `none` = keine Disziplin.
 */
export function competitionPlanOffer(
  discipline: EnduranceDiscipline | null | undefined,
): 'plan' | 'coach' | 'none' {
  if (discipline === null || discipline === undefined) return 'none';
  if ((COMPETITION_NO_PLAN_DISCIPLINES as readonly string[]).includes(discipline)) return 'coach';
  return isCompetitionDiscipline(discipline) ? 'plan' : 'none';
}

/** Ziel: „Ankommen“ (Standard, W-G6) oder Zielzeit (nur mit Referenzzeit). */
export const COMPETITION_GOALS = ['finish', 'time'] as const;
export type CompetitionGoal = (typeof COMPETITION_GOALS)[number];

/**
 * Stand eines gespeicherten Wettkampfs (Tabelle `competitions`, WP3): geplant (höchstens einer je Person, W-G9),
 * erledigt (mit oder ohne Ergebnis-Eintrag), abgesagt.
 */
export const COMPETITION_STATUSES = ['planned', 'done', 'cancelled'] as const;
export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];

/** Phasen rückwärts vom Renntag (Plan 3.1). `recovery` = Erholung NACH dem Rennen. */
export const COMPETITION_PHASES = [
  'base',
  'build',
  'peak',
  'taper',
  'race_week',
  'recovery',
] as const;
export type CompetitionPhase = (typeof COMPETITION_PHASES)[number];

export const competitionDisciplineSchema = z.enum(COMPETITION_DISCIPLINES);
export const runCompetitionDisciplineSchema = z.enum(RUN_COMPETITION_DISCIPLINES);

/** Ist die Disziplin (aus dem Ziel) eine mit Wettkampfplan? */
export function isCompetitionDiscipline(value: unknown): value is CompetitionDiscipline {
  return competitionDisciplineSchema.safeParse(value).success;
}

/** Zeit plausibel je Lauf-Distanz (COMPETITION_INPUT_LIMITS.timeS); Rad und Triathlon kennen keine Zeiten (WP5). */
function timeWithinLimits(discipline: CompetitionDiscipline, timeS: number): boolean {
  if (!isRunCompetitionDiscipline(discipline)) return false;
  const limits = COMPETITION_INPUT_LIMITS.timeS[discipline];
  return timeS >= limits.min && timeS <= limits.max;
}

/** Referenzzeit (letzter Wettkampf oder Testlauf, kein Maximaltest): Distanz + Zeit + Datum – nur Laufen. */
export const competitionReferenceSchema = z
  .strictObject({
    discipline: runCompetitionDisciplineSchema,
    timeS: z.number().int().positive(),
    date: isoDateSchema,
  })
  .refine((r) => timeWithinLimits(r.discipline, r.timeS), {
    path: ['timeS'],
    message: 'Diese Zeit ist für die Distanz nicht plausibel.',
  });
export type CompetitionReference = z.infer<typeof competitionReferenceSchema>;

/** Rad-Distanz in ganzen Kilometern (COMPETITION_CYCLING.distanceKm, Plan 9: 20–300 km). */
export const cyclingDistanceKmSchema = z
  .number()
  .int()
  .min(COMPETITION_CYCLING.distanceKm.min)
  .max(COMPETITION_CYCLING.distanceKm.max);

/**
 * Wettkampf ohne Datumsprüfung gegen „heute“ (strikt): Name nur Anzeige (1–80 Zeichen), Disziplin, Renntag, Ziel,
 * Zielzeit nur bei `time` und plausibel je Distanz, Zielzeit nur mit Referenzzeit (W-G6). WP5: `distanceKm` genau beim
 * Rad (20–300 km), sonst null; Zielzeit und Referenzzeit nur beim Laufen (Rad und Triathlon: „Ankommen“).
 */
export const competitionInputSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(COMPETITION_INPUT_LIMITS.nameMaxLength),
    discipline: competitionDisciplineSchema,
    raceDate: isoDateSchema,
    goal: z.enum(COMPETITION_GOALS).default('finish'),
    targetTimeS: z.number().int().positive().nullable().default(null),
    reference: competitionReferenceSchema.nullable().default(null),
    distanceKm: cyclingDistanceKmSchema.nullable().default(null),
  })
  .refine((c) => (c.discipline === 'cycling') === (c.distanceKm !== null), {
    path: ['distanceKm'],
    message: 'Die Distanz in Kilometern gibt es genau beim Rad.',
  })
  .refine(
    (c) =>
      isRunCompetitionDiscipline(c.discipline) ||
      // Sportarten Stufe 1 (Hyrox): nur „Ankommen“, eine Lauf-Referenzzeit ist erlaubt (Pace der Lauf-Einheiten, wie
      // CHECK competitions_multisport).
      (c.goal === 'finish' && (c.reference === null || c.discipline === 'hyrox')),
    {
      path: ['goal'],
      message: 'Bei Rad, Triathlon und Hyrox gibt es nur das Ziel „Ankommen“ (Referenzzeit nur bei Hyrox).',
    },
  )
  .refine((c) => (c.goal === 'time') === (c.targetTimeS !== null), {
    path: ['targetTimeS'],
    message: 'Eine Zielzeit gibt es nur beim Ziel „Zielzeit“.',
  })
  .refine((c) => c.targetTimeS === null || timeWithinLimits(c.discipline, c.targetTimeS), {
    path: ['targetTimeS'],
    message: 'Diese Zielzeit ist für die Distanz nicht plausibel.',
  })
  .refine((c) => c.goal !== 'time' || c.reference !== null, {
    path: ['reference'],
    message: 'Für eine Zielzeit brauchen wir eine eigene Referenzzeit.',
  });
export type CompetitionInput = z.input<typeof competitionInputSchema>;
export type Competition = z.infer<typeof competitionInputSchema>;

/** Spätester Renntag (heute + 52 Wochen). */
export function latestRaceDate(today: string): string {
  return addDays(today, COMPETITION_LEAD_WEEKS.maxLeadWeeks * 7);
}

/**
 * Wettkampf mit Datumsprüfung, aber OHNE Mindestvorlauf (für die Ampel: „zu kurz“ ist ein Ergebnis, kein Fehler):
 * Renntag nach heute bis heute + 52 Wochen; Referenzzeit nicht in der Zukunft und höchstens 6 Monate alt.
 */
export function competitionWindowSchema(today: string) {
  const latest = latestRaceDate(today);
  const oldestReference = addDays(today, -COMPETITION_INPUT_LIMITS.referenceMaxAgeDays);
  return competitionInputSchema
    .refine((c) => c.raceDate > today, {
      path: ['raceDate'],
      message: 'Der Renntag liegt nicht in der Zukunft.',
    })
    .refine((c) => c.raceDate <= latest, {
      path: ['raceDate'],
      message: 'Der Renntag liegt mehr als 52 Wochen in der Zukunft.',
    })
    .refine(
      (c) =>
        c.reference === null || (c.reference.date <= today && c.reference.date >= oldestReference),
      { path: ['reference', 'date'], message: 'Die Referenzzeit ist älter als 6 Monate.' },
    );
}

/**
 * Wettkampf zum Speichern bzw. für einen Plan (Plan 5): wie competitionWindowSchema und zusätzlich Renntag frühestens
 * heute + Mindestvorlauf (minimumLeadWeeks der Lead-Spalte, competition.ts `leadLevel`).
 */
export function competitionSchema(context: {
  readonly today: string;
  readonly minimumLeadWeeks: (
    discipline: CompetitionDiscipline,
    distanceKm: number | null,
  ) => number;
}) {
  return competitionWindowSchema(context.today).refine(
    (c) =>
      c.raceDate >=
      addDays(context.today, context.minimumLeadWeeks(c.discipline, c.distanceKm) * 7),
    { path: ['raceDate'], message: 'Bis zum Renntag ist zu wenig Zeit.' },
  );
}

/**
 * Eigener Startumfang (W-G5): Wochenminuten und ausdrückliche Bestätigung. Ob er gilt (Level, Startgruppe) und wie hoch
 * (Deckel), entscheidet ownStartMinutes() in competition.ts.
 */
export const competitionOwnStartSchema = z.strictObject({
  weeklyMinutes: z
    .number()
    .int()
    .min(COMPETITION_OWN_START.minWeeklyMinutes)
    .max(TRAINING_LIMITS.minutesPerSession.max * 7),
  confirmed: z.literal(true),
});
export type CompetitionOwnStart = z.infer<typeof competitionOwnStartSchema>;

/** Wer eine eigene Angabe machen darf (Level laut W-G5). */
export function ownStartAllowedLevel(level: ExperienceLevel): boolean {
  return (COMPETITION_OWN_START.levels as readonly ExperienceLevel[]).includes(level);
}
