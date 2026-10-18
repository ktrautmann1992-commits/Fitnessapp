import type {
  CompetitionDayKind,
  ExpectedRaceMinutesSource,
  RaceFuelingNotice,
} from '@fitnessapp/core';

/**
 * Texte der Wettkampf-Ernährung (Phase 10, Etappe W1, docs/PLAN-PHASE-10.md Abschnitt 10): Carb-Loading-Tage,
 * Vorabend, Renntag mit Zeitleiste (Gel-/Trinkplan) und „Nach dem Rennen“. Feste Bausteine, keine KI. Keine Health
 * Claims (nichts „verbessert die Leistung“), keine Marken, kein Koffein. Mengen in Gramm nur mit „Kalorienzahlen
 * anzeigen“ (die App blendet sie sonst aus); Farben nie allein – jede Tagesart hat ein Wort und ein Zeichen.
 * Wird in `de.ts` unter `competitionNutrition` eingebunden.
 */

const KINDS: Record<CompetitionDayKind, { symbol: string; label: string; text: string }> = {
  carb_loading: {
    symbol: '▲',
    label: 'Carb-Loading-Tag',
    text: 'Heute mehr Kohlenhydrate – so geplant. Iss, was du kennst und gut verträgst, z. B. Brot, Nudeln, Reis oder Kartoffeln.',
  },
  race_eve: {
    symbol: '◇',
    label: 'Vorabend',
    text: 'Morgen ist Renntag. Iss am Abend, was du kennst und gut verträgst – nichts Neues ausprobieren.',
  },
  race_day: {
    symbol: '◆',
    label: 'Renntag',
    text: 'Heute ist Renntag. Iss und trink nur, was du im Training schon ausprobiert hast.',
  },
  post_race: {
    symbol: '○',
    label: 'Nach dem Rennen',
    text: 'Heute geht es um Erholung: regelmäßig essen – Kohlenhydrate und Eiweiß – und genug trinken.',
  },
  normal: {
    symbol: '·',
    label: 'Wettkampfwoche',
    text: 'Diese Woche gehört zu deinem Wettkampf.',
  },
};

const STEP_TEXTS = {
  breakfast: (from: string, to: string) =>
    `${from} bis ${to} vor dem Start: Frühstück mit gut verträglichen Kohlenhydraten, z. B. Brötchen mit Honig, Haferflocken oder eine Banane.`,
  start: 'Start',
  fuel: (at: string) => `Nach ${at}: etwas Kohlenhydrate und ein paar Schlucke trinken`,
  finish: (at: string) => `Ziel (erwartet nach ${at})`,
  recovery: (from: string, to: string) =>
    `${from} bis ${to} nach dem Ziel: eine Mahlzeit mit Kohlenhydraten und Eiweiß, dazu trinken.`,
} as const;

const NOTICES: Record<RaceFuelingNotice, string> = {
  nothing_new:
    'Nichts Neues am Renntag: Iss und trink nur, was du im Training schon ausprobiert hast.',
  no_fuel_needed:
    'Bei weniger als einer Stunde brauchst du unterwegs nichts zu essen. Trink vorher wie gewohnt.',
  test_in_long_run: 'Probiere Gels, Getränke und Mengen vorher in deinen langen Läufen aus.',
  beginner_moderate_only:
    'Für sehr lange Wettkämpfe nennen Fachleute für Geübte auch größere Mengen. Wir planen für dich bewusst die kleinere Menge.',
  general_only:
    'Unterwegs reichen kleine Mengen Kohlenhydrate, z. B. ein Stück Banane. Größere Mengen sprich bitte vorher fachlich ab.',
  heat_and_salt:
    'Trink nach Durst, nicht darüber hinaus. Bei Hitze brauchst du mehr – bei langen, heißen Läufen auch etwas Salz (z. B. Salzbrezeln oder ein salzhaltiges Getränk).',
};

export const deCompetitionNutrition = {
  title: 'Wettkampf-Ernährung',
  kinds: KINDS,
  /** Zeile in der Woche und Überschrift am Tag, z. B. „◆ Renntag: Halbmarathon“ (Zeichen + Wort, nie nur Farbe). */
  dayLabel: (symbol: string, label: string, discipline: string) =>
    `${symbol} ${label}: ${discipline}`,
  dayA11y: (label: string, discipline: string) => `${label}, ${discipline}`,
  noDeficit: 'Rund um deinen Wettkampf planen wir ohne Defizit.',
  weightGoalPaused:
    'Dein Abnehm-Ziel ruht wegen deines Wettkampfs und läuft danach von selbst weiter – ohne Aufholen.',
  carbLoadingGeneral:
    'Vor deinem Wettkampf: Iss, was du kennst und gut verträgst. Mehr Kohlenhydrate planen wir hier nicht ein.',
  carbLoadingNumbers: 'Dein Tagesziel bleibt gleich – mehr Kohlenhydrate, etwas weniger Fett.',
  carbLoadingNotReached:
    'Die oft genannten 8–10 g Kohlenhydrate pro kg Körpergewicht passen nicht in dein Tagesziel. Mehr planen wir bewusst nicht.',
  raceEnergy: 'Dein Wettkampf ist in deinem Tagesziel schon eingerechnet (geschätzt).',
  expected: (duration: string, source: string) => `Erwartete Dauer: etwa ${duration} (${source})`,
  minutesSources: {
    target_time: 'nach deiner Zielzeit',
    reference: 'aus deiner Referenzzeit',
    estimate: 'grob geschätzt',
  } satisfies Record<ExpectedRaceMinutesSource, string>,
  medical:
    'Bei Vorerkrankungen (z. B. Diabetes), in der Schwangerschaft oder wenn du Medikamente nimmst, sprich deine Wettkampf-Ernährung bitte vorher ärztlich ab.',
  timelineTitle: 'Dein Renntag – Zeitleiste',
  timelineA11y: 'Zeitleiste für den Renntag',
  steps: STEP_TEXTS,
  breakfastCarbs: (min: string, max: string) => `etwa ${min}–${max} g Kohlenhydrate`,
  fuelCarbs: (min: string, max: string) => `etwa ${min}–${max} g Kohlenhydrate`,
  fuelExamples: 'z. B. Gel, Banane oder Sportgetränk',
  perHour: (min: string, max: string) =>
    `Richtwert unterwegs: ${min}–${max} g Kohlenhydrate pro Stunde.`,
  perHourUpTo: (max: string) => `Richtwert unterwegs: bis ${max} g Kohlenhydrate pro Stunde.`,
  upToCarbs: (max: string) => `bis ${max} g Kohlenhydrate`,
  drink: (min: string, max: string) => `Trinken: Richtwert ${min}–${max} ml pro Stunde.`,
  numbersHidden: 'Mengen in Gramm sind ausgeblendet („Kalorienzahlen anzeigen“ ist aus).',
  notices: NOTICES,
  guide: 'Ratgeber „Wettkampf-Ernährung“',
  guideA11y: 'Ratgeber Wettkampf-Ernährung öffnen',
  /** „Mein Wettkampf“: Sprung zur Ernährung am Renntag. */
  openRaceDay: 'Ernährung zum Renntag',
  openRaceDayA11y: 'Ernährung am Renntag öffnen',
} as const;
