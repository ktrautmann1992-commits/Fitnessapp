import type { ExerciseLogStatus, LoadType } from '../enums';
import type { IncrementKind } from '../plan/loads';

/**
 * Gemeinsame Typen des Trainingstagebuchs (docs/PLAN-PHASE-4.md Abschnitte 3.3 und 5). Felder in camelCase; die
 * App bildet sie aus den Zeilen von `exercise_logs`/`set_logs` (snake_case) ab.
 */

/**
 * Progressions-Zustand einer Übung (= `state_*`, W4): roh und ortsunabhängig – ohne Abrunden auf Stufen des Orts,
 * ohne Deload-Faktor, ohne RPE −1 der Einstiegswoche, ohne Klemmen auf den Wdh.-Bereich eines Plans.
 * Fassungsunabhängig: Die Sätze kommen aus dem jeweiligen Plan-Termin, `extraSet` = +1 Satz aus dem Puffer.
 */
export interface ExerciseProgress {
  /** Gewicht je Hantel/Kugel bzw. Langhantel gesamt; null = noch kein Arbeitsgewicht. */
  readonly weightKg: number | null;
  readonly targetReps: number | null;
  readonly extraSet: boolean;
  readonly durationS: number | null;
}

/** Ein eingetragener Satz (`set_logs`). */
export interface LoggedSet {
  readonly reps: number | null;
  readonly weightKg: number | null;
  readonly durationS: number | null;
  /** RPE 5–10 (10 − RPE = Wiederholungen in Reserve); null = ohne Angabe. */
  readonly rpe: number | null;
  readonly done: boolean;
}

/** Eine Übung in einem Eintrag (`exercise_logs` + Angaben der Einheit) – Eingabe für die Progression. */
export interface ExerciseLogEntry {
  /** TATSÄCHLICH gemachte Übung (bei `alternative` die Alternative). */
  readonly exerciseId: string;
  readonly performedOn: string;
  /** Reihenfolge innerhalb eines Tages (z. B. `finished_at` bzw. `client_updated_at`, ISO-Zeitstempel). */
  readonly loggedAt: string;
  readonly status: ExerciseLogStatus;
  readonly loadType: LoadType;
  readonly isIntroWeek: boolean;
  readonly isDeload: boolean;
  /** Wiedereinstieg nach Pause (RETURN_AFTER_PAUSE) – zählt nicht für die Progression. */
  readonly isReturn?: boolean;
  /** Vorgabe beim Training (Anzeige-Schnappschuss, 3.3) – nach Widerruf aus Gesundheits-Plänen leer. */
  readonly targetSets: number | null;
  readonly targetWeightKg: number | null;
  /** Angezeigtes Wdh.-Ziel und Zusatzsatz – Fortschritt an einem gerundeten Gewicht (Wächter Etappe A, B1). */
  readonly targetReps: number | null;
  readonly targetExtraSet: boolean | null;
  readonly targetRpe: number | null;
  /** Zustand VOR dieser Einheit (`state_*`); null = ohne Zustand (erster Eintrag, nach Widerruf neutralisiert). */
  readonly state: ExerciseProgress | null;
  /** Plausibilitäts-Warnung beim Gewicht ausdrücklich bestätigt (W5). */
  readonly weightConfirmed: boolean;
  readonly sets: readonly LoggedSet[];
}

/** Alles, was die Progression über die HEUTIGE Vorgabe der Übung wissen muss (aus dem aktuellen Plan). */
export interface ProgressionContext {
  readonly loadType: LoadType;
  readonly repsMin: number | null;
  readonly repsMax: number | null;
  /** Halteübung: geplante Dauer (Startwert ohne Verlauf). */
  readonly durationS: number | null;
  /** Sätze der längsten Fassung im Plan (Vorlagen-Satzzahl, W7). */
  readonly templateSets: number;
  /** RPE-Ziel einer Belastungswoche laut Plan (ohne Einstiegs-/Erholungsabschlag). */
  readonly rpeTarget: number;
  readonly incrementKind: IncrementKind;
  /** Eigene Gewichtsstufen am Ort (Kurzhanteln/Kettlebells, Langhantel: barbellLoadSteps()). */
  readonly steps?: readonly number[];
  /** false, wenn ein Zusatzsatz die Wochensatz-Obergrenze (V9) überschreiten würde. */
  readonly allowExtraSet?: boolean;
}
