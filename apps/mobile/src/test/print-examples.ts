/**
 * Beispiel-Dokumente für den PDF-Export (docs/PLAN-PDF-EXPORT.md §8 P1+P2): AUSGEDACHTE Test-Personen, Plan aus dem
 * gebündelten Inhaltsstand (Testmodus, Entwürfe erlaubt). Genutzt von print-document.test.ts und vom CI-Skript
 * scripts/pdf-preview.ts (Artefakt „pdf-vorschau“). Keine echten Nutzerdaten.
 */
import {
  buildTrainingPlanDocument,
  type EquipmentLocation,
  equipmentProfile,
  type ExportProgress,
  type ExportProgressByLocation,
  generateTrainingPlan,
  isExerciseFeasible,
  type PlanInputsInput,
  type PlanLibrary,
  planSafetyRules,
  type PrintDocument,
  selectPlanContent,
  type StoredSession,
  type TrainingPlanExportOptionsInput,
  validateContent,
} from '@fitnessapp/core';

import { CONTENT_BUNDLE } from '../generated/content-files';

/** Montag, 05.10.2026 – fester Stichtag. */
export const EXAMPLE_DAY = '2026-10-05';

export interface PrintExample {
  /** Dateiname ohne Endung (nur a–z, 0–9, -). */
  readonly slug: string;
  readonly description: string;
  readonly inputs: PlanInputsInput;
  readonly options?: Partial<TrainingPlanExportOptionsInput>;
  /** Beispiel-Gewichte (Phase 4) je Ort für Übungen mit Gewicht – zeigt die Fassung je Ort (B8). */
  readonly weightsKg?: { readonly gym: number; readonly home: number };
}

const base: Pick<PlanInputsInput, 'discipline' | 'sex' | 'birthDate' | 'healthScreening'> = {
  discipline: null,
  sex: null,
  birthDate: '1994-05-20',
  healthScreening: { flags: [] },
};

const HOME_DUMBBELLS: PlanInputsInput['homeEquipment'] = [
  { equipmentId: 'dumbbells', weightsKg: [4, 8, 12] },
  { equipmentId: 'resistance_bands', weightsKg: [] },
  { equipmentId: 'flat_bench', weightsKg: [] },
];

export const PRINT_EXAMPLES: readonly PrintExample[] = [
  {
    slug: 'studio-3-tage',
    description:
      'Muskelaufbau, Studio Mo/Mi/Fr je 60 min, 4 Mitschreib-Spalten, Name auf dem Deckblatt',
    inputs: {
      ...base,
      goalType: 'muscle_gain',
      experienceLevel: 'advanced',
      homeEquipment: [],
      schedule: {
        mode: 'fixed',
        slots: [1, 3, 5].map((weekday) => ({
          weekday,
          kind: 'strength_gym' as const,
          minutes: 60,
        })),
      },
    },
    options: { includeName: true, name: 'Alex Beispiel' },
  },
  {
    slug: 'studio-und-zuhause',
    description:
      'Mo Studio, Sa Zuhause (Kurzhanteln 4/8/12 kg) mit Beispiel-Gewichten: zwei Fassungen mit eigenen Gewichten',
    inputs: {
      ...base,
      goalType: 'general_fitness',
      experienceLevel: 'beginner',
      homeEquipment: HOME_DUMBBELLS,
      schedule: {
        mode: 'fixed',
        slots: [
          { weekday: 1, kind: 'strength_gym', minutes: 60 },
          { weekday: 6, kind: 'strength_home', minutes: 45 },
        ],
      },
    },
    weightsKg: { gym: 20, home: 20 },
  },
  {
    slug: 'koerpergewicht-und-ausdauer',
    description: 'Abnehmen ohne Geräte: 2 Tage Körpergewicht zu Hause, 2 Tage Ausdauer',
    inputs: {
      ...base,
      goalType: 'fat_loss',
      experienceLevel: 'beginner',
      homeEquipment: [],
      schedule: {
        mode: 'fixed',
        slots: [
          { weekday: 2, kind: 'strength_home', minutes: 40 },
          { weekday: 3, kind: 'endurance', minutes: 30 },
          { weekday: 5, kind: 'strength_home', minutes: 40 },
          { weekday: 7, kind: 'endurance', minutes: 45 },
        ],
      },
    },
  },
  {
    slug: 'ein-tag-quer',
    description:
      '1 Trainingstag im Studio, Einheiten-Seiten im Querformat mit 8 Mitschreib-Spalten',
    inputs: {
      ...base,
      goalType: 'general_fitness',
      experienceLevel: 'beginner',
      homeEquipment: [],
      schedule: { mode: 'fixed', slots: [{ weekday: 4, kind: 'strength_gym', minutes: 45 }] },
    },
    options: { logColumns: 8, landscape: true },
  },
];

let cached: PlanLibrary | undefined;

/** Inhaltsstand wie im Testmodus der App. */
export function exampleLibrary(): PlanLibrary {
  if (CONTENT_BUNDLE.files.length === 0) {
    throw new Error('Kein gebündelter Inhaltsstand (src/generated/content-files.ts ist leer).');
  }
  cached ??= selectPlanContent(validateContent(CONTENT_BUNDLE.files), { allowDrafts: true });
  return cached;
}

