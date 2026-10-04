import {
  BARBELL_DEFAULT_BAR_KG,
  BARBELL_ID,
  EQUIPMENT,
  MEASUREMENT_SITES,
  enduranceSlotSubtitle,
  groupSlots,
  scheduleTotals,
  type EnduranceDiscipline,
  type EquipmentItemInput,
  type TrainingSchedule,
  type TrainingSlotKind,
} from '@fitnessapp/core';

import type { OnboardingAnswers } from '@/data/types';
import { t } from '@/i18n';

import { formatDecimal, formatKg } from './format';

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
  if (answers.trainingSchedule) {
    lines.push({
      label: d.labels.trainingDays,
      value: trainingDaysValue(answers.trainingSchedule, answers.goal?.discipline ?? null),
    });
    if (answers.trainingSchedule.slots.some((slot) => slot.kind === 'strength_home')) {
      lines.push({ label: d.labels.equipment, value: equipmentValue(answers.equipment ?? []) });
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

/**
 * Name einer Trainingsart. Ausdauer: „short“ = Sportart („Laufen“), „long“ = „Ausdauer – Laufen“.
 * Die Sportart folgt aus der Disziplin des Ziels (enduranceSlotSubtitle in packages/core).
 */
export function slotKindLabel(
  kind: TrainingSlotKind,
  discipline: EnduranceDiscipline | null,
  variant: 'short' | 'long',
): string {
  const ts = t.steps.trainingSchedule;
  if (kind !== 'endurance') {
    return ts.kinds[kind];
  }
  const subtitle = ts.enduranceSubtitles[enduranceSlotSubtitle(discipline)];
  return variant === 'short' ? subtitle : `${ts.kinds.endurance} – ${subtitle}`;
}

/** Live-Zusammenfassung, z. B. „4 Tage: 2× Kraft im Studio, 2× Laufen · 180 min pro Woche“. */
export function scheduleSummaryText(
  slots: TrainingSchedule['slots'],
  discipline: EnduranceDiscipline | null,
): string {
  const ts = t.steps.trainingSchedule;
  if (slots.length === 0) {
    return ts.summaryEmpty;
  }
  const totals = scheduleTotals({ slots });
  const parts = (Object.keys(totals.byKind) as TrainingSlotKind[])
    .filter((kind) => totals.byKind[kind] > 0)
    .map((kind) => `${totals.byKind[kind]}× ${slotKindLabel(kind, discipline, 'short')}`);
  return `${ts.summaryDays(totals.sessions)}: ${parts.join(', ')} · ${ts.summaryMinutes(totals.minutesPerWeek)}`;
}

/**
 * „Geschafft!“: feste Tage eine Zeile je Tag („Mo Laufen 30 min“), „Tage egal“ zusammengefasst
 * („2× Kraft im Studio à 60 min, 2× Laufen à 30 min – die Tage verteilen wir“).
 */
export function trainingDaysValue(
  schedule: TrainingSchedule,
  discipline: EnduranceDiscipline | null,
): string {
  const ts = t.steps.trainingSchedule;
  if (schedule.mode === 'fixed') {
    return schedule.slots
      .map(
        (slot) =>
          `${ts.weekdays[slot.weekday - 1]} ${slotKindLabel(slot.kind, discipline, 'short')} ${ts.minutesShort(slot.minutes)}`,
      )
      .join('\n');
  }
  const groups = groupSlots(schedule.slots).map(
    (group) =>
      `${group.count}× ${slotKindLabel(group.kind, discipline, 'short')} à ${ts.minutesShort(group.minutes)}`,
  );
  return `${groups.join(', ')}${t.done.flexSuffix}`;
}

/** „2–20“ bzw. „20“ (ohne Einheit). */
function rangeText(weights: readonly number[]): string {
  const sorted = [...weights].sort((a, b) => a - b);
  const first = formatKg(sorted[0] ?? 0);
  const last = formatKg(sorted.at(-1) ?? 0);
  return first === last ? first : `${first}–${last}`;
}

/** Geräte kompakt: „Kurzhanteln (2–20 kg, 8 Stufen), Langhantel mit Scheiben (Stange 20 kg, Scheiben …)“. */
export function equipmentValue(items: readonly EquipmentItemInput[]): string {
  const home = items.filter((item) => item.location === 'home');
  if (home.length === 0) {
    return t.done.equipmentNone;
  }
  return home
    .map((item) => {
      const name = EQUIPMENT.find((e) => e.id === item.equipmentId)?.nameDe ?? item.equipmentId;
      if (item.equipmentId === BARBELL_ID) {
        const bar = formatKg(item.barKg ?? BARBELL_DEFAULT_BAR_KG);
        const plates = item.weightsKg.length > 0 ? rangeText(item.weightsKg) : null;
        return `${name} (${t.done.barbellValue(bar, plates)})`;
      }
      return item.weightsKg.length > 0
        ? `${name} (${t.done.equipmentWeights(rangeText(item.weightsKg), item.weightsKg.length)})`
        : name;
    })
    .join(', ');
}
