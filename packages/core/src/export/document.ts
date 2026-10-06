import { z } from 'zod';

import { isoDateSchema } from '../age';
import { PRINT_EXPORT } from '../constants';
import {
  ENDURANCE_DISCIPLINES,
  ENDURANCE_MODALITIES,
  EQUIPMENT_LOCATIONS,
  GOAL_TYPES,
  type EnduranceDiscipline,
  type EnduranceModality,
  type EquipmentLocation,
  type GoalType,
} from '../enums';

/**
 * Allgemeines Druck-Dokument (docs/PLAN-PDF-EXPORT.md §6, Wächter B11): Blöcke mit CODES und DATEN, keine fertigen
 * Texte. Die App übersetzt die Codes (i18n) in ein „übersetztes Dokument“, packages/ui rendert daraus HTML.
 * Später nutzt der Ernährungsplan (Phase 5) dasselbe Modell mit eigenen Codes.
 *
 * Datenschutz (B1): Das Modell enthält bewusst KEINE Gesundheitsangaben – keine Flags, Gründe, Schwangerschaft,
 * Alter, Geburtsdatum, Körpergewicht, Zyklusdaten und kein Level. Die einzigen freien Texte sind Inhalte (Namen von
 * Einheiten und Übungen, Aufwärmen) und der optionale Name.
 */

/** Hinweise des Plans, die gedruckt werden: nur Gerätegründe (§5 Punkt 5). */
export const PRINT_PLAN_NOTES = [
  'exercises_substituted',
  'exercises_removed',
  'no_pull_exercise',
  'location_mismatch',
] as const;
export type PrintPlanNote = (typeof PRINT_PLAN_NOTES)[number];

/** Parameter je Text-Code. Leeres Objekt = Text ohne Parameter. */
export interface PrintTextParams {
  /** Dokument-Titel und Dateiname – nie mit Namen (B7). */
  'doc.title': Record<string, never>;
  /** Fußzeile jeder Seite (neutral, für alle gleich). */
  'doc.footer': Record<string, never>;
  'cover.heading': Record<string, never>;
  /** Planname ohne Level (B1), z. B. „Muskelaufbau · 3 Tage“. goal null = Angaben nicht lesbar. */
  'plan.name': {
    goal: GoalType | null;
    discipline: EnduranceDiscipline | null;
    strengthDays: number;
    enduranceDays: number;
  };
  'cover.label.period': Record<string, never>;
  'cover.label.days': Record<string, never>;
  'cover.label.locations': Record<string, never>;
  'cover.label.name': Record<string, never>;
  'cover.label.asOf': Record<string, never>;
  /** hasWeight = mindestens eine Übung mit Gewicht (sonst Anleitung ohne Gewicht, Wächter S2). */
  'cover.howTo': { logColumns: number; hasWeight: boolean };
  'notice.medical.title': Record<string, never>;
  /** Neutraler Arzt-Hinweis – auf JEDEM Dokument, für alle gleich (B1). */
  'notice.medical': Record<string, never>;
  'value.dateRange': { from: string; to: string };
  /** Kurz ohne Jahr (Wochenübersicht), z. B. „05.10.–11.10.“. */
  'value.weekDates': { from: string; to: string };
  /** Trainingstage je Woche; weekdays leer = Tage frei wählbar. */
  'value.trainingDays': { count: number; weekdays: number[] };
  'value.locations': { locations: EquipmentLocation[]; endurance: boolean };
  'week.heading': Record<string, never>;
  'week.column.week': Record<string, never>;
  /** Kurzname des Wochentags, 1 = Montag … 7 = Sonntag. */
  'weekday.short': { weekday: number };
  'week.row': { weekNo: number; intro: boolean; deload: boolean };
  'week.legend': {
    hasRestDay: boolean;
    hasIntroWeek: boolean;
    hasDeloadWeek: boolean;
    hasWeight: boolean;
  };
  'cell.rest': Record<string, never>;
  'cell.skipped': Record<string, never>;
  location: { location: EquipmentLocation };
  'endurance.modality': { modality: EnduranceModality | null };
  'value.minutes': { minutes: number };
  'value.aboutMinutes': { minutes: number };
  'session.label.days': Record<string, never>;
  'session.label.location': Record<string, never>;
  'session.label.duration': Record<string, never>;
  /** Ausgeschriebene Wochentage, z. B. „Montag, Donnerstag“; leer = Tag frei wählbar. */
  'value.weekdaysLong': { weekdays: number[] };
  'session.warmup': Record<string, never>;
  'session.cooldown': Record<string, never>;
  'session.exercises': { session: string };
  /** Erklärung unter der Übungstabelle; „Leer = Startgewicht finden“ nur, wenn die Einheit Gewichtsübungen hat. */
  'session.weightHint': { hasWeight: boolean };
  /** Alle Übungen nach den aktuellen Regeln ausgeblendet – neutral, ohne Grund (B1). */
  'session.noExercises': Record<string, never>;
  /** Gewichts-Zelle bei Übungen ohne Zusatzgewicht (Wächter S2). */
  'load.bodyweight': Record<string, never>;
  'load.band': Record<string, never>;
  'load.none': Record<string, never>;
  'col.exercise': Record<string, never>;
  'col.sets': Record<string, never>;
  'col.reps': Record<string, never>;
  'col.rpe': Record<string, never>;
  'col.rest': Record<string, never>;
  'col.weight': Record<string, never>;
  /** Mitschreib-Spalte (leer zum Ausfüllen). */
  'col.log': { no: number };
  'col.date': Record<string, never>;
  'col.week': Record<string, never>;
  'col.activity': Record<string, never>;
  'col.minutes': Record<string, never>;
  'col.effort': Record<string, never>;
  /** „ersetzt (Gerät fehlt)“ – NUR bei fehlendem Gerät, nie bei Tausch aus Sicherheitsgründen (B1). */
  'mark.equipmentSwap': Record<string, never>;
  'mark.superset': { group: string };
  'value.reps': { min: number; max: number };
  'value.targetReps': { reps: number };
  'value.seconds': { seconds: number };
  'value.rest': { seconds: number };
  'value.kg': { kg: number };
  'value.rpe': { rpe: number };
  /** Anstrengung 0–10 in Worten. */
  'value.effort': { effort: number };
  'value.dateWithWeekday': { date: string };
  'endurance.heading': Record<string, never>;
  'endurance.effortHint': Record<string, never>;
  'notes.heading': Record<string, never>;
  'plan.note': { note: PrintPlanNote };
}

