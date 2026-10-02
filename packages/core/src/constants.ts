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
