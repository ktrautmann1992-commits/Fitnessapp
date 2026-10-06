/**
 * Zentrale Grenzwerte und Formel-Konstanten.
 *
 * Regel aus CLAUDE.md: ALLE Rechenformeln und Schutzgrenzen stehen hier, jeweils mit Quelle.
 * Die Schutzgrenzen sind fest im Code und NICHT durch Nutzer abschaltbar.
 */
import type {
  CautionTag,
  EquipmentCategory,
  ExperienceLevel,
  MovementPattern,
  MuscleGroup,
  TrainingSlotKind,
} from './enums';

/**
 * Mindestalter für die Nutzung der App (Jahre).
 * Quelle: Produktentscheidung (CLAUDE.md, „Sicherheit der Empfehlungen“); orientiert an
 * Art. 8 DSGVO (Einwilligungsfähigkeit ab 16 Jahren ohne Zustimmung der Eltern).
 */
export const MIN_AGE_YEARS = 16;

/**
 * Maximales Kaloriendefizit als Anteil des Gesamtumsatzes (0.25 = 25 %).
 * Quelle: CLAUDE.md; vgl. Helms ER et al. (2014), J Int Soc Sports Nutr 11:20 –
 * moderate Defizite erhalten fettfreie Masse besser als aggressive Defizite.
 */
export const MAX_CALORIE_DEFICIT_FRACTION = 0.25;

/**
 * Die Ziel-Energiezufuhr darf den Grundumsatz nie unterschreiten (Faktor 1.0 = 100 % des Grundumsatzes).
 * Quelle: CLAUDE.md (Kalorien-Schutzgrenzen).
 */
export const MIN_INTAKE_RELATIVE_TO_BMR = 1.0;

/**
 * Maximaler geplanter Gewichtsverlust pro Woche als Anteil des Körpergewichts (0.01 = 1 %).
 * Quelle: CLAUDE.md; Helms ER et al. (2014), J Int Soc Sports Nutr 11:20 – Empfehlung 0,5–1 % pro Woche.
 */
export const MAX_WEEKLY_WEIGHT_LOSS_FRACTION = 0.01;

/**
 * Maximale Steigerung des Ausdauer-Wochenumfangs gegenüber der Vorwoche (0.10 = 10 %).
 * Quelle: CLAUDE.md (Pflicht); „10-%-Regel“, u. a. ACSM's Guidelines for Exercise Testing and Prescription.
 * Ehrlich: wissenschaftlich SCHWACH belegt – Buist I et al. (2008), Am J Sports Med 36(1):33–39 fand bei
 * Laufanfängern keinen Unterschied in der Verletzungsrate gegenüber schnellerer Steigerung. Wir behalten sie als
 * vorsichtige Obergrenze. Prüfbar umgesetzt (docs/PLAN-PHASE-3-ERWEITERUNG.md 5.5): Bezug ist immer die LETZTE
 * BELASTUNGSWOCHE (nie Woche 0, nie eine Erholungswoche), Ergebnis mit Math.floor auf ganze Minuten; ohne
 * Bezugswoche gilt der Startumfang (ENDURANCE_START_RULES), nie der Wunsch.
 */
export const MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION = 0.1;

/**
 * Deload-/Erholungswoche spätestens nach so vielen Belastungswochen.
 * Quelle: docs/KONZEPT.md Abschnitt 4 („alle 4–6 Wochen“); übliche Praxis der Blockperiodisierung.
 */
export const DELOAD_INTERVAL_WEEKS = { min: 4, max: 6 } as const;

/**
 * Anteil intensiver Einheiten im Ausdauertraining (ca. 80/20-Verteilung).
 * Quelle: docs/KONZEPT.md Abschnitt 4; Seiler S (2010), Int J Sports Physiol Perform 5(3):276–291.
 */
export const ENDURANCE_HIGH_INTENSITY_SHARE = 0.2;

// ---------------------------------------------------------------------------------------------------------
// Eingabegrenzen Onboarding (Phase 1)
//
// Diese Werte stehen IDENTISCH als CHECK-Bedingungen in den Migrationen (supabase/migrations). Der Test
// `db-sync.test.ts` liest die Migrationen und bricht ab, wenn Code und Datenbank auseinanderlaufen.
// Es sind Plausibilitätsgrenzen gegen Tippfehler – keine medizinischen Normwerte.
// ---------------------------------------------------------------------------------------------------------

/**
 * Frühestes erlaubtes Geburtsdatum (Plausibilitätsgrenze gegen Tippfehler wie „1009“).
 * Quelle: Produktentscheidung Phase 1 (docs/PLAN-PHASE-1.md Abschnitt 6).
 */
export const BIRTH_DATE_MIN = '1900-01-01';

/**
 * Zeitzone für den Stichtag der Altersprüfung in der Datenbank (Trigger auf `profiles`).
 * Quelle: Zielmarkt DACH (CLAUDE.md); DE, AT und CH nutzen dieselbe Zeitzone.
 */
export const AGE_CHECK_TIME_ZONE = 'Europe/Berlin';

/**
 * Körperdaten (Tabelle `body_metrics`). Größe/Gewicht mit einer Nachkommastelle gespeichert.
 * Quellen/Begründung:
 * - Größe 100–250 cm: docs/PLAN-PHASE-1.md Abschnitt 8 (Beispiel); deckt Kleinwuchs bei Erwachsenen bis
 *   sehr große Menschen ab.
 * - Gewicht 30–300 kg: Erwachsene ab 16 Jahren; Werte außerhalb sind fast immer Tippfehler und würden die
 *   Kalorienformeln (Mifflin-St Jeor) unbrauchbar machen.
 * - Körperfett 3–60 %: ca. 3 % = essenzielles Fett bei Männern (ACE, „Percent Body Fat Norms“);
 *   über 60 % ist mit gängigen Messmethoden nicht plausibel.
 * - Ruhepuls 30–120 /min: sehr gut trainierte Ausdauersportler liegen teils unter 40; über 100 gilt als
 *   Tachykardie (AHA) – bis 120 wird noch angenommen, damit niemand an der Eingabe scheitert.
 */
export const BODY_METRIC_LIMITS = {
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 30, max: 300 },
  bodyFatPct: { min: 3, max: 60 },
  restingHeartRateBpm: { min: 30, max: 120 },
} as const;

/**
 * Trainingstage (Tabelle `training_slots`, Etappe B2 – docs/PLAN-PHASE-3-ERWEITERUNG.md Abschnitt 4.1) und
 * Plan-Angaben/Vorlagen.
 * - 1–7 Trainingstage pro Woche: CLAUDE.md („1 vs. 7 Trainingstage“ als Grenzfälle); identisch als
 *   `slot_no between 1 and 7` (höchstens 7 Einträge je Person).
 * - 10–240 Minuten pro Einheit: kürzere Einheiten sind kaum planbar; 4 h deckt lange Ausdauereinheiten ab;
 *   identisch als `minutes between 10 and 240`.
 */
export const TRAINING_LIMITS = {
  sessionsPerWeek: { min: 1, max: 7 },
  minutesPerSession: { min: 10, max: 240 },
} as const;

/**
 * Minuten-Vorschläge zum Antippen im Schritt „Deine Trainingstage“ (die UI liest sie nur; „Eigene“ erlaubt jeden
 * Wert aus TRAINING_LIMITS.minutesPerSession). Quelle: PRODUKTENTSCHEIDUNG (übliche Einheiten-Längen).
 */