export type PrintTextCode = keyof PrintTextParams;

/** Ein Text im Dokument: Code mit Parametern, Inhalt (bereits Text), Datum, Zahl oder leer. */
export type PrintText =
  | {
      readonly [K in PrintTextCode]: {
        readonly kind: 'text';
        readonly code: K;
        readonly params: PrintTextParams[K];
      };
    }[PrintTextCode]
  /** Inhalt aus der Datenbank (Übungs-/Einheitenname, Aufwärmen) oder der optionale Name – nur escapt rendern. */
  | { readonly kind: 'data'; readonly value: string }
  | { readonly kind: 'date'; readonly iso: string }
  | { readonly kind: 'number'; readonly value: number };

/** Zelle = Zeilen untereinander; leer = Feld zum Ausfüllen. */
export type PrintCell = readonly PrintText[];

export type PrintOrientation = 'portrait' | 'landscape';

/** Art einer Tabellenspalte: Beschriftung (Zeilenkopf), Wert oder leeres Mitschreib-Feld. */
export type PrintColumnRole = 'label' | 'value' | 'log';

export interface PrintTableColumn {
  readonly header: PrintText;
  readonly role: PrintColumnRole;
}

export interface PrintTableRow {
  /** Zeilenkopf (`<th scope="row">`). */
  readonly header: PrintCell;
  /** Je weitere Spalte eine Zelle. */
  readonly cells: readonly PrintCell[];
}

export type PrintBlock =
  | { readonly type: 'heading'; readonly level: 1 | 2 | 3; readonly text: PrintText }
  | { readonly type: 'paragraph'; readonly text: PrintText; readonly muted?: boolean }
  | {
      readonly type: 'keyValue';
      readonly items: readonly { readonly label: PrintText; readonly value: PrintText }[];
    }
  | {
      readonly type: 'table';
      readonly caption: PrintText;
      /** Titel ist zugleich Überschrift dieser Ebene (statt eigener Überschrift darüber, Wächter S3). */
      readonly captionLevel?: 2 | 3;
      readonly columns: readonly PrintTableColumn[];
      readonly rows: readonly PrintTableRow[];
    }
  | { readonly type: 'notice'; readonly title: PrintText; readonly text: PrintText }
  /** Neue Seite; `orientation` gilt für die folgende Seite. */
  | { readonly type: 'pageBreak'; readonly orientation: PrintOrientation };

export type PrintDocumentKind = 'training_plan';

export interface PrintDocument {
  readonly meta: {
    readonly kind: PrintDocumentKind;
    /** Titel ohne Namen (B7). */
    readonly title: PrintText;
    /** Dateiname ohne Endung und ohne Namen, nur [a-z0-9-] (B7). */
    readonly fileName: string;
    readonly footer: PrintText;
    readonly createdOn: string;
  };
  /** Erste Seite hochkant; jede weitere beginnt mit einem `pageBreak`. */
  readonly sections: readonly PrintBlock[];
}

