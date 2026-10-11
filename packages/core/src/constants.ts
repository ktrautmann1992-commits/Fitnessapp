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
 * Gesprächstest zur Anstrengung 0–10 eines Ausdauer-Eintrags (Erklärung beim Eintragen): bis `fullSentencesMax`
 * „in ganzen Sätzen unterhalten“ (passt zu ENDURANCE_EFFORT.easyMax = 4), bis `shortSentencesMax` „nur kurze Sätze“,
 * bis `fewWordsMax` „nur einzelne Wörter“, darüber „Sprechen kaum möglich“; 0 = Ruhe.
 * Quellen: Foster C et al. (2008), J Cardiopulm Rehabil Prev 28(1):24–30 (Talk-Test); Reed JL, Pipe AL (2014),
 * „The talk test: a useful tool for prescribing and monitoring exercise intensity“, Curr Opin Cardiol 29(5):475–480;
 * Borg GA (1982) (CR10). Grenzen der Stufen: PRODUKTENTSCHEIDUNG.
 */
export const TALK_TEST_BANDS = {
  fullSentencesMax: 4,
  shortSentencesMax: 6,
  fewWordsMax: 8,
} as const;

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
 * Verlauf: so viele Einheiten zeigt die Liste je Schritt („Weitere anzeigen“) bzw. lädt die App online je Seite nach
 * (docs/PLAN-PHASE-4.md 6.1 Punkt 5, „je 20 nachladen“). Quelle: PRODUKTENTSCHEIDUNG.
 */
export const HISTORY_PAGE_SIZE = 20;

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

/**
 * Übungs-Glossar (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 7.1/8.1, Etappe G1): Suchwort höchstens 100 Zeichen (längere
 * Eingaben werden gekürzt – kein Übungsname ist annähernd so lang); höchstens 6 „Ähnliche Übungen“ (gleich viele wie
 * später die Tausch-Vorschläge, SWAP_RULES.maxCandidates). Quelle: PRODUKTENTSCHEIDUNG (Lesbarkeit am Handy).
 */
export const GLOSSARY_LIMITS = { queryMaxChars: 100, similarMax: 6 } as const;

/**
 * Übungen tauschen (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 4.1, 4.2, 5.1, Etappe T1). Quelle: PRODUKTENTSCHEIDUNG
 * (Lesbarkeit am Handy, Schutz vor einseitigen Plänen, Speicherplatz) – fachlich zu bestätigen.
 * - `maxPerUser`: technische Obergrenze der Ausschlüsse („Ab jetzt immer“) je Person (später auch im Trigger, T3).
 * - `manyExclusionsNotice`: ab so vielen Ausschlüssen an einem Ort der Hinweis „Plan wird einseitiger“.
 */
export const EXERCISE_PREFERENCE_LIMITS = { maxPerUser: 100, manyExclusionsNotice: 10 } as const;

/**
 * Tausch-Vorschläge (4.1): höchstens 6 je Übung (gleich viele wie die „Ähnlichen Übungen“ im Glossar).
 * `keyPatternGroups`: Grundbausteine einer Einheit (4.2, PLAN-KOERPERGEWICHT §4/W7) – fällt die letzte Übung einer
 * Gruppe durch „Hier nicht machbar“ weg, nennt die App das ausdrücklich (nur Anzeige, wie `no_pull_exercise`).
 * Quelle: PRODUKTENTSCHEIDUNG.
 */
export const SWAP_RULES = {
  maxCandidates: 6,
  keyPatternGroups: [['horizontal_pull', 'vertical_pull'], ['hinge']],
} as const satisfies {
  maxCandidates: number;
  keyPatternGroups: readonly (readonly MovementPattern[])[];
};

/**
 * „Nur heute“ vor dem Training (Day-Swaps, 5.1): höchstens 200 Einträge im Gerätespeicher (PRODUKTENTSCHEIDUNG);
 * `storedOrderNo` höchstens so groß wie `planned_exercises.order_no` in der Datenbank (1–8,
 * PLAN_BLOCK_LIMITS.exercisesPerSession, Wächter T1-K9).
 */
export const DAY_SWAP_LIMITS = {
  maxEntries: 200,
  maxStoredOrderNo: PLAN_BLOCK_LIMITS.exercisesPerSession,
} as const;

// ---------------------------------------------------------------------------------------------------------
// Phase 5 · Ernährung (docs/PLAN-PHASE-5.md Abschnitt 4, Etappe N1)
//
// Alle Formeln und Grenzwerte der Ernährungs-Engine (`packages/core/src/nutrition/`). Die Schutzgrenzen gelten
// ausschließlich in `clampCalorieTarget` (nutrition/limits.ts) und sind NICHT abschaltbar – kein Parameter, keine
// Einstellung und kein Testschalter lockert sie.
// Hinweis zu den Quellen: Die Zitate stammen aus dem Plan und wurden in Etappe N1 ohne Zugriff auf die
// Originalarbeiten gegengelesen. Wo der Wortlaut/Code nicht offline bestätigt werden konnte, steht
// „VOR LIVEGANG FACHLICH PRÜFEN“. Produktentscheidungen sind als PRODUKTENTSCHEIDUNG markiert.
// ---------------------------------------------------------------------------------------------------------

