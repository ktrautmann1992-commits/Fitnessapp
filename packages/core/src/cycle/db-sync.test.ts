/**
 * Zyklus-Modul: Core (packages/core/src/cycle) und Datenbank (supabase/migrations/20261021140*) nutzen dieselben
 * Listen und Grenzen (docs/PLAN-PHASE-9.md 6.6). Eigene Datei neben dem großen db-sync.test.ts.
 */
import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CURRENT_CONSENT_VERSIONS } from '../consent';
import { CYCLE_RULES } from '../constants';
import {
  CYCLE_BLEEDING_LEVELS,
  CYCLE_DISMISSIBLE_CODES,
  CYCLE_LAST_PERIOD_ANSWERS,
  CYCLE_STATUSES,
  CYCLE_SYMPTOM_INTENSITIES,
  CYCLE_SYMPTOMS,
  defaultCycleSettings,
} from './schemas';

const dir = new URL('../../../../supabase/migrations/', import.meta.url);
const read = (suffix: string) => {
  const name = readdirSync(dir).find((n) => n.endsWith(suffix));
  if (!name) throw new Error(`Migration *${suffix} fehlt`);
  return readFileSync(new URL(name, dir), 'utf8');
};
const basics = read('_cycle_module.sql');
const rpcs = read('_cycle_rpcs.sql');

/** '…'-Werte in der Klammer nach `marker`. */
function listAfter(sql: string, marker: string): string[] {
  const start = sql.indexOf(marker);
  if (start < 0) throw new Error(`„${marker}“ nicht gefunden`);
  const close = sql.indexOf(marker.endsWith('[') ? ']' : ')', start + marker.length);
  return [...sql.slice(start + marker.length, close).matchAll(/'([^']+)'/g)].map(
    (m) => m[1] as string,
  );
}

describe('Zyklus: Core ⇄ Datenbank', () => {
  it('Listen der Server-Prüfung = Zod-Listen', () => {
    expect(listAfter(rpcs, "(v #>> '{}') not in (")).toEqual([...CYCLE_BLEEDING_LEVELS]);
    expect(listAfter(rpcs, 'where s.key not in (')).toEqual([...CYCLE_SYMPTOMS]);
    expect(listAfter(rpcs, "(s.value #>> '{}') not in (")).toEqual([...CYCLE_SYMPTOM_INTENSITIES]);
    expect(listAfter(rpcs, "(p ->> 'status') not in (")).toEqual([...CYCLE_STATUSES]);
    expect(listAfter(rpcs, "(p ->> 'lastPeriodAtStart') not in (")).toEqual([
      ...CYCLE_LAST_PERIOD_ANSWERS,
    ]);
    expect(listAfter(rpcs, 'where d.key not in (')).toEqual([...CYCLE_DISMISSIBLE_CODES]);
  });

  it('Schlüssel der Einstellungen = Felder von cycleSettingsSchema (strict)', () => {
    const keys = listAfter(rpcs, '<> array[');
    expect(keys).toEqual(Object.keys(defaultCycleSettings()).sort());
  });

  it('Grenzwerte', () => {
    expect(rpcs).toContain(`backfill_days constant integer := ${CYCLE_RULES.backfillDays};`);
    expect(rpcs).toContain(`max_writes constant integer := ${CYCLE_RULES.writesPerDay};`);
    expect(rpcs).toContain(`max_range constant integer := ${CYCLE_RULES.maxRangeDays};`);
    expect(rpcs).toContain(`interval '${CYCLE_RULES.retentionMonths} months'`);
  });

  it('Einwilligungstext cycle_data in der aktuellen Version', () => {
    expect(basics).toMatch(
      new RegExp(`\\(\\s*'cycle_data',\\s*${CURRENT_CONSENT_VERSIONS.cycle_data},`),
    );
    expect(basics).toContain('nicht zur Verhütung oder Familienplanung geeignet');
  });

  it('CHECK cycle_module_interest: nicht „männlich“ (wie sexStepSchema)', () => {
    expect(basics).toContain(
      "check (cycle_module_interest is null or coalesce(sex <> 'male', false))",
    );
  });
});