/** Hilfsfunktion: Text-Code mit Parametern (typgeprüft). */
export function printText<K extends PrintTextCode>(code: K, params: PrintTextParams[K]): PrintText {
  return { kind: 'text', code, params } as PrintText;
}

/** Codes ohne Parameter. */
export type PrintLabelCode = {
  [K in PrintTextCode]: PrintTextParams[K] extends Record<string, never> ? K : never;
}[PrintTextCode];

/** Text-Code ohne Parameter. */
export function printLabel(code: PrintLabelCode): PrintText {
  return { kind: 'text', code, params: {} } as PrintText;
}

export const printData = (value: string): PrintText => ({ kind: 'data', value });
export const printDate = (iso: string): PrintText => ({ kind: 'date', iso });
export const printNumber = (value: number): PrintText => ({ kind: 'number', value });

// ---------------------------------------------------------------------------------------------------------
// Zod-Schema (Prüfung an der Grenze zur App, z. B. vor dem Übersetzen)
// ---------------------------------------------------------------------------------------------------------

/** Freie Inhalte: keine Steuerzeichen, begrenzte Länge. */
const dataValueSchema = z
  .string()
  .max(600)
  .regex(/^[^\p{Cc}\p{Cf}]*$/u, 'Keine Steuer- oder Formatzeichen.');

const weekdaysSchema = z.array(z.number().int().min(1).max(7)).max(7);
const empty = z.strictObject({});
const count = z.number().int().min(0).max(14);

/** Parameter-Schemas je Code – hält Typ und Laufzeitprüfung zusammen. */
const PARAM_SCHEMAS = {
  'doc.title': empty,
  'doc.footer': empty,
  'cover.heading': empty,
  'plan.name': z.strictObject({
    goal: z.enum(GOAL_TYPES).nullable(),
    discipline: z.enum(ENDURANCE_DISCIPLINES).nullable(),
    strengthDays: count,
    enduranceDays: count,
  }),
  'cover.label.period': empty,
  'cover.label.days': empty,
  'cover.label.locations': empty,
  'cover.label.name': empty,
  'cover.label.asOf': empty,
  'cover.howTo': z.strictObject({ logColumns: count, hasWeight: z.boolean() }),
  'notice.medical.title': empty,
  'notice.medical': empty,
  'value.dateRange': z.strictObject({ from: isoDateSchema, to: isoDateSchema }),
  'value.weekDates': z.strictObject({ from: isoDateSchema, to: isoDateSchema }),
  'value.trainingDays': z.strictObject({ count, weekdays: weekdaysSchema }),
  'value.locations': z.strictObject({
    locations: z.array(z.enum(EQUIPMENT_LOCATIONS)).max(2),
    endurance: z.boolean(),
  }),
  'week.heading': empty,
  'week.column.week': empty,
  'weekday.short': z.strictObject({ weekday: z.number().int().min(1).max(7) }),
  'week.row': z.strictObject({
    weekNo: z.number().int().min(0).max(52),
    intro: z.boolean(),
    deload: z.boolean(),
  }),
  'week.legend': z.strictObject({
    hasRestDay: z.boolean(),
    hasIntroWeek: z.boolean(),
    hasDeloadWeek: z.boolean(),
    hasWeight: z.boolean(),
  }),
  'cell.rest': empty,
  'cell.skipped': empty,
  location: z.strictObject({ location: z.enum(EQUIPMENT_LOCATIONS) }),
  'endurance.modality': z.strictObject({ modality: z.enum(ENDURANCE_MODALITIES).nullable() }),
  'value.minutes': z.strictObject({ minutes: z.number().int().min(0).max(600) }),
  'value.aboutMinutes': z.strictObject({ minutes: z.number().int().min(0).max(600) }),
  'session.label.days': empty,
  'session.label.location': empty,
  'session.label.duration': empty,
  'value.weekdaysLong': z.strictObject({ weekdays: weekdaysSchema }),
  'session.warmup': empty,
  'session.cooldown': empty,
  'session.exercises': z.strictObject({ session: dataValueSchema }),
  'session.weightHint': z.strictObject({ hasWeight: z.boolean() }),
  'session.noExercises': empty,
  'load.bodyweight': empty,
  'load.band': empty,
  'load.none': empty,
  'col.exercise': empty,
  'col.sets': empty,
  'col.reps': empty,
  'col.rpe': empty,
  'col.rest': empty,
  'col.weight': empty,
  'col.log': z.strictObject({ no: z.number().int().min(1).max(8) }),
  'col.date': empty,
  'col.week': empty,
  'col.activity': empty,
  'col.minutes': empty,
  'col.effort': empty,
  'mark.equipmentSwap': empty,
  'mark.superset': z.strictObject({ group: z.string().regex(/^[A-Z]$/) }),
  'value.reps': z.strictObject({ min: z.number().int().min(0), max: z.number().int().min(0) }),
  'value.targetReps': z.strictObject({ reps: z.number().int().min(0) }),
  'value.seconds': z.strictObject({ seconds: z.number().int().min(0) }),
  'value.rest': z.strictObject({ seconds: z.number().int().min(0) }),
  'value.kg': z.strictObject({ kg: z.number().min(0) }),
  'value.rpe': z.strictObject({ rpe: z.number().min(0).max(10) }),
  'value.effort': z.strictObject({ effort: z.number().int().min(0).max(10) }),
  'value.dateWithWeekday': z.strictObject({ date: isoDateSchema }),
  'endurance.heading': empty,
  'endurance.effortHint': empty,
  'notes.heading': empty,
  'plan.note': z.strictObject({ note: z.enum(PRINT_PLAN_NOTES) }),
} satisfies { [K in PrintTextCode]: z.ZodType<PrintTextParams[K]> };