export const MINUTE_PRESETS = [20, 30, 45, 60, 90] as const;

/**
 * Vorbelegte Dauer je Trainingsart, solange noch kein Tag bearbeitet wurde (Kraft 60, Ausdauer 30 Minuten).
 * Quelle: PRODUKTENTSCHEIDUNG (Erweiterungsplan Abschnitt 3.2); Ausdauer bewusst kurz – ein lockerer Einstieg.
 */
export const DEFAULT_SLOT_MINUTES = {
  strength_gym: 60,
  strength_home: 60,
  endurance: 30,
} as const satisfies Record<TrainingSlotKind, number>;

/**
 * Vorbelegung des Schritts „Deine Trainingstage“ beim Ziel Ausdauer (suggestedTrainingSlots, Gründer-Feedback
 * „Ziel Marathon → Plan für allgemeine Fitness“). Nur ein Vorschlag, frei änderbar; gilt nur, solange noch keine
 * Trainingstage gewählt sind.
 * - perGroup: Ausdauer- und Kraft-Einheiten je Woche nach Startgruppe (Einsteiger 3 + 2, Fortgeschritten 3 + 2,
 *   Leistungssport 4 + 2, vorsichtig 2 + 1). Triathlon (drei Sportarten): ab Fortgeschritten eine Ausdauer-Einheit
 *   mehr, im Leistungssport dafür nur 1 Kraft-Einheit (höchstens 6 Einheiten, mindestens 1 Ruhetag).
 * - Danach greifen die bestehenden Deckel: WEEKLY_SESSION_LIMITS (vorsichtig/Einsteiger ≤ 5 gesamt) und
 *   ENDURANCE_START_RULES.maxSessionsPerWeek; gekürzt wird zuerst Kraft (bis 1), dann Ausdauer (bis
 *   SCHEDULE_HINT_LIMITS.recommendedMinEnduranceDays), dann die letzte Kraft-Einheit.
 * - weekdays: Wochentage je Anzahl Einheiten (ISO 1 = Montag), längere Einheit eher am Wochenende.
 * Orientierung: ACSM Position Stand (Garber CE et al., 2011, Med Sci Sports Exerc 43(7):1334–1359 – Ausdauer an
 * 3–5 Tagen, Kraft an 2–3 Tagen pro Woche). Werte: PRODUKTENTSCHEIDUNG, fachlich zu bestätigen.
 */
export const ENDURANCE_GOAL_SUGGESTION = {
  perGroup: {
    cautious: { endurance: 2, strength: 1 },
    beginner: { endurance: 3, strength: 2 },
    advanced: { endurance: 3, strength: 2 },
    competitive: { endurance: 4, strength: 2 },
  },
  triathlonExtraEndurance: { advanced: 1, competitive: 1 },
  triathlonStrength: { competitive: 1 },
  weekdays: {
    1: [6],
    2: [2, 6],
    3: [2, 4, 6],
    4: [1, 3, 5, 6],
    5: [1, 2, 4, 5, 6],
    6: [1, 2, 3, 5, 6, 7],
    7: [1, 2, 3, 4, 5, 6, 7],
  },
} as const satisfies {
  perGroup: Record<
    'cautious' | ExperienceLevel,
    { readonly endurance: number; readonly strength: number }
  >;
  triathlonExtraEndurance: Partial<Record<ExperienceLevel, number>>;
  triathlonStrength: Partial<Record<ExperienceLevel, number>>;
  weekdays: Readonly<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, readonly number[]>>;
};

/**
 * Schwellen der freundlichen, NICHT blockierenden Hinweise im Schritt „Deine Trainingstage“ (scheduleHints()).
 * Quelle: PRODUKTENTSCHEIDUNG. Orientierung: ACSM Position Stand (2009), Med Sci Sports Exerc 41(3):687–708
 * (Kraft mindestens 2 Tage pro Woche je Muskelgruppe); Garber CE et al. (2011), Med Sci Sports Exerc
 * 43(7):1334–1359 (Ausdauer an mehreren Tagen pro Woche). Fachlich zu bestätigen.
 */
export const SCHEDULE_HINT_LIMITS = {
  recommendedMinEnduranceDays: 2,
  recommendedMinStrengthDays: 2,
} as const;

/**
 * Gesamt-Deckel Einheiten pro Woche (Erweiterungsplan 5.2 Punkt 3, Wächter-Befund 6): Einsteiger, vorsichtige
 * Pläne (jedes Gesundheits-Flag oder ohne Gesundheits-Check), unter 18 und ab 65 höchstens 5 Einheiten, also
 * mindestens 2 Ruhetage. Für alle anderen kein Deckel (nur Hinweis bei 7 Tagen).
 * Quelle: PRODUKTENTSCHEIDUNG – fachlich zu bestätigen. In Etappe B2 nur für den Hinweis `week_total_capped`
 * im Onboarding genutzt; die Plan-Engine wendet den Deckel ab Etappe B3 an.
 */
export const WEEKLY_SESSION_LIMITS = {
  cautiousMaxSessions: 5,
  minorBelowAge: 18,
  seniorFromAge: 65,
} as const;

/**
 * Ernährung (Tabelle `nutrition_prefs`).
 * - 1–8 Mahlzeiten pro Tag: deckt Intervallfasten (1–2) bis Kraftsport mit vielen kleinen Mahlzeiten ab.
 * - Meal-Prep 1–7 Tage pro Woche: nur beim Kochmodus „Meal-Prep“; bei „täglich frisch“ leer.
 */
export const NUTRITION_LIMITS = {
  mealsPerDay: { min: 1, max: 8 },
  mealPrepDaysPerWeek: { min: 1, max: 7 },
} as const;

/**
 * Geräte (Tabelle `user_equipment`).
 * - Gewichtsstufen 0,25–200 kg: kleinste übliche Mikroscheibe 0,25 kg; 200 kg deckt Scheiben/Kettlebells ab.
 * - Höchstens 40 Stufen je Gerät, Freitext „Sonstiges“ höchstens 200 Zeichen.
 */
export const EQUIPMENT_LIMITS = {
  weightStepKg: { min: 0.25, max: 200 },
  maxWeightSteps: 40,
  noteMaxLength: 200,
} as const;

/**
 * Langhantel (Erweiterungsplan Abschnitt 4.3): `user_equipment.weights_kg` der Langhantel sind SCHEIBEN je Paar,
 * die Stange steht getrennt in `user_equipment.bar_kg`.
 * - Stange 5–25 kg (identisch als CHECK `bar_kg between 5 and 25`): von der leichten SZ-/Technikstange bis zur
 *   schweren Spezialstange; übliche Stangen 10, 15 (Damen-Olympiastange) und 20 kg (Herren-Olympiastange,
 *   IWF-Norm) als Vorschläge. Ohne Angabe gilt die 20-kg-Stange (Frage 9).
 * - Scheiben höchstens 25 kg (größte übliche Hantelscheibe, IWF-Norm; identisch als CHECK
 *   `25 >= all (weights_kg)` nur für die Langhantel).
 * Quelle: übliche Handelsgrößen / IWF Technical and Competition Rules; Auswahl = PRODUKTENTSCHEIDUNG.
 */
