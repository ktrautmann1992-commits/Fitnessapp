import {
  type CompetitionErrorReason,
  type CompetitionPhase,
  type CompetitionVolumeTrend,
  type FeasibilityNotice,
  type FeasibilityReason,
  type FeasibilityStatus,
  MULTISPORT_TEXTS_DE,
  type WorkoutType,
} from '@fitnessapp/core';

/**
 * Texte zum Wettkampf (Phase 10, Etappe WP4, docs/PLAN-PHASE-10.md Abschnitt 8): „Mein Wettkampf“, Ampel, Countdown,
 * Phasen-Band, Art/Pace/Distanz-Richtwert je Einheit, Intervall-Timer und Ergebnis. Ruhig und ohne Druck (keine
 * Serien, keine Bestzeiten-Jagd, Risiko 10), keine Health Claims. Farben nie allein: jede Ampel-Stufe hat ein Wort und
 * ein Zeichen. Wird in `de.ts` unter `competition` eingebunden.
 */

const STATUS: Record<FeasibilityStatus, { label: string; symbol: string; text: string }> = {
  ok: {
    label: 'Passt',
    symbol: '✓',
    text: 'Die Zeit bis zum Renntag reicht. Wir planen rückwärts vom Renntag mit Erholungswochen und Tapering.',
  },
  tight: {
    label: 'Knapp',
    symbol: '!',
    text: 'Es reicht knapp. Ziel ist „Ankommen“ – eine Zielzeit planen wir dafür nicht.',
  },
  too_short: {
    label: 'Zu kurz',
    symbol: '✕',
    text: 'Bis zum Renntag ist zu wenig Zeit, um sicher genug Umfang aufzubauen. Wir stauchen den Plan nicht – wähle ein späteres Datum, eine kürzere Distanz oder trainiere ohne Wettkampf weiter.',
  },
  not_available: {
    label: 'Nicht möglich',
    symbol: '✕',
    text: 'Für diesen Wettkampf erstellen wir dir gerade keinen Wettkampfplan. Den Countdown kannst du trotzdem speichern.',
  },
};

const REASONS: Record<FeasibilityReason, string> = {
  pregnancy:
    'In der Schwangerschaft erstellen wir keinen Wettkampfplan. Bitte sprich mit deiner Ärztin oder deinem Arzt, was für dich passt.',
  health_check_required:
    'Ein Wettkampfplan braucht den Gesundheits-Check (mit Einwilligung). Bis dahin trainierst du mit dem Grundlagen-Plan.',
  minor_distance_limit:
    'Unter 18 planen wir beim Laufen höchstens bis zum Halbmarathon, beim Triathlon nur den Sprint und beim Rad höchstens 100 km.',
  lead_time_below_minimum: 'Bis zum Renntag ist weniger Zeit als der empfohlene Mindestvorlauf.',
  long_run_day_too_short:
    'Am Tag des langen Laufs ist zu wenig Zeit eingeplant, um den langen Lauf aufzubauen.',
  peak_not_reachable:
    'Mit höchstens 10 % mehr pro Woche (plus Erholungswochen) erreichst du den nötigen Umfang nicht rechtzeitig.',
  weekly_time_too_low: 'Deine Trainingszeit pro Woche reicht für diese Distanz nicht.',
  peak_reached_late: 'Den nötigen Umfang erreichst du erst kurz vor dem Tapering.',
  goal_time_not_allowed:
    'Eine Zielzeit planen wir für dich nicht (z. B. als Einsteiger, mit Hinweis aus dem Gesundheits-Check, unter 18 oder ab 65). Ziel ist „Ankommen“.',
  goal_time_not_reachable:
    'Die Zielzeit passt nicht zu deiner Referenzzeit. Wir planen auf „Ankommen“.',
  long_run_not_reachable: 'Der nötige lange Lauf ist bis zum Renntag nicht sicher erreichbar.',
  triathlon_days_too_few:
    'Für einen Triathlon-Plan brauchst du mindestens 3 Ausdauer-Tage pro Woche – je einen für Schwimmen, Rad und Laufen (Einstellungen → Angaben ändern → Trainingstage).',
};

