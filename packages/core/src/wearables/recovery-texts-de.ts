import { RECOVERY } from '../constants';
import type { RecoveryResult, RecoverySignal, RecoveryStatus } from './recovery';

/**
 * Feste deutsche Texte der „Erholung aus der Uhr“ (25.10.2026). Neutral, ohne Diagnose, ohne Bewertung der
 * Gesundheit, ohne Wörter aus FORBIDDEN_MEDICAL_TERMS (Test). Nur Zahlen aus den eigenen Tageswerten.
 */

export const RECOVERY_STATUS_LABEL_DE: Readonly<Record<RecoveryStatus, string>> = {
  good: 'gut',
  medium: 'mittel',
  low: 'niedrig',
  unknown: 'noch offen',
};

export const RECOVERY_SUMMARY_DE: Readonly<Record<RecoveryStatus, string>> = {
  good: 'Deine Werte liegen in deinem üblichen Bereich.',
  medium: 'Ein Wert weicht von deinem Üblichen ab – trainiere nach Gefühl.',
  low: 'Deine Werte sprechen für einen leichteren Tag.',
  unknown: 'Noch keine Einschätzung für heute.',
};

export const RECOVERY_TEXTS_DE = {
  title: 'Erholung',
  learning: `Wir lernen deine Werte noch: Ruhepuls und HRV vergleichen wir ab ${RECOVERY.baselineMinValues} Tagen mit Werten deiner Uhr.`,
  medication:
    'Wegen deiner Angabe zu Medikamenten zählen Ruhepuls und HRV hier nicht – nur der Schlaf.',
  disclaimer:
    'Die Erholung ist eine Trainingshilfe aus den Werten deiner Uhr, keine Bewertung deiner Gesundheit. Fühlst du dich länger nicht wohl, sprich mit deiner Ärztin oder deinem Arzt.',
  howTitle: 'So entsteht die Erholung',
  how: [
    `Schlaf der letzten Nacht: auffällig unter ${RECOVERY.sleepShortMin.adult / 60} Stunden (unter ${RECOVERY.adultFromAge} Jahren unter ${RECOVERY.sleepShortMin.under18 / 60} Stunden).`,
    `Ruhepuls: auffällig ab ${RECOVERY.restingHrAboveBpm} Schlägen pro Minute über deinem Üblichen (mittlerer Wert deiner letzten ${RECOVERY.baselineDays} Tage).`,
    `HRV: auffällig ab ${Math.round((1 - RECOVERY.hrvBelowShare) * 100)} % unter deinem Üblichen (letzte ${RECOVERY.baselineDays} Tage).`,
    'Kein auffälliger Wert: gut · ein Wert: mittel · zwei oder mehr: niedrig.',
  ],
  offerTitle: 'Heute leichter trainieren?',
  offerBody:
    'Deine Werte sprechen für einen leichteren Tag. Du entscheidest – beides ist in Ordnung.',
  offerLighter: 'Leichter trainieren',
  offerAsPlanned: 'Wie geplant',
  chosenLighterStrength:
    'Heute leichter: je Übung ein Satz weniger, etwas weniger Anstrengung, gleiche Gewichte.',
  chosenLighterEndurance: (minutes: number, planned: number) =>
    `Heute leichter: locker und etwas kürzer – etwa ${minutes} statt ${planned} Minuten.`,
  chosenUndo: 'Doch wie geplant',
  chosenAsPlanned: 'Du trainierst heute wie geplant.',
  chosenAsPlannedUndo: 'Doch leichter',
} as const;

/** Schlafdauer „6 Std. 45 Min.“ bzw. „7 Std.“ (endet mit Punkt – kein weiterer Satzpunkt dahinter). */
export function sleepDurationDe(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  return m === 0 ? `${h} Std.` : `${h} Std. ${m} Min.`;
}

/** Ein Satz je Wert (für die Erklärung) – auffällige zuerst gelesen wie die Ampel. */
export function recoverySignalDe(signal: RecoverySignal): string {
  const v = signal.value;
  switch (signal.kind) {
    case 'sleep':
      if (signal.state === 'no_data' || v === null) return 'Schlaf: kein Wert für letzte Nacht.';
      return signal.state === 'flag'
        ? `Schlaf: ${sleepDurationDe(v)} – kürzer als ${sleepDurationDe(signal.baseline ?? 0)}`
        : `Schlaf: ${sleepDurationDe(v)}`;
    case 'resting_hr': {
      if (signal.state === 'ignored') return 'Ruhepuls: zählt hier nicht.';
      if (signal.state === 'no_data' || v === null) return 'Ruhepuls: heute kein Wert.';
      if (signal.state === 'no_baseline' || signal.baseline === null) {
        return `Ruhepuls: ${Math.round(v)} /min (noch kein Vergleich).`;
      }
      const diff = Math.round(v - signal.baseline);
      const rel =
        diff === 0
          ? 'wie üblich'
          : diff > 0
            ? `${diff} über deinem Üblichen`
            : `${-diff} unter deinem Üblichen`;
      return `Ruhepuls: ${Math.round(v)} /min (${rel}).`;
    }
    case 'hrv': {
      if (signal.state === 'ignored') return 'HRV: zählt hier nicht.';
      if (signal.state === 'no_data' || v === null) return 'HRV: heute kein Wert.';
      if (signal.state === 'no_baseline' || signal.baseline === null) {
        return `HRV: ${Math.round(v)} ms (noch kein Vergleich).`;
      }
      const pct = Math.round((v / signal.baseline - 1) * 100);
      const rel =
        pct === 0
          ? 'wie üblich'
          : pct > 0
            ? `${pct} % über deinem Üblichen`
            : `${-pct} % unter deinem Üblichen`;
      return `HRV: ${Math.round(v)} ms (${rel}).`;
    }
  }
}

/** Kurze Gründe der auffälligen Werte („Schlaf kurz“, „Ruhepuls erhöht“, „HRV niedriger“) für Kachel und Ansage. */
export function recoveryReasonsDe(result: RecoveryResult): string[] {
  return result.signals
    .filter((s) => s.state === 'flag')
    .map((s) =>
      s.kind === 'sleep'
        ? 'Schlaf kurz'
        : s.kind === 'resting_hr'
          ? 'Ruhepuls erhöht'
          : 'HRV niedriger',
    );
}

/** Ansage für Bildschirmleser: „Erholung heute: niedrig. Schlaf kurz, Ruhepuls erhöht.“ */
export function recoveryA11yDe(result: RecoveryResult): string {
  const reasons = recoveryReasonsDe(result);
  return `Erholung heute: ${RECOVERY_STATUS_LABEL_DE[result.status]}.${reasons.length > 0 ? ` ${reasons.join(', ')}.` : ''}`;
}
