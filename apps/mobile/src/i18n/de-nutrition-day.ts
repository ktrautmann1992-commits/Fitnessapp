/**
 * Texte der Tagesübersicht Ernährung (Kalorien-Ring, Makro-Balken, Mahlzeiten-Karten; Gründer-Wunsch 20.10.2026).
 * Neutral formuliert: „zu viel“ ist nur eine Zahl, keine Bewertung (docs/PLAN-AUSWERTUNG.md 2.4). Wird in `de.ts` unter
 * `nutritionDay` eingebunden.
 */
export const deNutritionDay = {
  today: 'Heute',
  /** „Montag, 12.10. · KW 42“ */
  dateLine: (day: string, week: number) => `${day} · KW ${week}`,
  /** Anderer Tag: der Wochentag steht schon in der Überschrift. */
  weekLine: (week: number) => `KW ${week}`,
  overviewTitle: 'Übersicht',
  eaten: 'Gegessen',
  burned: 'Verbrannt',
  burnedNote: 'im Ziel enthalten',
  goal: 'Ziel',
  left: 'übrig',
  over: 'zu viel',
  dayGoal: 'Tagesziel',
  nothingYet: 'Noch nichts eingetragen.',
  macrosIncomplete: 'Ohne Makros der Schnelleinträge ohne Nährwerte.',
  ringA11y: {
    open: (left: string, target: string, eaten: string) =>
      `${left} kcal übrig von ${target} kcal Tagesziel. Gegessen: ${eaten} kcal.`,
    reached: (target: string) => `Tagesziel von ${target} kcal erreicht.`,
    over: (over: string, target: string, eaten: string) =>
      `${over} kcal mehr als dein Tagesziel von ${target} kcal. Gegessen: ${eaten} kcal.`,
    future: (target: string) => `Tagesziel: ${target} kcal. Noch nichts eingetragen.`,
  },
  burnedA11y: (kcal: string) =>
    `Verbrannt durch Training: etwa ${kcal} kcal, schon im Tagesziel eingerechnet.`,
  /** „47 / 222 g“ */
  macroValue: (eaten: string, target: string) => `${eaten} / ${target} g`,
  macroA11y: (label: string, eaten: string, target: string) =>
    `${label}: ${eaten} von ${target} Gramm gegessen`,
  mealsTitle: 'Ernährung',
  cards: {
    breakfast: 'Frühstück',
    lunch: 'Mittagessen',
    /** Bei nur einer Mahlzeit am Tag (Platz „Hauptmahlzeit“). */
    main: 'Hauptmahlzeit',
    dinner: 'Abendessen',
    snacks: 'Snacks',
  },
  /** „317 / 606 kcal“ */
  cardKcal: (eaten: string, target: string) => `${eaten} / ${target} kcal`,
  cardKcalOnly: (eaten: string) => `${eaten} kcal`,
  cardA11y: (title: string, eaten: string, target: string) =>
    `${title}: ${eaten} von ${target} kcal gegessen`,
  cardA11yNoTarget: (title: string, eaten: string) => `${title}: ${eaten} kcal gegessen`,
  cardEmpty: 'Noch nichts eingetragen',
  addA11y: (title: string, day: string) => `${title} für ${day} eintragen`,
  addA11yToday: 'heute',
  offline:
    'Du bist offline. Eintragen geht trotzdem – alles bleibt auf dem Handy gespeichert. Barcode-Abfrage und Foto brauchen Internet.',
} as const;