/**
 * Grundumsatz nach Mifflin-St Jeor: 10 × kg + 6,25 × cm − 5 × Jahre + s.
 * s = +5 (männlich), −161 (weiblich), −78 (divers/keine Angabe = Mittelwert beider Werte, Phase-1-Frage 9).
 * Quelle: Mifflin MD, St Jeor ST et al. (1990), „A new predictive equation for resting energy expenditure in
 * healthy individuals“, Am J Clin Nutr 51(2):241–247. Genauigkeit: Frankenfield D et al. (2005),
 * J Am Diet Assoc 105(5):775–789 (bei ca. 80 % der Normalgewichtigen innerhalb ±10 %).
 * `validAge`: Altersspanne der Originalstudie (19–78 Jahre); außerhalb Hinweis `bmr_estimate_age` (Plan 4.3, K2).
 * `limitsSexOffsetUnknown` (Wächter N1, S1): Für die SCHUTZGRENZEN rechnet divers/keine Angabe mit dem männlichen
 * Offset (+5, höherer Grundumsatz = sichere Richtung, wie max(Mifflin, Katch)); der Vorschlag bleibt beim
 * Mittelwert −78. PRODUKTENTSCHEIDUNG.
 */
export const MIFFLIN_ST_JEOR = {
  kgFactor: 10,
  cmFactor: 6.25,
  ageFactor: 5,
  sexOffset: { male: 5, female: -161, diverse: -78, unspecified: -78 },
  validAge: { min: 19, max: 78 },
  limitsSexOffsetUnknown: 5,
} as const;

/**
 * Grundumsatz nach Katch-McArdle: 370 + 21,6 × fettfreie Masse (kg).
 * Quelle: McArdle WD, Katch FI, Katch VL, „Exercise Physiology: Nutrition, Energy, and Human Performance“
 * (Lehrbuch, Formel seit den 1990er-Auflagen) – Auflage/Seite VOR LIVEGANG FACHLICH PRÜFEN.
 * Nur für den VORSCHLAG (bmrForNeeds); alle Schutzgrenzen rechnen mit max(Mifflin, Katch) (Plan B3, R2-B1).
 */
export const KATCH_MCARDLE = { intercept: 370, ffmFactor: 21.6 } as const;

/**
 * Katch-McArdle und gemessene fettfreie Masse nur mit einer Körperfett-Messung, die höchstens so viele Tage alt
 * ist (Tag der Berechnung minus Messdatum). Quelle: PRODUKTENTSCHEIDUNG (Plan 4.3, Gründer-Frage 16 A Nr. 17).
 */
export const BODY_FAT_MAX_AGE_DAYS = 90;

/**
 * Höchstes plausibles Alter für die Ernährungs-Engine (Plausibilitätsgrenze gegen Tippfehler; Mifflin ist nur bis
 * 78 Jahre validiert, Tests bis 100). Darüber verständlicher Fehler statt unsinniger Werte. PRODUKTENTSCHEIDUNG
 * (Wächter N1, K5).
 */
export const NUTRITION_MAX_AGE_YEARS = 120;

/**
 * Hinweis „Dein Gewicht ist älter als 3 Monate“, wenn die neueste Gewichtsangabe älter als so viele Tage ist
 * (es wird trotzdem weitergerechnet). Quelle: PRODUKTENTSCHEIDUNG (Plan 4.9).
 */
export const WEIGHT_OUTDATED_AFTER_DAYS = 90;

/**
 * Alltagsfaktor OHNE Sport (der Sport wird tagesgenau als Trainingsenergie addiert).
 * Quelle: D-A-CH-Referenzwerte für die Nährstoffzufuhr (DGE, ÖGE, SGE), Kapitel Energie: PAL-Beispiele
 * 1,4–1,5 (sitzend, wenig Bewegung) / 1,6–1,7 (sitzend mit Gehen/Stehen) / 1,8–1,9 (überwiegend stehend/gehend) /
 * 2,0–2,4 (körperlich anstrengende Arbeit). Wir nehmen die MITTE der Spanne (Plan 4.4, S1) – Unterschätzen wäre
 * für die Schutzgrenzen das Risiko. Auflage/Seite der D-A-CH-Tabelle VOR LIVEGANG FACHLICH PRÜFEN.
 * `default`: ohne Angabe 1,45 (überwiegend sitzend) – unterschätzt den Bedarf aktiver Menschen eher; die App sagt
 * das ehrlich (Hinweis `activity_level_default`). PRODUKTENTSCHEIDUNG (16 B (d)).
 */
