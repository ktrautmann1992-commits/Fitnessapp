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

/** Standard-Person: 30 Jahre, Gesundheits-Check ohne Auffälligkeit, Studio, Muskelaufbau, Einsteiger, 3 Tage. */
export function person(overrides: Partial<PlanInputsInput> = {}): PlanInputsInput {
  return {
    goalType: 'muscle_gain',
    experienceLevel: 'beginner',
    sessionsPerWeek: 3,
    minutesPerSession: 60,
    preferredDays: [1, 3, 5],
    trainingLocation: 'gym',
    homeEquipment: [],
    birthDate: '1996-01-15',
    sex: 'female',
    healthScreening: { flags: [] },
    ...overrides,
  };
}

/** Heim-Ausstattung der Zuhause-Vorlagen: Pflicht + optional. */
export const FULL_HOME = [
  { equipmentId: 'dumbbells', weightsKg: [2, 4, 6, 8, 10, 12] },
  { equipmentId: 'resistance_bands', weightsKg: [] },
  { equipmentId: 'flat_bench', weightsKg: [] },
  { equipmentId: 'pull_up_bar', weightsKg: [] },
] as const satisfies PlanInputsInput['homeEquipment'];
