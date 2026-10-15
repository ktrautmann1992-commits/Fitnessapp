import { z } from 'zod';

import { isoDateSchema } from '../age';
import {
  type SessionAchievement,
  sessionAchievement,
  type SessionAchievementInput,
} from '../log/achievement';
import type { DayItem } from '../log/summary';
import { dayIntake, type FoodLogEntry } from '../nutrition/food-log';
import type { NutritionNoticeCode } from '../nutrition/notices';
import type { NutritionDayTargets } from '../nutrition/targets';
import { intakeZone, type IntakeZoneResult } from './intake-zone';

/**
 * „Dein Tag“ (docs/PLAN-AUSWERTUNG.md Abschnitt 6, Etappe A2): setzt Essen (Kalorienbalken nach 2.1/2.2, Mahlzeiten
 * „3 von 4“) und Training (Status und Erfüllungsgrad nach 2.5) eines Tages zusammen. Rechnet keine Ziele und keine
 * Grenzen – die Tagesziele kommen fertig aus `nutritionTargetsForWeek`, die Einheiten des Tages aus `weekLogSummary`.
 * Ohne Zahlen (Schalter aus ODER Schwangerschaft/Stillzeit) enthält das Ergebnis keine kcal (2.3).
 */

/** Routen-Parameter `tag/[date]` (JJJJ-MM-TT, gültiger Kalendertag). Ungültig → Fehlerzustand in der App. */
export const dateParamSchema = isoDateSchema;

export type EvaluationDayTiming = 'past' | 'today' | 'future';

export function evaluationDayTiming(date: string, today: string): EvaluationDayTiming {
  const d = isoDateSchema.parse(date);
  const t = isoDateSchema.parse(today);
  return d < t ? 'past' : d === t ? 'today' : 'future';
}

/** Hinweise des Tages (feste Codes, Texte in der App). */
export type DayEvaluationNotice =
  /** Vergangener Tag unter der Untergrenze: „Laut deinen Einträgen. Fehlt etwas? Du kannst es nachtragen.“ (2.2) */
  | 'check_entries'
  /** Der Essensplan dieses Tages erreicht die Untergrenze nicht (bestehender Hinweis `day_below_floor`, 2.3). */
  | 'plan_below_floor'
  /** „Trainingstag – dein Ziel ist heute höher.“ (2.4) – nur mit Zahlen. */
  | 'training_day';

/** Hinweis-Codes der Engine, die die Tagesauswertung zeigt (Schwangerschaft, Einladung zu Körperdaten/Einwilligung). */
const TARGET_NOTICE_CODES: readonly NutritionNoticeCode[] = [
  'pregnancy_no_targets',
  'no_health_data_consent',
  'body_data_missing',
];

export interface DayEvaluationInput {
  readonly date: string;
  readonly today: string;
  /** Schalter „Kalorienzahlen anzeigen“ (und Schwangerschaft der Woche, `weekHidesEnergyNumbers`). */
  readonly showNumbers: boolean;
  /** Tagesziele aus `nutritionTargetsForWeek`; null = nicht berechenbar (Angaben unvollständig, gesperrt, Fehler). */
  readonly targets: NutritionDayTargets | null;
  readonly foodLog: {
    /** Tagebuch in dieser Betriebsart verfügbar UND gültige Einwilligung (A-G12). */
    readonly available: boolean;
    /** Einträge DIESES Tages. */
    readonly entries: readonly Pick<
      FoodLogEntry,
      'kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'source' | 'slot'
    >[];
  };
  /** Essensplan des Tages: Plätze der Mahlzeiten; null = kein Essensplan. */
  readonly mealPlan: {
    readonly slots: readonly string[];
    /** Plan-Tag erreicht die Untergrenze nicht (`status = below_floor`). */
    readonly belowFloor: boolean;
  } | null;
  /** Einheiten und Einträge des Tages (`weekLogSummary(...).days[i].items`). */
  readonly trainingItems: readonly DayItem[];
  /** Eingaben des Erfüllungsgrads je Eintrag (`logId`); fehlt einer, gibt es keinen Prozentwert. */
  readonly achievements: ReadonlyMap<string, SessionAchievementInput>;
}

