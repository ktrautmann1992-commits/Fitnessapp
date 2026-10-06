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
    planRejected:
      'Das hat nicht geklappt: Dein Plan passt nicht mehr zum aktuellen Stand. Bitte lade neu oder erstelle den Plan neu.',
    networkPlan:
      'Keine Verbindung. Änderungen an diesem Plan senden wir sofort – bitte versuche es erneut, sobald du online bist.',
    noTemplate: 'Für deine Angaben gibt es gerade keinen freigegebenen Plan. Wir arbeiten daran.',
    onlineOnly: 'Dafür brauchst du kurz Verbindung.',
    storageUnavailable:
      'Offline-Speicher nicht verfügbar (z. B. privates Fenster) – bitte mit Verbindung speichern.',
    foreignData:
      'Auf diesem Gerät liegen noch Einträge eines anderen Kontos. Bitte entscheide zuerst, ob sie gelöscht werden sollen.',
  },
  welcome: {
    logoLabel: 'Alpha5',
    eyebrow: 'Willkommen bei Alpha5',
    title: 'Training und Ernährung, die zu dir passen.',
    intro: 'Ein paar Fragen zu Ziel, Zeit und Equipment – daraus entsteht dein persönlicher Plan.',
    benefitsLabel: 'Das bekommst du',
    benefits: [
      {
        title: 'Plan für dein Ziel',
        text: 'Kraft, Fitness oder lockere Ausdauer – im Studio oder zu Hause, mit deinem Equipment.',
      },
      {
        title: 'Jede Woche klar geplant',
        text: 'Übungen, Sätze und Pausen für jede Einheit. Erholungswochen sind fest eingeplant.',
      },
      {
        title: 'Sicher von Anfang an',
        text: 'Ein kurzer Gesundheits-Check sorgt dafür, dass dein Plan zu dir passt.',
      },
    ],
    soon: {
      badge: 'Bald',
      title: 'Ernährung und Tagebuch',
      text: 'Wochenplan mit Rezepten und Einkaufsliste, dazu Sätze und Gewichte festhalten.',
      label: 'Bald verfügbar: Ernährungsplan und Trainingstagebuch',
    },
    start: "Los geht's",
    startHint: 'Startet die Fragen zu deinem Plan',
    haveAccount: 'Ich habe schon ein Konto – Anmelden',
    minAgeNote: 'Nutzung ab 16 Jahren',
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
      enduranceSuggestion:
        'Für dein Ausdauer-Ziel haben wir Ausdauer- und Kraft-Tage vorgeschlagen. Du kannst alles ändern. Kraft-Tage sind fürs Studio vorgeschlagen – bei Training zu Hause bitte den Ort ändern.',
      clearSuggestion: 'Ohne Vorschlag planen',
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
    creating: 'Dein Plan wird erstellt …',
    ready: 'Dein Plan ist fertig',
    toPlan: 'Zum Plan',
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
    measurementDue: 'Zeit zum Nachmessen: Deine Körperumfänge sind fällig.',
    healthReconsent:
      'Die Einwilligung Gesundheitsdaten gibt es in einer neuen Fassung. Bitte stimme erneut zu, damit wir deine Daten weiter ergänzen dürfen.',
    reconsentButton: 'Neue Fassung lesen',
    reconsentDecline: 'Ablehnen – Plan ohne Gesundheits-Check',
    reconsentDeclineTitle: 'Plan ohne Gesundheits-Check erstellen?',
    reconsentDeclineText:
      'Dein bisheriger Plan beruht auf dem Gesundheits-Check und wird durch einen neuen Plan ersetzt. Ohne Gesundheits-Check planen wir vorsichtig. Du kannst später jederzeit neu einwilligen.',
    reconsentDeclineConfirm: 'Neuen Plan erstellen',
    settings: 'Einstellungen',
    startWorkout: 'Training starten',
    catchUp: 'Heute nachholen',
    catchUpHint: 'Du trägst die verpasste Einheit mit dem heutigen Datum ein.',
    completed: '✓ Erledigt',
    completedPartly: '✓ Erledigt (teilweise)',
    viewWorkout: 'Ansehen/Ändern',
    pendingUpload: 'Wird übertragen, sobald du online bist.',
    startEndurance: 'Ausdauer eintragen',
    catchUpEndurance: 'Ausdauer heute nachholen',
    alreadyTrained: 'Heute ist schon ein Training eingetragen – nie zwei Einheiten an einem Tag.',
    libraryMissingStart:
      'Training starten geht, sobald die Übungen geprüft sind – bitte kurz online gehen.',
    openWeek: 'Woche',
    openHistory: 'Verlauf',
  },
  plan: {
    emptyTitle: 'Noch kein Plan',
    emptyText:
      'Aus deinen Angaben erstellen wir dir einen Trainingsplan – nach festen Regeln, ohne KI.',
    emptyAfterRevoke:
      'Pläne, die auf deinem Gesundheits-Check beruhten, wurden mit dem Widerruf gelöscht. Erstelle einen neuen Plan – ohne Gesundheits-Check planen wir vorsichtig.',
    create: 'Plan erstellen',
    createNew: 'Neuen Plan erstellen',
    recreate: 'Plan neu erstellen',
    creating: 'Dein Plan wird erstellt …',
    created: 'Dein neuer Plan ist fertig.',
    incomplete:
      'Für einen Plan fehlen noch Angaben (Erfahrung, Ziel oder Trainingstage). Ergänze sie unter Einstellungen → Training.',
    invalidInputs: 'Deine Angaben passen nicht zu den Regeln für einen Plan. Bitte prüfe sie.',
    loading: 'Dein Plan wird geladen …',
    testContent: 'Testinhalte – KI-Entwurf, nicht fachlich geprüft',
    notReviewed: 'Die Inhalte sind noch nicht fachlich geprüft.',
    offline: 'Offline – du siehst den zuletzt geladenen Plan.',
    droppedChange:
      'Eine Verschiebung konnte nicht übernommen werden – dein Plan wurde neu geladen.',
    templateLine: (title: string) => `Vorlage: ${title}`,
    enduranceOnly: 'Ausdauer-Plan',
    enduranceBase: (discipline: string | null) =>
      discipline ? `Ausdauer-Grundlage – ${discipline}` : 'Ausdauer-Grundlage',
    quality: {
      exact: 'Passt genau zu deinen Angaben.',
      close: 'Passt mit Anpassungen an deine Angaben.',
      fallback:
        'Für deine Angaben gibt es noch keinen genau passenden Plan. Wir haben den nächstbesten gewählt.',
    },
    notesTitle: 'Gut zu wissen',
    notes: {
      goal_endurance_not_yet:
        'Dein Wettkampfplan rückwärts ab Renndatum (lange Läufe, Tempo, Tapering) kommt in einem späteren Update. Ausdauer-Tage planst du unter Einstellungen → Angaben ändern → Trainingstage ein.',
      days_rotated:
        'Bei 1–2 Kraft-Tagen wechseln die Einheiten von Woche zu Woche – so kommt jede Muskelgruppe dran. Der Umfang ist geringer.',
      days_capped:
        'Mehr als 4 Kraft-Einheiten planen wir nicht – an den übrigen Tagen ist Ruhetag. Lockere Bewegung (Spazieren, Rad) ist dann gut.',
      days_added: 'Wir haben Trainingstage ergänzt, damit die Woche gut verteilt ist.',
      back_to_back_sessions:
        'Zwei Kraft-Einheiten liegen direkt hintereinander. Deine Wunsch-Tage haben Vorrang – achte auf gute Erholung.',
      minutes_shortened:
        'Einige Einheiten sind gekürzt, damit sie in deine Zeit passen (weniger Übungen oder Sätze).',
      minutes_below_minimum:
        'Für so wenig Zeit ist selbst die kürzeste Fassung etwas länger. Plane wenn möglich ein paar Minuten mehr ein.',
      volume_reduced:
        'Der Trainingsumfang ist geringer als empfohlen. Mehr Zeit oder mehr Tage bringen mehr Fortschritt.',
      exercises_substituted:
        'Einige Übungen sind ersetzt, weil ein Gerät fehlt. Sie sind mit „ersetzt (Gerät fehlt)“ gekennzeichnet.',
      exercises_removed:
        'Einzelne Übungen entfallen, weil Geräte fehlen und es keinen passenden Ersatz gibt.',
      no_pull_exercise:
        'Für Rücken-Übungen (Ziehen) fehlt ein Gerät. Dafür reicht schon ein Widerstandsband.',
      location_mismatch:
        'Die Vorlage passt nicht ganz zu deinem Trainingsort – Übungen, für die dort Geräte fehlen, haben wir getauscht.',
      endurance_days_capped:
        'Wir planen weniger Ausdauer-Tage als gewünscht, damit genug Erholung bleibt.',
      endurance_volume_ramped:
        'Wir starten mit weniger Ausdauer-Minuten und steigern jede Woche höchstens um 10 %.',
      endurance_walk: 'Wir starten mit zügigem Gehen.',
      rest_day_added:
        'Eine sehr kurze Ausdauer-Einheit haben wir gestrichen – der Tag ist Ruhetag.',
      week_total_capped:
        'Mehr als 5 Einheiten pro Woche planen wir für dich noch nicht – mindestens 2 Ruhetage helfen beim Erholen.',
      endurance_basic_only:
        'Dein Wettkampfplan rückwärts ab Renndatum (lange Läufe, Tempo, Tapering) kommt in einem späteren Update.',
    },
    medicalNoticeTitle: 'Vor dem Training',
    medicalNotice:
      'Bitte kläre vor dem Training ärztlich ab, ob es für dich passt. Bei Brustschmerz, Schwindel oder Atemnot sofort aufhören.',
    cautious: 'Dein Plan ist bewusst vorsichtig aufgebaut.',
    noCheck: 'Ohne Gesundheits-Check planen wir vorsichtig.',
    pregnancy:
      'Dieser Plan ist nicht für die Schwangerschaft entwickelt. Bitte stimme dein Training mit deiner Ärztin oder deinem Arzt ab.',
    weekHeader: (week: number, total: number) => `Woche ${week} von ${total}`,
    week0: 'Woche 0 – zum Reinschnuppern',
    introWeek: 'Einstiegswoche',
    introWeekText:
      'Wähle Gewichte, mit denen du alle Wiederholungen sauber schaffst und noch etwa 3 übrig hättest. Lieber zu leicht als zu schwer.',
    deloadWeek: 'Erholungswoche',
    deloadWeekText:
      'Weniger Sätze und etwas leichter – so erholt sich dein Körper und wird danach stärker.',
    restDay: 'Heute ist Ruhetag',
    restDayTip: 'Lockere Bewegung wie Spazierengehen oder Radfahren tut an Ruhetagen gut.',
    nextSession: (day: string, name: string) => `Nächste Einheit: ${day} – ${name}`,
    firstSession: (day: string) => `Dein erstes Training: ${day}`,
    noUpcoming: 'In diesem Plan sind keine Einheiten mehr geplant.',
    sessionOn: (day: string) => `Einheit am ${day}`,
    todaySession: 'Deine Einheit heute',
    duration: (minutes: number) => `ca. ${minutes} Minuten`,
    warmup: 'Aufwärmen',
    cooldown: 'Cool-down',
    exercises: 'Übungen',
    setsReps: (sets: number, reps: string) => `${sets} × ${reps} Wiederholungen`,
    setsHold: (sets: number, seconds: number) => `${sets} × ${seconds} Sekunden halten`,
    rest: (pause: string) => `Pause ${pause}`,
    reserve: (reps: string) => `ca. ${reps} Wiederholungen in Reserve`,
    startWeight: 'Startgewicht finden',
    targetWeight: (kg: string) => `Zielgewicht ${kg} kg`,
    substituted: 'ersetzt (Gerät fehlt)',
    adjusted: 'angepasst an deine aktuellen Angaben',
    hiddenExercises:
      'Mindestens eine Übung wurde ausgelassen, weil sie nach deinen aktuellen Angaben nicht passt. Bitte erstelle den Plan neu.',
    libraryMissingTitle: 'Übungen können gerade nicht geprüft werden',
    libraryMissingText: 'Bitte kurz online gehen – dann zeigen wir dir die Übungen dieser Einheit.',
    enduranceDuration: (minutes: number) => `${minutes} Minuten`,
    weekTitle: 'Deine Woche',
    restShort: 'Ruhetag',
    todayBadge: 'heute',
    skipped: 'entfällt',
    deloadBadge: 'Erholung',
    completedBadge: '✓ erledigt',
    alsoCompleted: (name: string) => `außerdem erledigt: ${name}`,
    movedFrom: (day: string) => `verschoben von ${day}`,
    movedAway: (day: string) => `verschoben auf ${day}`,
    showDay: (day: string) => `${day} anzeigen`,
    move: 'Einheit verschieben',
    missed: 'Verpasst – auf einen freien Tag dieser Woche verschieben?',
    recreateNeeded:
      'Der nächste Abschnitt deines Plans konnte nicht angelegt werden. Bitte erstelle deinen Plan neu.',
    moved: (day: string) => `Auf ${day} verschoben.`,
    skippedResult: 'Diese Woche ist kein Tag mehr frei – die Einheit entfällt.',
    skipTitle: 'Einheit streichen?',
    skipText:
      'Diese Woche ist kein passender Tag mehr frei (Erholung zwischen den Einheiten, Erholungswoche). Die Einheit entfällt – sie wandert nicht in die nächste Woche.',
    skipConfirm: 'Einheit streichen',
    offerTitle: 'Deine Angaben haben sich geändert',
    offerText: 'Plan neu erstellen? Dein jetziger Plan bleibt, bis du einen neuen erstellst.',
    offerStricterTitle: 'Bitte Plan neu erstellen',
    offerStricterText:
      'Für dich gelten jetzt strengere Sicherheitsregeln (z. B. neuer Gesundheits-Check oder Geburtstag). Wir zeigen deinen Plan schon vorsichtiger an – erstelle ihn bitte neu.',
    offerVersion: 'Es gibt eine neue Version deines Plans.',
    endedTitle: 'Dein Plan ist abgelaufen',
    endedText: 'Erstelle einen neuen Plan, um weiterzutrainieren.',
    recreateTitle: 'Plan neu erstellen?',
    recreateText:
      'Wir erstellen einen neuen Plan aus deinen aktuellen Angaben. Vergangene Einheiten bleiben erhalten, alle kommenden werden ersetzt.',
    recreateConfirm: 'Neu erstellen',
    endurance: {
      walkRun: 'Geh-Lauf-Wechsel',
    },
  },
  /** Trainingsmodus (docs/PLAN-PHASE-4.md 6.1–6.5). */
  workout: {
    title: 'Training',
    exerciseOf: (current: number, total: number) => `Übung ${current} von ${total}`,
    allDone: 'Alle Übungen erledigt',
    tabHint: 'Lass diesen Tab offen, bis dein Training übertragen ist.',
    leaveWarning: 'Dein Training ist noch nicht übertragen. Wirklich verlassen?',
    loading: 'Dein Training wird vorbereitet …',
    notFound: 'Diese Einheit gibt es nicht mehr. Dein Plan hat sich vielleicht geändert.',
    notStartable: 'Diese Einheit kannst du heute nicht eintragen.',
    libraryMissing:
      'Die Übungen können gerade nicht geprüft werden. Bitte kurz online gehen – dann kannst du starten.',
    alternativesLocked: 'Alternativen gehen erst nach kurzem Online-Gehen.',
    editing: 'Du änderst ein gespeichertes Training. Übungen lassen sich dabei nicht tauschen.',
    back: 'Zurück zu Heute',
    // Übung
    target: (sets: number, reps: string, weight: string | null) =>
      weight
        ? `${sets} × ${reps} Wiederholungen mit ${weight}`
        : `${sets} × ${reps} Wiederholungen`,
    targetHold: (sets: number, seconds: number) => `${sets} × ${seconds} Sekunden halten`,
    repsUnit: (reps: number | null) =>
      reps === null ? 'Wiederholungen' : `${reps} Wiederholungen`,
    weightKg: (kg: string) => `${kg} kg`,
    perDumbbell: 'je Hantel',
    perKettlebell: 'je Kugel',
    findStartWeight:
      'Startgewicht finden: Wähle ein Gewicht, mit dem du alle Wiederholungen sauber schaffst und noch etwa 2–3 übrig hättest.',
    chooseLightest: 'Nimm deine leichteste Stufe – ein passendes Gewicht hast du (noch) nicht.',
    fromStartWeight: 'Vorschlag aus deinem Startgewicht',
    returnAfterPause: 'Wiedereinstieg nach Pause: heute etwas leichter.',
    rpeTarget: (reserve: string) => `Ziel: ca. ${reserve} Wiederholungen in Reserve`,
    hint: {
      harder_variant: (name: string) =>
        `Du schaffst alles sicher – probier als Nächstes „${name}“ (als Alternative eintragen).`,
      stronger_band: 'Du schaffst alles sicher – nimm beim nächsten Mal ein stärkeres Band.',
      no_heavier_weight:
        'Für mehr Fortschritt brauchst du eine schwerere Gewichtsstufe – trag sie in deinen Geräten ein oder wähle eine schwerere Variante.',
      confirm_weight:
        'Dein eingetragenes Gewicht wurde nicht übernommen, weil es nicht bestätigt war. Trag es erneut ein und bestätige es.',
    },
    alternativeOf: (name: string) => `statt ${name}`,
    skippedLabel: 'Nicht gemacht',
    // Sätze
    setLabel: (no: number) => `Satz ${no}`,
    weight: 'Gewicht',
    reps: 'Wiederholungen',
    seconds: 'Sekunden',
    decrease: 'verringern',
    increase: 'erhöhen',
    stepperLabel: (what: string, value: string, action: string) => `${what} ${value}, ${action}`,
    weightA11y: (kg: string) => `${kg} Kilogramm`,
    setDone: 'Satz geschafft',
    setDoneA11y: (no: number) => `Satz ${no} geschafft`,
    setOpen: 'Abhaken',
    addSet: 'Satz hinzufügen',
    reserveQuestion: 'Wie viele Wiederholungen wären noch gegangen?',
    reserveOption: (value: number) => (value >= 5 ? '5+' : String(value)),
    reserveA11y: (value: number) =>
      value >= 5 ? '5 oder mehr Wiederholungen in Reserve' : `${value} Wiederholungen in Reserve`,
    // Warnungen
    confirmHeavierTitle: 'Absichtlich deutlich schwerer als geplant?',
    confirmAbsoluteTitle: 'Stimmt das Gewicht?',
    confirmLighterTitle: 'Absichtlich deutlich leichter?',
    confirmText:
      'Nur bestätigte Gewichte zählen für deinen nächsten Vorschlag. Ein Tippfehler (z. B. 225 statt 22,5) treibt so nichts hoch.',
    confirmButton: 'Ja, stimmt so',
    checkReps: 'Tippfehler? Bitte prüfe die Wiederholungen.',
    confirmNeeded: 'Bitte bestätige zuerst die markierten Gewichte.',
    // Menü
    skip: 'Nicht gemacht',
    unskip: 'Doch gemacht',
    alternative: 'Alternative durchgeführt',
    alternativeTitle: 'Welche Übung hast du gemacht?',
    alternativeNone: 'Für diese Übung gibt es gerade keine passende Alternative.',
    backToPlanned: (name: string) => `Doch „${name}“ gemacht`,
    startWeight: 'Eigenes Startgewicht',
    startWeightLabel: 'Startgewicht in kg',
    startWeightHint: 'Gilt nur, solange du diese Übung noch nicht eingetragen hast.',
    startWeightSave: 'Startgewicht übernehmen',
    startWeightInvalid: 'Bitte ein Gewicht zwischen 0,5 und 500 kg eingeben.',
    startWeightConfirm: 'Das ist ungewöhnlich schwer. Stimmt das Gewicht?',
    startWeightConfirmButton: 'Ja, übernehmen',
    // Abschluss
    finishTitle: 'Training beenden',
    effortLabel: 'Wie anstrengend war das Training insgesamt?',
    effortValue: (value: number, word: string) => `${value} – ${word}`,
    effortWords: [
      'Ruhe',
      'sehr leicht',
      'leicht',
      'locker',
      'mäßig',
      'mittel',
      'etwas schwer',
      'schwer',
      'sehr schwer',
      'extrem schwer',
      'maximal',
    ],
    effortUnset: 'Noch nicht gewählt',
    effortSkip: 'Ohne Angabe',
    notesLabel: 'Notiz (optional)',
    notesHint:
      'Für Technik, Einstellungen, Gefühl – bitte keine Angaben zu Krankheiten oder Beschwerden.',
    notesCount: (used: number, max: number) => `${used} von ${max} Zeichen`,
    notesTooLong: (max: number) => `Höchstens ${max} Zeichen.`,
    save: 'Training speichern',
    saveChanges: 'Änderungen speichern',
    discard: 'Training verwerfen',
    discardTitle: 'Training verwerfen?',
    discardText: 'Alle Einträge dieser Einheit auf diesem Gerät gehen verloren.',
    discardConfirm: 'Verwerfen',
    invalid: 'Das Training enthält ungültige Werte. Bitte prüfe deine Eingaben.',
    // Ergebnisse
    saved: 'Training gespeichert. Stark!',
    queued:
      'Noch nicht übertragen – dein Training liegt sicher auf dem Gerät und wird später gesendet.',
    queuedBrowser:
      'Noch nicht übertragen – dein Training wird gesendet, sobald es geht. Lass diesen Tab bis dahin offen.',
    draftSaveFailed:
      'Dein Zwischenstand konnte auf diesem Gerät nicht gesichert werden. Bitte speichere das Training mit Verbindung.',
    weightInput: 'Gewicht eingeben',
    weightInputLabel: 'Gewicht in kg (für alle offenen Sätze)',
    weightInputApply: 'Übernehmen',
    weightInputInvalid: 'Bitte ein Gewicht zwischen 0 und 500 kg eingeben.',
    orphaned: 'Dein Plan hat sich geändert – dein Training wurde trotzdem gespeichert.',
    conflictTitle: 'Diese Einheit wurde auf einem anderen Gerät geändert.',
    conflictKeep: 'Meine Fassung behalten',
    conflictTakeOther: 'Andere übernehmen',
    rejectedTitle: (date: string) =>
      `Dein Training vom ${date} konnte nicht gespeichert werden – bitte prüfen.`,
    rejected: {
      day_taken: 'An diesem Tag ist schon eine Einheit eingetragen.',
      date_window: 'Das Datum liegt außerhalb des erlaubten Zeitraums.',
      daily_limit: 'Heute wurden schon zu viele Trainings gespeichert.',
      invalid: 'Ungültige Werte im Tagebuch.',
      not_transferred:
        'Dieses Training ließ sich nach mehreren Versuchen nicht übertragen. Es liegt als Entwurf vor – bitte bald erneut speichern: Einträge gehen nur bis 14 Tage nach dem Training.',
    },
    open: 'Öffnen',
    retry: 'Erneut versuchen',
    // Entwurf gefunden
    draftTitle: (date: string) => `Du hast ein Training vom ${date} nicht beendet`,
    draftText: 'Fortsetzen, speichern oder verwerfen?',
    draftContinue: 'Fortsetzen',
    draftSave: 'Speichern',
    draftDiscard: 'Verwerfen',
    // Pausentimer (5.5, 6.1)
    rest: {
      label: 'Pause',
      remainingA11y: (minutes: number, seconds: number) =>
        minutes > 0
          ? `Pause, noch ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'} ${seconds} Sekunden`
          : `Pause, noch ${seconds} Sekunden`,
      minus: '−15 s',
      plus: '+15 s',
      minusA11y: 'Pause 15 Sekunden kürzer',
      plusA11y: 'Pause 15 Sekunden länger',
      skip: 'Überspringen',
      skipA11y: 'Pause überspringen',
      over: 'Pause vorbei – weiter geht’s!',
      close: 'Weiter',
    },
    // Ausdauer-Eintrag (6.1 Punkt 3)
    cardio: {
      title: 'Ausdauer eintragen',
      intro: 'Trag ein, was du tatsächlich gemacht hast.',
      planned: (minutes: number) => `Geplant: ${minutes} Minuten`,
      modality: 'Was hast du gemacht?',
      modalities: { run: 'Laufen', walk: 'Gehen', bike: 'Rad', swim: 'Schwimmen' },
      duration: 'Dauer (Pflicht)',
      hours: 'Stunden',
      minutes: 'Minuten',
      distance: 'Distanz in km (optional)',
      distanceHint: 'Mit Komma, z. B. 5,2',
      elevation: 'Höhenmeter (optional)',
      paceKm: (pace: string) => `Pace: ${pace} min/km`,
      pace100: (pace: string) => `Pace: ${pace} min/100 m`,
      speed: (kmh: string) => `Geschwindigkeit: ${kmh} km/h`,
      paceKmA11y: (minutes: number, seconds: number) =>
        `Pace: ${minutes} Minuten ${seconds} Sekunden pro Kilometer`,
      pace100A11y: (minutes: number, seconds: number) =>
        `Pace: ${minutes} Minuten ${seconds} Sekunden pro 100 Meter`,
      speedA11y: (kmh: string) => `Geschwindigkeit: ${kmh} Kilometer pro Stunde`,
      noDistance: 'Mit Distanz rechnen wir dir Pace bzw. Geschwindigkeit aus.',
      checkSpeed: 'Bitte prüfen: Das ist sehr schnell für diese Art. Stimmen Dauer und Distanz?',
      errors: {
        duration_missing: 'Bitte gib die Dauer an.',
        duration_invalid: 'Bitte ganze Stunden und Minuten (0–59) eingeben.',
        duration_range: 'Die Dauer muss zwischen 1 Minute und 12 Stunden liegen.',
        distance_invalid: 'Bitte eine Distanz in km eingeben, z. B. 5,2.',
        distance_range: 'Höchstens 500 km.',
        elevation_invalid: 'Bitte ganze Höhenmeter eingeben.',
        elevation_range: 'Höchstens 10.000 Höhenmeter.',
      },
      invalid: 'Bitte prüfe die markierten Angaben.',
      effortLabel: 'Wie anstrengend war es? (Anstrengung 0–10)',
      talkTestIntro: 'Gesprächstest: Wie gut konntest du dabei noch sprechen?',
      talkTest: {
        rest: 'Ruhe – ganz ohne Anstrengung.',
        full_sentences: 'Du konntest dich noch in ganzen Sätzen unterhalten.',
        short_sentences: 'Nur noch kurze Sätze gingen.',
        few_words: 'Nur noch einzelne Wörter gingen.',
        no_talking: 'Sprechen war kaum möglich.',
      },
    },
  },
  /** Wochenansicht (docs/PLAN-PHASE-4.md 6.1 Punkt 4, Etappe D). */
  week: {
    title: 'Woche',
    range: (from: string, to: string) => `${from} bis ${to}`,
    previous: '‹ Vorwoche',
    next: 'Nächste Woche ›',
    previousA11y: 'Vorherige Woche anzeigen',
    nextA11y: 'Nächste Woche anzeigen',
    current: 'Diese Woche',
    // Status immer mit Zeichen UND Wort (nie nur Farbe, 6.4).
    status: {
      done: '✓ Erledigt',
      partial: '◐ Teilweise erledigt',
      missed: '! Verpasst',
      skipped: '– Gestrichen',
      planned: '○ Geplant',
      dropped: '× Entfallen',
      rest: 'Ruhetag',
    },
    droppedHint: 'gehört zu einem früheren Plan',
    caughtUpFrom: (date: string) => `nachgeholt vom ${date}`,
    pending: 'wird noch übertragen',
    open: 'Ansehen',
    summaryTitle: 'Summen der Woche',
    sessions: (done: number, planned: number) => `Einheiten: ${done} geschafft, ${planned} geplant`,
    sets: (count: number) => (count === 1 ? 'Kraft: 1 Satz' : `Kraft: ${count} Sätze`),
    endurance: (minutes: number, km: string) => `Ausdauer: ${minutes} min, ${km} km`,
    enduranceA11y: (minutes: number, km: string) => `Ausdauer: ${minutes} Minuten, ${km} Kilometer`,
    olderHint: 'Ältere Wochen findest du im Verlauf.',
    empty: 'In dieser Woche ist nichts geplant und nichts eingetragen.',
    back: 'Zurück zu Heute',
  },
  /** Verlauf (6.1 Punkt 5, Etappe D). */
  history: {
    title: 'Verlauf',
    intro: 'Deine Trainings nach Wochen – antippen zum Ansehen, Ändern oder Löschen.',
    empty: 'Noch keine Einträge – dein erstes Training erscheint hier.',
    weekOf: (date: string) => `Woche ab ${date}`,
    completed: 'vollständig',
    partial: 'teilweise',
    sets: (count: number) => (count === 1 ? '1 Satz' : `${count} Sätze`),
    endurance: (minutes: number, km: string | null) =>
      km === null ? `${minutes} min` : `${minutes} min · ${km} km`,
    enduranceA11y: (minutes: number, km: string | null) =>
      km === null ? `${minutes} Minuten` : `${minutes} Minuten, ${km} Kilometer`,
    pending: 'wird noch übertragen',
    showMore: 'Weitere anzeigen',
    loadOlder: 'Ältere Einträge laden',
    loadingOlder: 'Ältere Einträge werden geladen …',
    noOlder: 'Es gibt keine älteren Einträge.',
    exercisesTitle: 'Verlauf je Übung',
    exerciseCount: (count: number) => (count === 1 ? '1 Eintrag' : `${count} Einträge`),
    exerciseEmpty: 'Zu dieser Übung gibt es noch keine Einträge.',
    exerciseIntro: 'Je Training der beste Satz.',
    best: {
      weight: (kg: string, reps: number) => `${kg} kg × ${reps}`,
      weightA11y: (kg: string, reps: number) => `${kg} Kilogramm mal ${reps} Wiederholungen`,
      time: (seconds: number) => `${seconds} Sekunden gehalten`,
      reps: (reps: number) => `${reps} Wiederholungen`,
      none: 'kein Satz abgehakt',
    },
    setsDone: (count: number) => (count === 1 ? '1 Satz abgehakt' : `${count} Sätze abgehakt`),
    back: 'Zurück',
  },
  /** Ein Eintrag im Verlauf: ansehen, ändern, löschen (Etappe D). */
  logEntry: {
    title: 'Eintrag',
    notFound: 'Diesen Eintrag gibt es nicht (mehr).',
    performedOn: (date: string) => `Trainiert am ${date}`,
    caughtUpFrom: (date: string) => `Nachgeholt vom ${date}`,
    completed: 'Vollständig erledigt',
    partial: 'Teilweise erledigt',
    effort: (value: number, word: string) => `Belastung: ${value} – ${word}`,
    notes: 'Notiz',
    skipped: 'Nicht gemacht',
    alternative: 'Alternative durchgeführt',
    setWeight: (no: number, kg: string, reps: number | null) =>
      `Satz ${no}: ${kg} kg × ${reps ?? 0}`,
    setWeightA11y: (no: number, kg: string, reps: number | null) =>
      `Satz ${no}: ${kg} Kilogramm mal ${reps ?? 0} Wiederholungen`,
    setReps: (no: number, reps: number | null) => `Satz ${no}: ${reps ?? 0} Wiederholungen`,
    setTime: (no: number, seconds: number | null) => `Satz ${no}: ${seconds ?? 0} Sekunden`,
    setOpen: 'nicht abgehakt',
    modality: (name: string) => `Art: ${name}`,
    duration: (text: string) => `Dauer: ${text}`,
    durationA11y: (hours: number, minutes: number) =>
      hours > 0
        ? `Dauer: ${hours} ${hours === 1 ? 'Stunde' : 'Stunden'} ${minutes} Minuten`
        : `Dauer: ${minutes} Minuten`,
    distance: (km: string) => `Distanz: ${km} km`,
    distanceA11y: (km: string) => `Distanz: ${km} Kilometer`,
    elevation: (m: number) => `Höhenmeter: ${m}`,
    exerciseHistory: 'Verlauf dieser Übung',
    exerciseHistoryA11y: (name: string) => `Verlauf: ${name}`,
    edit: 'Ändern',
    delete: 'Eintrag löschen',
    deleteTitle: 'Eintrag löschen?',
    deleteText:
      'Der Eintrag wird endgültig gelöscht – auf allen Geräten. Die Einheit gilt danach wieder als offen bzw. verpasst.',
    deleteConfirm: 'Endgültig löschen',
    deleted: 'Eintrag gelöscht.',
    deleteConflict:
      'Dieser Eintrag wurde inzwischen auf einem anderen Gerät geändert. Wir haben neu geladen – bitte prüfe ihn und lösche ihn dann erneut.',
    onlineOnly: 'Löschen geht nur mit Verbindung.',
    pendingNoDelete: 'Noch nicht übertragen – Löschen geht, sobald der Eintrag übertragen ist.',
    draftOpen:
      'Zu diesem Training gibt es einen offenen Entwurf – bitte zuerst auf „Heute“ speichern oder verwerfen.',
    editUnlinked:
      'Ändern geht nicht mehr: Die Einheit gehört zu einem früheren Plan. Löschen geht weiterhin.',
    editTooOld: 'Ändern geht nur bis 14 Tage nach dem Training. Löschen geht weiterhin.',
    back: 'Zurück zum Verlauf',
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
      'Der Widerruf löscht alle Körper- und Gesundheitsdaten: Körperdaten, Körperumfänge, alle Gesundheits-Checks, Unverträglichkeiten und alle Trainingspläne, die auf dem Gesundheits-Check beruhen. Deine übrigen Angaben bleiben erhalten.',
    revokeDone: 'Einwilligung widerrufen. Deine Gesundheitsdaten wurden gelöscht.',
    revokeLogs:
      'Dein Tagebuch bleibt; Vorgaben aus dem Gesundheits-Check werden daraus entfernt. Du kannst die Einträge aus Plänen mit Gesundheits-Check aber auch löschen.',
    revokeKeepLogs: 'Tagebuch behalten (empfohlen)',
    revokeDeleteLogs: 'Einträge aus Plänen mit Gesundheits-Check auch löschen',
    revokeOtherDevices:
      'Öffne die App auf deinen anderen Geräten vorher einmal mit Verbindung – noch nicht übertragene Trainings von dort werden sonst ohne Vorgaben gespeichert.',
    revokeEarlier:
      'Einträge aus früheren Widerrufen sind schon ohne Vorgaben und werden nicht mehr erkannt – sie bleiben erhalten.',
    revokeLogsNote:
      'Bei einem Widerruf bleibt dein Tagebuch; Vorgaben aus dem Gesundheits-Check werden daraus entfernt.',
    signOutPendingTitle: 'Noch nicht übertragen',
    signOutPending: (count: number) =>
      count === 1
        ? '1 Training ist noch nicht übertragen.'
        : `${count} Trainings sind noch nicht übertragen.`,
    signOutSendNow: 'Jetzt senden',
    signOutAnyway: 'Trotzdem abmelden (gehen verloren)',
    signOutStillPending:
      'Es ist immer noch nicht alles übertragen (offline, Konflikt oder abgelehnt). Bitte prüfe es auf „Heute“ oder melde dich trotzdem ab.',
    foreignTitle: 'Einträge eines anderen Kontos',
    foreignText: 'Auf diesem Gerät liegen Einträge eines anderen Kontos – löschen?',
    foreignConfirm: 'Löschen',
    sessionExpired: 'Bitte melde dich erneut an – deine Einträge bleiben erhalten.',
    baseConsentNote:
      'Nutzungsbedingungen und Datenschutzerklärung sind Voraussetzung für die Nutzung. Wenn du nicht mehr einverstanden bist, lösche bitte dein Konto.',
    screen: 'Bildschirm',
    keepAwake: 'Bildschirm im Training anlassen',
    keepAwakeHint:
      'Solange du ein Training einträgst, geht der Bildschirm nicht aus. Kostet etwas Akku; im Browser nur, wo es unterstützt wird.',
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
    training: 'Training',
    trainingText: 'Ändere deine Angaben oder erstelle deinen Plan neu.',
    editInputs: 'Angaben ändern',
    repeatScreening: 'Gesundheits-Check wiederholen',
    repeatScreeningNeedsConsent:
      'Den Gesundheits-Check kannst du nur mit Einwilligung Gesundheitsdaten wiederholen.',
    recreatePlan: 'Plan neu erstellen',
    planCreated: 'Dein neuer Plan ist fertig.',
    // Datenexport (Recht auf Auskunft, 3.7, Etappe D)
    exportTitle: 'Meine Daten',
    exportText:
      'Speichere alle deine Daten als Datei (JSON): Profil, Einwilligungen samt Verlauf, Körper- und Gesundheitsdaten, Pläne, Tagebuch und Startgewichte.',
    exportButton: 'Meine Daten exportieren',
    exportDialogTitle: 'Daten exportieren?',
    exportDialogText:
      'Diese Datei enthält Gesundheitsdaten – gib sie nur weiter, wenn du das willst.',
    exportWhereWeb: 'Die Datei landet in deinem Download-Ordner.',
    exportWhereNative: 'Du wählst gleich einen Ordner, z. B. „Dateien“ oder „Downloads“.',
    exportConfirmWeb: 'Datei herunterladen',
    exportConfirmNative: 'Ordner wählen und speichern',
    exportPending: (count: number) =>
      count === 1
        ? '1 Training ist noch nicht übertragen und fehlt in der Datei.'
        : `${count} Trainings sind noch nicht übertragen und fehlen in der Datei.`,
    exportTestMode: 'Testmodus: Die Datei enthält die Angaben auf diesem Gerät (ohne E-Mail).',
    exportSavedWeb: 'Die Datei wurde heruntergeladen.',
    exportSavedNative: 'Die Datei wurde gespeichert.',
    exportCancelled: 'Export abgebrochen – es wurde nichts gespeichert.',
    exportFailed: 'Die Datei konnte nicht gespeichert werden. Bitte versuche es erneut.',
  },
  /** Trainingsplan als PDF (docs/PLAN-PDF-EXPORT.md) – Texte zu den Codes aus packages/core/src/export. */
  print: {
    docTitle: 'Trainingsplan',
    footer: 'Alpha5 ersetzt keine ärztliche Beratung.',
    logoLabel: 'Alpha5',
    coverHeading: 'Dein Trainingsplan',
    goalFallback: 'Trainingsplan',
    planName: (goal: string, days: string) => `${goal} · ${days}`,
    days: (count: number) => (count === 1 ? '1 Tag' : `${count} Tage`),
    daysMixed: (strength: number, endurance: number) =>
      `${strength} × Kraft, ${endurance} × Ausdauer`,
    labelPeriod: 'Zeitraum',
    labelDays: 'Trainingstage',
    labelLocations: 'Ort',
    labelName: 'Für',
    labelAsOf: 'Stand',
    howTo: (columns: number, hasWeight: boolean) =>
      columns > 0
        ? `So nutzt du den Plan: Je Einheit gibt es eine Seite mit deinen Übungen. In ${columns === 1 ? 'die leere Spalte „1.“' : `die leeren Spalten „1.“ bis „${columns}.“`} trägst du nach jedem Training ${hasWeight ? 'Gewicht und Wiederholungen ein, z. B. „20 × 10“' : 'deine Wiederholungen bzw. Sekunden ein, z. B. „12“'}.`
        : 'So nutzt du den Plan: Je Einheit gibt es eine Seite mit deinen Übungen.',
    medicalTitle: 'Vor dem Training',
    medical:
      'Bitte kläre vor Trainingsbeginn ärztlich ab, ob das Training für dich passt. Alpha5 ersetzt keine ärztliche Beratung.',
    dateRange: (from: string, to: string) => `${from} – ${to}`,
    weekDates: (from: string, to: string) => `${from}–${to}`,
    trainingDays: (count: number, days: string) =>
      days ? `${count} pro Woche (${days})` : `${count} pro Woche`,
    locations: { gym: 'Studio', home: 'Zuhause' },
    enduranceLocation: 'Ausdauer',
    weekHeading: 'Wochenübersicht',
    weekColumn: 'Woche',
    week0: 'Woche 0 (Reinschnuppern)',
    week: (no: number) => `Woche ${no}`,
    introSuffix: 'Einstieg',
    deloadSuffix: 'Erholung',
    legendBase: 'Ruhetag: Lockere Bewegung wie Spazierengehen tut gut.',
    legendIntro:
      'Einstieg: Wähle Gewichte, mit denen du alle Wiederholungen sauber schaffst und noch etwa 3 übrig hättest.',
    legendIntroNoWeight:
      'Einstieg: Wähle eine Ausführung, bei der du alle Wiederholungen sauber schaffst und noch etwa 3 übrig hättest.',
    legendDeload: 'Erholungswoche: weniger Sätze und etwas leichter – danach wirst du stärker.',
    legendDeloadNoWeight:
      'Erholungswoche: weniger Sätze und etwas lockerer – danach wirst du stärker.',
    rest: 'Ruhetag',
    skipped: 'entfällt',
    modalities: { run: 'Laufen', walk: 'Gehen', bike: 'Rad', swim: 'Schwimmen' },
    modalityFallback: 'Ausdauer',
    minutes: (minutes: number) => `${minutes} min`,
    aboutMinutes: (minutes: number) => `ca. ${minutes} Minuten`,
    sessionDays: 'Tage',
    sessionLocation: 'Ort',
    sessionDuration: 'Dauer',
    daysFree: 'frei wählbar',
    warmup: 'Aufwärmen',
    cooldown: 'Cool-down',
    exercisesCaption: (session: string) => `Übungen – ${session}`,
    continued: (session: string) => `${session} (Fortsetzung)`,
    weightHint:
      'Gewicht: deine aktuelle Vorgabe aus der App. Leer = Startgewicht finden – lieber zu leicht als zu schwer. RPE = Anstrengung von 10 (RPE 7 = noch etwa 3 Wiederholungen in Reserve).',
    rpeHint: 'RPE = Anstrengung von 10 (RPE 7 = noch etwa 3 Wiederholungen in Reserve).',
    noExercises:
      'Für diese Einheit zeigen wir gerade keine Übungen. Bitte erstelle deinen Plan in der App neu.',
    loadBodyweight: 'Körper\u00ADgewicht', // bedingter Trennstrich: bricht in der schmalen Gewichtsspalte sauber um
    loadBand: 'Band',
    loadNone: '–',
    columns: {
      exercise: 'Übung',
      sets: 'Sätze',
      reps: 'Wdh. / Dauer',
      rpe: 'RPE',
      rest: 'Pause',
      weight: 'Gewicht',
      log: (no: number) => `${no}.`,
      date: 'Datum',
      week: 'Woche',
      activity: 'Einheit',
      minutes: 'Minuten',
      effort: 'Anstrengung',
    },
    equipmentSwap: 'ersetzt (Gerät fehlt)',
    superset: (group: string) => `Supersatz ${group}`,
    seconds: (seconds: number) => `${seconds} s`,
    restMinutes: (minutes: string) => `${minutes} min`,
    kg: (kg: string) => `${kg} kg`,
    effort: (effort: number, word: string) => `${effort} von 10 – ${word}`,
    effortWords: ['sehr leicht', 'locker', 'mittel', 'anstrengend', 'sehr anstrengend'],
    enduranceHeading: 'Ausdauer-Einheiten',
    effortHint:
      'Anstrengung von 0 bis 10: Bei lockeren Einheiten kannst du dich noch in ganzen Sätzen unterhalten.',
    notesHeading: 'Gut zu wissen',
  },
  /** Plan als PDF: Knopf, Hinweis, Druckansicht (docs/PLAN-PDF-EXPORT.md §3, §4, P3/P4). */
  printView: {
    button: 'Als PDF speichern',
    buttonHint: 'Öffnet die Druckansicht deines Trainingsplans.',
    title: 'Plan als PDF',
    intro:
      'Dein Trainingsplan auf A4 – zum Ausdrucken oder fürs Studio. Die Datei entsteht nur auf deinem Gerät.',
    healthTitle: 'Bevor du speicherst',
    healthText:
      'Dieser Plan berücksichtigt deine Gesundheitsangaben. Speichere oder drucke die Datei nur bewusst.',
    healthConfirm: 'Weiter',
    loading: 'Druckansicht wird vorbereitet …',
    printing: 'Druckdialog wird geöffnet …',
    optionsTitle: 'Einstellungen',
    includeName: 'Meinen Namen auf das Deckblatt drucken',
    nameLabel: 'Name auf dem Deckblatt',
    nameHint: 'Wird nicht gespeichert und erscheint nur im PDF.',
    nameMissing: 'Bitte gib einen Namen ein oder lass das Häkchen weg.',
    nameTooLong: (max: number) => `Bitte höchstens ${max} Zeichen.`,
    nameInvalid:
      'Bitte nur Buchstaben, Zahlen und einfache Satzzeichen. Zusammengesetzte Emoji (z. B. 👩‍💻) und unsichtbare Sonderzeichen gehen leider nicht.',
    columnsLabel: 'Leere Spalten zum Mitschreiben',
    columnsNone: 'Keine',
    columnsCount: (count: number) => (count === 1 ? '1 Spalte' : `${count} Spalten`),
    columnsDefault: 'Standard',
    columnsLandscape: (count: number) => `${count} Spalten im Querformat`,
    columnsLandscapeHint: 'Die Seiten der Einheiten werden quer gedruckt.',
    printButton: 'Drucken / als PDF sichern',
    printHintWeb:
      'Tippe auf „Drucken / als PDF sichern“. Android: Drucker „Als PDF speichern“ wählen. iPhone: in den Druckoptionen oben auf das Teilen-Symbol, dann „In Dateien sichern“.',
    printHintNative:
      'Tippe auf „Drucken / als PDF sichern“. Im Druckdialog kannst du drucken oder „Als PDF sichern“ wählen.',
    previewTitle: 'Vorschau',
    previewLabel: 'Vorschau deines Trainingsplans',
    back: 'Zurück zum Plan',
    noPlanTitle: 'Noch kein Plan',
    noPlanText: 'Erstelle zuerst deinen Trainingsplan – dann kannst du ihn als PDF speichern.',
    libraryMissing:
      'Die Übungen konnten gerade nicht geladen werden. Prüfe deine Verbindung und versuche es noch einmal.',
    noSessions: 'In deinem Plan gibt es gerade keine Einheiten zum Drucken.',
    rulesMissing:
      'Deine Angaben sind gerade nicht vollständig. Bitte prüfe sie in den Einstellungen – danach kannst du den Plan speichern.',
    failed: 'Das hat leider nicht geklappt. Bitte versuche es noch einmal.',
    cancelled: 'Drucken abgebrochen – es wurde nichts gespeichert.',
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