const NOTICES: Record<FeasibilityNotice, string> = {
  medical_clearance:
    'Bitte lass vor dem Wettkampf ärztlich abklären, ob du sporttauglich bist. Wir planen nur locker und auf „Ankommen“.',
  beginner_marathon:
    'Marathon als Einsteiger ist ein großes Ziel. Höre gut auf deinen Körper und nimm Erholungswochen ernst.',
  minor_no_target_time: 'Unter 18 planen wir ohne Zielzeit.',
  own_start_capped:
    'Deine Angabe zum bisherigen Umfang haben wir zur Sicherheit auf das Doppelte des Startumfangs begrenzt.',
  own_start_ignored:
    'Deine Angabe zum bisherigen Umfang nutzen wir für deine Gruppe nicht – wir starten vorsichtig.',
  own_start_journal_used:
    'Wir starten mit dem, was du laut Tagebuch zuletzt wirklich trainiert hast – nicht mit deiner Angabe.',
  start_reference_capped:
    'Dein bisheriger Umfang ist hoch – zur Sicherheit starten wir mit höchstens dem Doppelten des Startumfangs.',
  walk_only_plan:
    'Dein Plan besteht aus zügigem Gehen – geeignet, um den Wettkampf zu gehen bzw. zu walken.',
  reference_distance_too_far:
    'Deine Referenzzeit ist über eine sehr andere Distanz gelaufen. Daraus rechnen wir keine Zielzeit und kein Renntempo.',
  long_run_day_not_endurance:
    'An deinem Wunsch-Tag für den langen Lauf ist kein Ausdauer-Tag – wir wählen den Tag automatisch.',
  open_water_safety: MULTISPORT_TEXTS_DE.openWater,
  beginner_long_event:
    'Diese Distanz ist als Einsteiger ein großes Ziel. Höre gut auf deinen Körper und nimm Erholungswochen ernst.',
};

const PHASES: Record<CompetitionPhase, string> = {
  base: 'Basis',
  build: 'Aufbau',
  peak: 'Spitze',
  taper: 'Tapering',
  race_week: 'Rennwoche',
  recovery: 'Erholung nach dem Rennen',
};

const PHASE_TEXTS: Record<CompetitionPhase, string> = {
  base: 'Grundlage: vor allem locker laufen.',
  build: 'Harte Einheiten kommen dazu, der Umfang steigt weiter höchstens 10 % pro Woche.',
  peak: 'Höchster Umfang und wettkampfnahe Einheiten.',
  taper: 'Weniger Umfang, die Intensität bleibt – so gehst du erholt an den Start.',
  race_week: 'Nichts Neues ausprobieren: gewohntes Essen, gewohnte Schuhe, viel Schlaf.',
  recovery: 'Nur locker – dein Körper erholt sich vom Rennen.',
};

/** „So ist dein Plan aufgebaut“: je Phase ein Satz „Was passiert hier“ (Gründer-Rückmeldung 20.10.2026). */
const OUTLINE_PHASE_TEXTS: Record<CompetitionPhase, string> = {
  base: 'Du baust Grundlage auf: vor allem lockere Einheiten, der Umfang steigt langsam.',
  build: 'Härtere Einheiten kommen dazu (z. B. Tempo oder Intervalle), der lange Lauf wird länger.',
  peak: 'Dein höchster Umfang mit wettkampfnahen Einheiten – hier wirst du richtig fit.',
  taper: 'Weniger Umfang, die Intensität bleibt – so gehst du erholt an den Start.',
  race_week: 'Wenig und locker, nichts Neues ausprobieren – am Ende steht dein Renntag.',
  recovery: 'Nur locker oder Pause – dein Körper erholt sich vom Rennen.',
};

const OUTLINE_TRENDS: Record<CompetitionVolumeTrend, string> = {
  rising: 'Wochenumfang: steigt (höchstens etwa 10 % pro Woche)',
  holding: 'Wochenumfang: am höchsten, bleibt gleich',
  falling: 'Wochenumfang: sinkt deutlich',
  easy: 'Wochenumfang: gering und locker',
};

