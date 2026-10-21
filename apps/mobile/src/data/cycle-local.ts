import {
  addDays,
  cycleEntrySchema,
  cycleExportTables,
  cycleSettingsSchema,
  type CycleEntry,
  type CycleEntryPayload,
} from '@fitnessapp/core';
import { z } from 'zod';

import { CycleError, mergeEntries, type CycleBackend, type CycleSnapshot } from './cycle-backend';
import type { CycleStores } from './cycle-store-keys';

/**
 * Zyklus-Modul im TESTMODUS (Plan 9.3): dieselben Regeln wie die Server-Funktionen, aber alles im geschützten
 * Speicher `cycleCache` (Browser: nur sessionStorage – endet mit dem Tab; App: verschlüsselt). Keine Freischaltung
 * nötig (der Testmodus bleibt offen, 7.2a). Schalter „Beispieldaten“ und „Warnungen aus“ nur hier.
 */
const localStateSchema = z.object({
  settings: cycleSettingsSchema.nullable(),
  entries: z.array(cycleEntrySchema),
  warningsOff: z.boolean(),
});
type LocalState = z.infer<typeof localStateSchema>;

const EMPTY: LocalState = { settings: null, entries: [], warningsOff: false };

export function createLocalCycle(stores: Pick<CycleStores, 'cycleCache'>): CycleBackend {
  const store = stores.cycleCache;

  async function read(): Promise<LocalState> {
    const raw = await store.read();
    if (raw === null) return EMPTY;
    try {
      const parsed = localStateSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : EMPTY;
    } catch {
      return EMPTY;
    }
  }
  const write = (state: LocalState) => store.write(JSON.stringify(state));

  return {
    mode: 'local',
    access: async () => ({ open: true, warnings: !(await read()).warningsOff }),
    async load(): Promise<CycleSnapshot> {
      const state = await read();
      return { settings: state.settings, entries: state.entries, pending: 0, offline: false };
    },
    async saveEntry(entry, consentGrantedAt) {
      if (!consentGrantedAt) throw new CycleError('cycle_consent_missing');
      if (!cycleEntrySchema.safeParse(entry).success) throw new CycleError('cycle_payload_invalid');
      const state = await read();
      await write({ ...state, entries: mergeEntries(state.entries, [entry]) });
      return 'saved';
    },
    async deleteEntry(date) {
      const state = await read();
      await write({ ...state, entries: state.entries.filter((e) => e.date !== date) });
    },
    async deleteAllEntries() {
      const state = await read();
      await write({ ...state, entries: [] });
    },
    async saveSettings(settings, consentGrantedAt) {
      if (!consentGrantedAt) throw new CycleError('cycle_consent_missing');
      if (!cycleSettingsSchema.safeParse(settings).success) {
        throw new CycleError('cycle_payload_invalid');
      }
      await write({ ...(await read()), settings });
    },
    async exportTables() {
      const state = await read();
      return cycleExportTables({
        settings: state.settings,
        entries: state.entries.map((e) => ({ entry_date: e.date, ...e.payload })),
      });
    },
    flush: async () => undefined,
    clearDevice: () => store.clear(),
    testMode: {
      async loadSampleData(today) {
        const state = await read();
        await write({ ...state, entries: mergeEntries(sampleCycleEntries(today), state.entries) });
      },
      async setWarningsOff(off) {
        await write({ ...(await read()), warningsOff: off });
      },
    },
  };
}

/**
 * Beispieldaten (Plan 9.3): 90 Tage mit Lücken – zwei Perioden mit starker Blutung (Eisen-Hinweis, W4), dazu
 * Energie und Beschwerden. Die letzte Periode endet über 30 Tage vor heute (kein Ausbleiben-Alarm nach 90 Tagen).
 */
export function sampleCycleEntries(today: string): CycleEntry[] {
  const entries: CycleEntry[] = [];
  const start = addDays(today, -89);
  for (let i = 0; i < 90; i += 1) {
    // Lücken: jeden 4. Tag kein Eintrag, außer in der Periode.
    const dayInCycle = i % 29;
    const inPeriod = dayInCycle < 5;
    if (!inPeriod && i % 4 === 3) continue;
    const payload: CycleEntryPayload = inPeriod
      ? {
          bleeding: dayInCycle < 3 ? 'heavy' : 'light',
          energy: dayInCycle < 2 ? 2 : 3,
          symptoms: dayInCycle < 2 ? { cramps: 'strong' } : { cramps: 'mild' },
        }
      : { bleeding: 'none', energy: 3 + (i % 3 === 0 ? 1 : 0) };
    entries.push({ date: addDays(start, i), payload });
  }
  return entries;
}
