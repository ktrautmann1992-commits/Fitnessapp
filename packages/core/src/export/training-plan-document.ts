import { z } from 'zod';

import { isoDateSchema } from '../age';
import { PRINT_EXPORT } from '../constants';
import type { Exercise } from '../content/schemas';
import { addDays, isoWeekday, startOfIsoWeek } from '../dates';
import type { EnduranceDiscipline, EquipmentLocation, GoalType, PlanNote } from '../enums';
import { prescriptionForDisplay, type ProgressResult } from '../log/progression';
import type { PlannedExerciseDraft } from '../plan/adapt';
import type { EquipmentProfile } from '../plan/equipment-profile';
import type { EnduranceStartGroup, PlanSafetyRules } from '../plan/safety';
import {
  blockWeekFor,
  exerciseMark,
  prepareSessionForDisplay,
  sessionLocation,
  sessionOn,
  type SessionLocationContext,
  type StoredSession,
} from '../plan/view';
import type { TrainingSchedule } from '../training-schedule';
import {
  printData as data,
  printDate as date,
  printLabel as label,
  printNumber as num,
  type PrintBlock,
  type PrintCell,
  type PrintDocument,
  type PrintOrientation,
  PRINT_PLAN_NOTES,
  type PrintPlanNote,
  type PrintTableColumn,
  type PrintTableRow,
  type PrintText,
  printText as text,
} from './document';

/**
 * Trainingsplan → Druck-Dokument (docs/PLAN-PDF-EXPORT.md §5–§7). Reine Funktion: dieselben Regeln wie die Anzeige
 * in der App (prepareSessionForDisplay, sessionLocation, Phase-4-Vorgaben je Ort), Ausgabe nur Codes und Daten.
 *
 * Datenschutz (Wächter B1, B11):
 * - neutraler Arzt-Hinweis auf JEDEM Dokument, unabhängig von Gesundheitsangaben (`medical_notice` wird nicht gelesen),
 * - Markierung „ersetzt (Gerät fehlt)“ nur bei fehlendem Gerät, nie bei Tausch aus Sicherheitsgründen,
 * - kein Level (Planname aus Ziel + Tagen statt Vorlagenname), keine Flags, Gründe, Alter, Körperdaten, Zyklusdaten,
 * - Plan-Hinweise nur aus Gerätegründen (PRINT_PLAN_NOTES).
 */

// ---------------------------------------------------------------------------------------------------------
// Eingaben
// ---------------------------------------------------------------------------------------------------------

export const trainingPlanExportOptionsSchema = z
  .strictObject({
    /** Stichtag („Stand“) – wählt auch den Plan-Block (aktueller bzw. nächster). */
    onDate: isoDateSchema,
    /** Name auf dem Deckblatt (§10 Frage 3: optional, Standard aus). */
    includeName: z.boolean().default(false),
    name: z
      .string()
      .trim()
      .max(PRINT_EXPORT.nameMaxLength)
      .regex(/^[^\p{Cc}\p{Cf}]*$/u, 'Keine Steuer- oder Formatzeichen.')
      .nullable()
      .default(null),
    /** Leere Mitschreib-Spalten je Übung (B9: hochkant höchstens 4). */
    logColumns: z
      .number()
      .int()
      .min(0)
      .max(PRINT_EXPORT.maxLogColumnsLandscape)
      .default(PRINT_EXPORT.defaultLogColumns),
    /** Einheiten-Seiten im Querformat. */
    landscape: z.boolean().default(false),
  })
  .refine((o) => o.landscape || o.logColumns <= PRINT_EXPORT.maxLogColumnsPortrait, {
    path: ['logColumns'],
    message: `Hochkant höchstens ${PRINT_EXPORT.maxLogColumnsPortrait} Mitschreib-Spalten – sonst Querformat.`,
  })
  .refine((o) => !o.includeName || (o.name !== null && o.name.length > 0), {
    path: ['name'],
    message: 'Für den Namen auf dem Deckblatt bitte einen Namen angeben.',
  });

export type TrainingPlanExportOptionsInput = z.input<typeof trainingPlanExportOptionsSchema>;
export type TrainingPlanExportOptions = z.output<typeof trainingPlanExportOptionsSchema>;

