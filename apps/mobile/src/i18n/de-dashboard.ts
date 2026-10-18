/**
 * Texte für Menüleiste, Übersicht, Fortschritt, Mehr und Mein Konto (docs/PLAN-DASHBOARD.md, Gründer-Wünsche vom
 * 18.10.2026).
 */

const kg = (value: number) =>
  `${value.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} kg`;

export const deTabs = {
  label: 'Hauptmenü',
  overview: 'Übersicht',
  training: 'Training',
  nutrition: 'Ernährung',
  progress: 'Fortschritt',
  more: 'Mehr',
} as const;

export const deDashboard = {
  title: 'Übersicht',
  greeting: {
    morning: 'Guten Morgen!',
    day: 'Hallo!',
    evening: 'Guten Abend!',
  },
  attention: {
    title: 'Im Training wartet etwas auf dich',
    text: 'Zum Beispiel ein angefangenes Training, eine Rückfrage zu deinem Plan oder ein Hinweis.',
    open: 'Zum Training',
  },
  training: {
    title: 'Training heute',
    noPlan: 'Du hast noch keinen Trainingsplan.',
    createPlan: 'Plan erstellen',
    done: (name: string) => `Erledigt: ${name}. Stark!`,
    today: (name: string) => `Heute: ${name}`,
    start: 'Training starten',
    continue: 'Training fortsetzen',
    open: 'Zum Training',
    rest: 'Heute ist Ruhetag.',
    next: (day: string, name: string) => `Nächste Einheit: ${day} – ${name}`,
    noUpcoming: 'Keine weitere Einheit im Plan.',
    loading: 'Plan wird geladen …',
  },
  nutrition: {
    title: 'Ernährung heute',
    setupNeeded: 'Richte deine Ernährung ein, dann siehst du hier deine Mahlzeiten.',
    setup: 'Ernährung einrichten',
    next: (slot: string, title: string) => `Als Nächstes: ${slot} – ${title}`,
    allDone: 'Alle Mahlzeiten für heute sind durch.',
    noPlan: 'Für heute ist noch kein Essensplan da.',
    entries: (count: number) =>
      count === 0
        ? 'Heute noch nichts eingetragen.'
        : count === 1
          ? '1 Eintrag heute.'
          : `${count} Einträge heute.`,
    target: (kcal: string) => `Tagesziel: ${kcal} kcal`,
    open: 'Zur Ernährung',
    log: 'Essen eintragen',
    loading: 'Ernährung wird geladen …',
    failed: 'Die Ernährung konnte gerade nicht geladen werden.',
    blocked: 'Für deinen Essensplan fehlt gerade etwas – mehr dazu unter „Ernährung“.',
  },
  body: {
    title: 'Körperdaten',
    weight: (value: number, date: string) => `Zuletzt eingetragen: ${kg(value)} (${date})`,
    weightA11y: (value: number, date: string) =>
      `Zuletzt eingetragenes Gewicht: ${kg(value).replace('kg', 'Kilogramm')}, am ${date}`,
    none: 'Noch kein Gewicht eingetragen.',
    enter: 'Gewicht eintragen',
    noConsent:
      'Körperdaten zeigen wir nur mit deiner Einwilligung in die Verarbeitung von Gesundheitsdaten.',
    outdated:
      'Die Einwilligung hat eine neue Fassung. Bitte bestätige sie, um Körperdaten zu sehen.',
    grant: 'Einwilligung ansehen',
  },
  progress: {
    title: 'Fortschritt',
    week: (completed: number, planned: number) =>
      planned === 0
        ? 'Diese Woche ist kein Training geplant.'
        : `Diese Woche: ${completed} von ${planned} ${planned === 1 ? 'Einheit' : 'Einheiten'} erledigt`,
    open: 'Zum Fortschritt',
    noPlan: 'Sobald du einen Plan hast, siehst du hier deine Woche.',
  },
  shortcuts: {
    title: 'Schnell zu',
    recipes: 'Rezepte',
    exercises: 'Übungen',
    shopping: 'Einkaufsliste',
    calendar: 'Kalender',
  },
} as const;

export const deProgressHub = {
  title: 'Fortschritt',
  intro: 'Deine Woche, dein Verlauf und deine Auswertungen – alles bleibt privat auf deinem Konto.',
  weekTitle: 'Diese Woche',
  open: (count: number) =>
    count === 0
      ? 'Keine offene Einheit mehr in dieser Woche.'
      : count === 1
        ? 'Noch 1 Einheit offen.'
        : `Noch ${count} Einheiten offen.`,
  weekEvaluation: 'Wochenauswertung (Essen und Training)',
  trainingWeek: 'Trainingswoche',
  history: 'Verlauf',
  calendar: 'Kalender',
  day: 'Dein Tag heute',
} as const;

export const deMore = {
  title: 'Mehr',
  account: 'Mein Konto',
  accountHint: 'E-Mail, Abmelden, Einwilligungen, Daten exportieren, Konto löschen',
  settings: 'Einstellungen',
  recipes: 'Rezepte',
  exercises: 'Übungen',
  guides: 'Ratgeber',
  shopping: 'Einkaufsliste',
  mealPrep: 'Meal-Prep',
  competition: 'Wettkampf',
  licenses: 'Lizenzen und Quellen',
  sections: {
    personal: 'Persönlich',
    content: 'Inhalte',
    info: 'Info',
  },
} as const;

export const deKonto = {
  title: 'Mein Konto',
  signedInAs: 'Angemeldet als',
  noEmail: 'Angemeldet (ohne E-Mail-Adresse)',
  testMode: 'Testmodus – kein Konto. Deine Daten bleiben nur auf diesem Gerät.',
  signOut: 'Abmelden',
  signOutTitle: 'Wirklich abmelden?',
  signOutText:
    'Beim Abmelden löschen wir deine Daten von diesem Gerät. Mit deiner E-Mail-Adresse und einem neuen Code meldest du dich jederzeit wieder an.',
  signOutTestText:
    'Im Testmodus gibt es kein Konto. Deine Testdaten bleiben auf diesem Gerät – mit „Testmodus starten“ geht es später weiter. Ganz löschen kannst du sie in den Einstellungen.',
  signOutConfirm: 'Abmelden',
  privacy: 'Datenschutz',
  consents: 'Einwilligungen',
  consentsHint: 'Ansehen, erteilen oder widerrufen',
  licenses: 'Lizenzen und Quellen',
  settingsLink: 'Mein Konto',
  settingsLinkText:
    'Abmelden, Daten exportieren und Konto löschen findest du jetzt unter „Mein Konto“.',
  back: 'Zurück',
} as const;

export const deConsentsPage = {
  title: 'Einwilligungen',
  back: 'Zurück',
} as const;