export interface DayTrainingItem {
  readonly item: DayItem;
  /** Nur für eingetragene Einheiten (`item.logId`). */
  readonly achievement: SessionAchievement | null;
}

export interface DayEvaluation {
  readonly date: string;
  readonly timing: EvaluationDayTiming;
  /** Tatsächlich angewandt: false bei Schalter aus ODER Schwangerschaft/Stillzeit an diesem Tag. */
  readonly showNumbers: boolean;
  readonly food: {
    readonly available: boolean;
    /** Kalorienbalken (2.1/2.2); `hidden` ohne Zahlen. */
    readonly intake: IntakeZoneResult;
    /** Alle Einträge des Tages (auch ohne kcal). Eine Anzahl, keine Kalorienzahl. */
    readonly entryCount: number;
    /** Einträge ohne kcal-Wert – nur mit Zahlen relevant („Ein Eintrag ohne Kalorienangabe“). */
    readonly entriesWithoutValue: number;
    /** „3 von 4 Mahlzeiten abgehakt“; null = kein Essensplan. */
    readonly meals: { readonly planned: number; readonly eaten: number } | null;
    readonly targetNotices: readonly NutritionNoticeCode[];
  };
  readonly training: {
    readonly items: readonly DayTrainingItem[];
  };
  readonly notices: readonly DayEvaluationNotice[];
}

const mealSlotsSchema = z.array(z.string().min(1)).readonly();

export function dayEvaluation(input: DayEvaluationInput): DayEvaluation {
  const timing = evaluationDayTiming(input.date, input.today);
  const targets = input.targets;
  if (targets !== null && targets.date !== input.date) {
    throw new RangeError('Tagesziele gehören zu einem anderen Tag.');
  }
  const pregnancy = targets?.notices.includes('pregnancy_no_targets') === true;
  // Schwangerschaft/Stillzeit: nie Zahlen, auch wenn der Schalter an ist (2.3, A-G8).
  const showNumbers = input.showNumbers && !pregnancy;

  const entries = input.foodLog.available ? input.foodLog.entries : [];
  const intakeSum = dayIntake(entries);
  const valued = intakeSum.count - intakeSum.withoutValue;
  const intake: IntakeZoneResult = !showNumbers
    ? { kind: 'hidden' }
    : targets === null
      ? { kind: 'no_target' }
      : intakeZone({
          eatenKcal: intakeSum.kcal,
          hasEntries: valued > 0,
          day: targets,
          isToday: timing === 'today',
          isFuture: timing === 'future',
          showNumbers,
        });

  let meals: DayEvaluation['food']['meals'] = null;
  if (input.mealPlan !== null) {
    const slots = new Set(mealSlotsSchema.parse(input.mealPlan.slots));
    const eatenSlots = new Set(
      entries.filter((e) => e.source === 'plan_item' && slots.has(e.slot)).map((e) => e.slot),
    );
    meals = { planned: slots.size, eaten: eatenSlots.size };
  }

  const items = input.trainingItems.map((item): DayTrainingItem => {
    const raw = item.logId === null ? undefined : input.achievements.get(item.logId);
    return { item, achievement: raw === undefined ? null : sessionAchievement(raw) };
  });

  const notices: DayEvaluationNotice[] = [];
  if (intake.kind === 'bar' && timing === 'past' && intake.zone === 'below_floor') {
    notices.push('check_entries');
  }
  if (showNumbers && input.mealPlan?.belowFloor === true && targets?.targetKcal != null) {
    notices.push('plan_below_floor');
  }
  if (
    showNumbers &&
    targets !== null &&
    targets.targetKcal !== null &&
    targets.sessions.length > 0
  ) {
    notices.push('training_day');
  }

  return {
    date: input.date,
    timing,
    showNumbers,
    food: {
      available: input.foodLog.available,
      intake,
      entryCount: intakeSum.count,
      entriesWithoutValue: showNumbers ? intakeSum.withoutValue : 0,
      meals,
      targetNotices: (targets?.notices ?? []).filter((code) => TARGET_NOTICE_CODES.includes(code)),
    },
    training: { items },
    notices,
  };
}
