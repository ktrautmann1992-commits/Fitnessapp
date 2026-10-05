/**
 * Beispielpläne für die CI-Zusammenfassung (docs/PLAN-PHASE-3.md Abschnitt 7): Für feste, AUSGEDACHTE
 * Test-Personen erzeugt die Plan-Engine aus dem aktuellen Inhaltsstand je einen Plan. So sehen die Gründer die
 * Engine am Handy (GitHub-App → Pull Request → Checks → ci → Summary), bevor die App sie zeigt.
 * Keine echten Nutzerdaten. Entwürfe sind erlaubt (wie im Testmodus der App).
 */
import {
  barbellLoadSteps,
  buildExerciseLogEntry,
  type ExerciseLogEntry,
  type LoggedSet,
  type PlannedDosage,
  type Prescription,
  prescriptionForDisplay,
  type ProgressionContext,
  progressFromLogs,
  type ProgressResult,
  ENDURANCE_TEXTS_DE,
  type EnduranceDiscipline,
  type GeneratedPlan,
  generateTrainingPlan,
  type PlanInputsInput,
  type PlanLibrary,
  type PlanNote,
  planTitle,
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
  goal_endurance_not_yet:
    'Wettkampfplan ab Renndatum kommt später – Ausdauer-Tage unter Einstellungen → Angaben ändern → Trainingstage einplanen',
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
  endurance_basic_only:
    'lockere Ausdauer-Grundlage; Wettkampfplan ab Renndatum (lange Läufe, Tempo, Tapering) kommt später',
};

