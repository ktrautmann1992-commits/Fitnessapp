import {
  type PrintBlock,
  type PrintDocument,
  printDocumentSchema,
  type PrintText,
  type PrintTextCode,
  type PrintTextParams,
} from '@fitnessapp/core';
import type { TranslatedBlock, TranslatedDocument } from '@fitnessapp/ui/print';

import { t } from '@/i18n';

import { formatDateDe, formatDecimal, formatKg } from './format';
import { dayLabel, repsRange } from './plan-format';

/**
 * Druck-Dokument (Codes aus packages/core/src/export) → „übersetztes Dokument“ für packages/ui/print
 * (docs/PLAN-PDF-EXPORT.md §6, Wächter B11). Nur Formulierung, keine Fachlogik. Getestet in print-document.test.ts.
 */

const p = t.print;
const WEEKDAYS = t.steps.trainingSchedule.weekdays;
const WEEKDAYS_LONG = t.steps.trainingSchedule.weekdaysLong;

const join = (values: readonly string[]) => values.filter((v) => v !== '').join(', ');

function effortWord(effort: number): string {
  const words = p.effortWords;
  const index = effort <= 2 ? 0 : effort <= 4 ? 1 : effort <= 6 ? 2 : effort <= 8 ? 3 : 4;
  return words[index] ?? '';
}

/** Pause kurz für schmale Spalten: „45 s“, „1 min“, „1:30 min“. */
function restShort(seconds: number): string {
  if (seconds < 60) return p.seconds(seconds);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return p.restMinutes(
    rest === 0 ? String(minutes) : `${minutes}:${String(rest).padStart(2, '0')}`,
  );
}

type Translators = { readonly [K in PrintTextCode]: (params: PrintTextParams[K]) => string };

const TEXTS: Translators = {
  'doc.title': () => p.docTitle,
  'doc.footer': () => p.footer,
  'cover.heading': () => p.coverHeading,
  'plan.name': ({ goal, discipline, strengthDays, enduranceDays }) => {
    const name =
      goal === null
        ? p.goalFallback
        : goal === 'endurance' && enduranceDays > 0
          ? t.plan.enduranceBase(discipline ? t.steps.goal.disciplines[discipline] : null)
          : t.steps.goal.options[goal];
    const days =
      strengthDays > 0 && enduranceDays > 0
        ? p.daysMixed(strengthDays, enduranceDays)
        : p.days(strengthDays + enduranceDays);
    return p.planName(name, days);
  },
  'cover.label.period': () => p.labelPeriod,
  'cover.label.days': () => p.labelDays,
  'cover.label.locations': () => p.labelLocations,
  'cover.label.name': () => p.labelName,
  'cover.label.asOf': () => p.labelAsOf,
  'cover.howTo': ({ logColumns, hasWeight }) => p.howTo(logColumns, hasWeight),
  'notice.medical.title': () => p.medicalTitle,
  'notice.medical': () => p.medical,
  'value.dateRange': ({ from, to }) => p.dateRange(formatDateDe(from), formatDateDe(to)),
  'value.weekDates': ({ from, to }) =>
    p.weekDates(formatDateDe(from).slice(0, 6), formatDateDe(to).slice(0, 6)),
  'value.trainingDays': ({ count, weekdays }) =>
    p.trainingDays(count, join(weekdays.map((d) => WEEKDAYS[d - 1] ?? ''))),
  'value.locations': ({ locations, endurance }) =>
    join([...locations.map((l) => p.locations[l]), endurance ? p.enduranceLocation : '']),
  'week.heading': () => p.weekHeading,
  'week.column.week': () => p.weekColumn,
  'weekday.short': ({ weekday }) => WEEKDAYS[weekday - 1] ?? '',
  'week.row': ({ weekNo, intro, deload }) =>
    [
      weekNo === 0 ? p.week0 : p.week(weekNo),
      intro ? p.introSuffix : '',
      deload ? p.deloadSuffix : '',
    ]
      .filter((v) => v !== '')
      .join(' · '),
  'week.legend': ({ hasRestDay, hasIntroWeek, hasDeloadWeek, hasWeight }) =>
    [
      hasRestDay ? p.legendBase : '',
      hasIntroWeek ? (hasWeight ? p.legendIntro : p.legendIntroNoWeight) : '',
      hasDeloadWeek ? (hasWeight ? p.legendDeload : p.legendDeloadNoWeight) : '',
    ]
      .filter((v) => v !== '')
      .join(' '),
  'cell.rest': () => p.rest,
  'cell.skipped': () => p.skipped,
  location: ({ location }) => p.locations[location],
  'endurance.modality': ({ modality }) => (modality ? p.modalities[modality] : p.modalityFallback),
  'value.minutes': ({ minutes }) => p.minutes(minutes),
  'value.aboutMinutes': ({ minutes }) => p.aboutMinutes(minutes),
  'session.label.days': () => p.sessionDays,
  'session.label.location': () => p.sessionLocation,
  'session.label.duration': () => p.sessionDuration,
  'value.weekdaysLong': ({ weekdays }) =>
    weekdays.length === 0 ? p.daysFree : join(weekdays.map((d) => WEEKDAYS_LONG[d - 1] ?? '')),
  'session.warmup': () => p.warmup,
  'session.cooldown': () => p.cooldown,
  'session.exercises': ({ session }) => p.exercisesCaption(session),
  'session.continued': ({ session }) => p.continued(session),
  'session.weightHint': ({ hasWeight }) => (hasWeight ? p.weightHint : p.rpeHint),
  'session.noExercises': () => p.noExercises,
  'session.preferenceOmitted': ({ count }) => p.preferenceOmitted(count),
  'load.bodyweight': () => p.loadBodyweight,
  'load.band': () => p.loadBand,
  'load.none': () => p.loadNone,
  'col.exercise': () => p.columns.exercise,
  'col.sets': () => p.columns.sets,
  'col.reps': () => p.columns.reps,
  'col.rpe': () => p.columns.rpe,
  'col.rest': () => p.columns.rest,
  'col.weight': () => p.columns.weight,
  'col.log': ({ no }) => p.columns.log(no),
  'col.date': () => p.columns.date,
  'col.week': () => p.columns.week,
  'col.activity': () => p.columns.activity,
  'col.minutes': () => p.columns.minutes,
  'col.effort': () => p.columns.effort,
  'mark.equipmentSwap': () => p.equipmentSwap,
  'mark.preferenceSwap': () => p.preferenceSwap,
  'mark.superset': ({ group }) => p.superset(group),
  'value.reps': ({ min, max }) => repsRange(min, max),
  'value.targetReps': ({ reps }) => String(reps),
  'value.seconds': ({ seconds }) => p.seconds(seconds),
  'value.rest': ({ seconds }) => restShort(seconds),
  'value.kg': ({ kg }) => p.kg(formatKg(kg)),
  'value.rpe': ({ rpe }) => formatDecimal(rpe),
  'value.effort': ({ effort }) => p.effort(effort, effortWord(effort)),
  'value.dateWithWeekday': ({ date }) => dayLabel(date),
  'endurance.heading': () => p.enduranceHeading,
  'endurance.effortHint': () => p.effortHint,
  'notes.heading': () => p.notesHeading,
  'plan.note': ({ note }) => t.plan.notes[note],
};

