import { SKILL_GATES } from '../constants';

/**
 * Skill-Pfade (Calisthenics, Gründer-Freigabe 25.10.2026, docs/PLAN-CALISTHENICS-SCHLINGE.md 2.1): Stufenleitern aus
 * Übungen der Bibliothek (content/exercises) mit einem Ziel je Stufe. Reine Daten, keine Texte – Namen der Pfade stehen
 * in der App (i18n), Übungsnamen in den Inhalten. Reihenfolge = leicht → schwer.
 *
 * Ziel einer Stufe = „sauber“ geschafft (SKILL_PROGRESSION): `sets` Sätze mit mindestens `reps` Wiederholungen
 * (bei einseitigen Übungen je Seite) bzw. `seconds` Sekunden Haltezeit. Werte PRODUKTENTSCHEIDUNG, orientiert an
 * üblichen Calisthenics-Progressionen (Low S 2016, Overcoming Gravity, 2. Aufl.) – fachlich zu prüfen.
 */

export const SKILL_PATH_IDS = [
  'klimmzug',
  'rudern',
  'dips',
  'liegestuetz',
  'kniebeuge',
  'rumpf',
  'handstand',
  'muscle_up',
  'front_lever',
  'back_lever',
] as const;
export type SkillPathId = (typeof SKILL_PATH_IDS)[number];

/** Grundlagen (für alle) bzw. fortgeschrittene Skills (Sperren in gates.ts). */
export type SkillPathGroup = 'basics' | 'skills';

export interface SkillTarget {
  readonly sets: number;
  /** Wiederholungen je Satz (einseitig: je Seite); null bei Halteübungen. */
  readonly reps: number | null;
  /** Haltezeit je Satz in Sekunden; null bei Wiederholungsübungen. */
  readonly seconds: number | null;
}

export interface SkillStage {
  readonly exerciseId: string;
  readonly target: SkillTarget;
  /**
   * Stufe nur für Fortgeschrittene (Profil-Angabe), unabhängig von den Merkmalen der Übung. Stufen mit dem Merkmal
   * `high_skill` gelten ohnehin als „nur Fortgeschrittene“ (gates.ts).
   */
  readonly advancedOnly?: boolean;
}

export interface SkillPath {
  readonly id: SkillPathId;
  readonly group: SkillPathGroup;
  readonly stages: readonly SkillStage[];
  /** Voraussetzungen aus dem Tagebuch (SKILL_GATES.requirements) – gelten für alle Stufen des Pfads. */
  readonly requirements?: keyof typeof SKILL_GATES.requirements;
}

const reps = (sets: number, n: number): SkillTarget => ({ sets, reps: n, seconds: null });
const hold = (sets: number, s: number): SkillTarget => ({ sets, reps: null, seconds: s });

