import type { CycleDayHint } from './day-check';
import type { CycleNutritionHint } from './nutrition-hints';
import type {
  CycleBleeding,
  CycleLastPeriodAnswer,
  CycleStatus,
  CycleSymptom,
  CycleSymptomIntensity,
} from './schemas';
import type { CycleWarningCode } from './warnings';

/**
 * Textbausteine des Zyklus-Moduls (docs/PLAN-PHASE-9.md 3.2–3.7). Kurze Sätze, „du“, neutral, ohne Scham-Wörter,
 * ohne Diagnose-Wörter und ohne Heilversprechen (Wortlisten-Test in texts-de.test.ts). Fachprüfung vor dem
 * öffentlichen Livegang (ZY-G13). Notrufnummern und Telefonseelsorge stehen erst nach der Prüfung N2 im Text
 * (KONZEPT 14, SETUP Teil K) – bis dahin nur die Namen.
 */

/** Pflichtsatz MDR (Plan 3.6) – im Modul und im Einwilligungstext. */
export const CYCLE_MDR_SENTENCE =
  'Das Zyklus-Modul ist kein Medizinprodukt. Es ist nicht zur Verhütung oder Familienplanung geeignet und ersetzt keine ärztliche Untersuchung.';

/** Zweckbestimmung (Plan 3.6) – gleich für App, Store-Text und Landingpage. */
export const CYCLE_PURPOSE =
  'Allgemeine Fitness: Training nach selbst gemeldeter Tagesform anpassen. Die Hinweise sind allgemeine Gesundheitsinformationen ohne Krankheitsbezug; sie stellen nichts fest und ersetzen keine ärztliche Untersuchung.';

/** Einführung (3 Sätze, Plan 9.1). */
export const CYCLE_INTRO_DE = [
  'Mit dem Zyklus-Modul trägst du in wenigen Sekunden ein, wie es dir heute geht: Blutung, Energie und Beschwerden.',
  'An Tagen mit wenig Energie oder starken Beschwerden bietet dir die App eine leichtere Einheit an – du entscheidest.',
  'Dazu bekommst du Hinweise zu Ernährung und Hinweise, wann eine ärztliche Abklärung sinnvoll sein kann.',
] as const;

/** W7 – fester Satz unter dem Tages-Check und im Pausen-Bildschirm (ohne Nummern bis zur Prüfung N2). */
export const CYCLE_URGENT_DE = {
  body: 'Sehr starke oder plötzliche Schmerzen, sehr starke Blutung mit Schwindel oder Fieber: Hol dir sofort ärztliche Hilfe – im Notfall über den Notruf.',
  mental:
    'Geht es dir seelisch sehr schlecht? Die Telefonseelsorge ist rund um die Uhr für dich da – anonym und kostenlos.',
} as const;

/** Pausen-Bildschirm Schwangerschaft (Plan 3.2). */
export const CYCLE_PREGNANCY_DE = {
  title: 'Zyklus-Modul pausiert',
  body: 'Während der Schwangerschaft ist der Tages-Check pausiert. Blutungen oder Schmerzen in der Schwangerschaft immer ärztlich abklären lassen.',
  healthCheck:
    'Bitte aktualisiere auch deinen Gesundheits-Check, damit dein Trainingsplan dazu passt.',
} as const;

export const CYCLE_STATUS_DE: Readonly<Record<CycleStatus, string>> = {
  natural: 'Natürlicher Zyklus (auch Kupferspirale)',
  hormonal_contraception: 'Hormonelle Verhütung (Pille, Ring, Spirale, …)',
  perimenopause: 'Wechseljahre – Übergang',
  postmenopause: 'Nach den Wechseljahren (seit 12 Monaten keine Periode)',
  breastfeeding: 'Stillzeit',
  pregnant: 'Schwanger',
  unspecified: 'Möchte ich nicht sagen',
};

export const CYCLE_LAST_PERIOD_DE: Readonly<Record<CycleLastPeriodAnswer, string>> = {
  under_1_month: 'Vor weniger als 1 Monat',
  '1_to_3_months': 'Vor 1 bis 3 Monaten',
  over_3_months: 'Vor mehr als 3 Monaten',
  unknown: 'Weiß ich nicht',
};

