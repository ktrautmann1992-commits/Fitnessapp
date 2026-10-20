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
  shopping: 'Einkaufen',
  workouts: 'Workouts',
  competition: 'Wettkampf',
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
    planOffer:
      'Deine Angaben haben sich geändert – im Training kannst du deinen Plan neu erstellen.',
    recreate: 'Zum Training: Plan neu erstellen',
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
    recreateFirst: 'Bitte erstelle zuerst deinen Plan neu – das geht im Training.',
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
    /** Drei Zahlen der Kachel (Design 20.10.2026). */
    statDone: 'erledigt',
    statPlanned: 'geplant',
    statOpen: 'noch offen',
  },
  /** Etappe E2: Übersicht bearbeiten (docs/PLAN-EINKAUFEN-AUSDAUER.md 4). */
  edit: {
    open: 'Bearbeiten',
    openHint: 'Kacheln ein- und ausblenden und die Reihenfolge ändern',
    title: 'Übersicht bearbeiten',
    intro:
      'Blende Kacheln ein oder aus und ändere die Reihenfolge mit „Nach oben“ und „Nach unten“. Hinweise oben bleiben immer sichtbar.',
    show: (title: string) => `${title} anzeigen`,
    up: 'Nach oben',
    down: 'Nach unten',
    upA11y: (title: string) => `${title} nach oben`,
    downA11y: (title: string) => `${title} nach unten`,
    moved: (title: string, index: number, count: number) =>
      `${title} ist jetzt an Stelle ${index} von ${count}.`,
    shown: (title: string) => `${title} wird angezeigt.`,
    hidden: (title: string) => `${title} ist ausgeblendet.`,
    done: 'Fertig',
    reset: 'Auf Standard zurücksetzen',
    resetDone: 'Übersicht und Menüleiste sind wieder wie am Anfang.',
    menuBar: 'Menüleiste anpassen',
    saveFailed: 'Das hat nicht geklappt. Bitte versuche es noch einmal.',
    allHidden: 'Alle Kacheln sind ausgeblendet.',
    allHiddenHint: 'Über „Bearbeiten“ holst du sie zurück.',
    tiles: {
      training: 'Training heute',
      competition: 'Mein Wettkampf',
      workouts: 'Workouts',
      nutrition: 'Ernährung heute',
      body: 'Körperdaten',
      progress: 'Fortschritt',
      endurance: 'Ausdauer',
      shortcuts: 'Schnell zu',
    },
  },
  /** Kachel „Mein Wettkampf“ (Gründer-Rückmeldung 20.10.2026: Wettkampfplan leicht finden). */
  competition: {
    title: 'Mein Wettkampf',
    none: 'Du hast noch keinen Wettkampf eingetragen. Trag einen Lauf, ein Radrennen oder einen Triathlon ein – wir planen rückwärts vom Renntag.',
    plan: 'Wettkampf planen',
    planA11y: 'Wettkampf planen: Renntag und Distanz eintragen',
    open: 'Wettkampfplan ansehen',
    openA11y: (name: string) => `Wettkampfplan für ${name} ansehen`,
    unreadable:
      'Dein Wettkampf konnte gerade nicht gelesen werden. Öffne „Mein Wettkampf“ und prüfe die Angaben.',
    unreadableOpen: 'Mein Wettkampf öffnen',
    raceDate: (date: string) => `Renntag: ${date}`,
    /** Countdown mit Wochen (ab 14 Tagen), z. B. „Noch 30 Tage (gut 4 Wochen)“. */
    countdown: (days: number) =>
      days === 1
        ? 'Noch 1 Tag'
        : days < 14
          ? `Noch ${days} Tage`
          : days % 7 === 0
            ? `Noch ${days} Tage (${days / 7} Wochen)`
            : `Noch ${days} Tage (gut ${Math.floor(days / 7)} Wochen)`,
    planActive: '✓ Wettkampfplan aktiv',
    planActiveA11y: 'Wettkampfplan aktiv',
    feasibility: (symbol: string, label: string) => `Machbarkeit: ${symbol} ${label}`,
    feasibilityA11y: (label: string) => `Machbarkeit: ${label}`,
    check: 'Machbarkeit: bitte im Wettkampf prüfen',
    noPlan: 'Noch kein Wettkampfplan – im Wettkampf siehst du die Ampel und kannst ihn erstellen.',
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
  /** Etappe E2: Bereiche ohne Knopf in der Menüleiste. */
  areasTitle: 'Weitere Bereiche',
  menuBar: 'Menüleiste anpassen',
  layoutHint: 'Welche Bereiche unten als Knöpfe erscheinen und in welcher Reihenfolge',
  sections: {
    personal: 'Persönlich',
    content: 'Inhalte',
    info: 'Info',
    /** Gruppen im Design vom 20.10.2026. */
    sport: 'Training & Sport',
    food: 'Essen',
    knowledge: 'Wissen & Einstellungen',
  },
  accountShort: 'E-Mail, Einwilligungen, Daten, Abmelden',
  endurance: 'Ausdauer',
  /** Kurzer Zusatz unter dem Namen der Kacheln. */
  details: {
    wettkampf: 'Plan, Countdown',
    endurance: 'Laufen, Rad, Gehen',
    fortschritt: 'Woche, Verlauf',
    exercises: 'mit Muskelkarte',
    workouts: 'mit Timer',
    today: 'Plan und Heute',
    ernaehrung: 'Tagesplan',
    einkaufsliste: 'Liste und Scan',
    recipes: 'passend zum Plan',
    mealPrep: 'vorkochen',
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

/** Etappe E2: Menüleiste anpassen (docs/PLAN-EINKAUFEN-AUSDAUER.md 4). */
export const deMenuBar = {
  title: 'Menüleiste anpassen',
  intro: (min: number, max: number) =>
    `Wähle, welche Bereiche unten als Knöpfe erscheinen (${min} bis ${max} Knöpfe). „Übersicht“ steht immer links, „Mehr“ immer rechts. Alles ohne Knopf findest du unter „Mehr“.`,
  inBar: (label: string) => `${label} in der Menüleiste`,
  fixed: 'Immer dabei',
  up: 'Nach links',
  down: 'Nach rechts',
  upA11y: (label: string) => `${label} nach links`,
  downA11y: (label: string) => `${label} nach rechts`,
  moved: (label: string, index: number, count: number) =>
    `${label} ist jetzt Knopf ${index} von ${count}.`,
  added: (label: string) => `${label} ist jetzt in der Menüleiste.`,
  removed: (label: string) => `${label} ist jetzt unter „Mehr“.`,
  reasons: {
    max: (max: number) => `Höchstens ${max} Knöpfe – nimm erst einen heraus.`,
    min: (min: number) => `Mindestens ${min} Knöpfe – nimm erst einen anderen dazu.`,
    fixed: '„Übersicht“ und „Mehr“ bleiben immer in der Menüleiste.',
    unavailable: 'Diesen Bereich gibt es in dieser Fassung der App noch nicht.',
  },
  preview: 'So sieht deine Menüleiste aus:',
  reset: 'Auf Standard zurücksetzen',
  resetDone: 'Die Menüleiste ist wieder wie am Anfang.',
  saveFailed: 'Das hat nicht geklappt. Bitte versuche es noch einmal.',
  back: 'Fertig',
} as const;
