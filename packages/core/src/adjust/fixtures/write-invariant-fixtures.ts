/**
 * Schreibt `invariants.json` neu. Die Fälle werden aus ECHTEN Plänen erzeugt (Inhaltsstand `content/`, Plan-Engine,
 * Tausch-Regel) – die Datei ist also an den Inhaltsstand und die Engine gekoppelt: Ändert sich eine Übung, eine Vorlage
 * oder die Plan-Engine, meldet `invariants.test.ts` („die Datei ist aktuell“) eine Abweichung. Dann:
 * 1. prüfen, dass die festgehaltenen Verstoß-Codes (`expected`) gleich geblieben sind (gültige Fälle bleiben gültig,
 *    verletzte bleiben verletzt – sonst ist die Änderung fachlich zu klären),
 * 2. neu schreiben: `pnpm --filter @fitnessapp/content exec tsx ../core/src/adjust/fixtures/write-invariant-fixtures.ts`,
 *    danach `pnpm exec prettier --write packages/core/src/adjust/fixtures/invariants.json`,
 * 3. auch `supabase/tests/50_week_invariants.test.sql` neu erzeugen (`write-invariant-sql.ts`, db-sync prüft die Aktualität).
 * Eine eingefrorene Mini-Bibliothek wäre unabhängiger, hängt aber an denselben Plan-Funktionen; bewusst nicht gewählt,
 * damit die Fixtures echte, heute erzeugbare Pläne zeigen.
 */
import { writeFileSync } from 'node:fs';

import { buildInvariantFixtures } from './invariant-cases';

const target = new URL('./invariants.json', import.meta.url);
writeFileSync(target, `${JSON.stringify(buildInvariantFixtures(), null, 2)}\n`);
process.stdout.write(`invariants.json geschrieben\n`);
