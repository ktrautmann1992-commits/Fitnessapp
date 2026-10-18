import { ADJUST_EXPLAIN_DE, ADJUST_HINTS_DE } from '@fitnessapp/core';

/**
 * Texte der Live-Anpassung (Phase 4b, Etappe D – docs/PLAN-PHASE-4B.md 8.1–8.5). Feste Textbausteine, KEINE KI.
 * Wird in `de.ts` unter `adjust` eingebunden. Die Erklärsätze selbst sind fachliche Texte zur Logik und stehen in
 * packages/core/src/adjust/texts-de.ts (hier nur eingebunden, nie doppelt).
 */
export { ADJUST_EXPLAIN_DE, ADJUST_HINTS_DE };

const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

export const deAdjust = {
  explain: ADJUST_EXPLAIN_DE,
  hints: ADJUST_HINTS_DE,
  title: 'Warum hat sich mein Plan geändert?',
  open: 'Warum hat sich mein Plan geändert?',
  back: 'Zurück',
  /** Kennzeichen „angepasst“ – nie nur Farbe: Zeichen + Wort (8.5). */
  badge: '↻ angepasst',
  badgeA11y: 'Angepasst – Erklärung öffnen',
  why: 'Warum?',
  sessionAdjusted: 'Diese Einheit wurde für dich angepasst.',
  weightA11y: (before: string, after: string) =>
    `Gewicht angepasst von ${before} auf ${after} Kilogramm`,
  exerciseWeight: (name: string, before: string, after: string) =>
    `${name}: ${before} kg → ${after} kg`,
  exerciseReps: (name: string) => `${name}: unteres Wiederholungsziel, ohne Zusatzsatz`,
  exerciseFaster: (name: string) => `${name}: schneller steigern`,
  exerciseHold: (name: string) => `${name}: etwas kürzer halten`,
  empty: 'Noch keine Anpassungen – dein Plan läuft wie geplant.',
  weekOf: (date: string) => `Angepasst in der Woche ab ${date}`,
  createdOn: (date: string) => `Angepasst am ${date}`,
  /** Kurztitel je Regel (Liste). */
  ruleTitles: {
    fast_increase: 'Schneller steigern',
    load_reduce: 'Gewicht gesenkt',
    volume_reduce: 'Ein Satz weniger',
    deload_forward: 'Erholungswoche vorgezogen',
    endurance_reduce: 'Ausdauer etwas kürzer',
    stagnation_variation: 'Übung getauscht',
    fewer_days: 'Weniger Trainingstage?',
  },
  status: {
    applied: 'Aktiv',
    pending_confirmation: 'Wartet auf deine Antwort',
    confirmed: 'Angenommen',
    declined: 'Abgelehnt',
    expired: 'Abgelaufen',
    reverted: 'Zurückgenommen',
    superseded: 'Überholt',
  },
  // Vorher → nachher (nur Zahlen und Namen aus der Bibliothek).
  beforeAfterWeight: (before: string, after: string) => `Gewicht: ${before} kg → ${after} kg`,
  beforeAfterReps: (before: number, after: number) => `Wiederholungsziel: ${before} → ${after}`,
  beforeAfterHold: (before: number, after: number) => `Haltezeit: ${before} s → ${after} s`,
  setsPerExercise: (n: number) => `Sätze: je Übung ${n} weniger`,
  beforeAfterMinutes: (before: number, after: number) => `Minuten je Einheit: ${before} → ${after}`,
  beforeAfterExercise: (before: string, after: string) => `${before} → ${after}`,
  beforeAfterDeload: (week: string, swapped: string) =>
    `Erholungswoche: ab ${week} statt ab ${swapped}`,
  beforeAfterDays: (before: number, after: number) => `Trainingstage: ${before} → ${after}`,
  revert: 'Rückgängig',
  revertA11y: (title: string) => `${title} rückgängig machen`,
  reverted: 'Anpassung zurückgenommen – dein Plan ist wieder wie vorher.',
  revertNotPossible: 'Nicht mehr rückgängig machbar, weil du schon trainiert hast.',
  revertFailed: 'Das hat nicht geklappt. Bitte versuche es noch einmal.',
  offline: 'Dafür brauchst du kurz Verbindung.',
  proposalExpired: 'Dieser Vorschlag ist nicht mehr aktuell.',
  premiumEnded: 'Neue Anpassungen gibt es mit Premium.',
  premiumEndedTest:
    '„Premium simulieren“ ist aus – die bisherigen Anpassungen bleiben, neue kommen nicht dazu.',
  loadFailed: 'Die Anpassungen lassen sich gerade nicht laden. Dein Plan bleibt gültig.',
  // Vorschlag weniger Trainingstage (R5, nur mit Bestätigung).
  proposalTitle: 'Weniger Trainingstage?',
  proposalText: (done: number, planned: number) =>
    `In den letzten 3 Wochen hast du ${done} von ${planned} Einheiten geschafft. Passt ein Tag weniger besser?`,
  proposalOpen: 'Ansehen',
  fewerTitle: 'Weniger Trainingstage',
  fewerNumbers: (done: number, planned: number, days: number) =>
    `Du hast in den letzten 3 Wochen ${done} von ${planned} Einheiten geschafft. Vorschlag: ${days} statt ${days + 1} Trainingstage.`,
  fewerDropLabel: 'Welcher Tag soll wegfallen?',
  fewerDropHint: 'Vorgeschlagen ist der Tag, an dem am häufigsten etwas ausgefallen ist.',
  fewerSuggested: 'vorgeschlagen',
  fewerNewPlan:
    'Dafür entsteht ein neuer Plan ab heute. Dein Tagebuch bleibt vollständig erhalten.',
  fewerConfirm: 'Umstellen',
  fewerDecline: 'Nein danke',
  fewerDone: (days: number) => `Umgestellt: Dein neuer Plan hat ${days} Trainingstage.`,
  fewerDeclined: 'Alles bleibt wie es ist.',
  fewerFailed: 'Umstellen hat nicht geklappt. Dein bisheriger Plan bleibt.',
  fewerMissing: 'Diesen Vorschlag gibt es nicht mehr.',
  weekday: (isoWeekday: number) => WEEKDAYS[isoWeekday - 1] ?? '',
  // Einstellungen – Schalter nur im Testmodus (Wächter K2).
  settingsTitle: 'Live-Anpassung (Premium)',
  settingsText:
    'Mit Premium passt sich dein Plan nach jedem Training an: Gewicht senken, wenn es zu schwer war, eine leichtere Woche nach viel Belastung, eine neue Übung bei Stillstand. Jede Änderung wird erklärt.',
  simulate: 'Premium simulieren (nur Test)',
  simulateHint:
    'Nur im Testmodus: Die App rechnet die Regeln nach jedem gespeicherten Training auf diesem Gerät. Im echten Betrieb prüft der Server, ob du Premium hast.',
  simulateBrowserHint:
    'Im Browser bleiben die Anpassungen nur, solange dieser Tab offen ist (geschützter Speicher).',
  simulateFailed: 'Der Schalter ließ sich gerade nicht speichern.',
} as const;
