import { EQUIPMENT, MEASUREMENT_SITES } from '@fitnessapp/core';

import type { OnboardingAnswers } from '@/data/types';
import { t } from '@/i18n';

import { formatDecimal } from './format';

export interface SummaryLine {
  label: string;
  value: string;
}

/**
 * Zusammenfassung für den Bildschirm „Fertig“ (nur Anzeige, keine Fachlogik).
 * Gesundheitswerte werden bewusst nicht einzeln aufgelistet, nur ob sie vorhanden sind.
 */
export function summaryLines(answers: OnboardingAnswers, hasHealthConsent: boolean): SummaryLine[] {
  const d = t.done;
  const lines: SummaryLine[] = [];
  if (answers.sex) {
    lines.push({ label: d.labels.sex, value: t.steps.sex.options[answers.sex] });
  }
  if (!hasHealthConsent) {
    lines.push({ label: d.labels.bodyMetrics, value: d.noHealthConsent });
  } else {
    if (answers.bodyMetrics) {
      lines.push({
        label: d.labels.bodyMetrics,
        value: `${formatDecimal(answers.bodyMetrics.heightCm)} cm · ${formatDecimal(answers.bodyMetrics.weightKg)} kg`,
      });
    }
    const measured = answers.bodyMeasurements
      ? MEASUREMENT_SITES.filter((site) => answers.bodyMeasurements?.[site.id] != null).length
      : 0;
    lines.push({
      label: d.labels.measurements,
      value: measured > 0 ? d.measurementsCount(measured) : d.measurementsSkipped,
    });
    if (answers.healthScreening) {
      lines.push({
        label: d.labels.screening,
        value: answers.healthScreening.flags.includes('conservative_plan')
          ? d.conservative
          : d.screeningOk,
      });
    }
  }
  if (answers.experienceLevel) {
    lines.push({
      label: d.labels.experience,
      value: t.steps.experience.options[answers.experienceLevel].label,
    });
  }
  if (answers.goal) {
    const discipline = answers.goal.discipline
      ? ` · ${t.steps.goal.disciplines[answers.goal.discipline]}`
      : '';
    lines.push({
      label: d.labels.goal,
      value: `${t.steps.goal.options[answers.goal.goalType]}${discipline}`,
    });
  }
  if (answers.timeBudget) {
    lines.push({
      label: d.labels.timeBudget,
      value: d.timeBudgetValue(
        answers.timeBudget.sessionsPerWeek,
        answers.timeBudget.minutesPerSession,
      ),
    });
  }
  if (answers.trainingLocation) {
    lines.push({
      label: d.labels.location,
      value: t.steps.trainingLocation.options[answers.trainingLocation],
    });
    if (answers.trainingLocation !== 'gym') {
      const names = (answers.equipment ?? []).map(
        (item) => EQUIPMENT.find((e) => e.id === item.equipmentId)?.nameDe ?? item.equipmentId,
      );
      lines.push({
        label: d.labels.equipment,
        value: names.length > 0 ? names.join(', ') : d.equipmentNone,
      });
    }
  }
  if (answers.nutrition) {
    lines.push({
      label: d.labels.nutrition,
      value: `${t.steps.nutrition.diets[answers.nutrition.dietType]} · ${d.mealsValue(answers.nutrition.mealsPerDay)}`,
    });
  }
  if (answers.cooking) {
    lines.push({
      label: d.labels.cooking,
      value:
        answers.cooking.cookingMode === 'meal_prep'
          ? d.mealprepValue(answers.cooking.mealprepDays)
          : t.steps.cooking.options.daily.label,
    });
  }
  return lines;
}
