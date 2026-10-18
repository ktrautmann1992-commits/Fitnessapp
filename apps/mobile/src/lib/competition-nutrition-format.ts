import {
  CARB_LOADING_NOTICE_DE,
  type NutritionCompetitionDay,
  type NutritionDayTargets,
  type RaceFuelingPlan,
} from '@fitnessapp/core';

import { t } from '@/i18n';
import { disciplineText } from '@/lib/competition-format';
import { formatNumberDe } from '@/lib/nutrition-format';

/**
 * Anzeige der Wettkampf-Ernährung (Phase 10, Etappe W1). Rechnet nichts – alle Regeln kommen aus packages/core
 * (`nutritionTargetsForWeek` → `competition`, `raceFuelingPlan`); hier stehen nur Texte. Gramm erscheinen nur mit
 * „Kalorienzahlen anzeigen“ (Plan 19.8 Nr. 10, S12), Milliliter und Uhrzeiten immer.
 */

/** Dauer in Worten: „45 min“, „1 Std.“, „2 Std. 45 min“. */
export function durationText(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} Std.` : `${hours} Std. ${rest} min`;
}

/** „◆ Renntag: Halbmarathon“ – Zeichen und Wort (nie nur Farbe). */
export function competitionDayLabel(c: NutritionCompetitionDay): string {
  const kind = t.competitionNutrition.kinds[c.kind];
  return t.competitionNutrition.dayLabel(kind.symbol, kind.label, disciplineText(c.discipline));
}

export function competitionDayA11y(c: NutritionCompetitionDay): string {
  return t.competitionNutrition.dayA11y(
    t.competitionNutrition.kinds[c.kind].label,
    disciplineText(c.discipline),
  );
}

const range = (min: number, max: number) => [formatNumberDe(min), formatNumberDe(max)] as const;

/**
 * Textzeilen für den Tag (Ernährung → Tag): Art des Tages, Carb-Loading (mit Zahlen: „Tagesziel bleibt gleich …“,
 * Richtwert nicht erreicht), ohne Ziele nur der feste Carb-Loading-Hinweis, Wettkampfwoche ohne Defizit, Renn-Energie
 * und erwartete Dauer.
 */
export function competitionDayLines(day: NutritionDayTargets, showNumbers: boolean): string[] {
  const c = day.competition;
  if (c === undefined) return [];
  const texts = t.competitionNutrition;
  const lines: string[] = [texts.kinds[c.kind].text];
  const numbers = showNumbers && day.targetKcal !== null;
  if (c.carbLoading) {
    if (!c.carbsShifted) lines.push(CARB_LOADING_NOTICE_DE);
    else if (numbers) {
      lines.push(texts.carbLoadingNumbers);
      if (c.carbLoadingReached === false) lines.push(texts.carbLoadingNotReached);
    }
  }
  if (c.noDeficit && day.mode !== 'no_targets') lines.push(texts.noDeficit);
  if (numbers && c.raceEnergyIncluded) lines.push(texts.raceEnergy);
  if (c.kind === 'race_day' || c.kind === 'race_eve' || c.kind === 'carb_loading') {
    lines.push(
      texts.expected(durationText(c.expectedMinutes), texts.minutesSources[c.minutesSource]),
    );
  }
  return lines;
}

export interface TimelineRow {
  readonly key: string;
  readonly title: string;
  readonly detail: string | null;
}

/** Zeitleiste des Renntags (offline, aus dem Plan der Engine). */
export function raceTimelineRows(plan: RaceFuelingPlan, showNumbers: boolean): TimelineRow[] {
  const texts = t.competitionNutrition;
  return plan.steps.map((step, index): TimelineRow => {
    const key = `${step.kind}-${index}`;
    const carbs =
      showNumbers && step.carbsG !== null ? range(step.carbsG.min, step.carbsG.max) : null;
    switch (step.kind) {
      case 'breakfast':
        return {
          key,
          title: texts.steps.breakfast(
            durationText(-step.toMinute),
            durationText(-step.fromMinute),
          ),
          detail: carbs === null ? null : texts.breakfastCarbs(carbs[0], carbs[1]),
        };
      case 'start':
        return { key, title: texts.steps.start, detail: null };
      case 'fuel':
        return {
          key,
          title: texts.steps.fuel(durationText(step.fromMinute)),
          detail:
            carbs === null
              ? texts.fuelExamples
              : `${texts.fuelCarbs(carbs[0], carbs[1])} (${texts.fuelExamples})`,
        };
      case 'finish':
        return { key, title: texts.steps.finish(durationText(step.fromMinute)), detail: null };
      case 'recovery_meal':
        return {
          key,
          title: texts.steps.recovery(
            durationText(step.fromMinute - plan.expectedMinutes),
            durationText(step.toMinute - plan.expectedMinutes),
          ),
          detail: null,
        };
    }
  });
}

/** Richtwerte und feste Hinweise zum Renntag (Gramm nur mit Zahlen). */
export function raceFuelingLines(plan: RaceFuelingPlan, showNumbers: boolean): string[] {
  const texts = t.competitionNutrition;
  const lines: string[] = [];
  if (plan.carbsGPerHour !== null) {
    if (showNumbers) {
      const [min, max] = range(plan.carbsGPerHour.min, plan.carbsGPerHour.max);
      lines.push(texts.perHour(min, max));
    } else {
      lines.push(texts.numbersHidden);
    }
  }
  if (plan.drinkMlPerHour !== null) {
    const [min, max] = range(plan.drinkMlPerHour.min, plan.drinkMlPerHour.max);
    lines.push(texts.drink(min, max));
  }
  for (const notice of plan.notices) lines.push(texts.notices[notice]);
  return lines;
}
