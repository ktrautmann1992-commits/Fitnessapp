import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  GROUP_BARBELL_ONLY_EXERCISE_IDS,
  LIBRARY_SEARCH_EXCLUDED_IDS,
  WOD_ONLY_EXERCISE_IDS,
  WORKOUT_LIMITS,
} from '../constants';
import { isOptionalAid, OPTIONAL_AID_EQUIPMENT, requiredEquipmentIds } from '../equipment';
import { equipmentProfile, findSubstitute } from '../plan/equipment-profile';
import { swapCandidates, type SwapContext } from '../plan/preferences';
import { planSafetyRules } from '../plan/safety';
import { EXERCISES, NOTHING, planned } from '../plan/swap-test-helpers';
import { FULL_HOME, MONDAY, person } from '../plan/test-library';
import { checkWorkout } from './checks';
import { missingWorkoutEquipment, workoutDiscipline } from './discover';
import { isPowerWorkout, workoutPlayerPlan } from './player';
import { type Workout, workoutSchema } from './schema';
import { estimateWorkoutSeconds } from './timer';

/**
 * Langhantel-Gruppenworkouts „Barbell Burn 60/30“ (Gründer-Auftrag 14.11.2026, docs/PLAN-BARBELL-BURN.md): echter
 * Inhaltsstand aus content/workouts. Tracks = Übungen in Sätzen nach Zeit (Player), leichte Langhantel + Stepbrett
 * (ersetzbar durch den Boden), eigene Übungen nur über diese Workouts – Pläne bleiben unverändert.
 */

function load(id: string): Workout {
  const url = new URL(`../../../../content/workouts/${id}.json`, import.meta.url);
  return workoutSchema.parse(JSON.parse(readFileSync(url, 'utf8')));
}

const W60 = load('barbell-burn-60');
const W30 = load('barbell-burn-30');
const unilateral = (id: string) => EXERCISES.get(id)?.unilateral === true;
const minutesInPlayer = (w: Workout) =>
  estimateWorkoutSeconds(workoutPlayerPlan(w, unilateral).filter((s) => s.kind !== 'prepare')) / 60;

describe('Barbell Burn – Inhalte', () => {
  it('beide freigegeben, Sätze × Wdh. (läuft im Player komplett nach Zeit), ohne Prüfbefund', () => {
    for (const w of [W60, W30]) {
      expect(w.status).toBe('published');
      expect(w.format).toBe('sets_reps');
      expect(isPowerWorkout(w)).toBe(true);
      const issues = checkWorkout(w, EXERCISES);
      expect(issues, w.id).toEqual([]);
    }
  });

  it('Dauer im Player passt zum Titel (60 bzw. 30 Minuten, höchstens 10 % darunter, nie darüber)', () => {
    expect(W60.minutes).toBe(60);
    expect(W30.minutes).toBe(30);
    for (const w of [W60, W30]) {
      const minutes = minutesInPlayer(w);
      expect(minutes, w.id).toBeLessThanOrEqual(w.minutes);
      expect(minutes, w.id).toBeGreaterThanOrEqual(w.minutes * 0.9);
    }
  });

  it('jeder Schritt im Player hat eine Zeit (kein „Erledigt“ nötig), Zeitfenster innerhalb der Grenzen', () => {
    for (const w of [W60, W30]) {
      for (const step of workoutPlayerPlan(w, unilateral)) {
        if (step.kind !== 'work') continue;
        expect(step.seconds, `${w.id} ${step.exerciseId}`).not.toBeNull();
        expect(step.seconds!).toBeGreaterThanOrEqual(WORKOUT_LIMITS.workS.min);
        expect(step.seconds!).toBeLessThanOrEqual(WORKOUT_LIMITS.workS.max);
      }
    }
  });

  it('Tracks: 60 = zehn Tracks, 30 = sieben Tracks; jede Übung mit Track-Hinweis und Tempo-Angabe', () => {
    const tracks = (w: Workout) =>
      new Set(w.exercises.map((item) => /^Track (\d+)/.exec(item.note_de ?? '')?.[1]));
    expect([...tracks(W60)]).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    expect([...tracks(W30)]).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    for (const item of [...W60.exercises, ...W30.exercises]) {
      if (item.duration_s !== null) continue; // Dehnen nach Zeit
      expect(item.note_de, item.exercise_id).toMatch(/runter|hoch|Pulse|Halbe Wiederholungen/);
    }
  });

  it('30 ist die gekürzte Fassung: nur Übungen aus der 60er-Fassung, ohne Arme und Ausfallschritte', () => {
    const ids60 = new Set(W60.exercises.map((item) => item.exercise_id));
    for (const item of W30.exercises)
      expect(ids60.has(item.exercise_id), item.exercise_id).toBe(true);
    const ids30 = W30.exercises.map((item) => item.exercise_id);
    for (const id of [
      'stirndruecken-langhantel',
      'bizepscurl-langhantel',
      'ausfallschritt-rueckwaerts-langhantel',
      'umsetzen-druecken-langhantel-leicht',
    ]) {
      expect(ids30).not.toContain(id);
    }
  });

  it('Geräte: leichte Langhantel und Stepbrett; das Stepbrett fehlt nie (Ersatz Boden)', () => {
    expect(W60.equipment_ids).toEqual(['barbell', 'step_bench']);
    expect(W30.equipment_ids).toEqual(['barbell', 'step_bench']);
    expect(isOptionalAid('step_bench')).toBe(true);
    expect(OPTIONAL_AID_EQUIPMENT.step_bench).toMatch(/Boden/);
    expect(requiredEquipmentIds(W60.equipment_ids)).toEqual(['barbell']);
    expect(missingWorkoutEquipment(W60, new Set(['barbell']))).toEqual([]);
    expect(missingWorkoutEquipment(W60, new Set())).toEqual(['barbell']);
  });

  it('allgemeines Kraft-Workout (keine eigene Sportart, kein WOD-Stil)', () => {
    expect(workoutDiscipline(W60)).toBeNull();
    expect(workoutDiscipline(W30)).toBeNull();
  });
});

