import { z } from 'zod';

import { isoDateSchema } from '../age';
import {
  COMPETITION_INPUT_LIMITS,
  COMPETITION_LEAD_WEEKS,
  COMPETITION_OWN_START,
  TRAINING_LIMITS,
} from '../constants';
import { addDays } from '../dates';
import type { ExperienceLevel } from '../enums';

/**
 * Wettkampf-Eingaben (docs/PLAN-PHASE-10.md Abschnitt 5, Etappe WP1), an der Grenze mit Zod geprüft.
 * Gespeichert in der Tabelle `competitions` (WP3, plan/competition-record.ts) – dieselben Grenzen als CHECK
 * (db-sync.test.ts).
 */

/**
 * Disziplinen mit Wettkampfplan (W-G2): zuerst nur Laufen 5 km bis Marathon. Teilmenge von ENDURANCE_DISCIPLINES;
 * Rad und Triathlon Sprint/Olympisch kommen mit WP5 dazu (dann eigene Distanz für Rad 20–300 km), Mittel-/Langdistanz
 * und Schwimm-Wettkämpfe bekommen keinen Plan (Hinweis Trainer/Verein).
 */
export const COMPETITION_DISCIPLINES = ['5k', '10k', 'half_marathon', 'marathon'] as const;
export type CompetitionDiscipline = (typeof COMPETITION_DISCIPLINES)[number];

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

/** Ist die Disziplin (aus dem Ziel) eine mit Wettkampfplan? */
export function isCompetitionDiscipline(value: unknown): value is CompetitionDiscipline {
  return competitionDisciplineSchema.safeParse(value).success;
}

function timeWithinLimits(discipline: CompetitionDiscipline, timeS: number): boolean {
  const limits = COMPETITION_INPUT_LIMITS.timeS[discipline];
  return timeS >= limits.min && timeS <= limits.max;
}

/** Referenzzeit (letzter Wettkampf oder Testlauf, kein Maximaltest): Distanz + Zeit + Datum. */
export const competitionReferenceSchema = z
  .strictObject({
    discipline: competitionDisciplineSchema,
    timeS: z.number().int().positive(),
    date: isoDateSchema,
  })
  .refine((r) => timeWithinLimits(r.discipline, r.timeS), {
    path: ['timeS'],
    message: 'Diese Zeit ist für die Distanz nicht plausibel.',
  });
export type CompetitionReference = z.infer<typeof competitionReferenceSchema>;

/**
 * Wettkampf ohne Datumsprüfung gegen „heute“ (strikt): Name nur Anzeige (1–80 Zeichen), Disziplin, Renntag, Ziel,
 * Zielzeit nur bei `time` und plausibel je Distanz, Zielzeit nur mit Referenzzeit (W-G6).
 */
export const competitionInputSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(COMPETITION_INPUT_LIMITS.nameMaxLength),
    discipline: competitionDisciplineSchema,
    raceDate: isoDateSchema,
    goal: z.enum(COMPETITION_GOALS).default('finish'),
    targetTimeS: z.number().int().positive().nullable().default(null),
    reference: competitionReferenceSchema.nullable().default(null),
  })
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
  readonly minimumLeadWeeks: (discipline: CompetitionDiscipline) => number;
}) {
  return competitionWindowSchema(context.today).refine(
    (c) => c.raceDate >= addDays(context.today, context.minimumLeadWeeks(c.discipline) * 7),
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
