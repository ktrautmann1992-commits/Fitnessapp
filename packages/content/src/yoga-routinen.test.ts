/**
 * Yoga-/Pilates-/Mobility-Entwürfe im Repository (Sportarten Stufe 1 · Etappe Y, docs/PLAN-SPORTARTEN-STUFE-1.md 4):
 * Startbestand, Sicherheitsfilter mit echten Inhalten (Schwangerschaft, vorsichtig, Fit im Alter) und Vorschlag
 * „Erholungstag: Mobility“.
 */
import { join } from 'node:path';

import {
  type Exercise,
  FLOW_RULES,
  flowHoldCap,
  isFlowPoseId,
  isRecoveryRoutineCandidate,
  planSafetyRules,
  prepareFlowWorkout,
  RECOVERY_ROUTINE,
  type SafetyInputs,
  suggestRecoveryRoutine,
  validateContent,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { loadContentFiles, loadWorkoutContentFiles } from './validate';

const contentDir = join(import.meta.dirname, '..', '..', '..', 'content');
const result = validateContent([
  ...loadContentFiles(contentDir).files,
  ...loadWorkoutContentFiles(contentDir).files,
]);
const exercises = new Map<string, Exercise>(result.exercises.map((e) => [e.id, e]));
const flows = result.workouts.filter((w) => w.format === 'flow');
const byId = (id: string) => {
  const found = flows.find((w) => w.id === id);
  if (!found) throw new Error(`Routine fehlt: ${id}`);
  return found;
};

const DAY = '2026-10-27';
const safety = (inputs: Partial<SafetyInputs>, holdCap = false) => ({
  excludedCautionTags: planSafetyRules(
    {
      experienceLevel: 'beginner',
      birthDate: '1990-01-01',
      healthScreening: { flags: [] },
      ...inputs,
    },
    DAY,
  ).excludedCautionTags,
  pain: null,
  holdCap,
});

describe('Startbestand Yoga/Pilates/Mobility (Entwürfe)', () => {
  it('mindestens 25 Yoga-Posen, 12 Pilates-, 8 Mobility-Übungen; 6 + 4 + 4 Routinen; alles Entwurf', () => {
    const poses = result.exercises.filter((e) => isFlowPoseId(e.id));
    expect(poses.filter((e) => e.id.startsWith('yoga-')).length).toBeGreaterThanOrEqual(25);
    expect(poses.filter((e) => e.id.startsWith('pilates-')).length).toBeGreaterThanOrEqual(12);
    expect(poses.filter((e) => e.id.startsWith('mobility-')).length).toBeGreaterThanOrEqual(8);
    expect(poses.every((e) => e.status === 'draft')).toBe(true);
    const count = (category: string) => flows.filter((w) => w.category === category).length;
    expect(count('yoga')).toBeGreaterThanOrEqual(6);
    expect(count('pilates')).toBeGreaterThanOrEqual(4);
    expect(count('mobility')).toBeGreaterThanOrEqual(4);
    expect(flows.every((w) => w.status === 'draft')).toBe(true);
  });

  it('keine roten Fehler an Posen und Routinen', () => {
    const ids = new Set([
      ...flows.map((w) => w.id),
      ...result.exercises.filter((e) => isFlowPoseId(e.id)).map((e) => e.id),
    ]);
    expect(result.issues.filter((i) => ids.has(i.id) && i.severity !== 'warning')).toEqual([]);
  });

  it('Posen mit Umkehrhaltung, tiefer Drehung oder Boden haben eine Stuhl-/Wand-Variante oder sind gekennzeichnet', () => {
    const inversion = result.exercises.filter((e) => e.caution_tags.includes('inversion'));
    expect(inversion.map((e) => e.id).sort()).toEqual([
      'pilates-abrollen-stehend',
      'yoga-beine-an-der-wand',
      'yoga-herabschauender-hund',
      'yoga-schulterbruecke',
      'yoga-vorbeuge-stehend',
    ]);
    for (const e of inversion) expect(e.safety_note_de.length).toBeGreaterThan(20);
  });
});

describe('Sicherheitsfilter mit echten Inhalten', () => {
  it('Stuhl-Yoga: für Fit im Alter (75 Jahre), Schwangerschaft und vorsichtigen Plan vollständig erlaubt', () => {
    const stuhl = byId('yoga-stuhl');
    for (const input of [
      safety({ goalType: 'active_aging', birthDate: '1951-01-01' }, true),
      safety({ healthScreening: { flags: ['pregnancy'] } }),
      safety({ healthScreening: null }),
    ]) {
      const prepared = prepareFlowWorkout(stuhl, input, exercises);
      expect(prepared.allowedShare).toBe(1);
      expect(prepared.hidden).toBe(false);
    }
    // Ab 65: Halteposen höchstens 30 s.
    const senior = prepareFlowWorkout(
      stuhl,
      safety({ birthDate: '1951-01-01' }, flowHoldCap({ age: 75, activeAging: false })),
      exercises,
    );
    for (const item of senior.workout.exercises) {
      if (exercises.get(item.exercise_id)?.load_type === 'time') {
        expect(item.duration_s).toBeLessThanOrEqual(FLOW_RULES.seniorHoldMaxS);
      }
    }
  });

  it('Schwangerschaft: keine Routine zeigt eine Umkehrhaltung, tiefe Drehung oder lange Rückenlage', () => {
    const pregnant = safety({ healthScreening: { flags: ['pregnancy'] } });
    for (const workout of flows) {
      const prepared = prepareFlowWorkout(workout, pregnant, exercises);
      if (prepared.hidden) continue;
      for (const item of prepared.workout.exercises) {
        const tags = exercises.get(item.exercise_id)?.caution_tags ?? [];
        expect(
          tags.filter((t) => ['inversion', 'trunk_rotation', 'long_supine'].includes(t)),
        ).toEqual([]);
      }
    }
  });

  it('16 Jahre ohne Auffälligkeiten: alle Routinen sichtbar und unverändert', () => {
    const young = safety({ birthDate: '2010-06-01' });
    for (const workout of flows) {
      const prepared = prepareFlowWorkout(workout, young, exercises);
      expect(prepared.hidden, workout.id).toBe(false);
      expect(prepared.workout, workout.id).toBe(workout);
    }
  });
});

describe('Erholungstag: Mobility mit echten Inhalten', () => {
  const base = {
    enabled: true,
    day: 'rest' as const,
    workoutDoneToday: false,
    workouts: flows,
    exercises,
    safety: safety({}),
  };

  it('Erholungstag 10/15/20 min, „Nach dem Laufen“ und „Nach dem Wandern“ sind Kandidaten', () => {
    expect(
      flows
        .filter(isRecoveryRoutineCandidate)
        .map((w) => w.id)
        .sort(),
    ).toEqual([
      'erholungstag-10',
      'erholungstag-15',
      'erholungstag-20',
      'nach-dem-laufen',
      'nach-dem-wandern',
    ]);
  });

  it('nach dem Laufen: Beine; ohne Training: ~15 min; Schwangerschaft und Fit im Alter bekommen einen Vorschlag', () => {
    const legs = suggestRecoveryRoutine({
      ...base,
      muscles: RECOVERY_ROUTINE.enduranceMuscles.run.slice(0, 3),
    });
    expect(legs).not.toBeNull();
    expect(legs!.minutes).toBeGreaterThanOrEqual(RECOVERY_ROUTINE.minutes.min);
    expect(legs!.minutes).toBeLessThanOrEqual(RECOVERY_ROUTINE.minutes.max);
    expect(suggestRecoveryRoutine({ ...base, muscles: [] })?.workoutId).toBe('erholungstag-15');
    for (const input of [
      safety({ healthScreening: { flags: ['pregnancy'] } }),
      safety({ goalType: 'active_aging', birthDate: '1946-01-01' }, true),
    ]) {
      expect(suggestRecoveryRoutine({ ...base, safety: input, muscles: [] })).not.toBeNull();
    }
  });
});
