/**
 * Texte für „Ausdauer“: Aufzeichnen, Meine Läufe, Auswertung je Lauf, Woche/Monat und Story-Bild (Etappen E3–E6,
 * docs/PLAN-EINKAUFEN-AUSDAUER.md). Neutral, ohne Druck, keine Serien, keine Bestzeiten (W-G16).
 */

const km = (meters: number) =>
  `${(Math.round(meters / 100) / 10).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} km`;

export const deEndurance = {
  title: 'Ausdauer',
  tile: {
    title: 'Ausdauer',
    week: (meters: number, count: number) =>
      count === 0
        ? 'Diese Woche noch keine Aktivität.'
        : `Diese Woche: ${km(meters)} · ${count} ${count === 1 ? 'Aktivität' : 'Aktivitäten'}`,
    latest: (name: string, day: string) => `Zuletzt: ${name} (${day})`,
    open: 'Zu Ausdauer',
    /** Große Zahl der Kachel (Design 20.10.2026) und Beschriftung darunter. */
    kmValue: (meters: number) => km(meters),
    statLabel: (count: number) =>
      count === 0
        ? 'diese Woche'
        : `diese Woche · ${count} ${count === 1 ? 'Aktivität' : 'Aktivitäten'}`,
    /** Ansage der Mini-Balken: „Strecke je Tag: Montag 5 km, Dienstag keine, …“. */
    barsA11y: (meters: readonly number[]) =>
      `Strecke je Tag: ${meters
        .map(
          (m, i) =>
            `${['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'][i] ?? ''} ${m > 0 ? km(m) : 'keine'}`,
        )
        .join(', ')}`,
  },
  moreEntry: 'Ausdauer: Laufen, Rad, Gehen aufzeichnen',
  sports: { run: 'Laufen', bike: 'Rad', walk: 'Gehen', swim: 'Schwimmen' },
  sportNouns: { run: 'Lauf', bike: 'Radfahrt', walk: 'Spaziergang', swim: 'Schwimmen' },
  /** E-Bike (23.10.2026): Sportart bleibt „Rad“, Auswahl „Fahrrad | E-Bike“. */
  eBike: {
    label: 'Womit fährst du?',
    bike: 'Fahrrad',
    eBike: 'E-Bike',
    hint: 'E-Bike zählt bei „Rad“ mit. Die kcal werden niedriger geschätzt (Motor hilft mit).',
    badge: 'E-Bike',
    sport: 'E-Bike',
    noun: 'E-Bike-Fahrt',
    ofWhich: (meters: number, count: number) =>
      `davon E-Bike: ${km(meters)} · ${count} ${count === 1 ? 'Fahrt' : 'Fahrten'}`,
  },
  record: {
    title: 'Aufzeichnen',
    chooseSport: 'Was zeichnest du auf?',
    start: 'Aufzeichnung starten',
    startA11y: (sport: string) => `${sport} aufzeichnen`,
    webHint:
      'Aufzeichnen mit GPS geht in der App (Android/iPhone). Im Browser stoppt der Standort, sobald der Bildschirm aus ist.',
    demoStart: 'Demo-Aufzeichnung starten (Testmodus)',
    demoHint:
      'Testmodus: Eine Beispielrunde am Rhein wird im Zeitraffer abgespielt (keine echten Standortdaten).',
    manual: 'Eintragen ohne GPS',
    manualHint: 'Dauer und Distanz selbst eintragen – z. B. Laufband oder Schwimmen.',
    resumeHint: 'Eine Aufzeichnung läuft noch.',
    resumeOpen: 'Zur laufenden Aufzeichnung',
  },
  explain: {
    title: 'Standort für die Aufzeichnung',
    text: 'Wir nutzen deinen Standort nur, während du aufzeichnest. Deine Strecken siehst nur du.',
    background:
      'Damit die Aufzeichnung bei gesperrtem Bildschirm weiterläuft, zeigt dein Handy währenddessen einen Hinweis („Aufzeichnung läuft“ bzw. den blauen Standort-Hinweis). Bitte „Beim Verwenden der App“ erlauben – „Immer“ ist nicht nötig.',
    battery:
      'Tipp: Energiesparmodus oder Akku-Optimierung können die Aufzeichnung unterbrechen. Für lange Runden Alpha5 davon ausnehmen.',
    continue: 'Weiter zur Abfrage',
    cancel: 'Abbrechen',
  },
  permission: {
    deniedTitle: 'Kein Zugriff auf den Standort',
    denied:
      'Ohne Standort kann Alpha5 keine Strecke aufzeichnen. Du kannst den Zugriff in den Einstellungen deines Handys unter „Apps“ → „Alpha5“ → „Standort“ → „Beim Verwenden der App“ erlauben.',
    openSettings: 'Einstellungen öffnen',
    retry: 'Erneut prüfen',
    servicesOff:
      'Der Standort ist auf deinem Handy ausgeschaltet. Bitte in den Einstellungen einschalten und dann erneut prüfen.',
    startFailed:
      'Die Aufzeichnung konnte nicht starten. Bitte die App im Vordergrund lassen und erneut versuchen.',
  },
  live: {
    title: (sport: string) => `${sport} – Aufzeichnung`,
    time: 'Zeit',
    distance: 'Distanz',
    pace: 'Ø-Pace',
    speed: 'Ø-Tempo',
    searching: 'Suche GPS …',
    weak: 'GPS schwach – die Strecke kann ungenau werden.',
    paused: 'Pausiert',
    running: 'Aufzeichnung läuft',
    pause: 'Pause',
    resume: 'Fortsetzen',
    stop: 'Stopp',
    stopConfirm: 'Aufzeichnung beenden?',
    stopYes: 'Ja, beenden',
    stopNo: 'Weiter aufzeichnen',
    limit: 'Die Aufzeichnung wurde nach 12 Stunden automatisch beendet.',
    demo: 'Demo im Zeitraffer (Testmodus) – keine echten Standortdaten.',
    a11yStats: (time: string, distance: string, pace: string) =>
      `Zeit ${time}, Distanz ${distance}, ${pace}`,
  },
  recover: {
    title: 'Aufzeichnung gefunden',
    text: 'Eine Aufzeichnung wurde nicht beendet (z. B. weil die App geschlossen wurde). Fortsetzen oder speichern?',
    resume: 'Fortsetzen',
    save: 'Beenden und speichern',
    discard: 'Verwerfen',
    discardConfirm: 'Aufzeichnung wirklich verwerfen? Sie lässt sich nicht wiederherstellen.',
  },
  save: {
    title: 'Aufzeichnung speichern',
    name: 'Name',
    nameHint: 'Höchstens 80 Zeichen.',
    defaultName: (sport: string, day: string) => `${sport} am ${day}`,
    favorite: 'Als Favoriten-Strecke merken',
    favoriteHint: 'Favoriten kannst du erneut laufen und deine Zeiten vergleichen.',
    difficulty: 'Schwierigkeit (optional)',
    difficulties: { easy: 'Leicht', medium: 'Mittel', hard: 'Schwer' },
    noDifficulty: 'Keine Angabe',
    note: 'Notiz (optional)',
    noteHint: 'Höchstens 280 Zeichen. Nur für dich.',
    diaryPlanned: (name: string) => `Zu „${name}“ zählen?`,
    diaryPlannedHint: 'Dann gilt die geplante Einheit von heute als erledigt.',
    diaryYes: 'Ja, zählen',
    diaryNo: 'Nein, als freie Einheit',
    diaryFree: 'Wird als freie Einheit ins Trainingstagebuch eingetragen.',
    diaryNone: 'Unter 100 m – ohne Eintrag im Trainingstagebuch.',
    submit: 'Speichern',
    discard: 'Verwerfen',
    tooShort:
      'Zu kurz zum Speichern (unter 1 Minute). Du kannst die Aufzeichnung verwerfen oder fortsetzen.',
    shortDistance:
      'Unter 100 m aufgezeichnet. Trotzdem speichern? (Ohne Eintrag im Trainingstagebuch.)',
    shortDistanceYes: 'Trotzdem speichern',
    speedWarning:
      'Bitte prüfen: Stellenweise sehr schnell (z. B. bergab oder versehentlich im Fahrzeug).',
    saved: 'Gespeichert.',
    queued: 'Gespeichert – wird übertragen, sobald du Verbindung hast.',
    failed:
      'Speichern hat nicht geklappt. Die Aufzeichnung bleibt auf diesem Gerät – bitte erneut versuchen.',
    invalid: 'Diese Aufzeichnung kann so nicht gespeichert werden (z. B. länger als 12 Stunden).',
    diaryFailed:
      'Die Strecke ist gespeichert, der Eintrag im Trainingstagebuch hat nicht geklappt. Du kannst ihn im Kalender nachtragen.',
  },
  list: {
    title: 'Meine Läufe',
    empty: 'Noch keine Läufe – starte deine erste Aufzeichnung.',
    offline: 'Offline – angezeigt wird der zuletzt geladene Stand.',
    loadFailed: 'Laden hat nicht geklappt.',
    retry: 'Erneut laden',
    noGps: 'ohne GPS',
    favorite: 'Favorit',
    pending: 'wird übertragen',
    rejected: 'nicht gespeichert',
    rejectedHint:
      'Diese Strecke wurde vom Server nicht angenommen (z. B. Tageslimit von 20 Strecken). Erneut versuchen oder verwerfen?',
    retryPending: 'Erneut versuchen',
    discardPending: 'Verwerfen',
    deleteAll: 'Alle Strecken löschen',
    deleteAllConfirm:
      'Alle aufgezeichneten Strecken endgültig löschen? Einträge im Trainingstagebuch bleiben.',
    deleteAllYes: 'Ja, alle löschen',
    deletedAll: (n: number) => `${n} ${n === 1 ? 'Strecke' : 'Strecken'} gelöscht.`,
    itemA11y: (name: string, day: string, distance: string) => `${name}, ${day}, ${distance}`,
    sketchA11y: 'Linien-Skizze der Strecke',
  },
  totals: {
    week: 'Woche',
    month: 'Monat',
    switchA11y: 'Zeitraum wählen',
    previous: 'Zurück',
    next: 'Weiter',
    previousA11y: (period: string) => `Vorherige ${period}`,
    nextA11y: (period: string) => `Nächste ${period}`,
    range: (from: string, to: string) => `${from} – ${to}`,
    count: (n: number) => `${n} ${n === 1 ? 'Aktivität' : 'Aktivitäten'}`,
    distance: 'Distanz',
    time: 'Bewegungszeit',
    elevation: 'Höhenmeter (ca.)',
    empty: 'In diesem Zeitraum keine Aktivität.',
    compareMore: (meters: number, week: boolean) =>
      `${km(meters)} mehr als ${week ? 'letzte Woche' : 'letzten Monat'}.`,
    compareLess: (meters: number, week: boolean) =>
      `${km(meters)} weniger als ${week ? 'letzte Woche' : 'letzten Monat'}.`,
    compareSame: (week: boolean) => `Gleich viel wie ${week ? 'letzte Woche' : 'letzten Monat'}.`,
    weekBar: (from: string, distance: string) => `Woche ab ${from}: ${distance}`,
  },
  detail: {
    title: 'Auswertung',
    notFound: 'Diese Strecke gibt es nicht (mehr).',
    back: 'Zurück zu Ausdauer',
    total: 'Gesamtzeit',
    moving: 'Bewegungszeit',
    distance: 'Distanz',
    pace: 'Ø-Pace',
    speed: 'Ø-Tempo',
    elevation: 'Höhenmeter',
    elevationValue: (m: number) => `ca. ${m} m`,
    elevationNote: 'Höhenmeter per GPS sind ungenau.',
    splits: 'Kilometerzeiten',
    splitsEmpty: 'Unter 1 km – keine Kilometerzeiten.',
    splitA11y: (km: number, time: string) => `Kilometer ${km}: ${time}`,
    profile: 'Höhenprofil',
    profileEmpty: 'Für diese Strecke gibt es kein Höhenprofil (keine Höhen aufgezeichnet).',
    profileA11y: (min: number, max: number) => `Höhenprofil von ${min} bis ${max} Meter`,
    map: 'Karte',
    mapA11y: 'Karte mit der Strecke, Start und Ziel',
    mapFailed: 'Die Karte lädt gerade nicht. Die Zahlen oben gelten trotzdem.',
    attribution: '© OpenStreetMap-Mitwirkende · Kartenstil OpenFreeMap',
    start: 'Start',
    finish: 'Ziel',
    favorite: 'Favorit',
    edit: 'Bearbeiten',
    editSave: 'Änderungen speichern',
    editCancel: 'Abbrechen',
    updated: 'Gespeichert.',
    gpx: 'Als GPX-Datei speichern',
    gpxSaved: 'GPX-Datei gespeichert.',
    gpxFailed: 'Die Datei konnte nicht gespeichert werden.',
    share: 'Als Bild teilen',
    delete: 'Strecke löschen',
    deleteConfirm:
      'Diese Strecke endgültig löschen? Der Eintrag im Trainingstagebuch bleibt (dort separat löschbar).',
    deleteYes: 'Ja, löschen',
    deleted: 'Strecke gelöscht.',
    again: 'Erneut laufen',
    compare: 'Vergleich mit dem letzten Mal',
    noGpsTitle: 'Eintrag ohne GPS',
    noGpsText: 'Dieser Eintrag stammt aus dem Trainingstagebuch – ohne Karte und Kilometerzeiten.',
    openLog: 'Im Tagebuch ansehen',
    note: 'Notiz',
    // Anschauliche Auswertung (Gründer-Wunsch 22.10.2026).
    km: 'km',
    perKm: '/km',
    kmh: 'km/h',
    heroTime: 'Zeit',
    pauses: 'Pausen',
    heroA11y: (distance: string, pace: string, time: string) =>
      `${distance}, Ø ${pace}, Bewegungszeit ${time}`,
    details: 'Details',
    route: 'Strecke',
    legendFast: 'schneller',
    legendSlow: 'langsamer',
    legendA11y: 'Farben der Linie: von Violett (schneller) bis Gelb (langsamer)',
    sketchA11y: 'Skizze der Strecke, farbig nach Tempo, mit Start und Ziel',
    fastestBadge: 'schnellster km',
    splitA11yDelta: (km: number, time: string, delta: string) =>
      `Kilometer ${km}: ${time}, ${delta} zum Durchschnitt`,
    splitsAvg: (pace: string) => `Abweichung zum Ø von ${pace}`,
    rest: (distance: string, pace: string) => `Rest ${distance}: ${pace}`,
    paceChart: 'Tempo-Verlauf',
    paceChartA11y: (fast: string, slow: string) =>
      `Tempo-Verlauf je Kilometer, schnellster Abschnitt ${fast}, langsamster ${slow}`,
    paceAvg: (pace: string) => `Ø ${pace}`,
    profileGain: (m: number) => `↑ ${m} m`,
    profileMax: (m: number) => `max. ${m} m`,
    profileRange: (min: number, max: number) => `${min}–${max} m`,
    highlights: 'Bestwerte',
    highlight: {
      fastestKm: 'Schnellster Kilometer',
      fastestKmDetail: (km: number) => `Kilometer ${km}`,
      negativeSplit: 'Zweite Hälfte schneller',
      negativeSplitValue: (time: string) => `−${time}`,
      negativeSplitDetail: 'als die 1. Hälfte',
      evenPace: 'Gleichmäßiges Tempo',
      evenPaceValue: (s: number) => `± ${Math.round(s / 2)} s`,
      evenPaceDetail: 'Abweichung der Kilometer',
      biggestClimb: 'Größter Anstieg',
      biggestClimbValue: (m: number) => `+${m} m`,
      biggestClimbDetail: (from: string, to: string) => `von km ${from} bis ${to}`,
      highestPoint: 'Höchster Punkt',
      highestPointValue: (m: number) => `${m} m`,
      highestPointDetail: (at: string) => `bei km ${at}`,
    },
  },
  story: {
    title: 'Als Bild teilen',
    intro:
      'Das Bild entsteht nur auf deinem Gerät. Anfang und Ende der Strecke (je 200 m) werden abgeschnitten, damit dein Start- und Zielort nicht erkennbar ist. Keine Gesundheitsdaten, keine Uhrzeit.',
    showLine: 'Strecke zeigen',
    showDate: 'Datum zeigen',
    lineTooShort: 'Strecke zu kurz für die Linie',
    share: 'Bild teilen',
    download: 'Bild herunterladen',
    shared: 'Teilen-Dialog geöffnet.',
    downloaded: 'Bild gespeichert.',
    failed: 'Das Bild konnte nicht erstellt werden.',
    unavailable: 'Teilen ist auf diesem Gerät nicht verfügbar.',
    previewA11y: 'Vorschau des Bildes',
    notFound: 'Diese Einheit gibt es nicht (mehr).',
    stats: {
      duration: 'Zeit',
      moving: 'Bewegung',
      distance: 'Distanz',
      pace: 'Ø-Pace',
      speed: 'Ø-Tempo',
      elevation: 'Höhenmeter',
      exercises: 'Übungen',
      sets: 'Sätze',
      volume: 'Volumen (Zusatzlast)',
    },
    moreExercises: (n: number) => `und ${n} weitere`,
    brand: 'Alpha5',
  },
  errors: {
    rejected: 'Diese Strecke wurde nicht angenommen. Bitte prüfe die Angaben.',
    limit: 'Heute wurden schon 20 Strecken gespeichert – bitte morgen erneut versuchen.',
  },
} as const;