export const ACTIVITY_FACTORS = {
  sedentary: 1.45,
  light: 1.65,
  active: 1.85,
  very_active: 2.2,
  default: 1.45,
} as const;

/**
 * MET-Werte für die Trainingsenergie (Plan 4.4, S11b): kcal netto = (MET − 1) × kg × Stunden (die Ruheenergie
 * steckt schon im Grundbedarf); für die Energieverfügbarkeit brutto = MET × kg × Stunden (R2-K2).
 * `effort_target` 1–2 = „sehr locker“ (`low`), 3–4 = „locker“ (`high`); fehlend/unbekannt = `fallback`
 * (= jeweils der HÖHERE Wert: mehr Trainingsenergie → höheres Ziel → sichere Richtung).
 * Quellen: Ainsworth BE et al. (2011), „2011 Compendium of Physical Activities: a second update of codes and MET
 * values“, Med Sci Sports Exerc 43(8):1575–1581; Herrmann SD et al. (2024), „2024 Adult Compendium of Physical
 * Activities“, J Sport Health Sci 13(1):6–12.
 * Codes (nach Erinnerung an die Ausgabe 2011, in N1 NICHT gegen das Original geprüft – VOR LIVEGANG FACHLICH
 * PRÜFEN, Plan S11c; weichen die Originalwerte ab, gelten die Originalwerte):
 * - Kraft 3,5: 02054 „resistance (weight) training, multiple exercises, 8–15 repetitions at varied resistance“.
 * - Laufen 6,0 / 7,0: 12029 „running, 4 mph (13 min/mile)“ / 12020 „jogging, general“.
 * - Gehen 3,5 / 4,3: 17190 „walking, 2.8–3.2 mph, level, moderate pace“ / 17200 „walking, 3.5 mph, level, brisk“.
 *   Der Plan nennt für „zügig“ 17231; der Wert 4,3 passt nach unserer Erinnerung zu 17200 – prüfen.
 * - Rad 5,5 / 6,8: 6,8 = 02012 (Ergometer, leicht bis moderat) bzw. 01020 (draußen, 10–11,9 mph, gemütlich);
 *   für 5,5 ist kein Code bestätigt – prüfen (Plan: 02012 vs. 02013).
 * - Schwimmen 5,0 / 5,8: 5,8 = 18310 „swimming laps, freestyle, front crawl, slow, light or moderate effort“;
 *   für 5,0 ist kein Code bestätigt – prüfen.
 * - Unbekannte Sportart 7,0: PRODUKTENTSCHEIDUNG (höchster lockerer Wert, sichere Richtung).
 */
export const TRAINING_MET = {
  strength: 3.5,
  endurance: {
    run: { low: 6.0, high: 7.0, fallback: 7.0 },
    walk: { low: 3.5, high: 4.3, fallback: 4.3 },
    bike: { low: 5.5, high: 6.8, fallback: 6.8 },
    swim: { low: 5.0, high: 5.8, fallback: 5.8 },
  },
  unknownEndurance: 7.0,
  /** `effort_target` bis einschließlich diesem Wert gilt als „sehr locker“. */
  lowEffortMax: 2,
} as const;

/**
 * Plausibilitätsdeckel der (netto) Trainingsenergie je Tag in kcal (Plan 4.4, S11d). Greift er, plant der Tag
 * OHNE Defizit (Untergrenze = TagesbedarfGrenze, Hinweis `training_energy_capped`, R2-S8), weil der Deckel nur den
 * gerechneten Bedarf senkt, nicht die echte Belastung. Quelle: PRODUKTENTSCHEIDUNG (Beispiel: 300 kg × 240 min
 * Laufen wären 7.200 kcal).
 */
export const TRAINING_KCAL_DAY_MAX = 3000;

/**
 * Zielanpassung vom Grundbedarf OHNE Trainingsenergie (Plan 4.5, S2): Vorschlag = Grundbedarf × (1 + Anpassung)
 * + Trainingsenergie + 4b-Versatz. Startwerte, PRODUKTENTSCHEIDUNG – fachlich zu prüfen.
 * Quellen/Orientierung: Fettverlust/Definition: Helms ER et al. (2014), J Int Soc Sports Nutr 11:20 (moderate
 * Defizite); Muskelaufbau: Iraki J et al. (2019), Sports 7(7):154 (Einsteiger mehr, Fortgeschrittene weniger
 * Überschuss).
 */
export const GOAL_ENERGY_ADJUSTMENT = {
  fat_loss: -0.2,
  definition: -0.1,
  muscle_gain: { beginner: 0.1, advanced: 0.05, competitive: 0.05 },
  general_fitness: 0,
  endurance: 0,
} as const;

