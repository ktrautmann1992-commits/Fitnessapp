/**
 * Texte der App für die „Erholung aus der Uhr“ (Gründer-Freigabe 25.10.2026, docs/PLAN-PHASE-8.md 15): Kachel auf der
 * Übersicht, Karte auf „Heute“, Abschnitt auf der Smartwatch-Seite. Die fachlichen Sätze (Status, Gründe, Erklärung,
 * Angebot) kommen aus packages/core (RECOVERY_TEXTS_DE …). Neutral, ohne Diagnose, ohne Druck.
 */

const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

export const deRecovery = {
  tile: {
    title: 'Erholung',
    loading: 'Erholung wird geladen …',
    noWatch:
      'Verbinde deine Smartwatch, dann siehst du hier jeden Morgen deine Erholung aus Schlaf, Ruhepuls und HRV.',
    noConsent: 'Für die Erholung brauchst du die Einwilligung „Smartwatch-Daten“.',
    onlyAndroid: 'Die Erholung gibt es mit der Android-App und einer Smartwatch.',
    connect: 'Uhr verbinden',
    noData:
      'Noch keine Werte für Schlaf, Ruhepuls oder HRV. Prüfe in Samsung Health, ob diese Daten an Health Connect gehen.',
    today: 'Heute',
    open: 'Erholung und Werte ansehen',
    /** Kurzform des Tages im Mini-Verlauf (1 = Montag). */
    weekdayShort: (isoWeekday: number) => WEEKDAYS_SHORT[isoWeekday - 1] ?? '',
    trendA11y: (days: readonly { weekday: number; label: string }[]) =>
      `Erholung der letzten 7 Tage: ${days
        .map(
          (d, i) =>
            `${i === days.length - 1 ? 'heute' : (WEEKDAYS[d.weekday - 1] ?? '')} ${d.label}`,
        )
        .join(', ')}`,
  },
  details: {
    title: 'Erholung',
    intro: 'Aus Schlaf, Ruhepuls und HRV deiner Uhr – nur mit deinen eigenen Werten verglichen.',
    statusLine: (label: string) => `Heute: ${label}`,
    valuesTitle: 'Deine Werte heute',
  },
  today: {
    /** Karte auf „Heute“, wenn die Erholung niedrig ist, aber kein Angebot erlaubt ist (ohne Live-Anpassung). */
    infoTitle: 'Erholung heute: niedrig',
    infoHint: 'Trainiere nach Gefühl – du kannst Sätze oder Tempo jederzeit selbst zurücknehmen.',
    lighterBadge: 'Leichter',
    chosenLighterA11y: 'Heute trainierst du die leichtere Variante.',
  },
} as const;
