import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { DEEP_CORE_ONLY_EXERCISE_IDS, LIBRARY_SEARCH_EXCLUDED_IDS } from '../constants';
import { equipmentProfile, findSubstitute } from '../plan/equipment-profile';
import { swapCandidates, type SwapContext } from '../plan/preferences';
import { planSafetyRules } from '../plan/safety';
import { EXERCISES, NOTHING, planned } from '../plan/swap-test-helpers';
import { FULL_HOME, MONDAY, person } from '../plan/test-library';
import { checkWorkout } from './checks';
import { isStrengthEnduranceWorkout, workoutsForTheme } from './discover';
import { isPowerWorkout, workoutPlayerPlan } from './player';
import { type Workout, workoutSchema } from './schema';
import { buildWorkoutTimerPlan, estimateWorkoutSeconds } from './timer';

/**
 * Kraft-Ausdauer auf Zeit (Gründer-Auftrag 15.11.2026, docs/PLAN-WORKOUTS.md Abschnitt 10): echter Inhaltsstand aus
 * content/workouts. Neue und verlängerte Workouts dauern 20–30 Minuten, laufen nach Zeit und enthalten Übungen für die
 * tiefen Bauchmuskeln; die neuen Übungen kommen nur über Workouts in die App – Pläne bleiben unverändert.
 */

const DIR = new URL('../../../../content/workouts/', import.meta.url);
const ALL: Workout[] = readdirSync(DIR)
  .filter((name) => name.endsWith('.json'))
  .map((name) => workoutSchema.parse(JSON.parse(readFileSync(new URL(name, DIR), 'utf8'))));
const byId = (id: string) => {
  const found = ALL.find((w) => w.id === id);
  if (!found) throw new Error(`Workout fehlt: ${id}`);
  return found;
};

const NEW_IDS = [
  'tiefe-bauchmuskeln-20',
  'core-stabilitaet-25',
  'ganzkoerper-kraftausdauer-25',
  'beine-po-ausdauer-28',
  'oberkoerper-kraftausdauer-22',
  'kurzhantel-kraftausdauer-25',
  'kettlebell-kraftausdauer-28',
  'band-kraftausdauer-25',
  'studio-zirkel-kraftausdauer-27',
  'stufe-stuhl-kraftausdauer-25',
  'power-intervall-30-15',
  'laeufer-kraftausdauer-25',
  'hyrox-kraftausdauer-30',
  'kurzhantel-band-mix-25',
  'oberkoerper-kurzhantel-ausdauer-25',
  'ganzkoerper-ausdauer-45-15',
];
const EXTENDED_IDS = [
  'bauch-blitz',
  'beine-po-start',
  'cardio-ohne-springen',
  'ganzkoerper-band',
  'ganzkoerper-zirkel',
  'hiit-einsteiger',
  'hyrox-einsteiger-ohne-geraete',
  'hyrox-zuhause',
  'oberkoerper-zuhause',
  'rumpf-basis',
  'sanfter-einstieg-ganzkoerper',
];

/** Übungen für die tiefen Bauchmuskeln (vorhandene und neue). */
const DEEP_CORE = new Set([
  ...DEEP_CORE_ONLY_EXERCISE_IDS,
  'dead-bug',
  'bird-dog',
  'hollow-body-halten',
  'hollow-body-gehockt',
  'pallof-press-band',
  'unterarmstuetz',
  'seitstuetz',
  'seitstuetz-knie',
  'copenhagen-seitstuetz-knie',
]);

const unilateral = (id: string) => EXERCISES.get(id)?.unilateral === true;
const estimatedMinutes = (w: Workout) =>
  estimateWorkoutSeconds(buildWorkoutTimerPlan(w, unilateral), unilateral) / 60;
const playerMinutes = (w: Workout) =>
  estimateWorkoutSeconds(workoutPlayerPlan(w, unilateral).filter((s) => s.kind !== 'prepare')) / 60;

