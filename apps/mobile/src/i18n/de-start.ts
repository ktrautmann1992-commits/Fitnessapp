/**
 * „Training starten“ (Gründer-Wunsch 06.11.2026): „+“ auf „Heute“, Start-Blatt, Kraft-Start mit Übungswahl und
 * Start-Knöpfe auf dem Tag „heute“. Ein Tipp bis zum Start einer geplanten Einheit.
 */
export const deStartTraining = {
  /** Knopf „+“ oben rechts auf „Heute“. */
  plus: 'Training starten',
  plusA11y: 'Training starten – geplant, frei, mit GPS oder nachtragen',
  sheetTitle: 'Training starten',
  close: 'Schließen',
  planned: (name: string) => `Geplantes Training starten: ${name}`,
  plannedResume: (name: string) => `Training fortsetzen: ${name}`,
  plannedHint: 'Aus deinem Plan für heute',
  freeStrength: 'Krafttraining (z. B. Fitnessstudio)',
  freeStrengthHint: 'Freie Einheit – Übungen wählst du selbst',
  gps: 'Lauf / Rad mit GPS',
  gpsHint: 'Strecke live aufzeichnen',
  otherSport: 'Andere Sportart',
  otherSportHint: 'z. B. Padel, Fußball, Klettern, Schwimmen',
  backfill: 'Einheit nachtragen',
  backfillHint: 'Schon trainiert? Hier eintragen',
  /** Tag „heute“ (Tages-Ansicht). */
  dayStart: (name: string) => `Training starten: ${name}`,
  dayResume: (name: string) => `Training fortsetzen: ${name}`,
  dayFree: '+ Freies Training starten',
  dayBackfill: 'Einheit nachtragen',
  dayBackfillA11y: (day: string) => `Einheit für ${day} nachtragen`,
  /** Bildschirm „Krafttraining starten“ (freie Einheit, heute). */
  strengthTitle: 'Krafttraining starten',
  strengthIntro:
    'Wähle deine Übungen – Sätze, Wiederholungen und Gewicht trägst du im Training ein. Freie Einheiten zählen in Woche und Verlauf, ändern aber nie die Vorgaben deines Plans.',
  strengthStart: (count: number) =>
    count === 0
      ? 'Training starten'
      : count === 1
        ? 'Training starten (1 Übung)'
        : `Training starten (${count} Übungen)`,
  back: 'Zurück',
  blockedTitle: 'Heute kein weiteres Training möglich',
} as const;
