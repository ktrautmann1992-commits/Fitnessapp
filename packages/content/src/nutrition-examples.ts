/**
 * „Beispiel-Ernährung“ für die CI-Zusammenfassung (docs/PLAN-PHASE-5.md 12.1, Etappe N1): Für feste, AUSGEDACHTE
 * Test-Personen A–H rechnet die Ernährungs-Engine eine Woche Tagesziele. So sehen die Gründer die Schutzgrenzen am
 * Handy (GitHub-App → Pull Request → Checks → ci → Summary), bevor die App sie zeigt. Keine echten Nutzerdaten.
 * Die kurzen Texte hier sind nur für die CI-Tabelle; die App-Texte kommen in Etappe N4 (`apps/mobile/src/i18n/de.ts`).
 */
import {
  addDays,
  type CalorieCapCode,
  type MealSlotId,
  type NutritionDayTargets,
  type NutritionInputsInput,
  type NutritionNoticeCode,
  type NutritionSessionInput,
  nutritionTargetsForWeek,
} from '@fitnessapp/core';

/** Feste Beispielwoche (Montag), damit die Zahlen stabil und prüfbar bleiben. */
export const NUTRITION_EXAMPLE_WEEK = '2026-10-12';

export interface NutritionExamplePerson {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly inputs: NutritionInputsInput;
}

let counter = 0;
function unit(dayIndex: number, kind: 'strength' | 'run', minutes: number): NutritionSessionInput {
  counter += 1;
  return {
    sessionId: `beispiel-${counter}`,
    planId: 'beispiel-plan',
    planStatus: 'active',
    scheduledOn: addDays(NUTRITION_EXAMPLE_WEEK, dayIndex),
    kind: kind === 'strength' ? 'strength' : 'endurance',
    enduranceModality: kind === 'run' ? 'run' : null,
    effortTarget: kind === 'run' ? 3 : null,
    minutes,
    isDeload: false,
    status: 'planned',
  };
}

const base = {
  today: NUTRITION_EXAMPLE_WEEK,
  experienceLevel: 'beginner',
  healthDataConsent: true,
  healthFlags: { flags: [] },
  activityLevel: 'sedentary',
  trainingTime: 'evening',
  mealsPerDay: 4,
  sessions: [],
} as const satisfies Partial<NutritionInputsInput>;

function body(heightCm: number, weightKg: number, bodyFatPct: number | null = null) {
  return [{ measuredOn: '2026-10-01', heightCm, weightKg, bodyFatPct }];
}