export const CYCLE_BLEEDING_DE: Readonly<Record<CycleBleeding, string>> = {
  none: 'Keine',
  spotting: 'Schmierblutung',
  light: 'Leicht',
  medium: 'Mittel',
  heavy: 'Stark',
};

/** Hilfetext an „stark“ (Fachprüfung). */
export const CYCLE_HEAVY_HELP_DE =
  'Stark heißt z. B.: Binde oder Tampon etwa stündlich wechseln, große Klumpen, doppelter Schutz nötig.';

export const CYCLE_SYMPTOM_DE: Readonly<Record<CycleSymptom, string>> = {
  cramps: 'Unterleibsschmerzen/Krämpfe',
  headache: 'Kopfschmerzen',
  back_pain: 'Rückenschmerzen',
  breast_tenderness: 'Brustspannen',
  digestion: 'Verdauung/Blähungen',
  nausea: 'Übelkeit',
  fatigue: 'Müdigkeit',
  low_mood: 'Stimmung gedrückt',
  hot_flushes: 'Hitzewallungen',
  sleep_problems: 'Schlafprobleme',
};

export const CYCLE_INTENSITY_DE: Readonly<Record<CycleSymptomIntensity, string>> = {
  mild: 'leicht',
  strong: 'stark',
};

/** Energie-Skala mit Worten (Plan 9.4, nicht nur Zahlen). */
export const CYCLE_ENERGY_DE: Readonly<Record<1 | 2 | 3 | 4 | 5, string>> = {
  1: 'Sehr wenig',
  2: 'Wenig',
  3: 'Mittel',
  4: 'Viel',
  5: 'Sehr viel',
};

export const CYCLE_SLEEP_DE: Readonly<Record<1 | 2 | 3 | 4 | 5, string>> = {
  1: 'Schlecht',
  2: 'Eher schlecht',
  3: 'Mittel',
  4: 'Gut',
  5: 'Sehr gut',
};

/** Warnungen: Titel und Text je Code (Plan 3.4). Ruhiger Ton, ohne Diagnose-Wörter. */
export const CYCLE_WARNING_DE: Readonly<Record<CycleWarningCode, { title: string; body: string }>> =
  {
    W1: {
      title: 'Periode bleibt aus',
      body: 'Deine Periode ist seit drei Monaten ausgeblieben. Lass das ärztlich abklären.',
    },
    W1b: {
      title: 'Training und Energie',
      body: 'Viel Training und zu wenig Energie aus dem Essen können dahinterstecken. Sprich das bei der Ärztin oder dem Arzt an.',
    },
    W1c: {
      title: 'Oft wenig Energie',
      body: 'Du fühlst dich oft energielos und trainierst viel. Zu wenig Energie aus dem Essen kann dahinterstecken – sprich das ärztlich an.',
    },
    W2: {
      title: 'Zykluslänge',
      body: 'Deine Zyklen sind öfter deutlich kürzer oder länger als üblich. Lass das bei Gelegenheit ärztlich abklären.',
    },
    W3: {
      title: 'Lange Periode',
      body: 'Deine Periode dauert länger als acht Tage. Lass das ärztlich abklären.',
    },
    W3_hormonal: {
      title: 'Lange Blutung',
      body: 'Deine Blutung dauert länger als acht Tage. Mit hormoneller Verhütung kann das vorkommen – sprich es trotzdem bei deiner Ärztin oder deinem Arzt an.',
    },
    W4: {
      title: 'Starke Blutung',
      body: 'Starke Blutungen können zu wenig Eisen im Blut führen. Lass deine Blutwerte ärztlich prüfen.',
    },
    W4_hormonal: {
      title: 'Starke Blutung',
      body: 'Starke Blutungen können zu wenig Eisen im Blut führen. Mit hormoneller Verhütung sprich das bitte ärztlich an und lass deine Blutwerte prüfen.',
    },
    W5: {
      title: 'Starke Regelschmerzen',
      body: 'Starke Regelschmerzen musst du nicht einfach aushalten. Sprich mit deiner Ärztin oder deinem Arzt.',
    },
    W6: {
      title: 'Blutung nach den Wechseljahren',
      body: 'Blutungen nach den Wechseljahren solltest du zeitnah ärztlich abklären lassen.',
    },
    W8: {
      title: 'Blutung zwischen den Perioden',
      body: 'Blutungen zwischen den Perioden solltest du ärztlich abklären lassen.',
    },
    mood_support: {
      title: 'Seelisch belastet?',
      body: CYCLE_URGENT_DE.mental,
    },
  };

