import type { RacePaceStrategy } from '@fitnessapp/core';

/**
 * Texte des Renn-Pace-Plans (docs/PLAN-PHASE-10.md Abschnitt 22). Keine Leistungsversprechen; die Anstrengung hat
 * immer Vorrang. Verpflegungs-Mengen kommen aus der Wettkampf-Ernährung (gleiche Texte, keine neuen Aussagen).
 * Wird in `de.ts` unter `racePace` eingebunden.
 */

const STRATEGIES: Record<RacePaceStrategy, { label: string; text: string }> = {
  even: {
    label: 'Gleichmäßig',
    text: 'Gleiches Tempo von Anfang bis Ende – auf flacher Strecke die sichere Wahl.',
  },
  negative: {
    label: 'Negativ',
    text: 'Die zweite Hälfte etwa 2 % schneller als die erste. Ruhig loslaufen, hinten zulegen.',
  },
};

export const deRacePace = {
  title: 'Dein Pace-Plan',
  intro: (time: string, pace: string) => `Zielzeit ${time} · Ø ${pace} pro km`,
  introPredicted: (time: string, pace: string) =>
    `Vorhersage aus deiner Referenzzeit ${time} · Ø ${pace} pro km`,
  strategies: STRATEGIES,
  strategyLabel: 'Aufteilung',
  course: 'Strecke mit Höhenprofil',
  courseHint:
    'Wähle eine gespeicherte Strecke (z. B. die GPX-Datei des Rennens), dann verteilen wir die Zeit nach Steigungen.',
  courseNone: 'Flach rechnen',
  courseNoRoutes:
    'Für ein Höhenprofil importiere die Strecke des Rennens als GPX-Datei unter Ausdauer.',
  courseUsed: (name: string) => `Höhenprofil: ${name}`,
  courseScaled:
    'Die Strecke ist etwas länger oder kürzer als die Renn-Distanz – wir haben sie angepasst.',
  courseMismatch:
    'Diese Strecke passt nicht zur Renn-Distanz (mehr als 10 % Unterschied). Wir rechnen flach.',
  targetLabel: { target: 'Zielzeit', predicted: 'Vorhersage' },
  averageLabel: 'Ø Tempo',
  table: 'Zwischenzeiten',
  tableA11y: 'Tabelle der Zwischenzeiten',
  col: {
    segment: 'Abschnitt',
    pace: 'Tempo',
    split: 'Zeit',
    total: 'Uhr',
    elevation: 'Höhe',
  },
  segment: (from: string, to: string) => `km ${from}–${to}`,
  segmentA11y: (from: string, to: string, pace: string, total: string) =>
    `Kilometer ${from} bis ${to}: Tempo ${pace} pro Kilometer, Uhr bei ${total}`,
  elevation: (up: number, down: number) => `+${up} / −${down} m`,
  fuelMark: '◆',
  fuelRow: (km: string, minute: number) => `◆ Verpflegung bei km ${km} (nach ${minute} min)`,
  fuelCarbs: (min: string, max: string) => `etwa ${min}–${max} g Kohlenhydrate`,
  fuelUpTo: (max: string) => `bis ${max} g Kohlenhydrate`,
  fuelTitle: 'Verpflegung unterwegs',
  fuelNone:
    'Bei unter einer Stunde brauchst du unterwegs nichts zu essen. Trink vorher wie gewohnt.',
  fuelGeneral:
    'Unterwegs reichen kleine Mengen Kohlenhydrate, z. B. ein Stück Banane. Größere Mengen sprich bitte vorher fachlich ab.',
  fuelLink: 'Mehr in der Wettkampf-Ernährung',
  chart: 'Tempo je Abschnitt',
  chartA11y: (slowest: string, fastest: string) =>
    `Balken: Tempo je Abschnitt, langsamster ${slowest}, schnellster ${fastest} pro Kilometer`,
  notPlausible: (predicted: string) =>
    `Die Zielzeit passt nicht zu deiner Referenzzeit (Vorhersage: ${predicted}). Der Plan zeigt sie trotzdem – plane lieber vorsichtig.`,
  usePredicted: 'Plan mit der Vorhersage zeigen',
  useTarget: 'Plan mit meiner Zielzeit zeigen',
  noTarget:
    'Für einen Pace-Plan brauchst du eine Zielzeit oder eine Referenzzeit (unter „Bearbeiten“).',
  effortFirst: 'Die Anstrengung hat Vorrang – bei Hitze, Wind und Steigungen langsamer.',
  print: 'Pace-Plan drucken / als PDF',
  printA11y: 'Pace-Plan als Druckansicht öffnen',
  printTitle: 'Pace-Plan',
  printFooter: 'Alpha5 · Pace-Plan · Richtwerte, die Anstrengung hat Vorrang',
  printHeading: (name: string) => `Pace-Plan: ${name}`,
  printNow: 'Drucken / als PDF speichern',
  back: 'Zurück',
  invalid:
    'Für diese Zielzeit können wir keinen Pace-Plan rechnen (Tempo außerhalb 2:30–15:00 min/km).',
} as const;
