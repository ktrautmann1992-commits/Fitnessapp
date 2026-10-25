/**
 * Testhilfe (nur in *.test.ts): lädt den echten Inhaltsstand aus `content/` und prüft ihn mit validateContent –
 * so laufen die Plan-Tests gegen die Übungen und Vorlagen des Startbestands. Der Freigabe-Status im Repository
 * (`draft` oder nach Freigabe `published`) darf die Tests nicht ändern: Tests, die ein bestimmtes Status-Verhalten
 * prüfen, setzen ihn mit `status` selbst (in-memory, die Dateien bleiben unverändert).
 */
import { readdirSync, readFileSync } from 'node:fs';

import type { ContentFile } from '../content/validate';
import { validateContent } from '../content/validate';
import type { PlanInputsInput } from './inputs';
import { type PlanLibrary, selectPlanContent } from './content-pool';

const contentDir = new URL('../../../../content/', import.meta.url);

/** Prüfer und Datum für in-memory freigegebene Kopien. */
export const TEST_REVIEW = { reviewed_by: 'test', reviewed_at: '2026-10-18' } as const;

/**
 * Inhalt mit erzwungenem Status (in-memory): `draft` ohne Prüfer, `published` mit Prüfer und Datum (Pflicht laut
 * Schema). Ohne `status` bleibt der Inhalt unverändert.
 */
export function withStatus<T>(data: T, status?: 'draft' | 'published'): T {
  if (status === undefined) return data;
  const item = data as { status: string; meta: Record<string, unknown> };
  const review = status === 'published' ? TEST_REVIEW : { reviewed_by: null, reviewed_at: null };
  return { ...item, status, meta: { ...item.meta, ...review } } as T;
}

export function loadRepoContentFiles(
  options: { status?: 'draft' | 'published' } = {},
): ContentFile[] {
  const files: ContentFile[] = [];
  for (const [kind, folder] of [
    ['exercise', 'exercises'],
    ['plan_template', 'plan-templates'],
  ] as const) {
    const dir = new URL(`${folder}/`, contentDir);
    for (const fileName of readdirSync(dir).sort()) {
      if (!fileName.endsWith('.json')) continue;
      files.push({
        kind,
        fileName,
        data: withStatus(
          JSON.parse(readFileSync(new URL(fileName, dir), 'utf8')) as unknown,
          options.status,
        ),
      });
    }
  }
  return files;
}

let cached: PlanLibrary | undefined;

/** Startbestand (Status wie im Repository) als Bibliothek im Testmodus (Entwürfe erlaubt). */
export function repoLibrary(): PlanLibrary {
  cached ??= selectPlanContent(validateContent(loadRepoContentFiles()), { allowDrafts: true });
  return cached;
}

/** Startbestand mit erzwungenem Status als Bibliothek im Testmodus (Entwürfe erlaubt). */
export function repoLibraryWithStatus(status: 'draft' | 'published'): PlanLibrary {
  return selectPlanContent(validateContent(loadRepoContentFiles({ status })), {
    allowDrafts: true,
  });
}

/**
 * Inhalte, die erst nach dem Merge von PR #182 nach `content/` kommen (Branch claude/calisthenics-inhalte-2): die
 * Calisthenics-Vorlagen (goal_type „calisthenics“) und die Lauf-Kraft-Einheiten (Kategorie „run_strength“). Die
 * Pflichtprüfung „sources-integrity (Code von main)“ prüft `content/` mit dem Code von main, der diese Werte noch
 * nicht kennt. Bis dahin liegen unveränderte Kopien hier, damit die Logik-Tests sie weiter prüfen.
 */
const pendingDir = new URL('./test-fixtures/inhalte-folgen/', import.meta.url);

function readJsonFolder(dir: URL): { fileName: string; data: unknown }[] {
  return readdirSync(dir)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort()
    .map((fileName) => ({
      fileName,
      data: JSON.parse(readFileSync(new URL(fileName, dir), 'utf8')) as unknown,
    }));
}

