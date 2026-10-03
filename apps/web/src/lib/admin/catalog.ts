/**
 * Datenaufbereitung für den Redaktionsbereich: Inhaltsdateien → geprüfter Katalog (validateContent aus
 * packages/core, dieselben Regeln wie content:validate) mit Prüfbericht je Inhalt, Filtern und Suche.
 * Rein und ohne Next-Abhängigkeit – getestet in catalog.test.ts.
 */
import {
  CONTENT_ID_PATTERN,
  CONTENT_STATUSES,
  type ContentFile,
  type ContentFileKind,
  type ContentIssue,
  type ContentStatus,
  EQUIPMENT_LOCATIONS,
  estimateSessionMinutes,
  type Exercise,
  isBlockingIssue,
  isPushPullBalanced,
  LARGE_MUSCLE_GROUPS,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  type MuscleGroup,
  needsExpertReviewLabel,
  type PlanTemplate,
  pushPullSets,
  sessionDurationWindow,
  SMALL_MUSCLE_GROUPS,
  TEMPLATE_EXPERIENCE_LEVELS,
  TEMPLATE_GOAL_TYPES,
  TRAINING_LIMITS,
  validateContent,
  weeklySetRange,
  weeklySetsByMuscle,
} from '@fitnessapp/core';
import { z } from 'zod';

export interface IssueSummary {
  readonly errors: number;
  readonly warnings: number;
  /** Rote Befunde, die content:validate fehlschlagen lassen (z. B. an freigegebenen Inhalten). */
  readonly blocking: number;
}

export interface ExerciseEntry {
  readonly kind: 'exercise';
  readonly exercise: Exercise;
  readonly issues: readonly ContentIssue[];
  readonly summary: IssueSummary;
  /** KI-Entwurf ohne fachliche Prüfung → „KI-Entwurf – fachlich prüfen“. */
  readonly needsExpertReview: boolean;
  /** Vorlagen, die diese Übung verwenden. */
  readonly usedIn: readonly { id: string; title: string }[];
  readonly searchText: string;
}

export interface TemplateEntry {
  readonly kind: 'plan_template';
  readonly template: PlanTemplate;
  readonly issues: readonly ContentIssue[];
  readonly summary: IssueSummary;
  readonly needsExpertReview: boolean;
  readonly searchText: string;
}

/** Datei, die nicht als Inhalt gelesen werden konnte (kein JSON, Schemafehler, doppelte ID, fremde Datei). */
export interface BrokenFile {
  readonly kind: ContentFileKind;
  readonly id: string;
  readonly issues: readonly ContentIssue[];
}

export interface Catalog {
  readonly exercises: readonly ExerciseEntry[];
  readonly templates: readonly TemplateEntry[];
  readonly exerciseById: ReadonlyMap<string, ExerciseEntry>;
  readonly templateById: ReadonlyMap<string, TemplateEntry>;
  /** Befunde zur ganzen Bibliothek (Regel Ü5). */
  readonly libraryIssues: readonly ContentIssue[];
  readonly brokenFiles: readonly BrokenFile[];
  /** Dateien ohne .json-Endung in den Inhaltsordnern. */
  readonly strayFiles: readonly string[];
  /** Blockierende Befunde insgesamt (wie content:validate). */
  readonly blockingTotal: number;
}

/** Kleinbuchstaben, ohne Akzente/Umlaute-Punkte, ß → ss – für eine tolerante Suche. */
export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}

export function summarizeIssues(issues: readonly ContentIssue[]): IssueSummary {
  return {
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    blocking: issues.filter(isBlockingIssue).length,
  };
}

/** Rote Befunde zuerst, innerhalb der Stufe in der Reihenfolge der Prüfung. */
function sortIssues(issues: readonly ContentIssue[]): ContentIssue[] {
  return [...issues].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1,
  );
}

const collator = new Intl.Collator('de-DE', { sensitivity: 'base', numeric: true });