export const BARBELL_BAR_KG = { min: 5, max: 25 } as const;
export const BARBELL_BAR_PRESETS_KG = [10, 15, 20] as const;
export const BARBELL_DEFAULT_BAR_KG = 20;
export const BARBELL_PLATE_MAX_KG = 25;

/**
 * Körperumfänge in cm (Tabelle `body_measurements`, optionaler Onboarding-Schritt „Körperumfänge“).
 * Quelle: Erweiterungsbeschluss der Gründer (docs/ERWEITERUNGEN.md). Eigene Plausibilitätsgrenzen (keine
 * Normwerte) für Erwachsene ab 16 Jahren, bewusst großzügig – von sehr schlank bis stark übergewichtig bzw.
 * sehr muskulös –, damit nur Tippfehler (z. B. mm statt cm) abgefangen werden:
 * - Oberarm 15–80, Wade 15–80, Oberschenkel 25–120,
 * - Brust 50–200, Schultern 70–220,
 * - Taille 40–250, Bauch 40–250, Hüfte 50–250.
 */
export const BODY_MEASUREMENT_LIMITS = {
  upperArmCm: { min: 15, max: 80 },
  chestCm: { min: 50, max: 200 },
  shouldersCm: { min: 70, max: 220 },
  waistCm: { min: 40, max: 250 },
  abdomenCm: { min: 40, max: 250 },
  thighCm: { min: 25, max: 120 },
  hipCm: { min: 50, max: 250 },
  calfCm: { min: 15, max: 80 },
} as const;

/**
 * Erinnerung „Umfänge neu messen“ (Tabelle `measurement_reminders`), Abstand in Tagen.
 * Standard 28 Tage: Umfänge ändern sich langsam; ca. monatliches Messen glättet Tagesschwankungen
 * (Wasser, Mahlzeiten). Mindestens wöchentlich, höchstens vierteljährlich.
 * Quelle: Erweiterungsbeschluss der Gründer (docs/ERWEITERUNGEN.md).
 */
export const MEASUREMENT_REMINDER_INTERVAL_DAYS = { min: 7, max: 90, default: 28 } as const;

/**
 * Messdatum von Körperdaten und -umfängen: höchstens so viele Tage nach „heute“ (Europe/Berlin).
 * 1 Tag Toleranz für Zeitzonen-Unterschiede (z. B. auf Reisen); identisch im Trigger
 * private.check_measured_on() in supabase/migrations/20261003120300_health_data.sql.
 */
export const MEASURED_ON_MAX_DAYS_AHEAD = 1;

/**
 * Gewichtsstufen werden mit 2 Nachkommastellen gespeichert (numeric(5,2), z. B. 1.25 kg).
 * Zod lehnt feinere Angaben ab, damit App und Datenbank gleich entscheiden.
 */
export const EQUIPMENT_WEIGHT_DECIMALS = 2;

// ---------------------------------------------------------------------------------------------------------
// Phase 2 · Inhalte: Grenzen der Schemas und Plausibilitäts-Checks (docs/PLAN-PHASE-2.md Abschnitt 7)
// ---------------------------------------------------------------------------------------------------------

/**
 * Harte Schema-Grenzen für Inhalte (Regel Ü1, „rot – auch bei Entwürfen“). Bewusst WEITER als die fachlichen
 * Regeln V4/V8, damit ein Entwurf mit z. B. RPE 10 noch als Datei liegen und korrigiert werden kann; die
 * fachlichen Grenzen prüfen V4/V8 (rot, blockieren Freigabe und Einspielen).
 * Dieselben Werte stehen als CHECK-Bedingungen in supabase/migrations/20261003130300_exercises.sql und
 * 20261003130400_plan_templates.sql (geprüft in db-sync.test.ts).
 * Quelle: Produktentscheidung Phase 2 (Plausibilitätsgrenzen gegen Tipp- und KI-Fehler, keine Fachwerte).
 */
export const CONTENT_SCHEMA_LIMITS = {
  version: { min: 1, max: 1000 },
  difficulty: { min: 1, max: 3 },
  alternativePriority: { min: 1, max: 20 },
  sets: { min: 1, max: 10 },
  reps: { min: 1, max: 100 },
  durationS: { min: 5, max: 600 },
  restS: { min: 0, max: 600 },
  rpe: { min: 1, max: 10 },
  orderNo: { min: 1, max: 20 },
  exercisesPerSession: { min: 1, max: 12 },
} as const;

/**
 * Fachliche Grenzen je Übung in einer Plan-Vorlage (Regel V4, rot) und je Einheit (Regel V8, rot).
 * - Wiederholungen 3–30: Muskelzuwachs ist über einen weiten Lastbereich ähnlich (Schoenfeld BJ et al. (2017),
 *   J Strength Cond Res 31(12):3508–3523); unter 3 Wdh. = Maximalkraft-/Testbereich, über 30 Wdh. = kaum noch
 *   Krafttraining. Wdh.-Ober-/Untergrenze als Produktentscheidung.
 * - Sätze 1–6 je Übung: ACSM Position Stand (2009), „Progression models in resistance training for healthy
 *   adults“, Med Sci Sports Exerc 41(3):687–708 (1–3 Sätze für Einsteiger, mehrere Sätze für Fortgeschrittene);
 *   Obergrenze 6 als Produktentscheidung.
 * - RPE 5–9, Einsteiger höchstens 8, keine Maximaltests (RPE 10, 1RM): RPE-Skala nach Wiederholungen in
 *   Reserve, Helms ER et al. (2016), Strength Cond J 38(4):42–49. Produktentscheidung: Vorlagen planen nie bis
 *   zum Muskelversagen; Einsteiger behalten mindestens 2 Wiederholungen in Reserve.
 * - Halteübungen 10–120 s: Produktentscheidung (kürzer ist kaum wirksam, länger wird Ausdauer statt Kraft).
 * - Höchstens 8 Übungen je Einheit: Produktentscheidung, passend zur Einheitendauer von 45–60 Minuten.
 */
export const TEMPLATE_DOSAGE_LIMITS = {
  reps: { min: 3, max: 30 },
  sets: { min: 1, max: 6 },
  rpe: { min: 5, max: 9 },
  beginnerRpeMax: 8,
  durationS: { min: 10, max: 120 },
  maxExercisesPerSession: 8,
} as const;

/**
 * Pausen zwischen Sätzen in Sekunden (Regel V5, gelb).
 * Quelle: ACSM Position Stand (2009), Med Sci Sports Exerc 41(3):687–708 (2–3 min bei Grundübungen mit
 * hoher Last, 1–2 min bei leichteren Übungen); Schoenfeld BJ et al. (2016), J Strength Cond Res
 * 30(7):1805–1812 (längere Pausen bei Grundübungen vorteilhaft). Bereiche als Produktentscheidung.
 */
export const REST_RANGES_S = {
  compound: { min: 90, max: 240 },
  isolation: { min: 45, max: 120 },
} as const;

/**
 * Schätzung der Dauer einer Einheit (Regel V6, gelb): Aufwärmen + Sätze + Pausen + Wechsel.
 * - Aufwärmen 8 min, ca. 4 s je Wiederholung, 60 s Wechsel/Einrichten je Übung.
 * - Pause zählt zwischen den Sätzen einer Übung (Sätze − 1); bei Supersätzen (gleiche `superset_group`)
 *   zählt je Runde die Summe der Pausen der Gruppe.
 * - Toleranz: geschätzte Dauer darf die Minuten-Spanne der Vorlage um höchstens 15 % unter-/überschreiten.
 * Quelle: Produktentscheidung (Schätzwerte für eine gleichmäßige Ausführung, keine Messung).
 */