export const SKILL_PATHS: readonly SkillPath[] = [
  {
    id: 'klimmzug',
    group: 'basics',
    stages: [
      { exerciseId: 'toter-hang', target: hold(3, 30) },
      { exerciseId: 'skapula-klimmzug', target: reps(3, 8) },
      { exerciseId: 'klimmzug-negativ', target: reps(3, 5) },
      { exerciseId: 'klimmzug-band-unterstuetzt', target: reps(3, 8) },
      { exerciseId: 'klimmzug', target: reps(3, 8) },
      { exerciseId: 'archer-klimmzug', target: reps(3, 4), advancedOnly: true },
      { exerciseId: 'einarmiger-klimmzug-negativ', target: reps(3, 3), advancedOnly: true },
    ],
  },
  {
    id: 'rudern',
    group: 'basics',
    stages: [
      { exerciseId: 'tuerrahmen-rudern', target: reps(3, 12) },
      { exerciseId: 'australian-pull-up', target: reps(3, 10) },
      { exerciseId: 'ring-rudern', target: reps(3, 10) },
    ],
  },
  {
    id: 'dips',
    group: 'basics',
    stages: [
      { exerciseId: 'dips-stuhl', target: reps(3, 10) },
      { exerciseId: 'stuetz-barren', target: hold(3, 30) },
      { exerciseId: 'dips-negativ-barren', target: reps(3, 5) },
      { exerciseId: 'dips-barren', target: reps(3, 8) },
      { exerciseId: 'ring-stuetz', target: hold(3, 20) },
      { exerciseId: 'dips-ringe', target: reps(3, 6), advancedOnly: true },
    ],
  },
  {
    id: 'liegestuetz',
    group: 'basics',
    stages: [
      { exerciseId: 'liegestuetz-erhoeht', target: reps(3, 12) },
      { exerciseId: 'liegestuetz', target: reps(3, 10) },
      { exerciseId: 'diamant-liegestuetz', target: reps(3, 8) },
      { exerciseId: 'archer-liegestuetz', target: reps(3, 5) },
      { exerciseId: 'planche-lehne', target: hold(3, 30), advancedOnly: true },
      { exerciseId: 'pseudo-planche-liegestuetz', target: reps(3, 8), advancedOnly: true },
    ],
  },
  {
    id: 'kniebeuge',
    group: 'basics',
    stages: [
      { exerciseId: 'kniebeuge-koerpergewicht', target: reps(3, 15) },
      { exerciseId: 'bulgarische-split-kniebeuge-stuhl', target: reps(3, 10) },
      { exerciseId: 'pistol-kniebeuge-halt', target: reps(3, 6) },
      { exerciseId: 'pistol-kniebeuge-kasten', target: reps(3, 6) },
      { exerciseId: 'pistol-kniebeuge', target: reps(3, 5), advancedOnly: true },
    ],
  },
  {
    id: 'rumpf',
    group: 'basics',
    stages: [
      { exerciseId: 'hollow-body-gehockt', target: hold(3, 30) },
      { exerciseId: 'hollow-body-halten', target: hold(3, 30) },
      { exerciseId: 'knieheben-haengend', target: reps(3, 10) },
      { exerciseId: 'l-sitz-gehockt', target: hold(3, 15) },
      { exerciseId: 'l-sitz', target: hold(3, 10), advancedOnly: true },
    ],
  },
  {
    id: 'handstand',
    group: 'skills',
    stages: [
      { exerciseId: 'pike-liegestuetz', target: reps(3, 8) },
      { exerciseId: 'hechtstuetz-erhoeht', target: hold(3, 30), advancedOnly: true },
      { exerciseId: 'wandlaufen', target: reps(3, 3), advancedOnly: true },
      { exerciseId: 'handstand-wand', target: hold(3, 30), advancedOnly: true },
      { exerciseId: 'handstand-frei', target: hold(5, 10), advancedOnly: true },
    ],
  },
  {
    id: 'muscle_up',
    group: 'skills',
    requirements: 'muscle_up',
    stages: [
      { exerciseId: 'explosiver-klimmzug', target: reps(3, 5), advancedOnly: true },
      { exerciseId: 'muscle-up-negativ', target: reps(3, 3), advancedOnly: true },
      { exerciseId: 'muscle-up', target: reps(3, 3), advancedOnly: true },
    ],
  },
  {
    id: 'front_lever',
    group: 'skills',
    requirements: 'front_lever',
    stages: [
      { exerciseId: 'front-lever-gehockt', target: hold(3, 15), advancedOnly: true },
      { exerciseId: 'front-lever-einbeinig', target: hold(3, 10), advancedOnly: true },
      { exerciseId: 'front-lever', target: hold(3, 8), advancedOnly: true },
    ],
  },
  {
    id: 'back_lever',
    group: 'skills',
    requirements: 'back_lever',
    stages: [
      { exerciseId: 'deutscher-hang', target: hold(3, 15), advancedOnly: true },
      { exerciseId: 'back-lever-gehockt', target: hold(3, 15), advancedOnly: true },
      { exerciseId: 'back-lever', target: hold(3, 8), advancedOnly: true },
    ],
  },
];

/** Pfad zu einer ID (undefined bei unbekannter ID). */
export function skillPathById(id: string): SkillPath | undefined {
  return SKILL_PATHS.find((path) => path.id === id);
}

/** Alle Stellen (Pfad, Stufe), an denen eine Übung vorkommt (eine Übung kann in mehreren Pfaden stehen). */
export function skillStagesOf(
  exerciseId: string,
): { readonly path: SkillPath; readonly index: number }[] {
  return SKILL_PATHS.flatMap((path) =>
    path.stages.flatMap((stage, index) =>
      stage.exerciseId === exerciseId ? [{ path, index }] : [],
    ),
  );
}

/** Alle Übungs-IDs der Skill-Pfade (ohne Doppel, in Pfad-Reihenfolge). */
export function skillPathExerciseIds(): string[] {
  return [...new Set(SKILL_PATHS.flatMap((path) => path.stages.map((s) => s.exerciseId)))];
}