/**
 * Energiegehalt von 1 kg Körpergewicht als PLANUNGSWERT (nur für den Deckel „~1 % Körpergewicht pro Woche“ und den
 * Überschussdeckel – keine Prognosen, deshalb nie „Du verlierst X kg“).
 * Quelle: Wishnofsky M (1958), Am J Clin Nutr 6(5):542–546; Einschränkung: Hall KD (2008), „What is the required
 * energy deficit per unit weight loss?“, Int J Obes 32(3):573–576.
 */
export const KCAL_PER_KG_BODY_WEIGHT = 7700;

/**
 * Höchste geplante Zunahme pro Woche als Anteil des Körpergewichts (0,005 = 0,5 %) für den Überschussdeckel.
 * Quelle: Iraki J et al. (2019), Sports 7(7):154 (0,25–0,5 % pro Woche). PRODUKTENTSCHEIDUNG: oberer Wert.
 */
export const MAX_WEEKLY_WEIGHT_GAIN_FRACTION = 0.005;

/**
 * Energieverfügbarkeit (EA): Untergrenze = min(TagesbedarfGrenze, 30 × fettfreie Masse + Trainingsenergie BRUTTO)
 * (Plan 4.6 Nr. 4, S2, R2-K2). EA = (Zufuhr − Trainingsenergie) / fettfreie Masse.
 * Quellen: Loucks AB, Kiens B, Wright HH (2011), „Energy availability in athletes“, J Sports Sci 29 Suppl 1:S7–S15;
 * Mountjoy M et al. (2023), „2023 International Olympic Committee's (IOC) consensus statement on Relative Energy
 * Deficiency in Sport (REDs)“, Br J Sports Med 57(17):1073–1097.
 * Brutto/netto: Wir rechnen die Trainingsenergie hier BRUTTO (MET × kg × h) – das ergibt die höhere, also
 * vorsichtigere Untergrenze. Ob Loucks 2011 brutto oder netto definiert, konnte in N1 nicht am Original geprüft
 * werden – VOR LIVEGANG FACHLICH PRÜFEN (bei „netto“ bleibt brutto trotzdem die sichere Richtung).
 */
export const EA_MIN_KCAL_PER_KG_FFM = 30;

/**
 * Schätzung der fettfreien Masse ohne Körperfett-Messung (nur für die EA-Untergrenze; höhere FFM = vorsichtiger):
 * FFM = 9270 × kg / (a + b × BMI); Männer a = 6680, b = 216; Frauen a = 8780, b = 244; divers/keine Angabe =
 * Mittelwert beider Ergebnisse (PRODUKTENTSCHEIDUNG, Plan 4.6 Nr. 4) – für die EA-Untergrenze (eine Grenze) gilt bei
 * divers/keine Angabe die Formel für Männer (höhere FFM = vorsichtiger; Wächter N1, S1).
 * Quelle: Janmahasatian S, Duffull SB, Ash S, Ward LC, Byrne NM, Green B (2005), „Quantification of lean
 * bodyweight“, Clin Pharmacokinet 44(10):1051–1065. Formel nach unserer Kenntnis wie im Original; Seite VOR
 * LIVEGANG FACHLICH PRÜFEN.
 */
export const JANMAHASATIAN_FFM = {
  numerator: 9270,
  male: { a: 6680, b: 216 },
  female: { a: 8780, b: 244 },
} as const;

/**
 * Überschussdeckel `surplusCap` (Plan 4.6, H2): immer gesetzt, Standard 0,10 (= PORTION_TOLERANCE), Sonderfälle
 * (unter 18, kein Gesundheits-Check) 0,05; bei mehreren Fällen gilt der KLEINSTE Wert. Der Zod-Typ erzwingt
 * [0,05; 0,10]. PRODUKTENTSCHEIDUNG (Wächter N1, K4): Iraki J et al. (2019), Sports 7(7):154 nennen eine Zunahme
 * von ca. 0,25–0,5 % Körpergewicht pro Woche (siehe MAX_WEEKLY_WEIGHT_GAIN_FRACTION), keinen Prozent-Deckel – 10 %
 * ist ein vorsichtiger eigener Wert. VOR LIVEGANG FACHLICH PRÜFEN.
 */
export const SURPLUS_CAP = { default: 0.1, special: 0.05 } as const;

/**
 * Toleranz der Tagessumme des Essensplans um das Ziel (Planband, Plan 4.6.1): ±10 %, nach unten zusätzlich durch
 * die Schutzgrenzen begrenzt. Quelle: PRODUKTENTSCHEIDUNG.
 */
export const PORTION_TOLERANCE = 0.1;

/**
 * Sonderfall-Deckel des Defizits (Anteil unter TagesbedarfGrenze; strengster Wert gewinnt, Plan 4.9):
 * - noHealthCheck 0,15: wie beim Training vorsichtig (B4, `planSafetyRules`: kein Check → vorsichtig),
 * - medical 0,15: Flags `medication` oder `medical_clearance_recommended`,
 * - senior 0,15: ab 65 (Muskelerhalt; Bauer J et al. (2013), PROT-AGE, J Am Med Dir Assoc 14(8):542–559),
 * - lowNormalBmi 0,10: Erwachsene mit BMI 18,5 bis unter 20.
 * Werte: PRODUKTENTSCHEIDUNG (Gründer-Frage 16 A Nr. 9) – fachlich zu bestätigen.
 * Kein Defizit (Deckel 0) gilt bei `maintenance_only`, unter 18, bei Untergewicht und an Tagen mit gedeckelter
 * Trainingsenergie.
 */