export const SESSION_DURATION_ESTIMATE = {
  warmupMinutes: 8,
  secondsPerRep: 4,
  transitionSecondsPerExercise: 60,
  tolerance: 0.15,
} as const;

/**
 * Drücken : Ziehen pro Woche etwa 1 : 1 (Regel V7, gelb): Hinweis, wenn eine Seite mehr als 30 % über der
 * anderen liegt. Gezählt werden Sätze der Bewegungsmuster horizontal/vertikal drücken bzw. ziehen.
 * Quelle: Produktentscheidung (ausgewogene Schulterbelastung; übliche Praxis der Trainingsplanung).
 */
export const PUSH_PULL_TOLERANCE = 0.3;

/**
 * Wochensätze pro Muskelgruppe (Regeln V9–V11): Ein Satz zählt für jeden Hauptmuskel 1,0 und für jeden
 * Nebenmuskel 0,5.
 */
export const WEEKLY_SET_CONTRIBUTION = { primary: 1, secondary: 0.5 } as const;

/**
 * Startwerte Wochensätze pro Muskelgruppe je Ziel und Level (min–max, fachlich zu prüfen, Plan Frage 5).
 * Quelle der Untergrenzen: Schoenfeld BJ, Ogborn D, Krieger JW (2017), „Dose-response relationship between
 * weekly resistance training volume and increases in muscle mass: A systematic review and meta-analysis“,
 * J Sports Sci 35(11):1073–1082 – mehr Wochensätze → mehr Muskelzuwachs, deutlicher Effekt ab ca. 10 Sätzen.
 * Die OBERGRENZEN sind eine Produktentscheidung gegen zu viel Umfang (Erholung, Einheitendauer) und werden
 * mit der fachlichen Prüfung bestätigt.
 */
export const WEEKLY_SETS_PER_MUSCLE = {
  muscle_gain: { beginner: { min: 6, max: 14 }, advanced: { min: 10, max: 22 } },
  fat_loss: { beginner: { min: 6, max: 14 }, advanced: { min: 8, max: 20 } },
  general_fitness: { beginner: { min: 4, max: 12 }, advanced: { min: 6, max: 16 } },
} as const;

/**
 * Große Muskelgruppen: Untergrenze unterschritten = rot (V10). Kleine Muskelgruppen: Untergrenze
 * unterschritten = gelb (V11). Für alle übrigen Gruppen (vordere Schulter, Unterarme, schräge Bauchmuskeln,
 * unterer Rücken, Adduktoren) gilt nur die Obergrenze (V9) – sie werden über Grundübungen mittrainiert.
 * Quelle: docs/PLAN-PHASE-2.md Abschnitt 7 (Einteilung als Produktentscheidung).
 */
export const LARGE_MUSCLE_GROUPS = [
  'chest',
  'lats',
  'upper_back',
  'quadriceps',
  'hamstrings',
  'glutes',
] as const satisfies readonly MuscleGroup[];
export const SMALL_MUSCLE_GROUPS = [
  'biceps',
  'triceps',
  'calves',
  'side_delts',
  'rear_delts',
  'abs',
] as const satisfies readonly MuscleGroup[];

// ---------------------------------------------------------------------------------------------------------
// Phase 3 · Plan-Engine (docs/PLAN-PHASE-3.md Abschnitte 5 und 6)
//
// Was keine Studie belegt, ist ausdrücklich als PRODUKTENTSCHEIDUNG gekennzeichnet und wird mit der fachlichen
// Prüfung (PLAN-PHASE-2 Frage 5) bestätigt. Die Quellen werden beim Zitieren gegen das Original geprüft.
// ---------------------------------------------------------------------------------------------------------

/**
 * Version der Regeln der Plan-Engine. Steigt bei jeder Regeländerung → die App bietet „Plan neu erstellen“ an.
 * Version 3 (docs/PLAN-KOERPERGEWICHT.md, Etappe K2+K3): Körpergewicht-Vorlagen als harte Regel, 1 Kraft-Tag →
 * 2-Tage-Vorlage, NUR bei Körpergewicht-Vorlagen bleibt beim Kürzen die letzte Rumpf-Übung (alle anderen Vorlagen
 * kürzen wie Version 2), Progression ohne Gewicht mit Puffer und Zusatzsatz.
 * Quelle: Produktentscheidung (PLAN-PHASE-3 Abschnitt 10.4).
 */
export const PLAN_ENGINE_VERSION = 3;

/**
 * Körpergewicht-Profil (docs/PLAN-KOERPERGEWICHT.md §5.1, Wächter A6 und W2): Alle Kraft-Tage zu Hause und keine
 * KRAFT-Geräte → nur Körpergewicht-Vorlagen. Als Kraft-Geräte zählen nur lastgebende Geräte: freie Gewichte, Bänder,
 * Maschinen. NICHT zählen Ausdauer-Geräte (Laufband, Ergometer, Rudergerät), Bänke, Klimmzugstange und Dip-Station
 * (die Klimmzugstange macht den Klimmzug als schwerere Variante machbar). Unbekannte Geräte zählen vorsichtshalber.
 * Quelle: PRODUKTENTSCHEIDUNG (Gründer-Wunsch „keine Geräte → nur Körpergewicht-Pläne“).
 */
export const BODYWEIGHT_PROFILE_RULES = {
  strengthEquipmentCategories: ['free_weights', 'bands', 'machines'],
} as const satisfies {
  strengthEquipmentCategories: readonly EquipmentCategory[];
};

/**
 * ID-Endung der Körpergewicht-Vorlagen (`<ziel>-<level>-<n>t-koerpergewicht`). Rückfall für den Folgeblock, wenn die
 * Vorlage nicht in der Bibliothek steht (isBodyweightTemplateId, Wächter N3). Quelle: PRODUKTENTSCHEIDUNG (Namensregel).
 */
export const BODYWEIGHT_TEMPLATE_ID_SUFFIX = '-koerpergewicht';

/**
 * Punkte für das Vorlagen-Matching (Summe 100), Abschnitt 5.3.
 * Quelle: PRODUKTENTSCHEIDUNG (Ziel wichtiger als Level, Level wichtiger als Tage usw.).
 */
export const PLAN_MATCH_WEIGHTS = {
  goal: 35,
  level: 25,
  days: 15,
  location: 10,
  equipment: 10,
  duration: 5,
} as const;

/**
 * Höchstens so viele Krafteinheiten pro Woche; weitere Wunsch-Tage werden Ruhetage.
 * Quelle: PRODUKTENTSCHEIDUNG (Vorlagen gibt es mit 3 und 4 Tagen, Körpergewicht-Vorlagen zusätzlich mit 2 Tagen;
 * bei 1 Kraft-Tag wird die 2-Tage-Ganzkörper-Vorlage bevorzugt, sonst die 3-Tage-Vorlage – die Einheiten wechseln
 * dann von Woche zu Woche, Hinweis `days_rotated`). Orientierung: ACSM Position Stand (2009),
 * „Progression models in resistance training for healthy adults“, Med Sci Sports Exerc 41(3):687–708
 * (Trainingshäufigkeit je Level: Einsteiger 2–3, Fortgeschrittene 3–4 Tage pro Woche).
 */