export const NUTRITION_EXAMPLE_PERSONS: readonly NutritionExamplePerson[] = [
  {
    key: 'A',
    name: 'A – Andreas',
    description: 'Mann, 80 kg, 180 cm, 36 J., Fettverlust, Kraft Mo/Mi/Fr je 60 min, Büro',
    inputs: {
      ...base,
      birthDate: '1990-03-01',
      sex: 'male',
      goalType: 'fat_loss',
      bodyMetricsRows: body(180, 80),
      sessions: [unit(0, 'strength', 60), unit(2, 'strength', 60), unit(4, 'strength', 60)],
    },
  },
  {
    key: 'B',
    name: 'B – Bea',
    description:
      'Frau, 45 kg, 150 cm, 25 J., Fettverlust, Ruhetage – nie unter dem Grundumsatz (1.101,5)',
    inputs: {
      ...base,
      birthDate: '2001-01-01',
      sex: 'female',
      goalType: 'fat_loss',
      bodyMetricsRows: body(150, 45),
    },
  },
  {
    key: 'C',
    name: 'C – Carl',
    description: 'Mann, 200 kg, 190 cm, 60 J., Fettverlust, Kraft Di/Do je 45 min',
    inputs: {
      ...base,
      birthDate: '1966-01-01',
      sex: 'male',
      goalType: 'fat_loss',
      bodyMetricsRows: body(190, 200),
      sessions: [unit(1, 'strength', 45), unit(3, 'strength', 45)],
    },
  },
  {
    key: 'D',
    name: 'D – Dana',
    description: '16 J., Frau, 58 kg, 165 cm, Ziel Fettverlust → kein Defizit (im Wachstum)',
    inputs: {
      ...base,
      birthDate: '2010-05-05',
      sex: 'female',
      goalType: 'fat_loss',
      bodyMetricsRows: body(165, 58),
      sessions: [unit(1, 'strength', 45), unit(4, 'strength', 45)],
    },
  },
  {
    key: 'E',
    name: 'E – Emma',
    description: 'Schwanger (Gesundheits-Check) → keine Kalorienzahl, nur Hinweise',
    inputs: {
      ...base,
      birthDate: '1994-06-06',
      sex: 'female',
      goalType: 'general_fitness',
      bodyMetricsRows: body(168, 70),
      healthFlags: { flags: ['pregnancy', 'conservative_plan'] },
      sessions: [unit(2, 'run', 30)],
    },
  },
  {
    key: 'F',
    name: 'F – Felix',
    description:
      'Marathon-Vorbereitung 6 Läufe (Sa 240 min), 70 kg, 180 cm, Körperfett 8 %, Fettverlust → Energieverfügbarkeit',
    inputs: {
      ...base,
      birthDate: '2001-01-01',
      sex: 'male',
      goalType: 'fat_loss',
      experienceLevel: 'competitive',
      trainingTime: 'morning',
      bodyMetricsRows: body(180, 70, 8),
      sessions: [
        unit(0, 'run', 45),
        unit(1, 'run', 60),
        unit(2, 'run', 45),
        unit(3, 'run', 90),
        unit(4, 'run', 45),
        unit(5, 'run', 240),
      ],
    },
  },
  {
    key: 'G',
    name: 'G – Greta',
    description: 'Frau, 70 kg, 170 cm, KEIN Gesundheits-Check, Fettverlust → Erhalt bis zum Check',
    inputs: {
      ...base,
      birthDate: '1992-02-02',
      sex: 'female',
      goalType: 'fat_loss',
      bodyMetricsRows: body(170, 70),
      healthFlags: null,
      sessions: [unit(0, 'strength', 60), unit(3, 'strength', 60)],
    },
  },
  {
    key: 'H',
    name: 'H – Hanna',
    description:
      'Frau, 100 kg, 170 cm, 30 J., Körperfett 50 %, Fettverlust (Rechenbeispiel R2-B1) → Ruhetag 1.910 kcal',
    inputs: {
      ...base,
      birthDate: '1996-01-01',
      sex: 'female',
      goalType: 'fat_loss',
      bodyMetricsRows: body(170, 100, 50),
    },
  },
];

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export const NUTRITION_NOTICE_TEXTS_DE: Record<NutritionNoticeCode, string> = {
  no_health_data_consent: 'ohne Einwilligung keine Zahlen',
  body_data_missing: 'Größe/Gewicht fehlt',
  health_check_missing: 'Gesundheits-Check machen',
  weight_outdated: 'Gewicht älter als 3 Monate',
  pregnancy_no_targets: 'Schwangerschaft/Stillzeit: keine Kalorienzahl, Ärztin/Arzt/Hebamme',
  pregnancy_check_update: 'Gesundheits-Check aktualisieren',
  pregnancy_caffeine: 'Koffein höchstens 200 mg/Tag',
  minor_no_deficit: 'im Wachstum kein Defizit',
  underweight: 'BMI unter 18,5: kein Defizit',
  severe_underweight: 'BMI unter 17: bitte ärztlich abklären',
  medical_consult: 'Medikamente: ärztlich abstimmen',
  bmr_estimate_age: 'Formel für dein Alter grob',
  activity_level_default: 'Alltag ohne Angabe = sitzend',
  training_energy_capped: 'sehr viel Training: ohne Defizit',
  energy_availability_cap: 'Energieverfügbarkeit: kleineres Defizit',
  protein_kidney_notice: 'Eiweiß > 1,6 g/kg: Nierenhinweis',
  carbs_below_reference: 'Kohlenhydrate unter 130 g',
  endurance_carbs_below_target: 'Kohlenhydrat-Richtwert nicht erreicht',
  long_session_fueling: 'lange Einheit: unterwegs essen/trinken',
  early_training: 'Frühtraining',
};

