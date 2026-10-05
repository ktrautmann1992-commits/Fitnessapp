/**
 * Regressionstest Etappen K1–K3 (docs/PLAN-KOERPERGEWICHT.md, Wächter A11): Die neuen Körpergewicht-Übungen ändern
 * den Übungs-Tausch für ALLE. Wir vergleichen die 24 bestehenden Vorlagen × typische Profile mit der Bibliothek von
 * vorher (= ohne die neuen IDs und ohne die neu eingetragenen Alternativen) und weisen jede Änderung bewusst aus.
 * Die 18 Körpergewicht-Vorlagen (K2) sind in beiden Vergleichs-Bibliotheken ausgeblendet – sonst bekämen Profile
 * ohne Geräte gar keine der 24 Vorlagen mehr; ihr Matching prüfen bodyweight.test.ts und match.test.ts (core).
 * Beide Seiten laufen mit derselben Engine (Version 3), Unterschiede kommen also nur aus den Inhalten.
 */
import { join } from 'node:path';

import {
  type ContentFile,
  generateTrainingPlan,
  isBodyweightTemplate,
  type PlanInputsInput,
  type PlanLibrary,
  selectPlanContent,
  TEMPLATE_EXPERIENCE_LEVELS,
  TEMPLATE_GOAL_TYPES,
  validateContent,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { loadContentFiles } from './validate';

const contentDir = join(import.meta.dirname, '..', '..', '..', 'content');
const { files } = loadContentFiles(contentDir);
const TODAY = '2026-10-05';

/** Neue Übungen aus Etappe K1 (27) und K2 (Handtuch-Latziehen). */
const NEW_EXERCISE_IDS = [
  'archer-liegestuetz',
  'beinbeuger-handtuch',
  'bird-dog',
  'bulgarische-split-kniebeuge-stuhl',
  'dips-stuhl',
  'glute-bridge-einbeinig',
  'good-morning-koerpergewicht',
  'handtuch-latziehen',
  'handtuch-rudern-isometrisch',
  'hip-thrust-sofa',
  'hueftstrecken-vierfuessler',
  'kniebeuge-pause',
  'kniebeuge-stuhl',
  'kniebeuge-tempo',
  'liegestuetz-erhoeht',
  'liegestuetz-fuesse-erhoeht',
  'nordic-curl-assistiert',
  'pike-liegestuetz',
  'rdl-einbeinig-koerpergewicht',
  'seitstuetz',
  'seitstuetz-knie',
  'step-jacks',
  'step-up-stufe',
  'tisch-rudern',
  'trizeps-liegestuetz-eng',
  'tuerrahmen-rudern',
  'wadenheben-einbeinig',
  'y-t-w-vorgebeugt',
] as const;
const NEW = new Set<string>(NEW_EXERCISE_IDS);

/** Inhaltsstand vor K1: neue Übungen weg, Alternativen auf neue Übungen weg. */
function filesBeforeK1(all: readonly ContentFile[]): ContentFile[] {
  return all
    .filter((file) => {
      const id = (file.data as { id?: unknown } | undefined)?.id;
      return !(file.kind === 'exercise' && typeof id === 'string' && NEW.has(id));
    })
    .map((file) => {
      if (file.kind !== 'exercise') return file;
      const data = file.data as { alternatives?: { alternative_id: string }[] } | undefined;
      if (!data || !Array.isArray(data.alternatives)) return file;
      return {
        ...file,
        data: {
          ...data,
          alternatives: data.alternatives.filter((a) => !NEW.has(a.alternative_id)),
        },
      };
    });
}

/** Bibliothek wie in der App (Testmodus), auf Wunsch ohne Körpergewicht-Vorlagen. */
const library = (all: readonly ContentFile[], withBodyweight = false): PlanLibrary => {
  const lib = selectPlanContent(validateContent(all), { allowDrafts: true });
  return withBodyweight
    ? lib
    : { ...lib, templates: lib.templates.filter((t) => !isBodyweightTemplate(t)) };
};

const before = library(filesBeforeK1(files));
const after = library(files);
/** Voller Inhaltsstand inkl. Körpergewicht-Vorlagen (so plant die App). */
const full = library(files, true);

type Profile = Pick<PlanInputsInput, 'sex' | 'homeEquipment' | 'healthScreening' | 'birthDate'> & {
  readonly kind: 'strength_gym' | 'strength_home';
};

const healthy = { flags: [] };
const PROFILES: Record<string, Profile> = {
  studio: {
    kind: 'strength_gym',
    sex: null,
    homeEquipment: [],
    healthScreening: healthy,
    birthDate: '1990-01-01',
  },
  zuhause_komplett: {
    kind: 'strength_home',
    sex: null,
    homeEquipment: [
      { equipmentId: 'dumbbells', weightsKg: [4, 8, 12] },
      { equipmentId: 'resistance_bands', weightsKg: [] },
      { equipmentId: 'flat_bench', weightsKg: [] },
      { equipmentId: 'pull_up_bar', weightsKg: [] },
    ],
    healthScreening: healthy,
    birthDate: '1990-01-01',
  },
  zuhause_nur_band: {
    kind: 'strength_home',
    sex: null,
    homeEquipment: [{ equipmentId: 'resistance_bands', weightsKg: [] }],
    healthScreening: healthy,
    birthDate: '1990-01-01',
  },
  zuhause_ohne_geraete: {
    kind: 'strength_home',
    sex: null,
    homeEquipment: [],
    healthScreening: healthy,
    birthDate: '1990-01-01',
  },
  studio_vorsichtig: {
    kind: 'strength_gym',
    sex: null,
    homeEquipment: [],
    healthScreening: { flags: ['medical_clearance_recommended', 'conservative_plan'] },
    birthDate: '1990-01-01',
  },
  studio_ab_65: {
    kind: 'strength_gym',
    sex: null,
    homeEquipment: [],
    healthScreening: healthy,
    birthDate: '1958-01-01',
  },
  studio_schwanger: {
    kind: 'strength_gym',
    sex: 'female',
    homeEquipment: [],
    healthScreening: { flags: ['pregnancy'] },
    birthDate: '1994-01-01',
  },
  zuhause_ohne_geraete_schwanger: {
    kind: 'strength_home',
    sex: 'female',
    homeEquipment: [],
    healthScreening: { flags: ['pregnancy'] },
    birthDate: '1994-01-01',
  },
  zuhause_ohne_geraete_vorsichtig: {
    kind: 'strength_home',
    sex: null,
    homeEquipment: [],
    healthScreening: { flags: ['medical_clearance_recommended', 'conservative_plan'] },
    birthDate: '1990-01-01',
  },
  zuhause_ohne_geraete_ab_65: {
    kind: 'strength_home',
    sex: null,
    homeEquipment: [],
    healthScreening: healthy,
    birthDate: '1958-01-01',
  },
  zuhause_ohne_geraete_unter_18: {
    kind: 'strength_home',
    sex: null,
    homeEquipment: [],
    healthScreening: healthy,
    birthDate: '2009-06-01',
  },
};

/** Übungen je Einheit eines Plans (eindeutig über Datum). */
function planExercises(lib: PlanLibrary, inputs: PlanInputsInput): string[] {
  const result = generateTrainingPlan(inputs, lib, TODAY);
  if (!result.ok) return [`FEHLER ${result.error}`];
  return result.plan.sessions.map(
    (s) => `${s.scheduled_on}: ${s.exercises.map((e) => e.exercise_id).join(', ')}`,
  );
}

function inputsFor(
  profile: Profile,
  goal: string,
  level: string,
  days: number,
  minutes = 60,
): PlanInputsInput {
  const { kind, ...rest } = profile;
  return {
    ...rest,
    discipline: null,
    goalType: goal as PlanInputsInput['goalType'],
    experienceLevel: level as PlanInputsInput['experienceLevel'],
    schedule: {
      mode: 'flex',
      slots: Array.from({ length: days }, () => ({ kind, minutes })),
    },
  };
}

/** Budgets: 60 min (volle Vorlage) und 20/30/45 min (Zeitschnitt, Wächter W1). */
const MINUTES = [20, 30, 45, 60] as const;

/** Alle Kombinationen, die die 24 Vorlagen abdecken (Ziel × Level × 3/4 Tage × Profil × Budget). */
function compare() {
  const changed: Record<string, { before: string[]; after: string[] }> = {};
  let count = 0;
  for (const [name, profile] of Object.entries(PROFILES)) {
    for (const goal of TEMPLATE_GOAL_TYPES) {
      for (const level of TEMPLATE_EXPERIENCE_LEVELS) {
        for (const days of [3, 4]) {
          for (const minutes of MINUTES) {
            const inputs = inputsFor(profile, goal, level, days, minutes);
            const a = planExercises(before, inputs);
            const b = planExercises(after, inputs);
            count += 1;
            if (JSON.stringify(a) !== JSON.stringify(b)) {
              changed[`${name}/${goal}/${level}/${days}t/${minutes}min`] = { before: a, after: b };
            }
          }
        }
      }
    }
  }
  return { changed, count };
}

describe('Regression K1–K3: bestehende Vorlagen × typische Profile', () => {
  const { changed, count } = compare();

  it('vergleicht alle 24 Vorlagen-Kombinationen je Profil', () => {
    expect(count).toBe(Object.keys(PROFILES).length * 12 * MINUTES.length);
    expect(before.exercises.size).toBe(after.exercises.size - NEW_EXERCISE_IDS.length);
    expect(after.templates).toHaveLength(24);
    expect(full.templates).toHaveLength(42);
  });

  it('Studio und Zuhause mit allen Geräten: unverändert', () => {
    const keys = Object.keys(changed).filter(
      (key) => key.startsWith('studio/') || key.startsWith('zuhause_komplett/'),
    );
    expect(keys).toEqual([]);
  });

  it('jede Änderung setzt nur neue Körpergewicht-Übungen ein (nichts anderes wird ausgetauscht)', () => {
    for (const [key, { before: a, after: b }] of Object.entries(changed)) {
      expect(a.length, key).toBe(b.length);
      a.forEach((line, i) => {
        const oldIds = new Set(line.split(': ')[1]?.split(', '));
        const newIds = (b[i] ?? '').split(': ')[1]?.split(', ') ?? [];
        for (const id of newIds) {
          expect(oldIds.has(id) || NEW.has(id), `${key}: ${id}`).toBe(true);
        }
      });
    }
  });

  it('ohne Geräte gibt es jetzt immer eine Zug-Übung – mit und ohne Körpergewicht-Vorlagen', () => {
    for (const goal of TEMPLATE_GOAL_TYPES) {
      for (const level of TEMPLATE_EXPERIENCE_LEVELS) {
        for (const days of [2, 3, 4]) {
          for (const profile of [
            PROFILES.zuhause_ohne_geraete,
            PROFILES.zuhause_ohne_geraete_schwanger,
            PROFILES.zuhause_ohne_geraete_vorsichtig,
            PROFILES.zuhause_ohne_geraete_ab_65,
            PROFILES.zuhause_ohne_geraete_unter_18,
          ]) {
            for (const lib of [after, full]) {
              const result = generateTrainingPlan(
                inputsFor(profile!, goal, level, days),
                lib,
                TODAY,
              );
              expect(result.ok).toBe(true);
              if (result.ok) expect(result.plan.notes).not.toContain('no_pull_exercise');
            }
            const planned = generateTrainingPlan(
              inputsFor(profile!, goal, level, days),
              full,
              TODAY,
            );
            expect(planned.ok && planned.plan.template_id).toMatch(/-koerpergewicht$/);
          }
        }
      }
    }
  });

  it('bewusst ausgewiesene Änderungen (Snapshot – bei Inhaltsänderung prüfen und im PR nennen)', () => {
    const summary = Object.fromEntries(
      Object.entries(changed).map(([key, { before: a, after: b }]) => {
        const removed = new Set<string>();
        const added = new Set<string>();
        a.forEach((line, i) => {
          const oldIds = line.split(': ')[1]?.split(', ') ?? [];
          const newIds = (b[i] ?? '').split(': ')[1]?.split(', ') ?? [];
          oldIds.filter((id) => !newIds.includes(id)).forEach((id) => removed.add(id));
          newIds.filter((id) => !oldIds.includes(id)).forEach((id) => added.add(id));
        });
        return [key, { entfaellt: [...removed].sort(), neu: [...added].sort() }];
      }),
    );
    expect(summary).toMatchSnapshot();
  });
});