export const SPECIAL_CASE_DEFICIT_CAPS = {
  noHealthCheck: 0.15,
  medical: 0.15,
  senior: 0.15,
  lowNormalBmi: 0.1,
} as const;

/**
 * Altersgrenzen der Ernährung (tagesgenau ab dem Geburtstag, Plan 4.9): unter 18 kein Defizit (Gründer-Entscheidung
 * 2), ab 65 vorsichtiger. Gleiche Werte wie AGE_PLAN_RULES (Training), damit beide Bereiche übereinstimmen.
 */
export const NUTRITION_AGE_RULES = {
  minorBelowAge: AGE_PLAN_RULES.minor.belowAge,
  seniorFromAge: AGE_PLAN_RULES.senior.fromAge,
} as const;

/**
 * BMI-Grenzen für Erwachsene (für unter 18 gelten Perzentilen – dort keine BMI-Regeln, Plan 4.9).
 * Quelle: WHO-BMI-Klassifikation (Untergewicht < 18,5; deutliches Untergewicht < 17; Adipositas ≥ 30).
 * `lowNormal` 20 und `proteinReference` 25 (Eiweiß rechnet ab BMI 30 mit dem Gewicht bei BMI 25):
 * PRODUKTENTSCHEIDUNG (Plan 4.7, 4.9).
 */
export const BMI_LIMITS = {
  severeUnderweight: 17,
  underweight: 18.5,
  lowNormal: 20,
  proteinReferenceFrom: 30,
  proteinReference: 25,
} as const;

/**
 * Eiweiß in g je kg (Referenz-)Körpergewicht (Plan 4.7, S16).
 * Quellen: Morton RW et al. (2018), Br J Sports Med 52(6):376–384; Jäger R et al. (2017), ISSN Position Stand
 * „Protein and exercise“, J Int Soc Sports Nutr 14:20; Thomas DT, Erdman KA, Burke LM (2016), ACSM/AND/DC Joint
 * Position Statement „Nutrition and Athletic Performance“, Med Sci Sports Exerc 48(3):543–568.
 * - `max` 2,2 g/kg: allgemeine Obergrenze (PRODUKTENTSCHEIDUNG).
 * - `cautiousMax` 1,6 g/kg: unter 18, `medication`, `medical_clearance_recommended`, kein Gesundheits-Check
 *   (PRODUKTENTSCHEIDUNG, vorsichtig).
 * - `senior` 1,2–1,6 g/kg ab 65: Bauer J et al. (2013), PROT-AGE, J Am Med Dir Assoc 14(8):542–559 (Gesunde
 *   1,0–1,2, Aktive 1,2–1,5 g/kg); Deckel 1,6 wegen der Nierenfunktion im Alter – PRODUKTENTSCHEIDUNG.
 * - `kidneyNoticeAbove` 1,6 g/kg: darüber fester Hinweis `protein_kidney_notice` (der Check fragt nicht nach den
 *   Nieren).
 */
export const PROTEIN_G_PER_KG = {
  byGoal: {
    fat_loss: 2.0,
    definition: 2.2,
    muscle_gain: 1.8,
    general_fitness: 1.4,
    endurance: 1.4,
  },
  max: 2.2,
  cautiousMax: 1.6,
  senior: { min: 1.2, max: 1.6 },
  kidneyNoticeAbove: 1.6,
} as const;

/**
 * Fett als Anteil der Energie: Standard 25 %, mindestens 20 % (Plan 4.7).
 * Quellen: Thomas DT et al. (2016), Med Sci Sports Exerc 48(3):543–568 (20–35 %); D-A-CH-Referenzwerte (Richtwert
 * 30 %). Standard 25 %: PRODUKTENTSCHEIDUNG.
 */
export const FAT_ENERGY_SHARE = { default: 0.25, min: 0.2 } as const;

/**
 * Kohlenhydrate:
 * - `referenceMinG` 130 g/Tag: Institute of Medicine (2005), Dietary Reference Intakes for Energy, Carbohydrate,
 *   Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids (RDA Kohlenhydrate Erwachsene). Unterschritten →
 *   nur Hinweis `carbs_below_reference`, die Energie bleibt verbindlich (R2-K1). (Schwangerschaft/Stillzeit wären
 *   175/210 g – derzeit `no_targets`, K3.)
 * - `enduranceGPerKg`: Ziel Ausdauer, Richtwert nach Trainingsminuten des Tages (untere Werte der Spannen
 *   < 60 min 3–5, 60–120 min 5–7, > 120 min 6–10 g/kg). Quellen: Thomas DT et al. (2016); Burke LM et al. (2011),
 *   „Carbohydrates for training and competition“, J Sports Sci 29 Suppl 1:S17–S27. Untere Werte:
 *   PRODUKTENTSCHEIDUNG (die Energie ist verbindlich).
 */