/** Was vom gespeicherten Plan gebraucht wird (user_plans). Bewusst ohne Gesundheitsfelder. */
export interface TrainingPlanForExport {
  readonly notes: readonly PlanNote[];
  /** Angaben des Plans (user_plans.inputs); null = nicht lesbar. */
  readonly inputs: {
    readonly goalType: GoalType;
    readonly discipline: EnduranceDiscipline | null;
    readonly schedule: TrainingSchedule;
  } | null;
}

/** Wie in der App-Anzeige (DisplayContext), mit Geräte-Profil je Ort. */
export interface ExportDisplayContext {
  readonly rules: PlanSafetyRules;
  readonly previousStartGroup: EnduranceStartGroup;
  readonly library: ReadonlyMap<string, Exercise> | null;
  readonly substituteLibrary?: ReadonlyMap<string, Exercise>;
  readonly profiles: ReadonlyMap<EquipmentLocation, Pick<EquipmentProfile, 'available'>>;
}

/** Progression einer Übung an einem Ort (Phase 4): Ergebnis von progressFromLogs() und Gewichtsstufen des Orts. */
export interface ExportProgress {
  readonly result: Pick<ProgressResult, 'progress' | 'firstSessionRpeTarget'> & {
    readonly effective?: ProgressResult['effective'];
    readonly returnAfterPause?: boolean;
  };
  readonly steps: readonly number[];
}

/** Ort → Übung → Progression. Fehlt ein Eintrag, bleibt die Gewichts-Spalte leer. */
export type ExportProgressByLocation = ReadonlyMap<
  EquipmentLocation,
  ReadonlyMap<string, ExportProgress>
>;

export type TrainingPlanDocumentResult =
  | { readonly ok: true; readonly document: PrintDocument }
  | {
      readonly ok: false;
      readonly error: 'invalid_options' | 'no_sessions' | 'library_missing';
    };

// ---------------------------------------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------------------------------------

const planDate = (s: Pick<StoredSession, 'original_date' | 'scheduled_on'>) =>
  s.original_date ?? s.scheduled_on;

const isLoadWeek = (s: Pick<StoredSession, 'is_intro_week' | 'is_deload' | 'week_no'>) =>
  !s.is_intro_week && !s.is_deload && s.week_no > 0;

const sortedUnique = (values: Iterable<number>) => [...new Set(values)].sort((a, b) => a - b);

const LOCATION_ORDER: readonly EquipmentLocation[] = ['gym', 'home'];

/** Ort mehrdeutiger Einheiten aus der Fassung ableiten (Heim-Geräte, Wächter S1). */
const locationContext = (display: ExportDisplayContext): SessionLocationContext => ({
  library: display.library,
  ...(display.profiles.get('home') ? { homeProfile: display.profiles.get('home') } : {}),
});

/** Inhalte (Namen, Aufwärmen) ohne Steuer- und Formatzeichen; das Schema lehnt sie sonst ab. */
const content = (value: string): PrintText =>
  data(
    value
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/[\p{Cc}\p{Cf}]/gu, '')
      .slice(0, 600),
  );

/** Hat die Übung ein Zusatzgewicht? Unbekannt (Bibliothek fehlt) zählt als Gewicht (Feld bleibt leer). */
const isWeighted = (exerciseId: string, display: ExportDisplayContext) =>
  (display.library?.get(exerciseId)?.load_type ?? 'weight') === 'weight';

/** Sitzungen der regulären Belastungswochen, sonst alle (z. B. Block nur aus Woche 0). */
function representative<T extends StoredSession>(sessions: readonly T[]): T[] {
  const load = sessions.filter(isLoadWeek);
  return load.length > 0 ? load : [...sessions];
}

/** Höchste Zahl an Einheiten einer Art in einer Woche (geplant, inkl. gestrichener). */
function maxPerWeek(sessions: readonly StoredSession[], strength: boolean): number {
  const perWeek = new Map<string, number>();
  for (const s of sessions) {
    if ((s.kind === 'strength') !== strength) continue;
    const key = startOfIsoWeek(planDate(s));
    perWeek.set(key, (perWeek.get(key) ?? 0) + 1);
  }
  return Math.max(0, ...perWeek.values());
}

