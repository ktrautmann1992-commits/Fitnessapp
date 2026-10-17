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
  GoalType,
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
 * Freie Einheit (docs/PLAN-AUSWERTUNG.md 2.6/4, Etappe A1b): Eintrag ohne geplante Einheit, heute oder höchstens
 * SESSION_LOG_LIMITS.backdateDays Tage zurück, nie in der Zukunft. Der Name kommt aus dieser festen Liste (kein
 * Freitext außer der Notiz) – Kraft ein Name, Ausdauer je Ausdauer-Art. Dieselbe Liste steht in save_session_log
 * (Abgleich in db-sync.test.ts). Freie Einträge zählen nie für Progression, Kalibrierung und den 10-%-Bezug der
 * Ausdauer (verwaiste Einträge zählen dagegen für die Kraft-Progression, Wächter S2/G1), wohl aber in Woche, Verlauf
 * und fürs Tagesziel (A-G7).
 * `strengthMinutesPerSet`: geschätzte Minuten je abgehaktem Kraft-Satz samt Pause – nur für die Trainingsenergie
 * fürs Tagesziel (A-G7), höchstens `strengthMinutesMax`. Quelle: PRODUKTENTSCHEIDUNG (grobe Schätzung; die
 * Trainingsenergie hat zusätzlich den Deckel TRAINING_KCAL_DAY_MAX) – VOR LIVEGANG FACHLICH PRÜFEN.
 */
