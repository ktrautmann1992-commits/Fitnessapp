/**
 * Aufruf: `pnpm --filter @fitnessapp/content seed` (Workflow content-seed).
 * Prüft immer zuerst alle Inhalte; spielt nur mit SUPABASE_URL + SUPABASE_SECRET_KEY ein.
 * Würde mehr als die Hälfte des freigegebenen Bestands archiviert, bricht es ab – außer ALLOW_MASS_ARCHIVE=true.
 */
import { main, repoRootOrFail, writeReport } from './cli';
import { parseBooleanFlag } from './pipeline/config';
import { runSeed } from './pipeline/seed';

void main('content-seed', async () => {
  const result = await runSeed({
    repoRoot: repoRootOrFail(),
    env: {
      ...(process.env.SUPABASE_URL ? { url: process.env.SUPABASE_URL } : {}),
      ...(process.env.SUPABASE_SECRET_KEY ? { secretKey: process.env.SUPABASE_SECRET_KEY } : {}),
      // Nur bei „Run workflow“ per Hand mit Häkchen allow_mass_archive (siehe content-seed.yml).
      allowMassArchive: parseBooleanFlag(process.env.ALLOW_MASS_ARCHIVE),
    },
  });
  writeReport(result.markdown);
  return result.exitCode;
});