export const PRINT_TEXT_CODES = Object.keys(PARAM_SCHEMAS) as PrintTextCode[];

export const printTextSchema: z.ZodType<PrintText> = z.union([
  ...PRINT_TEXT_CODES.map((code) =>
    z.strictObject({
      kind: z.literal('text'),
      code: z.literal(code),
      params: PARAM_SCHEMAS[code] as z.ZodType,
    }),
  ),
  z.strictObject({ kind: z.literal('data'), value: dataValueSchema }),
  z.strictObject({ kind: z.literal('date'), iso: isoDateSchema }),
  z.strictObject({ kind: z.literal('number'), value: z.number().finite() }),
] as unknown as [z.ZodType<PrintText>, z.ZodType<PrintText>]);

const cellSchema = z.array(printTextSchema).max(6);
const orientationSchema = z.enum(['portrait', 'landscape']);

export const printBlockSchema: z.ZodType<PrintBlock> = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('heading'),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    text: printTextSchema,
  }),
  z.strictObject({
    type: z.literal('paragraph'),
    text: printTextSchema,
    muted: z.boolean().optional(),
  }),
  z.strictObject({
    type: z.literal('keyValue'),
    items: z
      .array(z.strictObject({ label: printTextSchema, value: printTextSchema }))
      .min(1)
      .max(12),
  }),
  z
    .strictObject({
      type: z.literal('table'),
      caption: printTextSchema,
      captionLevel: z.union([z.literal(2), z.literal(3)]).optional(),
      columns: z
        .array(z.strictObject({ header: printTextSchema, role: z.enum(['label', 'value', 'log']) }))
        .min(2)
        .max(16),
      rows: z.array(z.strictObject({ header: cellSchema, cells: z.array(cellSchema) })).max(60),
    })
    .refine(
      (table) => table.rows.every((row) => row.cells.length === table.columns.length - 1),
      'Jede Zeile hat so viele Zellen wie Spalten (ohne Zeilenkopf).',
    ),
  z.strictObject({ type: z.literal('notice'), title: printTextSchema, text: printTextSchema }),
  z.strictObject({ type: z.literal('pageBreak'), orientation: orientationSchema }),
]);

export const printDocumentSchema: z.ZodType<PrintDocument> = z.strictObject({
  meta: z.strictObject({
    kind: z.literal('training_plan'),
    title: printTextSchema,
    fileName: z.string().regex(/^[a-z0-9-]{3,80}$/),
    footer: printTextSchema,
    createdOn: isoDateSchema,
  }),
  sections: z
    .array(printBlockSchema)
    .min(1)
    .max(400)
    .refine((sections) => {
      // B9 auch auf Dokumentebene: mehr als 4 Mitschreib-Spalten nur auf Querformat-Seiten.
      let orientation: PrintOrientation = 'portrait';
      return sections.every((block) => {
        if (block.type === 'pageBreak') orientation = block.orientation;
        if (block.type !== 'table' || orientation === 'landscape') return true;
        return (
          block.columns.filter((c) => c.role === 'log').length <= PRINT_EXPORT.maxLogColumnsPortrait
        );
      });
    }, `Hochkant höchstens ${PRINT_EXPORT.maxLogColumnsPortrait} Mitschreib-Spalten.`),
});
