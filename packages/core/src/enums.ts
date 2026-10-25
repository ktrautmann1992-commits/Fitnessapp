/**
 * Aufzählungen, die 1:1 den Postgres-Enums in supabase/migrations entsprechen
 * (Phase 1: 20261003120000_phase1_basics.sql, Phase 2: 20261003130000/20261003130200).
 * `db-sync.test.ts` prüft, dass beide Seiten übereinstimmen.
 */

/** Geschlecht. „diverse“/„unspecified“: Kalorienformeln nehmen später den Mittelwert (Frage 9). */
export const SEX_OPTIONS = ['male', 'female', 'diverse', 'unspecified'] as const;
export type Sex = (typeof SEX_OPTIONS)[number];

/** Trainingserfahrung: Einsteiger / Fortgeschritten / Leistungssport. */
export const EXPERIENCE_LEVELS = ['beginner', 'advanced', 'competitive'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/** Unterstützte Sprachvarianten (Deutsch als Standard, Englisch vorbereitet). */
export const APP_LOCALES = ['de-DE', 'de-AT', 'de-CH'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'de-DE';

/**
 * Einwilligungsarten (getrennt, versioniert). `ai_food_photo` seit Etappe E3 (Gericht per Foto, Art. 9 +
 * Übermittlung an Google als Auftragsverarbeiter – eigene, getrennte Einwilligung, docs/PLAN-AUSWERTUNG.md 2.7).
 * `wearable_data` seit Phase 8 (Smartwatch-Daten über Health Connect, W8-5, docs/PLAN-PHASE-8.md 4) – getrennt von
 * `health_data`, setzt diese aber zusätzlich voraus.
 */
export const CONSENT_TYPES = [
  'terms',
  'privacy',
  'health_data',
  'cycle_data',
  'ai_food_photo',
  'wearable_data',
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

/** Gerät, auf dem eine Einwilligung erteilt wurde. */
export const CONSENT_PLATFORMS = ['ios', 'android', 'web'] as const;
export type ConsentPlatform = (typeof CONSENT_PLATFORMS)[number];

/**
 * Trainingsziel. `active_aging` = „Fit im Alter“ (docs/PLAN-FIT-IM-ALTER.md, Etappe FA1; Datenbank per
 * `alter type … add value` in 20261021150000_active_aging_enums.sql).
 */
export const GOAL_TYPES = [
  'fat_loss',
  'definition',
  'muscle_gain',
  'general_fitness',
  'endurance',
  'active_aging',
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

/** Ausdauer-Disziplin (nur beim Ziel „endurance“). */
export const ENDURANCE_DISCIPLINES = [
  '5k',
  '10k',
  'half_marathon',
  'marathon',
  'triathlon_sprint',
  'triathlon_olympic',
  'triathlon_middle',
  'triathlon_long',
  'cycling',
  'swimming',
] as const;
export type EnduranceDiscipline = (typeof ENDURANCE_DISCIPLINES)[number];

/** Trainingsort: Studio / Zuhause / beides. */
export const TRAINING_LOCATIONS = ['gym', 'home', 'both'] as const;
export type TrainingLocation = (typeof TRAINING_LOCATIONS)[number];

/**
 * Trainingsart eines Trainingstags (Tabelle `training_slots`, Erweiterungsplan Abschnitt 4.1): Kraft im Studio,
 * Kraft zu Hause, Ausdauer (Disziplin aus dem Ziel). Reihenfolge = Anzeige-Reihenfolge.
 */
export const TRAINING_SLOT_KINDS = ['strength_gym', 'strength_home', 'endurance'] as const;
export type TrainingSlotKind = (typeof TRAINING_SLOT_KINDS)[number];

/** Ort eines Geräts. */
export const EQUIPMENT_LOCATIONS = ['home', 'gym'] as const;
export type EquipmentLocation = (typeof EQUIPMENT_LOCATIONS)[number];

/** Geräte-Kategorie im Katalog. */
export const EQUIPMENT_CATEGORIES = [
  'free_weights',
  'bench',
  'bodyweight',
  'bands',
  'cardio',
  'other',
  // Phase 2: Maschinen und Kabelzug (nur Studio), per `alter type … add value` ergänzt.
  'machines',
] as const;
export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

/** Ernährungsform. */
export const DIET_TYPES = ['omnivore', 'vegetarian', 'vegan'] as const;
export type DietType = (typeof DIET_TYPES)[number];

/** Kochmodus: täglich frisch / Meal-Prep. */
export const COOKING_MODES = ['daily', 'meal_prep'] as const;
export type CookingMode = (typeof COOKING_MODES)[number];

/** Art einer Lebensmittel-Vorliebe. „intolerance“ ist ein Gesundheitsdatum (Art. 9 DSGVO). */
export const FOOD_PREFERENCE_KINDS = ['like', 'dislike', 'intolerance'] as const;
export type FoodPreferenceKind = (typeof FOOD_PREFERENCE_KINDS)[number];

/**
 * Ausschluss einer Übung an einem Ort (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 5.1, D-1): „Mag ich nicht“ (weich) bzw.
 * „Hier nicht machbar“ (hart, Ort/Ausstattung). Bewusst KEIN Gesundheitsgrund – kein Gesundheitsdatum.
 * Datenbank-Enum `public.exercise_preference_kind` folgt in Etappe T3.
 */
export const EXERCISE_PREFERENCE_KINDS = ['dislike', 'not_feasible'] as const;
export type ExercisePreferenceKind = (typeof EXERCISE_PREFERENCE_KINDS)[number];

// ---------------------------------------------------------------------------------------------------------
// Phase 2 · Inhalte (Übungsbibliothek und Plan-Vorlagen), docs/PLAN-PHASE-2.md Abschnitt 5
// ---------------------------------------------------------------------------------------------------------

/** Status eines Inhalts: Entwurf / freigegeben / zurückgezogen. In der Datenbank liegt nie ein Entwurf. */
export const CONTENT_STATUSES = ['draft', 'published', 'archived'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Bewegungsmuster. Alternativen einer Übung müssen dasselbe Muster haben (Regel Ü4). */
export const MOVEMENT_PATTERNS = [
  'squat',
  'hinge',
  'lunge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'elbow_flexion',
  'elbow_extension',
  'shoulder_isolation',
  'knee_flexion',
  'knee_extension',
  'hip_extension',
  'calf_raise',
  'core_anti_extension',
  'core_anti_rotation',
  'core_flexion',
  'carry',
  'conditioning',
  'mobility',
  // Fit im Alter (FA1, docs/PLAN-FIT-IM-ALTER.md 13.1): Gleichgewicht – per `alter type … add value`.
  'balance',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

/** Muskelgruppen (für Wochensätze pro Muskelgruppe, Regeln V9–V11). */
export const MUSCLE_GROUPS = [
  'chest',
  'lats',
  'upper_back',
  'front_delts',
  'side_delts',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'lower_back',
  'glutes',
  'quadriceps',
  'hamstrings',
  'adductors',
  'calves',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** Grundübung (mehrgelenkig) oder Isolationsübung (eingelenkig) – bestimmt die Pausen-Regel V5. */
export const EXERCISE_MECHANICS = ['compound', 'isolation'] as const;
export type ExerciseMechanics = (typeof EXERCISE_MECHANICS)[number];

/** Art der Belastung: Zusatzgewicht, Körpergewicht, Band oder Zeit (Halteübung). */
export const LOAD_TYPES = ['weight', 'bodyweight', 'band', 'time'] as const;
export type LoadType = (typeof LOAD_TYPES)[number];

/**
 * Merkmale einer Übung für vorsichtigere Pläne (Flag `conservative_plan`, Phase 3) – Eigenschaften der Übung,
 * KEINE Diagnosen: Sprünge, schwere Last auf der Wirbelsäule, über Kopf, lange Rückenlage, hohe Technik.
 * Fit im Alter (FA1, docs/PLAN-FIT-IM-ALTER.md 13.1, per `alter type … add value`):
 * - `floor_transfer`: beginnt oder endet am Boden (Liegen, Knien, Vierfüßler, Stütz am Boden) – nicht an Wand/Tisch,
 * - `spinal_flexion`: Rumpfbeugung bis zum Bewegungsende (mit oder ohne Last),
 * - `loaded_flexion`: Rumpfbeugen unter Last (Teilmenge von spinal_flexion, für klare Texte),
 * - `trunk_rotation`: Drehen bis zum Anschlag oder schnelles Drehen,
 * - `deep_hip_flexion`: Hüftbeugung über 90° (tiefer Stuhl, tiefe Kniebeuge),
 * - `hip_cross_midline`: Bein über die Körpermitte oder Einwärtsdrehen der Hüfte.
 * Welche bestehenden Übungen die neuen Merkmale bekommen, regelt Etappe FA2 (Plan 13.4).
 */
export const CAUTION_TAGS = [
  'high_impact',
  'spinal_loading',
  'overhead',
  'long_supine',
  'high_skill',
  'floor_transfer',
  'spinal_flexion',
  'loaded_flexion',
  'trunk_rotation',
  'deep_hip_flexion',
  'hip_cross_midline',
] as const;
export type CautionTag = (typeof CAUTION_TAGS)[number];

/** Grund einer Alternative: anderes Gerät / leichter / schwerer / für Zuhause. */
export const ALTERNATIVE_REASONS = ['other_equipment', 'easier', 'harder', 'home'] as const;
export type AlternativeReason = (typeof ALTERNATIVE_REASONS)[number];

/**
 * Schwerpunkt einer Einheit in einer Plan-Vorlage. `balance` (Fit im Alter, Variante B aus docs/PLAN-FIT-IM-ALTER.md
 * 7.3): leichte Kraft-Einheit mit Schwerpunkt Gleichgewicht (`kind = 'strength'`, keine neue Einheit-Art) – per
 * `alter type … add value` in einer eigenen Migrationsdatei.
 */
export const SESSION_FOCUSES = ['full_body', 'upper', 'lower', 'balance'] as const;
export type SessionFocus = (typeof SESSION_FOCUSES)[number];

/** Rolle im Redaktionsbereich (Tabelle admin_users). */
export const ADMIN_ROLES = ['content_admin'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/**
 * Herkunft eines Inhalts (Feld `meta.origin`, kein Postgres-Enum – steht in `meta` jsonb):
 * Startbestand aus der Umsetzungs-Sitzung, Claude Message Batches API oder von Hand.
 */
export const CONTENT_ORIGINS = ['claude_session', 'batch', 'manual'] as const;
export type ContentOrigin = (typeof CONTENT_ORIGINS)[number];

/** Ziele mit Plan-Vorlagen (Matrix Phase 2, Abschnitt 14 Frage 1). „definition“ nutzt Muskelaufbau. */
export const TEMPLATE_GOAL_TYPES = ['muscle_gain', 'fat_loss', 'general_fitness'] as const;
export type TemplateGoalType = (typeof TEMPLATE_GOAL_TYPES)[number];

/** Level mit Plan-Vorlagen (Abschnitt 14 Frage 2). „competitive“ nutzt vorerst „advanced“. */
export const TEMPLATE_EXPERIENCE_LEVELS = ['beginner', 'advanced'] as const;
export type TemplateExperienceLevel = (typeof TEMPLATE_EXPERIENCE_LEVELS)[number];

// ---------------------------------------------------------------------------------------------------------
// Phase 3 · Plan-Engine (docs/PLAN-PHASE-3.md Abschnitt 8). Postgres-Enums folgen in Etappe B (db-sync.test.ts).
// ---------------------------------------------------------------------------------------------------------

/** Status eines Nutzerplans: aktiv oder ersetzt. */
export const PLAN_STATUSES = ['active', 'replaced'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

/**
 * Status einer geplanten Einheit. `completed` (ab Phase 4) setzt nur der Server über save_session_log; Nutzer
 * dürfen direkt nur `planned`/`skipped` setzen (Verschiebe-Trigger, PLAN-PHASE-4 W1).
 */
export const PLANNED_SESSION_STATUSES = ['planned', 'skipped', 'completed'] as const;
export type PlannedSessionStatus = (typeof PLANNED_SESSION_STATUSES)[number];

/** Güte des Vorlagen-Matchings: passt genau / mit Anpassungen / nächstbeste Vorlage. */
export const PLAN_MATCH_QUALITIES = ['exact', 'close', 'fallback'] as const;
export type PlanMatchQuality = (typeof PLAN_MATCH_QUALITIES)[number];

/**
 * Hinweis-Codes eines Plans (gespeichert in user_plans.notes). Bewusst OHNE Gesundheitsbezug: Tausch-Codes nur
 * aus Gerätegründen; Hinweise zum vorsichtigen Plan leitet die App aus dem Gesundheits-Check ab (Abschnitt 9).
 */
export const PLAN_NOTES = [
  'goal_endurance_not_yet',
  'days_rotated',
  'days_capped',
  'days_added',
  'back_to_back_sessions',
  'minutes_shortened',
  'minutes_below_minimum',
  'volume_reduced',
  'exercises_substituted',
  'exercises_removed',
  'no_pull_exercise',
  'location_mismatch',
  // Etappe B3 (per `alter type … add value`, Erweiterungsplan 5.8)
  'endurance_days_capped',
  'endurance_volume_ramped',
  'endurance_walk',
  'rest_day_added',
  'week_total_capped',
  'endurance_basic_only',
] as const;
export type PlanNote = (typeof PLAN_NOTES)[number];

/** Art einer geplanten Einheit (planned_sessions.kind, Etappe B3). */
export const PLANNED_SESSION_KINDS = ['strength', 'endurance'] as const;
export type PlannedSessionKind = (typeof PLANNED_SESSION_KINDS)[number];

/**
 * Modalität einer Ausdauer-Einheit: Laufen (auch Geh-Lauf-Wechsel), zügiges Gehen, Rad (auch Ergometer),
 * Schwimmen (nur Dauer + Anstrengung, keine Technik – Frage 3).
 */
export const ENDURANCE_MODALITIES = ['run', 'walk', 'bike', 'swim'] as const;
export type EnduranceModality = (typeof ENDURANCE_MODALITIES)[number];

/**
 * Ziel → Ziel der Vorlagen (PLAN-PHASE-2 Frage 1): Definition nutzt Muskelaufbau (beschlossen, gilt als
 * passend); Ausdauer nutzt bis Phase 10 Allgemeine Fitness (nächstbeste Vorlage); Fit im Alter bis Etappe FA2 ebenso.
 */
export const GOAL_TEMPLATE_MAPPING = {
  muscle_gain: { goal: 'muscle_gain', kind: 'same' },
  fat_loss: { goal: 'fat_loss', kind: 'same' },
  general_fitness: { goal: 'general_fitness', kind: 'same' },
  definition: { goal: 'muscle_gain', kind: 'mapped' },
  endurance: { goal: 'general_fitness', kind: 'fallback' },
  // Fit im Alter (FA1): eigene Vorlagen kommen mit Etappe FA2 (Matrix-Eintrag, CHECK plan_templates.goal_type). Bis
  // dahin die nächstbeste Vorlage „Allgemeine Fitness“ – das Sicherheitsprofil ACTIVE_AGING_RULES gilt trotzdem.
  active_aging: { goal: 'general_fitness', kind: 'fallback' },
} as const satisfies Record<
  GoalType,
  { goal: TemplateGoalType; kind: 'same' | 'mapped' | 'fallback' }
>;

/** Level → Level der Vorlagen (PLAN-PHASE-2 Frage 2): Leistungssport nutzt Fortgeschritten (beschlossen). */
export const LEVEL_TEMPLATE_MAPPING = {
  beginner: 'beginner',
  advanced: 'advanced',
  competitive: 'advanced',
} as const satisfies Record<ExperienceLevel, TemplateExperienceLevel>;

// ---------------------------------------------------------------------------------------------------------
// Phase 4 · Trainingstagebuch (docs/PLAN-PHASE-4.md Abschnitt 3.2). Postgres-Enums seit Etappe B
// (20261006120000_training_log_enums.sql, Abgleich in db-sync.test.ts).
// ---------------------------------------------------------------------------------------------------------

/** Status eines Tagebuch-Eintrags: ganz oder teilweise geschafft. */
export const SESSION_LOG_STATUSES = ['completed', 'partial'] as const;
export type SessionLogStatus = (typeof SESSION_LOG_STATUSES)[number];

/** Status einer Übung im Eintrag: gemacht, nicht gemacht (ohne Grund), Alternative durchgeführt. */
export const EXERCISE_LOG_STATUSES = ['done', 'skipped', 'alternative'] as const;
export type ExerciseLogStatus = (typeof EXERCISE_LOG_STATUSES)[number];

/**
 * Herkunft eines Eintrags: `manual` (eingetragen), ab Phase 10 vorbereitet `gps` (Strecke aufgezeichnet, S1) und
 * `gpx_import` (GPX-Datei, S2a) – Datenbank seit WP3 (20261016140000_competition_enums.sql), genutzt erst ab S1.
 * `workout`: freie Einheit aus der Workout-Bibliothek (Timer, docs/PLAN-WORKOUTS.md) – nur zusammen mit is_free.
 * `health_connect`: Einheit aus Health Connect übernommen (Phase 8, Smartwatch) – setzt nur import_wearable_batch.
 */
export const LOG_SOURCES = ['manual', 'gps', 'gpx_import', 'workout', 'health_connect'] as const;
export type LogSource = (typeof LOG_SOURCES)[number];

// ---------------------------------------------------------------------------------------------------------
// Phase 10 · Etappe S1 · Strecken aufzeichnen (docs/PLAN-PHASE-10.md 12, 20261016220000_tracked_route_enums.sql)
// ---------------------------------------------------------------------------------------------------------

/**
 * Sportarten einer Strecke (KONZEPT 10.1: Laufen, Radfahren; dazu Gehen) – Teilmenge von ENDURANCE_MODALITIES, in der
 * Datenbank Spalte `sport` vom Typ endurance_modality mit CHECK (kein Schwimmen: GPS im Wasser unbrauchbar).
 */
export const TRACKED_ROUTE_SPORTS = ['run', 'bike', 'walk'] as const;
export type TrackedRouteSport = (typeof TRACKED_ROUTE_SPORTS)[number];

/** Schwierigkeit einer Strecke (KONZEPT 10.1: leicht / mittel / schwer) – Enum route_difficulty. */
export const ROUTE_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type RouteDifficulty = (typeof ROUTE_DIFFICULTIES)[number];

/**
 * Herkunft einer Strecke – Enum tracked_route_source: in der App aufgezeichnet (S1), aus eigener GPX-Datei (S2a) oder
 * Route einer Uhr-Einheit aus Health Connect (`watch`, Gründer-Entscheidung 23.10.2026, 20261023120000_wearable_route_enums.sql;
 * schreibt NUR save_wearable_route).
 */
export const TRACKED_ROUTE_SOURCES = ['recorded', 'gpx_import', 'watch'] as const;
export type TrackedRouteSource = (typeof TRACKED_ROUTE_SOURCES)[number];

/**
 * Herkunft der Verknüpfung eines Laufs mit einer „Meinen Strecke“ (tracked_routes.route_match, „Meine Strecken“
 * 25.10.2026, 20261025120000_route_match.sql – Text mit CHECK, kein Enum-Typ):
 * - `repeat`: über „Erneut laufen“ aufgezeichnet (base_route_id beim Speichern),
 * - `auto`: von der Erkennung auf dem Gerät vorläufig zugeordnet (zählt mit, bis die Person „Nein“ sagt),
 * - `confirmed`: von der Person bestätigt („Ja“ bzw. „Andere Strecke wählen“),
 * - `rejected`: von der Person abgelehnt („Nein“) – kein Vergleich, kein erneuter Vorschlag für diese Strecke.
 */
export const ROUTE_MATCH_STATES = ['repeat', 'auto', 'confirmed', 'rejected'] as const;
export type RouteMatchState = (typeof ROUTE_MATCH_STATES)[number];

/** Herkünfte, die die App über save_tracked_route senden darf (Uhr-Routen nur über save_wearable_route). */
export const APP_ROUTE_SOURCES = [
  'recorded',
  'gpx_import',
] as const satisfies readonly TrackedRouteSource[];

// ---------------------------------------------------------------------------------------------------------
// Phase 5 · Ernährung (Etappe N7, 20261014120100_nutrition_enums.sql) – Onboarding-Schritt `nutrition_setup`
// ---------------------------------------------------------------------------------------------------------

/** Alltagsaktivität OHNE Sport (docs/PLAN-PHASE-5.md 4.4). */
export const ACTIVITY_LEVELS = ['sedentary', 'light', 'active', 'very_active'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

/** Übliche Trainingszeit (Plan 4.8). `varies` = unterschiedlich → keine Zuordnung vor/nach. */
export const TRAINING_TIMES = [
  'early',
  'morning',
  'midday',
  'afternoon',
  'evening',
  'varies',
] as const;
export type TrainingTime = (typeof TRAINING_TIMES)[number];

/** Was beim Meal-Prep vorgekocht wird (Plan 6.4, `mealprep_slots`): Mittag (Standard) oder Mittag + Abend. */
export const MEALPREP_SLOT_MODES = ['lunch', 'lunch_dinner'] as const;
export type MealprepSlotMode = (typeof MEALPREP_SLOT_MODES)[number];

// ---------------------------------------------------------------------------------------------------------
// Phase 8 · Wearables (docs/PLAN-PHASE-8.md 6, 20261021120000_wearable_enums.sql)
// ---------------------------------------------------------------------------------------------------------

/** Datenquelle einer Smartwatch-Verbindung. Etappe 1 nur Health Connect (Android); später u. a. Apple Health. */
export const WEARABLE_PROVIDERS = ['health_connect'] as const;
export type WearableProvider = (typeof WEARABLE_PROVIDERS)[number];

/**
 * Stand einer Verbindung: `connected` (mindestens ein Datentyp freigegeben) bzw. `permission_missing` (in Health
 * Connect alle Rechte entzogen – „Zugriff fehlt“, kein Abgleich).
 */
export const WEARABLE_CONNECTION_STATUSES = ['connected', 'permission_missing'] as const;
export type WearableConnectionStatus = (typeof WEARABLE_CONNECTION_STATUSES)[number];
