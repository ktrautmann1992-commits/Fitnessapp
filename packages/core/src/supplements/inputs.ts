import { z } from 'zod';

import { ageInYears } from '../age';
import {
  BODY_METRIC_LIMITS,
  MIN_AGE_YEARS,
  SUPPLEMENT_HEALTH_CONSENT_MIN_VERSION,
  SUPPLEMENT_RULES,
} from '../constants';
import { DIET_TYPES, EXPERIENCE_LEVELS, GOAL_TYPES, SEX_OPTIONS, TRAINING_TIMES } from '../enums';
import { HEALTH_FLAGS } from '../health-screening';
import { SUPPLEMENT_FLAGS } from './screening';

/**
 * Eingaben der Supplement-Engine (docs/PLAN-PHASE-6.md Abschnitt 5). Alles, was die Regeln brauchen – und bewusst
 * NICHTS über Shops, Links oder Provisionen (CLAUDE.md „Affiliate & Werbung“: Affiliate beeinflusst nie, OB oder
 * WELCHES Supplement empfohlen wird). Das Schema ist strikt: zusätzliche Felder werden abgelehnt.
 *
 * Gesundheitsdaten (`healthFlags`, `supplementFlags`, `weightKg`, `proteinGap`) dürfen nur mit gültiger Einwilligung
 * `health_data` v2 übergeben werden; ohne sie müssen sie `null` sein (Prüfung im Schema, Plan 11.1).
 */

const flagList = <T extends string>(values: readonly [T, ...T[]]) =>
  z
    .array(z.enum(values))
    .refine((flags) => new Set(flags).size === flags.length, { message: 'Flag doppelt.' });

export const supplementInputsSchema = z
  .strictObject({
    /** Geburtsdatum (Pflicht im Onboarding, Mindestalter 16). */
    birthDate: z.iso.date(),
    /** Stichtag der Anzeige (lokales Datum); liefert Alter und Monat. */
    today: z.iso.date(),
    sex: z.enum(SEX_OPTIONS).nullable(),
    /** Höchste aktive Fassung der Einwilligung `health_data`, `null` = keine. */
    healthConsentVersion: z.number().int().min(1).nullable(),
    /** Flags des Gesundheits-Checks, `null` = kein Check. */
    healthFlags: flagList(HEALTH_FLAGS).nullable(),
    /** Flags des Supplement-Checks, `null` = Check nicht ausgefüllt. */
    supplementFlags: flagList(SUPPLEMENT_FLAGS).nullable(),
    /** Körpergewicht in kg, `null` = unbekannt. */
    weightKg: z
      .number()
      .finite()
      .min(BODY_METRIC_LIMITS.weightKg.min)
      .max(BODY_METRIC_LIMITS.weightKg.max)
      .nullable(),
    goalType: z.enum(GOAL_TYPES),
    secondaryGoalType: z.enum(GOAL_TYPES).nullable(),
    experienceLevel: z.enum(EXPERIENCE_LEVELS),
    /** Hat der Ausdauer-Plan Intervall- oder Sprint-Einheiten (Kreatin beim Ziel Ausdauer, Plan 3.2)? */
    hasIntervalSessions: z.boolean(),
    dietType: z.enum(DIET_TYPES),
    /** „Fisch mag ich nicht“ oder Fisch-Unverträglichkeit (Lebensmittel-Gruppe `fish`). */
    avoidsFish: z.boolean(),
    /** Milch-Unverträglichkeit (Gruppen `dairy`/`lactose`) → nur pflanzliches Proteinpulver im Text (Plan 3.7). */
    avoidsDairy: z.boolean(),
    /** Übliche Trainingszeit, `null` = nicht angegeben (wie `varies`). */
    trainingTime: z.enum(TRAINING_TIMES).nullable(),
    /** Eiweiß-Lücke (proteinGapFromLog/-FromSelfCheck), `null` = keine Daten. */
    proteinGap: z.boolean().nullable(),
    /** Gibt es Kalorien- und Eiweißziele? `false` = Modus `no_targets` (z. B. Schwangerschaft) → kein Proteinpulver. */
    hasNutritionTargets: z.boolean(),
    /** Eingetragener Wettkampf (Doping-Hinweis, Plan 3.6). */
    hasCompetition: z.boolean(),
  })
  .superRefine((inputs, ctx) => {
    if (inputs.today < inputs.birthDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['today'],
        message: 'Der Stichtag liegt vor dem Geburtsdatum.',
      });
    } else if (ageInYears(inputs.birthDate, inputs.today) < MIN_AGE_YEARS) {
      // Mindestalter der App (CLAUDE.md), auch hier geprüft (Wächter SU1, Befund 7).
      ctx.addIssue({
        code: 'custom',
        path: ['birthDate'],
        message: 'Die App ist erst ab 16 Jahren nutzbar.',
      });
    }
    if (!hasSupplementConsent(inputs.healthConsentVersion)) {
      for (const key of ['healthFlags', 'supplementFlags', 'weightKg', 'proteinGap'] as const) {
        if (inputs[key] !== null) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'Ohne Einwilligung Gesundheitsdaten (Fassung 2) nicht verwenden.',
          });
        }
      }
    }
    if (inputs.sex === 'male' && inputs.supplementFlags?.includes('breastfeeding')) {
      ctx.addIssue({
        code: 'custom',
        path: ['supplementFlags'],
        message: 'Diese Frage wird nicht gestellt.',
      });
    }
  });

export type SupplementInputs = z.infer<typeof supplementInputsSchema>;

/** Gilt die Einwilligung für den Supplement-Check (mindestens Fassung 2, Plan 11.1)? */
export function hasSupplementConsent(version: number | null | undefined): boolean {
  return (
    version !== null && version !== undefined && version >= SUPPLEMENT_HEALTH_CONSENT_MIN_VERSION
  );
}

/** Alter in vollendeten Jahren am Stichtag (tagesgenau, wie Training und Ernährung). */
export function supplementAge(inputs: Pick<SupplementInputs, 'birthDate' | 'today'>): number {
  return ageInYears(inputs.birthDate, inputs.today);
}

/** Unter `SUPPLEMENT_RULES.adultFromAge` (18)? */
export function isMinorForSupplements(
  inputs: Pick<SupplementInputs, 'birthDate' | 'today'>,
): boolean {
  return supplementAge(inputs) < SUPPLEMENT_RULES.adultFromAge;
}

/** Monat (1–12) des Stichtags. */
export function supplementMonth(inputs: Pick<SupplementInputs, 'today'>): number {
  return Number(inputs.today.slice(5, 7));
}