const WORKOUT_TYPES: Record<WorkoutType, string> = {
  easy: 'Locker',
  recovery: 'Erholungslauf',
  long: 'Langer Lauf',
  strides: 'Locker mit Steigerungen',
  fartlek: 'Fahrtspiel',
  tempo: 'Tempo',
  intervals: 'Intervalle',
  race_pace: 'Renntempo',
  brick: 'Koppeltraining (Rad → Lauf)',
  technique: 'Schwimmtechnik',
};

const ERRORS: Record<CompetitionErrorReason, string> = {
  competition_exists:
    'Du hast schon einen geplanten Wettkampf. Ändere oder sage ihn zuerst ab (ein Hauptwettkampf).',
  race_date:
    'Der Renntag liegt außerhalb des erlaubten Zeitraums (zu bald oder mehr als 52 Wochen entfernt).',
  reference_date:
    'Die Referenzzeit darf nicht in der Zukunft liegen und höchstens 6 Monate alt sein.',
  health_check_required:
    'Für einen Wettkampfplan brauchen wir den Gesundheits-Check mit deiner Einwilligung.',
  not_allowed: 'Für deine Angaben gibt es diesen Wettkampfplan nicht.',
  not_found: 'Den Wettkampf gibt es so nicht mehr. Bitte lade neu.',
  not_planned: 'Dieser Wettkampf ist schon abgeschlossen oder abgesagt.',
  result_rejected:
    'Das Ergebnis passt nicht zum Wettkampf (Eintrag vom Renntag, erst ab dem Renntag).',
  invalid: 'Bitte prüfe deine Angaben zum Wettkampf.',
};