export const CALORIE_CAP_TEXTS_DE: Record<CalorieCapCode, string> = {
  bmr_floor: 'Grundumsatz',
  deficit_cap: 'max. 25 % Defizit',
  weekly_loss_cap: 'max. ~1 %/Woche',
  energy_availability_cap: 'Energieverfügbarkeit',
  gain_cap: 'Überschuss-Deckel',
  special_case_cap: 'Sonderfall-Deckel',
  training_energy_capped: 'Trainingsdeckel',
};

const SLOT_DE: Record<MealSlotId, string> = {
  main: 'Hauptmahlzeit',
  breakfast: 'Frühstück',
  snack_morning: 'Snack vormittags',
  lunch: 'Mittag',
  snack_afternoon: 'Snack nachmittags',
  snack_pre_dinner: 'Snack vor dem Abend',
  dinner: 'Abendessen',
  snack_late: 'Spät-Snack',
  snack_night: 'Snack spät',
};
const ROLE_DE = {
  pre: 'vor dem Training',
  post: 'nach dem Training',
  pre_snack: 'Snack vorher',
} as const;

const kcalDe = (value: number) => new Intl.NumberFormat('de-DE').format(value);

function trainingCell(day: NutritionDayTargets): string {
  if (day.sessions.length === 0) return 'Ruhetag';
  return day.sessions
    .map((s) => `${s.kind === 'strength' ? 'Kraft' : 'Lauf'} ${s.minutes} min`)
    .join(' + ');
}

function rowFor(day: NutritionDayTargets, index: number): string {
  const kcal = day.targetKcal === null ? 'keine Zahl' : `${kcalDe(day.targetKcal)} kcal`;
  const macros = day.proteinG === null ? '–' : `${day.proteinG} / ${day.fatG} / ${day.carbsG}`;
  const caps = day.appliedCaps.map((c) => CALORIE_CAP_TEXTS_DE[c]).join(', ') || '–';
  const notices = day.notices.map((n) => NUTRITION_NOTICE_TEXTS_DE[n]).join('; ') || '–';
  const roles = day.slots
    .filter((s) => s.role !== null)
    .map((s) => `${SLOT_DE[s.slot]} = ${s.role === null ? '' : ROLE_DE[s.role]}`)
    .join(', ');
  return `| ${WEEKDAYS[index]} ${day.date.slice(8)}.${day.date.slice(5, 7)}. | ${trainingCell(day)} | ${kcal} | ${macros} | ${caps} | ${notices}${roles ? ` (${roles})` : ''} |`;
}

/** Markdown für die CI-Zusammenfassung. */
export function renderNutritionExamples(): string {
  const lines = [
    '## Beispiel-Ernährung (Ernährungs-Engine, Etappe N1)',
    '',
    `Woche ab ${NUTRITION_EXAMPLE_WEEK}. Ausgedachte Personen, keine echten Daten. Makros: Eiweiß / Fett / Kohlenhydrate in g.`,
    '',
  ];
  for (const person of NUTRITION_EXAMPLE_PERSONS) {
    const week = nutritionTargetsForWeek(person.inputs, NUTRITION_EXAMPLE_WEEK);
    lines.push(`### ${person.name}`, '', person.description, '');
    lines.push('| Tag | Training | Ziel | E / F / KH | Grenze greift | Hinweise |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    week.days.forEach((day, i) => lines.push(rowFor(day, i)));
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}
