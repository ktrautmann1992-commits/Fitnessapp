/**
 * Beispielpläne für die CI-Zusammenfassung (docs/PLAN-PHASE-3.md Abschnitt 7): Für feste, AUSGEDACHTE
 * Test-Personen erzeugt die Plan-Engine aus dem aktuellen Inhaltsstand je einen Plan. So sehen die Gründer die
 * Engine am Handy (GitHub-App → Pull Request → Checks → ci → Summary), bevor die App sie zeigt.
 * Keine echten Nutzerdaten. Entwürfe sind erlaubt (wie im Testmodus der App).
 */
import {
  ENDURANCE_TEXTS_DE,
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

type SlotKind = 'strength_gym' | 'strength_home' | 'endurance';

/** Feste Wochentage: [Wochentag, Art, Minuten]. */
function fixedDays(...days: [number, SlotKind, number][]): PlanInputsInput['schedule'] {
  return {
    mode: 'fixed',
    slots: days.map(([weekday, kind, minutes]) => ({ weekday, kind, minutes })),
  };
}

/** „Tage egal“: Anzahl × Art × Minuten. */
function flexDays(...groups: [number, SlotKind, number][]): PlanInputsInput['schedule'] {
  return {
    mode: 'flex',
    slots: groups.flatMap(([count, kind, minutes]) =>
      Array.from({ length: count }, () => ({ kind, minutes })),
    ),
  };
}

const HOME_SET: PlanInputsInput['homeEquipment'] = [
  { equipmentId: 'dumbbells', weightsKg: [2, 4, 6, 8, 10, 12] },
  { equipmentId: 'resistance_bands', weightsKg: [] },
  { equipmentId: 'flat_bench', weightsKg: [] },
  { equipmentId: 'pull_up_bar', weightsKg: [] },
];

export const EXAMPLE_PERSONS: readonly ExamplePerson[] = [
  {
    name: 'Anna',
    description: 'Einsteigerin, Muskelaufbau, Studio Mo/Mi/Fr je 60 min',
    inputs: {
      ...base,
      goalType: 'muscle_gain',
      experienceLevel: 'beginner',
      schedule: fixedDays(
        [1, 'strength_gym', 60],
        [3, 'strength_gym', 60],
        [5, 'strength_gym', 60],
      ),
      birthDate: '1995-04-12',
    },
  },
  {
    name: 'Ben',
    description: 'Fortgeschritten, Fettverlust, Studio 4 × 60 min („Tage egal“)',
    inputs: {
      ...base,
      goalType: 'fat_loss',
      experienceLevel: 'advanced',
      schedule: flexDays([4, 'strength_gym', 60]),
      birthDate: '1988-09-01',
    },
  },
  {
    name: 'Clara',
    description: 'Einsteigerin, Allgemeine Fitness, zu Hause OHNE Geräte, 2 × 45 min („Tage egal“)',
    inputs: {
      ...base,
      goalType: 'general_fitness',
      experienceLevel: 'beginner',
      schedule: flexDays([2, 'strength_home', 45]),
      birthDate: '2001-02-20',
    },
  },
  {
    name: 'David',
    description:
      'Fortgeschritten, Muskelaufbau, zu Hause mit Kurzhanteln (2–12 kg) und Band, Mo/Di/Do/Fr je 45 min',
    inputs: {
      ...base,
      goalType: 'muscle_gain',
      experienceLevel: 'advanced',
      schedule: fixedDays(
        [1, 'strength_home', 45],
        [2, 'strength_home', 45],
        [4, 'strength_home', 45],
        [5, 'strength_home', 45],
      ),
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
      '67 Jahre, Allgemeine Fitness, Studio 3 × 60 min, Gesundheits-Check ohne Auffälligkeit',
    inputs: {
      ...base,
      goalType: 'general_fitness',
      experienceLevel: 'advanced',
      schedule: flexDays([3, 'strength_gym', 60]),
      birthDate: '1959-03-03',
    },
  },
  {
    name: 'Felix',
    description: '17 Jahre, Leistungssport, Muskelaufbau, Studio an 7 Tagen je 90 min gewünscht',
    inputs: {
      ...base,
      goalType: 'muscle_gain',
      experienceLevel: 'competitive',
      schedule: flexDays([7, 'strength_gym', 90]),
      birthDate: '2009-05-05',
    },
  },
  {
    name: 'Gina',
    description:
      'Fortgeschritten, Gesundheits-Check mit Herz-Frage „Ja“ (vorsichtiger Plan), Studio 3 × 60 min',
    inputs: {
      ...base,
      goalType: 'muscle_gain',
      experienceLevel: 'advanced',
      schedule: flexDays([3, 'strength_gym', 60]),
      birthDate: '1980-11-11',
      healthScreening: { flags: ['medical_clearance_recommended', 'conservative_plan'] },
    },
  },
  {
    name: 'Hans',
    description:
      'Ohne Gesundheits-Check (keine Einwilligung), Ziel Ausdauer 10 km, aber nur Sa 20 min Kraft im Studio',
    inputs: {
      ...base,
      goalType: 'endurance',
      discipline: '10k',
      experienceLevel: 'beginner',
      schedule: fixedDays([6, 'strength_gym', 20]),
      birthDate: '1975-01-01',
      healthScreening: null,
    },
  },
  {
    name: 'Ida',
    description: 'Nur Laufen: Fortgeschritten, Ziel 10 km, Di 45, Do 45, Sa 60 min',
    inputs: {
      ...base,
      goalType: 'endurance',
      discipline: '10k',
      experienceLevel: 'advanced',
      schedule: fixedDays([2, 'endurance', 45], [4, 'endurance', 45], [6, 'endurance', 60]),
      birthDate: '1992-08-08',
    },
  },
  {
    name: 'Jonas',
    description:
      'Gemischt: Mo Laufen 30, Mi Kraft im Studio 60, Sa Kraft zu Hause 90 min (Kurzhanteln, Band, Bank, Stange)',
    inputs: {
      ...base,
      goalType: 'general_fitness',
      experienceLevel: 'advanced',
      schedule: fixedDays([1, 'endurance', 30], [3, 'strength_gym', 60], [6, 'strength_home', 90]),
      homeEquipment: HOME_SET,
      birthDate: '1987-02-14',
    },
  },
  {
    name: 'Klara',
    description: 'Mo 20 / Sa 90: Einsteigerin, Muskelaufbau, Studio Mo 20 min und Sa 90 min',
    inputs: {
      ...base,
      goalType: 'muscle_gain',
      experienceLevel: 'beginner',
      schedule: fixedDays([1, 'strength_gym', 20], [6, 'strength_gym', 90]),
      birthDate: '1998-12-01',
    },
  },
  {
    name: 'Lena',
    description:
      'Schwangerschaft (Gesundheits-Check), Ziel Ausdauer Radfahren, 2 × Ausdauer 30 min + 1 × Studio 45 min',
    inputs: {
      ...base,
      goalType: 'endurance',
      discipline: 'cycling',
      experienceLevel: 'advanced',
      schedule: flexDays([1, 'strength_gym', 45], [2, 'endurance', 30]),
      birthDate: '1994-05-20',
      sex: 'female',
      healthScreening: { flags: ['pregnancy', 'conservative_plan'] },
    },
  },
  {
    name: 'Max',
    description: '68 Jahre, Ziel Ausdauer (Halbmarathon), Laufen Mo/Mi/Fr je 40 min',
    inputs: {
      ...base,
      goalType: 'endurance',
      discipline: 'half_marathon',
      experienceLevel: 'advanced',
      schedule: fixedDays([1, 'endurance', 40], [3, 'endurance', 40], [5, 'endurance', 40]),
      birthDate: '1958-03-03',
    },
  },
  {
    name: 'Nora',
    description: 'Ohne Gesundheits-Check, Einsteigerin, Laufen 2 × 40 min („Tage egal“)',
    inputs: {
      ...base,
      goalType: 'endurance',
      discipline: '5k',
      experienceLevel: 'beginner',
      schedule: flexDays([2, 'endurance', 40]),
      birthDate: '2000-01-01',
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
  location_mismatch: 'Vorlage für einen anderen Trainingsort (Übungen getauscht)',
  endurance_days_capped: 'mehr Ausdauer-Tage als für den Start sinnvoll – übrige Tage Ruhetage',
  endurance_volume_ramped: 'Ausdauer startet kürzer und steigt jede Woche höchstens um 10 %',
  endurance_walk: 'Wir starten mit zügigem Gehen',
  rest_day_added: 'Ausdauer-Einheit unter 10 Minuten entfällt – Ruhetag',
  week_total_capped: 'höchstens 5 Einheiten pro Woche – mindestens 2 Ruhetage',
  endurance_basic_only: 'lockere Ausdauer; Wettkampfpläne und Tempo-Training kommen später',
};

const KIND_DE = {
  strength_gym: 'Kraft im Studio',
  strength_home: 'Kraft zu Hause',
  endurance: 'Ausdauer',
} as const;

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

function renderSession(s: GeneratedPlan['sessions'][number]): string {
  if (s.kind === 'endurance') {
    const extra = s.name_de === 'Geh-Lauf-Wechsel' ? ` (${ENDURANCE_TEXTS_DE.walkRunPattern})` : '';
    return `Anstrengung ${s.effort_target ?? '–'} von 10, Gesprächstempo${extra}`;
  }
  return s.exercises
    .map(
      (e) =>
        `${e.exercise_name_de}${e.exercise_id !== e.source_exercise_id ? ' (ersetzt)' : ''}: ${dosage(e)}`,
    )
    .join('<br>');
}

function renderPlan(plan: GeneratedPlan): string[] {
  const week = plan.training_week
    .map((d) => `${WEEKDAYS_DE[d.weekday]} ${KIND_DE[d.kind]} ${d.minutes} min`)
    .join(', ');
  const lines = [
    plan.template_title_de
      ? `**Vorlage:** ${plan.template_title_de} (${QUALITY_DE[plan.match_quality]})  `
      : '**Vorlage:** keine (nur Ausdauer)  ',
    `**Woche:** ${week} · **Block:** ${plan.load_weeks} Belastungswochen + 1 Erholungswoche · **RPE höchstens:** ${plan.safety_rules.rpeMax} · **Ausdauer-Anstrengung höchstens:** ${plan.safety_rules.enduranceEffortMax}  `,
  ];
  const endurance = plan.sessions.filter((s) => s.kind === 'endurance');
  if (endurance.length > 0) {
    const weeks = [...new Set(plan.sessions.map((s) => s.week_no))].sort((a, b) => a - b);
    const perWeek = weeks.map(
      (w) =>
        `W${w}: ${endurance.filter((s) => s.week_no === w).reduce((sum, s) => sum + s.estimated_minutes, 0)}`,
    );
    lines.push(`**Ausdauer-Minuten je Woche:** ${perWeek.join(' · ')}  `);
  }
  if (plan.notes.length > 0) {
    lines.push(`**Hinweise:** ${plan.notes.map((n) => PLAN_NOTE_TEXTS_DE[n]).join(' · ')}  `);
  }
  if (plan.medical_notice) lines.push('**Arzt-Hinweis vor jeder Einheit**  ');
  if (plan.safety_rules.pregnancyNotice) lines.push(`**${ENDURANCE_TEXTS_DE.pregnancyDoctor}**  `);
  if (plan.safety_rules.noHealthCheck)
    lines.push('**Ohne Gesundheits-Check: vorsichtige Regeln**  ');
  const firstWeek = Math.min(...plan.sessions.map((s) => s.week_no));
  lines.push('', '| Datum | Woche | Einheit | Inhalt |', '| --- | --- | --- | --- |');
  for (const s of plan.sessions.filter(
    (x) => x.week_no === firstWeek || x.week_no === firstWeek + 1,
  )) {
    const kind = s.is_intro_week ? ' (Einstieg)' : s.is_deload ? ' (Erholung)' : '';
    lines.push(
      `| ${s.scheduled_on} | ${s.week_no}${kind} | ${s.name_de}, ca. ${s.estimated_minutes} min | ${renderSession(s)} |`,
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
