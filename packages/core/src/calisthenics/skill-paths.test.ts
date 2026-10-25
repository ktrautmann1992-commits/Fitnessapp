/**
 * Skill-Pfade gegen den echten Inhaltsstand (docs/PLAN-CALISTHENICS-SCHLINGE.md 2.1): Jede Stufe ist eine Übung aus
 * `content/exercises`, die Leitern werden nie leichter, Stufen mit hoher Technik sind „nur Fortgeschrittene“.
 */
import { describe, expect, it } from 'vitest';

import { SKILL_GATES } from '../constants';
import { repoLibrary } from '../plan/test-library';
import {
  SKILL_PATH_IDS,
  SKILL_PATHS,
  skillPathById,
  skillPathExerciseIds,
  skillStagesOf,
} from './skill-paths';

const library = repoLibrary().exercises;

describe('SKILL_PATHS', () => {
  it('jede ID genau einmal, Reihenfolge wie SKILL_PATH_IDS', () => {
    expect(SKILL_PATHS.map((p) => p.id)).toEqual([...SKILL_PATH_IDS]);
  });

  it.each(SKILL_PATHS.map((p) => [p.id, p] as const))(
    '%s: jede Stufe existiert, Ziel gültig, Schwierigkeit nie fallend',
    (_id, path) => {
      expect(path.stages.length).toBeGreaterThanOrEqual(3);
      let previous = 0;
      for (const stage of path.stages) {
        const exercise = library.get(stage.exerciseId);
        expect(exercise, stage.exerciseId).toBeDefined();
        expect(stage.target.sets).toBeGreaterThanOrEqual(1);
        expect(stage.target.sets).toBeLessThanOrEqual(5);
        // Genau eines: Wiederholungen ODER Haltezeit – passend zur Belastungsart der Übung.
        expect((stage.target.reps === null) !== (stage.target.seconds === null)).toBe(true);
        expect(stage.target.seconds !== null).toBe(exercise!.load_type === 'time');
        expect(exercise!.difficulty).toBeGreaterThanOrEqual(previous);
        previous = exercise!.difficulty;
        // Hohe Technik → nur Fortgeschrittene (Sperre greift auch ohne Angabe, hier aber ausdrücklich).
        if (exercise!.caution_tags.includes('high_skill')) expect(stage.advancedOnly).toBe(true);
      }
    },
  );

  it('Grundlagen sind für Einsteiger erreichbar: erste Stufe ohne „nur Fortgeschrittene“', () => {
    for (const path of SKILL_PATHS.filter((p) => p.group === 'basics')) {
      expect(path.stages[0]?.advancedOnly ?? false, path.id).toBe(false);
    }
  });

  it('Gründer-Vorgaben: Klimmzug negativ → Band → sauber → Archer → einarmig, Dips Bank → Barren → Ringe', () => {
    const ids = (id: string) => skillPathById(id)!.stages.map((s) => s.exerciseId);
    const pull = ids('klimmzug');
    for (const [a, b] of [
      ['klimmzug-negativ', 'klimmzug-band-unterstuetzt'],
      ['klimmzug-band-unterstuetzt', 'klimmzug'],
      ['klimmzug', 'archer-klimmzug'],
      ['archer-klimmzug', 'einarmiger-klimmzug-negativ'],
    ] as const) {
      expect(pull.indexOf(a)).toBeLessThan(pull.indexOf(b));
    }
    const dips = ids('dips');
    expect(dips.indexOf('dips-stuhl')).toBeLessThan(dips.indexOf('dips-barren'));
    expect(dips.indexOf('dips-barren')).toBeLessThan(dips.indexOf('dips-ringe'));
    expect(ids('liegestuetz')).toEqual([
      'liegestuetz-erhoeht',
      'liegestuetz',
      'diamant-liegestuetz',
      'archer-liegestuetz',
      'planche-lehne',
      'pseudo-planche-liegestuetz',
    ]);
    expect(ids('kniebeuge').at(-1)).toBe('pistol-kniebeuge');
    expect(ids('handstand').slice(-2)).toEqual(['handstand-wand', 'handstand-frei']);
    expect(ids('rumpf')[0]).toBe('hollow-body-gehockt');
    expect(ids('rumpf').at(-1)).toBe('l-sitz');
  });

  it('Voraussetzungen nur bei Muscle-up und Hebeln; ihre Übungen gibt es', () => {
    expect(SKILL_PATHS.filter((p) => p.requirements).map((p) => p.id)).toEqual([
      'muscle_up',
      'front_lever',
      'back_lever',
    ]);
    for (const reqs of Object.values(SKILL_GATES.requirements)) {
      for (const req of reqs) expect(library.get(req.exerciseId), req.exerciseId).toBeDefined();
    }
    expect(SKILL_GATES.requirements.muscle_up).toEqual([
      { exerciseId: 'klimmzug', reps: 8 },
      { exerciseId: 'dips-barren', reps: 10 },
    ]);
  });

  it('skillStagesOf / skillPathExerciseIds / skillPathById', () => {
    expect(skillStagesOf('klimmzug').map((s) => [s.path.id, s.index])).toEqual([['klimmzug', 4]]);
    expect(skillStagesOf('gibt-es-nicht')).toEqual([]);
    expect(skillPathById('nope')).toBeUndefined();
    const all = skillPathExerciseIds();
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBeGreaterThanOrEqual(40);
  });
});