export const CARBS = {
  referenceMinG: 130,
  enduranceGPerKg: [
    { maxMinutes: 59, gPerKg: 3 },
    { maxMinutes: 120, gPerKg: 5 },
    { maxMinutes: Number.POSITIVE_INFINITY, gPerKg: 6 },
  ],
} as const;

/** Energie je Gramm (Atwater-Faktoren, auch LMIV Anhang XIV): Eiweiß 4, Kohlenhydrate 4, Fett 9 kcal/g. */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

/**
 * Rundung der Ausgabe (Plan 4.6.2, 4.7): kcal auf 10, Makros auf 5 g – gerichtet (nie aus dem erlaubten Bereich).
 * Quelle: PRODUKTENTSCHEIDUNG.
 */
export const NUTRITION_ROUNDING = { kcal: 10, macroG: 5 } as const;

/**
 * 4b-Versatz (Plan 4.6, R2-S5, H3): `clampCalorieAdjustment` begrenzt NUR die Schrittweite je Anpassung
 * (`stepMaxKcal` 150) und die Summe des Versatzes (`offsetMaxKcal` ±1.000). Alle Schutzgrenzen gelten danach in
 * `clampCalorieTarget`. 4b wählt `LIVE_ADJUSTMENT.calorieStepKcal` ≤ 150. PRODUKTENTSCHEIDUNG.
 */
export const ADJUSTMENT_STEP_MAX_KCAL = 150;
export const ADJUSTMENT_OFFSET_MAX_KCAL = 1000;

/**
 * Mahlzeiten-Plätze je `meals_per_day` (Plan 4.8, `MEAL_SLOT_LAYOUTS`) mit Energieanteilen (Summe 1) und
 * Standard-Uhrzeiten (Minuten nach Mitternacht) zur Zuordnung vor/nach dem Training.
 * Uhrzeiten aus dem Plan (Frühstück 7:30, Snack 10:00, Mittag 12:30, Snack 15:30, Abend 18:30, Spät-Snack 20:30);
 * Hauptmahlzeit bei 1 Mahlzeit 12:30, zusätzlicher Snack bei 7–8 Mahlzeiten 17:00 bzw. 21:30.
 * Anteile: PRODUKTENTSCHEIDUNG (Beispiel aus dem Plan: 4 Mahlzeiten 25/35/30/10 %).
 */
export const MEAL_SLOT_TIMES = {
  main: 750,
  breakfast: 450,
  snack_morning: 600,
  lunch: 750,
  snack_afternoon: 930,
  snack_pre_dinner: 1020,
  dinner: 1110,
  snack_late: 1230,
  snack_night: 1290,
} as const;

export const MEAL_SLOT_LAYOUTS = {
  1: [['main', 1]],
  2: [
    ['lunch', 0.5],
    ['dinner', 0.5],
  ],
  3: [
    ['breakfast', 0.3],
    ['lunch', 0.35],
    ['dinner', 0.35],
  ],
  4: [
    ['breakfast', 0.25],
    ['lunch', 0.35],
    ['snack_afternoon', 0.1],
    ['dinner', 0.3],
  ],
  5: [
    ['breakfast', 0.2],
    ['snack_morning', 0.1],
    ['lunch', 0.3],
    ['snack_afternoon', 0.1],
    ['dinner', 0.3],
  ],
  6: [
    ['breakfast', 0.2],
    ['snack_morning', 0.1],
    ['lunch', 0.25],
    ['snack_afternoon', 0.1],
    ['dinner', 0.25],
    ['snack_late', 0.1],
  ],
  7: [
    ['breakfast', 0.18],
    ['snack_morning', 0.08],
    ['lunch', 0.24],
    ['snack_afternoon', 0.08],
    ['snack_pre_dinner', 0.08],
    ['dinner', 0.24],
    ['snack_late', 0.1],
  ],
  8: [
    ['breakfast', 0.17],
    ['snack_morning', 0.08],
    ['lunch', 0.22],
    ['snack_afternoon', 0.08],
    ['snack_pre_dinner', 0.08],
    ['dinner', 0.22],
    ['snack_late', 0.08],
    ['snack_night', 0.07],
  ],
} as const satisfies Record<number, readonly (readonly [keyof typeof MEAL_SLOT_TIMES, number])[]>;