/** Der Block zum Stichtag: der laufende bzw. nächste, sonst der letzte. */
function blockSessions<T extends StoredSession>(sessions: readonly T[], onDate: string): T[] {
  const blockNo =
    blockWeekFor(sessions, onDate)?.blockNo ?? Math.max(...sessions.map((s) => s.block_no));
  return sessions.filter((s) => s.block_no === blockNo);
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

// ---------------------------------------------------------------------------------------------------------
// Deckblatt
// ---------------------------------------------------------------------------------------------------------

function coverBlocks(
  plan: TrainingPlanForExport,
  block: readonly StoredSession[],
  schedule: TrainingSchedule | null,
  display: ExportDisplayContext,
  options: TrainingPlanExportOptions,
  hasWeight: boolean,
): PrintBlock[] {
  const reference = representative(block);
  const strengthDays = maxPerWeek(reference, true);
  const enduranceDays = maxPerWeek(reference, false);
  const weekdays = sortedUnique(reference.map((s) => isoWeekday(planDate(s))));
  const dates = block.map((s) => s.scheduled_on).sort();
  const locations = LOCATION_ORDER.filter((location) =>
    block.some(
      (s) =>
        s.kind === 'strength' &&
        sessionLocation(s, schedule, locationContext(display)) === location,
    ),
  );
  const items: { label: PrintText; value: PrintText }[] = [];
  if (options.includeName && options.name) {
    items.push({ label: label('cover.label.name'), value: data(options.name) });
  }
  items.push(
    {
      label: label('cover.label.period'),
      value: text('value.dateRange', {
        from: dates[0] as string,
        to: dates.at(-1) as string,
      }),
    },
    {
      label: label('cover.label.days'),
      value: text('value.trainingDays', { count: strengthDays + enduranceDays, weekdays }),
    },
    {
      label: label('cover.label.locations'),
      value: text('value.locations', { locations, endurance: enduranceDays > 0 }),
    },
    { label: label('cover.label.asOf'), value: date(options.onDate) },
  );
  return [
    { type: 'heading', level: 1, text: label('cover.heading') },
    {
      type: 'heading',
      level: 2,
      text: text('plan.name', {
        goal: plan.inputs?.goalType ?? null,
        discipline: plan.inputs?.discipline ?? null,
        strengthDays,
        enduranceDays,
      }),
    },
    { type: 'keyValue', items },
    // Neutraler Arzt-Hinweis – auf JEDEM Dokument, für alle gleich (B1).
    { type: 'notice', title: label('notice.medical.title'), text: label('notice.medical') },
    { type: 'paragraph', text: text('cover.howTo', { logColumns: options.logColumns, hasWeight }) },
  ];
}

// ---------------------------------------------------------------------------------------------------------
// Wochenübersicht
// ---------------------------------------------------------------------------------------------------------

function weekCell(
  sessions: readonly StoredSession[],
  day: string,
  schedule: TrainingSchedule | null,
  display: ExportDisplayContext,
): PrintCell {
  const session = sessionOn(sessions, day);
  if (session) {
    if (session.kind === 'strength') {
      return [
        content(session.name_de),
        text('location', {
          location: sessionLocation(session, schedule, locationContext(display)),
        }),
      ];
    }
    const shown = prepareSessionForDisplay(session, {
      rules: display.rules,
      previousStartGroup: display.previousStartGroup,
      library: display.library,
    }).session;
    return [
      text('endurance.modality', { modality: shown.endurance_modality }),
      text('value.minutes', { minutes: shown.estimated_minutes }),
    ];
  }
  const skipped = sessions.find((s) => s.scheduled_on === day && s.status === 'skipped');
  if (skipped) {
    return [content(skipped.name_de), label('cell.skipped')];
  }
  return [label('cell.rest')];
}

function weekOverviewBlocks(
  block: readonly StoredSession[],
  schedule: TrainingSchedule | null,
  display: ExportDisplayContext,
  notes: readonly PrintPlanNote[],
  hasWeight: boolean,
): PrintBlock[] {
  const weekNos = sortedUnique(block.map((s) => s.week_no));
  const rows: PrintTableRow[] = weekNos.map((weekNo) => {
    const sessions = block.filter((s) => s.week_no === weekNo);
    const first = sessions[0] as StoredSession;
    const monday = startOfIsoWeek(planDate(first));
    return {
      header: [
        text('week.row', { weekNo, intro: first.is_intro_week, deload: first.is_deload }),
        text('value.weekDates', { from: monday, to: addDays(monday, 6) }),
      ],
      cells: Array.from({ length: 7 }, (_, index) =>
        weekCell(sessions, addDays(monday, index), schedule, display),
      ),
    };
  });
  const columns: PrintTableColumn[] = [
    { header: label('week.column.week'), role: 'label' },
    ...Array.from({ length: 7 }, (_, index) => ({
      header: text('weekday.short', { weekday: index + 1 }),
      role: 'value' as const,
    })),
  ];
  const blocks: PrintBlock[] = [];
  chunk(rows, PRINT_EXPORT.weekRowsPerPage).forEach((part) => {
    blocks.push(
      { type: 'pageBreak', orientation: 'portrait' },
      // Tabellentitel = Überschrift (keine doppelte Überschrift, Wächter S3); Folgeseiten wiederholen ihn.
      { type: 'table', caption: label('week.heading'), captionLevel: 2, columns, rows: part },
    );
  });
  blocks.push({
    type: 'paragraph',
    muted: true,
    text: text('week.legend', {
      hasRestDay: rows.some((row) =>
        row.cells.some((c) => c[0]?.kind === 'text' && c[0].code === 'cell.rest'),
      ),
      hasWeight,
      hasIntroWeek: block.some((s) => s.is_intro_week),
      hasDeloadWeek: block.some((s) => s.is_deload),
    }),
  });
  if (notes.length > 0) {
    blocks.push({ type: 'heading', level: 3, text: label('notes.heading') });
    for (const note of notes) {
      blocks.push({ type: 'paragraph', text: text('plan.note', { note }) });
    }
  }
  return blocks;
}

// ---------------------------------------------------------------------------------------------------------
// Kraft-Einheiten: Fassung des Orts je Wochentag (B8)
// ---------------------------------------------------------------------------------------------------------

interface SessionVersion {
  readonly key: string;
  readonly location: EquipmentLocation;
  readonly original: StoredSession;
  readonly shown: StoredSession;
  readonly weekdays: Set<number>;
}

function versionKey(location: EquipmentLocation, shown: StoredSession): string {
  return JSON.stringify([
    shown.template_day_index,
    location,
    shown.name_de,
    shown.exercises.map((e) => [
      e.exercise_id,
      e.sets,
      e.reps_min,
      e.reps_max,
      e.duration_s,
      e.rest_s,
      e.rpe_target,
    ]),
  ]);
}

function exerciseRow(
  exercise: PlannedExerciseDraft,
  version: SessionVersion,
  display: ExportDisplayContext,
  progress: ExportProgressByLocation | null,
  logColumns: number,
): PrintTableRow {
  const header: PrintText[] = [content(exercise.exercise_name_de)];
  const mark = exerciseMark(exercise, version.original, {
    library: display.library,
    profile: display.profiles.get(version.location),
  });
  // Nur Gerätetausch markieren – „angepasst“ (Sicherheitsregeln) bleibt unsichtbar (B1).
  if (mark === 'equipment_swap') header.push(label('mark.equipmentSwap'));
  if (exercise.superset_group !== null) {
    header.push(text('mark.superset', { group: exercise.superset_group }));
  }

  let sets = exercise.sets;
  let reps: PrintCell = [];
  let rpe = exercise.rpe_target;
  let weightKg: number | null = exercise.target_weight_kg;
  const own = progress?.get(version.location)?.get(exercise.exercise_id);
  if (own) {
    const p = prescriptionForDisplay(
      {
        sets: exercise.sets,
        reps_min: exercise.reps_min,
        reps_max: exercise.reps_max,
        duration_s: exercise.duration_s,
        rpe_target: exercise.rpe_target,
      },
      own.result,
      { isDeload: false, steps: own.steps, rpeMax: display.rules.rpeMax },
    );
    sets = p.sets;
    rpe = p.rpeTarget;
    weightKg = p.weightKg;
    if (p.durationS !== null) reps = [text('value.seconds', { seconds: p.durationS })];
    else if (p.targetReps !== null) reps = [text('value.targetReps', { reps: p.targetReps })];
  }
  if (reps.length === 0) {
    reps =
      exercise.duration_s !== null
        ? [text('value.seconds', { seconds: exercise.duration_s })]
        : [
            text('value.reps', {
              min: exercise.reps_min ?? 0,
              max: exercise.reps_max ?? exercise.reps_min ?? 0,
            }),
          ];
  }
  return {
    header,
    cells: [
      [num(sets)],
      reps,
      [text('value.rpe', { rpe })],
      [text('value.rest', { seconds: exercise.rest_s })],
      loadCell(exercise.exercise_id, weightKg, display),
      ...Array.from({ length: logColumns }, () => []),
    ],
  };
}

/** Gewichts-Zelle: Vorgabe in kg; leer = Startgewicht finden; ohne Zusatzgewicht eigener Text (Wächter S2). */
function loadCell(
  exerciseId: string,
  weightKg: number | null,
  display: ExportDisplayContext,
): PrintCell {
  const type = display.library?.get(exerciseId)?.load_type ?? 'weight';
  if (type === 'weight') return weightKg !== null ? [text('value.kg', { kg: weightKg })] : [];
  if (type === 'bodyweight') return [label('load.bodyweight')];
  if (type === 'band') return [label('load.band')];
  return [label('load.none')];
}

function sessionBlocks(
  version: SessionVersion,
  display: ExportDisplayContext,
  progress: ExportProgressByLocation | null,
  options: TrainingPlanExportOptions,
  orientation: PrintOrientation,
): PrintBlock[] {
  const { shown } = version;
  const columns: PrintTableColumn[] = [
    { header: label('col.exercise'), role: 'label' },
    { header: label('col.sets'), role: 'value' },
    { header: label('col.reps'), role: 'value' },
    { header: label('col.rpe'), role: 'value' },
    { header: label('col.rest'), role: 'value' },
    { header: label('col.weight'), role: 'value' },
    ...Array.from({ length: options.logColumns }, (_, i) => ({
      header: text('col.log', { no: i + 1 }),
      role: 'log' as const,
    })),
  ];
  return [
    { type: 'pageBreak', orientation },
    { type: 'heading', level: 2, text: content(shown.name_de) },
    {
      type: 'keyValue',
      items: [
        {
          label: label('session.label.days'),
          value: text('value.weekdaysLong', { weekdays: sortedUnique(version.weekdays) }),
        },
        {
          label: label('session.label.location'),
          value: text('location', { location: version.location }),
        },
        {
          label: label('session.label.duration'),
          value: text('value.aboutMinutes', { minutes: shown.estimated_minutes }),
        },
      ],
    },
    { type: 'heading', level: 3, text: label('session.warmup') },
    { type: 'paragraph', text: content(shown.warmup_de) },
    // Alle Übungen ausgeblendet (aktuelle Regeln, kein Ersatz): neutraler Hinweis statt leerer Tabelle (K7).
    ...(shown.exercises.length === 0
      ? [{ type: 'paragraph', text: label('session.noExercises') } as const]
      : ([
          {
            type: 'table',
            caption: text('session.exercises', {
              session: shown.name_de.replace(/[\p{Cc}\p{Cf}]/gu, '').slice(0, 600),
            }),
            columns,
            rows: shown.exercises.map((e) =>
              exerciseRow(e, version, display, progress, options.logColumns),
            ),
          },
          {
            type: 'paragraph',
            muted: true,
            text: text('session.weightHint', {
              hasWeight: shown.exercises.some((e) => isWeighted(e.exercise_id, display)),
            }),
          },
        ] as const)),
    { type: 'heading', level: 3, text: label('session.cooldown') },
    { type: 'paragraph', text: content(shown.cooldown_de) },
  ];
}

// ---------------------------------------------------------------------------------------------------------
// Ausdauer
// ---------------------------------------------------------------------------------------------------------

function enduranceBlocks(
  block: readonly StoredSession[],
  display: ExportDisplayContext,
): PrintBlock[] {
  const sessions = block
    .filter((s) => s.kind === 'endurance' && s.status !== 'skipped')
    .sort((a, b) => (a.scheduled_on < b.scheduled_on ? -1 : 1));
  if (sessions.length === 0) return [];
  const columns: PrintTableColumn[] = [
    { header: label('col.date'), role: 'label' },
    { header: label('col.week'), role: 'value' },
    { header: label('col.activity'), role: 'value' },
    { header: label('col.minutes'), role: 'value' },
    { header: label('col.effort'), role: 'value' },
  ];
  const rows: PrintTableRow[] = sessions.map((original) => {
    const s = prepareSessionForDisplay(original, {
      rules: display.rules,
      previousStartGroup: display.previousStartGroup,
      library: display.library,
    }).session;
    return {
      header: [text('value.dateWithWeekday', { date: s.scheduled_on })],
      cells: [
        [text('week.row', { weekNo: s.week_no, intro: s.is_intro_week, deload: s.is_deload })],
        [content(s.name_de)],
        [text('value.minutes', { minutes: s.estimated_minutes })],
        s.effort_target !== null ? [text('value.effort', { effort: s.effort_target })] : [],
      ],
    };
  });
  const blocks: PrintBlock[] = [];
  chunk(rows, PRINT_EXPORT.enduranceRowsPerPage).forEach((part) => {
    blocks.push(
      { type: 'pageBreak', orientation: 'portrait' },
      { type: 'table', caption: label('endurance.heading'), captionLevel: 2, columns, rows: part },
    );
  });
  blocks.push({ type: 'paragraph', muted: true, text: label('endurance.effortHint') });
  return blocks;
}

// ---------------------------------------------------------------------------------------------------------
// Dokument
// ---------------------------------------------------------------------------------------------------------

/**
 * Baut das Druck-Dokument des Trainingsplans für den Block zum Stichtag `onDate`.
 * - Deckblatt (ohne Level, Name nur auf Wunsch), Wochenübersicht Mo–So, je Kraft-Einheit eine Seite pro Fassung
 *   (Ort + Wochentage, B8), Ausdauer-Tabelle; Arzt-Hinweis und Fußzeile immer.
 * - Jede Einheit läuft durch prepareSessionForDisplay() (aktuelle Sicherheitsregeln, wie in der App).
 * - Gewicht: aktuelle Vorgabe (prescriptionForDisplay mit dem wirksamen Zustand am Ort), sonst leer.
 */
export function buildTrainingPlanDocument(
  plan: TrainingPlanForExport,
  sessions: readonly StoredSession[],
  display: ExportDisplayContext,
  progress: ExportProgressByLocation | null,
  rawOptions: TrainingPlanExportOptionsInput,
): TrainingPlanDocumentResult {
  const parsed = trainingPlanExportOptionsSchema.safeParse(rawOptions);
  if (!parsed.success) return { ok: false, error: 'invalid_options' };
  const options = parsed.data;
  if (sessions.length === 0) return { ok: false, error: 'no_sessions' };

  const schedule = plan.inputs?.schedule ?? null;
  const block = blockSessions(sessions, options.onDate);
  const notes = PRINT_PLAN_NOTES.filter((note) => plan.notes.includes(note));

  // Fassungen der Kraft-Einheiten (Ort je Wochentag) aus den regulären Wochen.
  const versions = new Map<string, SessionVersion>();
  const strength = representative(block.filter((s) => s.kind === 'strength')).filter(
    (s) => s.status !== 'skipped',
  );
  for (const original of strength) {
    const location = sessionLocation(original, schedule, locationContext(display));
    const profile = display.profiles.get(location);
    const shown = prepareSessionForDisplay(original, {
      rules: display.rules,
      previousStartGroup: display.previousStartGroup,
      library: display.library,
      ...(display.substituteLibrary ? { substituteLibrary: display.substituteLibrary } : {}),
      ...(profile ? { profile } : {}),
    });
    if (shown.libraryMissing) return { ok: false, error: 'library_missing' };
    const key = versionKey(location, shown.session);
    const existing = versions.get(key);
    const weekday = isoWeekday(planDate(original));
    if (existing) existing.weekdays.add(weekday);
    else {
      versions.set(key, {
        key,
        location,
        original,
        shown: shown.session,
        weekdays: new Set([weekday]),
      });
    }
  }
  const ordered = [...versions.values()].sort(
    (a, b) =>
      (a.shown.template_day_index ?? 0) - (b.shown.template_day_index ?? 0) ||
      LOCATION_ORDER.indexOf(a.location) - LOCATION_ORDER.indexOf(b.location) ||
      Math.min(...a.weekdays) - Math.min(...b.weekdays),
  );
  const orientation: PrintOrientation = options.landscape ? 'landscape' : 'portrait';

  const hasWeight = ordered.some((v) =>
    v.shown.exercises.some((e) => isWeighted(e.exercise_id, display)),
  );
  const sections: PrintBlock[] = [
    ...coverBlocks(plan, block, schedule, display, options, hasWeight),
    ...weekOverviewBlocks(block, schedule, display, notes, hasWeight),
    ...ordered.flatMap((version) =>
      sessionBlocks(version, display, progress, options, orientation),
    ),
    ...enduranceBlocks(block, display),
  ];

  return {
    ok: true,
    document: {
      meta: {
        kind: 'training_plan',
        title: label('doc.title'),
        fileName: `alpha5-trainingsplan-${options.onDate}`,
        footer: label('doc.footer'),
        createdOn: options.onDate,
      },
      sections,
    },
  };
}