export const MAX_STRENGTH_SESSIONS_PER_WEEK = 4;

/**
 * Erholung zwischen zwei Krafteinheiten derselben Muskelgruppen in Stunden (Planung nutzt die Untergrenze:
 * Ganzkörper-Einheiten möglichst nicht an zwei Tagen hintereinander).
 * Quelle: Garber CE et al. (2011), ACSM Position Stand „Quantity and Quality of Exercise for Developing and
 * Maintaining Cardiorespiratory, Musculoskeletal, and Neuromotor Fitness in Apparently Healthy Adults“,
 * Med Sci Sports Exerc 43(7):1334–1359 (mind. 48 h); abgeglichen mit ACSM Position Stand (2009), 48–72 h.
 */
export const MIN_RECOVERY_HOURS_SAME_MUSCLES = { min: 48, max: 72 } as const;

/**
 * Standard-Trainingstage ohne Wunsch-Tage (ISO 1 = Montag … 7 = Sonntag), je Anzahl Einheiten.
 * Quelle: PRODUKTENTSCHEIDUNG (größtmögliche Abstände, Wochenende frei).
 */
export const DEFAULT_TRAINING_DAYS: Readonly<Record<number, readonly number[]>> = {
  1: [3],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
};

/**
 * Vorsichtiger Plan (Gesundheits-Flag `conservative_plan` bzw. jedes Flag, und ohne Gesundheits-Check).
 * Quelle: Die FLAGS begründet der PAR-Q+ (Warburton DER et al., 2011, Health Fit J Can 4(2):3–23). RPE-Deckel,
 * nur Einsteiger-Vorlagen und die ausgeschlossenen Übungs-Merkmale sind PRODUKTENTSCHEIDUNG
 * (docs/PLAN-PHASE-2.md Abschnitt 8, docs/PLAN-PHASE-3.md Abschnitt 5.4).
 * - `overheadFlags`: bei diesen Flags (und ohne Check) zusätzlich keine Über-Kopf-Übungen.
 */
export const CONSERVATIVE_PLAN_RULES = {
  rpeMax: 7,
  beginnerTemplatesOnly: true,
  excludedCautionTags: ['high_impact', 'spinal_loading', 'high_skill'],
  overheadFlags: ['injury', 'medical_clearance_recommended'],
} as const satisfies {
  rpeMax: number;
  beginnerTemplatesOnly: boolean;
  excludedCautionTags: readonly CautionTag[];
  overheadFlags: readonly string[];
};

/**
 * Schwangerschaft: zusätzlich keine Übungen in langer Rückenlage.
 * Quelle: ACOG Committee Opinion Nr. 804 (2020), „Physical Activity and Exercise During Pregnancy and the
 * Postpartum Period“, Obstet Gynecol 135(4):e178–e188.
 */
export const PREGNANCY_EXCLUDED_CAUTION_TAGS = [
  'long_supine',
] as const satisfies readonly CautionTag[];

/**
 * Altersregeln (Stichtag = Datum der Planung bzw. Anzeige).
 * - Unter 18: RPE ≤ 8, keine Technik-Übungen (`high_skill`). Quelle: Faigenbaum AD et al. (2009), „Youth
 *   resistance training: updated position statement paper from the NSCA“, J Strength Cond Res 23(5 Suppl):S60–S79
 *   (Krafttraining Jugendlicher sicher unter qualifizierter Aufsicht – die App bietet keine Aufsicht).
 * - Ab 65: RPE ≤ 7, keine Sprünge und Technik-Übungen. PRODUKTENTSCHEIDUNG: Chodzko-Zajko WJ et al. (2009),
 *   ACSM Position Stand „Exercise and physical activity for older adults“, Med Sci Sports Exerc 41(7):1510–1530,
 *   nutzt eine 0–10-Anstrengungsskala, keine RPE nach Wiederholungen in Reserve.
 */
export const AGE_PLAN_RULES = {
  minor: { belowAge: 18, rpeMax: 8, excludedCautionTags: ['high_skill'] },
  senior: { fromAge: 65, rpeMax: 7, excludedCautionTags: ['high_impact', 'high_skill'] },
} as const satisfies {
  minor: { belowAge: number; rpeMax: number; excludedCautionTags: readonly CautionTag[] };
  senior: { fromAge: number; rpeMax: number; excludedCautionTags: readonly CautionTag[] };
};

/**
 * Einstiegswoche: RPE-Ziel 1 Punkt unter der Vorlage (nie unter TEMPLATE_DOSAGE_LIMITS.rpe.min).
 * Quelle: Helms ER et al. (2016), „Application of the repetitions in reserve-based rating of perceived exertion
 * scale for resistance training“, Strength Cond J 38(4):42–49; Höhe der Absenkung: PRODUKTENTSCHEIDUNG.
 */
export const INTRO_WEEK_RPE_REDUCTION = 1;

/**
 * Angebrochene Startwoche: Passt weniger als dieser Anteil der Wochen-Einheiten in den Rest der Woche, laufen
 * diese Einheiten als „Woche 0“ (Einstiegswoche außerhalb des Belastungsblocks).
 * Quelle: PRODUKTENTSCHEIDUNG (PLAN-PHASE-3 Abschnitt 5.7).
 */
export const PARTIAL_START_WEEK_MIN_SHARE = 0.5;

/**
 * Arbeitsgewicht aus einem Eintrag (ab Phase 4): Epley-Formel e1RM = Gewicht × (1 + (Wdh. + Reserve) / 30),
 * nur bis 12 Wdh. + Reserve (darüber wird nicht hochgerechnet).
 * Quellen: Epley B (1985), „Poundage Chart“, Boyd Epley Workout; Zourdos MC et al. (2016), „Novel resistance
 * training-specific rating of perceived exertion scale measuring repetitions in reserve“, J Strength Cond Res
 * 30(1):267–275. Grenze 12: PRODUKTENTSCHEIDUNG (Schätzformeln werden mit vielen Wdh. ungenau).
 */
export const E1RM_ESTIMATE = { epleyDivisor: 30, maxRepsPlusReserve: 12 } as const;

/**
 * Doppelte Progression (PLAN-PHASE-3 Abschnitt 5.9).
 * - Gewichtsschritt bis 10 % direkt; Langhantel und Maschine/Kabel +2,5 kg, Kurzhantel/Kettlebell nächste eigene
 *   Gewichtsstufe (ohne Angabe +2 kg).
 * - Ein größerer Gewichtssprung wird nie direkt genommen, sondern erst nach dem Puffer: Zielwiederholungen bis
 *   reps_max + 2 (höchstens 30), dann +1 Satz (höchstens 6), dann der Gewichtsschritt. Ist dieser Sprung größer als
 *   25 %, liegt das RPE-Ziel der ersten Einheit danach 1 Punkt niedriger.
 * - Gibt es keine höhere eigene Gewichtsstufe: nach dem Puffer Hinweis „schwerere Gewichtsstufe eintragen oder
 *   schwerere Variante wählen“.
 * - Auslöser für eine Stufe über reps_max hinaus: zwei Einheiten in Folge geschafft.
 * - Halteübungen: Steigerung min(5 s, max(1 s, floor(10 % der Dauer))), höchstens 120 s.
 * Quellen: ACSM Position Stand (2009), Med Sci Sports Exerc 41(3):687–708 (2–10 % Laststeigerung, wenn 1–2 Wdh.
 * über dem Ziel gelingen); „2-für-2-Regel“ (zwei Einheiten in Folge): Baechle TR, Earle RW (Hrsg.), „Essentials of
 * Strength Training and Conditioning“, NSCA. Puffer, Kurzhantel-Standard und Halteübungs-Schritte:
 * PRODUKTENTSCHEIDUNG.
 */