/**
 * Trainingszeit (`training_time`) → angenommene Startzeit in Minuten nach Mitternacht (geplante Einheiten haben
 * keine Uhrzeit). `early` < 8 Uhr. PRODUKTENTSCHEIDUNG – so gewählt, dass die Standard-Mahlzeiten sinnvoll vor bzw.
 * nach dem Training liegen (z. B. „abends“ 17:30 → Abendessen 18:30 nach einer Stunde Training).
 */
export const TRAINING_TIME_START_MINUTES = {
  early: 390,
  morning: 570,
  midday: 690,
  afternoon: 960,
  evening: 1050,
} as const;

/**
 * Zuordnung vor/nach dem Training (Plan 4.8). Quellen: Kerksick CM et al. (2017), ISSN Position Stand „Nutrient
 * timing“, J Int Soc Sports Nutr 14:33; Schoenfeld BJ, Aragon AA (2018), J Int Soc Sports Nutr 15:10; KONZEPT 6.
 * - Mahlzeit „vor dem Training“: 2–3 h vorher; weil die Mahlzeiten feste Uhrzeiten haben, nehmen wir die letzte
 *   Hauptmahlzeit 2–4 h vor dem Start (`preMealMinutes`, Obergrenze 4 h = PRODUKTENTSCHEIDUNG).
 * - „Kleiner Snack vorher“: ein Snack 30–60 min vor dem Start.
 * - „Nach dem Training“: die nächste Mahlzeit bis 2 h nach dem Ende.
 * - `roleShareBonus`: Mahlzeiten vor/nach dem Training je +5 Prozentpunkte Energieanteil, die anderen anteilig
 *   weniger (PRODUKTENTSCHEIDUNG).
 * - `postProteinGPerKg` 0,4 g/kg Eiweiß nach dem Training (Schoenfeld/Aragon 2018) – Richtwert für N3/X4.
 * - `longSessionMinutes`: Ausdauer ab 90 min → Hinweis `long_session_fueling` (30–60 g Kohlenhydrate pro Stunde;
 *   Thomas 2016; Jeukendrup A (2014), Sports Med 44 Suppl 1:S25–S33).
 */
export const MEAL_TIMING_RULES = {
  preMealMinutes: { min: 120, max: 240 },
  preSnackMinutes: { min: 30, max: 60 },
  postMealMaxMinutes: 120,
  roleShareBonus: 0.05,
  postProteinGPerKg: 0.4,
  longSessionMinutes: 90,
} as const;

/**
 * Schwangerschaft/Stillzeit (Modus `no_targets`, Plan 4.9 B5): fester Koffein-Hinweis (Gründer-Frage 16 B (m)).
 * Quelle: BfR-Verbraucherinformation zu Koffein (höchstens 200 mg Koffein am Tag in Schwangerschaft und Stillzeit,
 * gestützt auf EFSA (2015), „Scientific Opinion on the safety of caffeine“, EFSA Journal 13(5):4102) – der
 * WORTLAUT des BfR-Textes konnte in N1 nicht am Original geprüft werden: VOR LIVEGANG FACHLICH PRÜFEN.
 * Begründung des Modus: Koletzko B et al. (2018), Handlungsempfehlungen des Netzwerks Gesund ins Leben „Ernährung
 * und Lebensstil vor und während der Schwangerschaft“ – nach unserer Kenntnis Geburtshilfe Frauenheilkd
 * 78(12):1262–1282; Heft und Seiten VOR LIVEGANG FACHLICH PRÜFEN.
 */
export const PREGNANCY_CAFFEINE_MAX_MG = 200;

// ---------------------------------------------------------------------------------------------------------
// Phase 5 · Lebensmittel und Rezepte (docs/PLAN-PHASE-5.md Abschnitt 5, Etappe N2a)
//
// Grenzen der Inhalts-Schemas (`content/food-schema.ts`, `content/recipe-schema.ts`) und der Prüfregeln R1–R19
// (`content/recipe-checks.ts`). Werte aus dem Plan; Quellen bzw. PRODUKTENTSCHEIDUNG je Eintrag.
// ---------------------------------------------------------------------------------------------------------

/**
 * Grenzen des Lebensmittel-Schemas (Plan 5.1). Nährwerte je 100 g; Summe aus Eiweiß, Kohlenhydraten, Fett und
 * Ballaststoffen höchstens 100 g plus `macroSumToleranceG` (Rundung der Quelle). Einheiten-Umrechnung: Stück bis
 * 3 kg (z. B. Kürbis), EL bis 30 g, TL bis 15 g, Dichte 0,2–2,0 g/ml. PRODUKTENTSCHEIDUNG.
 */
export const FOOD_SCHEMA_LIMITS = {
  kcalPer100g: { min: 0, max: 900 },
  gramsPer100g: { min: 0, max: 100 },
  macroSumToleranceG: 1,
  pieceG: { min: 0.1, max: 3000 },
  tbspG: { min: 1, max: 30 },
  tspG: { min: 0.5, max: 15 },
  mlToG: { min: 0.2, max: 2 },
  aliases: 10,
  substitutes: 5,
} as const;

