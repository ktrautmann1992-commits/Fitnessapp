/**
 * Zentrale Grenzwerte und Formel-Konstanten.
 *
 * Regel aus CLAUDE.md: ALLE Rechenformeln und Schutzgrenzen stehen hier, jeweils mit Quelle.
 * Die Schutzgrenzen sind fest im Code und NICHT durch Nutzer abschaltbar.
 */

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
 * Quelle: CLAUDE.md; „10-%-Regel“, u. a. ACSM's Guidelines for Exercise Testing and Prescription.
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
 * Zeitbudget (Tabelle `goals`).
 * - 1–7 Trainingstage pro Woche: CLAUDE.md („1 vs. 7 Trainingstage“ als Grenzfälle).
 * - 10–240 Minuten pro Einheit: kürzere Einheiten sind kaum planbar; 4 h deckt lange Ausdauereinheiten ab.
 */
export const TRAINING_LIMITS = {
  sessionsPerWeek: { min: 1, max: 7 },
  minutesPerSession: { min: 10, max: 240 },
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
