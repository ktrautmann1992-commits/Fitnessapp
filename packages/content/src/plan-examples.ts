/**
 * Beispielpläne für die CI-Zusammenfassung (docs/PLAN-PHASE-3.md Abschnitt 7): Für feste, AUSGEDACHTE
 * Test-Personen erzeugt die Plan-Engine aus dem aktuellen Inhaltsstand je einen Plan. So sehen die Gründer die
 * Engine am Handy (GitHub-App → Pull Request → Checks → ci → Summary), bevor die App sie zeigt.
 * Keine echten Nutzerdaten. Entwürfe sind erlaubt (wie im Testmodus der App).
 */
import {
  type GeneratedPlan,
  generateTrainingPlan,
  type PlanInputsInput,
  type PlanLibrary,
  type PlanNote,
  selectPlanContent,
  validateContent,
  type ContentFile,
} from '@fitnessapp/core';

export interface ExamplePerson {
  readonly name: string;
  readonly description: string;
  readonly inputs: PlanInputsInput;
}

const base: Pick<PlanInputsInput, 'discipline' | 'sex' | 'homeEquipment' | 'healthScreening'> = {
  discipline: null,
  sex: null,
  homeEquipment: [],
  healthScreening: { flags: [] },
};

export const EXAMPLE_PERSONS: readonly ExamplePerson[] = [
  {
    name: 'Anna',
    description: 'Einsteigerin, Muskelaufbau, Studio, 3 Tage (Mo/Mi/Fr), 60 min',
    inputs: {
      ...base,
      goalType: 'muscle_gain',
      experienceLevel: 'beginner',
      sessionsPerWeek: 3,
      minutesPerSession: 60,
      preferredDays: [1, 3, 5],
      trainingLocation: 'gym',
      birthDate: '1995-04-12',
    },
  },
  {
    name: 'Ben',
    description: 'Fortgeschritten, Fettverlust, Studio, 4 Tage, 60 min',
    inputs: {
      ...base,
      goalType: 'fat_loss',
      experienceLevel: 'advanced',
      sessionsPerWeek: 4,
      minutesPerSession: 60,
      preferredDays: [],
      trainingLocation: 'gym',
      birthDate: '1988-09-01',
    },
  },
  {
    name: 'Clara',
    description: 'Einsteigerin, Allgemeine Fitness, zu Hause OHNE Geräte, 2 Tage, 45 min',
    inputs: {
      ...base,
      goalType: 'general_fitness',
      experienceLevel: 'beginner',
      sessionsPerWeek: 2,
      minutesPerSession: 45,
      preferredDays: [],
      trainingLocation: 'home',
      birthDate: '2001-02-20',
    },
  },
  {
    name: 'David',
    description:
      'Fortgeschritten, Muskelaufbau, zu Hause mit Kurzhanteln (2–12 kg) und Band, 4 Tage, 45 min',
    inputs: {
      ...base,
      goalType: 'muscle_gain',
      experienceLevel: 'advanced',
      sessionsPerWeek: 4,
      minutesPerSession: 45,
      preferredDays: [1, 2, 4, 5],
      trainingLocation: 'home',
      homeEquipment: [
        { equipmentId: 'dumbbells', weightsKg: [2, 4, 6, 8, 10, 12] },
        { equipmentId: 'resistance_bands', weightsKg: [] },
      ],
      birthDate: '1990-07-30',
    },
  },
  {
    name: 'Eva',
    description:
      '67 Jahre, Allgemeine Fitness, Studio, 3 Tage, Gesundheits-Check ohne Auffälligkeit',
    inputs: {
      ...base,
      goalType: 'general_fitness',
      experienceLevel: 'advanced',
      sessionsPerWeek: 3,
      minutesPerSession: 60,
      preferredDays: [],
      trainingLocation: 'gym',
      birthDate: '1959-03-03',
    },
  },
  {
    name: 'Felix',
    description: '17 Jahre, Leistungssport, Muskelaufbau, Studio, 7 Tage gewünscht, 90 min',
    inputs: {
      ...base,
      goalType: 'muscle_gain',
      experienceLevel: 'competitive',
      sessionsPerWeek: 7,
      minutesPerSession: 90,
      preferredDays: [],
      trainingLocation: 'gym',
      birthDate: '2009-05-05',
    },
  },
  {
    name: 'Gina',
    description:
      'Fortgeschritten, Gesundheits-Check mit Herz-Frage „Ja“ (vorsichtiger Plan), Studio, 3 Tage',
    inputs: {
      ...base,
      goalType: 'muscle_gain',
      experienceLevel: 'advanced',
      sessionsPerWeek: 3,
      minutesPerSession: 60,
      preferredDays: [],
      trainingLocation: 'gym',
      birthDate: '1980-11-11',
      healthScreening: { flags: ['medical_clearance_recommended', 'conservative_plan'] },
    },
  },
  {
    name: 'Hans',
    description:
      'Ohne Gesundheits-Check (keine Einwilligung), Ziel Ausdauer 10 km, Studio, 1 Tag, 20 min',
    inputs: {
      ...base,
      goalType: 'endurance',
      discipline: '10k',
      experienceLevel: 'beginner',
      sessionsPerWeek: 1,
      minutesPerSession: 20,
      preferredDays: [6],
      trainingLocation: 'gym',
      birthDate: '1975-01-01',
      healthScreening: null,
    },
  },
];

