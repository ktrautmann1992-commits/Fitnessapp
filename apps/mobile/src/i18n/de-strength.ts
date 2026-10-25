/**
 * Texte „Kraft-Entwicklung“ (Gründer-Freigabe 25.10.2026, KONZEPT 11.4): Kurve je Übung, Vergleich im Eintrag,
 * Kachel unter Fortschritt. Neutral formuliert: eigene frühere Werte, keine „Bestleistung“, kein „Rekord“, keine
 * Abzeichen, keine Bewertung („super“, „schlecht“) – weniger als vorher ist genauso sachlich beschrieben wie mehr.
 * Keine geschätzte Maximalkraft (1RM).
 */
export const deStrength = {
  title: 'Kraft-Entwicklung',
  tileIntro: 'Deine meist trainierten Übungen der letzten 3 Monate.',
  tileEmpty:
    'Sobald du eine Übung zweimal eingetragen hast, siehst du hier, wie sie sich entwickelt.',
  tileOpenA11y: (name: string) => `Kraft-Entwicklung: ${name} öffnen`,
  tileAll: 'Alle Übungen im Verlauf',
  chartTitle: 'Entwicklung',
  metrics: {
    weight: 'Gewicht',
    volume: 'Volumen',
    reps: 'Wiederholungen',
    time: 'Haltezeit',
  },
  metricHints: {
    weight: 'Schwerster Satz je Training.',
    volume: 'Gewicht × Wiederholungen aller Sätze je Training.',
    reps: 'Alle Wiederholungen je Training.',
    time: 'Längste Haltezeit je Training.',
  },
  metricLabel: 'Kennzahl',
  rangeLabel: 'Zeitraum',
  ranges: { '4w': '4 W', '3m': '3 M', all: 'Alles' },
  rangesA11y: { '4w': '4 Wochen', '3m': '3 Monate', all: 'Alles' },
  value: {
    weight: (kg: string) => `${kg} kg`,
    volume: (kg: string) => `${kg} kg`,
    reps: (n: string) => `${n} Wdh.`,
    time: (s: string) => `${s} s`,
  },
  valueA11y: {
    weight: (kg: string) => `${kg} Kilogramm`,
    volume: (kg: string) => `${kg} Kilogramm Volumen`,
    reps: (n: string) => `${n} Wiederholungen`,
    time: (s: string) => `${s} Sekunden`,
  },
  /** „+5 kg gegenüber vor 4 Wochen“ – Vorzeichen ausgeschrieben, auch bei weniger. */
  change: (delta: string, weeks: number) =>
    `${delta} gegenüber vor ${weeks === 1 ? '1 Woche' : `${weeks} Wochen`}`,
  same: (weeks: number) => `gleich wie vor ${weeks === 1 ? '1 Woche' : `${weeks} Wochen`}`,
  changeA11y: (value: string, more: boolean, weeks: number) =>
    `${value} ${more ? 'mehr' : 'weniger'} als vor ${weeks === 1 ? '1 Woche' : `${weeks} Wochen`}`,
  deload: 'Erholungswoche – bewusst leichter.',
  noCompare: 'Noch kein Vergleich – dafür braucht es ein Training von vor mindestens einer Woche.',
  logLine: (name: string, text: string) => `${name}: ${text}`,
  empty: 'Zu dieser Übung gibt es noch keine Werte für diese Kennzahl.',
  emptyRange: 'In diesem Zeitraum gibt es keine Einträge. Wähle einen längeren Zeitraum.',
  single: 'Ab dem zweiten Training siehst du hier eine Linie.',
  deloadLegend: 'Hohler Punkt = Erholungswoche',
  segmentLegend: 'Lücke = andere Belastung (z. B. vorher ohne Gewicht)',
  chartA11y: (
    metric: string,
    count: number,
    from: string,
    to: string,
    first: string,
    last: string,
  ) =>
    count === 1
      ? `${metric}: 1 Training am ${from}, ${first}.`
      : `${metric}: ${count} Trainings vom ${from} bis ${to}, von ${first} auf ${last}.`,
  sparkA11y: (name: string, first: string, last: string) => `${name}: von ${first} auf ${last}.`,
  failed: 'Die Entwicklung lässt sich gerade nicht anzeigen.',
} as const;
