/**
 * Texte für die Kachel „Schritte“ mit Tagesziel und „Schrittziel“ auf der Smartwatch-Seite (Gründer-Wunsch 22.10.2026,
 * docs/PLAN-PHASE-8.md 13.4). Neutral, ohne Druck: kein „Streak“, keine Ranglisten.
 */

/** Ganze Zahl mit Tausenderpunkt („6.240“). */
const n = (value: number) => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

export const deSteps = {
  tile: {
    title: 'Schritte',
    /** Große Zahl in der Mitte des Rings. */
    value: (steps: number) => n(steps),
    /** Unter der Zahl. */
    of: (goal: number) => `von ${n(goal)}`,
    reached: 'Ziel erreicht',
    remaining: (steps: number) => `Noch ${n(steps)} bis zum Ziel`,
    /** Ansage für Bildschirmleser. */
    a11y: (steps: number, goal: number, percent: number, reached: boolean) =>
      `${n(steps)} von ${n(goal)} Schritten, ${percent} Prozent${reached ? ', Ziel erreicht' : ''}`,
    open: 'Smartwatch und Schrittziel öffnen',
    noData: 'Noch keine Schritte heute – synchronisiert alle 15 Minuten.',
    noWatch:
      'Zähl deine Schritte mit dem Handy oder deiner Smartwatch – dann füllt sich hier dein Schrittziel.',
    noConsent:
      'Für Schritte vom Handy oder von der Smartwatch brauchst du die Einwilligung „Smartwatch-Daten“.',
    onlyAndroid: 'Schritte gibt es in der Android-App – vom Handy oder von der Smartwatch.',
    connect: 'Uhr verbinden',
    /** Kurz (halbe Kachel, eine Zeile); vorgelesen wird `phoneA11y`. */
    phone: 'Handy nutzen',
    phoneA11y: 'Schritte vom Handy nutzen',
    loading: 'Schritte werden geladen …',
    /** Ansage der Mini-Balken: „Schritte der letzten 7 Tage: Freitag 7.400, …, heute 6.240“. */
    barsA11y: (days: readonly { weekday: number; steps: number | null }[]) =>
      `Schritte der letzten 7 Tage: ${days
        .map(
          (d, i) =>
            `${i === days.length - 1 ? 'heute' : (WEEKDAYS[d.weekday - 1] ?? '')} ${
              d.steps === null ? 'kein Wert' : n(d.steps)
            }`,
        )
        .join(', ')}`,
  },
  goal: {
    title: 'Schrittziel',
    intro:
      'Wie viele Schritte möchtest du am Tag gehen? Der Ring auf der Übersicht füllt sich bis zu diesem Ziel.',
    hint: 'Studien zeigen: Schon 6.000 bis 8.000 Schritte am Tag tun der Gesundheit spürbar gut – mehr ist schön, aber kein Muss.',
    value: (goal: number) => `${n(goal)} Schritte`,
    less: 'Weniger',
    more: 'Mehr',
    lessA11y: (step: number) => `Ziel um ${n(step)} Schritte senken`,
    moreA11y: (step: number) => `Ziel um ${n(step)} Schritte erhöhen`,
    presets: 'Schnellauswahl',
    preset: (goal: number) => n(goal),
    saved: (goal: number) => `Schrittziel: ${n(goal)} Schritte gespeichert.`,
    saveFailed: 'Das Schrittziel konnte nicht gespeichert werden. Bitte versuch es noch einmal.',
  },
} as const;
