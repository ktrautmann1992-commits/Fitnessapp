/**
 * Texte der Workout-Bibliothek (docs/PLAN-WORKOUTS.md): Liste, Filter, Detail, Timer, Abschluss. Eigene Datei, damit
 * andere Bereiche (Menüleiste, Übersicht) nicht berührt werden.
 */
const STAR_WORDS = {
  1: 'leicht',
  2: 'eher leicht',
  3: 'mittel',
  4: 'schwer',
  5: 'sehr schwer',
} as const;

export const deWorkouts = {
  tab: 'Workouts',
  title: 'Workouts',
  intro:
    'Fertige Workouts mit Timer – einzeln machen, wann du willst. Nach dem Abschluss steht das Workout in deinem Tagebuch am heutigen Tag.',
  more: 'Workouts',
  testPhase: 'Testphase – noch nicht fachlich geprüft',
  testContent: 'Testinhalt – Entwurf, noch nicht freigegeben',
  offlineCached: 'Offline: gespeicherte Workout-Liste.',
  loading: 'Workouts werden geladen …',
  loadFailed: 'Die Workouts konnten nicht geladen werden.',
  empty: 'Noch keine Workouts freigegeben.',
  noMatch: 'Kein Workout passt zu diesen Filtern.',
  resetFilters: 'Filter zurücksetzen',
  count: (n: number) => (n === 1 ? '1 Workout' : `${n} Workouts`),
  stars: {
    word: (n: number) => STAR_WORDS[n as keyof typeof STAR_WORDS] ?? '',
    a11y: (n: number) =>
      `Schwierigkeit ${n} von 5 Sternen: ${STAR_WORDS[n as keyof typeof STAR_WORDS] ?? ''}`,
  },
  filters: {
    title: 'Filter',
    /** Zugeklappter Filter-Knopf, wenn ein Filter gesetzt ist (26.10.2026). */
    titleActive: 'Filter (aktiv)',
    stars: 'Schwierigkeit',
    duration: 'Dauer',
    category: 'Ziel',
    all: 'Alle',
    noEquipment: 'Nur ohne Geräte',
    durations: { short: 'bis 15 Min.', medium: '16–30 Min.', long: 'über 30 Min.' },
    starsChip: (n: number) => `${'★'.repeat(n)} ${STAR_WORDS[n as keyof typeof STAR_WORDS] ?? ''}`,
    starsChipA11y: (n: number) =>
      `${n} ${n === 1 ? 'Stern' : 'Sterne'}: ${STAR_WORDS[n as keyof typeof STAR_WORDS] ?? ''}`,
    resultLive: (n: number) => (n === 1 ? '1 Workout gefunden' : `${n} Workouts gefunden`),
  },
  categories: {
    full_body: 'Ganzkörper',
    core: 'Bauch & Rumpf',
    upper_body: 'Oberkörper',
    legs_glutes: 'Beine & Po',
    hiit_cardio: 'HIIT & Cardio',
    mobility: 'Mobilität',
    back_fit: 'Rücken-fit',
    run_strength: 'Lauf-Kraft',
    yoga: 'Yoga',
    pilates: 'Pilates',
    rowing: 'Rudern',
  },
  formats: {
    circuit: 'Zirkel',
    interval: 'Intervall',
    sets_reps: 'Sätze × Wdh.',
    flow: 'Flow',
  },
  minutes: (n: number) => `${n} Min.`,
  noEquipment: 'ohne Geräte',
  doneToday: 'Heute erledigt ✓',
  card: {
    open: (title: string) => `${title} öffnen`,
  },
  detail: {
    back: 'Zurück zu den Workouts',
    notFound: 'Dieses Workout gibt es nicht (mehr).',
    format: 'Ablauf',
    equipment: 'Geräte',
    exercises: 'Übungen',
    warmup: 'Aufwärmen',
    cooldown: 'Zum Schluss',
    rounds: (n: number) => (n === 1 ? '1 Runde' : `${n} Runden`),
    roundRest: (s: number) => `${s} s Pause zwischen den Runden`,
    circuitHow: (rounds: number) =>
      `Alle Übungen nacheinander, dann die nächste Runde – insgesamt ${rounds === 1 ? '1 Runde' : `${rounds} Runden`}.`,
    intervalHow: (rounds: number) =>
      `Jede Übung nach Zeit, der Timer läuft von selbst weiter – ${rounds === 1 ? '1 Runde' : `${rounds} Runden`}.`,
    setsHow: 'Übung für Übung: Satz machen, abhaken, Pause, nächster Satz.',
    reps: (n: number, perSide: boolean) => `${n} Wdh.${perSide ? ' je Seite' : ''}`,
    seconds: (n: number) => `${n} s`,
    sets: (n: number) => (n === 1 ? '1 Satz' : `${n} Sätze`),
    rest: (s: number) => (s === 0 ? 'ohne Pause' : `${s} s Pause`),
    exerciseInfo: (name: string) => `${name}: Anleitung öffnen`,
    duration: (n: number) => `etwa ${n} Min. plus Aufwärmen`,
    start: 'Workout starten',
    resume: 'Weiter mit dem Workout',
    libraryMissing: 'Die Übungen sind gerade nicht verfügbar – bitte später erneut versuchen.',
  },
  safety: {
    title: 'Sicherheitshinweis',
    warmup:
      'Wärm dich vorher auf (siehe „Aufwärmen“). Bei Schmerzen, Schwindel oder Atemnot sofort aufhören.',
    hard_for_beginner:
      'Dieses Workout ist schwer (4–5 Sterne). Als Einsteiger lieber mit 1–3 Sternen beginnen und die Technik sicher lernen.',
    medical:
      'Dein Gesundheits-Check zeigt Punkte, die du vorher ärztlich abklären solltest. Wähle bis dahin lieber leichte Workouts.',
    pregnancy:
      'Die Workouts sind nicht für die Schwangerschaft entwickelt. Bitte sprich vorher mit deiner Ärztin oder deinem Arzt.',
    excluded_exercises:
      'Dieses Workout enthält Übungen, die dein Plan wegen deiner Angaben auslässt (z. B. Sprünge). Wähle lieber ein anderes Workout.',
  },
  timer: {
    title: (title: string) => title,
    prepare: 'Gleich geht’s los',
    work: 'Los!',
    rest: 'Pause',
    restRound: 'Rundenpause',
    restSet: 'Satzpause',
    round: (n: number, of: number) => `Runde ${n} von ${of}`,
    set: (n: number, of: number) => `Satz ${n} von ${of}`,
    progress: (done: number, total: number) => `${done} von ${total} erledigt`,
    remaining: (s: number) => `noch ${s} Sekunden`,
    reps: (n: number, perSide: boolean) => `${n} Wiederholungen${perSide ? ' je Seite' : ''}`,
    next: 'Als Nächstes',
    nextNone: 'Danach bist du fertig.',
    pause: 'Pausieren',
    resume: 'Fortsetzen',
    skip: 'Überspringen',
    skipRest: 'Pause beenden',
    done: 'Erledigt ✓',
    doneSet: 'Satz erledigt ✓',
    end: 'Beenden',
    paused: 'Pausiert',
    signals: 'Ton und Vibration',
    signalsHint: 'Im Browser nur Ton (ohne Vibration).',
    keepAwake: 'Der Bildschirm bleibt an, solange der Timer läuft.',
    endConfirmTitle: 'Workout beenden?',
    endConfirmText: 'Was du schon erledigt hast, kannst du danach für heute speichern.',
    endConfirm: 'Beenden',
    endCancel: 'Weitermachen',
    leaveHint:
      'Bleib auf dieser Seite, solange der Timer läuft – beim Verlassen oder Neuladen endet er.',
    stepLive: (text: string) => text,
  },
  finish: {
    title: 'Geschafft!',
    titleEarly: 'Workout beendet',
    summary: (done: number, total: number, minutes: number) =>
      `${done} von ${total} erledigt · ${minutes} Min.`,
    rounds: (done: number, total: number) => `Runden komplett: ${done} von ${total}`,
    rpe: 'Wie anstrengend war es? (0 = gar nicht, 10 = maximal, freiwillig)',
    note: 'Notiz (freiwillig)',
    save: 'Für heute speichern',
    saved: 'Gespeichert – das Workout steht in deinem Tagebuch am heutigen Tag.',
    queued: 'Offline gespeichert – wird übertragen, sobald du wieder online bist.',
    rejected:
      'Das Speichern wurde abgelehnt. Der Eintrag liegt als Entwurf unter „Training“ und kann dort geprüft werden.',
    conflict:
      'Der Eintrag wurde auf einem anderen Gerät geändert – er liegt als Entwurf unter „Training“.',
    invalid: 'Dieser Eintrag ist ungültig und wurde nicht gespeichert.',
    nothing: 'Es wurde keine Übung erledigt – es gibt nichts zu speichern.',
    failed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
    toDay: 'Zum heutigen Tag',
    again: 'Zurück zu den Workouts',
    discard: 'Nicht speichern',
  },
  tile: {
    title: 'Workouts',
    text: (total: number, withoutEquipment: number) =>
      `${total} Workouts mit Timer, ${withoutEquipment} davon ohne Geräte.`,
    doneToday: (n: number) =>
      n === 1 ? 'Heute: 1 Workout erledigt' : `Heute: ${n} Workouts erledigt`,
    open: 'Workouts öffnen',
    statLabel: (withoutEquipment: number) => `Workouts · ${withoutEquipment} ohne Geräte`,
  },
  /** Kopf des Reiters (Hero-Karte, Design 23.10.2026). */
  hero: { eyebrow: 'Deine Workout-Bibliothek' },
  calendarBadge: 'Workout',
  logEntry:
    'Workout aus der Bibliothek (freie Einheit) – zählt in Woche und Verlauf, nicht für die Vorgaben deines Plans.',
} as const;