function progressFor(
  sessions: readonly StoredSession[],
  library: PlanLibrary,
  weightsKg: NonNullable<PrintExample['weightsKg']>,
  inputs: PlanInputsInput,
): ExportProgressByLocation {
  const ids = [...new Set(sessions.flatMap((s) => s.exercises.map((e) => e.exercise_id)))].filter(
    (id) => library.exercises.get(id)?.load_type === 'weight',
  );
  const homeSteps = (inputs.homeEquipment ?? []).find(
    (item) => item.equipmentId === 'dumbbells',
  )?.weightsKg;
  const at = (kg: number, steps: readonly number[]) =>
    new Map<string, ExportProgress>(
      ids.map((id) => [
        id,
        {
          result: {
            progress: { weightKg: kg, targetReps: null, extraSet: false, durationS: null },
            firstSessionRpeTarget: null,
          },
          steps,
        },
      ]),
    );
  return new Map<EquipmentLocation, ReadonlyMap<string, ExportProgress>>([
    ['gym', at(weightsKg.gym, [])],
    ['home', at(weightsKg.home, homeSteps ?? [])],
  ]);
}

/** Baut das Druck-Dokument eines Beispiels (wie später die App: Plan + Anzeige-Regeln + Geräte je Ort). */
export function exampleDocument(
  example: PrintExample,
  today = EXAMPLE_DAY,
  adjust: (sessions: StoredSession[], library: PlanLibrary) => StoredSession[] = (s) => s,
): PrintDocument {
  const library = exampleLibrary();
  const generated = generateTrainingPlan(example.inputs, library, today);
  if (!generated.ok) throw new Error(`${example.slug}: ${generated.error}`);
  const plan = generated.plan;
  const sessions: StoredSession[] = adjust(
    plan.sessions.map((s, i) => ({
      ...s,
      id: `beispiel-${i}`,
      status: 'planned',
      original_date: null,
    })),
    library,
  );
  const rules = planSafetyRules(example.inputs, today);
  const home = (example.inputs.homeEquipment ?? []).map((item) => ({
    equipmentId: item.equipmentId,
    weightsKg: item.weightsKg ?? [],
    barKg: item.barKg ?? null,
  }));
  const result = buildTrainingPlanDocument(
    plan,
    sessions,
    {
      rules,
      previousStartGroup: rules.enduranceStartGroup,
      library: library.exercises,
      profiles: new Map([
        ['gym', equipmentProfile('gym', home)],
        ['home', equipmentProfile('home', home)],
      ]),
    },
    example.weightsKg ? progressFor(sessions, library, example.weightsKg, example.inputs) : null,
    { onDate: today, ...example.options },
  );
  if (!result.ok) throw new Error(`${example.slug}: ${result.error}`);
  return result.document;
}

// ---------------------------------------------------------------------------------------------------------
// Belastungstest (Wächter K2): passt jede Seite auf A4?
// ---------------------------------------------------------------------------------------------------------

/** 4 Kraft-Tage zu Hause ohne Geräte (Körpergewicht-Vorlage) – Grundlage des Belastungstests. */
export const EXTREME_EXAMPLE: PrintExample = {
  slug: 'belastungstest',
  description:
    'Belastungstest: 8 Übungen mit langen Namen, Supersätze, jede „ersetzt (Gerät fehlt)“, 600 Zeichen Aufwärmen',
  inputs: {
    ...base,
    goalType: 'general_fitness',
    experienceLevel: 'advanced',
    homeEquipment: [],
    schedule: {
      mode: 'fixed',
      slots: [1, 2, 4, 5].map((weekday) => ({
        weekday,
        kind: 'strength_home' as const,
        minutes: 60,
      })),
    },
  },
};

const LONG_SUFFIX = ' – langsam, kontrolliert und mit voller Bewegungsamplitude (Variante)';
const WARMUP_600 = 'Locker einlaufen, Gelenke mobilisieren und Aufwärmsätze machen. '
  .repeat(10)
  .slice(0, 600);

/**
 * Jede Kraft-Einheit: 8 zu Hause machbare Übungen mit langen Namen, je ersetzt für eine Studio-Übung (Gerät fehlt),
 * Supersätze A/B, 600 Zeichen Aufwärmen und Cool-down. Ausgedacht, nur für den Seitentest.
 */
export function extremeDocument(
  options: Partial<TrainingPlanExportOptionsInput> = {},
): PrintDocument {
  return exampleDocument(
    { ...EXTREME_EXAMPLE, options: { ...EXTREME_EXAMPLE.options, ...options } },
    EXAMPLE_DAY,
    (sessions, library) => {
      const home = equipmentProfile('home', []);
      const all = [...library.exercises.values()];
      const doable = all.filter(
        (e) =>
          e.load_type === 'bodyweight' &&
          e.caution_tags.length === 0 &&
          isExerciseFeasible(e, home),
      );
      const gymOnly = all.find((e) => !isExerciseFeasible(e, home));
      if (doable.length < 8 || !gymOnly) throw new Error('Belastungstest: zu wenige Übungen.');
      return sessions.map((s) => {
        const first = s.exercises[0];
        if (s.kind !== 'strength' || !first) return s;
        return {
          ...s,
          warmup_de: WARMUP_600,
          cooldown_de: WARMUP_600,
          exercises: doable.slice(0, 8).map((e, i) => ({
            ...first,
            order_no: i + 1,
            exercise_id: e.id,
            source_exercise_id: gymOnly.id,
            exercise_name_de: `${e.name_de}${LONG_SUFFIX}`,
            sets: 4,
            reps_min: 8,
            reps_max: 12,
            duration_s: null,
            rest_s: 90,
            superset_group: i < 2 ? 'A' : i < 4 ? 'B' : null,
          })),
        };
      });
    },
  );
}
