/**
 * Texte des Supplement-Bereichs (docs/PLAN-PHASE-6.md 8, Etappe SU4). Alle Texte über Supplemente gehen durch die
 * Textregeln aus packages/core (`checkSupplementText`, Test de-supplements.test.ts): keine Heilversprechen, keine
 * Wirkaussagen, keine Zahlen im Freitext (Mengen, Alter und Uhrzeiten füllt der Core über Platzhalter).
 * Ausnahme ist nur `consent` (Datenschutz-Wortlaut „Einwilligung Gesundheitsdaten“ wie im Rest der App, keine Aussage
 * über ein Supplement) – auch dort keine Zahlen.
 */
export const deSupplements = {
  title: 'Supplemente',
  /** Knopf in „Ernährung“ und Kachel unter „Mehr → Essen“. */
  open: 'Supplemente',
  moreDetail: 'gute Studienlage',
  intro:
    'Zuerst kommt das Essen. Hier findest du Nahrungsergänzungen mit guter Studienlage – und welche davon zu deinen Angaben passen.',
  disclaimerTitle: 'Bitte lesen',
  disclaimer:
    'Allgemeine Fitness-Informationen, keine ärztliche Beratung und kein Befund. Wir nennen Stoffe, keine Marken und keine Produkte. Shops und Werbung gibt es hier nicht.',
  loading: 'Supplemente werden geladen …',
  loadFailed: 'Die Supplemente konnten nicht geladen werden.',
  empty: 'Kommt bald: Die Texte zu den Supplementen folgen.',
  cached: 'Offline: gespeicherte Texte.',
  incomplete:
    'Für die Supplemente brauchen wir deine Angaben aus der Einrichtung (Ziel und Erfahrung). Bitte schließe die Einrichtung ab.',
  rulesFailed:
    'Die Einordnung konnte gerade nicht berechnet werden. Du siehst allgemeine Informationen.',
  general: 'Allgemeine Informationen – ohne persönliche Einordnung.',
  groups: {
    recommended: 'Passt zu dir',
    info: 'Zur Info',
    adult_only: (age: string) => `Ab ${age} Jahren`,
    excluded: 'Nicht für dich – bitte ärztlich abklären',
    caffeine: 'Koffein: Was du wissen solltest',
    notRecommended: 'Nicht empfohlen',
  },
  groupHints: {
    recommended: 'Passt zu deinen Angaben – mit Menge und Zeitpunkt.',
    info: 'Ohne persönliche Menge. Vitamin D nur mit allgemeinem Richtwert.',
    adult_only: 'Diese Ergänzungen sind erst für Erwachsene gedacht.',
    excluded: 'Bei deinen Angaben empfehlen wir das nicht ohne ärztliche Rücksprache.',
    caffeine: 'Keine Empfehlung – nur sichere Grenzen für Kaffee, Tee, Cola und Energydrinks.',
    notRecommended: 'Für diese Mittel reicht die Studienlage nicht für eine Empfehlung.',
  },
  showNotRecommended: 'Liste „Nicht empfohlen“ anzeigen',
  hideNotRecommended: 'Liste „Nicht empfohlen“ ausblenden',
  evidence: {
    a: 'Gute Studienlage',
    b: 'Begrenzte Studienlage',
    c: 'Studienlage reicht nicht aus',
  },
  status: {
    recommended: 'Passt zu dir',
    info_only: 'Zur Info',
    adult_only: (age: string) => `Ab ${age} Jahren`,
    excluded: 'Nicht für dich',
  },
  /** Symbol + Text (Farbe nie als einziges Signal). */
  statusIcon: {
    recommended: '✓',
    info_only: 'i',
    adult_only: '–',
    excluded: '!',
  },
  categories: {
    sport: 'Sport',
    food: 'Lebensmittel',
    diet_season: 'Ergänzung bei bestimmter Ernährung oder Jahreszeit',
    safety_info: 'Sicherheits-Info',
  },
  timing: {
    daily_with_meal: 'Täglich zu einer Mahlzeit',
    after_training: 'Nach dem Training',
    before_training: 'Vor dem Training',
    before_sleep: 'Vor dem Schlafen',
  },
  dose: (dose: string) => `Menge: ${dose}`,
  doseGeneral: (dose: string) => `Allgemeiner Richtwert: ${dose} am Tag`,
  dosePerDay: (dose: string) => `Menge: ${dose} am Tag`,
  dosePerServing: (dose: string) => `Menge: eine Portion mit ${dose} Eiweiß`,
  taking: 'Nehme ich',
  declined: 'Nicht für mich',
  caffeineStatus: {
    safety_info: 'Sicherheits-Info',
    safety_info_adult_only: (age: string) => `Ab ${age} Jahren`,
    safety_info_excluded: 'Vorher ärztlich abklären',
  },
  mine: {
    title: 'Meine Supplements',
    empty: 'Du hast noch nichts als „Nehme ich“ markiert.',
    outdated: 'Passt laut deinen aktuellen Angaben nicht mehr:',
  },
  check: {
    title: 'Supplement-Check',
    cardTitle: 'Supplement-Check machen',
    cardText:
      'Ein paar kurze Fragen ergänzen deinen Gesundheits-Check. Erst dann können wir sagen, was zu dir passt.',
    start: 'Check machen',
    redo: 'Supplement-Check ändern',
    intro:
      'Mit den Antworten blenden wir Supplemente aus, die bei deinen Angaben nicht passen. Das ist kein ärztlicher Befund. Du kannst die Antworten jederzeit ändern oder löschen.',
    yes: 'Ja',
    no: 'Nein',
    proteinTitle: 'Freiwillig',
    proteinYes: 'Meist ja',
    proteinNo: 'Eher nicht',
    proteinSkip: 'Keine Angabe',
    save: 'Antworten speichern',
    missing: 'Bitte beantworte jede Frage mit Ja oder Nein.',
    healthCheckFirst:
      'Bitte mach zuerst den Gesundheits-Check – der Supplement-Check ergänzt ihn nur.',
    healthCheckOpen: 'Gesundheits-Check öffnen',
    delete: 'Supplement-Check und „Meine Supplements“ löschen',
    deleted: 'Gelöscht.',
  },
  detail: {
    back: 'Zurück',
    notFound: 'Dieses Supplement gibt es nicht (mehr).',
    howTo: 'Anwendung',
    timing: 'Zeitpunkt',
    claim: 'Zugelassene Angabe',
    notices: 'Hinweise',
    mandatory: 'Bitte beachten',
    reason: 'Warum wir es nicht empfehlen',
    sources: 'Quellen',
    showSources: 'Quellen anzeigen',
    hideSources: 'Quellen ausblenden',
    noDose: 'Menge und Zeitpunkt zeigen wir nur, wenn es zu deinen Angaben passt.',
    take: 'Nehme ich',
    decline: 'Nicht für mich',
    remove: 'Auswahl entfernen',
    chosenTaking: 'Gespeichert: Nehme ich',
    chosenDeclined: 'Gespeichert: Nicht für mich',
    choiceOutdated:
      'Du hast „Nehme ich“ gewählt, aber laut deinen aktuellen Angaben passt es nicht mehr. Bitte ärztlich abklären.',
    choiceNeedsCheck: 'Speichern geht nach dem Supplement-Check.',
  },
  errors: {
    offline:
      'Offline: Für deine persönliche Einordnung brauchen wir eine Verbindung. Du siehst allgemeine Informationen.',
    userData:
      'Deine Supplement-Angaben konnten nicht geladen werden. Du siehst allgemeine Informationen.',
    save: 'Speichern hat nicht geklappt. Bitte versuche es noch einmal.',
    saveOffline: 'Speichern geht nur mit Verbindung.',
  },
  /** Datenschutz-Wortlaut (siehe Kopfkommentar). */
  consent: {
    noneTitle: 'Persönliche Einordnung',
    none: 'Für eine persönliche Einordnung brauchen wir deine Einwilligung Gesundheitsdaten. Ohne sie siehst du allgemeine Informationen.',
    grant: 'Einwilligung ansehen',
    outdatedTitle: 'Wir haben die Einwilligung zu Gesundheitsdaten ergänzt',
    outdated:
      'Neu dazu kommen der Supplement-Check und „Meine Supplements“. Es wird nichts gelöscht. Bis du zustimmst, siehst du hier nur allgemeine Informationen und kannst keine Gesundheitsdaten ergänzen.',
    reconsent: 'Neuen Text lesen und zustimmen',
    pending:
      'Die persönliche Einordnung ist noch nicht verfügbar – sie braucht eine ergänzte Einwilligung Gesundheitsdaten. Bis dahin siehst du allgemeine Informationen.',
  },
  testTools: {
    title: 'Testmodus',
    oldConsent: 'Test: Einwilligung nur alte Fassung',
    oldConsentDone: 'Die Einwilligung steht jetzt auf der alten Fassung.',
  },
} as const;