/** Baut den Katalog aus allen Inhaltsdateien. */
export function buildCatalog(
  files: readonly ContentFile[],
  strayFiles: readonly string[] = [],
): Catalog {
  const result = validateContent(files);
  const byKey = new Map<string, ContentIssue[]>();
  const libraryIssues: ContentIssue[] = [];
  for (const issue of result.issues) {
    if (issue.kind === 'library') {
      libraryIssues.push(issue);
      continue;
    }
    const key = `${issue.kind}:${issue.id}`;
    byKey.set(key, [...(byKey.get(key) ?? []), issue]);
  }
  const issuesFor = (kind: ContentFileKind, id: string) =>
    sortIssues(byKey.get(`${kind}:${id}`) ?? []);

  const usedIn = new Map<string, { id: string; title: string }[]>();
  for (const template of result.templates) {
    const ids = new Set(template.sessions.flatMap((s) => s.exercises.map((e) => e.exercise_id)));
    for (const id of ids) {
      usedIn.set(id, [...(usedIn.get(id) ?? []), { id: template.id, title: template.title_de }]);
    }
  }

  const exercises: ExerciseEntry[] = result.exercises
    .map((exercise): ExerciseEntry => {
      const issues = issuesFor('exercise', exercise.id);
      return {
        kind: 'exercise',
        exercise,
        issues,
        summary: summarizeIssues(issues),
        needsExpertReview: needsExpertReviewLabel(exercise.meta),
        usedIn: (usedIn.get(exercise.id) ?? []).sort((a, b) => collator.compare(a.title, b.title)),
        searchText: normalizeSearch(
          [exercise.id, exercise.name_de, exercise.name_en, ...exercise.aliases_de].join(' '),
        ),
      };
    })
    .sort((a, b) => collator.compare(a.exercise.name_de, b.exercise.name_de));

  const templates: TemplateEntry[] = result.templates
    .map((template): TemplateEntry => {
      const issues = issuesFor('plan_template', template.id);
      return {
        kind: 'plan_template',
        template,
        issues,
        summary: summarizeIssues(issues),
        needsExpertReview: needsExpertReviewLabel(template.meta),
        searchText: normalizeSearch(
          [template.id, template.title_de, ...template.sessions.map((s) => s.name_de)].join(' '),
        ),
      };
    })
    .sort((a, b) => collator.compare(a.template.title_de, b.template.title_de));

  const valid = new Set([
    ...exercises.map((e) => `exercise:${e.exercise.id}`),
    ...templates.map((t) => `plan_template:${t.template.id}`),
  ]);
  const brokenFiles: BrokenFile[] = [];
  for (const [key, issues] of byKey) {
    if (!valid.has(key)) {
      const [kind, ...rest] = key.split(':');
      brokenFiles.push({
        kind: kind as ContentFileKind,
        id: rest.join(':'),
        issues: sortIssues(issues),
      });
    }
  }
  brokenFiles.sort((a, b) => collator.compare(a.id, b.id));

  return {
    exercises,
    templates,
    exerciseById: new Map(exercises.map((entry) => [entry.exercise.id, entry])),
    templateById: new Map(templates.map((entry) => [entry.template.id, entry])),
    libraryIssues,
    brokenFiles,
    strayFiles,
    blockingTotal: result.blocking.length + strayFiles.length,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Filter (Werte kommen aus der Adresszeile → mit Zod geprüft; Ungültiges wird ignoriert)
// ---------------------------------------------------------------------------------------------------------

export const ADMIN_TABS = ['uebungen', 'vorlagen'] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

/** „hat Fehler“: rot = mindestens ein roter Befund, gelb = mindestens ein Hinweis, ohne = keine Befunde. */
export const ISSUE_FILTERS = ['rot', 'gelb', 'ohne'] as const;
export type IssueFilter = (typeof ISSUE_FILTERS)[number];

/** KI-Kennzeichnung: offen = KI-Entwurf ohne fachliche Prüfung, geprueft = fachlich geprüft/von Hand. */
export const EXPERT_FILTERS = ['offen', 'geprueft'] as const;
export type ExpertFilter = (typeof EXPERT_FILTERS)[number];

const optional = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

const filterSchema = z.object({
  tab: z.enum(ADMIN_TABS).catch('uebungen'),
  q: optional(z.string().trim().max(100)),
  status: optional(z.enum(CONTENT_STATUSES)),
  fehler: optional(z.enum(ISSUE_FILTERS)),
  ki: optional(z.enum(EXPERT_FILTERS)),
  // Übungen
  muster: optional(z.enum(MOVEMENT_PATTERNS)),
  geraet: optional(z.string().regex(/^(ohne|[a-z][a-z0-9_]{1,49})$/)),
  // Vorlagen
  ziel: optional(z.enum(TEMPLATE_GOAL_TYPES)),
  level: optional(z.enum(TEMPLATE_EXPERIENCE_LEVELS)),
  tage: optional(
    z.coerce
      .number()
      .int()
      .min(TRAINING_LIMITS.sessionsPerWeek.min)
      .max(TRAINING_LIMITS.sessionsPerWeek.max),
  ),
  ort: optional(z.enum(EQUIPMENT_LOCATIONS)),
});
export type AdminFilters = z.infer<typeof filterSchema>;

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

/** Liest die Filter aus den Suchparametern (bei Mehrfachwerten zählt der erste, leere Werte = kein Filter). */
export function parseFilters(params: SearchParams): AdminFilters {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined && first.trim() !== '') {
      flat[key] = first;
    }
  }
  return filterSchema.parse(flat);
}

