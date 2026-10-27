import { ENDURANCE_MODALITY_ROW, MULTISPORT_TEXTS_DE } from '@fitnessapp/core';

/**
 * Indoor-Rudern (Sportarten Stufe 1 · Etappe R, docs/PLAN-SPORTARTEN-STUFE-1.md 2.3): Split je 500 m, Watt (nur
 * Anzeige), Schlagzahl, Intervall-Ergebnis, Technik-Hinweis. Fachtexte aus packages/core (MULTISPORT_TEXTS_DE.row).
 */
const R = ENDURANCE_MODALITY_ROW;

export const deRowing = {
  techniqueTitle: 'Technik am Rudergerät',
  gymOption: 'Im Studio auch rudern (Rudergerät)',
  gymSettingsText:
    'Ein- oder ausschalten im Schritt „Trainingstage“ (Standard aus). Danach „Plan neu erstellen“.',
  gymOptionHint:
    'Dann wird jede zweite Ausdauer-Einheit „Lockeres Rudern“ – gilt ab dem nächsten Plan („Plan neu erstellen“).',
  technique: MULTISPORT_TEXTS_DE.row.technique,
  split: (split: string) => `Split ${split} /500 m`,
  splitA11y: (minutes: number, seconds: number) =>
    `Split: ${minutes} Minuten ${seconds} Sekunden je 500 Meter`,
  watts: (watts: number) => `≈ ${watts} Watt (aus dem Split berechnet)`,
  wattsA11y: (watts: number) => `ungefähr ${watts} Watt, aus dem Split berechnet`,
  powerLabel: 'Ø Watt (optional)',
  powerHint: 'Vom Display des Rudergeräts.',
  strokeRateLabel: 'Ø Schlagzahl je Minute (optional)',
  strokeRateHint: `Locker: ${R.easyStrokeRate.min}–${R.easyStrokeRate.max} Schläge pro Minute.`,
  powerValue: (watts: number) => `Ø ${watts} Watt`,
  strokeRateValue: (rate: number) => `Ø Schlagzahl ${rate} /min`,
  intervals: {
    title: 'Intervall-Ergebnis (optional)',
    resultTitle: 'Intervall-Ergebnis',
    intro: 'Je Wiederholung Distanz und Zeit – den Split rechnen wir aus.',
    distance: (no: number) => `Wdh. ${no}: Distanz in m`,
    time: (no: number) => `Wdh. ${no}: Zeit (m:ss)`,
    add: 'Wiederholung hinzufügen',
    remove: (no: number) => `Wiederholung ${no} entfernen`,
    max: `Höchstens ${R.intervalsMax} Wiederholungen.`,
    row: (no: number, distance: string, time: string, split: string | null) =>
      `${no}. ${distance} m in ${time}${split ? ` · ${split} /500 m` : ''}`,
    best: 'schnellste',
    average: (split: string) => `Ø Split ${split} /500 m`,
    total: (distance: string, time: string) => `Gesamt ${distance} m in ${time}`,
  },
  errors: {
    power_invalid: 'Watt: bitte eine ganze Zahl von 1 bis 1000.',
    stroke_rate_invalid: `Schlagzahl: bitte eine ganze Zahl von ${R.strokeRate.min} bis ${R.strokeRate.max}.`,
    intervals_invalid:
      'Intervalle: je Zeile Distanz (1–10.000 m) und Zeit (m:ss, höchstens 60 min) – oder die Zeile leer lassen.',
    intervals_too_many: `Höchstens ${R.intervalsMax} Wiederholungen.`,
  },
  checks: {
    split_too_fast:
      'Bitte prüfen: Der Split ist schneller als 1:10 /500 m. Stimmen Distanz und Zeit?',
    split_too_slow:
      'Bitte prüfen: Der Split ist langsamer als 4:00 /500 m. Stimmen Distanz und Zeit?',
    stroke_rate_range: `Bitte prüfen: Die Schlagzahl liegt meist zwischen ${R.strokeRate.min} und ${R.strokeRate.max}.`,
    power_range: 'Bitte prüfen: Watt zwischen 1 und 1000.',
    too_many_intervals: `Höchstens ${R.intervalsMax} Wiederholungen.`,
  },
} as const;