const DISCIPLINE_DE: Record<EnduranceDiscipline, string> = {
  '5k': '5 km',
  '10k': '10 km',
  half_marathon: 'Halbmarathon',
  marathon: 'Marathon',
  triathlon_sprint: 'Triathlon Sprint',
  triathlon_olympic: 'Triathlon olympisch',
  triathlon_middle: 'Triathlon Mitteldistanz',
  triathlon_long: 'Triathlon Langdistanz',
  cycling: 'Radfahren',
  swimming: 'Schwimmen',
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
  const title = planTitle(plan);
  const lines = [
    ...(title.kind === 'endurance_base'
      ? [
          `**Plan:** Ausdauer-Grundlage${title.discipline ? ` – ${DISCIPLINE_DE[title.discipline]}` : ''}  `,
        ]
      : []),
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

// ---------------------------------------------------------------------------------------------------------
// Beispiel-Progression (docs/PLAN-PHASE-4.md Abschnitt 5.7): vier ausgedachte Personen, je 8 Einheiten einer
// Übung – so sehen die Gründer die Progression aus dem Tagebuch am Handy, bevor die App sie zeigt.
// ---------------------------------------------------------------------------------------------------------

interface ProgressionSession {
  readonly plannedSets?: number;
  readonly isDeload?: boolean;
  readonly isIntroWeek?: boolean;
  readonly steps?: readonly number[];
  /** Was die Person macht (aus der Vorgabe). */
  readonly perform: (p: Prescription) => LoggedSet[];
  readonly weightConfirmed?: boolean;
  readonly note?: string;
}

export interface ProgressionExample {
  readonly name: string;
  readonly description: string;
  readonly exercise: string;
  readonly ctx: ProgressionContext;
  readonly planned: PlannedDosage;
  readonly startWeightKg?: number;
  readonly sessions: readonly ProgressionSession[];
}

const sets = (count: number, reps: number, weightKg: number | null, rpe: number | null = null) =>
  Array.from({ length: count }, () => ({ reps, weightKg, durationS: null, rpe, done: true }));
const shown = (p: Prescription) => sets(p.sets, p.targetReps ?? 0, p.weightKg);

const HOME_DUMBBELLS = [4, 6, 8, 10, 12];
const HOME_DUMBBELLS_20 = [4, 6, 8, 10, 12, 14, 16, 18, 20];
const GYM_DUMBBELLS = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22.5, 25, 27.5, 30];
const GYM_BARBELL = barbellLoadSteps(20, [1.25, 2.5, 5, 10, 15, 20, 25]);

export const PROGRESSION_EXAMPLES: readonly ProgressionExample[] = [
  {
    name: 'Anna',
    description: 'Einsteigerin zuhause, Kurzhanteln 4/6/8/10/12 kg, 3 × 8–12',
    exercise: 'Kurzhantel-Bankdrücken',
    ctx: {
      loadType: 'weight',
      repsMin: 8,
      repsMax: 12,
      durationS: null,
      templateSets: 3,
      rpeTarget: 8,
      incrementKind: 'free_weight',
      steps: HOME_DUMBBELLS,
    },
    planned: { sets: 3, reps_min: 8, reps_max: 12, duration_s: null, rpe_target: 8 },
    sessions: [
      {
        isIntroWeek: true,
        perform: () => sets(3, 10, 8, 8),
        note: 'erster Eintrag (Einstiegswoche) → Arbeitsgewicht geschätzt',
      },
      { perform: shown },
      { perform: shown },
      {
        perform: (p) => sets(p.sets, (p.targetReps ?? 0) - 2, p.weightKg),
        note: 'nicht geschafft',
      },
      { perform: shown },
      { perform: shown },
      { perform: shown },
      { perform: shown },
    ],
  },
  {
    name: 'Ben',
    description:
      'Fortgeschritten im Studio, Langhantel-Kniebeuge 4 × 5–8, mit Tippfehler und Erholungswoche',
    exercise: 'Kniebeuge',
    ctx: {
      loadType: 'weight',
      repsMin: 5,
      repsMax: 8,
      durationS: null,
      templateSets: 4,
      rpeTarget: 8,
      incrementKind: 'barbell',
      steps: GYM_BARBELL,
    },
    planned: { sets: 4, reps_min: 5, reps_max: 8, duration_s: null, rpe_target: 8 },
    startWeightKg: 80,
    sessions: [
      { perform: shown, note: 'eigenes Startgewicht 80 kg' },
      { perform: shown },
      {
        perform: (p) => sets(p.sets, p.targetReps ?? 0, 180),
        note: 'Tippfehler 180 statt 80 kg, nicht bestätigt → zählt nicht als neues Gewicht',
      },
      { perform: shown },
      { perform: shown },
      { perform: shown },
      { isDeload: true, perform: shown, note: 'Erholungswoche: Gewicht × 0,9, Zustand bleibt' },
      { perform: shown },
    ],
  },
  {
    name: 'Clara',
    description: 'Mo 20 min / Sa 90 min – Langhantel-Rudern 2 bzw. 4 Sätze, 4 × 8–10 laut Vorlage',
    exercise: 'Langhantel-Rudern',
    ctx: {
      loadType: 'weight',
      repsMin: 8,
      repsMax: 10,
      durationS: null,
      templateSets: 4,
      rpeTarget: 8,
      incrementKind: 'barbell',
      steps: GYM_BARBELL,
    },
    planned: { sets: 4, reps_min: 8, reps_max: 10, duration_s: null, rpe_target: 8 },
    startWeightKg: 40,
    sessions: [
      { plannedSets: 2, perform: shown, note: 'Mo (kurz)' },
      { plannedSets: 4, perform: shown, note: 'Sa (lang)' },
      { plannedSets: 2, perform: shown, note: 'Mo' },
      {
        plannedSets: 2,
        perform: shown,
        note: 'Mo (Sa ausgefallen) – zweimal kurz hintereinander: kein Gewichtssprung, Ziel bleibt',
      },
      { plannedSets: 2, perform: shown, note: 'Mo' },
      { plannedSets: 4, perform: shown, note: 'Sa – kurz + lang geschafft: Gewichtssprung' },
      { plannedSets: 2, perform: shown, note: 'Mo' },
      { plannedSets: 4, perform: shown, note: 'Sa' },
    ],
  },
  {
    name: 'Dana',
    description:
      'Studio (Kurzhanteln bis 30 kg) und zu Hause (bis 20 kg), 3 × 8–12 – gespeicherter Stand bleibt, Fortschritt zu Hause gilt nur dort',
    exercise: 'Kurzhantel-Schulterdrücken',
    ctx: {
      loadType: 'weight',
      repsMin: 8,
      repsMax: 12,
      durationS: null,
      templateSets: 3,
      rpeTarget: 8,
      incrementKind: 'free_weight',
      steps: GYM_DUMBBELLS,
    },
    planned: { sets: 3, reps_min: 8, reps_max: 12, duration_s: null, rpe_target: 8 },
    startWeightKg: 22.5,
    sessions: [
      { perform: shown, note: 'Studio, eigenes Startgewicht 22,5 kg' },
      { perform: shown, note: 'Studio' },
      {
        steps: HOME_DUMBBELLS_20,
        perform: (p) => sets(p.sets, (p.targetReps ?? 0) - 3, p.weightKg),
        note: 'zu Hause (schwerste Hantel 20 kg), verpatzt – Studio-Stand bleibt 22,5 kg',
      },
      {
        steps: HOME_DUMBBELLS_20,
        perform: shown,
        note: 'zu Hause: Fortschritt an 20 kg gilt nur dort',
      },
      { steps: HOME_DUMBBELLS_20, perform: shown, note: 'zu Hause' },
      { perform: shown, note: 'wieder Studio: weiter mit 22,5 kg und dem Studio-Stand' },
      { perform: shown, note: 'Studio' },
      { perform: shown, note: 'Studio – 22,5 → 25 kg wären 11 %: erst Puffer' },
    ],
  },
];

export interface ProgressionRow {
  readonly no: number;
  readonly prescription: Prescription;
  readonly performed: readonly LoggedSet[];
  readonly after: ProgressResult;
  readonly note: string;
}

/** Simuliert die App: Vorgabe anzeigen → trainieren → Eintrag speichern → nächstes Ziel. */
export function simulateProgression(example: ProgressionExample, today: string): ProgressionRow[] {
  const entries: ExerciseLogEntry[] = [];
  const rows: ProgressionRow[] = [];
  const options = { startWeightKg: example.startWeightKg ?? null };
  const base = Date.parse(`${today}T00:00:00Z`);
  example.sessions.forEach((session, index) => {
    const steps = session.steps ?? example.ctx.steps ?? [];
    const ctx = { ...example.ctx, steps };
    const performedOn = new Date(base + index * 3 * 86_400_000).toISOString().slice(0, 10);
    const result = progressFromLogs('example', entries, ctx, { ...options, today: performedOn });
    const rpe =
      example.planned.rpe_target - (session.isIntroWeek ? 1 : 0) - (session.isDeload ? 2 : 0);
    const prescription = prescriptionForDisplay(
      {
        ...example.planned,
        sets: session.isDeload
          ? Math.ceil((session.plannedSets ?? example.planned.sets) / 2)
          : (session.plannedSets ?? example.planned.sets),
        rpe_target: rpe,
      },
      result,
      { isDeload: session.isDeload ?? false, steps },
    );
    const performed = session.perform(prescription);
    entries.push(
      buildExerciseLogEntry({
        exerciseId: 'example',
        performedOn,
        loggedAt: `${performedOn}T18:00:00Z`,
        status: 'done',
        loadType: example.ctx.loadType,
        isIntroWeek: session.isIntroWeek ?? false,
        isDeload: session.isDeload ?? false,
        progress: result,
        prescription,
        weightConfirmed: session.weightConfirmed ?? false,
        sets: performed,
      }),
    );
    rows.push({
      no: index + 1,
      prescription,
      performed,
      after: progressFromLogs('example', entries, ctx, { ...options, today: performedOn }),
      note: session.note ?? '',
    });
  });
  return rows;
}

const kg = (value: number | null) => (value === null ? 'Gewicht finden' : `${decimalDe(value)} kg`);

function describePrescription(p: Prescription): string {
  return `${p.sets} × ${p.targetReps ?? '–'} mit ${kg(p.weightKg)}, RPE ${decimalDe(p.rpeTarget)}`;
}

function describePerformed(performed: readonly LoggedSet[]): string {
  const first = performed[0];
  if (!first) return '–';
  const same = performed.every((s) => s.reps === first.reps && s.weightKg === first.weightKg);
  return same
    ? `${performed.length} × ${first.reps ?? '–'} mit ${kg(first.weightKg)}`
    : performed.map((s) => `${s.reps ?? '–'}@${kg(s.weightKg)}`).join(', ');
}

function describeNext(r: ProgressResult): string {
  const p = r.progress;
  const parts = [`${kg(p.weightKg)} × ${p.targetReps ?? '–'}`];
  if (p.extraSet) parts.push('+1 Satz');
  const e = r.effective;
  if (e.weightKg !== p.weightKg || e.targetReps !== p.targetReps || e.extraSet !== p.extraSet) {
    parts.push(
      `an diesem Ort ${kg(e.weightKg)} × ${e.targetReps ?? '–'}${e.extraSet ? ' +1 Satz' : ''}`,
    );
  }
  if (r.firstSessionRpeTarget !== null) parts.push(`erste Einheit RPE ${r.firstSessionRpeTarget}`);
  if (r.hint) parts.push(PROGRESSION_HINT_TEXTS_DE[r.hint]);
  return parts.join(', ');
}

export const PROGRESSION_HINT_TEXTS_DE: Record<NonNullable<ProgressResult['hint']>, string> = {
  harder_variant: 'Zeit für eine schwerere Variante',
  stronger_band: 'Zeit für ein stärkeres Band',
  no_heavier_weight: 'schwerere Gewichtsstufe eintragen oder schwerere Variante wählen',
  confirm_weight: 'Gewicht bitte bestätigen',
};

export function renderProgressionExamples(today: string): string[] {
  const lines = [
    '## Beispiel-Progression aus dem Trainingstagebuch',
    '',
    'Ausgedachte Einträge. „Vorgabe“ = was die App an diesem Tag zeigt (auf die eigenen Gewichtsstufen abgerundet), „danach“ = gespeicherter Zustand für die nächste Einheit (ohne Orts-Rundung).',
    '',
  ];
  for (const example of PROGRESSION_EXAMPLES) {
    lines.push(`### ${example.name} – ${example.exercise}: ${example.description}`, '');
    lines.push('| Nr. | Vorgabe | gemacht | danach | Hinweis |', '| --- | --- | --- | --- | --- |');
    for (const row of simulateProgression(example, today)) {
      lines.push(
        `| ${row.no} | ${describePrescription(row.prescription)} | ${describePerformed(row.performed)} | ${describeNext(row.after)} | ${row.note} |`,
      );
    }
    lines.push('');
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
  lines.push(...renderProgressionExamples(today));
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