function matchesCommon(
  entry: { searchText: string; summary: IssueSummary; needsExpertReview: boolean },
  status: ContentStatus,
  filters: AdminFilters,
): boolean {
  if (filters.status && status !== filters.status) return false;
  if (filters.q) {
    const words = normalizeSearch(filters.q).split(' ').filter(Boolean);
    if (!words.every((word) => entry.searchText.includes(word))) return false;
  }
  if (filters.fehler === 'rot' && entry.summary.errors === 0) return false;
  if (filters.fehler === 'gelb' && entry.summary.warnings === 0) return false;
  if (filters.fehler === 'ohne' && entry.summary.errors + entry.summary.warnings > 0) return false;
  if (filters.ki === 'offen' && !entry.needsExpertReview) return false;
  if (filters.ki === 'geprueft' && entry.needsExpertReview) return false;
  return true;
}

export function filterExercises(
  entries: readonly ExerciseEntry[],
  filters: AdminFilters,
): ExerciseEntry[] {
  return entries.filter((entry) => {
    const { exercise } = entry;
    if (!matchesCommon(entry, exercise.status, filters)) return false;
    if (filters.muster && exercise.movement_pattern !== filters.muster) return false;
    if (filters.geraet === 'ohne' && exercise.equipment_ids.length > 0) return false;
    if (
      filters.geraet &&
      filters.geraet !== 'ohne' &&
      !exercise.equipment_ids.includes(filters.geraet)
    ) {
      return false;
    }
    return true;
  });
}

export function filterTemplates(
  entries: readonly TemplateEntry[],
  filters: AdminFilters,
): TemplateEntry[] {
  return entries.filter((entry) => {
    const { template } = entry;
    if (!matchesCommon(entry, template.status, filters)) return false;
    if (filters.ziel && template.goal_type !== filters.ziel) return false;
    if (filters.level && template.experience_level !== filters.level) return false;
    if (filters.tage && template.sessions_per_week !== filters.tage) return false;
    if (filters.ort && template.location !== filters.ort) return false;
    return true;
  });
}

/** Anzahl je Status („12 Entwürfe · 38 freigegeben“). */
export function countByStatus(statuses: readonly ContentStatus[]): Record<ContentStatus, number> {
  const counts = { draft: 0, published: 0, archived: 0 } satisfies Record<ContentStatus, number>;
  for (const status of statuses) counts[status] += 1;
  return counts;
}