/** Ein Text des Dokuments → fertiger Text. */
export function translatePrintText(value: PrintText): string {
  switch (value.kind) {
    case 'data':
      return value.value;
    case 'date':
      return formatDateDe(value.iso);
    case 'number':
      return formatDecimal(value.value);
    case 'text':
      return (TEXTS[value.code] as (params: unknown) => string)(value.params);
  }
}

const cell = (values: readonly PrintText[]) => values.map(translatePrintText);

function translateBlock(block: PrintBlock): TranslatedBlock {
  switch (block.type) {
    case 'heading':
      return { type: 'heading', level: block.level, text: translatePrintText(block.text) };
    case 'paragraph':
      return {
        type: 'paragraph',
        text: translatePrintText(block.text),
        ...(block.muted ? { muted: true } : {}),
      };
    case 'keyValue':
      return {
        type: 'keyValue',
        items: block.items.map((i) => ({
          label: translatePrintText(i.label),
          value: translatePrintText(i.value),
        })),
      };
    case 'table':
      return {
        type: 'table',
        caption: translatePrintText(block.caption),
        ...(block.captionLevel ? { captionLevel: block.captionLevel } : {}),
        columns: block.columns.map((c) => ({ header: translatePrintText(c.header), role: c.role })),
        rows: block.rows.map((r) => ({ header: cell(r.header), cells: r.cells.map(cell) })),
      };
    case 'notice':
      return {
        type: 'notice',
        title: translatePrintText(block.title),
        text: translatePrintText(block.text),
      };
    case 'pageBreak':
      return { type: 'pageBreak', orientation: block.orientation };
  }
}

/**
 * Prüft das Dokument (Zod) und übersetzt es. Titel ohne Namen (B7); Fußzeile und Logo-Text aus i18n.
 * Wirft bei ungültigem Dokument (Programmierfehler – nie stilles Weiterdrucken).
 */
export function translatePrintDocument(raw: PrintDocument): TranslatedDocument {
  const doc = printDocumentSchema.parse(raw);
  return {
    lang: 'de',
    title: translatePrintText(doc.meta.title),
    footer: translatePrintText(doc.meta.footer),
    logoLabel: p.logoLabel,
    blocks: doc.sections.map(translateBlock),
  };
}
