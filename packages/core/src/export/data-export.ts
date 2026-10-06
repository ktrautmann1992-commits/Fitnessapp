import { z } from 'zod';

/**
 * Datenexport „Meine Daten“ (Recht auf Auskunft, Art. 15 DSGVO; docs/PLAN-PHASE-4.md 3.7, Frage 8, W9): Aufbau und
 * Prüfung der JSON-Datei. Die Daten liefert die Datenbank-Funktion export_my_data() (bzw. im Testmodus der
 * Gerätespeicher in derselben Form); die App ergänzt nur die Konto-E-Mail (export_my_data ist security invoker und
 * liest auth.users nicht). Keine Auswertung, keine Umformung der Zeilen.
 */

/**
 * Alle Tabellen in `data` – genau die Schlüssel von export_my_data() (Abgleich in db-sync.test.ts; pgTAP prüft dort
 * zusätzlich, dass jede public-Tabelle mit Fremdschlüssel auf auth.users enthalten ist, H-f).
 */
export const DATA_EXPORT_TABLES = [
  'profiles',
  'consents',
  'body_metrics',
  'body_measurements',
  'measurement_reminders',
  'health_screening',
  'goals',
  'user_equipment',
  'training_slots',
  'nutrition_prefs',
  'food_preferences',
  'admin_users',
  'user_plans',
  'planned_sessions',
  'planned_exercises',
  'session_logs',
  'exercise_logs',
  'set_logs',
  'cardio_logs',
  'exercise_start_weights',
] as const;

export type DataExportTable = (typeof DATA_EXPORT_TABLES)[number];

/** Format der Datei (= export_my_data().format_version). */
export const DATA_EXPORT_FORMAT_VERSION = 1;

const exportRowSchema = z.record(z.string(), z.unknown());
const exportTableSchema = z.array(exportRowSchema);

const tableShape = Object.fromEntries(
  DATA_EXPORT_TABLES.map((table) => [table, exportTableSchema] as const),
) as Record<DataExportTable, typeof exportTableSchema>;

/**
 * Antwort von export_my_data() an der Grenze prüfen (Zod): alle bekannten Tabellen als Listen von Zeilen. Kommt mit
 * einer neueren Datenbank eine Tabelle dazu, bleibt sie im Export (catchall) – die Datei soll nie Daten verlieren.
 */
export const dataExportSchema = z.strictObject({
  format_version: z.literal(DATA_EXPORT_FORMAT_VERSION),
  exported_at: z.string().min(1),
  user_id: z.string().min(1),
  data: z.object(tableShape).catchall(exportTableSchema),
});

export type DataExport = z.infer<typeof dataExportSchema>;

/** Die gespeicherte Datei: Server-Export plus Konto-E-Mail. */
export interface DataExportFile {
  readonly format_version: number;
  readonly exported_at: string;
  readonly user_id: string;
  /** Konto (aus der Anmeldung; im Testmodus ohne E-Mail). */
  readonly account: { readonly email: string | null };
  readonly data: DataExport['data'];
}

/** Export prüfen und mit der Konto-E-Mail zur Datei zusammensetzen; null = Antwort ungültig. */
export function buildDataExportFile(
  raw: unknown,
  account: { readonly email: string | null },
): DataExportFile | null {
  const parsed = dataExportSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    format_version: parsed.data.format_version,
    exported_at: parsed.data.exported_at,
    user_id: parsed.data.user_id,
    account: { email: account.email },
    data: parsed.data.data,
  };
}

/** Dateiname mit Datum, z. B. „alpha5-meine-daten-2026-10-07.json“ (ohne Namen oder E-Mail). */
export function dataExportFileName(today: string): string {
  return `alpha5-meine-daten-${today}.json`;
}

/** Inhalt der Datei (lesbar eingerückt). */
export function dataExportJson(file: DataExportFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}