export const LOAD_PROGRESSION = {
  maxIncreaseFraction: 0.1,
  largeJumpFraction: 0.25,
  largeJumpRpeReduction: 1,
  barbellIncrementKg: 2.5,
  machineIncrementKg: 2.5,
  defaultFreeWeightIncrementKg: 2,
  extraRepsBuffer: 2,
  extraSets: 1,
  consecutiveSessionsForStep: 2,
  holdIncrementS: { min: 1, max: 5, fraction: 0.1 },
} as const;

/**
 * Vorschlag „schwerere Variante“ (docs/PLAN-KOERPERGEWICHT.md §5.5, Wächter W8): Einsteiger und vorsichtige Pläne
 * bekommen nur Varianten, die höchstens 1 Schwierigkeitsstufe (`difficulty` 1–3) schwerer sind – z. B. nach dem
 * Handtuch-Latziehen den Klimmzug mit Band, nicht direkt den freien Klimmzug.
 * Quelle: PRODUKTENTSCHEIDUNG (kleine Schritte; fachliche Prüfung vor Veröffentlichung).
 */
export const HARDER_VARIANT_RULES = { cautiousMaxDifficultyStep: 1 } as const;

/**
 * Belastungswochen vor der festen Erholungswoche (Deload). Liegt im Rahmen DELOAD_INTERVAL_WEEKS.
 * Quellen: docs/KONZEPT.md Abschnitt 4.5 („alle 4–6 Wochen“); Bell L et al. (2023), „Integrating Deloading into
 * Strength and Physique Sports Training Programmes: An International Delphi Consensus Approach“, Sports Med
 * Open 9:87. Aufteilung nach Level: PRODUKTENTSCHEIDUNG.
 */
export const DELOAD_SCHEDULE = { beginner: 5, advanced: 4, cautious: 4 } as const;

/**
 * Erholungswoche: Sätze halbiert (aufgerundet, mind. 1), RPE −2 (nie unter 5), Gewicht ×0,9.
 * Quelle: Bell L et al. (2023), Sports Med Open 9:87 (Umfang und Anstrengung senken); Werte: PRODUKTENTSCHEIDUNG.
 */
export const DELOAD_DOSAGE = { setsFactor: 0.5, rpeReduction: 2, loadFactor: 0.9 } as const;

/**
 * Kürzen auf das Zeitbudget: mindestens 3 Übungen, Grundübungen mind. 2 Sätze, Isolationsübungen mind. 1 Satz.
 * Nur bei Körpergewicht-Vorlagen (Engine-Version 3, Wächter W1): Beim Entfernen der Isolationsübungen bleibt die
 * LETZTE Rumpf-Übung (`corePatterns`) einer Einheit stehen. Alle anderen Vorlagen kürzen unverändert wie Version 2.
 * Quelle: PRODUKTENTSCHEIDUNG (PLAN-PHASE-3 Abschnitt 5.6; docs/PLAN-KOERPERGEWICHT.md Etappe K3).
 */
export const SESSION_FIT = {
  minExercises: 3,
  minSetsCompound: 2,
  minSetsIsolation: 1,
  corePatterns: ['core_anti_extension', 'core_anti_rotation', 'core_flexion'],
} as const satisfies {
  minExercises: number;
  minSetsCompound: number;
  minSetsIsolation: number;
  corePatterns: readonly MovementPattern[];
};

// ---------------------------------------------------------------------------------------------------------
// Etappe B3 · Ausdauer-Tage ohne KI (docs/PLAN-PHASE-3-ERWEITERUNG.md Abschnitte 5.2, 5.5, 5.6)
// Werte ohne Studienbeleg sind PRODUKTENTSCHEIDUNG und gehen in die fachliche Prüfung.
// ---------------------------------------------------------------------------------------------------------

/**
 * Startgruppe Ausdauer: „cautious“ = jedes Gesundheits-Flag, ohne Gesundheits-Check, Schwangerschaft, unter 18
 * oder ab 65; sonst das Trainings-Level.
 * - startWeeklyMinutes: Startumfang je Woche (Einsteiger 60, Fortgeschritten 120, Leistungssport 150, vorsichtig
 *   45). Orientierung: WHO-Leitlinie 2020 (Bull FC et al., Br J Sports Med 54:1451–1462: 150–300 min moderat pro
 *   Woche als Ziel – der Start liegt bewusst darunter). Werte: PRODUKTENTSCHEIDUNG.
 * - maxSessionsPerWeek: Ausdauer-Einheiten je Woche höchstens (4/5/6, vorsichtig 3). PRODUKTENTSCHEIDUNG.
 */
export const ENDURANCE_START_RULES = {
  startWeeklyMinutes: { beginner: 60, advanced: 120, competitive: 150, cautious: 45 },
  maxSessionsPerWeek: { beginner: 4, advanced: 5, competitive: 6, cautious: 3 },
} as const;

/**
 * Deckel je Ausdauer-Einheit (Wächter-Befunde 10 und Runde 2 Nr. 1), PRODUKTENTSCHEIDUNG:
 * - maxShareOfWeek: bei ≥ 2 Ausdauer-Einheiten höchstens 50 % des Wochenumfangs je Einheit,
 * - firstLoadWeekMaxMinutes: in der ersten Belastungswoche höchstens 90 Minuten je Einheit,
 * - startSessionMinutes: Start-Deckel je Einheit (Einsteiger 30, vorsichtig 20; sonst keiner), wächst je
 *   Belastungswoche mit floor(1,1 × Vorwoche) – Woche 0 und Erholungswochen zählen nicht,
 * - minSessionMinutes: kürzere Einheiten werden gestrichen (Minuten gehen an die übrigen, bis zu deren Deckel).
 */
export const ENDURANCE_SESSION_LIMITS = {
  maxShareOfWeek: 0.5,
  firstLoadWeekMaxMinutes: 90,
  startSessionMinutes: { beginner: 30, cautious: 20 },
  minSessionMinutes: 10,
} as const;

/**
 * Erholungswoche Ausdauer: Umfang = floor(0,6 × letzte Belastungswoche). Nur in ANLEHNUNG an Bosquet L et al.
 * (2007), Med Sci Sports Exerc 39(8):1358–1365 (Tapering vor Wettkämpfen: Umfang −41–60 %; keine Studie zu
 * Erholungswochen). PRODUKTENTSCHEIDUNG.
 */
export const ENDURANCE_DELOAD_VOLUME_FACTOR = 0.6;

/**
 * Anstrengung (0–10, Borg-CR10) lockerer Ausdauer-Einheiten mit Gesprächstest.
 * Quellen: Borg GA (1982), Med Sci Sports Exerc 14(5):377–381 (CR10-Skala); Foster C et al. (2008), J Cardiopulm
 * Rehabil Prev 28(1):24–30 (Talk-Test); Seiler S (2010) – ENDURANCE_HIGH_INTENSITY_SHARE.
 * - easy 3–4 („locker“), Einstiegs-/Erholungswochen 3,
 * - cautiousMax 3: Gesundheits-Flag, ab 65, ohne Check, Schwangerschaft (ACOG Committee Opinion No. 804 (2020),
 *   Obstet Gynecol 135(4):e178–e188: moderate Aktivität, Talk-Test) – Höhe: PRODUKTENTSCHEIDUNG,
 * - minorMax 4: unter 18 (PRODUKTENTSCHEIDUNG).
 */
