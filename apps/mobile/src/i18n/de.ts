/**
 * Alle Texte der App auf Deutsch (de-DE, de-AT, de-CH).
 *
 * Struktur ist für weitere Sprachen vorbereitet: Eine englische Datei `en.ts` muss denselben Typ `Strings`
 * erfüllen (siehe i18n/index.ts). Fachliche Texte, die zur Logik gehören (Gesundheits-Fragen,
 * Mess-Anleitungen, Geräte- und Lebensmittelnamen), stehen in packages/core und werden dort gepflegt.
 */
export const de = {
  common: {
    next: 'Weiter',
    back: 'Zurück',
    skip: 'Überspringen',
    save: 'Speichern',
    cancel: 'Abbrechen',
    retry: 'Erneut versuchen',
    loading: 'Wird geladen …',
    saving: 'Wird gespeichert …',
    yes: 'Ja',
    no: 'Nein',
    optional: 'optional',
    close: 'Schließen',
    toStart: 'Zur Startseite',
    progress: (current: number, total: number) => `Schritt ${current} von ${total}`,
  },
  banner: {
    testMode: 'Testmodus – Daten bleiben nur auf diesem Gerät',
    invalidConfig: 'Supabase-Einstellungen fehlerhaft – Testmodus aktiv',
    pendingSync: (count: number) =>
      count === 1
        ? '1 Änderung wird gesendet, sobald du wieder online bist.'
        : `${count} Änderungen werden gesendet, sobald du wieder online bist.`,
  },
  errors: {
    generic: 'Etwas ist schiefgelaufen. Bitte versuche es noch einmal.',
    network: 'Keine Verbindung – deine Angaben sind gespeichert, wir versuchen es gleich nochmal.',
    networkRetry: 'Keine Verbindung. Bitte versuche es erneut, sobald du online bist.',
    networkSensitive:
      'Keine Verbindung. Gesundheitsdaten speichern wir nicht auf dem Gerät – bitte versuche es erneut, sobald du online bist.',
    minAge: 'Die App ist ab 16 Jahren nutzbar.',
    consentRequired:
      'Dafür brauchen wir deine Einwilligung in die Verarbeitung von Gesundheitsdaten.',
    notSignedIn: 'Du bist nicht angemeldet. Bitte melde dich erneut an.',
    invalidCode:
      'Der Code ist falsch oder abgelaufen. Bitte prüfe ihn oder fordere einen neuen an.',
    rateLimited: 'Zu viele Versuche. Bitte warte ein paar Minuten und versuche es dann erneut.',
    profileMissing: 'Bitte gib zuerst dein Geburtsdatum an.',
    loadFailed: 'Deine Daten konnten nicht geladen werden.',
  },
  welcome: {
    title: 'Willkommen!',
    intro:
      'Beantworte ein paar Fragen zu dir, deinem Ziel und deinem Alltag. Daraus entsteht dein persönlicher Plan.',
    features: [
      { title: 'Trainingsplan', text: 'Passend zu Ziel, Zeitbudget und deinem Equipment.' },
      { title: 'Ernährung', text: 'Wochenplan mit Rezepten und Einkaufsliste.' },
      { title: 'Tagebuch', text: 'Sätze, Gewichte und Läufe festhalten – auch offline.' },
    ],
    start: "Los geht's",
    haveAccount: 'Ich habe schon ein Konto',
    minAgeNote: 'Nutzung ab 16 Jahren.',
  },
  age: {
    title: 'Wann bist du geboren?',
    intro:
      'Die App ist ab 16 Jahren nutzbar. Dein Geburtsdatum brauchen wir für die Altersprüfung.',
    label: 'Geburtsdatum',
    day: 'Tag',
    month: 'Monat',
    year: 'Jahr',
    dayPlaceholder: 'TT',
    monthPlaceholder: 'MM',
    yearPlaceholder: 'JJJJ',
    incomplete: 'Bitte Tag, Monat und Jahr eingeben (TT.MM.JJJJ).',
    invalid: 'Bitte ein gültiges Datum eingeben.',
  },
  tooYoung: {
    title: 'Schön, dass du dich für Fitness interessierst!',
    text: 'Die App ist ab 16 Jahren nutzbar. Wir haben nichts von dir gespeichert. Schau gerne wieder vorbei, wenn du 16 bist.',
    tip: 'Bis dahin: Sport im Verein oder in der Schule ist ein super Start – frag dort nach einem Trainingsplan.',
    back: 'Zurück zum Start',
  },
  account: {
    title: 'Konto anlegen',
    loginTitle: 'Anmelden',
    intro: 'Wir schicken dir einen 6-stelligen Code per E-Mail. Ein Passwort brauchst du nicht.',
    email: 'E-Mail-Adresse',
    emailPlaceholder: 'name@beispiel.de',
    emailInvalid: 'Bitte eine gültige E-Mail-Adresse eingeben.',
    sendCode: 'Code senden',
    codeSent: (email: string) => `Wir haben dir einen Code an ${email} geschickt.`,
    code: '6-stelliger Code',
    codeInvalid: 'Bitte den 6-stelligen Code aus der E-Mail eingeben.',
    verify: 'Anmelden',
    resend: 'Code erneut senden',
    otherEmail: 'Andere E-Mail-Adresse',
    laterProviders: '„Mit Apple anmelden“ und „Mit Google anmelden“ folgen später.',
    testTitle: 'Testmodus',
    testIntro:
      'Die App ist noch nicht mit der Datenbank verbunden. Du kannst sie trotzdem vollständig ausprobieren: Alle Angaben bleiben nur auf diesem Gerät gespeichert.',
    startTest: 'Testmodus starten',
  },
  baseConsents: {
    title: 'Deine Zustimmung',
    reconsentTitle: 'Neue Fassung – bitte erneut zustimmen',
    intro:
      'Bitte lies die Nutzungsbedingungen und die Datenschutzerklärung und bestätige beide einzeln.',
    termsLabel: 'Ich akzeptiere die Nutzungsbedingungen.',
    privacyLabel: 'Ich habe die Datenschutzerklärung gelesen.',
    readText: 'Text lesen',
    version: (version: number) => `Version ${version}`,
    missing: 'Bitte bestätige beide Punkte, um fortzufahren.',
    submit: 'Zustimmen und weiter',
  },
  consentText: {
    title: 'Einwilligungstext',
    notFound: 'Dieser Text ist nicht verfügbar.',
  },
  consentTypes: {
    terms: 'Nutzungsbedingungen',
    privacy: 'Datenschutzerklärung',
    health_data: 'Gesundheitsdaten',
    cycle_data: 'Zyklusdaten',
  },
  steps: {
    sex: {
      title: 'Dein Geschlecht',
      intro: 'Das hilft uns später bei der Berechnung deines Kalorienbedarfs.',
      required: 'Bitte wähle eine Option.',
      options: {
        male: 'männlich',
        female: 'weiblich',
        diverse: 'divers',
        unspecified: 'keine Angabe',
      },
      cycleQuestion: 'Interesse am Zyklus-Modul später?',
      cycleHint:
        'Das Zyklus-Modul kommt in einer späteren Version. Wir speichern nur dein Interesse (ja/nein), keine Zyklusdaten.',
    },
    healthConsent: {
      title: 'Einwilligung Gesundheitsdaten',
      intro:
        'Für Körperdaten, Körperumfänge, den Gesundheits-Check und Unverträglichkeiten brauchen wir deine ausdrückliche Einwilligung.',
      checkbox: 'Ich willige in die Verarbeitung meiner Gesundheitsdaten wie beschrieben ein.',
      alreadyGranted: (version: number) =>
        `Du hast bereits eingewilligt (Version ${version}). Widerrufen kannst du jederzeit in den Einstellungen.`,
      missing: 'Bitte setze das Häkchen – oder fahre ohne Einwilligung fort.',
      grant: 'Einwilligen und weiter',
      decline: 'Ohne Einwilligung fortfahren',
      declineHint:
        'Ohne Einwilligung kannst du die App nutzen, bekommst aber nur allgemeine Pläne – ohne Körperdaten, ohne Körperumfänge, ohne Gesundheits-Check und ohne Unverträglichkeiten.',
      testModeNote:
        'Im Testmodus werden deine Angaben nur in diesem Browser/auf diesem Gerät gespeichert, nicht auf einem Server.',
      reconsentTitle: 'Neue Fassung der Einwilligung',
      reconsentIntro:
        'Wir haben den Text geändert. Bis du neu zustimmst, bleiben deine bisherigen Daten sichtbar, können aber nicht ergänzt werden.',
    },
    bodyMetrics: {
      title: 'Körperdaten',
      intro: 'Größe und Gewicht brauchen wir für deinen Kalorienbedarf. Der Rest ist freiwillig.',
      height: 'Größe in cm',
      weight: 'Gewicht in kg',
      bodyFat: 'Körperfett in % (optional)',
      restingHeartRate: 'Ruhepuls pro Minute (optional)',
      decimalHint: 'Kommazahlen mit Komma oder Punkt, z. B. 72,5',
    },
    bodyMeasurements: {
      title: 'Körperumfänge',
      intro:
        'Freiwillig: Mit einem Maßband siehst du Fortschritte, die die Waage nicht zeigt. Du kannst den Schritt überspringen.',
      general:
        'Am besten morgens nüchtern messen. Maßband anliegend, aber nicht einschnürend – und immer an derselben Stelle.',
      unit: 'cm',
      reminderTitle: 'Erinnerung zum Nachmessen',
      reminderText: (days: number) =>
        `Wir erinnern dich alle ${days} Tage (ca. 4 Wochen) ans Nachmessen. Den Abstand kannst du in den Einstellungen ändern.`,
      reminderToggle: 'Erinnerung einschalten',
      atLeastOne: 'Bitte mindestens einen Umfang eintragen – oder den Schritt überspringen.',
    },
    healthScreening: {
      title: 'Gesundheits-Check',
      intro:
        'Bitte beantworte jede Frage mit Ja oder Nein. Das ist keine Diagnose – es hilft uns, deinen Plan sicher zu gestalten.',
      unanswered: 'Bitte beantworte alle Fragen.',
      noticeTitle: 'Bitte vor dem Start ärztlich abklären',
      noticeText:
        'Mindestens eine Antwort deutet darauf hin, dass du vor dem Training mit deiner Ärztin oder deinem Arzt sprechen solltest. Wir erstellen dir einen vorsichtigeren Plan: geringere Intensität und keine Maximaltests.',
      noticeCheckbox: 'Ich habe den Hinweis gelesen und kläre das ärztlich ab.',
      noticeMissing: 'Bitte bestätige den Hinweis.',
      noticeConfirm: 'Bestätigen und weiter',
      noticeChange: 'Antworten ändern',
    },
    experience: {
      title: 'Deine Trainingserfahrung',
      required: 'Bitte wähle eine Option.',
      options: {
        beginner: {
          label: 'Einsteiger',
          text: 'Ich fange (wieder) an oder trainiere unregelmäßig.',
        },
        advanced: { label: 'Fortgeschritten', text: 'Ich trainiere seit Monaten regelmäßig.' },
        competitive: {
          label: 'Leistungssport',
          text: 'Ich trainiere strukturiert für Wettkämpfe.',
        },
      },
    },
    goal: {
      title: 'Dein Ziel',
      required: 'Bitte wähle ein Ziel.',
      options: {
        fat_loss: 'Abnehmen',
        definition: 'Definition',
        muscle_gain: 'Muskelaufbau',
        general_fitness: 'Fitness & Gesundheit',
        endurance: 'Ausdauer',
      },
      discipline: 'Disziplin (optional)',
      disciplines: {
        '5k': '5 km',
        '10k': '10 km',
        half_marathon: 'Halbmarathon',
        marathon: 'Marathon',
        triathlon_sprint: 'Triathlon Sprint',
        triathlon_olympic: 'Triathlon olympisch',
        triathlon_middle: 'Triathlon Mitteldistanz',
        triathlon_long: 'Triathlon Langdistanz',
        cycling: 'Radfahren',
        swimming: 'Schwimmen',
      },
      targetDate: 'Wettkampf- oder Zieldatum (optional)',
    },
    trainingSchedule: {
      title: 'Deine Trainingstage',
      intro:
        'Was machst du an welchem Tag – und wie lange? Hinweise unten helfen dir, nichts ist Pflicht.',
      modeLabel: 'Wie planst du deine Woche?',
      modes: { fixed: 'Feste Wochentage', flex: 'Tage egal – verteilt für mich' },
      days: 'An welchen Tagen trainierst du?',
      noDays: 'Tippe die Tage an, an denen du trainieren möchtest.',
      weekdays: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
      weekdaysLong: [
        'Montag',
        'Dienstag',
        'Mittwoch',
        'Donnerstag',
        'Freitag',
        'Samstag',
        'Sonntag',
      ],
      what: 'Was?',
      howLong: 'Wie lange?',
      kinds: {
        strength_gym: 'Kraft im Studio',
        strength_home: 'Kraft zu Hause',
        endurance: 'Ausdauer',
      },
      enduranceSubtitles: {
        running: 'Laufen',
        cycling: 'Radfahren',
        swimming: 'Schwimmen',
        running_cycling: 'Laufen und Rad',
      },
      minutesShort: (minutes: number) => `${minutes} min`,
      minutesLong: (minutes: number) => `${minutes} Minuten`,
      ownMinutes: 'Eigene',
      ownMinutesField: 'Minuten (10–240)',
      applyToAll: 'Für alle Tage übernehmen',
      flexIntro: 'Wie oft pro Woche – und wie lange? Die Tage verteilen wir für dich.',
      perSession: 'Dauer je Einheit',
      decrease: (kind: string) => `${kind}: eine Einheit weniger`,
      increase: (kind: string) => `${kind}: eine Einheit mehr`,
      countValue: (count: number) => `${count}×`,
      summaryTitle: 'Deine Woche',
      summaryEmpty: 'Noch nichts geplant.',
      summaryDays: (count: number) => (count === 1 ? '1 Tag' : `${count} Tage`),
      summaryMinutes: (minutes: number) => `${minutes} min pro Woche`,
      hintsTitle: 'Gut zu wissen',
      hints: {
        endurance_goal_no_endurance:
          'Dein Ziel ist Ausdauer – wir empfehlen mindestens 2 Ausdauer-Tage.',
        strength_goal_no_strength:
          'Für Muskelaufbau/Definition empfehlen wir mindestens 2 Kraft-Tage.',
        strength_days_over_max:
          'Mehr als 4 Kraft-Tage planen wir nicht – die übrigen werden Ruhetage mit lockerer Bewegung.',
        strength_back_to_back:
          'Kraft an zwei Tagen hintereinander: Wir achten darauf, dass nicht dieselben Muskeln dran sind.',
        no_rest_day: 'Kein Ruhetag – mindestens einer pro Woche ist für die Erholung wichtig.',
        week_total_capped:
          'Mehr als 5 Einheiten planen wir für dich noch nicht – mindestens 2 Ruhetage helfen beim Erholen.',
      },
    },
    equipment: {
      title: 'Equipment zu Hause',
      intro: 'Was hast du zu Hause zur Verfügung? Mehrfachauswahl möglich.',
      empty:
        'Noch nichts ausgewählt – kein Problem: Dann planen wir mit Übungen mit dem eigenen Körpergewicht.',
      weights: 'Gewichte',
      weightsHint: {
        dumbbells: 'Gewicht je Hantel – tippe an, was du hast.',
        barbell: 'Hantelscheiben je Paar – tippe an, was du hast.',
        kettlebells: 'Gewicht je Kugel – tippe an, was du hast.',
      },
      plates: 'Scheiben',
      bar: 'Stange',
      barHint: 'Gewicht der Stange, z. B. Olympiastange 20 kg oder SZ-Stange 7 kg.',
      ownBar: 'Eigene',
      ownBarField: 'Stange in kg (5–25)',
      weightChip: (kg: string) => `${kg} kg`,
      weightChipLabel: (device: string, kg: string) => `${device}: ${kg} kg`,
      ownWeights: 'Eigene Werte',
      weightInput: 'Gewicht in kg',
      addWeight: 'Hinzufügen',
      removeWeight: (kg: string) => `${kg} kg entfernen`,
      clearAll: 'Alle abwählen',
      clearAllLabel: (device: string) => `${device}: alle Gewichte abwählen`,
      selectedCount: (count: number) =>
        count === 0 ? 'Noch nichts angetippt (optional).' : `${count} ausgewählt`,
      tooMany: (max: number) => `Höchstens ${max} Gewichtsstufen.`,
      otherNote: 'Was für ein Gerät?',
      otherNotePlaceholder: 'z. B. Sprungseil, Gymnastikball',
    },
    nutrition: {
      title: 'Deine Ernährung',
      diet: 'Ernährungsform',
      dietRequired: 'Bitte wähle eine Ernährungsform.',
      diets: { omnivore: 'Alles (omnivor)', vegetarian: 'Vegetarisch', vegan: 'Vegan' },
      pork: 'Isst du Schweinefleisch? (optional)',
      meals: 'Mahlzeiten pro Tag',
      mealsRequired: 'Bitte wähle, wie viele Mahlzeiten du am Tag isst.',
      preferences: 'Vorlieben (optional)',
      preferencesHint: 'Tippe an, was du magst, nicht magst oder nicht verträgst.',
      kinds: { like: 'Mag ich', dislike: 'Mag ich nicht', intolerance: 'Unverträglich' },
      intoleranceLocked:
        'Unverträglichkeiten sind Gesundheitsdaten und lassen sich nur mit deiner Einwilligung angeben (Einstellungen).',
    },
    cooking: {
      title: 'Wie kochst du?',
      required: 'Bitte wähle einen Kochmodus.',
      options: {
        daily: { label: 'Täglich frisch', text: 'Ich koche (fast) jeden Tag.' },
        meal_prep: { label: 'Meal-Prep', text: 'Ich koche vor, für mehrere Tage.' },
      },
      mealprepDays: 'An wie vielen Tagen pro Woche kochst du vor?',
      mealprepRequired: 'Bitte wähle die Anzahl der Tage.',
    },
  },
  done: {
    title: 'Geschafft!',
    preparing: 'Dein Plan wird vorbereitet – kommt in Phase 3.',
    summary: 'Deine Angaben',
    noHealthConsent: 'Ohne Einwilligung Gesundheitsdaten – allgemeine Pläne ohne Körperdaten.',
    conservative: 'Vorsichtiger Plan (Gesundheits-Check)',
    measurementsSkipped: 'Körperumfänge übersprungen',
    measurementsCount: (count: number) => `${count} Körperumfänge eingetragen`,
    labels: {
      sex: 'Geschlecht',
      bodyMetrics: 'Körperdaten',
      measurements: 'Körperumfänge',
      screening: 'Gesundheits-Check',
      experience: 'Erfahrung',
      goal: 'Ziel',
      trainingDays: 'Trainingstage',
      equipment: 'Equipment',
      nutrition: 'Ernährung',
      cooking: 'Kochmodus',
    },
    screeningOk: 'Keine Auffälligkeiten',
    flexSuffix: ' – die Tage verteilen wir',
    equipmentWeights: (range: string, count: number) =>
      count === 1 ? `${range} kg` : `${range} kg, ${count} Stufen`,
    barbellValue: (bar: string, plates: string | null) =>
      plates === null ? `Stange ${bar} kg` : `Stange ${bar} kg, Scheiben ${plates} kg`,
    equipmentNone: 'Keine Geräte (Körpergewicht)',
    mealsValue: (meals: number) => `${meals} Mahlzeiten pro Tag`,
    mealprepValue: (days: number) => `Meal-Prep an ${days} Tagen pro Woche`,
  },
  today: {
    title: 'Heute',
    greeting: 'Schön, dass du da bist!',
    placeholderTitle: 'Dein Plan wird vorbereitet',
    placeholderText:
      'Hier siehst du bald dein Training und deine Mahlzeiten für heute. Der Trainingsplan kommt in Phase 3.',
    measurementDue: 'Zeit zum Nachmessen: Deine Körperumfänge sind fällig.',
    healthReconsent:
      'Die Einwilligung Gesundheitsdaten gibt es in einer neuen Fassung. Bitte stimme erneut zu, damit wir deine Daten weiter ergänzen dürfen.',
    reconsentButton: 'Neue Fassung lesen',
    settings: 'Einstellungen',
  },
  settings: {
    title: 'Einstellungen',
    consents: 'Einwilligungen',
    consentGranted: (version: number, date: string) => `Version ${version}, erteilt am ${date}`,
    consentRevoked: (date: string) => `Widerrufen am ${date}`,
    consentNone: 'Nicht erteilt',
    consentOutdated: 'Neue Fassung verfügbar – bitte erneut zustimmen.',
    revoke: 'Widerrufen',
    grant: 'Einwilligen',
    reconsent: 'Neu einwilligen',
    revokeTitle: 'Einwilligung widerrufen?',
    revokeText:
      'Der Widerruf löscht alle Körper- und Gesundheitsdaten: Körperdaten, Körperumfänge, alle Gesundheits-Checks und Unverträglichkeiten. Deine übrigen Angaben bleiben erhalten.',
    revokeConfirm: 'Widerrufen und löschen',
    revokeDone: 'Einwilligung widerrufen. Deine Gesundheitsdaten wurden gelöscht.',
    baseConsentNote:
      'Nutzungsbedingungen und Datenschutzerklärung sind Voraussetzung für die Nutzung. Wenn du nicht mehr einverstanden bist, lösche bitte dein Konto.',
    reminder: 'Mess-Erinnerung',
    reminderEnabled: 'Erinnerung an Körperumfänge',
    reminderInterval: 'Abstand in Tagen (7–90)',
    reminderNext: (date: string) => `Nächste Messung: ${date}`,
    reminderNoDate:
      'Noch keine Messung eingetragen – der Termin startet mit deiner ersten Messung.',
    reminderOff: 'Erinnerung ist aus.',
    reminderSaved: 'Gespeichert.',
    account: 'Konto',
    signOut: 'Abmelden',
    deleteAccount: 'Konto löschen',
    deleteTitle: 'Konto wirklich löschen?',
    deleteText:
      'Alle deine Daten werden endgültig gelöscht – auch alle Einwilligungs-Nachweise. Das lässt sich nicht rückgängig machen.',
    deleteConfirm: 'Endgültig löschen',
    testMode: 'Testmodus',
    testModeText: 'Alle Angaben liegen nur auf diesem Gerät.',
    clearTestData: 'Testdaten löschen',
    clearTitle: 'Testdaten löschen?',
    clearText:
      'Alle Angaben auf diesem Gerät werden gelöscht. Danach startest du wieder ganz von vorn.',
    clearConfirm: 'Alles löschen',
    back: 'Zurück zu Heute',
  },
  notFound: {
    title: 'Diese Seite gibt es nicht.',
  },
} as const;

/** Typ, den jede Übersetzung erfüllen muss (Texte als string, Funktionen mit gleicher Signatur). */
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : { readonly [K in keyof T]: Widen<T[K]> };

export type Strings = Widen<typeof de>;
