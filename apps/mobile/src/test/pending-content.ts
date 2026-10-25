import { readdirSync, readFileSync } from 'node:fs';

import type { WorkoutContentFile } from '@fitnessapp/core';

/**
 * Testhilfe (nur in *.test.ts): Die 4 Lauf-Kraft-Einheiten (Kategorie „run_strength“) kommen erst nach dem Merge von
 * PR #182 mit dem Branch claude/calisthenics-inhalte-2 nach `content/workouts` – die Pflichtprüfung
 * „sources-integrity (Code von main)“ kennt die Kategorie bis dahin nicht. Bis dahin fehlen sie im Bündel (die App
 * blendet den Lauf-Kraft-Block dann aus); die Logik-Tests nutzen die unveränderten Kopien aus packages/core.
 */
const dir = new URL(
  '../../../../packages/core/src/plan/test-fixtures/inhalte-folgen/workouts/',
  import.meta.url,
);

export function pendingRunStrengthWorkoutFiles(): WorkoutContentFile[] {
  return readdirSync(dir)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort()
    .map((fileName) => ({
      kind: 'workout' as const,
      fileName,
      data: JSON.parse(readFileSync(new URL(fileName, dir), 'utf8')) as unknown,
    }));
}