describe('Kraft-Ausdauer auf Zeit – Inhalte', () => {
  const focus = [...NEW_IDS, ...EXTENDED_IDS].map(byId);

  it('mindestens 15 neue Workouts, Stufen 1–4, verschiedene Geräte und Ziele', () => {
    expect(NEW_IDS.length).toBeGreaterThanOrEqual(15);
    const fresh = NEW_IDS.map(byId);
    expect(new Set(fresh.map((w) => w.difficulty))).toEqual(new Set([1, 2, 3, 4]));
    const equipment = new Set(fresh.flatMap((w) => w.equipment_ids));
    for (const id of [
      'dumbbells',
      'kettlebells',
      'resistance_bands',
      'leg_press',
      'cable_station',
    ]) {
      expect(equipment.has(id), id).toBe(true);
    }
    expect(fresh.filter((w) => w.equipment_ids.length === 0).length).toBeGreaterThanOrEqual(5);
    const categories = new Set(fresh.map((w) => w.category));
    for (const c of [
      'full_body',
      'core',
      'upper_body',
      'legs_glutes',
      'hiit_cardio',
      'run_strength',
    ]) {
      expect(categories.has(c as Workout['category']), c).toBe(true);
    }
    // Mindestens zwei reine Tiefe-Bauch-Workouts.
    expect(fresh.filter((w) => w.category === 'core').length).toBeGreaterThanOrEqual(2);
  });

  it('freigegeben, ohne Prüfbefund, 20–30 Minuten, Dauer passt zur Schätzung und zum Player', () => {
    for (const w of focus) {
      expect(w.status, w.id).toBe('published');
      expect(checkWorkout(w, EXERCISES), w.id).toEqual([]);
      expect(w.minutes, w.id).toBeGreaterThanOrEqual(20);
      expect(w.minutes, w.id).toBeLessThanOrEqual(30);
      expect(Math.abs(estimatedMinutes(w) - w.minutes), w.id).toBeLessThanOrEqual(0.5);
      expect(Math.abs(playerMinutes(w) - w.minutes), w.id).toBeLessThanOrEqual(1);
    }
  });

  it('läuft nach Zeit (Zirkel/Intervall, mindestens die Hälfte in Sekunden) und steht im Fokus-Bereich', () => {
    for (const w of focus) {
      expect(isPowerWorkout(w), w.id).toBe(true);
      expect(isStrengthEnduranceWorkout(w), w.id).toBe(true);
    }
    // Neue Workouts mit Körpergewicht/Band: ausschließlich nach Zeit (Gewichte bleiben nach Wiederholungen, W4).
    for (const w of NEW_IDS.map(byId)) {
      for (const item of w.exercises) {
        const weighted = EXERCISES.get(item.exercise_id)?.load_type === 'weight';
        expect(item.duration_s !== null || weighted, `${w.id}: ${item.exercise_id}`).toBe(true);
      }
    }
  });

  it('jedes Workout enthält mindestens 3 Minuten Übungen für die tiefen Bauchmuskeln (neue: mindestens zwei Stationen)', () => {
    for (const w of focus) {
      const items = w.exercises.filter((item) => DEEP_CORE.has(item.exercise_id));
      if (NEW_IDS.includes(w.id)) expect(items.length, w.id).toBeGreaterThanOrEqual(2);
      // Einseitige Übungen laufen je Seite – beide Seiten zählen.
      const seconds =
        items.reduce(
          (sum, item) => sum + (item.duration_s ?? 0) * (unilateral(item.exercise_id) ? 2 : 1),
          0,
        ) * w.rounds;
      expect(seconds, w.id).toBeGreaterThanOrEqual(180);
    }
  });

  it('Einseitige Übungen nach Zeit: der Player wechselt die Seite – kein widersprüchlicher Hinweis im Text', () => {
    // Gründer-Feedback 18.11.2026: „45 s links und dann 45 s rechts“ – der Player teilt einseitige Übungen selbst
    // (Linke Seite → Seite wechseln → Rechte Seite). Hinweise wie „Nach der Hälfte die Seite wechseln“, „Je Seite“
    // oder „Abwechselnd links und rechts“ würden dem widersprechen.
    for (const w of ALL.filter((x) => x.format !== 'flow')) {
      const steps = workoutPlayerPlan(w, unilateral);
      for (const item of w.exercises) {
        if (!unilateral(item.exercise_id)) continue;
        expect(item.note_de ?? '', `${w.id}: ${item.exercise_id}`).not.toMatch(
          /Hälfte|[Jj]e (Seite|Bein)|[Aa]bwechselnd|wechseln/,
        );
      }
      const sides = steps.filter((s) => s.kind === 'work' && s.side !== undefined);
      const uniSteps = steps.filter((s) => s.kind === 'work' && unilateral(s.exerciseId));
      expect(sides.length, w.id).toBe(uniSteps.length);
    }
    // Zweiseitig erfasste Halteübungen (Seitstütz) behalten den Hinweis – dort wechselt der Player nicht.
    const side = byId('laeufer-kraftausdauer-25').exercises.find(
      (e) => e.exercise_id === 'seitstuetz',
    );
    expect(unilateral('seitstuetz')).toBe(false);
    expect(side?.note_de).toMatch(/Seite wechseln/);
  });

  it('Reine Mobilitäts-, Erholungs- und Technik-Workouts bleiben außerhalb des Fokus', () => {
    for (const id of [
      'huefte-und-ruecken-mobil',
      'beweglich-in-den-tag',
      'lauf-abc-koordination',
      'rudern-technik',
      'wod-amrap-zuhause',
    ]) {
      expect(isStrengthEnduranceWorkout(byId(id)), id).toBe(false);
    }
  });

  it('„Alle“ zeigt Kraft-Ausdauer auf Zeit zuerst', () => {
    const sorted = workoutsForTheme(ALL, null);
    const firstOther = sorted.findIndex((w) => !isStrengthEnduranceWorkout(w));
    expect(firstOther).toBeGreaterThanOrEqual(NEW_IDS.length + EXTENDED_IDS.length);
    expect(sorted.slice(firstOther).some((w) => isStrengthEnduranceWorkout(w))).toBe(false);
    expect(sorted).toHaveLength(ALL.length);
  });
});

describe('DEEP_CORE_ONLY_EXERCISE_IDS', () => {
  const healthy = planSafetyRules(person(), MONDAY);
  const home = equipmentProfile('home', FULL_HOME);
  const gym = equipmentProfile('gym', []);
  const ONLY = new Set(DEEP_CORE_ONLY_EXERCISE_IDS);
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

  it('alle in der Bibliothek, Teil der Bibliotheks-Sperre, in Workouts genutzt, mit Start- und Endbild-Pflicht', () => {
    const used = new Set(ALL.flatMap((w) => w.exercises.map((item) => item.exercise_id)));
    for (const id of DEEP_CORE_ONLY_EXERCISE_IDS) {
      expect(EXERCISES.has(id), id).toBe(true);
      expect(LIBRARY_SEARCH_EXCLUDED_IDS).toContain(id);
      expect(used.has(id), id).toBe(true);
      expect(EXERCISES.get(id)?.equipment_ids, id).toEqual([]);
    }
  });

  const searchable = [...EXERCISES.keys()].filter(
    (id) => !LIBRARY_SEARCH_EXCLUDED_IDS.includes(id),
  );

  it('Tausch und Ersatz bei fehlendem Gerät: nie eine der neuen Tiefe-Bauch-Übungen', () => {
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
});
