/**
 * Texte der Tagesauswertung „Dein Tag“ (Etappe A2, docs/PLAN-AUSWERTUNG.md 2.1–2.5, Abschnitt 6). Ruhig und
 * essstörungssensibel (2.4): keine Schuld- oder Leistungswörter („geschafft“, „versagt“, „zu viel gegessen“,
 * „verdient“, „Cheat“), kein Ausrufezeichen, kein Warnsymbol, keine „verbrannten Kalorien“, nie „Training = mehr essen
 * dürfen“. Farbe nie allein – immer Text und Zeichen. Bei „Kalorienzahlen aus“ keine kcal. Wird in `de.ts` unter `day`
 * eingebunden.
 */
export const deDay = {
  title: 'Dein Tag',
  open: 'Dein Tag',
  openA11y: (day: string) => `Dein Tag: ${day} ansehen`,
  openToday: 'Dein Tag – Essen und Training',
  previous: '← Vortag',
  previousA11y: 'Vorheriger Tag',
  next: 'Folgetag →',
  nextA11y: 'Nächster Tag',
  today: 'Heute',
  back: 'Zurück',
  invalidDate: 'Diesen Tag gibt es nicht. Wähle einen Tag im Kalender oder in der Woche.',
  toCalendar: 'Zum Kalender',
  tooOld:
    'Auf diesem Gerät sind nur die letzten 12 Wochen gespeichert. Ältere Einheiten findest du im Verlauf.',
  openHistory: 'Zum Verlauf',
  future: 'Vorschau – so ist dieser Tag geplant.',
  // Essen
  foodTitle: 'Essen',
  intakeLine: (eaten: string, target: string) => `${eaten} von ${target} kcal`,
  targetLine: (target: string) => `Tagesziel: ${target} kcal`,
  barA11y: (eaten: string, target: string, zone: string) =>
    `${eaten} von ${target} Kilokalorien, ${zone}`,
  zones: {
    below_floor: 'Unter deinem Mindestbedarf',
    below_target: 'Etwas unter deinem Tagesziel',
    in_range: 'Im Zielbereich',
    above_target: 'Etwas über deinem Ziel',
    well_above: 'Deutlich über deinem Ziel',
    open: 'Noch offen',
  },
  /** Zeichen zur Farbe (Rot-Grün-Schwäche, DESIGN.md) – keine Warnsymbole. */
  zoneSymbols: {
    below_floor: '↓',
    below_target: '↘',
    in_range: '✓',
    above_target: '↗',
    well_above: '↑',
    open: '○',
  },
  zoneDetails: {
    below_floor:
      'Dein Körper braucht an solchen Tagen mehr – z. B. eine Portion Obst, Nüsse oder Joghurt.',
    below_target: '',
    in_range: '',
    above_target: '',
    well_above: 'Ein einzelner Tag ändert wenig.',
    open: 'Der Tag läuft noch.',
  },
  checkEntries: 'Laut deinen Einträgen. Fehlt etwas? Du kannst es nachtragen.',
  /** Außerhalb des Nachtrage-Fensters (14 Tage) – kein Versprechen „nachtragen“ (Wächter A2 H3). */
  entriesBasis: 'Laut deinen Einträgen.',
  trainingDay: 'Trainingstag – dein Ziel ist an diesem Tag höher.',
  noEntries: 'Nichts eingetragen.',
  noValues: 'Deine Einträge haben keine Kalorienangabe – dafür gibt es keinen Balken.',
  noTarget: 'Ohne Tagesziel gibt es keinen Kalorienbalken.',
  estimate: 'Laut deinen Einträgen – Schätzwerte, nach deinen aktuellen Angaben.',
  entries: (count: string) => `Eingetragen: ${count}`,
  meals: (eaten: number, planned: number) => `Mahlzeiten: ${eaten} von ${planned} abgehakt`,
  noMealPlan: 'Für diesen Tag gibt es keinen Essensplan. Eintragen geht trotzdem.',
  noStoredMealPlan:
    'Für diesen Tag ist kein Essensplan gespeichert – deshalb gibt es hier keine Mahlzeiten zum Abhaken. Eintragen geht trotzdem.',
  plannedMeals: 'Geplante Mahlzeiten:',
  computeFailed:
    'Dein Tag lässt sich gerade nicht auswerten. Bitte versuche es später noch einmal.',
  openNutrition: 'Mahlzeiten und Einträge',
  openNutritionA11y: (day: string) => `Mahlzeiten und Einträge für ${day} öffnen`,
  // Training
  trainingTitle: 'Training',
  noPlan: 'Du hast noch keinen Trainingsplan. Freie Einheiten kannst du im Kalender eintragen.',
  rest: 'Keine Einheit an diesem Tag.',
  levels: {
    reached: 'Ziel erreicht',
    mostly: 'Größtenteils gemacht',
    partly: 'Teilweise gemacht',
    none: 'Eingetragen',
    done: 'Gemacht',
    logged: 'Eingetragen',
  },
  /** Nur „erreicht“ trägt ✓ – „gemacht“ ohne Vorgabe und „eingetragen“ ohne Dauer neutral (Wächter A2 H4). */
  levelSymbols: { reached: '✓', mostly: '◕', partly: '◐', none: '○', done: '•', logged: '•' },
  easyWeek: {
    recovery: 'Erholungswoche – leichter ist hier richtig.',
    intro: 'Einstiegswoche – leichter ist hier richtig.',
  },
  percent: (value: number) => `${value} %`,
  achievementA11y: (name: string, level: string, percent: string | null) =>
    percent === null ? `${name}: ${level}` : `${name}: ${level}, ${percent}`,
  sets: (fulfilled: number, target: number) => `${fulfilled}/${target} Sätze`,
  setsDone: (n: number) => (n === 1 ? '1 Satz' : `${n} Sätze`),
  skipped: 'nicht gemacht',
  minutes: (minutes: number, planned: number | null) =>
    planned === null ? `${minutes} min` : `${minutes} von ${planned} min`,
  hints: {
    effort_above_plan: 'Etwas lockerer als geplant hilft der Erholung.',
    longer_than_planned:
      'Länger als geplant – dein Plan steigert trotzdem nur in kleinen Schritten.',
  },
  free: 'freie Einheit',
  backfilled: 'nachgetragen',
  openLog: 'Eintrag ansehen',
  openLogA11y: (name: string) => `${name}: Eintrag ansehen`,
  loadingTraining: 'Training wird geladen …',
} as const;