export const ENDURANCE_EFFORT = { easyMin: 3, easyMax: 4, cautiousMax: 3, minorMax: 4 } as const;

/**
 * Einsteiger laufen in den ersten Belastungswochen im Geh-Lauf-Wechsel (PRODUKTENTSCHEIDUNG, Erweiterungsplan
 * 5.5); ohne Gesundheits-Check immer (Frage 14, offen mit Empfehlung des Wächters).
 */
export const ENDURANCE_BEGINNER_WALK_RUN_WEEKS = 4;

/**
 * Grenzen eines erzeugten Plans – identisch als CHECK in der Datenbank (Etappe B, db-sync.test.ts).
 * - Woche 0–6: Woche 0 + längster Block (5 Belastungswochen + 1 Erholungswoche).
 * - Höchstens 7 Einheiten pro Woche, höchstens 8 Übungen pro Einheit (Regel V8).
 * Quelle: PRODUKTENTSCHEIDUNG bzw. TEMPLATE_DOSAGE_LIMITS.maxExercisesPerSession.
 */
export const PLAN_BLOCK_LIMITS = {
  weekNo: { min: 0, max: 6 },
  sessionsPerWeek: 7,
  exercisesPerSession: 8,
  blockNo: { min: 1, max: 1000 },
} as const;

/**
 * Zielgewicht einer geplanten Übung in kg: Plausibilitätsgrenze (Langhantel + Scheiben), identisch als CHECK.
 * Quelle: PRODUKTENTSCHEIDUNG.
 * Bei Kurzhanteln und Kettlebells bedeutet target_weight_kg das Gewicht JE HANTEL bzw. JE KUGEL; bei der
 * Langhantel das Gesamtgewicht (Stange + Scheiben, barbellLoadSteps()). Erweiterungsplan Abschnitt 4.3.
 */
export const PLANNED_LOAD_LIMITS = { targetWeightKg: { min: 0.5, max: 500 } } as const;

/**
 * Rahmen beim Speichern eines Plans (save_training_plan / append_plan_block), identisch als Konstanten in
 * supabase/migrations/20261004120100_training_plan_rpcs.sql bzw. als CHECK auf user_plans.inputs
 * (db-sync.test.ts). „Heute“ = Europe/Berlin. Quelle: PRODUKTENTSCHEIDUNG (Wächter-Prüfung Etappe B).
 * - pastToleranceDays 1: Plan-Start und Einheiten frühestens gestern (Zeitzonen-Toleranz wie
 *   MEASURED_ON_MAX_DAYS_AHEAD); beim Ersetzen entfallen die geplanten Einheiten des alten Plans ab gestern.
 * - startDateMaxDaysAhead 7: ein neuer Plan beginnt spätestens in einer Woche (und nie nach der ersten Einheit).
 * - scheduleMaxDaysAhead 56 = 7 × 7 + 7: Woche 0 bis Woche 6 (PLAN_BLOCK_LIMITS.weekNo) ab dem spätesten Start;
 *   beim Folgeblock ab der letzten Einheit des Plans bzw. ab heute gerechnet.
 * - keptReplacedPlans 20: ersetzte Pläne ohne verbleibende Einheiten jenseits der neuesten 20 werden beim
 *   Speichern gelöscht (Pläne mit vergangenen Einheiten bleiben als Verlauf).
 * - inputsMaxBytes 4096: Größe von user_plans.inputs als Text in Postgres-Schreibweise (jsonbTextBytes()).
 */
export const PLAN_SAVE_LIMITS = {
  pastToleranceDays: 1,
  startDateMaxDaysAhead: 7,
  scheduleMaxDaysAhead: 7 * 7 + 7,
  keptReplacedPlans: 20,
  inputsMaxBytes: 4096,
} as const;

/**
 * Geschützter Zwischenspeicher für Pläne mit Gesundheitsbezug (Gründer-Entscheidung Frage 14, PLAN-PHASE-3
 * Abschnitt 9): Ohne Server-Kontakt wird er nach höchstens so vielen Tagen verworfen. Grund: Ein Widerruf auf einem
 * anderen Gerät erreicht ein Offline-Gerät erst beim nächsten Online-Laden – die Frist begrenzt, wie lange ein
 * dort gelöschter Plan noch angezeigt werden kann. Quelle: PRODUKTENTSCHEIDUNG (Wächter-Auflage Etappe C).
 */
export const HEALTH_PLAN_CACHE_MAX_AGE_DAYS = 14;

// ---------------------------------------------------------------------------------------------------------
// Phase 4 · Trainingstagebuch (docs/PLAN-PHASE-4.md Abschnitt 3.8). Ab Etappe B identisch als CHECK in der
// Datenbank (db-sync.test.ts). Werte ohne Studienbeleg sind PRODUKTENTSCHEIDUNG und gehen in die fachliche Prüfung.
// ---------------------------------------------------------------------------------------------------------

/**
 * Grenzen eines Tagebuch-Eintrags (harte Grenzen, großzügig). Quelle: PRODUKTENTSCHEIDUNG.
 * - Gewicht = PLANNED_LOAD_LIMITS.targetWeightKg.max (je Hantel bzw. Kugel, Langhantel gesamt), 0 = ohne Zusatzlast.
 * - Notiz 280 Zeichen, gezählt in Code-Points (wie char_length in Postgres, nicht UTF-16-Einheiten).
 * - Nachtragen höchstens 14 Tage zurück, höchstens 1 Tag in der Zukunft (Zeitzonen-Toleranz wie
 *   MEASURED_ON_MAX_DAYS_AHEAD); Nachholen nur in der ISO-Woche des ursprünglichen Termins ± 1 Tag (W2).
 * - Höchstens 10 neue Einträge je Kalendertag (Schutz gegen Missbrauch).
 */
export const SESSION_LOG_LIMITS = {
  exercisesPerSession: { min: 1, max: 12 },
  setsPerExercise: { min: 1, max: 10 },
  reps: { min: 0, max: 100 },
  weightKg: { min: 0, max: PLANNED_LOAD_LIMITS.targetWeightKg.max },
  durationS: { min: 1, max: 600 },
  notesMaxChars: 280,
  backdateDays: 14,
  futureDays: 1,
  weekToleranceDays: 1,
  maxLogsPerDay: 10,
} as const;

/**
 * RPE je Satz 5–10 in 0,5er-Schritten, eingegeben als „Wiederholungen in Reserve“ (0 / 1 / 2 / 3 / 4 / 5+).
 * Quelle: Zourdos MC et al. (2016), „Novel resistance training-specific rating of perceived exertion scale
 * measuring repetitions in reserve“, J Strength Cond Res 30(1):267–275.
 */
export const SET_RPE_LIMITS = { min: 5, max: 10, step: 0.5 } as const;

/**
 * Belastungsempfinden der ganzen Einheit 0–10, ganzzahlig.
 * Quellen: Borg GA (1982), Med Sci Sports Exerc 14(5):377–381 (CR10-Skala); Foster C et al. (2001), „A new approach
 * to monitoring exercise training“, J Strength Cond Res 15(1):109–115 (Session-RPE).
 */
