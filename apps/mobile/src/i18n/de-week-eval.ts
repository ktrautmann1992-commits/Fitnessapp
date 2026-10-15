/**
 * Texte der Wochenauswertung (Etappe A3, docs/PLAN-AUSWERTUNG.md 2.1–2.5, Abschnitt 8). Ruhig und
 * essstörungssensibel (2.4): keine Schuld- oder Leistungswörter („geschafft“, „versagt“, „perfekte Woche“, „verdient“,
 * „zu viel gegessen“), keine Wochen-Bilanz in kcal, keine Prognose, kein Ausrufezeichen, kein Warnsymbol. Farbe nie
 * allein – immer Zeichen und Kurztext. Bei „Kalorienzahlen aus“ keine kcal. Wird in `de.ts` unter `weekEval`
 * eingebunden.
 */
export const deWeekEval = {
  title: 'Wochenauswertung',
  open: 'Wochenauswertung',
  openA11y: (range: string) => `Wochenauswertung für ${range} öffnen`,
  current: 'Diese Woche',
  back: 'Zurück',
  invalidWeek: 'Diese Woche gibt es nicht. Wähle eine Woche in „Woche“ oder im Kalender.',
  toWeek: 'Zur Woche',
  notStarted: 'Diese Woche hat noch nicht begonnen. Hier siehst du, was geplant ist.',
  tooOld:
    'Diese Woche ist zu alt für den Gerätespeicher: Auf diesem Gerät sind nur die letzten 12 Wochen gespeichert. Ältere Einheiten findest du im Verlauf.',
  openHistory: 'Zum Verlauf',
  olderHint: 'Ältere Wochen findest du im Verlauf.',
  computeFailed:
    'Diese Woche lässt sich gerade nicht auswerten. Bitte versuche es später noch einmal.',
  // Essen
  foodTitle: 'Essen',
  dayA11y: (day: string, text: string) => `${day}: ${text}. Dein Tag öffnen`,
  /** Kurztexte je Tag (Zeichen + Wort, Farbe nie allein). */
  dayShort: {
    below_floor: '↓ Unter Mindestbedarf',
    below_target: '↘ Etwas darunter',
    in_range: '✓ Im Zielbereich',
    above_target: '↗ Etwas darüber',
    well_above: '↑ Deutlich darüber',
    open: '○ Noch offen',
    no_entries: '– Nichts eingetragen',
    no_values: '– Ohne Kalorienangabe',
    no_target: '– Kein Tagesziel',
    future: 'Geplant',
    hidden_entries: '• Eingetragen',
    hidden_none: '– Nichts eingetragen',
    unavailable: '–',
  },
  /** Bedienhilfe, wenn der Kurztext nur ein Zeichen ist (Wächter A3 H2). */
  dayUnavailableA11y: 'Ernährungstagebuch hier nicht verfügbar',
  todayA11y: 'heute',
  dayShortMeals: (eaten: number, planned: number) => `${eaten} von ${planned} Mahlzeiten`,
  entryDays: (n: number) =>
    n === 0
      ? 'An keinem vergangenen Tag eingetragen.'
      : n === 1
        ? 'An 1 Tag eingetragen.'
        : `An ${n} Tagen eingetragen.`,
  /** „Davon 3 im Zielbereich, 1 etwas darunter, 1 etwas darüber.“ */
  zoneCount: {
    below_floor: (n: number) => `${n} unter deinem Mindestbedarf`,
    below_target: (n: number) => `${n} etwas darunter`,
    in_range: (n: number) => `${n} im Zielbereich`,
    above_target: (n: number) => `${n} etwas darüber`,
    well_above: (n: number) => `${n} deutlich darüber`,
    without_value: (n: number) => `${n} ohne Kalorienangabe`,
    no_target: (n: number) => `${n} ohne Tagesziel`,
  },
  zoneSummary: (parts: readonly string[]) => `Davon ${parts.join(', ')}.`,
  average: (eaten: string, target: string) =>
    `Ø ${eaten} von Ø ${target} kcal je eingetragenem Tag`,
  averageA11y: (eaten: string, target: string) =>
    `Durchschnittlich ${eaten} von durchschnittlich ${target} Kilokalorien je eingetragenem Tag`,
  averageNote:
    'Tage ohne Eintrag zählen nicht mit. Laut deinen Einträgen – Schätzwerte, nach deinen aktuellen Angaben.',
  todayOpen: 'Heute läuft noch und zählt erst danach mit.',
  meals: (eaten: number, planned: number) => `Mahlzeiten: ${eaten} von ${planned} abgehakt`,
  noTarget: 'Ohne Tagesziel gibt es keine Farben für die Tage.',
  /** Wächter A3 G2: der Essensplan selbst lag unter dem Mindestbedarf (Text wie „Dein Tag“, für die Woche). */
  planBelowFloor: (n: number) =>
    n === 1
      ? 'An 1 Tag erreichte schon dein Essensplan deinen Mindestbedarf nicht – ergänze dort z. B. eine Portion Obst, Nüsse oder Joghurt.'
      : `An ${n} Tagen erreichte schon dein Essensplan deinen Mindestbedarf nicht – ergänze dort z. B. eine Portion Obst, Nüsse oder Joghurt.`,
  performedOn: (day: string) => `gemacht am ${day}`,
  /** Muster-Hinweis (2.4, A-G13) – Einleitung, danach der feste Hinweis mit Hilfe-Stellen (PLAN-PHASE-5 4.9). */
  patternLead:
    'Laut deinen Einträgen lagen in dieser Woche mehrere Tage unter deinem Mindestbedarf. Dein Körper braucht an solchen Tagen mehr.',
  // Training
  trainingTitle: 'Training',
  noPlan: 'Du hast noch keinen Trainingsplan. Freie Einheiten kannst du im Kalender eintragen.',
  noSessions: 'In dieser Woche ist kein Training geplant und nichts eingetragen.',
  sessions: (done: number, planned: number) => `Einheiten: ${done} von ${planned} erledigt`,
  /** Ohne geplante Einheiten nie „x von 0“ (Wächter A3 H5). */
  sessionsOnly: (done: number) => `Einheiten: ${done} erledigt`,
  sets: (fulfilled: number, planned: number) => `Kraft-Sätze: ${fulfilled} von ${planned} erfüllt`,
  setsA11y: (fulfilled: number, planned: number) =>
    `Kraft-Sätze: ${fulfilled} von ${planned} erfüllt`,
  minutes: (done: number, planned: number) => `Ausdauer: ${done} von ${planned} min`,
  minutesA11y: (done: number, planned: number) => `Ausdauer: ${done} von ${planned} Minuten`,
  minutesOnly: (done: number) => `Ausdauer: ${done} min`,
  minutesOnlyA11y: (done: number) => `Ausdauer: ${done} Minuten`,
  km: (km: string) => `Strecke: ${km} km`,
  kmA11y: (km: string) => `Strecke: ${km} Kilometer`,
  setsNote: 'Ein Satz gilt als erfüllt, wenn Wiederholungen und Gewicht die Vorgabe erreichen.',
  freeTitle: 'Freie Einheiten',
  freeSummary: (n: number) => (n === 1 ? '1 freie Einheit' : `${n} freie Einheiten`),
  freeSets: (n: number) => (n === 1 ? '1 Satz' : `${n} Sätze`),
  freeMinutes: (n: number) => `${n} min`,
  freeNote: 'Freie Einheiten zählen nicht zu den Plan-Summen.',
  itemDay: (day: string) => day,
} as const;
