/**
 * Schreibt `supabase/tests/50_week_invariants.test.sql` aus `invariants.json` neu (Etappe B). Danach prüft
 * db-sync.test.ts, dass die Datei aktuell ist. Aufruf:
 * `pnpm --filter @fitnessapp/content exec tsx ../core/src/adjust/fixtures/write-invariant-sql.ts`.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import type { InvariantFixture } from './invariant-cases';
import { weekInvariantsTestSql } from './invariants-sql';

const fixtures = JSON.parse(
  readFileSync(new URL('./invariants.json', import.meta.url), 'utf8'),
) as InvariantFixture[];
const target = new URL(
  '../../../../../supabase/tests/50_week_invariants.test.sql',
  import.meta.url,
);
writeFileSync(target, weekInvariantsTestSql(fixtures));
process.stdout.write('50_week_invariants.test.sql geschrieben\n');
