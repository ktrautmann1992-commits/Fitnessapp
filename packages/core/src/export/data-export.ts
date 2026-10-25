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
  // Phase 5 · Ernährung (Etappe N7)
  'meal_plans',
  'meal_plan_items',
  'shopping_lists',
  'shopping_list_items',
  'recipe_ratings',
  'food_dislikes',
  // Etappe E1 · Ernährungstagebuch (docs/PLAN-AUSWERTUNG.md Abschnitt 5)
  'food_log_entries',
  'food_log_favorites',
  // Etappe E2 · Eigene Gerichte (docs/PLAN-AUSWERTUNG.md Abschnitt 7)
  'custom_meals',
  'custom_meal_items',
  // Phase 10 · Etappe WP3 · Wettkämpfe (docs/PLAN-PHASE-10.md Abschnitt 7, inkl. Plan-Bezug)
  'competitions',
  // Etappe E3 · Gericht per Foto: KI-Nutzung (nur Metadaten) und die eigene Beta-Freischaltung (private-Tabelle,
  // ohne granted_by – Art. 15 erfasst alle personenbezogenen Daten, PLAN-PHASE-4B 4.7)
  'ai_usage',
  'beta_entitlements',
  // Wächter E3 N4: Protokoll der eigenen Freischaltungen (ohne Admin-Identität)
  'admin_actions',
  // Phase 10 · Etappe S1 · eigene Strecken (docs/PLAN-PHASE-10.md 12/13; GPX je Strecke erzeugt die App)
  'tracked_routes',
  // Etappe E4a · eigene Produkte und die eigenen Abfrage-Zähler der Produktabfrage (ohne Nummern; docs/PLAN-E4.md
  // 3.6) – der gemeinsame Zwischenspeicher food_products gehört niemandem und ist nicht dabei
  'user_food_products',
  'food_product_lookup_counts',
  // Ziele · Etappe Z3 · Wunschgewicht (docs/PLAN-ZIELE.md 5.2; Gesundheitsdatum, das Nebenziel steht in goals)
  'weight_goals',
  // Phase 4b · Etappe B · Live-Anpassung (docs/PLAN-PHASE-4B.md 4.7, Wächter K4): Plan-Anpassungen, offene Ereignisse
  // (Auslöser und Zeitpunkte, ohne Verweise) und die eigenen Zähler der Ratenbegrenzung (private Tabellen)
  'plan_adjustments',
  'adjustment_events',
  'live_adjust_hourly_counts',
  // Einkaufen · Etappe E1 (docs/PLAN-EINKAUFEN-AUSDAUER.md 3): gelernte Zuordnungen Strichcode → Lebensmittel (sensibel
  // wie Produkt-Favoriten, beim Widerruf gelöscht)
  'shopping_product_links',
  // Etappe E2 (docs/PLAN-EINKAUFEN-AUSDAUER.md 4): Anordnung der Übersicht und der Menüleiste (kein Gesundheitsdatum)
  'app_layout_settings',
  // Phase 8 (docs/PLAN-PHASE-8.md 4): Smartwatch-Verbindung, übernommene Einheiten, Puls-Zusammenfassungen (Art. 9),
  // Tageswerte (Art. 9)
  'wearable_connections',
  'wearable_sessions',
  'heart_rate_summaries',
  'daily_metrics',
  // Phase 6 · Etappe SU3 (docs/PLAN-PHASE-6.md 7.3): Supplement-Check und „Meine Supplements“ (Gesundheitsdaten, beim
  // Widerruf gelöscht)
  'supplement_screening',
  'user_supplements',
  // Rezept-Favoriten (Gründer-Freigabe 25.10.2026, KONZEPT 6.10a): „Lieblingsgericht“/„Nie wieder“ je Rezept (kein
  // Gesundheitsdatum, bleibt beim Widerruf)
  'recipe_preferences',
] as const;

export type DataExportTable = (typeof DATA_EXPORT_TABLES)[number];

/**
 * Tabellen, die der TESTMODUS schon exportiert, die Datenbank (export_my_data) aber erst mit der Supabase-Etappe:
 * `exercise_preferences` (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 9, Etappe T2; Migration und export_my_data in T3) –
 * dann nach DATA_EXPORT_TABLES verschieben (`plan_adjustments` steht seit 4b Etappe B in export_my_data() und damit in
 * DATA_EXPORT_TABLES). Die Ernährungs-Tabellen (meal_plans, meal_plan_items, shopping_lists,
 * shopping_list_items, recipe_ratings, food_dislikes) stehen seit Etappe N7 in DATA_EXPORT_TABLES. Die Prüfung der
 * Datei lässt ausstehende Tabellen über `catchall` zu.
 */
export const PENDING_DB_EXPORT_TABLES = ['exercise_preferences'] as const;

export type PendingDbExportTable = (typeof PENDING_DB_EXPORT_TABLES)[number];

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