/** Deutsche Kurztexte der Hinweis-Codes (die App bekommt eigene Texte in Etappe C). */
export const PLAN_NOTE_TEXTS_DE: Record<PlanNote, string> = {
  goal_endurance_not_yet: 'Ausdauer-Pläne kommen später',
  days_rotated: 'weniger Tage als die Vorlage – Einheiten im Wechsel (geringerer Umfang)',
  days_capped: 'höchstens 4 Krafteinheiten, übrige Tage Ruhetage',
  days_added: 'Wunsch-Tage ergänzt',
  back_to_back_sessions: 'Einheiten an Folgetagen',
  minutes_shortened: 'Einheiten gekürzt',
  minutes_below_minimum: 'Zeitbudget unter der kürzesten sinnvollen Einheit',
  volume_reduced: 'geringerer Wochenumfang',
  exercises_substituted: 'Übungen wegen fehlender Geräte ersetzt',
  exercises_removed: 'Übungen wegen fehlender Geräte entfallen',
  no_pull_exercise: 'keine Rücken-/Zug-Übung möglich (ein Widerstandsband reicht)',
  location_mismatch: 'Vorlage für einen anderen Trainingsort',
};

const QUALITY_DE = {
  exact: 'passt genau',
  close: 'passt mit Anpassungen',
  fallback: 'nächstbeste Vorlage',
} as const;
const WEEKDAYS_DE = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Bibliothek aus den Inhaltsdateien – Entwürfe erlaubt (Beispiele wie im Testmodus). */
export function exampleLibrary(files: readonly ContentFile[]): PlanLibrary {
  return selectPlanContent(validateContent(files), { allowDrafts: true });
}

const decimalDe = (value: number) => String(value).replace('.', ',');

function dosage(e: GeneratedPlan['sessions'][number]['exercises'][number]): string {
  const amount = e.duration_s !== null ? `${e.duration_s} s` : `${e.reps_min}–${e.reps_max}`;
  const effort =
    e.duration_s !== null
      ? `RPE ${decimalDe(e.rpe_target)}`
      : `ca. ${decimalDe(10 - e.rpe_target)} Wdh. Reserve`;
  return `${e.sets} × ${amount}, ${effort}`;
}

function renderPlan(plan: GeneratedPlan): string[] {
  const lines = [
    `**Vorlage:** ${plan.template_title_de} (${QUALITY_DE[plan.match_quality]})  `,
    `**Trainingstage:** ${plan.training_days.map((d) => WEEKDAYS_DE[d]).join(', ')} · **Block:** ${plan.load_weeks} Belastungswochen + 1 Erholungswoche · **RPE höchstens:** ${plan.safety_rules.rpeMax}  `,
  ];
  if (plan.notes.length > 0) {
    lines.push(`**Hinweise:** ${plan.notes.map((n) => PLAN_NOTE_TEXTS_DE[n]).join(' · ')}  `);
  }
  if (plan.medical_notice) lines.push('**Arzt-Hinweis vor jeder Einheit**  ');
  if (plan.safety_rules.noHealthCheck)
    lines.push('**Ohne Gesundheits-Check: vorsichtige Regeln**  ');
  const firstWeek = Math.min(...plan.sessions.map((s) => s.week_no));
  lines.push('', '| Datum | Woche | Einheit | Übungen |', '| --- | --- | --- | --- |');
  for (const s of plan.sessions.filter(
    (x) => x.week_no === firstWeek || x.week_no === firstWeek + 1,
  )) {
    const kind = s.is_intro_week ? ' (Einstieg)' : s.is_deload ? ' (Erholung)' : '';
    const exercises = s.exercises
      .map(
        (e) =>
          `${e.exercise_name_de}${e.exercise_id !== e.source_exercise_id ? ' (ersetzt)' : ''}: ${dosage(e)}`,
      )
      .join('<br>');
    lines.push(
      `| ${s.scheduled_on} | ${s.week_no}${kind} | ${s.name_de}, ca. ${s.estimated_minutes} min | ${exercises} |`,
    );
  }
  return lines;
}

/** Markdown für GITHUB_STEP_SUMMARY. `today` = ISO-Datum. */
export function renderPlanExamples(library: PlanLibrary, today: string): string {
  const lines = [
    '## Beispielpläne der Plan-Engine',
    '',
    `Stand ${today}. Ausgedachte Test-Personen, Inhalte: ${library.templates.length} Vorlagen, ${library.exercises.size} Übungen${library.containsDrafts ? ' (enthält KI-Entwürfe – fachlich prüfen)' : ''}. Gezeigt werden die ersten zwei Wochen.`,
    '',
  ];
  for (const person of EXAMPLE_PERSONS) {
    lines.push(`### ${person.name} – ${person.description}`, '');
    const result = generateTrainingPlan(person.inputs, library, today);
    if (!result.ok) {
      lines.push(
        `Kein Plan: ${result.error === 'no_template' ? 'keine passende Vorlage' : 'ungültige Angaben'}`,
        '',
      );
      continue;
    }
    lines.push(...renderPlan(result.plan), '');
  }
  return `${lines.join('\n')}\n`;
}

/** Heutiges Datum in Europe/Berlin (ISO). */
export function todayInBerlin(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