describe('GROUP_BARBELL_ONLY_EXERCISE_IDS', () => {
  const healthy = planSafetyRules(person(), MONDAY);
  const home = equipmentProfile('home', FULL_HOME);
  const gym = equipmentProfile('gym', []);
  const ONLY = new Set(GROUP_BARBELL_ONLY_EXERCISE_IDS);
  const ctx = (overrides: Partial<SwapContext> = {}): SwapContext => ({
    library: EXERCISES,
    profile: home,
    swapRules: healthy,
    preferences: [],
    location: 'home',
    inSession: new Set(),
    mode: 'always',
    ...overrides,
  });

  it('alle in der Bibliothek, getrennt von WOD, Teil der Bibliotheks-Sperre, in beiden Workouts genutzt', () => {
    const used = new Set([...W60.exercises, ...W30.exercises].map((item) => item.exercise_id));
    for (const id of GROUP_BARBELL_ONLY_EXERCISE_IDS) {
      expect(EXERCISES.has(id), id).toBe(true);
      expect(WOD_ONLY_EXERCISE_IDS).not.toContain(id);
      expect(LIBRARY_SEARCH_EXCLUDED_IDS).toContain(id);
      expect(used.has(id), id).toBe(true);
    }
  });

  // Übungen der Bibliotheks-Sperre (Hyrox, WOD) dürfen untereinander tauschen (preferences.ts) – hier nicht geprüft.
  const searchable = [...EXERCISES.keys()].filter(
    (id) => !LIBRARY_SEARCH_EXCLUDED_IDS.includes(id),
  );

  it('Tausch und Ersatz bei fehlendem Gerät: nie eine Barbell-Burn-Übung', () => {
    for (const [profile, location] of [
      [home, 'home'],
      [gym, 'gym'],
    ] as const) {
      for (const id of searchable) {
        const pair = { stored: planned(id), shown: planned(id) };
        const result = swapCandidates(pair, ctx({ profile, location }));
        expect(
          result.candidates.filter((c) => ONLY.has(c.id)).map((c) => c.id),
          id,
        ).toEqual([]);
      }
    }
    for (const profile of [NOTHING, home, gym]) {
      for (const id of searchable) {
        const original = EXERCISES.get(id)!;
        const sub = findSubstitute(original, { library: EXERCISES, profile, rules: healthy });
        expect(sub === null || !ONLY.has(sub.exercise.id), original.id).toBe(true);
      }
    }
  });

  it('Sicherheits-Merkmale: Langhantel auf dem Rücken bzw. über Kopf belastet die Wirbelsäule, Rückenlage markiert', () => {
    const tags = (id: string) => EXERCISES.get(id)?.caution_tags ?? [];
    for (const id of [
      'kniebeuge-langhantel-leicht',
      'ausfallschritt-rueckwaerts-langhantel',
      'schulterdruecken-langhantel-leicht',
      'umsetzen-druecken-langhantel-leicht',
    ]) {
      expect(tags(id), id).toContain('spinal_loading');
    }
    expect(tags('schulterdruecken-langhantel-leicht')).toContain('overhead');
    expect(tags('umsetzen-druecken-langhantel-leicht')).toContain('overhead');
    for (const id of ['bankdruecken-step-langhantel', 'stirndruecken-langhantel', 'crunch']) {
      expect(tags(id), id).toContain('long_supine');
    }
  });
});