/**
 * Meal-Prep-Haltbarkeit (Plan 5.1 S12, Regel R9): gekochte Speisen höchstens 3 Tage im Kühlschrank; Reis, Fisch,
 * Hackfleisch und Geflügel höchstens 1 Tag. Grundlage: BfR-Verbrauchertipps zur Lagerung zubereiteter Speisen
 * (u. a. Bacillus cereus in gekochtem Reis). Der WORTLAUT der BfR-Fundstelle konnte in N2a nicht am Original geprüft
 * werden: VOR LIVEGANG FACHLICH PRÜFEN (wortgenaues Zitat mit Fundstelle nachtragen). Werte: PRODUKTENTSCHEIDUNG.
 */
export const MEAL_PREP_FRIDGE_DAYS = { max: 3, sensitiveMax: 1 } as const;

/** Grenzen des Rezept-Schemas (Plan 5.2). */
export const RECIPE_SCHEMA_LIMITS = {
  servings: { min: 1, max: 8 },
  ingredients: { min: 1, max: 20 },
  steps: { min: 1, max: 15 },
  prepMinutes: { min: 1, max: 120 },
  cookMinutes: { min: 0, max: 240 },
  amount: { min: 0.1, max: 5000 },
  declaredKcal: { min: 0, max: 3000 },
  declaredMacroG: { min: 0, max: 300 },
  costLevel: { min: 1, max: 3 },
  equipment: 10,
} as const;

/**
 * Eine Prise in Gramm (Einheit `pinch`, Plan 4.1 `units.ts`). Übliche Küchenangabe etwa 0,3–0,5 g; gewählt wird
 * der obere Wert (Salz eher über- als unterschätzt). PRODUKTENTSCHEIDUNG.
 */
export const PINCH_G = 0.5;

/**
 * Rundung von Zutatenmengen (Plan 6.2): Gramm/ml auf 5 (unter 20 auf 1), Stück auf ½ (Eier ganz), EL/TL auf ½,
 * Prise ganz. PRODUKTENTSCHEIDUNG.
 */
export const AMOUNT_ROUNDING = {
  massStep: 5,
  smallMassStep: 1,
  smallMassBelow: 20,
  pieceStep: 0.5,
  spoonStep: 0.5,
  pinchStep: 1,
} as const;

/**
 * Prüfregeln für Rezepte und Lebensmittel (Plan 5.3).
 * - R3 Makro-Plausibilität: kcal ±10 % (mindestens ±20 kcal), Makros ±15 % (mindestens ±3 g) je Portion.
 * - R4 Atwater je Lebensmittel: 4·Eiweiß + 4·Kohlenhydrate + 9·Fett + 2·Ballaststoffe = kcal ±15 %
 *   (Energie-Umrechnungsfaktoren nach VO (EU) Nr. 1169/2011 (LMIV), Anhang XIV). Zusätzlich mindestens ±4 kcal
 *   absolut, damit sehr energiearme Lebensmittel (z. B. Gurke) nicht an der Rundung der Quelle scheitern
 *   (PRODUKTENTSCHEIDUNG, N2a).
 * - R5 kcal je Portion: Frühstück 200–900, Hauptgericht 300–1.200, Snack 80–500 (gelb).
 * - R11 Mengen je Portion: Salz ≤ 2,5 g, Öl ≤ 30 g, jede Zutat ≤ 600 g (gelb). Öl = Lebensmittel der Abteilung
 *   „Öle, Essig & Saucen“ mit mindestens `oilMinFatG` Fett je 100 g.
 * Werte: PRODUKTENTSCHEIDUNG (Plan 5.3).
 */
export const RECIPE_CHECK_LIMITS = {
  macroPlausibility: { kcalRel: 0.1, kcalAbsMin: 20, macroRel: 0.15, macroAbsMinG: 3 },
  atwater: { protein: 4, carbs: 4, fat: 9, fiber: 2, tolerance: 0.15, absMinKcal: 4 },
  kcalPerServing: {
    breakfast: { min: 200, max: 900 },
    main: { min: 300, max: 1200 },
    snack: { min: 80, max: 500 },
  },
  perServing: { saltMaxG: 2.5, oilMaxG: 30, ingredientMaxG: 600 },
  oilMinFatG: 90,
} as const;

/**
 * Abdeckungsbericht (Regel R16, gelb, Plan 5.4): Anzahl passender Rezepte je Mahlzeit × Ernährungsform × häufige
 * Unverträglichkeit; unter `minPerCombination` (7 = eine Woche ohne Wiederholung) gelber Hinweis.
 * Häufige Unverträglichkeiten: PRODUKTENTSCHEIDUNG.
 */
export const RECIPE_COVERAGE = {
  minPerCombination: 7,
  intolerances: ['gluten', 'lactose', 'dairy', 'eggs', 'peanuts', 'tree_nuts'],
} as const;
