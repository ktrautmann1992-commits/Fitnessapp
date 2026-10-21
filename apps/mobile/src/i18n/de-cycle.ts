/**
 * Texte der Zyklus-Bildschirme (docs/PLAN-PHASE-9.md 9.1–9.4). Fachliche Textbausteine (Status, Beschwerden,
 * Warnungen, Hinweise, Pflichtsatz) kommen aus packages/core/src/cycle/texts-de.ts. Eigene Datei, damit i18n/de.ts
 * unberührt bleibt. Kurze Sätze, „du“, neutral. Auf „Heute“ steht kein Zyklus-Wort (K7).
 */
export const deCycle = {
  title: 'Zyklus',
  moreLabel: 'Zyklus',
  moreDescription: 'Tages-Check, Hinweise – privat und verschlüsselt',
  moreDescriptionManage: 'Daten verwalten, exportieren oder löschen',
  intro: {
    title: 'Zyklus-Modul',
    privacy:
      'Deine Angaben bleiben privat: zusätzlich verschlüsselt, nie im Partner-Modus, nie im PDF, nie an KI-Dienste.',
    consentCheckbox:
      'Ich willige in die Verarbeitung meiner Zyklusdaten wie im Einwilligungstext beschrieben ein.',
    readConsent: 'Einwilligungstext lesen',
    consentRequired: 'Bitte stimme der Einwilligung zu, um das Modul einzuschalten.',
    start: 'Modul einschalten',
    closed:
      'Das Zyklus-Modul ist für dein Konto noch nicht freigeschaltet. Es ist derzeit nur für eingeladene Testerinnen und Tester verfügbar.',
  },
  setup: {
    title: 'Einrichten',
    statusLabel: 'Was trifft auf dich zu?',
    lastPeriodLabel: 'Wann war deine letzte Periode?',
    sleepLabel: 'Schlaf im Tages-Check erfassen',
    sleepHint: 'Optional. Standard: aus.',
    save: 'Fertig',
    statusRequired: 'Bitte wähle eine Option.',
  },
  check: {
    title: 'Wie geht’s dir heute?',
    titleFor: (date: string) => `Tages-Check vom ${date}`,
    bleeding: 'Blutung',
    energy: 'Energie',
    symptoms: 'Beschwerden',
    sleep: 'Schlaf',
    savedAt: 'Gespeichert.',
    queued: 'Noch nicht gesendet – wird gesendet, sobald du wieder online bist.',
    queuedBrowser: 'Noch nicht gesendet – bitte diesen Tab nicht schließen.',
    hint: 'Alles ist freiwillig. Tippen speichert sofort.',
    noneSymptom: 'keine',
    symptomA11y: (symptom: string, intensity: string) => `${symptom}: ${intensity}`,
  },
  offer: {
    title: 'Heute leichter?',
    preview: 'So sähe deine heutige Einheit leichter aus:',
    strengthLine: (name: string, sets: number, plannedSets: number) =>
      `${name}: ${sets} statt ${plannedSets} ${plannedSets === 1 ? 'Satz' : 'Sätze'}`,
    enduranceLine: (minutes: number, planned: number) =>
      `${minutes} statt ${planned} Minuten, locker`,
    later:
      'Der Knopf „Heute leichter“ an der Trainingskarte kommt mit der Tagesform-Funktion. Bis dahin kannst du die Einheit selbst leichter angehen – nie mehr als geplant.',
  },
  hints: {
    title: 'Hinweise',
    warningsTitle: 'Wann ärztlich abklären?',
    more: 'Mehr dazu',
    less: 'Weniger',
    dismiss: 'Ausblenden',
    source:
      'Allgemeine Gesundheitsinformation ohne Krankheitsbezug. Sie stellt nichts fest und ersetzt keine ärztliche Untersuchung.',
    goalLink: 'Ziel ändern',
    longGapYes: 'Ja, keine Blutung',
    longGapNo: 'Nein, ich trage nach',
    dayOfCycle: 'Seit Periodenbeginn',
  },
  history: {
    title: 'Verlauf',
    open: 'Verlauf und Nachtragen',
    empty: 'Noch keine Einträge – fang heute an.',
    cycles: 'Vergangene Zykluslängen',
    cycleLength: (days: number) => `${days} Tage`,
    incomplete: 'unvollständig',
    noCycles: 'Noch keine abgeschlossenen Zyklen.',
    previousMonth: 'Voriger Monat',
    nextMonth: 'Nächster Monat',
    dayA11y: (date: string, text: string) => `${date}: ${text}`,
    noEntry: 'kein Eintrag',
    edit: 'Eintrag bearbeiten',
    add: 'Nachtragen',
    deleteEntry: 'Eintrag löschen',
    deleted: 'Eintrag gelöscht.',
    backfillHint: 'Nachtragen geht bis 60 Tage zurück.',
    legendBleeding: 'Punkt = Blutung',
    noPrediction: 'Keine Vorhersage, keine Phasen – nur, was du eingetragen hast.',
  },
  settings: {
    title: 'Einstellungen Zyklus',
    open: 'Einstellungen',
    status: 'Status ändern',
    pause: 'Pausieren',
    resume: 'Fortsetzen',
    paused: 'Pausiert: Tages-Check und Angebote sind aus. Deine Daten bleiben.',
    deleteAll: 'Alle Einträge löschen',
    deleteAllTitle: 'Alle Einträge löschen?',
    deleteAllMessage:
      'Alle Tages-Checks werden auf dem Server und auf diesem Gerät gelöscht. Das Modul und deine Einwilligung bleiben.',
    deletedAll: 'Alle Einträge gelöscht.',
    end: 'Modul beenden',
    endTitle: 'Zyklus-Modul beenden?',
    endMessage:
      'Alle Zyklusdaten werden gelöscht – auf dem Server und auf diesem Gerät. Deine Einwilligung wird widerrufen.',
    endNotes: [
      'Andere Geräte löschen ihre Kopie beim nächsten Öffnen der App.',
      'Trainings, die du als „leichter“ trainiert hast, bleiben im Tagebuch – ohne Grund.',
    ],
    ended: 'Zyklus-Modul beendet. Alle Zyklusdaten sind gelöscht.',
    export:
      'Deine Zyklusdaten sind im Datenexport enthalten (Mein Konto → Meine Daten exportieren).',
    reconsent: 'Neue Fassung der Einwilligung zustimmen',
    reconsentHint:
      'Es gibt eine neue Fassung des Einwilligungstexts. Bis du zustimmst, kannst du deine Daten ansehen, exportieren und löschen, aber nichts Neues eintragen.',
    testMode: 'Testmodus',
    sample: 'Zyklus-Beispieldaten laden',
    sampleLoaded: 'Beispieldaten geladen (90 Tage mit Lücken).',
    warningsOff: 'Warnungen aus (simuliert das Flag cycle_warnings)',
    testModeNotice:
      'Testmodus – Daten bleiben nur auf diesem Gerät, im Browser nur bis zum Schließen des Tabs.',
  },
  manage: {
    title: 'Zyklusdaten verwalten',
    body: 'Das Zyklus-Modul ist für dich gerade nicht aktiv. Du kannst deine gespeicherten Daten weiterhin ansehen, exportieren und löschen.',
  },
  pregnancy: {
    healthCheck: 'Gesundheits-Check öffnen',
    changeStatus: 'Status ändern',
  },
  todayCard: {
    title: 'Wie geht’s dir heute?',
    body: 'Kurzer Check in wenigen Sekunden.',
    open: 'Jetzt eintragen',
  },
  errors: {
    cycle_consent_missing: 'Bitte stimme zuerst der Einwilligung zu.',
    cycle_consent_outdated:
      'Deine Einwilligung hat sich geändert. Dieser Eintrag wurde nicht gespeichert.',
    cycle_payload_invalid: 'Diese Angabe konnte nicht gespeichert werden.',
    cycle_rate_limited: 'Heute wurde schon sehr oft gespeichert. Bitte versuch es morgen wieder.',
    cycle_module_closed: 'Das Zyklus-Modul ist für dein Konto nicht freigeschaltet.',
    network: 'Keine Verbindung. Bitte versuch es gleich noch einmal.',
    not_signed_in: 'Bitte melde dich an.',
    unknown: 'Das hat nicht geklappt. Bitte versuch es noch einmal.',
  },
  loadError: 'Zyklusdaten konnten nicht geladen werden.',
  offline: 'Offline – du siehst den zuletzt gespeicherten Stand.',
  leaveWarning: 'Es gibt noch nicht gesendete Einträge. Wirklich verlassen?',
} as const;
