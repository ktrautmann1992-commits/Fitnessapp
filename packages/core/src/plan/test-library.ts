/**
 * Testhilfe (nur in *.test.ts): lädt den echten Inhaltsstand aus `content/` und prüft ihn mit validateContent –
 * so laufen die Plan-Tests gegen die 52 Übungen und 24 Vorlagen des Startbestands (alle `draft`).
 */
import { readdirSync, readFileSync } from 'node:fs';

import type { ContentFile } from '../content/validate';
import { validateContent } from '../content/validate';
import type { PlanInputsInput } from './inputs';
import { type PlanLibrary, selectPlanContent } from './content-pool';

const contentDir = new URL('../../../../content/', import.meta.url);

export function loadRepoContentFiles(): ContentFile[] {
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
        data: JSON.parse(readFileSync(new URL(fileName, dir), 'utf8')),
      });
    }
  }
  return files;
}

let cached: PlanLibrary | undefined;

/** Startbestand als Bibliothek im Testmodus (Entwürfe erlaubt). */
export function repoLibrary(): PlanLibrary {
  cached ??= selectPlanContent(validateContent(loadRepoContentFiles()), { allowDrafts: true });
  return cached;
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