export const deCompetition = {
  title: 'Mein Wettkampf',
  settingsLink: 'Mein Wettkampf',
  settingsLinkHint: 'Wettkampf eintragen, Ampel, Countdown und Wettkampfplan',
  loading: 'Wettkampf wird geladen …',
  intro:
    'Trage deinen Wettkampf ein. Wir prüfen, ob die Zeit reicht, und planen rückwärts vom Renntag – sicher und ohne Stauchen.',
  // Einladung (kein Wettkampf)
  emptyTitle: 'Noch kein Wettkampf',
  emptyText: 'Hast du einen Lauf im Blick? Trage ihn ein – mit Ampel und Countdown.',
  add: 'Wettkampf eintragen',
  invite: 'Wettkampf eintragen',
  inviteText: (date: string) =>
    `Du hast ${date} als Wettkampf-Datum angegeben. Trage den Wettkampf ein – mit Ampel, Countdown und Wettkampfplan.`,
  // Formular
  formTitleNew: 'Wettkampf eintragen',
  formTitleEdit: 'Wettkampf ändern',
  discipline: 'Distanz',
  disciplines: {
    '5k': '5 km',
    '10k': '10 km',
    half_marathon: 'Halbmarathon',
    marathon: 'Marathon',
    cycling: 'Radrennen',
    triathlon_sprint: 'Triathlon Sprint',
    triathlon_olympic: 'Triathlon olympisch',
  },
  /** Rad mit Distanz: „Radrennen 120 km“. */
  cyclingWithDistance: (km: number) => `Radrennen ${km} km`,
  disciplineHint:
    'Laufen 5 km bis Marathon, Radrennen (20–300 km) und Triathlon Sprint oder Olympisch. Für Triathlon-Mittel- und Langdistanz sowie Schwimm-Wettkämpfe erstellen wir keinen Plan – lass dich dafür von einem Trainer oder Verein begleiten.',
  coachHint: (discipline: string) =>
    `Dein Ziel ist ${discipline}. Dafür erstellen wir keinen Wettkampfplan – so lange Belastungen planst du am besten mit einem Trainer oder Verein. Du kannst hier eine kürzere Distanz eintragen; dein Grundlagen-Plan bleibt.`,
  cyclingDistance: 'Distanz in km (20–300)',
  cyclingDistanceHint: 'Ganze Kilometer, z. B. 120 für einen Radmarathon.',
  multisportFinishOnly:
    'Bei Rad und Triathlon planen wir auf „Ankommen“ – ohne Zielzeit, Referenzzeit und Pace. Die Anstrengung ist dein Maß.',
  openWaterTitle: 'Sicherheit beim Schwimmen',
  raceDate: 'Renntag',
  name: 'Name (optional)',
  nameHint: 'Nur für dich, z. B. „Stadtlauf“. Ohne Angabe nehmen wir die Distanz.',
  goal: 'Dein Ziel',
  goals: { finish: 'Ankommen', time: 'Zielzeit' },
  goalTimeHint:
    'Eine Zielzeit geht nur mit eigener Referenzzeit (letzter Wettkampf oder Testlauf aus dem Tagebuch). Wir testen nie dein Maximum.',
  targetTime: 'Zielzeit',
  hours: 'Stunden',
  minutes: 'Minuten',
  seconds: 'Sekunden',
  referenceTitle: 'Referenzzeit (optional)',
  referenceText:
    'Deine Zeit bei einem Wettkampf oder Testlauf der letzten 6 Monate. Daraus rechnen wir Pace-Richtwerte – die Anstrengung hat immer Vorrang.',
  referenceAdd: 'Referenzzeit angeben',
  referenceRemove: 'Referenzzeit entfernen',
  referenceDiscipline: 'Distanz der Referenz',
  referenceTime: 'Zeit',
  referenceDate: 'Datum des Laufs',
  longRunDay: 'Tag für den langen Lauf',
  longRideDay: 'Tag für die lange Ausfahrt',
  longRunAuto: 'Automatisch',
  ownStartTitle: 'Bisheriger Umfang (optional)',
  ownStartText:
    'Läufst du schon regelmäßig? Gib an, wie viele Minuten pro Woche. Wir begrenzen zur Sicherheit (höchstens das Doppelte des Startumfangs); Einträge im Tagebuch haben Vorrang.',
  ownStartMinutes: 'Minuten pro Woche',
  ownStartConfirm: 'Ich laufe diesen Umfang seit mindestens 4 Wochen regelmäßig.',
  errorsForm: {
    raceDate: 'Bitte einen gültigen Renntag eingeben (TT.MM.JJJJ).',
    raceDatePast: 'Der Renntag muss in der Zukunft liegen.',
    raceDateFar: 'Der Renntag darf höchstens 52 Wochen entfernt sein.',
    time: 'Bitte eine plausible Zeit eingeben.',
    referenceDate:
      'Die Referenzzeit darf höchstens 6 Monate alt sein und nicht in der Zukunft liegen.',
    referenceMissing: 'Für eine Zielzeit brauchen wir deine Referenzzeit.',
    ownStart: 'Bitte ganze Minuten (mindestens 10) eingeben und bestätigen.',
    cyclingDistance: 'Bitte ganze Kilometer zwischen 20 und 300 eingeben.',
    name: 'Höchstens 80 Zeichen.',
  },
  // Ampel
  feasibilityTitle: 'Machbarkeit',
  feasibilityA11y: (label: string, text: string) => `Ampel: ${label}. ${text}`,
  feasibilityExplain:
    'Ampel: Wir prüfen, ob die Zeit bis zum Renntag für einen sicheren Wettkampfplan reicht.',
  status: STATUS,
  reasons: REASONS,
  notices: NOTICES,
  leadInfo: (weeks: number, minimum: number) =>
    `Noch ${weeks} ${weeks === 1 ? 'Woche' : 'Wochen'} bis zum Renntag – empfohlen sind mindestens ${minimum}.`,
  peakInfo: (planned: number, required: number) =>
    `Höchster Wochenumfang im Plan: ${planned} min (nötig: ${required} min).`,
  longRunInfo: (planned: number, required: number) =>
    `Längster Lauf im Plan: ${planned} min (nötig: ${required} min).`,
  longRideInfo: (planned: number, required: number) =>
    `Längste Ausfahrt im Plan: ${planned} min (nötig: ${required} min).`,
  effectiveGoal: { finish: 'Ziel im Plan: Ankommen', time: 'Ziel im Plan: Zielzeit' },
  suggestionsTitle: 'Vorschläge',
  suggestions: {
    shorter_distance: (distance: string) => `Kürzere Distanz: ${distance}`,
    later_date: (date: string) => `Späterer Renntag: ab ${date}`,
    more_training_time: (minutes: number) =>
      `Mehr Trainingszeit: mindestens ${minutes} Minuten pro Woche (Einstellungen → Angaben ändern → Trainingstage)`,
    longer_long_run_day: (minutes: number) =>
      `Am Tag des langen Laufs ${minutes} Minuten einplanen (Einstellungen → Angaben ändern → Trainingstage)`,
    health_check: 'Gesundheits-Check machen',
    without_competition: 'Ohne Wettkampfplan weiter trainieren',
  },
  applySuggestion: 'Übernehmen',
  applySuggestionA11y: (text: string) => `Vorschlag übernehmen: ${text}`,
  blocked: {
    incomplete: 'Für einen Wettkampfplan fehlen noch Angaben (Ziel, Erfahrung, Trainingstage).',
    goal_not_endurance:
      'Ein Wettkampfplan braucht das Hauptziel Ausdauer (Einstellungen → Angaben ändern → Ziel). Den Countdown kannst du trotzdem speichern.',
  },
  goalChange: (distance: string) =>
    `Dein Ziel wird dabei auf Ausdauer – ${distance} gestellt (die Distanz des Wettkampfs).`,
  // Aktionen
  createPlan: 'Wettkampfplan erstellen',
  recreatePlan: 'Speichern und Plan neu erstellen',
  saveCountdown: 'Nur Countdown speichern (ohne Plan)',
  recreateBasicPlan: 'Speichern und Plan ohne Wettkampf neu erstellen',
  confirmBasicText:
    'Der Wettkampf wird ohne Wettkampfplan gespeichert, dein Plan ab heute durch einen Grundlagen-Plan ersetzt. Eingetragene Trainings bleiben im Tagebuch.',
  savedWithBasicPlan: 'Gespeichert. Dein Plan ist jetzt ein Grundlagen-Plan ohne Wettkampf.',
  planChangeNeedsRecreate:
    'Dein Wettkampfplan ist auf die bisherigen Angaben ausgelegt (Renntag, Distanz, Ziel, langer Lauf). Damit er passt, wird der Plan beim Speichern neu erstellt – mit oder ohne Wettkampf.',
  planMismatch:
    'Dein Plan passt nicht mehr zu deinem Wettkampf. Erstelle den Plan neu – mit Wettkampf (die Ampel „Machbarkeit“ unter „Mein Wettkampf“ zeigt, ob das geht) oder ohne.',
  planMismatchOverview:
    'Dein Plan passt nicht mehr zu deinem Wettkampf. Die Ampel „Machbarkeit“ darunter zeigt, ob ein neuer Wettkampfplan bis zum Renntag sicher machbar ist.',
  planMismatchRaceOver: 'Dein Plan passt nicht mehr zu deinem Wettkampf.',
  planOfflineUnknown: 'Offline: Ob dein Wettkampfplan noch passt, sehen wir erst mit Verbindung.',
  save: 'Speichern',
  cancelForm: 'Abbrechen',
  withoutCompetition: 'Ohne Wettkampfplan weiter',
  edit: 'Ändern',
  creating: 'Wettkampfplan wird erstellt …',
  offlineCreate:
    'Wettkampf anlegen und ändern geht nur mit Verbindung. Plan und Timer funktionieren offline.',
  confirmRecreateTitle: 'Plan neu erstellen?',
  confirmRecreateText:
    'Dein aktueller Plan wird ab heute durch den neuen Wettkampfplan ersetzt. Eingetragene Trainings bleiben im Tagebuch.',
  confirmRecreate: 'Plan neu erstellen',
  created: 'Dein Wettkampfplan ist fertig. Du findest ihn auf „Heute“.',
  savedCountdown: 'Wettkampf gespeichert. Der Countdown steht auf „Heute“ und im Kalender.',
  saved: 'Gespeichert.',
  planNotFeasible:
    'Mit diesen Angaben ist gerade kein Wettkampfplan möglich. Nichts wurde geändert – dein bisheriger Plan bleibt.',
  // Übersicht
  summaryDate: (date: string) => `Renntag: ${date}`,
  summaryGoal: (goal: string) => `Ziel: ${goal}`,
  summaryTarget: (time: string) => `Zielzeit: ${time}`,
  summaryReference: (distance: string, time: string, date: string) =>
    `Referenz: ${distance} in ${time} (${date})`,
  planIsCompetition: 'Dein Plan ist der Wettkampfplan für diesen Wettkampf.',
  planIsBasic:
    'Dein aktueller Plan ist ein Grundlagen-Plan. Die Ampel „Machbarkeit“ darunter zeigt, ob ein Wettkampfplan bis zum Renntag sicher machbar ist.',
  planIsBasicRaceOver: 'Dein aktueller Plan ist ein Grundlagen-Plan.',
  // Countdown
  countdownTitle: 'Countdown',
  countdown: (days: number, distance: string) =>
    days === 1 ? `Noch 1 Tag bis zum ${distance}` : `Noch ${days} Tage bis zum ${distance}`,
  raceDay: (distance: string) => `Heute ist Renntag: ${distance}. Viel Freude – lauf dein Tempo.`,
  raceWeek: 'Rennwoche: Nichts Neues ausprobieren – gewohntes Essen, gewohnte Schuhe, viel Schlaf.',
  awaitingResult: (distance: string) =>
    `Dein ${distance} ist vorbei. Wie lief es? Trage dein Ergebnis ein.`,
  recovery:
    'Erholung nach dem Rennen: Ein paar Tage nur locker oder Pause. Danach kannst du dein nächstes Ziel planen.',
  nextGoal: 'Nächstes Ziel planen',
  openCompetition: 'Zum Wettkampf',
  calendarRaceDay: (distance: string) => `Renntag: ${distance}`,
  calendarRaceDayA11y: (distance: string) => `Renntag – ${distance}`,
  // Phasen-Band
  phases: PHASES,
  phaseTexts: PHASE_TEXTS,
  shortDaysHint:
    'Diese Woche ist alles locker: Tempo- oder Intervall-Einheiten brauchen mindestens 25 Minuten (mit Auf- und Abwärmen). Plane an einem Lauftag mehr Zeit ein (Einstellungen → Angaben ändern → Trainingstage), wenn du sie möchtest.',
  phaseBand: (phase: string, week: number, total: number) =>
    `${phase} · Woche ${week} von ${total}`,
  phaseBandIntro: (phase: string, total: number) =>
    `${phase} · Einstiegswoche (bis zum Renntag ${total} Wochen)`,
  phaseBandWeekOnly: (week: number, total: number) => `Woche ${week} von ${total}`,
  phaseBandAfter: (phase: string) => phase,
  // Knopf oben im Reiter Training (Gründer-Rückmeldung 20.10.2026)
  trainingLink: 'Wettkampfplan',
  trainingLinkA11y: (name: string) => `Wettkampfplan für ${name} ansehen`,
  trainingLinkHint: 'Zeigt Countdown, Phasen und den Aufbau deines Plans',
  // „So ist dein Plan aufgebaut“ (Zeitleiste der Phasen)
  outline: {
    title: 'So ist dein Plan aufgebaut',
    intro: (total: number) =>
      `Wir planen rückwärts vom Renntag: ${total} ${total === 1 ? 'Woche' : 'Wochen'} in Phasen. Erholungswochen sind fest eingeplant. Tippe auf eine Woche, um sie im Kalender zu öffnen.`,
    now: (week: number, total: number) => `Du bist in Woche ${week} von ${total}.`,
    nowEntry: (total: number) => `Du bist in der Einstiegswoche (bis zum Renntag ${total} Wochen).`,
    beforeStart: 'Dein Plan beginnt bald.',
    raceWeekNow: 'Diese Woche ist Rennwoche.',
    recoveryNow: 'Das Rennen ist vorbei – jetzt kommt die Erholung.',
    finished: 'Dein Wettkampfplan ist abgeschlossen.',
    phaseTexts: OUTLINE_PHASE_TEXTS,
    trends: OUTLINE_TRENDS,
    weeks: (first: number, last: number) =>
      first === last ? `Woche ${first}` : `Wochen ${first}–${last}`,
    weeksA11y: (first: number, last: number) =>
      first === last ? `Woche ${first}` : `Wochen ${first} bis ${last}`,
    dates: (from: string, to: string) => `${from} – ${to}`,
    datesA11y: (from: string, to: string) => `vom ${from} bis ${to}`,
    afterRace: 'Danach',
    currentPhase: 'Du bist hier',
    recoveryCount: (count: number) =>
      count === 1 ? 'mit 1 Erholungswoche' : `mit ${count} Erholungswochen`,
    week: (no: number) => (no === 0 ? 'Einstieg' : `Woche ${no}`),
    weekCurrent: 'jetzt',
    weekRecovery: 'Erholung',
    weekRace: 'Renntag',
    weekPercent: (percent: number) => `${percent} %`,
    weekMinutes: (minutes: number) => `${minutes} min`,
    weekA11y: (parts: readonly string[]) => parts.filter((p) => p !== '').join(', '),
    weekA11yRecovery: 'Erholungswoche',
    weekA11yProjected: 'Vorschau',
    weekA11yCurrent: 'aktuelle Woche',
    weekA11yRace: 'Rennwoche',
    weekA11yPercent: (percent: number) => `Umfang etwa ${percent} Prozent`,
    weekA11yMinutes: (minutes: number) => `${minutes} Minuten Ausdauer geplant`,
    weekOpenHint: 'Öffnet die Woche im Kalender',
    legend:
      'Erholung = Erholungswoche mit weniger Umfang. Prozent = Umfang im Vergleich zur letzten vollen Woche.',
  },
  // Einheit
  workoutTypes: WORKOUT_TYPES,
  workoutTypeLine: (type: string, hard: boolean) => (hard ? `Art: ${type} (hart)` : `Art: ${type}`),
  effortLine: (effort: number) => `Anstrengung: ${effort} von 10`,
  paceLine: (fast: string, slow: string) => `Pace-Richtwert: ${fast}–${slow} min/km`,
  paceNotice: 'Die Anstrengung hat Vorrang – bei Hitze, Wind und Steigungen langsamer.',
  distanceLine: (km: string) => `Distanz-Richtwert: etwa ${km} km (die Dauer ist dein Ziel)`,
  brickLine: (bike: number, run: number) =>
    `Zwei Teile in einer Einheit: Teil 1 Rad ${bike} min, Teil 2 Laufen ${run} min – direkt hintereinander.`,
  stepSports: { bike: 'Rad', run: 'Laufen', swim: 'Schwimmen' },
  stepLineSport: (part: string, sport: string, duration: string, kind: string, effort: number) =>
    `${part} (${sport}): ${duration} ${kind} (Anstrengung ${effort})`,
  stepsTitle: 'Ablauf',
  stepParts: { warmup: 'Aufwärmen', main: 'Hauptteil', cooldown: 'Abwärmen' },
  stepKinds: { work: 'zügig', easy: 'locker', rest: 'locker traben' },
  stepLine: (part: string, duration: string, kind: string, effort: number) =>
    `${part}: ${duration} ${kind} (Anstrengung ${effort})`,
  repeatLine: (
    repeats: number,
    duration: string,
    kind: string,
    effort: number,
    rest: string | null,
  ) =>
    rest
      ? `${repeats} × ${duration} ${kind} (Anstrengung ${effort}), dazwischen ${rest} locker`
      : `${repeats} × ${duration} ${kind} (Anstrengung ${effort})`,
  // Timer
  timer: {
    title: 'Intervall-Timer',
    intro:
      'Schritt für Schritt durch die Einheit. Läuft offline; beim Schrittwechsel vibriert das Handy (in der App).',
    webHint: 'Im Browser vibriert das Handy nicht – achte auf die Anzeige. Lass den Bildschirm an.',
    start: 'Timer starten',
    pause: 'Pause',
    resume: 'Weiter',
    stopAndLog: 'Abbrechen und eintragen',
    finishAndLog: 'Fertig – Dauer eintragen',
    paused: 'Pausiert',
    finished: 'Geschafft – die Einheit ist durch.',
    stepOf: (n: number, total: number) => `Schritt ${n} von ${total}`,
    remaining: (time: string) => `noch ${time}`,
    total: (time: string) => `Gesamt noch ${time}`,
    next: (text: string) => `Danach: ${text}`,
    nextLast: 'Danach: fertig',
    workParts: (done: number, total: number) => `Teile geschafft: ${done} von ${total}`,
    workNo: (n: number, total: number) => `Teil ${n} von ${total}`,
    announce: (text: string) => `Jetzt: ${text}`,
    announceFinished: 'Einheit beendet.',
    logged: (minutes: number) =>
      `${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'} eingetragen – prüfe die Angaben unten und speichere.`,
    stopConfirmTitle: 'Timer abbrechen?',
    stopConfirmText:
      'Die bisher gelaufene Zeit übernehmen wir als Dauer (auf ganze Minuten gerundet, mindestens 1 Minute). Du kannst sie vor dem Speichern noch ändern.',
    stopConfirm: 'Abbrechen und eintragen',
    keepRunning: 'Weiterlaufen',
  },
  // Ergebnis
  result: {
    title: 'Ergebnis eintragen',
    intro: 'Deine Zeit, wie es sich angefühlt hat und eine Notiz – nur für dich.',
    time: 'Deine Zeit',
    effort: 'Wie anstrengend war es? (Anstrengung 0–10)',
    notes: 'Notiz (optional)',
    save: 'Ergebnis speichern',
    withoutResult: 'Ohne Ergebnis abschließen',
    tooOld:
      'Der Renntag liegt mehr als 14 Tage zurück – ein Tagebuch-Eintrag geht nicht mehr. Du kannst den Wettkampf ohne Ergebnis abschließen.',
    queued:
      'Dein Eintrag wird übertragen, sobald du online bist. Danach kannst du den Wettkampf hier abschließen.',
    saved: 'Ergebnis gespeichert. Jetzt ist Erholung dran – ein paar Tage nur locker.',
    done: 'Wettkampf abgeschlossen.',
    resultLine: (time: string) => `Ergebnis: ${time}`,
    noResult: 'Ohne Ergebnis abgeschlossen.',
    timeInvalid: 'Bitte eine Zeit zwischen 1 Minute und 12 Stunden eingeben.',
    linkLog: 'Eintrag vom Renntag als Ergebnis übernehmen',
  },
  // Absagen / Löschen
  cancel: 'Wettkampf absagen',
  cancelTitle: 'Wettkampf absagen?',
  cancelText:
    'Der Wettkampf wird als abgesagt gespeichert. Dein Plan bleibt erst einmal – du kannst danach einen neuen Grundlagen-Plan erstellen.',
  cancelConfirm: 'Absagen',
  cancelled: 'Wettkampf abgesagt.',
  recreateAfterCancel: 'Plan ohne Wettkampf neu erstellen',
  delete: 'Wettkampf löschen',
  deleteTitle: 'Wettkampf löschen?',
  deleteText: 'Der Wettkampf wird endgültig gelöscht. Einträge im Tagebuch bleiben.',
  deleteConfirm: 'Löschen',
  deleted: 'Wettkampf gelöscht.',
  // Plan endet
  planEndedTitle: 'Dein Wettkampfplan ist zu Ende',
  planEndedText:
    'Der Wettkampfplan geht nicht weiter (Wettkampf vorbei, abgesagt oder deine Angaben haben sich geändert). Erstelle einen neuen Plan – wir starten wieder vorsichtig.',
  goalUnreachableTitle: 'Dein Wettkampfziel ist so nicht mehr erreichbar',
  goalUnreachableText:
    'Nach deinen neuen Angaben (z. B. Erfahrung oder Gesundheits-Check) reicht die Zeit bis zum Renntag nicht mehr, um sicher genug Umfang aufzubauen. Erstelle den Plan neu – die Ampel unter „Mein Wettkampf“ zeigt dir Vorschläge (kürzere Distanz, späteres Datum).',
  createdWithoutCompetitionOther:
    'Plan erstellt – ohne Wettkampfplan, weil dein Wettkampf dafür nicht (mehr) passt (z. B. Renntag vorbei). Details unter Einstellungen → Mein Wettkampf.',
  timeGoalNotOffered:
    'Eine Zielzeit planen wir für dich nicht (z. B. als Einsteiger, mit Hinweis aus dem Gesundheits-Check, unter 18 oder ab 65) – dein Ziel ist „Ankommen“.',
  createdWithoutCompetition:
    'Plan erstellt – ohne Wettkampfplan, weil die Ampel gerade nicht passt. Details unter Einstellungen → Mein Wettkampf.',
  errors: ERRORS,
};
