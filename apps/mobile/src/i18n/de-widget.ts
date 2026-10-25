/**
 * Texte für das Widget auf dem Startbildschirm und den Schalter in den Einstellungen (docs/PLAN-WIDGET.md,
 * Gründer-Entscheidung 25.10.2026). Neutral, ohne Druck. Wird in `de.ts` unter `widget` eingebunden; das Widget selbst
 * (Hintergrund-Aufgabe ohne geöffnete App) liest diese Datei direkt, damit es nicht alle Texte laden muss.
 */

/** Ganze Zahl mit Tausenderpunkt („6.240“). */
const n = (value: number) => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const deWidget = {
  /** Name in der Widget-Auswahl des Startbildschirms. */
  label: 'Alpha5 – Heute',
  description: 'Training heute, Schritte und kcal übrig',
  eyebrow: 'HEUTE',
  rest: 'Ruhetag',
  restHint: 'Erholung gehört zum Plan.',
  noPlan: 'Noch kein Trainingsplan',
  done: 'Erledigt ✓',
  open: 'Antippen zum Starten',
  stepsLabel: 'Schritte',
  stepsValue: (steps: number) => n(steps),
  stepsOf: (goal: number) => `von ${n(goal)}`,
  stepsReached: 'Ziel erreicht',
  kcalLeft: 'kcal übrig',
  kcalOver: 'kcal zu viel',
  kcalValue: (kcal: number) => n(kcal),
  refresh: 'App öffnen zum Aktualisieren',
  off: 'Widget aus',
  offHint: 'In Alpha5 einschalten: Mehr → Einstellungen → Widget',
  /** Ansage für Bildschirmleser (ganzes Widget). */
  a11y: (parts: readonly string[]) => `Alpha5 heute. ${parts.join('. ')}. Antippen öffnet Heute.`,
  a11ySteps: (steps: number, goal: number) => `${n(steps)} von ${n(goal)} Schritten`,
  a11yKcal: (kcal: number, over: boolean) =>
    over ? `${n(kcal)} kcal mehr als dein Tagesziel` : `${n(kcal)} kcal übrig`,
  settings: {
    section: 'Startbildschirm',
    toggle: 'Widget auf dem Startbildschirm',
    hint: 'Zeigt dein Training heute, deine Schritte und „kcal übrig“ als Widget auf dem Startbildschirm. Achtung: Was dort steht, sieht jede Person, die dein entsperrtes Handy sieht. Schritte nur mit verbundener Uhr, kcal nur mit „Kalorienzahlen anzeigen“ – sonst bleiben sie weg. Kein Gewicht, kein Zyklus, keine Gesundheitsangaben.',
    howTo:
      'Hinzufügen: Startbildschirm lange gedrückt halten → Widgets → Alpha5 → „Alpha5 – Heute“ auf den Startbildschirm ziehen.',
    onlyAndroid:
      'Das Widget gibt es zuerst in der Android-App. Fürs iPhone folgt es mit einem späteren Update.',
  },
} as const;