export const SESSION_RPE_LIMITS = { min: 0, max: 10 } as const;

/** Ausdauer-Eintrag: Dauer 1 min–12 h, Distanz 0–500 km, Höhenmeter 0–10 000 m. Quelle: PRODUKTENTSCHEIDUNG. */
export const CARDIO_LOG_LIMITS = {
  durationS: { min: 60, max: 12 * 60 * 60 },
  distanceM: { min: 0, max: 500_000 },
  elevationM: { min: 0, max: 10_000 },
} as const;

/**
 * Plausibilität der Geschwindigkeit je Art in km/h – darüber nur WARNUNG „Bitte prüfen“, kein Fehler.
 * Quelle: PRODUKTENTSCHEIDUNG, orientiert an Weltrekord-Durchschnitten: Laufen 25 (Marathon-Weltrekord ≈ 21 km/h),
 * Rad 70 (Stunden-Weltrekord ≈ 56 km/h, bergab mehr), Schwimmen 8 (Langstrecken-Weltrekorde ≈ 6–7 km/h);
 * Gehen 10 (zügiges Freizeit-Gehen ≈ 5–7 km/h – schneller ist meist schon Laufen).
 */
export const CARDIO_PLAUSIBILITY_KMH = { walk: 10, run: 25, bike: 70, swim: 8 } as const;

/**
 * Kalibrierung ohne RPE-Angabe: RPE 10 annehmen („keine Reserve“ = vorsichtigste Schätzung des Arbeitsgewichts).
 * Quelle: PRODUKTENTSCHEIDUNG.
 */
export const CALIBRATION_MISSING_RPE = 10;

/** Pausentimer: Anpassen in 15-s-Schritten, 0–600 s. Quelle: PRODUKTENTSCHEIDUNG; Pausen selbst aus REST_RANGES_S. */
export const REST_TIMER = { stepS: 15, minS: 0, maxS: 600 } as const;

/** So viele Wochen Einträge liegen im (geschützten) Gerätespeicher. Quelle: PRODUKTENTSCHEIDUNG. */
export const LOG_CACHE_WEEKS = 12;

/**
 * Plausibilitäts-Bestätigung beim Gewicht (W5): Mehr als 10 % über dem Progressions-Zustand zählt für die
 * Progression nur nach ausdrücklicher Bestätigung (gleiche Grenze wie LOAD_PROGRESSION.maxIncreaseFraction).
 * Ohne Zustand (erster Eintrag, eigenes Startgewicht) gelten absolute Schwellen je Geräte-Art: Kurzhantel/Kettlebell
 * 50 kg je Stück, Langhantel und Maschine 200 kg. Mehr als 3-mal so viele Wiederholungen wie geplant → Hinweis
 * „Tippfehler?“. Deutlich leichter (unter 50 % des Zustands oder unter der kleinsten eigenen Stufe, z. B. 2 statt
 * 20 kg) wird als neuer Ausgangspunkt ebenfalls nur nach Bestätigung übernommen.
 * Quelle: PRODUKTENTSCHEIDUNG (Schutz vor Tippfehlern wie 225 statt 22,5 kg).
 */
export const WEIGHT_CONFIRM_LIMITS = {
  relativeIncrease: LOAD_PROGRESSION.maxIncreaseFraction,
  relativeDecrease: 0.5,
  absoluteKg: { free_weight: 50, barbell: 200, machine: 200 },
  repsTypoFactor: 3,
} as const;

/**
 * Wiedereinstieg nach Pause (Gratis-Schutzregel, nur Anzeige – der Rohwert bleibt): Pause = mehr als 4 Wochen
 * (28 Tage) ohne Training dieser Übung an mindestens dem heute gezeigten Gewicht; dann zeigt die erste Einheit Gewicht ×0,9,
 * Ziel-Wdh. = reps_min, keinen Zusatzsatz und RPE −1 (nie unter 5). Diese Einheit zählt nicht für die Progression;
 * danach geht es mit dem Rohwert weiter. Fällt sie in eine Erholungswoche, gewinnt jeweils die strengere Regel
 * (kein doppeltes ×0,9).
 * Quelle: Mujika I, Padilla S (2000), „Detraining: loss of training-induced physiological and performance
 * adaptations. Part I“, Sports Med 30(2):79–87 (Kraftverlust nach mehrwöchiger Pause). Schwelle und Faktoren:
 * PRODUKTENTSCHEIDUNG, fachliche Prüfung vor Veröffentlichung.
 */
export const RETURN_AFTER_PAUSE = { pauseDays: 28, loadFactor: 0.9, rpeReduction: 1 } as const;

/**
 * Trainingsplan als PDF (docs/PLAN-PDF-EXPORT.md §5, Wächter B9): A4 hochkant ist schmal – höchstens 4
 * Mitschreib-Spalten; mehr (bis 8, „mehr Wochen“) nur auf Einheiten-Seiten im Querformat. Standard: 4 hochkant
 * (§10 Frage 2). Zeilen je Tabelle so, dass eine Seite bei Mindestschrift 10 pt nicht überläuft. Name auf dem
 * Deckblatt höchstens 60 Zeichen. Quelle: PRODUKTENTSCHEIDUNG (Wächter-Auflage B9), Seitenmaße DIN EN ISO 216.
 */
export const PRINT_EXPORT = {
  defaultLogColumns: 4,
  maxLogColumnsPortrait: 4,
  maxLogColumnsLandscape: 8,
  weekRowsPerPage: 10,
  enduranceRowsPerPage: 20,
  nameMaxLength: 60,
  /**
   * Seitenumbruch der Einheiten-Seiten (Wächter K2): grobe Höhen-Schätzung in mm, damit eine Einheit mit vielen
   * bzw. langen Übungen auf eine Folgeseite umbricht statt über A4 hinauszulaufen. Werte passen zum Layout in
   * packages/ui/src/print/render-html.ts (Innenränder, 11 pt Text, 10 pt Tabelle, schmalste Übungs-Spalte) und
   * sind bewusst vorsichtig; geprüft im Playwright-Test apps/mobile/e2e/print-pages.spec.ts (Belastungstest).
   */
  layout: {
    /** Nutzbare Höhe je Seite (A4 minus Innenränder und Fußzeile) mit Sicherheitsabstand. */
    pageHeightMm: { portrait: 250, landscape: 172 },
    /** Zeichen je Zeile im Fließtext bzw. in der Übungs-Spalte (schmalste Variante). */
    bodyCharsPerLine: { portrait: 85, landscape: 125 },
    exerciseCharsPerLine: { portrait: 20, landscape: 27 },
    bodyLineMm: 5.3,
    tableLineMm: 4.8,
    /** Zellen-Innenabstand plus Rahmen je Tabellenzeile. */
    rowPaddingMm: 2.8,
    /** Mindesthöhe einer Übungs-Zeile (Mitschreib-Feld). */
    rowMinMm: { portrait: 10.6, landscape: 9.6 },
    /** Überschrift + Tage/Ort/Dauer, Zwischenüberschrift, Tabellen-Titel + Kopfzeile, Hinweis unter der Tabelle. */
    sessionHeaderMm: 15,
    subheadingMm: 8,
    tableHeadMm: 19,
    tableHintMm: 13,
    paragraphGapMm: 3,
  },
} as const;