/** Sind irgendwelche Filter (außer dem Reiter) gesetzt? */
export function hasActiveFilters(filters: AdminFilters): boolean {
  return Object.entries(filters).some(([key, value]) => key !== 'tab' && value !== undefined);
}

/** Geräte, die in Übungen vorkommen (für die Auswahlliste), sortiert nach Katalog-Reihenfolge der IDs. */
export function usedEquipmentIds(entries: readonly ExerciseEntry[]): string[] {
  return [...new Set(entries.flatMap((entry) => entry.exercise.equipment_ids))].sort();
}

/** Gültige Inhalts-ID für Detailseiten (sonst „nicht gefunden“). */
export function isContentId(value: string): boolean {
  return value.length <= 80 && CONTENT_ID_PATTERN.test(value);
}

// ---------------------------------------------------------------------------------------------------------
// Kennzahlen einer Vorlage für die Detailansicht (Rechnung aus packages/core, hier nur zusammengestellt)
// ---------------------------------------------------------------------------------------------------------

export type VolumeState = 'ok' | 'low' | 'high';

export interface VolumeBar {
  readonly muscle: MuscleGroup;
  readonly sets: number;
  /** Untergrenze nur für große (V10) und kleine (V11) Muskelgruppen, sonst null. */
  readonly min: number | null;
  readonly max: number;
  readonly state: VolumeState;
}

/**
 * Wochensätze pro Muskelgruppe mit Zielbereich (Regeln V9–V11). Gezeigt werden alle Muskelgruppen mit
 * Sätzen und alle großen Muskelgruppen (auch mit 0 Sätzen), in der Reihenfolge von MUSCLE_GROUPS.
 */
export function volumeBars(
  template: PlanTemplate,
  lookup: ReadonlyMap<string, ExerciseEntry>,
): VolumeBar[] {
  const exercises = new Map([...lookup].map(([id, entry]) => [id, entry.exercise]));
  const sets = weeklySetsByMuscle(template, exercises);
  const range = weeklySetRange(template);
  const withMin = new Set<MuscleGroup>([...LARGE_MUSCLE_GROUPS, ...SMALL_MUSCLE_GROUPS]);
  return MUSCLE_GROUPS.filter(
    (muscle) =>
      sets[muscle] > 0 || (LARGE_MUSCLE_GROUPS as readonly MuscleGroup[]).includes(muscle),
  ).map((muscle) => {
    const value = sets[muscle];
    const min = withMin.has(muscle) ? range.min : null;
    const state: VolumeState =
      value > range.max ? 'high' : min !== null && value < min ? 'low' : 'ok';
    return { muscle, sets: value, min, max: range.max, state };
  });
}

export interface SessionStats {
  readonly dayIndex: number;
  readonly estimatedMinutes: number;
  readonly window: { min: number; max: number };
  readonly withinWindow: boolean;
}

/** Geschätzte Dauer je Einheit und erlaubtes Fenster (Regel V6). */
export function sessionStats(template: PlanTemplate): SessionStats[] {
  const window = sessionDurationWindow(template);
  return template.sessions.map((session) => {
    const estimatedMinutes = estimateSessionMinutes(session);
    return {
      dayIndex: session.day_index,
      estimatedMinutes,
      window,
      withinWindow: estimatedMinutes >= window.min && estimatedMinutes <= window.max,
    };
  });
}

/** Drück- und Zugsätze pro Woche (Regel V7). */
export function pushPullStats(
  template: PlanTemplate,
  lookup: ReadonlyMap<string, ExerciseEntry>,
): { push: number; pull: number; balanced: boolean } {
  const exercises = new Map([...lookup].map(([id, entry]) => [id, entry.exercise]));
  const totals = pushPullSets(template, exercises);
  return { ...totals, balanced: isPushPullBalanced(totals) };
}