/** Hinweis zu W1b/W1c: verlinkt „Ziel ändern“ (Erhalt) – keine automatische Änderung (ZY-G12). */
export const CYCLE_GOAL_LINK_DE = 'Ziel auf „Gewicht halten“ ändern';

/** Hinweise des Tages (Plan 3.3). */
export const CYCLE_DAY_HINT_DE: Readonly<Record<CycleDayHint, string>> = {
  lighter_often:
    'Fühlst du dich öfter so schlapp? Sprich mit deiner Ärztin oder deinem Arzt. An deinem Plan ändert sich nichts.',
  race_day:
    'Die Periode am Renntag ist häufig; im Mittel ändert sie die Leistung kaum. Plane, was dir guttut.',
};

/** Ernährungs-Hinweise (Plan 3.5) – ohne Zahlen, ohne Präparat. */
export const CYCLE_NUTRITION_HINT_DE: Readonly<Record<CycleNutritionHint, string>> = {
  iron: 'Eisenreiche Lebensmittel helfen: z. B. Hülsenfrüchte, Vollkorn, Hirse, Haferflocken, Fleisch. Vitamin-C-reiche Lebensmittel dazu verbessern die Aufnahme. Kaffee und Schwarztee besser nicht direkt zum Essen.',
  iron_plant:
    'Eisenreiche Lebensmittel helfen: z. B. Hülsenfrüchte, Vollkorn, Hirse, Haferflocken. Vitamin-C-reiche Lebensmittel dazu verbessern die Aufnahme. Kaffee und Schwarztee besser nicht direkt zum Essen.',
  drink: 'Denk ans Trinken – besonders an Trainingstagen.',
};

/** Frei wählbarer Hinweis in der Hilfe (nicht ausgelöst). */
export const CYCLE_HUNGER_HINT_DE =
  'Mehr Hunger an manchen Tagen ist normal. Dein Plan bleibt; eine zusätzliche Kleinigkeit im Rahmen deines Tagesziels ist in Ordnung.';

/** Angebot „Heute leichter?“ (Plan 3.3) – ohne Zyklus-Wort, damit es auch auf „Heute“ stehen darf. */
export const LIGHTER_OFFER_DE = {
  question: 'Heute leichter?',
  highlighted: 'Heute leichter? – passend zu deiner Tagesform',
  lighter: 'Heute leichter',
  asPlanned: 'Wie geplant',
  strength: 'Je Übung ein Satz weniger und etwas weniger Anstrengung – gleiche Gewichte.',
  endurance: 'Locker und etwas kürzer.',
  noProgress: 'Ein leichterer Tag zählt nicht für die Steigerung.',
} as const;

/** Rückfrage nach 45 Tagen ohne Blutung (Plan 3.2). */
export function cycleLongGapQuestionDe(days: number): string {
  return `Hattest du seit ${days} Tagen keine Blutung?`;
}

/** „Tag X seit Periodenbeginn“ – keine Phasen-Namen, keine Prognose. */
export function cycleDayOfCycleDe(day: number): string {
  return `Tag ${day} seit Periodenbeginn`;
}

/**
 * Statischer Ratgeber „Wann ärztlich abklären?“ (Flag `cycle_warnings` aus, Plan 3.4/S1): dieselben Schwellen als
 * Text, ohne persönliche Auslösung.
 */
export const CYCLE_STATIC_GUIDE_DE = {
  title: 'Wann ärztlich abklären?',
  intro: 'Allgemeine Hinweise, wann ein Termin bei deiner Ärztin oder deinem Arzt sinnvoll ist:',
  items: [
    'Die Periode bleibt drei Monate oder länger aus.',
    'Zyklen sind öfter kürzer als 24 oder länger als 38 Tage (unter 18 Jahren: kürzer als 21 oder länger als 45 Tage).',
    'Die Periode dauert länger als acht Tage.',
    'Die Blutung ist an mehreren Tagen sehr stark.',
    'Starke Regelschmerzen kommen Zyklus für Zyklus wieder.',
    'Blutungen zwischen den Perioden oder nach den Wechseljahren.',
    'Du fühlst dich oft energielos und trainierst viel.',
  ],
} as const;