export const FREE_SESSION = {
  names: {
    strength: 'Freie Kraft-Einheit',
    endurance: { run: 'Lauf', walk: 'Spaziergang', bike: 'Radfahrt', swim: 'Schwimmen' },
  },
  strengthMinutesPerSet: 3,
  strengthMinutesMax: 180,
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
  /**
   * Ernährungs-Dokumente (docs/PLAN-PHASE-5.md 11, Etappe N6 – PDF P5): grobe Höhen-Schätzung in mm für den
   * Seitenumbruch von Wochenübersicht, Rezepten und Einkaufsliste (immer hochkant – nativ gibt es kein Querformat).
   * Werte passen zum Layout in packages/ui/src/print/render-html.ts und sind bewusst vorsichtig; geprüft im
   * Playwright-Test apps/mobile/e2e/print-pages.spec.ts (Belastungstest: 8 Mahlzeiten mit langen Namen, Rezept mit
   * 20 Zutaten und 15 langen Schritten, lange Einkaufsliste). PRODUKTENTSCHEIDUNG (Layout).
   */
  nutritionLayout: {
    /** Logo-Kopf auf der ersten Seite. */
    brandMm: 36,
    h1Mm: 16,
    /** Überschrift Ebene 2 (Rezept-Titel): erste Zeile inkl. Abstand, jede weitere Zeile. */
    h2Mm: 13,
    h2LineMm: 7.5,
    h2CharsPerLine: 45,
    h3Mm: 12,
    /** Fließtext 11 pt bzw. grauer Text 10 pt. */
    bodyCharsPerLine: 80,
    mutedCharsPerLine: 88,
    mutedLineMm: 4.8,
    /** Hinweis-Kasten: Rand, Innenabstand und Titelzeile. */
    noticeBaseMm: 23,
    /** Wochenübersicht (8 Spalten hochkant): Zeichen je Zeile in einer Zelle. */
    weekCellCharsPerLine: 10,
    /** Zutaten-Tabelle: Breite der Zutaten-Spalte und der Mengen-Spalten (Gewichte wie im Renderer). */
    contentWidthMm: 182,
    tableCharMm: 2.05,
    /** Einkaufsliste zweispaltig: Zeichen je Zeile und Höhe je Zeile eines Eintrags. */
    checklistCharsPerLine: 32,
    checklistLineMm: 5.2,
    checklistItemPadMm: 1.8,
    /** Rezept-Schritte (nummerierte Liste). */
    stepCharsPerLine: 80,
    stepGapMm: 1.6,
    /** Höchstens so viele Portions-Spalten je Zutaten-Tabelle (sonst weitere Tabelle). */
    maxPortionColumns: 4,
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
// Das VORZEICHEN je Ziel muss über alle Level gleich bleiben: goalEnergyDirection (goals/profile.ts) leitet die
// Energie-Richtung levelunabhängig ab (Test in goals/profile.test.ts, Wächter Z1 K-4).
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
 * Mindestbreite des Planbands (Plan 4.6.1, Etappe N3, Wächter N3 S1): Liegen Unter- und Obergrenze weniger als
 * 20 kcal auseinander (z. B. sehr niedriger Katch-Bedarf bei Muskelaufbau, Breite 0 möglich), reicht das Band bis
 * Untergrenze + 20 kcal – ein Band der Breite 0 ist mit gerundeten Portionen nicht treffbar. Die UNTERGRENZE geht vor
 * (wie bei der gerichteten Rundung, 4.6.2); sie wird nie gesenkt. Die Obergrenze ist der Überschussdeckel (keine
 * Schutzgrenze aus CLAUDE.md) und wird so höchstens um 20 kcal überschritten. PRODUKTENTSCHEIDUNG.
 */
export const PLAN_BAND_MIN_WIDTH_KCAL = 20;

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
 *   Seit Import-Lauf 1 (PR #47, N2b) zählen – sofern die Quelle sie nennt – auch die übrigen Faktoren aus LMIV
 *   Anhang XIV: organische Säuren 3 kcal/g, Alkohol (Ethanol) 7 kcal/g und mehrwertige Alkohole (Polyole)
 *   2,4 kcal/g. Polyole sind nach LMIV Teil der Kohlenhydrate (Anhang I Nr. 7) und im BLS-Wert „CHO verfügbar“
 *   enthalten; sie werden deshalb aus den Kohlenhydraten herausgerechnet (4 → 2,4 kcal/g), nie doppelt gezählt.
 *   Beleg BLS 4.0: Apfelessig 18 kcal (ohne Säuren 1,4, mit 5,5 g Säuren 17,8 + Alkohol 0,7), Zitronensaft 30 kcal
 *   (12,3 → 30,3), Sauerkraut 23 kcal (15,5 → 22,9), Champignon 28 kcal (32,5 → 28,5 mit 2,7 g Mannit). Erythrit
 *   (0 kcal/g laut Anhang XIV) hat im BLS keinen eigenen Eintrag und keinen eigenen Polyol-Wert – entfällt.
 * - R5 kcal je Portion: Frühstück 200–900, Hauptgericht 300–1.200, Snack 80–500 (gelb).
 * - R11 Mengen je Portion: Salz ≤ 2,5 g, Öl ≤ 30 g, jede Zutat ≤ 600 g (gelb). Öl = Lebensmittel der Abteilung
 *   „Öle, Essig & Saucen“ mit mindestens `oilMinFatG` Fett je 100 g.
 * Werte: PRODUKTENTSCHEIDUNG (Plan 5.3).
 */
export const RECIPE_CHECK_LIMITS = {
  macroPlausibility: { kcalRel: 0.1, kcalAbsMin: 20, macroRel: 0.15, macroAbsMinG: 3 },
  atwater: {
    protein: 4,
    carbs: 4,
    fat: 9,
    fiber: 2,
    organicAcids: 3,
    alcohol: 7,
    polyols: 2.4,
    tolerance: 0.15,
    absMinKcal: 4,
  },
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

/**
 * Gegencheck Gründer-Datei ↔ Quelle (docs/PLAN-PHASE-5.md 19.2/19.3, Etappe N2b/N2c): `pro_100g` aus
 * `alpha5-rezepte.json` ist nur Gegencheck, maßgeblich ist immer die amtliche Quelle. Abweichung über `relative`
 * (3 %) wird gemeldet, über `reviewRelative` (15 %) als „Zuordnung prüfen“ markiert; Mindestabstand `minKcal`
 * bzw. `minGrams` gegen Rundungsrauschen. PRODUKTENTSCHEIDUNG (Plan 19.2 `ALPHA5_IMPORT_TOLERANCE`).
 *
 * „Zuordnung prüfen“ (Stufe `review`) seit Import-Lauf 1 (PR #47, docs/PLAN-PHASE-5.md N2b) fachlich fair:
 * - Energie: über `reviewRelative` (15 %) UND mindestens `reviewMinKcal` (20 kcal – dieselbe Mindest-Toleranz wie
 *   R3 `macroPlausibility.kcalAbsMin`, damit Rundung und Sortenunterschiede energiearmer Lebensmittel nicht
 *   auslösen).
 * - Eiweiß, Kohlenhydrate, Fett: über `reviewRelative` (15 %), mindestens `minGrams` (1 g) UND die Abweichung
 *   macht als Energie (Atwater-Faktor × Gramm, R4) mindestens `reviewEnergyShare` (15 %) des Energiegehalts aus –
 *   gleicher Maßstab wie die Energie-Regel. So lösen 0,6 g statt 2,9 g Kohlenhydrate in Pilzen oder 3 g in Nüssen
 *   (2 % der Energie) nicht aus, eine falsche Fettstufe (Milch 0,3 statt 1,5 % Fett: 1,2 g = 23 % der Energie)
 *   aber weiterhin.
 * - Definitionen: Die Gründer-Datei nutzt teils andere Definitionen als der BLS (Kohlenhydrate inklusive
 *   Ballaststoffe wie in US-Tabellen, Kohlenhydrate ohne Zuckeralkohole wie in älteren Tabellen). Passt der
 *   Datei-Wert zu einer dieser Lesarten der Quellwerte, zählt das als passend: Kohlenhydrate gegen CHO,
 *   CHO + Ballaststoffe und CHO − Polyole; Energie gegen kcal und kcal + 2 kcal/g Ballaststoffe (Ballaststoffe dann
 *   mit 4 statt 2 kcal/g als Kohlenhydrat gezählt) – die Energie-Lesart nur, wenn die Kohlenhydrate der Datei
 *   selbst am besten zu „CHO + Ballaststoffe“ passen (eine Definition je Zutat) UND das Lebensmittel
 *   ballaststoffbetont ist (Ballaststoffe ≥ verfügbare KH, z. B. Knoblauch, Sesam); sonst würde z. B. Vollkornbrot
 *   statt Weißbrot durchrutschen. Eiweiß und Fett haben keine Lesart.
 *   Grenze: Die KH-Lesarten selbst bleiben (nur 🟡); Verwechslungen ähnlicher Lebensmittel (Weißer Reis ↔
 *   Vollkornreis, Apfel ↔ Apfelmus ungesüßt) erkennt kein Zahlenvergleich – dafür R18 (Bezeichnung) und R19.
 * - Gründer-Datei ohne Vergleichswert (kcal, Eiweiß, Kohlenhydrate und Fett alle 0, z. B. Pfeffer, Salz, Wasser):
 *   kein Gegencheck möglich → eigene Stufe „kein Vergleichswert“, zählt nicht als „Zuordnung prüfen“.
 */
export const ALPHA5_IMPORT_TOLERANCE = {
  relative: 0.03,
  reviewRelative: 0.15,
  minKcal: 5,
  minGrams: 1,
  reviewMinKcal: 20,
  reviewEnergyShare: 0.15,
} as const;

/**
 * Schema-Erweiterungen aus „Erweiterungen 2“ (docs/PLAN-PHASE-5.md 19.4, Etappe N2c): Gesamtzeit 1–360 Minuten,
 * Abschnitt höchstens 40 Zeichen, höchstens 8 Themen-Kategorien, Kostenschätzung 0–50 € je Portion. „Schnell“
 * heißt: Gesamtzeit höchstens 10 Minuten (Regel R22, Kategorie „Fertig in 10 Minuten“ der Gründer-Datei).
 * Werte: Plan 19.4 bzw. PRODUKTENTSCHEIDUNG.
 */
export const RECIPE_EXTENSION_LIMITS = {
  totalMinutes: { min: 1, max: 360 },
  sectionMaxChars: 40,
  categoriesMax: 8,
  quickMaxMinutes: 10,
  costEurPerServing: { min: 0, max: 50 },
} as const;

/**
 * Meal-Prep-Wochenpläne (Plan 19.4, Regel R20): 1–6 Rezepte, Kochtag-Schritte mit Startminute 0–240, Kochtag ist
 * der Sonntag vor der Woche (Plan 19.6 `applyMealPrepPlan` Nr. 5) – Montag liegt also 1 Tag nach dem Kochen,
 * Freitag 5 Tage. PRODUKTENTSCHEIDUNG.
 */
export const MEAL_PREP_PLAN_LIMITS = {
  recipes: { min: 1, max: 6 },
  cookSteps: { min: 1, max: 30 },
  cookStepMinute: { min: 0, max: 240 },
  storageTexts: 10,
} as const;

// ---------------------------------------------------------------------------------------------------------
// Phase 5 · Essensplan und Einkaufsliste (docs/PLAN-PHASE-5.md Abschnitt 6 und 19.6, Etappe N3)
//
// Regeln des Wochen-Essensplans (`nutrition/meal-plan.ts`, `scale.ts`, `meal-prep.ts`) und der Einkaufsliste
// (`nutrition/shopping-list.ts`). Die Kalorien-Schutzgrenzen stehen NICHT hier: Sie gelten ausschließlich in
// `clampCalorieTarget` (N1); der Essensplan hält nur das daraus berechnete Planband ein (B1).
// ---------------------------------------------------------------------------------------------------------

/** Version der Essensplan-Engine (gespeichert in `meal_plans.engine_version`, N7). */
export const MEAL_PLAN_ENGINE_VERSION = 1;

/**
 * Portionsfaktor je Mahlzeit (Plan 6.2, `PORTION_SCALE_LIMITS`): halbe bis doppelte Portion des Grundrezepts
 * (Grundrezept ÷ `servings`). PRODUKTENTSCHEIDUNG.
 */
export const PORTION_SCALE_LIMITS = { min: 0.5, max: 2 } as const;

/**
 * Tagesausgleich (Plan 6.2, B1): höchstens 2 Ergänzungs-Snacks (`no_cook`, alle Filter) je Tag; im Modus
 * `no_targets` (S15) höchstens 1, wenn die Standardportionen unter `NO_TARGETS_MIN_DAY_KCAL` liegen.
 * `proteinMinShare`: Eiweiß des Tages ≥ 90 % des Eiweißziels, sonst Hinweis `protein_below_target` (6.2).
 */
export const MEAL_PLAN_FILL = {
  maxExtraSnacks: 2,
  noTargetsMaxExtraSnacks: 1,
  proteinMinShare: 0.9,
} as const;

/**
 * Modus `no_targets` (Plan 6.2, S15): interner Plausibilitätswert für die Summe der Standardportionen; darunter
 * kommt ein Ergänzungs-Snack dazu. Wird NIE angezeigt. PRODUKTENTSCHEIDUNG.
 */
export const NO_TARGETS_MIN_DAY_KCAL = 1800;

/**
 * Wiederholungen im Wochenplan (Plan 6.3 Nr. 3): Hauptgericht höchstens 2× pro Woche und nie an zwei Tagen
 * hintereinander, Frühstück höchstens 3×; Snacks höchstens 3× (PRODUKTENTSCHEIDUNG). Gilt nicht für Meal-Prep-Reste
 * eines Kochtermins. Gibt es keinen Kandidaten innerhalb der Grenzen, wird ausnahmsweise wiederholt (Hinweis
 * `recipe_repeated`) – ein leerer Platz wäre schlechter.
 */
export const MEAL_PLAN_REPEAT_LIMITS = {
  breakfast: 3,
  main: 2,
  snack: 3,
} as const;

/**
 * Punkte je Kandidat (Plan 6.3 Nr. 3, `MEAL_PLAN_SCORING`), alle PRODUKTENTSCHEIDUNG:
 * - `kcalFit`: Abzug je |ln(Faktor)| (Faktor 1 = Grundportion passt genau); `outsideScale` zusätzlich, wenn der
 *   nötige Faktor außerhalb 0,5–2,0 liegt.
 * - `protein`: Bonus je Eiweiß-Energieanteil (0–0,5); `postProtein` zusätzlich für die Mahlzeit nach dem Training.
 * - `like`: Rezept enthält eine Gruppe aus „mag ich“.
 * - `roleTag`: Trainings-Angabe bzw. Kategorie passt zur Rolle vor/nach dem Training (6.3 Nr. 5, 19.6).
 * - `repeat`: Abzug je bisheriger Verwendung in der Woche; `sameProteinPrevDay`: gleiche Haupt-Eiweißquelle am
 *   Vortag; `ingredientReuse`: Anteil schon eingekaufter Zutaten (weniger Reste).
 * - `variantJitter`: feste, aus `stableHash(Woche | Platz | Rezept | Variante)` berechnete Streuung – „Andere
 *   Vorschläge“ (Variante + 1) ändert so die Auswahl, ohne Zufall.
 */
export const MEAL_PLAN_SCORING = {
  kcalFit: 2,
  outsideScale: 4,
  protein: 2,
  postProtein: 2,
  like: 1,
  roleTag: 1.5,
  repeat: 1.5,
  sameProteinPrevDay: 1,
  ingredientReuse: 0.5,
  variantJitter: 0.75,
  /**
   * Bewertung nach dem Essen (KONZEPT 6.10, Plan 19.7 N10, `RECIPE_RATING_RULES`) – NUR Reihenfolge, nie Filter,
   * Energie, Portionen oder Grenzen (K6): `ratingUp` Daumen hoch; `ratingQuick` Rezept ≤ 15 Min., solange ein
   * „Zu aufwendig“ gilt; `ratingSatiety` × Sättigungs-Kennzahl (0–1), solange ein „Macht nicht satt“ gilt;
   * `ratingCheaper` × (1 − Kosten ÷ Bezugswert, 0–1, nur freigegebene Schätzung), solange ein „Zu teuer“ gilt.
   * Die SUMME ist auf `ratingMaxTotal` gedeckelt – strikt kleiner als `repeat` (Wächter N10 S2), damit Abwechslung
   * Vorrang behält und Bewertungen die Passung (`kcalFit`) kaum überstimmen.
   */
  ratingUp: 1,
  ratingQuick: 1,
  ratingSatiety: 1,
  ratingCheaper: 1,
  ratingMaxTotal: 1.25,
} as const;

/**
 * Bewertung nach dem Essen (KONZEPT 6.10, docs/PLAN-PHASE-5.md 19.7 N10) – PRODUKTENTSCHEIDUNG, keine Schutzgrenze:
 * - `downExclusionDays`: Daumen runter → das Rezept wird 8 Wochen (56 Tage, tagesgenau ab dem Bewertungstag) nicht
 *   mehr vorgeschlagen (KONZEPT 6.10 „8 Wochen“); ab Tag 57 wieder. Gründe („Zu aufwendig“, „Macht nicht satt“,
 *   „Zu teuer“) wirken im selben Zeitraum.
 * - `quickMaxMinutes`: „Zu aufwendig“ → Bonus für Rezepte mit Gesamtzeit ≤ 15 Minuten (Plan 19.7).
 * - `satiety`: Sättigungs-Kennzahl für „Macht nicht satt“ = Mittel aus min(Ballaststoffe je 100 kcal ÷
 *   `fiberGPer100Kcal`, 1) und min(Gramm je kcal ÷ `gramsPerKcal`, 1) – mehr Ballaststoffe bzw. Volumen je kcal
 *   (geringe Energiedichte, z. B. Rolls 2012, Physiol Behav; Bezugswerte gerundet, VOR LIVEGANG FACHLICH PRÜFEN).
 * - `costReferenceEurPerServing`: Bezugswert für „Zu teuer“ (Kosten ≥ Bezugswert → kein Bonus); nur Rezepte mit
 *   freigegebener Schätzung (19.8 Nr. 7).
 * - `maxRatings`/`maxFoodDislikes`: Obergrenzen je Person (Gerätespeicher- bzw. Datenbank-Schutz).
 */
export const RECIPE_RATING_RULES = {
  downExclusionDays: 56,
  quickMaxMinutes: 15,
  satiety: { fiberGPer100Kcal: 4, gramsPerKcal: 1.5 },
  costReferenceEurPerServing: 5,
  maxRatings: 2000,
  maxFoodDislikes: 300,
} as const;

/**
 * Meal-Prep-Kochtermine je `mealprep_days` (Plan 6.4, `MEAL_PREP_DAYS`): Tage relativ zum Montag der Woche,
 * −1 = Sonntag davor. 1: So · 2: So, Mi · 3: So, Di, Do · 4: So, Di, Do, Sa · 5: So, Di, Mi, Fr, Sa ·
 * 6: So, Di–Sa · 7: jeden Tag (Mo–So). Ein Termin deckt die Tage bis zum nächsten Termin, höchstens so lange, wie
 * das Gericht hält (R9); danach eingefroren (nur `freezable`) oder frisch gekocht. PRODUKTENTSCHEIDUNG.
 */
export const MEAL_PREP_COOK_OFFSETS = {
  1: [-1],
  2: [-1, 2],
  3: [-1, 1, 3],
  4: [-1, 1, 3, 5],
  5: [-1, 1, 2, 4, 5],
  6: [-1, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
} as const satisfies Record<number, readonly number[]>;

/**
 * Cardio-Rezepte je Einheit erst ab 75 Minuten (Plan 19.6, K4) – Gründer-Vorgabe, PRODUKTENTSCHEIDUNG. Die
 * automatische Belegung je Einheit ist Etappe X4 (Premium); in N3 steht nur der Wert. Bewusst getrennt vom Hinweis
 * `long_session_fueling` (≥ 90 Minuten, `MEAL_TIMING_RULES`).
 */
export const CARDIO_RECIPE_MIN_MINUTES = 75;

/**
 * „Plan aktualisieren“ (Plan 8.2 Nr. 3, Etappe N5): Der Knopf erscheint, wenn sich das Tagesziel (Mitte des
 * Planbands) eines Tages ab heute um mindestens diesen Anteil gegenüber dem gespeicherten Plan geändert hat – ohne
 * Sicherheitsbezug (Modus, Deckel und Ausschlüsse planen automatisch neu, 6.6). Nur Anzeige, keine Grenze.
 * PRODUKTENTSCHEIDUNG (Wert aus dem Plan: „Ziele ≥ 5 % geändert“).
 */
export const MEAL_PLAN_UPDATE_MIN_CHANGE = 0.05;

/** Portionswähler (Plan 19.6): 1–12 Portionen, ohne Bezug zu Kalorienzielen. PRODUKTENTSCHEIDUNG. */
export const RECIPE_SERVINGS_PICKER = { min: 1, max: 12 } as const;

/**
 * „Nächste Mahlzeit“ auf „Heute“ (Plan 8.2 Nr. 1, Etappe N4): Eine Mahlzeit gilt noch als „nächste“, solange ihre
 * Standard-Uhrzeit (`MEAL_SLOT_TIMES`) höchstens so viele Minuten zurückliegt. Nur Anzeige, keine Grenze.
 * PRODUKTENTSCHEIDUNG.
 */
export const NEXT_MEAL_GRACE_MINUTES = 60;

/**
 * Einkaufsliste (Plan 6.5): Mengen werden auf Kaufschritte AUFGERUNDET – Gramm/ml unter 100 auf 10, ab 100 auf 50,
 * Stück auf ganze; eine Menge > 0 wird nie 0. Eigene Einträge höchstens 80 Zeichen. PRODUKTENTSCHEIDUNG.
 */
export const SHOPPING_LIST_ROUNDING = {
  smallStep: 10,
  largeStep: 50,
  largeFrom: 100,
  pieceStep: 1,
  manualLabelMaxChars: 80,
  manualItemsMax: 100,
} as const;

/**
 * „Zur Einkaufsliste“ aus einer Rezeptansicht (Plan 19.6, Etappe N5b): höchstens so viele zusätzliche Rezepte je
 * Wochenliste (Portionen 1–12 wie `RECIPE_SERVINGS_PICKER`); höchstens so viele Einträge insgesamt im
 * Gerätespeicher. Keine Grenze zur Gesundheit, nur Speicher- und Bedienschutz. PRODUKTENTSCHEIDUNG.
 */
export const SHOPPING_LIST_EXTRAS = { recipesMax: 20, itemsMax: 1000 } as const;

/**
 * Größte Payload an `save_meal_plan` bzw. `replace_shopping_list` in Byte (Etappe N7, Wächter N7 H1) – der Server lehnt
 * Größeres ab, BEVOR er die Eingabe Feld für Feld prüft. Keine Grenze zur Gesundheit, nur Schutz der Datenbank.
 * PRODUKTENTSCHEIDUNG, hergeleitet aus den übrigen Grenzen:
 * - Essensplan: höchstens 70 Mahlzeiten (7 × (8 + 2)) mit je höchstens 20 Zutaten-Änderungen (eine je Zutat,
 *   `RECIPE_SCHEMA_LIMITS.ingredients.max`) à ca. 110 Byte plus ca. 700 Byte Grunddaten ≈ 3 KB je Mahlzeit, zusammen
 *   ≈ 210 KB im ungünstigsten Fall → 256 KiB.
 * - Einkaufsliste: höchstens 1.000 Einträge (`SHOPPING_LIST_EXTRAS.itemsMax`) mit Schlüssel und Bezeichnung (je ≤ 200
 *   Zeichen) und ein paar Ersatz-Verweisen ≈ 1–2 KB je Eintrag → 2 MiB. Eine echte Wochenliste hat wenige hundert
 *   Einträge (unter 100 KB).
 */
export const MEAL_PLAN_PAYLOAD_MAX_BYTES = 262_144;
export const SHOPPING_LIST_PAYLOAD_MAX_BYTES = 2_097_152;

/**
 * Löschfrist gespeicherter Essenspläne und Einkaufslisten (Etappe N7 Teil 2): Gespeichert bleiben die laufende Woche und
 * die `MEAL_PLAN_RETENTION_WEEKS` Wochen davor; Pläne und Listen älterer Wochen werden gelöscht – auf dem Server bei
 * jedem `save_meal_plan`/`replace_shopping_list` der Person und täglich (pg_cron, `private.purge_expired_nutrition_weeks`,
 * sync), im Testmodus beim Laden und Speichern (`nutritionWeekRetained`).
 * Quelle: Gründer-Entscheidung G-N7-2 (16.10.2026, „wie empfohlen“), Vorschlag aus Wächter N5a – Datensparsamkeit und
 * Speicherbegrenzung (Art. 5 Abs. 1 lit. c und e DSGVO). PRODUKTENTSCHEIDUNG.
 */
export const MEAL_PLAN_RETENTION_WEEKS = 4;

/**
 * Mindest-Plausibilität der Tageskalorien auf dem Server (Etappe N7 Teil 2, Gründer-Entscheidung G-W3 vom 16.10.2026):
 * `save_meal_plan` lehnt ab heute (Europe/Berlin) jeden Tag ab, dessen Tagessumme unter dem Grundumsatz für die
 * Schutzgrenzen liegt (`serverDayKcalFloor` = `bmrForFloor` × `MIN_INTAKE_RELATIVE_TO_BMR`, dieselbe Formel wie die
 * Untergrenze in `clampCalorieTarget`), berechnet aus den GESPEICHERTEN Körperdaten. Die Tagessumme stammt ebenfalls vom
 * Server: `save_meal_plan` rechnet jede Mahlzeit aus Rezept × Faktor (Ersatz, Weglassen, Tausch) nach und speichert nur
 * diese Werte (`MEAL_PLAN_ITEM_NUTRIENT_TOLERANCE`, Wächter N7 Teil 2 H1) – so greift die Prüfung auch gegen veränderte
 * Apps, soweit sie Tage als `complete`/`no_targets` kennzeichnen. Geprüft werden Tage mit `checkedDayStatuses`: `complete` liegt nach Bauart im Planband
 * (Untergrenze ≥ Grundumsatz); `no_targets` darf es mit Körperdaten und Einwilligung gar nicht geben. Ein Tag
 * `below_floor` ist ausdrücklich als „Unvollständiger Vorschlag“ mit Hinweis gekennzeichnet (die Engine findet nicht
 * genug passende Rezepte) und bleibt erlaubt – die Engine liefert ihn selbst (z. B. zu wenig passende Rezepte), eine
 * Ablehnung auf dem Server würde ehrliche Pläne sperren. Eine veränderte App kann einen Tag so kennzeichnen und damit die
 * Prüfung umgehen; die Werte sind trotzdem die des Servers, und jedes Gerät plant einen solchen Tag ab heute beim
 * Rekonstruieren neu (`RECONSTRUCTED_INCOMPLETE_KEY`, Wächter N7 Teil 2 M1). Ohne Einwilligung, ohne Größe/Gewicht oder bei Schwangerschaft gibt es
 * keinen Grundumsatz (Modus `no_targets` wie im Core) – dann keine Prüfung.
 * `roundingToleranceKcal`: Die Payload rundet jede Mahlzeit auf 0,1 kcal (`toMealPlanPayload`); bei höchstens zehn
 * Mahlzeiten je Tag fehlen so höchstens 0,5 kcal – 1 kcal Spielraum, sonst würde ein Plan genau auf der Grenze
 * abgelehnt. PRODUKTENTSCHEIDUNG (Wächter N7 H6).
 */
export const MEAL_PLAN_DAY_KCAL_CHECK = {
  checkedDayStatuses: ['complete', 'no_targets'],
  roundingToleranceKcal: 1,
} as const;

/**
 * Nährwerte je Plan-Mahlzeit rechnet der Server nach (Etappe N7 Teil 2, Wächter H1; wie E1-G4/E2-G2 „Server rechnet
 * nach“): `private.meal_plan_item_nutrients` spiegelt `scalePortion` in derselben Reihenfolge (double precision), die
 * Payload rundet wie `toMealPlanPayload` auf 0,1. Weicht die Angabe des Geräts um mehr als diesen Spielraum ab, lehnt
 * `save_meal_plan` den Plan ab (sichere Richtung: veränderte App oder anderer Bestand); gespeichert und exportiert
 * werden immer die Werte des Servers. Der Spielraum fängt nur Rundungsreste einer Nachkommastelle auf (eine ehrliche App
 * rechnet genau gleich, db-sync.test.ts und pgTAP 33). PRODUKTENTSCHEIDUNG.
 */
export const MEAL_PLAN_ITEM_NUTRIENT_TOLERANCE = { kcal: 1, macroG: 0.1 } as const;

/**
 * Einkaufsliste weitergeben (Plan 19.7 N12, KONZEPT 6.13, Etappe N12) – Bedien- und Übertragungsschutz, keine Grenze
 * zur Gesundheit. PRODUKTENTSCHEIDUNG.
 * - `maxChars`: Höchstlänge des weitergegebenen Texts. Begründung: WhatsApp (in KONZEPT 6.13 als erstes Ziel genannt)
 *   nimmt höchstens 65.536 Zeichen je Nachricht an; 60.000 lassen Luft für Zeilenumbrüche/Emoji-Zählung der Ziel-App.
 *   Eine reale Wochenliste hat wenige hundert Zeilen (ca. 40 Zeichen) und liegt weit darunter; nur eine künstlich
 *   volle Liste (bis `SHOPPING_LIST_EXTRAS.itemsMax` Einträge) wird gekürzt – dann SICHTBAR mit „… und N weitere
 *   Einträge“ (nie stilles Weglassen) und dem Hinweis auf das PDF.
 * - `labelMaxChars`: Höchstlänge eines Eintrags im Text (= Höchstlänge `name_de` im Katalog, Plan 5.1; eigene
 *   Einträge haben höchstens 80 Zeichen) – längere, manipulierte Gerätespeicher-Texte werden mit „…“ gekürzt
 *   (gezählt in Graphem-Clustern, also ganze Emojis).
 * - `maxAmount`: größte Menge im Text (1.000.000 g = 1 t, 1.000 l bzw. eine Million Stück). Kein Haushaltseinkauf einer
 *   Woche kommt in die Nähe; größere Werte sind fehlerhaft (z. B. manipulierter Gerätespeicher) und erscheinen ohne
 *   Menge statt in Exponentialschreibweise („1e+21 g“, Wächter N12 H5).
 */
export const SHOPPING_LIST_SHARE = {
  maxChars: 60_000,
  labelMaxChars: 100,
  maxAmount: 1_000_000,
} as const;

/**
 * Feature-Flags im Code (Plan 19.7 N12, KONZEPT 6.13 „Später – Händler-Anbindung“). `retail_integration` bleibt AUS:
 * Es gibt keinen Händler, keine offizielle Schnittstelle und kein Partnerprogramm. Einschalten nur per Pull Request,
 * wenn ALLE Bedingungen aus K5 erfüllt sind (`RETAIL_INTEGRATION_CONDITIONS` in `retail/provider.ts`): eigene
 * Einwilligung für die Übermittlung, DSFA-Ergänzung, Datenminimierung (nur Produktarten und Mengen), offizielle
 * Schnittstelle bzw. Partnerprogramm, Kennzeichnung „Anzeige“. Ein Test hält das Flag aus (bewusst zu ändern).
 */
export const FEATURE_FLAGS: Readonly<{ retail_integration: boolean }> = {
  retail_integration: false,
};

/**
 * Rezeptsuche (Plan 19.6, Etappe N5c): Stufen des Filters „max. Kosten je Portion“ in Euro. Angeboten nur, wenn es
 * Rezepte mit FREIGEGEBENER Kostenschätzung gibt (6.13). Bedienung, keine Grenze zur Gesundheit. PRODUKTENTSCHEIDUNG.
 */
export const RECIPE_SEARCH_COST_STEPS_EUR = [2, 3, 5] as const;

/**
 * Zutaten-Austausch (Plan 19.4/19.7, KONZEPT 6.9, Etappe N9) – Austausch-Tabelle `content/substitutions/` und Regel
 * R23. Faktor 0,2–5 auf die MASSE der Original-Zutat (Plan 19.7 „Faktor 0,2–5“); er hält die Messgröße der Rolle
 * (19.4, S6) innerhalb ±10 % (`roleTolerance`): Eiweiß = g Eiweiß, Kohlenhydrat = g Kohlenhydrate, Fett = g Fett,
 * Gemüse = Masse (Faktor 1 ±10 %); Würze ohne Nährwertprüfung (Salz prüft R11 am getauschten Rezept), Süße nach
 * Hinweis (gelb, menschliche Prüfung). Hinweis-Text höchstens `noteMaxChars` Zeichen. Keine Schutzgrenze – die
 * Kalorien-Schutzgrenzen gelten weiter nur über das Planband aus `clampCalorieTarget`. PRODUKTENTSCHEIDUNG (Werte aus
 * dem Plan 19.4/19.7).
 */
export const INGREDIENT_SUBSTITUTION_LIMITS = {
  factor: { min: 0.2, max: 5 },
  roleTolerance: 0.1,
  noteMaxChars: 200,
  /** Höchstzahl der Austausch-Einträge je Mahlzeit im gespeicherten Plan (Gerätespeicher-Schutz). */
  swapsPerMeal: 20,
} as const;

/**
 * Packungsgrößen (Plan 19.4 „Packungsgrößen (N11)“, 19.7 N11, KONZEPT 6.11) – Tabelle `content/package-sizes/` und
 * Regel R24. Übliche Handelsgröße je Lebensmittel in Gramm (z. B. Brokkoli 500 g, Quark 500 g). Plausibilität
 * 1–5.000 g laut Plan 19.7 N11 (Schema R1, rot auch bei Entwürfen). Nur Bestand für die spätere Resteplanung (N13/N14,
 * Aufrunden der Einkaufsliste); ändert nie Filter, Mengen im Essensplan oder Grenzen. PRODUKTENTSCHEIDUNG (Plan).
 */
export const PACKAGE_SIZE_LIMITS = {
  grams: { min: 1, max: 5000 },
} as const;

/**
 * Kühlschrank-Suche „Was habe ich da?“ (Plan 19.7 N11, KONZEPT 6.11) – gratis, regelbasiert, ohne KI:
 * - `minorWeight`: Übereinstimmung = Anteil der vorhandenen Zutaten, gewichtet nach Menge in Gramm; Zutaten aus dem
 *   Vorrat (`pantry`) und aus der Abteilung „Gewürze & Backzutaten“ zählen nur mit diesem Anteil ihrer Menge („Vorrat/
 *   Gewürze zählen wenig“, Plan 19.7 N11). 0,1 = ein Zehntel. PRODUKTENTSCHEIDUNG ohne Schutzwirkung.
 * - `maxSelectedFoods`: höchstens so viele ausgewählte Zutaten (Bedien- und Speicherschutz der Eingabe, Zod).
 * - `maxMissingShown`: höchstens so viele fehlende Zutaten je Treffer in der Anzeige (Rest als „und N weitere“).
 * - `minPercent`: Treffer erst ab dieser Übereinstimmung in ganzen Prozent (abgerundet) – keine „0 % passt“-Karten,
 *   wenn nur ein gering gewichteter Vorrat (z. B. Öl) passt (Wächter N11 S1).
 * - `pageSize`: so viele Karten zeigt die App auf einmal, weitere über „Mehr anzeigen“ (Wächter N11 S2).
 * Die Suche ändert nur, welche Rezepte in welcher Reihenfolge erscheinen – die harten Filter (Ernährungsform,
 * Schwein, Unverträglichkeiten, „mag ich nicht“, Schwangerschaft) laufen unverändert über `filter.ts`.
 */
export const FRIDGE_SEARCH = {
  minorWeight: 0.1,
  maxSelectedFoods: 100,
  maxMissingShown: 6,
  minPercent: 1,
  pageSize: 30,
} as const;

/**
 * Portionsfaktor beim gemeinsamen Kochen (Plan 19.7 N13, KONZEPT 6.12, Wächter-Befund S1) – Logik in
 * `nutrition/portion-factor.ts`, Oberfläche erst mit dem Partner-Modus (P1, Phase 11):
 * - `factor`: Faktor je Person = Ziel-kcal der Mahlzeit (aus DEREN `nutritionTargetsForWeek`, also schon durch
 *   `clampCalorieTarget`) ÷ kcal pro Portion, begrenzt auf 0,6–1,8 (Plan 19.7 N13, ERWEITERUNGEN-2 Abschnitt 6). Liegt
 *   innerhalb von `PORTION_SCALE_LIMITS` (0,5–2,0, Test). KEINE Schutzgrenze: Ob der Tag der Person im Planband bleibt,
 *   entscheidet allein der Tagesausgleich (`finishDay`) mit dem Planband aus `clampCalorieTarget`; geht das nicht,
 *   isst die Person die Mahlzeit nicht als geteilte Portion (eigener Vorschlag).
 * - `sideStepG`/`sideStepFromG`: Beilagen (Rolle `carb`) in Gramm/ml werden in geteilten Portionen auf 10 g gerundet
 *   („10 g bei Beilagen“, Plan 19.7 N13) – erst ab 20 g, darunter gilt die normale Rundung (nie 0). Eier bleiben ganz
 *   (wie überall, `AMOUNT_ROUNDING`).
 * - `maxPersons`: höchstens so viele Personen je geteiltem Gericht (Bedien- und Rechenschutz; der Paar-Modus hat 2).
 * PRODUKTENTSCHEIDUNG (Werte aus dem Plan), VOR LIVEGANG FACHLICH PRÜFEN (Spannweite 0,6–1,8 und Beilagen-Regel).
 */
export const COUPLE_PORTION_LIMITS = {
  factor: { min: 0.6, max: 1.8 },
  sideStepG: 10,
  sideStepFromG: 20,
  maxPersons: 6,
} as const;

/**
 * Haltbarkeit ANGEBROCHENER, ROHER Reste einer Packung (Plan 19.7 N13, Wächter-Befund S9, KONZEPT 6.11) – nur für die
 * Resteplanung (`nutrition/leftovers.ts`): Wie viele Tage nach dem Anbrechen (Tag des ersten Verbrauchs) ein Rest noch
 * eingeplant werden darf. `max_fridge_days` (R9) gilt dagegen für GEKOCHTE Speisen und bleibt unberührt.
 * - `rawAnimal`: rohes Fleisch, Fisch, Krebs-/Weichtiere und Rohmilch(-produkte) (`animal` meat/fish/shellfish bzw.
 *   Milch mit `pregnancy_caution`) – NUR der Folgetag (Plan S9: „nur für den Folgetag, danach Hinweis ‚einfrieren‘“).
 *   Orientierung: BfR „Schutz vor Lebensmittelinfektionen im Privathaushalt“ und Verbraucherzentrale „Lebensmittel
 *   richtig lagern“ (Hackfleisch am Tag des Kaufs, rohes Fleisch/Fisch höchstens 1–2 Tage) – der kürzere Wert gilt.
 * - `sensitive`: Lebensmittel mit `pregnancy_caution` (z. B. rohe Sprossen, Räucherfisch, Rohwurst) – ebenfalls nur
 *   der Folgetag (BfR: Sprossen rasch verbrauchen; Wächter N13 H6).
 * - `byCategory`: übrige Reste je Supermarkt-Abteilung (5.5), bewusst KURZ gewählt (ein zu langer Wert würde einen
 *   verdorbenen Rest einplanen; ein zu kurzer nur einen Rest verschenken). Angeschnittenes Obst/Gemüse, geöffnete
 *   Milchprodukte, Tofu, Konserven, Säfte 2 Tage (Verbraucherzentrale: angebrochene Konserven umfüllen, 1–2 Tage);
 *   Brot 3 Tage; Saucen/Öle 3 Tage (geöffnete Saucen, Kokosmilch); trockene Waren (Nudeln, Reis, Getreide, Müsli,
 *   Nüsse, Gewürze) 30 Tage; Tiefkühlware bleibt tiefgekühlt 30 Tage; Fleisch/Wurst/Fisch und „Sonstiges“ 1 Tag.
 * PRODUKTENTSCHEIDUNG, Werte gerundet und VOR LIVEGANG FACHLICH PRÜFEN (wortgenaue Fundstellen BfR/Verbraucherzentrale
 * nachtragen, Fachkraft bestätigt die Tage je Abteilung).
 */
export const LEFTOVER_RAW_DAYS = {
  rawAnimal: 1,
  sensitive: 1,
  byCategory: {
    fruit_vegetables: 2,
    bread_bakery: 3,
    chilled_dairy_eggs: 2,
    chilled_plant_based: 2,
    meat_sausage: 1,
    fish: 1,
    pasta_rice_grains: 30,
    legumes_canned: 2,
    cereal_breakfast: 30,
    nuts_seeds_dried_fruit: 30,
    oils_vinegar_sauces: 3,
    spices_baking: 30,
    frozen: 30,
    drinks: 2,
    other: 1,
  },
} as const;

/**
 * Reste-Score (Plan 19.7 N13, KONZEPT 6.11 „frische Zutaten mit kurzer Haltbarkeit zuerst“) – ändert NUR die
 * Reihenfolge der Kandidaten im Essensplan, nie Filter, Mengen, Energie oder Grenzen:
 * - `weight`: höchster Bonus in Punkten (`MEAL_PLAN_SCORING`-Skala). Strikt kleiner als `MEAL_PLAN_SCORING.repeat`
 *   (1,5, Test), damit Abwechslung Vorrang behält (wie Wächter N10 S2); die harten Wiederholungsgrenzen
 *   (`MEAL_PLAN_REPEAT_LIMITS`) gelten unverändert.
 * - Bonus = `weight` × min(1, Σ je Lebensmittel mit nutzbarem Rest: verbrauchte Rest-Menge ÷ Packungsgröße ×
 *   Dringlichkeit), Dringlichkeit = 1 ÷ (1 + verbleibende Tage) – ein Rest, der heute zuletzt nutzbar ist, zählt voll.
 * - Vorrat (`pantry`) zählt nicht (hält lange, steht als „hast du wahrscheinlich da“ in der Liste).
 * - `maxOpenPackagesPerFood`: Rechenschutz je Lebensmittel und Woche (mehr offene Packungen werden nicht verfolgt).
 * PRODUKTENTSCHEIDUNG ohne Schutzwirkung.
 */
export const LEFTOVER_SCORING = {
  weight: 1,
  maxOpenPackagesPerFood: 50,
} as const;

// ---------------------------------------------------------------------------------------------------------
// Ziele · Haupt- und Nebenziel (docs/PLAN-ZIELE.md Abschnitt 4, Etappe Z1)
//
// Das Ziel-Profil (`packages/core/src/goals/profile.ts`) liest NUR diese Werte. Die Schutzgrenzen gelten weiter
// ausschließlich in `clampCalorieTarget`; kein Ziel und keine Kombination lockert sie.
// ---------------------------------------------------------------------------------------------------------

/**
 * Erlaubte Paare Hauptziel → Nebenziel mit Standard-Energie-Anpassung (Anteil des Grundbedarfs ohne Training,
 * ohne konkretes Abnehmziel), Eiweiß-Richtwert in g/kg und Kohlenhydrat-Regel nach Training (Plan 4.2 und 4.4).
 * Die Liste ist abschließend: Jedes nicht aufgeführte Paar ist verboten (dasselbe Ziel doppelt, Definition mit
 * Abnehmen bzw. Muskelaufbau, Fitness als Nebenziel). Gespiegelt in `private.goal_pair_allowed` (Migration
 * *_plan_inputs_secondary_goal.sql, Abgleich in db-sync.test.ts).
 * Einzelziele behalten GOAL_ENERGY_ADJUSTMENT und PROTEIN_G_PER_KG.byGoal unverändert.
 * Die Energie-Richtung (Defizit/Erhalt/Überschuss) wird NICHT gepflegt, sondern aus dem Vorzeichen der Anpassung
 * abgeleitet (Wächter S11).
 * Quellen/Orientierung: Helms ER, Aragon AA, Fitschen PJ (2014), J Int Soc Sports Nutr 11:20 (moderate Defizite,
 * hohes Eiweiß zum Muskelerhalt); Barakat C et al. (2020), Strength Cond J 42(5):7–21 (Recomposition: kleines
 * Defizit, Krafttraining, hohes Eiweiß); Thomas DT, Erdman KA, Burke LM (2016), Med Sci Sports Exerc
 * 48(3):543–568 (Energieverfügbarkeit, Kohlenhydrate bei Ausdauer); Morton RW et al. (2018), Br J Sports Med
 * 52(6):376–384 (Eiweiß bis ≈ 1,6–2,2 g/kg). Werte: PRODUKTENTSCHEIDUNG – fachlich zu prüfen.
 * VOR LIVEGANG GEGEN ORIGINAL PRÜFEN.
 */
export const GOAL_PAIR_RULES = [
  // Abnehmen → Muskelaufbau: Muskelerhalt im Defizit (Helms 2014).
  {
    primary: 'fat_loss',
    secondary: 'muscle_gain',
    energyAdjustment: -0.15,
    proteinGPerKg: 2.2,
    enduranceCarbs: false,
  },
  // Abnehmen → Ausdauer: die EA-Untergrenze in clampCalorieTarget greift zusätzlich.
  {
    primary: 'fat_loss',
    secondary: 'endurance',
    energyAdjustment: -0.15,
    proteinGPerKg: 2.0,
    enduranceCarbs: true,
  },
  {
    primary: 'definition',
    secondary: 'endurance',
    energyAdjustment: -0.1,
    proteinGPerKg: 2.2,
    enduranceCarbs: true,
  },
  // Recomposition: kleines Defizit, hohes Eiweiß (Barakat 2020); entspricht „Definition“ (Wächter K3).
  {
    primary: 'muscle_gain',
    secondary: 'fat_loss',
    energyAdjustment: -0.1,
    proteinGPerKg: 2.2,
    enduranceCarbs: false,
  },
  // Kleiner Überschuss wegen der Ausdauer-Energie (Thomas 2016), für alle Level gleich.
  {
    primary: 'muscle_gain',
    secondary: 'endurance',
    energyAdjustment: 0.05,
    proteinGPerKg: 1.8,
    enduranceCarbs: true,
  },
  {
    primary: 'general_fitness',
    secondary: 'fat_loss',
    energyAdjustment: -0.15,
    proteinGPerKg: 2.0,
    enduranceCarbs: false,
  },
  // Entspricht dem Ziel „Ausdauer“ (Wächter K3).
  {
    primary: 'general_fitness',
    secondary: 'endurance',
    energyAdjustment: 0,
    proteinGPerKg: 1.4,
    enduranceCarbs: true,
  },
  // Leistung zuerst; Wettkampfwoche ohne Defizit folgt mit Phase 10.
  {
    primary: 'endurance',
    secondary: 'fat_loss',
    energyAdjustment: -0.1,
    proteinGPerKg: 2.0,
    enduranceCarbs: true,
  },
  {
    primary: 'endurance',
    secondary: 'definition',
    energyAdjustment: -0.1,
    proteinGPerKg: 2.2,
    enduranceCarbs: true,
  },
  {
    primary: 'endurance',
    secondary: 'muscle_gain',
    energyAdjustment: 0,
    proteinGPerKg: 1.8,
    enduranceCarbs: true,
  },
] as const satisfies readonly {
  readonly primary: GoalType;
  readonly secondary: GoalType;
  readonly energyAdjustment: number;
  readonly proteinGPerKg: number;
  readonly enduranceCarbs: boolean;
}[];

/**
 * Vorbelegung von Ausdauer-Tagen beim Nebenziel Ausdauer (suggestedTrainingSlots, Plan 4.3 und 11, Wächter S18 und
 * Z1 S-1): Einsteiger 1, sonst 2 Ausdauer-Tage pro Woche; die Startgruppe „vorsichtig“ (Flag, ohne Check, unter 18,
 * ab 65) bekommt wie Einsteiger 1. Dieselbe Startgruppe und gedeckelt durch ENDURANCE_START_RULES.maxSessionsPerWeek
 * wie beim Hauptziel Ausdauer. Vorrang „Hauptziel zuerst“: Erst bekommen `strengthDays` Kraft-Tage ihren Platz (bei
 * 1 Tag pro Woche dieser eine, nie zwei hintereinander); Ausdauer kommt nur auf danach freie Tage, übrige Tage bleiben
 * frei. Ohne Angabe der Tage gilt `strengthDays` Kraft-Tage plus die Ausdauer-Tage.
 * Orientierung: Garber CE et al. (2011), Med Sci Sports Exerc 43(7):1334–1359 (Kraft an 2–3 Tagen pro Woche);
 * Wilson JM et al. (2012), J Strength Cond Res 26(8):2293–2307 (Kraft und Ausdauer kombiniert).
 * Werte: PRODUKTENTSCHEIDUNG – fachlich zu prüfen.
 */
export const ENDURANCE_SECONDARY_SUGGESTION = {
  perGroup: { cautious: 1, beginner: 1, advanced: 2, competitive: 2 },
  strengthDays: 2,
} as const satisfies {
  perGroup: Record<'cautious' | ExperienceLevel, number>;
  strengthDays: number;
};

/**
 * Empfohlene Mindestzahl Tage für ein NEBENziel im Schritt „Deine Trainingstage“ (scheduleHints, Plan 4.3):
 * Kraft-Ziel nur als Nebenziel → mindestens 1 Kraft-Tag; Ausdauer als Nebenziel → mindestens 1 Ausdauer-Tag (ab 3
 * Tagen pro Woche, sonst Hinweis `secondary_endurance_no_room`). Das Hauptziel behält SCHEDULE_HINT_LIMITS (2).
 * Quelle: PRODUKTENTSCHEIDUNG, fachlich zu bestätigen.
 */
export const SECONDARY_GOAL_HINT_LIMITS = {
  minStrengthDays: 1,
  minEnduranceDays: 1,
  enduranceRoomFromDays: 3,
} as const;

// ---------------------------------------------------------------------------------------------------------
// Ziele · Abnehmziel und Erreichbarkeits-Ampel (docs/PLAN-ZIELE.md Abschnitte 2, 3; Etappe Z2)
//
// Das Abnehmziel kann das Defizit NUR verkleinern (Gründer-Entscheidung F5, „nie schneller als heute“): Die
// Obergrenze des geplanten Tempos ist die Standard-Anpassung des Ziel-Profils (GOAL_ENERGY_ADJUSTMENT bzw.
// GOAL_PAIR_RULES), danach gilt immer `clampCalorieTarget`. Deshalb gibt es KEIN `WEIGHT_GOAL_PACE_MAX_PLANNED`.
// Die Ampel rechnet keine eigenen Grenzen; sie ruft nur `dayEnergy`, `nutritionEligibility` und
// `clampCalorieTarget` auf.
// ---------------------------------------------------------------------------------------------------------

/**
 * Stufen der Ampel als benötigtes Tempo r (Anteil des mittleren Gewichts pro Woche): Grün bis 0,5 %, Gelb bis
 * 0,75 %, Orange bis 1 % (bzw. über der persönlichen Kapazität C), Rot darüber. `orange` = MAX_WEEKLY_WEIGHT_LOSS_FRACTION
 * (Test in constants.test.ts).
 * Quellen: Helms ER, Aragon AA, Fitschen PJ (2014), J Int Soc Sports Nutr 11:20 (0,5–1 % KG/Woche zum
 * Muskelerhalt); Garthe I et al. (2011), Int J Sport Nutr Exerc Metab 21(2):97–104 (≈ 0,7 % vs. 1,4 %/Woche:
 * langsamer erhält Magermasse besser); Deutsche Adipositas-Gesellschaft, S3-Leitlinie Prävention und Therapie der
 * Adipositas (2014) (Defizit ca. 500–600 kcal/Tag).
 * Die Grenze 0,75 % ist eine PRODUKTENTSCHEIDUNG (F6). VOR LIVEGANG GEGEN ORIGINAL PRÜFEN.
 */
export const WEIGHT_GOAL_PACE_LEVELS = { green: 0.005, yellow: 0.0075, orange: 0.01 } as const;

/**
 * Rechtes Ende der Skala (Zeiger x = 0 ganz links bei r ≥ 1,25 %/Woche): Zonen Rot [0; 0,2), Orange [0,2; 0,4),
 * Gelb [0,4; 0,6), Grün [0,6; 1] entsprechen r = 1 % / 0,75 % / 0,5 % (Plan 3.1, Wächter S5). PRODUKTENTSCHEIDUNG.
 */
export const WEIGHT_GOAL_SCALE_MAX_PACE = 0.0125;

/**
 * Abstand des angezeigten Zeigers zu den Zonengrenzen (Plan 3.1, Wächter Runde 2 K-a): Der Zeiger wird beidseitig
 * in die Zone der Stufe geklemmt, mit 0,01 Abstand zum Rand (bei Grün rechts bis 1). PRODUKTENTSCHEIDUNG.
 */
export const WEIGHT_GOAL_POINTER_MARGIN = 0.01;

/**
 * Kleinstes planbares Defizit am Ruhetag in kcal (Wächter S1): Liegt die Kapazität D_C darunter, ist „kein Defizit
 * planbar“ (Zustand `no_deficit`, keine Stufe, kein N). PRODUKTENTSCHEIDUNG.
 */
export const WEIGHT_GOAL_MIN_CAPACITY_KCAL = 1;

/**
 * Höchstens so viele Durchläufe, um die sichere Dauer N mit dem Alter am Ende von N neu zu rechnen (Plan 3.1: N
 * steigt dabei nur). PRODUKTENTSCHEIDUNG.
 */
export const WEIGHT_GOAL_AGE_ITERATIONS = 3;

/**
 * Grenzen der Eingabe „konkretes Abnehmziel“ (Plan 2.2, 2.3):
 * - `minKg` 1: mindestens 1 kg (PRODUKTENTSCHEIDUNG).
 * - `kgStep` 0,5 (Eingabe „kg abnehmen“) und `targetStep` 0,1 (Zielgewicht wie `body_metrics.weight_kg numeric(4,1)`).
 * - `weeks` 4–104: Zeitraum zwischen 4 Wochen und 2 Jahren (in Tagen 28–728, gleiche Regel wie der künftige
 *   Datums-CHECK von `weight_goals`, Plan 5.2). PRODUKTENTSCHEIDUNG.
 * - `minTargetBmi` 18,5 und `lowTargetBmiNotice` 20 (= BMI_LIMITS.lowNormal):
 *   **VORLÄUFIG – Entscheidung Gründer (F8).** Quelle für 18,5: WHO-BMI-Klassifikation (Untergewicht < 18,5).
 *   Gegenposition (Wächter S12): Cederholm T et al. (2019), „GLIM criteria for the diagnosis of malnutrition“, Clin
 *   Nutr 38(1):1–9 – BMI < 20 unter 70 J. bzw. < 22 ab 70 J. als phänotypisches Kriterium; Empfehlung des Wächters:
 *   hart 20, ab 70 J. hart 22. Muss vor Etappe Z4 (erste sichtbare App-Stelle) entschieden sein.
 */
export const WEIGHT_GOAL_LIMITS = {
  minKg: 1,
  kgStep: 0.5,
  targetStep: 0.1,
  weeks: { min: 4, max: 104 },
  minTargetBmi: 18.5,
  lowTargetBmiNotice: BMI_LIMITS.lowNormal,
} as const;

// ---------------------------------------------------------------------------------------------------------
// Etappe E1 · Ernährungstagebuch (docs/PLAN-AUSWERTUNG.md Abschnitt 5). Identisch als CHECK bzw. Konstante in der
// Datenbank (20261015130100_food_log_rpcs.sql, Abgleich in db-sync.test.ts). Alle Werte sind
// PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN (es sind Eingabegrenzen gegen Tippfehler, keine Empfehlungen).
// ---------------------------------------------------------------------------------------------------------

/**
 * Grenzen eines Tagebuch-Eintrags (Plan 5):
 * - `kcal` 0–3.000 je Eintrag (0 = z. B. Wasser), ganze kcal; `macroG` 0–750 g je Makro (3.000 kcal ÷ 4 kcal/g),
 *   eine Nachkommastelle.
 * - Menge in g/ml 1–2.000, in Stück 0,5–20 (in ½-Schritten); umgerechnet nie über 2.000 g.
 * - Portion 0,25–3 (Plan-Mahlzeit: Auswahl `FOOD_LOG_PORTION_CHOICES`; Rezept: Portionen).
 * - Höchstens 40 Einträge je Tag (`eaten_on`), höchstens 40 Einträge je Speichervorgang.
 * - Nachtragen bis 14 Tage zurück (wie SESSION_LOG_LIMITS.backdateDays), nie in die Zukunft. Der Server lässt
 *   `serverFutureDays` (1 Tag) als Zeitzonen-Toleranz zu, weil sein „heute“ Europe/Berlin ist (wie Training).
 * - `plausibleKcal` 1.500: ab hier fragt die App „Stimmt die Menge?“ – keine Sperre.
 * - `recentCount` 20 verschiedene „Zuletzt gegessen“, höchstens 100 Favoriten.
 */
export const FOOD_LOG_LIMITS = {
  kcal: { min: 0, max: 3000 },
  macroG: { min: 0, max: 750 },
  amountMass: { min: 1, max: 2000 },
  amountPiece: { min: 0.5, max: 20, step: 0.5 },
  gramsMax: 2000,
  portion: { min: 0.25, max: 3 },
  titleMaxChars: 100,
  maxEntriesPerDay: 40,
  maxEntriesPerSave: 40,
  backdateDays: 14,
  serverFutureDays: 1,
  plausibleKcal: 1500,
  recentCount: 20,
  maxFavorites: 100,
} as const;

/** Portionen für „Gegessen“ bei einer Plan-Mahlzeit (Plan 5 Nr. 1): ½, ¾, 1, 1¼, 1½, 2. PRODUKTENTSCHEIDUNG. */
export const FOOD_LOG_PORTION_CHOICES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/**
 * Vorbelegung des Platzes beim freien Eintragen nach Uhrzeit (Minuten nach Mitternacht): Frühstück bis 10:30,
 * Mittag bis 14:30, Abend 17:00–21:30, sonst Snack. Nur Vorbelegung, keine Grenze. PRODUKTENTSCHEIDUNG.
 */
export const FOOD_LOG_DEFAULT_SLOT_MINUTES = {
  breakfastUntil: 10 * 60 + 30,
  lunchUntil: 14 * 60 + 30,
  dinnerFrom: 17 * 60,
  dinnerUntil: 21 * 60 + 30,
} as const;

// ---------------------------------------------------------------------------------------------------------
// Etappe E2 · Eigene Gerichte (docs/PLAN-AUSWERTUNG.md Abschnitt 7, KONZEPT 6.2). Identisch als CHECK bzw. Konstante
// in der Datenbank (20261015160000_custom_meals.sql, 20261015160100_custom_meal_rpcs.sql, Abgleich in
// db-sync.test.ts). Alle Werte sind PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN (Eingabegrenzen gegen
// Tippfehler, keine Empfehlungen).
// ---------------------------------------------------------------------------------------------------------

/**
 * Grenzen eines eigenen Gerichts (Plan 7):
 * - höchstens 100 Gerichte je Person, 1–30 Zutaten je Gericht (Plan 7),
 * - Name 1–60 Zeichen (Code-Points wie char_length), ohne Steuerzeichen und ohne Leerzeichen am Rand,
 * - Portionen (Gericht aus Zutaten) 1–20, ganze Zahl; ein direkt angelegtes Gericht hat genau 1 Portion,
 * - Werte JE PORTION wie ein Tagebuch-Eintrag: kcal 0–3.000 (ganz), Makros 0–750 g (eine Nachkommastelle) –
 *   `FOOD_LOG_LIMITS.kcal`/`macroG`; Zutaten-Mengen wie im Tagebuch (`FOOD_LOG_LIMITS.amountMass`/`amountPiece`,
 *   umgerechnet höchstens `gramsMax` je Zutat),
 * - `macroKcalTolerance` 0,20: Weichen die direkt eingegebenen kcal um mehr als 20 % von den kcal ab, die Eiweiß,
 *   Kohlenhydrate und Fett ergeben (`KCAL_PER_GRAM`, Atwater), fragt die App nach („Stimmen die Werte?“) – keine
 *   Sperre (Plan 7),
 * - `maxPayloadBytes` 16.000 je Speichervorgang (Server).
 */
export const CUSTOM_MEAL_LIMITS = {
  maxMeals: 100,
  maxItems: 30,
  nameMaxChars: 60,
  servings: { min: 1, max: 20 },
  macroKcalTolerance: 0.2,
  maxPayloadBytes: 16000,
} as const;

/** Portionen beim Eintragen eines eigenen Gerichts (Plan 7: 0,25–3). PRODUKTENTSCHEIDUNG. */
export const CUSTOM_MEAL_PORTION_CHOICES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

// ---------------------------------------------------------------------------------------------------------
// Etappe E3 · Gericht per Foto (Premium, Echtzeit-KI; docs/PLAN-AUSWERTUNG.md Abschnitt 9, KONZEPT 6.4 und 15).
// Identisch als SQL-Konstante in 20261016160100_ai_food_photo.sql (Abgleich in db-sync.test.ts).
// ---------------------------------------------------------------------------------------------------------

/**
 * Grenzen und Kosten der Foto-Auswertung (E3):
 * - `monthlyLimit` 30 Fotos je Kalendermonat, `dailyLimit` 8 je Kalendertag (A-G15, beides Europe/Berlin).
 *   PRODUKTENTSCHEIDUNG – als Konstante änderbar.
 * - `dailyAttemptsMax` 16: Fehlgeschlagene Aufrufe zählen NICHT gegen das Limit (Plan 9), aber höchstens 16 Versuche
 *   je Tag insgesamt – sonst ließe sich mit absichtlich kaputten Antworten beliebig Rechenzeit verbrauchen (Kosten,
 *   Risiko 10). PRODUKTENTSCHEIDUNG (Vorsicht).
 * - Eine Reservierung ohne Abschluss (Server abgestürzt, Abschluss zweimal gescheitert) zählt WEITER gegen Tages- und
 *   Monatslimit („fail closed“, Wächter E3 M4) – sicherer als eine kostenlose, nicht erfasste Auswertung.
 * - Limits je Person: über den Workflow beta-grant einstellbar (`beta_entitlements.monthly_limit`/`daily_limit`,
 *   Wächter E3 N6); fehlt der Wert, gelten diese Standardwerte. Versuchs-Deckel = 2 × Tageslimit.
 * - `maxTokens` 1.000.000 und `maxCostEur` 99: Bereich in ai_usage (CHECK) – Werte des Anbieters werden vor dem
 *   Abschluss darauf begrenzt.
 * - Antwort: höchstens 15 Bestandteile, Mengen 1–1.500 g, Sicherheit 0–1 (Plan 9).
 * - Info-Text höchstens 120 Zeichen, angezeigte Bezeichnungen höchstens 60 Zeichen (Prompt-Injection-Schutz, Plan 9).
 * - Bild: JPEG/PNG/WebP, längste Seite höchstens 1.024 px (auf dem Gerät verkleinert), höchstens 4 MB. ABWEICHUNG
 *   vom Plan (5 MB): Vercel nimmt je Anfrage höchstens 4,5 MB an – 4 MB lassen Platz für den Info-Text. Ein
 *   verkleinertes Foto (1.024 px, JPEG) hat typisch 100–400 KB.
 * - `timeoutMs` 20 s je Aufruf, `retriesOnInvalid` 1 (ungültige Antwort → einmal neu, sonst Fehler).
 * - Kosten: Modell `gemini-3.5-flash-lite` (A-G19, austauschbar per GEMINI_FOOD_PHOTO_MODEL), Normalpreis laut
 *   Preisvergleichsseiten 0,30 $ / 2,50 $ je 1 Mio. Token (Stand 15.10.2026, wie packages/content/src/pipeline/
 *   pricing.ts). Gespeichert wird VORSICHTIG 1 $ = 1 € (eher zu hoch). Schätzung je Foto: Bild ≈ 260–1.300 + Anweisung
 *   ≈ 600 Eingabe-Token, Antwort ≈ 300 → ≈ 0,0006–0,0013 € je Foto, bei 30 Fotos höchstens ≈ 4 Cent je Person und
 *   Monat. PREISE VOR LIVEGANG PRÜFEN (offizielle Preisseite ai.google.dev/gemini-api/docs/pricing).
 */
export const AI_FOOD_PHOTO = {
  feature: 'food_photo',
  monthlyLimit: 30,
  dailyLimit: 8,
  dailyAttemptsMax: 16,
  maxTokens: 1_000_000,
  maxCostEur: 99,
  /**
   * Mindest-Fassung der Einwilligung `ai_food_photo` für den ECHTEN Anbieter (Wächter E3 M3): v1 beschreibt nur die
   * Testversion ohne Übermittlung – Gemini braucht eine neue Fassung (v2) und damit eine erneute Zustimmung.
   */
  realProviderMinConsentVersion: 2,
  /** Erlaubte Limits je Person über beta-grant (Wächter E3 N6; sync: CHECK in beta_entitlements und beta_admin). */
  customLimits: { monthly: { min: 1, max: 300 }, daily: { min: 1, max: 50 } },
  maxItems: 15,
  amountG: { min: 1, max: 1500 },
  noteMaxChars: 120,
  labelMaxChars: 60,
  imageMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxImageBytes: 4_000_000,
  maxImagePx: 1024,
  timeoutMs: 20_000,
  retriesOnInvalid: 1,
  maxOutputTokens: 1024,
  defaultModel: 'gemini-3.5-flash-lite',
  /** € je 1 Mio. Token (PREISE VOR LIVEGANG PRÜFEN; 1 $ = 1 € vorsichtig). */
  pricesEurPerMTok: {
    'gemini-3.5-flash-lite': { input: 0.3, output: 2.5 },
    'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
    'gemini-3.8-flash': { input: 1.5, output: 7.5 },
  },
} as const;

// ---------------------------------------------------------------------------------------------------------
// Etappe E4a · Barcode-Nummer und Open Food Facts (gratis, ohne KI; docs/PLAN-E4.md, Gründer-Entscheidung
// 17.10.2026: E4-G1 bis E4-G13 „wie empfohlen“). Identisch als SQL-Konstante bzw. CHECK in
// 20261017100000_food_products.sql, 20261017100100_user_food_products.sql und 20261017100200_food_log_product.sql
// (Abgleich in db-sync.test.ts).
// ---------------------------------------------------------------------------------------------------------

/**
 * Schnittstelle Open Food Facts (Plan 1.1/1.2). Recherche über die Websuche am 16.10.2026 – die Original-Seiten sind
 * in der Bau-Sitzung gesperrt (Netz-Proxy). Pfad, Feldnamen und Antwortform: VOR LIVEGANG PRÜFEN (Handtest gegen
 * world.openfoodfacts.net, Plan 1.1 „Testumgebung“; Links in docs/PLAN-E4.md 1.7).
 * - `apiVersion` v2 mit `fields` (Plan-Empfehlung); ein Wechsel auf v3 ist eine Zeile (`productPath`).
 * - `fields`: nur die benötigten Felder – keine Bilder, Zutaten, Allergene, Nutri-Score, NOVA, Eco-Score,
 *   Mitwirkende (E4-G6, E4-G9). `nutriments` enthält die Werte je 100 g/ml (`_100g`), je Portion (`_serving`), die
 *   `_modifier`-Felder („<“) und zubereitete Werte (`_prepared_100g`).
 * - `userAgentApp`: User-Agent `Alpha5/<Version> (<OFF_CONTACT_EMAIL>)` ist Pflicht (Plan 1.2). Ohne Kontaktadresse
 *   fragt der Server NIE an (Route antwortet `not_configured`).
 * - `timeoutMs` 6 s, `maxResponseBytes` 512 KB, keine Weiterleitungen (Plan 3.2 Nr. 9).
 * - `backoffMinutes` 5: nach HTTP 429/503 fragt der Server 5 Minuten lang gar nicht (Schutz vor einer IP-Sperre).
 * - Quelle und Lizenz (Plan 1.3, 6.1): Datenbank ODbL 1.0, einzelne Inhalte DbCL 1.0. Bilder (CC BY-SA) zeigen wir
 *   nicht (E4-G6).
 */
export const OPEN_FOOD_FACTS = {
  apiVersion: 'v2',
  baseUrl: 'https://world.openfoodfacts.org',
  /** VOR LIVEGANG PRÜFEN: `GET <baseUrl><productPath><Nummer>?fields=…` */
  productPath: '/api/v2/product/',
  /** VOR LIVEGANG PRÜFEN (Feld-Doku, Plan 1.1). */
  fields: [
    'code',
    'product_name',
    'product_name_de',
    'generic_name_de',
    'brands',
    'quantity',
    'product_quantity',
    'product_quantity_unit',
    'serving_size',
    'serving_quantity',
    'nutrition_data_per',
    'nutriments',
    'last_modified_t',
  ],
  userAgentApp: 'Alpha5',
  timeoutMs: 6000,
  maxResponseBytes: 512 * 1024,
  backoffMinutes: 5,
  sourceDb: 'open_food_facts',
  license: 'ODbL-1.0',
  contentsLicense: 'DbCL-1.0',
  /** Öffentliche Produktseite (Link „Bei Open Food Facts ansehen“, nur nach Hinweis, E4-G11). */
  productPageUrl: 'https://world.openfoodfacts.org/product/',
  homeUrl: 'https://world.openfoodfacts.org',
  dataUrl: 'https://world.openfoodfacts.org/data',
  odblUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  dbclUrl: 'https://opendatacommons.org/licenses/dbcl/1-0/',
} as const;

/**
 * Grenzen der Produktabfrage (E4-G13, Plan 3.2/3.3):
 * - je Person `perHour` 60 und `perDay` 200 Abfragen (Kalendertag und Stunde Europe/Berlin) – Zwischenspeicher-Treffer
 *   zählen mit (die Nummer verrät Konsum, auch aus dem Speicher). PRODUKTENTSCHEIDUNG.
 * - Server gesamt `globalPerMinute` 10 OFF-Abfragen je Minute: OFF erlaubt 15 Produkt-Abfragen je Minute JE IP-ADRESSE
 *   (Plan 1.2, Quelle: OFF-API-Einführung und Issue #8818, Stand 16.10.2026 – VOR LIVEGANG PRÜFEN); alle Abfragen kommen
 *   von unserem Server, also teilen sich alle Personen das Kontingent – 10 lässt Abstand.
 * - Zwischenspeicher: `cacheFreshDays` 30 (danach neu abgefragt), `cacheDeleteDays` 90 (ohne Auffrischung gelöscht),
 *   `negativeCacheDays` 1 („nicht gefunden“ gilt 1 Tag), höchstens `purgeBatch` 500 Zeilen je Aufräumen.
 * - Zähler je Person ohne Nummer, `countsRetentionDays` 2.
 * - Anfrage an unsere Route höchstens `maxBodyBytes` 256 Byte (`{ "code": "…" }`), unveränderte OFF-Felder im
 *   Speicher höchstens `offFieldsMaxBytes` 16 KB (CHECK `octet_length(off_fields::text)`). Die Route prüft vorher die
 *   UTF-8-Bytes von `JSON.stringify` gegen `offFieldsCheckBytes` 14 KB – Puffer, weil die Textform von jsonb Leerzeichen
 *   nach „:“ und „,“ einfügt und damit länger ist (Wächter E4a N1).
 */
export const FOOD_PRODUCT_LOOKUP_LIMITS = {
  perHour: 60,
  perDay: 200,
  globalPerMinute: 10,
  cacheFreshDays: 30,
  cacheDeleteDays: 90,
  negativeCacheDays: 1,
  purgeBatch: 500,
  countsRetentionDays: 2,
  maxBodyBytes: 256,
  offFieldsMaxBytes: 16_384,
  offFieldsCheckBytes: 14_336,
  /**
   * Zeitlimit je Aufruf der Route an Supabase (Login prüfen, RPCs) – Wächter E4a N2. Route insgesamt höchstens 15 s
   * (Vercel maxDuration); die App wartet `clientTimeoutMs` 16 s, damit die Antwort der Route zuerst ankommt.
   * PRODUKTENTSCHEIDUNG.
   */
  supabaseTimeoutMs: 5_000,
  clientTimeoutMs: 16_000,
} as const;

/**
 * Plausibilitätsprüfung für Produkte (Plan 4.3/4.4, E4-G3 zweistufig) – dieselbe Prüfung für OFF-Produkte und eigene
 * Produkte. Werte je 100 g bzw. 100 ml.
 * Quellen:
 * - `kjPerKcal` 4,184: LMIV (VO (EU) Nr. 1169/2011) Anhang XIV, 1 kcal = 4,184 kJ.
 * - `saltPerSodium` 2,5: LMIV Anhang I Nr. 11 (Salz = Natrium × 2,5).
 * - Atwater-Faktoren: `RECIPE_CHECK_LIMITS.atwater` (LMIV Anhang XIV: Eiweiß/Kohlenhydrate 4, Fett 9, Ballaststoffe 2,
 *   Polyole 2,4, Alkohol 7 kcal/g).
 * - `ethanolDensity` 0,789 g/ml (Dichte von Ethanol bei 20 °C) – OFF `alcohol_100g` ist laut Recherche % vol
 *   (VOR LIVEGANG PRÜFEN), nur für die Atwater-Prüfung, nie angezeigt.
 * PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN:
 * - gesperrt (`blocked`): kcal über `kcalMax` 905 (reines Fett 900 + Rundung), ein Makro bzw. Salz über `macroMaxG`
 *   100, Summe Eiweiß + Kohlenhydrate + Fett + Ballaststoffe + Salz über `macroSumMaxG` (102 bei g, 110 bei ml – Sirup
 *   und Öl sind schwerer als Wasser), kJ/kcal außerhalb `kjPerKcalRange` 3,8–4,6 (kJ als kcal eingetragen; erst ab
 *   `kjCheckMinKcal` 10 kcal, darunter macht die Rundung das Verhältnis unbrauchbar), fehlende Werte, nur zubereitet.
 * - „Werte prüfen“ (`review`): Atwater weicht um mehr als `atwaterTolerance` 20 % (mindestens `atwaterAbsMinKcal`
 *   10 kcal) ab – weiter als R4 (15 %), weil Packungen gerundet deklariert werden; Zucker über Kohlenhydrate bzw.
 *   gesättigte über Fett um mehr als `subsetToleranceG` 0,5 g; Umrechnungen (kJ → kcal, Portion → 100 g, Einheit
 *   angenommen).
 * - Portion bzw. Packung nur `amountG` 1–2.000 (wie FOOD_LOG_LIMITS.amountMass), sonst kein Knopf.
 * - Hinweis „Angaben vom …“, wenn der OFF-Stand älter als `staleYears` 3 Jahre ist (keine Stufe).
 * - Texte aus OFF: Name ≤ `nameMaxChars` 80, Marke ≤ `brandMaxChars` 40, Packung ≤ `quantityMaxChars` 30 Zeichen.
 * - `normalizerVersion`: Fassung dieser Regeln – ändert sie sich, rechnet der Server Zwischenspeicher-Zeilen bei der
 *   nächsten Abfrage aus den unveränderten OFF-Feldern neu.
 */
export const FOOD_PRODUCT_CHECK = {
  kcalMax: 905,
  macroMaxG: 100,
  macroSumMaxG: { g: 102, ml: 110 },
  kjPerKcal: 4.184,
  kjPerKcalRange: { min: 3.8, max: 4.6 },
  kjCheckMinKcal: 10,
  saltPerSodium: 2.5,
  ethanolDensity: 0.789,
  atwaterTolerance: 0.2,
  atwaterAbsMinKcal: 10,
  subsetToleranceG: 0.5,
  amountG: { min: 1, max: 2000 },
  staleYears: 3,
  nameMaxChars: 80,
  brandMaxChars: 40,
  quantityMaxChars: 30,
  normalizerVersion: 1,
} as const;

/**
 * Eigene Produkte (Plan 2.3/3.4, E4-G8, E4-G13): höchstens `maxProducts` 200 je Person (PRODUKTENTSCHEIDUNG), Name
 * 1–60 und Marke 0–40 Zeichen (gleiche Zeichenregeln wie eigene Gerichte, E2 H1), kcal 0–900 je 100 g/ml (reines Fett),
 * Makros, Zucker und Salz 0–100 g je 100 (eine Nachkommastelle), Portion 1–2.000 g/ml (eine Nachkommastelle),
 * Summe Eiweiß + Kohlenhydrate + Fett + Salz höchstens `FOOD_PRODUCT_CHECK.macroSumMaxG`. 4 KB je Speichervorgang.
 */
export const USER_FOOD_PRODUCT_LIMITS = {
  maxProducts: 200,
  nameMaxChars: 60,
  brandMaxChars: 40,
  kcal: { min: 0, max: 900 },
  per100G: { min: 0, max: 100 },
  servingG: { min: 1, max: 2000 },
  maxPayloadBytes: 4000,
} as const;
/**
 * Farbzonen des Kalorienbalkens in der Tagesauswertung (docs/PLAN-AUSWERTUNG.md 2.1, 2.2, A-G5, Etappe A2).
 * Alle Grenzen eines Tages kommen aus `nutritionTargetsForWeek` (Untergrenze, Planband, Obergrenze, Ziel) – hier steht
 * nur der Faktor für „deutlich darüber“: rot erst über R = max(Obergrenze; Ziel × `upperRedTargetFactor`).
 * `scaleHeadroomFactor` ist reine Darstellung (Balken reicht bis R × Faktor bzw. bis zum Ist-Wert) und keine Grenze.
 * Quelle: PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN (Ernährungsfachkraft, A-G5).
 *
 * `lossGreenFromTargetFactor` (Gründer-Entscheidung G1, 15.10.2026): Bei Energie-Richtung Defizit (Abnehmen, Tag mit
 * negativer Zielanpassung `goalAdjustment < 0`) beginnt Grün erst „etwa ab dem Tagesziel“ = max(U; Z × 0,95; B_min) –
 * 0,95 als Rundungs- und Alltagstoleranz. Zwischen U und dieser Grenze ist der Tag gelb („Etwas unter deinem
 * Tagesziel“), unter U bleibt er rot. Halten und Aufbau unverändert (Grün = Planband).
 * Quelle: GRÜNDER-ENTSCHEIDUNG 15.10.2026 – VOR LIVEGANG FACHLICH PRÜFEN.
 */
export const INTAKE_ZONES = {
  upperRedTargetFactor: 1.2,
  scaleHeadroomFactor: 1.1,
  lossGreenFromTargetFactor: 0.95,
} as const;

/**
 * „Trainingsziel erreicht“ (docs/PLAN-AUSWERTUNG.md 2.5, A-G11, Etappe A2): Erfüllungsgrad 0–100 % je Einheit.
 * Stufen: ab `reachedMinPercent` „Ziel erreicht“, ab `mostlyMinPercent` „größtenteils“, darunter „teilweise“.
 * Halteübung: Satz erfüllt ab `holdDurationFraction` der Vorgabe. Ausdauer: Hinweis „lockerer hilft der Erholung“,
 * wenn die Anstrengung mehr als `effortHintAboveTarget` Punkte (Skala 0–10) über der Vorgabe liegt; Hinweis „länger als
 * geplant“ über `longerThanPlannedFraction` der geplanten Minuten. Gewicht: eine Gewichtsstufe unter der Vorgabe zählt
 * noch (Stufen wie LOAD_PROGRESSION bzw. eigene Gewichte). Quelle: PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN.
 */
export const SESSION_ACHIEVEMENT = {
  reachedMinPercent: 90,
  mostlyMinPercent: 60,
  holdDurationFraction: 0.9,
  effortHintAboveTarget: 2,
  longerThanPlannedFraction: 1.1,
} as const;

/**
 * Wochenauswertung (docs/PLAN-AUSWERTUNG.md 2.4, Abschnitt 8, A-G13, Etappe A3): Muster-Hinweis mit Hilfe-Stellen
 * (fester Essstörungs-Hinweis wie PLAN-PHASE-5 4.9), wenn in einer Woche mindestens `patternBelowFloorMinDays`
 * VERGANGENE Tage laut den Einträgen unter der Untergrenze (`floorKcal`) lagen. Einmal je Woche, kein Hinweis bei Tagen
 * über dem Ziel. Keine eigene Kaloriengrenze – die Untergrenze kommt aus `nutritionTargetsForWeek`.
 * Quelle: GRÜNDER-ENTSCHEIDUNG A-G13 (15.10.2026) – PRODUKTENTSCHEIDUNG, VOR LIVEGANG FACHLICH PRÜFEN.
 */
export const WEEK_EVALUATION = {
  patternBelowFloorMinDays: 3,
} as const;

// ---------------------------------------------------------------------------------------------------------
// Phase 10 · Etappe WP1 – Wettkampf, Machbarkeit, Phasen rückwärts (docs/PLAN-PHASE-10.md Abschnitte 3.1–3.3, 5;
// Gründer-Entscheidungen W-G2 bis W-G6 vom 16.10.2026 „wie empfohlen“). Nur Laufen 5 km bis Marathon (W-G2);
// Rad und Triathlon folgen mit WP5. Alle Werte ohne harte Quelle: PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN
// (Fachprüfung Trainingswissenschaft, PLAN-PHASE-10 Abschnitt 20 Punkt 5).
// ---------------------------------------------------------------------------------------------------------

/**
 * Wettkampf-Distanzen in Metern (nur Anzeige und spätere Pace-Rechnung, WP2). Halbmarathon und Marathon: offizielle
 * Distanzen laut World Athletics (21,0975 km bzw. 42,195 km). Rad (frei 20–300 km) folgt mit WP5.
 */
export const COMPETITION_DISTANCE_M = {
  '5k': 5000,
  '10k': 10000,
  half_marathon: 21097.5,
  marathon: 42195,
} as const;

/**
 * Mindestvorlauf in Wochen bis zum Renntag (Tabelle 3.2, W-G3). Vorsichtige Startgruppe (Flag, ab 65, unter 18)
 * nutzt die Einsteiger-Spalte (strengste Regel gewinnt). Höchstens `maxLeadWeeks` im Voraus (52 Wochen).
 * Quelle: PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN (Orientierung: übliche Lauf-Trainingspläne; die Werte sind
 * so gewählt, dass die 10-%-Kette ab dem Startumfang den Mindest-Spitzenumfang erreicht – Test „Tabelle passt zur Kette“).
 */
export const COMPETITION_LEAD_WEEKS = {
  minimum: {
    '5k': { beginner: 8, advanced: 6, competitive: 4 },
    '10k': { beginner: 10, advanced: 8, competitive: 6 },
    half_marathon: { beginner: 16, advanced: 12, competitive: 10 },
    marathon: { beginner: 24, advanced: 16, competitive: 14 },
  },
  maxLeadWeeks: 52,
} as const;

/**
 * Mindest-Spitzenumfang je Distanz (Tabelle 3.2): Wochenminuten Laufen in der Spitze und Richtwert für den langen Lauf,
 * getrennt für „Ankommen“ (`finish`) und „Zielzeit“ (`time`). Die Ampel (competitionFeasibility) prüft in WP1 nur die
 * WOCHENMINUTEN mit der 10-%-Kette; `longRunMinutes` nutzt erst der Wochenbau (WP2, langer Lauf höchstens 35 % bzw.
 * 50 % der Woche, Laufen höchstens 180 min, Halbmarathon höchstens 120 min).
 * Quelle: PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN (Plan 3.2: Halbmarathon ca. 150 min/Woche und 90–120 min
 * langer Lauf, Marathon ca. 240 min/Woche und 150–180 min; 5 km/10 km und Zielzeit-Werte: Vorschlag). „Ankommen“ ist
 * so gewählt, dass Einsteiger (Start 60 min, +10 %, Erholungsrhythmus W-G3) ihn genau zum Mindestvorlauf erreichen
 * (Test „Tabelle passt zur Kette“): 5 km 80 (Orientierung „Couch to 5K“: 3 × 25–30 min), 10 km 100, Halbmarathon
 * 140 statt „ca. 150“ (150 erst mit 17 statt 16 Wochen), Marathon 240.
 */
export const COMPETITION_REQUIRED_PEAK = {
  finish: {
    '5k': { weeklyMinutes: 80, longRunMinutes: 40 },
    '10k': { weeklyMinutes: 100, longRunMinutes: 60 },
    half_marathon: { weeklyMinutes: 140, longRunMinutes: 90 },
    marathon: { weeklyMinutes: 240, longRunMinutes: 150 },
  },
  time: {
    '5k': { weeklyMinutes: 150, longRunMinutes: 60 },
    '10k': { weeklyMinutes: 180, longRunMinutes: 75 },
    half_marathon: { weeklyMinutes: 240, longRunMinutes: 105 },
    marathon: { weeklyMinutes: 330, longRunMinutes: 165 },
  },
} as const;

/**
 * Phasen rückwärts vom Renntag (Plan 3.1):
 * - taperMinDays: Tapering mindestens so viele Tage vor dem Renntag (5 km/10 km 7, Halbmarathon 10, Marathon 14). Die
 *   App plant in ganzen Wochen: Tapering-Wochen = kleinste Zahl n ≥ 1 mit 7 × n + (Wochentag des Rennens − 1) ≥
 *   taperMinDays. Das Tapering kann deshalb bis zu 6 Tage länger sein als die Obergrenze aus Plan 3.1 (nie kürzer).
 *   Quelle: Bosquet L et al. (2007), Med Sci Sports Exerc 39(8):1358–1365 (Tapering 8–14 Tage, Umfang −41–60 %,
 *   Intensität und Häufigkeit halten); Mujika I, Padilla S (2003), Med Sci Sports Exerc 35(7):1182–1187.
 * - taperFactors: Umfang je Tapering-Woche relativ zur letzten Belastungswoche (schrittweise), Index = Anzahl der
 *   Tapering-Wochen; raceWeekFactor für die Tage der Rennwoche vor dem Vortag. Ergibt über das ganze Tapering −40 bis
 *   −55 % (Bosquet 2007). Höhe der Stufen: PRODUKTENTSCHEIDUNG.
 * - peakWeeks / buildWeeks: Länge der Spitze (Plan 3.1: 2–3 Wochen) und des Aufbaus; reicht die Zeit nicht, wird
 *   zuerst die Basis, dann der Aufbau, dann die Spitze kürzer. PRODUKTENTSCHEIDUNG.
 * - recoveryWeeks / recoveryFactors: Erholung nach dem Rennen (Plan 3.1: 5 km/10 km 3–5 Tage, Halbmarathon 1 Woche,
 *   Marathon 2 Wochen nur locker) in ganzen Wochen nach der Rennwoche, Umfang relativ zur letzten Belastungswoche.
 *   PRODUKTENTSCHEIDUNG.
 * - restDaysBeforeRace: Am Vortag keine Einheit (Plan 3.5: „Ruhetag oder 15–20 min locker“ – wir wählen den Ruhetag);
 *   am Renntag und danach in der Rennwoche ebenfalls keine Einheit. PRODUKTENTSCHEIDUNG.
 * - buildDeloadAfterLoadWeeks: Erholungsrhythmus in Aufbau und Spitze (W-G3: 3 : 1 für Einsteiger; die vorsichtige
 *   Startgruppe ebenso, strengste Regel); alle anderen und die Basis wie DELOAD_SCHEDULE. Eine Erholungswoche fällt nie
 *   in die letzte Woche vor dem Tapering – sie wird dann eine Woche vorgezogen, nie gestrichen.
 * - okPeakWeeks: „Passt“, wenn der Ziel-Spitzenumfang in mindestens so vielen Belastungswochen vor dem Tapering
 *   erreicht wird; einmal (letzte Woche vor dem Tapering) = „knapp“. PRODUKTENTSCHEIDUNG.
 * Alles VOR LIVEGANG FACHLICH PRÜFEN.
 */
export const COMPETITION_PERIODIZATION = {
  taperMinDays: { '5k': 7, '10k': 7, half_marathon: 10, marathon: 14 },
  taperFactors: { 1: [0.7], 2: [0.75, 0.6] },
  raceWeekFactor: 0.4,
  peakWeeks: { '5k': 2, '10k': 2, half_marathon: 3, marathon: 3 },
  buildWeeks: { '5k': 2, '10k': 2, half_marathon: 4, marathon: 6 },
  recoveryWeeks: { '5k': 1, '10k': 1, half_marathon: 1, marathon: 2 },
  recoveryFactors: [0.5, 0.6],
  restDaysBeforeRace: 1,
  buildDeloadAfterLoadWeeks: { beginner: 3, cautious: 3 },
  okPeakWeeks: 2,
} as const;

/**
 * Wer bekommt welchen Wettkampfplan (Tabelle 3.3, W-G4) – strengste Regel gewinnt:
 * - Schwangerschaft: kein Wettkampfplan (Hinweis Ärztin/Arzt); ohne Gesundheits-Check: erst nach dem Check.
 * - Unter 18: höchstens `minorMaxDiscipline` (Halbmarathon), keine Zielzeit.
 * - Gesundheits-Flag und ab 65: nur „Ankommen“, Hinweis ärztliche Abklärung (Sporttauglichkeit).
 * - Zielzeit nur für `timeGoalLevels` (Fortgeschritten, Leistungssport) außerhalb der vorsichtigen Startgruppe und nur
 *   mit eigener Referenzzeit (W-G6).
 * Quelle: GRÜNDER-ENTSCHEIDUNG W-G4/W-G6 (16.10.2026) – PRODUKTENTSCHEIDUNG, VOR LIVEGANG FACHLICH PRÜFEN.
 */
export const COMPETITION_GROUP_RULES = {
  minorMaxDiscipline: 'half_marathon',
  timeGoalLevels: ['advanced', 'competitive'],
} as const;

/**
 * Eigener Startumfang (W-G5, „ich laufe schon X min/Woche“): nur für `levels` (Fortgeschritten, Leistungssport)
 * außerhalb der vorsichtigen Startgruppe, nur mit ausdrücklicher Bestätigung, gedeckelt auf `maxFactor` × Startumfang
 * der Startgruppe (ENDURANCE_START_RULES). Gibt es einen Bezug aus dem Tagebuch (min(geplant, eingetragen) der letzten
 * Belastungswoche), gilt dieser statt der eigenen Angabe. Quelle: GRÜNDER-ENTSCHEIDUNG W-G5 (16.10.2026) –
 * PRODUKTENTSCHEIDUNG, VOR LIVEGANG FACHLICH PRÜFEN.
 */
export const COMPETITION_OWN_START = {
  levels: ['advanced', 'competitive'],
  maxFactor: 2,
  minWeeklyMinutes: 10,
} as const;

/**
 * Eingabegrenzen Wettkampf (competitionSchema): Name 1–80 Zeichen (nur Anzeige); Ziel- und Referenzzeiten je Distanz
 * nur als Plausibilitätsgrenze (unten knapp unter den Weltrekorden, oben übliche Zielschluss-Zeiten bzw. Gehtempo);
 * Referenzzeit höchstens `referenceMaxAgeDays` alt (Plan 3.4: „nicht älter als 6 Monate“), nie in der Zukunft.
 * Quelle: PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN.
 */
export const COMPETITION_INPUT_LIMITS = {
  nameMaxLength: 80,
  timeS: {
    '5k': { min: 12 * 60, max: 90 * 60 },
    '10k': { min: 26 * 60, max: 3 * 60 * 60 },
    half_marathon: { min: 55 * 60, max: 6 * 60 * 60 },
    marathon: { min: 2 * 60 * 60, max: 8 * 60 * 60 },
  },
  referenceMaxAgeDays: 183,
} as const;

/**
 * Bezug aus dem Tagebuch für den Start eines Wettkampfplans (`startReference`, Wächter H1/H2 zu WP1):
 * - Zod-Grenzen: Wochenumfang 0 (= ohne Bezug) oder `minMinutes` (Einheiten-Minimum, darunter rechnet die Engine wie
 *   „ohne Bezug“) bis `maxWeeklyMinutes` = 7 Einheiten × 240 min (PLAN_BLOCK_LIMITS.sessionsPerWeek ×
 *   TRAINING_LIMITS.minutesPerSession.max – mehr kann kein gespeicherter Plan enthalten); längste Einheit 10–240 min und
 *   nie über dem Wochenumfang.
 * - Deckel wie beim eigenen Startumfang (W-G5): höchstens `maxFactor` × Startumfang der AKTUELLEN Startgruppe. Der Bezug
 *   ist ein Wert, den die App aus dem bisherigen Plan liefert – ohne Deckel könnte er die 10-%-Regel aushebeln.
 * - Startgruppe des Bezugs ist Pflicht: Ist die aktuelle Gruppe strenger (z. B. ab 65, neues Flag), beginnt die Kette
 *   wieder beim Startumfang und Start-Deckel der neuen Gruppe (wie nextPlanBlock, `stricterGroup`).
 * Quelle: PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN (Deckel wie GRÜNDER-ENTSCHEIDUNG W-G5).
 */
export const COMPETITION_START_REFERENCE = {
  minMinutes: ENDURANCE_SESSION_LIMITS.minSessionMinutes,
  maxWeeklyMinutes: PLAN_BLOCK_LIMITS.sessionsPerWeek * TRAINING_LIMITS.minutesPerSession.max,
  maxSessionMinutes: TRAINING_LIMITS.minutesPerSession.max,
  maxFactor: COMPETITION_OWN_START.maxFactor,
} as const;

/**
 * Tagebuch-Bezug beim Erstellen eines Wettkampfplans in der App (WP4): nur Einheiten der letzten 28 Tage vor heute
 * (Plan 3.2: „gibt es Tagebuch-Einträge der letzten 4 Wochen, zählt min(geplant, eingetragen)“). Künftige und nur
 * geplante Wochen zählen nie. Quelle: docs/PLAN-PHASE-10.md 3.2 – PRODUKTENTSCHEIDUNG, VOR LIVEGANG FACHLICH PRÜFEN.
 */
export const COMPETITION_START_LOOKBACK_DAYS = 28;

// ---------------------------------------------------------------------------------------------------------
// Phase 10 · Etappe WP2 – Einheiten, Intensität, Wochenbau (docs/PLAN-PHASE-10.md Abschnitte 3.3–3.6 und 6;
// Gründer-Entscheidungen W-G6/W-G7/W-G8 und G2/G3/G7 vom 16.10.2026 „wie empfohlen“). Gilt NUR im Wettkampfplan –
// Pläne ohne Wettkampf bleiben unverändert. Alle Werte ohne harte Quelle: PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH
// PRÜFEN (Fachprüfung Trainingswissenschaft, PLAN-PHASE-10 Abschnitt 20 Punkt 5).
// ---------------------------------------------------------------------------------------------------------

/**
 * Langer Lauf (Gründer-Entscheidung G2, Plan 3.5):
 * - eigene Steigerungsregel: längste Einheit einer Belastungswoche ≤ floor(1,1 × längste Einheit der letzten
 *   Belastungswoche) (wie die 10-%-Regel, MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION); in der ersten Belastungswoche
 *   höchstens der Start-Deckel je Einheit (ENDURANCE_SESSION_LIMITS: Einsteiger 30, vorsichtig 20, sonst 90 = erste
 *   Belastungswoche); Erholungs-/Tapering-Wochen nie länger als die letzte Belastungswoche;
 * - `maxShareOfWeek`: höchstens 50 % der Wochenminuten bei ≥ 2 Einheiten (G2 statt „35 % bei ≥ 4 Einheiten“ aus 3.5);
 * - `maxMinutes`: Laufen höchstens 180 min, Halbmarathon-Plan höchstens 120 min (Plan 3.5); 5 km/10 km: Vorschlag;
 * - Die Ampel prüft den langen Lauf mit: gefordert ist min(Richtwert COMPETITION_REQUIRED_PEAK.longRunMinutes,
 *   floor(maxShareOfWeek × Spitzen-Wochenumfang)) – mehr ist wegen G3 (Plateau beim Spitzenumfang) und der 50-%-Regel
 *   nie erreichbar (Gründer-Frage G8).
 * Quelle: GRÜNDER-ENTSCHEIDUNG G2 (16.10.2026) – PRODUKTENTSCHEIDUNG, VOR LIVEGANG FACHLICH PRÜFEN.
 */
export const COMPETITION_LONG_RUN = {
  maxShareOfWeek: 0.5,
  maxMinutes: { '5k': 75, '10k': 90, half_marathon: 120, marathon: 180 },
} as const;

/**
 * Intensität ohne Pulsuhr (Plan 3.4, W-G7): Anstrengung 0–10 (Borg CR10) und Sprechtest (TALK_TEST_BANDS).
 * - `hardEffortMin` 6: ab hier zählt Zeit als „hart“ für die 80/20-Regel (Plan 3.4: „Anstrengung ≥ 6“, Seiler 2010:
 *   oberhalb der ersten Schwelle; Sprechtest „nur kurze Sätze“ endet bei TALK_TEST_BANDS.shortSentencesMax),
 * - `hardShareMax` = ENDURANCE_HIGH_INTENSITY_SHARE (0,2): höchstens 20 % der Wochenminuten hart (Seiler S (2010), Int J
 *   Sports Physiol Perform 5(3):276–291). Einsteiger und die vorsichtige Startgruppe zählen nur die harten Abschnitte
 *   (Plan 3.4), alle anderen den ganzen Hauptteil einer harten Einheit (inkl. Trabpausen) – strenger,
 * - `effort`: Anstrengung je Art (Plan 3.4): locker 3–4 (ENDURANCE_EFFORT), Erholungslauf 2, Steigerungen 7 (nur
 *   20 s), Fahrtspiel 6, Tempo 7, Intervalle 8 (nie „alles geben“), Renntempo je Distanz,
 * - `hardEffortCap`: höchste Anstrengung harter Abschnitte: allgemein 8 (kein Maximaltest), unter 18 7 (Tabelle 3.3),
 *   ab 65 6 („zügig“, Tabelle 3.3 – heute ohnehin nur Gehen, G7). Gesundheits-Flag, Schwangerschaft, ohne Check und
 *   „nur Gehen“: keine harten Einheiten.
 * - `hardSessionsPerWeek`: Einsteiger und vorsichtige Startgruppe höchstens 1 (ab Aufbau), sonst 2 (Tabelle 3.3);
 *   Einsteiger erst ab 3 Ausdauer-Einheiten in der Woche (Plan 6: „nur 2 Tage → kein Tempo + langer Lauf“).
 * Quelle: Borg GA (1982); Foster C et al. (2008); Seiler S (2010); Tabelle 3.3 (GRÜNDER-ENTSCHEIDUNG W-G4) –
 * Werte PRODUKTENTSCHEIDUNG, VOR LIVEGANG FACHLICH PRÜFEN.
 */
export const COMPETITION_INTENSITY = {
  hardEffortMin: 6,
  hardShareMax: ENDURANCE_HIGH_INTENSITY_SHARE,
  effort: {
    recovery: 2,
    strides: 7,
    fartlek: 6,
    tempo: 7,
    intervals: 8,
    racePace: { '5k': 8, '10k': 7, half_marathon: 6, marathon: 6 },
  },
  hardEffortCap: { general: 8, minor: 7, senior: 6 },
  hardSessionsPerWeek: { strict: 1, general: 2 },
  beginnerMinEnduranceSessions: 3,
} as const;

/**
 * Aufbau der Einheiten (feste Bausteine, W-G8), alle Zeiten in Sekunden bzw. Minuten:
 * - harte Einheit erst ab `hardMinMinutes` (25 min: Aufwärmen `hardWarmupMinutes` + Hauptteil + Abwärmen
 *   `hardCooldownMinutes`); passt der kleinste Hauptteil nicht (Dauer oder 80/20-Budget), wird sie locker,
 * - lockere Einheit ab `easyWarmupFromMinutes`: 5 min Aufwärmen und 5 min Abwärmen locker-unten,
 * - Steigerungen: `strides.count` × `strides.workS` zügig, je `strides.restS` locker (nur Basis/Aufbau,
 *   Fortgeschrittene, Plan 3.1/3.4),
 * - Fahrtspiel 1 min zügig / 2 min locker, Tempo am Stück (Einsteiger 2 Teile mit 2 min Trabpause), Intervalle 3 min /
 *   2 min Trabpause, Renntempo-Abschnitte je Distanz mit 2 min locker; jeweils höchstens `maxReps` Wiederholungen bzw.
 *   `tempoMaxMinutes` am Stück.
 * Quelle: übliche Lauf-Trainingspraxis (z. B. Daniels J, „Daniels' Running Formula“, 3. Aufl. 2014 – Intervalle 3–5
 * min, Tempo 20 min) – Werte PRODUKTENTSCHEIDUNG, VOR LIVEGANG FACHLICH PRÜFEN.
 */
export const COMPETITION_WORKOUTS = {
  hardMinMinutes: 25,
  hardWarmupMinutes: 10,
  hardCooldownMinutes: 5,
  easyWarmupFromMinutes: 20,
  easyWarmupMinutes: 5,
  strides: { count: 6, workS: 20, restS: 60, minCount: 4 },
  fartlek: { workS: 60, restS: 120, minReps: 4, maxReps: 8 },
  tempo: {
    minMinutes: 10,
    maxMinutes: { beginner: 16, advanced: 25, competitive: 30 },
    beginnerRestS: 120,
  },
  intervals: { workS: 180, restS: 120, minReps: 3, maxReps: 6 },
  racePace: {
    workS: { '5k': 180, '10k': 300, half_marathon: 600, marathon: 900 },
    restS: 120,
    minReps: 2,
    maxReps: 4,
  },
} as const;

/**
 * Pace-Richtwerte (W-G6, Plan 3.4/3.6) – NUR mit eigener Referenzzeit (Wettkampf oder Testlauf, ≤ 6 Monate):
 * - Riegel-Formel T₂ = T₁ × (D₂/D₁)^1,06 (Riegel PS (1981), „Athletic records and human endurance“, Am Sci 69:285–290),
 * - Spannen in s/km relativ zum vorhergesagten Renntempo: locker/lang = 10 km + 60–90 s, Erholung = 10 km + 90–120 s,
 *   Tempo = 10 km + 10–25 s (zwischen 10-km- und Halbmarathon-Tempo), Intervalle = 5 km + 0–10 s (nie schneller),
 *   Renntempo = Renntempo + 0–5 s; Fahrtspiel/Steigerungen nach Gefühl (keine Pace),
 * - Distanz-Richtwert = Dauer ÷ langsames Ende der Spanne, abgerundet auf 0,5 km (vorsichtig kürzer), nur 0,1–60 km
 *   (Grenze von target_distance_m, WP3),
 * - Zielzeit-Plausibilität: Zielzeit höchstens `goalTimeMaxImprovement` (5 %) schneller als die Riegel-Vorhersage aus
 *   der Referenzzeit, sonst Ziel „Ankommen“ und höchstens „knapp“ (Plan 3.2).
 * - `maxRiegelDistanceFactor` 4 (Wächter M3): Riegel nur, wenn Referenz- und Zieldistanz höchstens um den Faktor 4
 *   auseinanderliegen (z. B. Marathon erst ab 10-km-Referenz, Halbmarathon ab 5,3 km). Darüber sagt Riegel für
 *   Freizeitläufer zu schnelle Zeiten voraus (Riegel 1981 beschreibt die Formel für Dauern von ca. 3,5–230 min; Vickers AJ,
 *   Vertosick EA (2016), „An empirical study of race times in recreational endurance runners“, BMC Sports Sci Med Rehabil
 *   8:26 – Quelle vor Livegang prüfen) → keine Zielzeit-Plausibilität (Ziel „Ankommen“) und keine Pace auf dieser Basis.
 * Quelle: Riegel 1981; Spannen, 5 % und Faktor 4: PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN.
 */
export const COMPETITION_PACE = {
  riegelExponent: 1.06,
  spansSPerKm: {
    easy: { base: '10k', fast: 60, slow: 90 },
    long: { base: '10k', fast: 60, slow: 90 },
    recovery: { base: '10k', fast: 90, slow: 120 },
    tempo: { base: '10k', fast: 10, slow: 25 },
    intervals: { base: '5k', fast: 0, slow: 10 },
    race_pace: { base: 'race', fast: 0, slow: 5 },
  },
  distanceRoundingM: 500,
  distanceM: { min: 100, max: 60000 },
  goalTimeMaxImprovement: 0.05,
  maxRiegelDistanceFactor: 4,
} as const;

/**
 * Anstrengung geplanter Einheiten im Wettkampfplan: CHECK `effort_target between 1 and 8` seit WP3
 * (20261016140100_competitions.sql), „> 4 (`easyMax`) nur bei harter Art“; serverseitig zusätzlich unter 18 ≤ 7 und ab
 * 65 ≤ 6 (COMPETITION_INTENSITY.hardEffortCap, private.insert_plan_sessions) – Wächter N2, db-sync.test.ts. Ohne Art
 * (Pläne ohne Wettkampf) bleibt es bei 1–4 (= ENDURANCE_EFFORT_LIMITS). Die Engine plant höchstens 8 („nie alles
 * geben“). Quelle: docs/PLAN-PHASE-10.md Abschnitt 7 – PRODUKTENTSCHEIDUNG.
 */
export const COMPETITION_EFFORT_LIMITS = {
  min: 1,
  max: 8,
  easyMax: ENDURANCE_EFFORT.easyMax,
} as const;

/**
 * Datenmodell Wettkampf (Phase 10 WP3, 20261016140100_competitions.sql; Abgleich db-sync.test.ts):
 * - `workoutStepsMaxBytes`: Größe der Schritte einer Einheit (`planned_sessions.workout_steps` als jsonb-Text). 40
 *   Schritte (WORKOUT_STEP_LIMITS) brauchen höchstens ca. 2,8 KB – die Grenze schützt nur vor übergroßen Eingaben.
 * - `leadWeeksServerColumn`: Mindestvorlauf, den der SERVER beim Speichern prüft (save_competition) = lockerste Spalte
 *   der Tabelle 3.2 (Leistungssport). Die genaue Spalte (Level, vorsichtige Startgruppe) prüft Core (competitionSchema,
 *   Ampel); der Server kennt das Level des nächsten Plans noch nicht und ist nur die harte Untergrenze.
 * Quelle: PRODUKTENTSCHEIDUNG (technische Grenzen, keine fachlichen Werte).
 */
export const COMPETITION_RECORD_LIMITS = {
  workoutStepsMaxBytes: 4096,
  leadWeeksServerColumn: 'competitive',
} as const;

/**
 * Neue Fassung der 4b-Regel `endurance_reduce` (Risiko 7, PLAN-PHASE-4B R3, Wächter S6) – VORSCHLAG für 4b: Ein
 * Ausdauer-Eintrag zählt als „zu hart“, wenn die eingetragene Anstrengung ≥ max(`minEffort`, Ziel + `margin`) ist
 * (lockere Ziele ≤ 4 → genau die bisherige feste 7). Harte Ziele (> 4) vorsichtiger (Wächter N4): ≥ Ziel +
 * `hardMargin`, höchstens `hardMaxEffort` (Tempo 7 → 9, Intervalle 8 → 9). Steigerungen werden am Ziel des Hauptteils
 * (locker) gemessen. Quelle: PLAN-PHASE-4B (feste 7 = „sehr anstrengend“, Borg CR10) – Abstände: PRODUKTENTSCHEIDUNG,
 * VOR LIVEGANG FACHLICH PRÜFEN.
 */
export const ENDURANCE_OVERLOAD_RULE = {
  minEffort: 7,
  margin: 3,
  hardMargin: 2,
  hardMaxEffort: 9,
  easyTargetMax: ENDURANCE_EFFORT.easyMax,
} as const;

/**
 * Kraft im Wettkampfplan (Plan 3.5): in Spitze, Tapering und Rennwoche höchstens `maxStrengthSessionsPerWeek`
 * Kraft-Einheit; Übungen mit Bein-Muskeln (`legMuscles` als Hauptmuskel) dort nur in Erholungs-Dosierung
 * (deloadDosage: halbe Sätze, RPE −2) – „ohne schwere Beine“. Harte Ausdauer nie am Tag vor oder nach einem Kraft-Tag
 * mit Beinen (Ganzkörper oder Unterkörper; über die Wochengrenze hinweg zählt jeder Kraft-Tag, vorsichtig).
 * Quelle: PRODUKTENTSCHEIDUNG (Plan 3.5) – VOR LIVEGANG FACHLICH PRÜFEN.
 */
export const COMPETITION_STRENGTH = {
  limitedPhases: ['peak', 'taper', 'race_week'],
  maxStrengthSessionsPerWeek: 1,
  legMuscles: ['glutes', 'quadriceps', 'hamstrings', 'adductors', 'calves'],
} as const;

// ---------------------------------------------------------------------------------------------------------
// Phase 10 · Etappe S1 · Strecken aufzeichnen (docs/PLAN-PHASE-10.md 11.2 und 12, KONZEPT 10.1)
// Gleiche Werte in supabase/migrations/20261016220100_tracked_routes.sql bzw. *_tracked_route_rpcs.sql
// (Abgleich in db-sync.test.ts).
// ---------------------------------------------------------------------------------------------------------

/**
 * Rohpunkte filtern (filterTrackPoints): Punkte mit einer gemeldeten Genauigkeit über `maxAccuracyM` fallen raus
 * (Plan S1: „Genauigkeit > 30 m raus“); ein Punkt näher als `minMoveM` am zuletzt behaltenen gilt als Stillstand und
 * fällt raus (sonst summiert das GPS-Rauschen im Stehen Meter auf); ein Sprung, dessen Geschwindigkeit seit dem zuletzt
 * behaltenen Punkt über `jumpFactor` × CARDIO_PLAUSIBILITY_KMH der Sportart liegt, fällt raus (GPS-Sprung).
 * Quellen: Plan S1 (30 m); typische Genauigkeit von Handy-GPS unter freiem Himmel ca. 5 m (U.S. Government, GPS.gov
 * „GPS Accuracy“, smartphones „typically accurate to within a 4.9 m radius under open sky“); `minMoveM` und
 * `jumpFactor`: PRODUKTENTSCHEIDUNG (Sprung-Schwelle bewusst über der Warn-Schwelle, damit z. B. eine schnelle
 * Bergab-Fahrt nur eine Warnung auslöst und nicht verworfen wird).
 */
export const ROUTE_FILTER = {
  maxAccuracyM: 30,
  minMoveM: 3,
  /**
   * Wächter S1 H1: Ein Punkt zählt erst als neue Position, wenn er weiter als max(minMoveM, accuracyMoveFactor ×
   * gemeldete Genauigkeit) vom letzten behaltenen Punkt liegt. Die gemeldete Genauigkeit ist der Radius, in dem die
   * wahre Position mit ca. 68 % Wahrscheinlichkeit liegt (Android `Location.getAccuracy()`, iOS
   * `CLLocation.horizontalAccuracy`) – Sprünge darunter sind meist Rauschen. Faktor: PRODUKTENTSCHEIDUNG.
   */
  accuracyMoveFactor: 1,
  jumpFactor: 1.5,
  /**
   * Wächter S1 M1: Werden `reanchorPoints` Punkte hintereinander als Sprung verworfen, passen sie aber untereinander
   * zusammen, und sind bis dahin weniger Punkte behalten worden, war der Anfang ein Ausreißer (z. B. Kaltstart des
   * GPS): Der Anfang wird verworfen und an den verworfenen Punkten neu verankert. Quelle: PRODUKTENTSCHEIDUNG.
   */
  reanchorPoints: 5,
} as const;

/**
 * Höhenmeter per GPS (elevationGain): gleitender Mittelwert über `smoothingWindow` Punkte, dann zählt ein Anstieg erst,
 * wenn er `thresholdM` über dem letzten Tiefpunkt liegt (Hysterese gegen GPS-Rauschen; Plan S1: Schwelle 3–5 m). Die
 * App zeigt immer den Hinweis „Höhenmeter per GPS sind ungenau“.
 * Quellen: Plan S1; Menaspà P et al. (2014), „Validity of the Garmin Edge 500 and Polar CS600 global positioning
 * system devices for measuring cumulative elevation gain“, Int J Sports Physiol Perform 9(6) (GPS-Höhe streut um
 * mehrere Meter); Fenster und Schwelle: PRODUKTENTSCHEIDUNG.
 */
export const ROUTE_ELEVATION = {
  smoothingWindow: 5,
  thresholdM: 4,
} as const;

/**
 * Automatische Pause (autoPause): Ein Abschnitt zwischen zwei behaltenen Punkten langsamer als `minKmh` der Sportart
 * zählt als Pause (keine Bewegungszeit, keine Distanz). Plan S1: „unter Gehtempo = Pause“ – für Gehen selbst eine
 * Schwelle deutlich unter dem langsamen Gehen.
 * Quellen: Bohannon RW (1997), „Comfortable and maximum walking speed of adults aged 20–79 years“, Age Ageing 26(1):15–19
 * (bequemes Gehen ca. 4,5–5,3 km/h); Schwellen selbst: PRODUKTENTSCHEIDUNG.
 */
export const ROUTE_AUTO_PAUSE_KMH = { run: 3, bike: 5, walk: 1.5 } as const;

/**
 * Bewegung erkennen (Wächter S1 H1, motionSegments): Positionen werden über höchstens `smoothingPoints` Punkte je
 * Seite gemittelt (symmetrisch, an Anfang und Ende kürzer – gerade Strecken bleiben exakt). Ein Abschnitt ist in
 * Bewegung, wenn die geglättete Position über ein gleitendes Zeitfenster von `windowS` Sekunden um den Abschnitt
 * schneller als ROUTE_AUTO_PAUSE_KMH vorankommt; Distanz und Höhenmeter zählen nur in Bewegung, die Distanz aus den
 * geglätteten Positionen. So erzeugt Stillstand mit GPS-Rauschen (σ einige Meter) keine Kilometer.
 * Quellen: Zandbergen PA, Barbeau SJ (2011), „Positional Accuracy of Assisted GPS Data from High-Sensitivity
 * GPS-enabled Mobile Phones“, J Navigation 64(3):381–399 (Streuung im Stillstand mehrere Meter); Fenster und
 * Glättung: PRODUKTENTSCHEIDUNG (Fenster 10–20 s laut Wächter-Auflage).
 */
export const ROUTE_MOTION = {
  windowS: 20,
  smoothingPoints: 5,
} as const;

/**
 * Warnung „Bitte prüfen“ der Strecke (kein Verwerfen): Ist die Geschwindigkeit über mindestens `windowS` Sekunden
 * (zwischen behaltenen Punkten) höher als CARDIO_PLAUSIBILITY_KMH der Sportart, zeigt die App eine Warnung (z. B.
 * Bergab-Rad mit 70 km/h oder versehentlich im Auto aufgezeichnet). Quelle: PRODUKTENTSCHEIDUNG (wie Ausdauer-Eintrag).
 */
export const ROUTE_SPEED_WARNING = { windowS: 10 } as const;

/**
 * Vereinfachen (simplifyTrack, Douglas-Peucker): Toleranz `toleranceM` Meter; hat das Ergebnis mehr als
 * TRACKED_ROUTE_LIMITS.maxPoints Punkte, wird die Toleranz jeweils verdoppelt (höchstens bis `maxToleranceM`, danach
 * wird gleichmäßig ausgedünnt). Quellen: Douglas DH, Peucker TK (1973), „Algorithms for the reduction of the number of
 * points required to represent a digitized line or its caricature“, Cartographica 10(2):112–122; Toleranz:
 * PRODUKTENTSCHEIDUNG (in der Größenordnung der GPS-Genauigkeit).
 */
export const ROUTE_SIMPLIFY = {
  toleranceM: 5,
  maxToleranceM: 640,
} as const;

/**
 * GPX-Export (Wächter S1 N4): Punkte mit ungültigen Koordinaten werden übersprungen, Höhen außerhalb `elevationM`
 * weggelassen (tiefster Landpunkt ca. −430 m am Toten Meer, höchster 8.849 m Mount Everest). Quelle: U.S. Geological
 * Survey / National Geographic (2020, Höhe Mount Everest); Rahmen mit Reserve: PRODUKTENTSCHEIDUNG.
 */
export const ROUTE_GPX = {
  elevationM: { min: -1000, max: 10_000 },
  coordinateDecimals: 6,
  elevationDecimals: 1,
} as const;

/**
 * Tagebuch-Eintrag mit Strecke (Wächter S1 M3, sichere Variante a): Dauer und Distanz des Eintrags müssen zur
 * verknüpften Strecke passen – Distanz höchstens `distanceShare` (Anteil) oder `distanceMinM` Meter daneben (das
 * Größere), Dauer zwischen Bewegungszeit − `durationToleranceS` und Gesamtdauer + `durationToleranceS`. Gilt beim
 * Verknüpfen (save_tracked_route) und bei jeder späteren Änderung des Eintrags (save_session_log). Quelle:
 * PRODUKTENTSCHEIDUNG.
 */
export const TRACKED_ROUTE_LOG_MATCH = {
  distanceShare: 0.1,
  distanceMinM: 100,
  durationToleranceS: 300,
} as const;

/**
 * Gespeicherte Strecke (tracked_routes, save_tracked_route) – Plan S1 „Datenmodell“:
 * - Name 1–80 Zeichen (ohne Leerraum am Rand), Notiz höchstens 280 Zeichen (wie das Tagebuch),
 * - 2 bis `maxPoints` Punkte nach dem Vereinfachen (Plan: höchstens 5.000), Polyline-Genauigkeit 5 Nachkommastellen
 *   (ca. 1 m; Google „Encoded Polyline Algorithm Format“), Länge höchstens `polylineMaxChars` (je Punkt höchstens
 *   12 Zeichen: 2 × 6 Zeichen bei einer Änderung von bis zu 360° → 5.000 × 12),
 * - Dauer, Distanz, Höhenmeter wie CARDIO_LOG_LIMITS (1 min–12 h, bis 500 km, bis 10.000 m),
 * - Distanz-Plausibilität: Durchschnitt über die ganze Dauer höchstens ROUTE_FILTER.jumpFactor ×
 *   CARDIO_PLAUSIBILITY_KMH (so schnell kann keine gefilterte Strecke sein),
 * - Beginn höchstens `clockSkewS` Sekunden in der Zukunft (Uhr des Geräts) und nicht vor `startedAtMin`,
 * - Tagebuch-Eintrag: Tag des Eintrags = Tag des Beginns (Europe/Berlin) bis `sessionLogDayTolerance` Tag danach
 *   (Aufzeichnung über Mitternacht),
 * - Schutz gegen Missbrauch: höchstens `maxSavesPerDay` NEUE Strecken je Kalendertag (gezählt werden Erstellungen,
 *   auch später gelöschte; wie SESSION_LOG_LIMITS.maxLogsPerDay).
 * Quelle: Plan S1; Tageslimit und Toleranzen: PRODUKTENTSCHEIDUNG.
 */
export const TRACKED_ROUTE_LIMITS = {
  nameMaxLength: 80,
  noteMaxChars: 280,
  minPoints: 2,
  maxPoints: 5_000,
  polylinePrecision: 5,
  polylineMaxChars: 60_000,
  durationS: CARDIO_LOG_LIMITS.durationS,
  distanceM: CARDIO_LOG_LIMITS.distanceM,
  elevationGainM: CARDIO_LOG_LIMITS.elevationM,
  clockSkewS: 300,
  startedAtMin: '2020-01-01T00:00:00Z',
  sessionLogDayTolerance: 1,
  maxSavesPerDay: 20,
} as const;

/**
 * Zeitvergleich auf einer Favoriten-Strecke (compareAttempts, W-G16): nur eigene Läufe derselben Favoriten-Strecke und
 * Sportart; vergleichbar nur, wenn die Distanz höchstens `distanceTolerance` (Anteil) von der Favoriten-Strecke
 * abweicht (abgebrochene oder abgekürzte Läufe werden nicht verglichen); Unterschiede bis `sameWithinS` Sekunden
 * heißen „gleich schnell“. Keine Bestzeiten, Ranglisten oder Serien. Quelle: PRODUKTENTSCHEIDUNG (W-G16).
 */
export const ROUTE_COMPARE = {
  distanceTolerance: 0.1,
  sameWithinS: 5,
} as const;
