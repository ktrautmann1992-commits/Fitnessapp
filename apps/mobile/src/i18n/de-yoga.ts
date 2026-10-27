/**
 * Texte für Yoga, Pilates und Mobility (Sportarten Stufe 1 · Etappe Y, docs/PLAN-SPORTARTEN-STUFE-1.md 2.4): Flow-
 * Ablauf im Workout-Detail, Flow-Player, Karte „Erholungstag: Mobility“ und Einstellung. Eigene Datei, damit die
 * parallelen Etappen andere Texte nicht berühren. Ohne Heil- und ohne spirituelle Versprechen.
 */
export const deYoga = {
  detail: {
    how: 'Pose für Pose nach Zeit, ohne Pausen-Bildschirm. Bei „rechts / links“ läuft die Pose je Seite.',
    perSide: 'je Seite',
    sides: 'rechts / links',
    adjustedTitle: 'Für dich angepasst',
    swapped: (n: number) =>
      n === 1
        ? '1 Pose ersetzt durch eine Variante am Stuhl oder an der Wand.'
        : `${n} Posen ersetzt durch Varianten am Stuhl oder an der Wand.`,
    removed: (n: number) =>
      n === 1 ? '1 Pose entfällt für dich.' : `${n} Posen entfallen für dich.`,
    shortened: 'Halteposen dauern höchstens 30 Sekunden.',
    reason:
      'Grund: deine Angaben (z. B. Gesundheits-Check, Schwangerschaft, Alter, Schon-Modus) – die App wählt dann sanftere Posen.',
    minutes: (n: number) => `Für dich etwa ${n} Min.`,
    hiddenTitle: 'Passt gerade nicht',
    hidden:
      'Für deine Angaben wären zu viele Posen dieser Routine nicht geeignet. Probier eine sanftere, zum Beispiel „Stuhl-Yoga“ oder einen Erholungstag.',
    swappedFrom: (from: string) => `statt „${from}“`,
  },
  player: {
    pose: 'Pose',
    right: 'Rechte Seite',
    left: 'Linke Seite',
    sideA11y: (side: 'right' | 'left') => (side === 'right' ? 'rechte Seite' : 'linke Seite'),
    breathDefault: 'Ruhig und gleichmäßig durch die Nase atmen.',
    next: 'Als Nächstes',
    nextNone: 'Danach: Ende der Routine',
    skip: 'Pose überspringen',
    pause: 'Pause',
    resume: 'Weiter',
    ring: (remaining: string) => `Noch ${remaining}`,
    progress: (done: number, total: number) => `Pose ${Math.min(done + 1, total)} von ${total}`,
    image: (name: string) => `Bild: ${name}`,
    hint: 'Nur so weit gehen, wie es angenehm ist. Bei Schmerzen oder Schwindel die Pose lösen.',
  },
  recovery: {
    eyebrow: 'Erholung',
    title: (minutes: number) => `Erholungstag: Mobility ${minutes} min?`,
    rest: 'Heute ist trainingsfrei – eine ruhige Routine tut gut, ist aber kein Muss.',
    deload: 'Erholungswoche: zusätzlich eine ruhige Routine, wenn du magst – kein Muss.',
    notCounted: 'Zählt nicht für deinen Plan.',
    open: 'Routine ansehen',
    settingsHint: 'Abschaltbar in den Einstellungen.',
  },
  settings: {
    recovery: 'Erholungs-Routine vorschlagen',
    recoveryHint:
      'An trainingsfreien Tagen und in Erholungswochen schlägt „Heute“ eine ruhige Mobility-Routine vor. Sie zählt nicht für deinen Plan.',
    saveFailed: 'Die Einstellung konnte nicht gespeichert werden. Bitte versuch es erneut.',
  },
} as const;