/** Calisthenics-Vorlagen, die erst mit claude/calisthenics-inhalte-2 nach `content/` kommen. */
export function loadPendingTemplateFiles(): ContentFile[] {
  return readJsonFolder(new URL('plan-templates/', pendingDir)).map(({ fileName, data }) => ({
    kind: 'plan_template' as const,
    fileName,
    data,
  }));
}

/** Lauf-Kraft-Einheiten (Rohdaten), die erst mit claude/calisthenics-inhalte-2 nach `content/` kommen. */
export function loadPendingWorkoutData(): unknown[] {
  return readJsonFolder(new URL('workouts/', pendingDir)).map(({ data }) => data);
}

let cachedWithPending: PlanLibrary | undefined;

/** Startbestand plus die noch ausstehenden Calisthenics-Vorlagen als Bibliothek im Testmodus. */
export function repoLibraryWithPending(): PlanLibrary {
  if (cachedWithPending) return cachedWithPending;
  const repo = loadRepoContentFiles();
  // Gleiche Reihenfolge wie später in content/ (Vorlagen nach Dateiname sortiert).
  const templates = [
    ...repo.filter((file) => file.kind === 'plan_template'),
    ...loadPendingTemplateFiles(),
  ].sort((a, b) => (a.fileName < b.fileName ? -1 : a.fileName > b.fileName ? 1 : 0));
  cachedWithPending = selectPlanContent(
    validateContent([...repo.filter((file) => file.kind !== 'plan_template'), ...templates]),
    { allowDrafts: true },
  );
  return cachedWithPending;
}

/** Montag, 05.10.2026 – fester Stichtag für die Tests. */
export const MONDAY = '2026-10-05';

/** Kurzform für Tests: altes Zeitbudget (alle Tage Kraft am selben Ort) → Zeitplan. */
export interface LegacyBudget {
  sessionsPerWeek?: number;
  minutesPerSession?: number;
  preferredDays?: number[];
  trainingLocation?: 'gym' | 'home' | 'both';
}

/**
 * Zeitplan aus dem alten Zeitbudget: Anzahl Wunsch-Tage = Tage pro Woche → feste Tage, sonst „Tage egal“; Ort
 * zu Hause → Kraft zu Hause, sonst Kraft im Studio (wie scheduleFromLegacyGoals).
 */
export function legacySchedule(budget: LegacyBudget = {}): TrainingScheduleInput {
  const sessions = budget.sessionsPerWeek ?? 3;
  const minutes = budget.minutesPerSession ?? 60;
  const days = budget.preferredDays ?? [1, 3, 5];
  const kind = budget.trainingLocation === 'home' ? 'strength_home' : 'strength_gym';
  return days.length === sessions
    ? { mode: 'fixed', slots: days.map((weekday) => ({ weekday, kind, minutes })) }
    : { mode: 'flex', slots: Array.from({ length: sessions }, () => ({ kind, minutes })) };
}

type TrainingScheduleInput = PlanInputsInput['schedule'];

/** Standard-Person: 30 Jahre, Gesundheits-Check ohne Auffälligkeit, Studio, Muskelaufbau, Einsteiger, 3 Tage. */
export function person(overrides: Partial<PlanInputsInput> & LegacyBudget = {}): PlanInputsInput {
  const { sessionsPerWeek, minutesPerSession, preferredDays, trainingLocation, ...rest } =
    overrides;
  return {
    goalType: 'muscle_gain',
    experienceLevel: 'beginner',
    schedule: legacySchedule({
      sessionsPerWeek,
      minutesPerSession,
      preferredDays,
      trainingLocation,
    }),
    homeEquipment: [],
    birthDate: '1996-01-15',
    sex: 'female',
    healthScreening: { flags: [] },
    ...rest,
  };
}

/** Heim-Ausstattung der Zuhause-Vorlagen: Pflicht + optional. */
export const FULL_HOME = [
  { equipmentId: 'dumbbells', weightsKg: [2, 4, 6, 8, 10, 12] },
  { equipmentId: 'resistance_bands', weightsKg: [] },
  { equipmentId: 'flat_bench', weightsKg: [] },
  { equipmentId: 'pull_up_bar', weightsKg: [] },
] as const satisfies PlanInputsInput['homeEquipment'];
