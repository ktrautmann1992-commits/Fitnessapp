/**
 * Sportarten Stufe 2 (Gründer-Freigabe 25.10.2026, docs/PLAN-SPORTARTEN.md): Sportart eintragen bzw. mit GPS
 * aufzeichnen, Wochen-Summen je Sportart und sanfter Plan-Hinweis nach Sport mit hoher Beinbelastung. Namen der
 * Sportarten kommen aus packages/core (SPORT_CATALOGUE) – hier nur Texte der Oberfläche.
 */
export const deSports = {
  title: 'Sportart eintragen',
  titleGps: 'Sportart mit GPS',
  forDay: (day: string) => `Für ${day}`,
  intro:
    'Padel, Fußball, Klettern & Co. ohne eigenen Plan: Dauer und Anstrengung genügen – wir schätzen kcal und Belastung.',
  introGps: 'Zeichne Skilanglauf, Skitour, Inline-Skaten, SUP oder Kajak/Kanu mit GPS auf.',
  entryButton: 'Andere Sportart (z. B. Padel, Fußball, Klettern)',
  entryHint: 'Ohne eigenen Plan – zählt in Woche und Verlauf mit kcal und Belastung.',
  gpsButton: 'Andere Sportart mit GPS',
  gpsHint: 'Skilanglauf, Skitour, Inline-Skaten, SUP, Kajak/Kanu',
  picker: {
    label: 'Sportart',
    searchLabel: 'Sportart suchen',
    searchHint: 'z. B. Padel, Langlauf, Zumba',
    recent: 'Zuletzt genutzt',
    noResults: 'Keine Sportart gefunden. Wähle „Sonstige Sportart“.',
    chosen: (name: string) => `Gewählt: ${name}`,
    change: 'Andere Sportart wählen',
    pickA11y: (name: string, selected: boolean) =>
      selected ? `${name}, gewählt` : `${name} wählen`,
    categories: {
      ball: 'Ballsport',
      racket: 'Rückschlag',
      climb: 'Klettern',
      combat: 'Kampfsport',
      winter: 'Wintersport',
      water: 'Wassersport',
      indoor_cardio: 'Fitness & Ausdauer',
      dance: 'Tanzen',
      other: 'Sonstiges',
    },
    gpsBadge: 'GPS',
  },
  form: {
    durationTitle: 'Dauer',
    hours: 'Stunden',
    minutes: 'Minuten',
    distance: 'Distanz in km (optional)',
    distanceHint: 'Nur bei Sportarten mit Strecke – z. B. 12,5',
    effortLabel: 'Wie anstrengend war es? (0–10)',
    effortIntro: 'Hilft bei kcal und Belastung. Ohne Angabe rechnen wir mit dem üblichen Wert.',
    notes: 'Notiz (optional)',
    liftHint: 'Bitte nur die aktive Zeit ohne Lift und Pausen angeben.',
    save: 'Speichern',
    saving: 'Speichert …',
    kcalPreview: (kcal: string) => `ca. ${kcal} kcal`,
    loadPreview: (points: number) => `Belastung: ${points} Punkte`,
    loadInfo:
      'Belastung = Minuten × Anstrengung (0–10). So lassen sich verschiedene Sportarten vergleichen.',
    startRecording: 'Aufzeichnung starten',
    startDemo: 'Demo-Aufzeichnung starten',
    demoHint: 'Im Browser ohne GPS: eine Demo-Strecke wird abgespielt.',
    noGpsWeb: 'Aufzeichnen mit GPS geht nur in der App. Du kannst die Einheit hier eintragen.',
  },
  errors: {
    choose: 'Bitte zuerst eine Sportart wählen.',
    date_future: 'Eintragen geht nur für heute und vergangene Tage.',
    date_too_old: 'Nachtragen geht nur bis 14 Tage zurück.',
    duration_missing: 'Bitte die Dauer angeben.',
    duration_invalid: 'Bitte ganze Stunden und Minuten angeben (Minuten 0–59).',
    duration_range: 'Die Dauer muss zwischen 1 Minute und 12 Stunden liegen.',
    distance_invalid: 'Bitte eine Distanz wie 12,5 angeben.',
    distance_range: 'Die Distanz darf höchstens 500 km sein.',
    distance_not_allowed: 'Diese Sportart hat keine Distanz.',
    effort_invalid: 'Bitte eine Anstrengung von 0 bis 10 wählen.',
    notes_too_long: 'Die Notiz darf höchstens 280 Zeichen haben.',
    invalid: 'Das ließ sich nicht speichern. Bitte Angaben prüfen.',
    rejected: 'Nicht gespeichert – bitte Angaben prüfen.',
    failed: 'Speichern hat nicht geklappt. Bitte erneut versuchen.',
  },
  saved: 'Gespeichert.',
  queued: 'Gespeichert – wird übertragen, sobald du online bist.',
  recording: {
    saveTitle: (name: string) => `${name} speichern`,
    routeNote:
      'Zeit und Distanz kommen ins Tagebuch. Die Karte der Strecke wird für diese Sportart noch nicht gespeichert.',
    summary: (time: string, distance: string) => `${time} · ${distance}`,
    discard: 'Verwerfen',
    discardConfirm: 'Aufzeichnung verwerfen?',
    discardYes: 'Ja, verwerfen',
    resume: 'Weiter aufzeichnen',
    tooShort: 'Zu kurz zum Speichern (unter 1 Minute).',
  },
  log: {
    sport: (name: string) => `Sportart: ${name}`,
    load: (points: number) => `Belastung: ${points} Punkte (Minuten × Anstrengung)`,
  },
  week: {
    title: 'Sportarten diese Woche',
    empty: 'Diese Woche noch keine anderen Sportarten.',
    row: (sessions: number, minutes: string) =>
      `${sessions === 1 ? '1 Einheit' : `${sessions} Einheiten`} · ${minutes}`,
    kcal: (kcal: string) => `ca. ${kcal} kcal`,
    load: (points: number) => `${points} Punkte`,
    totalLoad: (points: number) => `Trainingsbelastung der Woche: ${points} Punkte`,
    totalLoadInfo:
      'Alle Einheiten: Minuten × Anstrengung (0–10). Ohne Angabe zählt ein üblicher Wert.',
    a11y: (name: string, sessions: number, minutes: string) =>
      `${name}: ${sessions === 1 ? 'eine Einheit' : `${sessions} Einheiten`}, ${minutes}`,
  },
  legHint: {
    strength_legs: (sport: string, day: string) =>
      `Nach ${sport} (${day}) sind deine Beine vermutlich noch müde. Geh die Beinübungen locker an – oder tausche die Einheit auf einen späteren Tag.`,
    hard_endurance: (sport: string, day: string) =>
      `Nach ${sport} (${day}) sind deine Beine vermutlich noch müde. Mach die harte Einheit lieber locker – oder verschiebe sie um einen Tag.`,
    note: 'Nur ein Vorschlag – dein Plan ändert sich nicht.',
  },
} as const;
