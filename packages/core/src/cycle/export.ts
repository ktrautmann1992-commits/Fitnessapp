import { z } from 'zod';

import { isoDateSchema } from '../age';
import { cycleEntryPayloadSchema, cycleSettingsSchema } from './schemas';

/**
 * Zyklusdaten im Datenexport (Art. 15/20, docs/PLAN-PHASE-9.md 7.5): Einstellungen und alle Einträge entschlüsselt,
 * ohne `key_version`. Die Datenbank liefert sie über `public.export_my_cycle_data()` (eigene Funktion statt eines
 * Blocks in export_my_data(), damit parallele Fassungen von export_my_data sie nicht überschreiben); die App hängt
 * sie als Tabellen `cycle_settings` und `cycle_entries` an die Export-Datei. Ohne Einwilligung und ohne Daten fehlen
 * beide Tabellen. Der Export bleibt eine lokale Datei ohne Teilen-Dialog.
 */
export const CYCLE_EXPORT_TABLES = ['cycle_settings', 'cycle_entries'] as const;
export type CycleExportTable = (typeof CYCLE_EXPORT_TABLES)[number];

const serverSchema = z.object({
  settings: z.object({ payload: z.unknown(), updated_at: z.string() }).nullable(),
  entries: z.array(
    z.object({ entry_date: isoDateSchema, payload: z.unknown(), updated_at: z.string() }),
  ),
});

/**
 * Antwort von export_my_cycle_data() → Block. Ungültige Einzelzeilen bleiben trotzdem im Export (nie Daten
 * verlieren): Die Rohform wird dann unverändert übernommen.
 */
export function parseCycleExport(data: unknown): {
  settings: unknown;
  entries: readonly unknown[];
} | null {
  const parsed = serverSchema.safeParse(data);
  if (!parsed.success) return null;
  return {
    settings:
      parsed.data.settings === null
        ? null
        : {
            ...(cycleSettingsSchema.safeParse(parsed.data.settings.payload).data ??
              (parsed.data.settings.payload as object)),
            updated_at: parsed.data.settings.updated_at,
          },
    entries: parsed.data.entries.map((row) => ({
      entry_date: row.entry_date,
      ...(cycleEntryPayloadSchema.safeParse(row.payload).data ?? (row.payload as object)),
      updated_at: row.updated_at,
    })),
  };
}

/** Tabellen für die Export-Datei (leere Listen fallen weg, damit „keine Zyklusdaten“ eindeutig ist). */
export function cycleExportTables(block: {
  settings: unknown;
  entries: readonly unknown[];
}): Partial<Record<CycleExportTable, unknown[]>> {
  const tables: Partial<Record<CycleExportTable, unknown[]>> = {};
  if (block.settings !== null) tables.cycle_settings = [block.settings];
  if (block.entries.length > 0) tables.cycle_entries = [...block.entries];
  return tables;
}
