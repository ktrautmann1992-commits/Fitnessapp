import { describe, expect, it } from 'vitest';

import {
  availableWorkoutEquipment,
  isCalisthenicsWorkout,
  isHyroxWorkout,
  isRelaxWorkout,
  missingWorkoutEquipment,
  WORKOUT_THEMES,
  workoutDiscipline,
  workoutHasTheme,
  workoutsForTheme,
  workoutThemeCounts,
} from './discover';
import { makeWorkout, workoutItem } from './test-fixtures';

const flow = (overrides: Parameters<typeof makeWorkout>[0] = {}) =>
  makeWorkout({
    format: 'flow',
    rounds: 1,
    round_rest_s: 0,
    exercises: [
      workoutItem('yoga-kindhaltung', { reps: null, duration_s: 60, rest_s: 0 }),
      workoutItem('yoga-entspannung-rueckenlage', { reps: null, duration_s: 120, rest_s: 0 }),
    ],
    ...overrides,
  });

const yogaRelax = flow({
  id: 'yoga-ruhe',
  title_de: 'Ruhe',
  category: 'yoga',
  difficulty: 1,
  minutes: 10,
});
const yogaHard = flow({
  id: 'yoga-kraft',
  title_de: 'Kraft',
  category: 'yoga',
  difficulty: 2,
  minutes: 15,
});
const mobility = flow({
  id: 'mob',
  title_de: 'Mobil',
  category: 'mobility',
  difficulty: 1,
  minutes: 8,
});
const pilates = flow({
  id: 'pil',
  title_de: 'Pilates',
  category: 'pilates',
  difficulty: 1,
  minutes: 12,
});
const hyrox = makeWorkout({
  id: 'hyrox',
  title_de: 'Hyrox zuhause',
  category: 'hiit_cardio',
  exercises: [
    workoutItem('burpee-ohne-sprung', { reps: null, duration_s: 30 }),
    workoutItem('ausfallschritt-gehen-koerpergewicht'),
    workoutItem('kniebeuge-koerpergewicht'),
  ],
});
const calisthenics = makeWorkout({
  id: 'cali',
  title_de: 'Calisthenics',
  equipment_ids: ['pull_up_bar'],
  exercises: [
    workoutItem('klimmzug-negativ'),
    workoutItem('liegestuetz'),
    workoutItem('australian-pull-up'),
    workoutItem('hollow-body-gehockt', { reps: null, duration_s: 20 }),
  ],
});
const wod = makeWorkout({
  id: 'wod',
  title_de: 'AMRAP 10',
  difficulty: 3,
  minutes: 10,
  exercises: hyrox.exercises,
});
const generic = makeWorkout({ id: 'gen', title_de: 'Ganzkörper' });
const rowing = makeWorkout({ id: 'row', title_de: 'Rudern', category: 'rowing', difficulty: 1 });

describe('Bereiche', () => {
  it('Entspannung: ruhige Flows (Yoga/Mobilität, 1 Stern) – nicht Pilates, nicht schwerer, nicht Zirkel', () => {
    expect(isRelaxWorkout(yogaRelax)).toBe(true);
    expect(isRelaxWorkout(mobility)).toBe(true);
    expect(isRelaxWorkout(yogaHard)).toBe(false);
    expect(isRelaxWorkout(pilates)).toBe(false);
    expect(isRelaxWorkout(makeWorkout({ category: 'mobility', difficulty: 1 }))).toBe(false);
  });

  it('Hyrox: mindestens 2 Hyrox-Übungen und mindestens die Hälfte; WOD-Stil zählt nicht', () => {
    expect(isHyroxWorkout(hyrox)).toBe(true);
    expect(isHyroxWorkout(wod)).toBe(false);
    const one = makeWorkout({
      exercises: [
        workoutItem('burpee-ohne-sprung', { reps: null, duration_s: 30 }),
        workoutItem('liegestuetz'),
      ],
    });
    expect(isHyroxWorkout(one)).toBe(false);
    const diluted = makeWorkout({
      exercises: [
        ...hyrox.exercises.slice(0, 2),
        workoutItem('a'),
        workoutItem('b'),
        workoutItem('c'),
      ],
    });
    expect(isHyroxWorkout(diluted)).toBe(false);
    expect(isHyroxWorkout(makeWorkout({ exercises: [] }))).toBe(false);
  });

  it('Calisthenics: Skill-Pfad-Übungen (≥ 3, ≥ 75 %), nur Calisthenics-Geräte', () => {
    expect(isCalisthenicsWorkout(calisthenics)).toBe(true);
    expect(
      isCalisthenicsWorkout({ ...calisthenics, equipment_ids: ['pull_up_bar', 'dumbbells'] }),
    ).toBe(false);
    expect(
      isCalisthenicsWorkout({
        ...calisthenics,
        exercises: [...calisthenics.exercises, workoutItem('x'), workoutItem('y')],
      }),
    ).toBe(false);
    expect(
      isCalisthenicsWorkout({ ...calisthenics, exercises: calisthenics.exercises.slice(0, 2) }),
    ).toBe(false);
    expect(isCalisthenicsWorkout({ ...calisthenics, format: 'flow' })).toBe(false);
  });

  it('Sportart: WOD vor Hyrox vor Calisthenics, sonst Kategorie; allgemein null', () => {
    expect(workoutDiscipline(wod)).toBe('functional');
    expect(workoutDiscipline(hyrox)).toBe('hyrox');
    expect(workoutDiscipline(calisthenics)).toBe('calisthenics');
    expect(workoutDiscipline(yogaRelax)).toBe('yoga');
    expect(workoutDiscipline(pilates)).toBe('pilates');
    expect(workoutDiscipline(rowing)).toBe('rowing');
    expect(workoutDiscipline(generic)).toBeNull();
  });

  it('Yoga & Pilates, CrossFit-Stil, Neues ausprobieren', () => {
    expect(workoutHasTheme(pilates, 'yoga_pilates')).toBe(true);
    expect(workoutHasTheme(mobility, 'yoga_pilates')).toBe(false);
    expect(workoutHasTheme(wod, 'functional')).toBe(true);
    expect(workoutHasTheme(generic, 'functional')).toBe(false);
    expect(workoutHasTheme(generic, 'try_new')).toBe(false);
    expect(workoutHasTheme(rowing, 'try_new')).toBe(true);
  });
});

describe('workoutsForTheme', () => {
  const all = [generic, yogaHard, yogaRelax, mobility, pilates, hyrox, calisthenics, wod, rowing];

  it('ohne Bereich alles, sonst gefiltert in der Reihenfolge der Eingabe', () => {
    expect(workoutsForTheme(all, null)).toEqual(all);
    expect(workoutsForTheme(all, 'relax').map((w) => w.id)).toEqual(['yoga-ruhe', 'mob']);
    expect(workoutsForTheme(all, 'yoga_pilates').map((w) => w.id)).toEqual([
      'yoga-kraft',
      'yoga-ruhe',
      'pil',
    ]);
  });

  it('Neues ausprobieren: je Sportart das leichteste (Sterne, Dauer, Titel), feste Reihenfolge', () => {
    const ids = workoutsForTheme(all, 'try_new').map((w) => w.id);
    expect(ids).toEqual(['yoga-ruhe', 'pil', 'mob', 'hyrox', 'cali', 'wod', 'row']);
    const sameStars = flow({
      id: 'yoga-kurz',
      title_de: 'Kurz',
      category: 'yoga',
      difficulty: 1,
      minutes: 5,
    });
    expect(workoutsForTheme([yogaRelax, sameStars], 'try_new').map((w) => w.id)).toEqual([
      'yoga-kurz',
    ]);
    const sameAll = flow({
      id: 'yoga-a',
      title_de: 'Abend',
      category: 'yoga',
      difficulty: 1,
      minutes: 10,
    });
    expect(workoutsForTheme([yogaRelax, sameAll], 'try_new').map((w) => w.id)).toEqual(['yoga-a']);
  });

  it('leere Liste und Liste ohne Treffer', () => {
    for (const theme of WORKOUT_THEMES) expect(workoutsForTheme([], theme)).toEqual([]);
    expect(workoutsForTheme([generic], 'hyrox')).toEqual([]);
    expect(workoutsForTheme([generic], 'try_new')).toEqual([]);
  });

  it('Anzahl je Bereich', () => {
    expect(workoutThemeCounts(all)).toEqual({
      relax: 2,
      yoga_pilates: 3,
      hyrox: 1,
      calisthenics: 1,
      functional: 1,
      try_new: 7,
    });
  });
});

describe('Geräte-Hinweis', () => {
  it('Zuhause: eigene Geräte inklusive Park → Stange und Barren; Hilfsmittel fehlen nie', () => {
    const available = availableWorkoutEquipment({
      userEquipment: [{ equipment_id: 'calisthenics_park', location: 'home' }],
      trainingSlots: [{ kind: 'strength_home' }],
    });
    expect(available.has('pull_up_bar')).toBe(true);
    expect(available.has('dip_station')).toBe(true);
    expect(missingWorkoutEquipment({ equipment_ids: ['pull_up_bar', 'mat'] }, available)).toEqual(
      [],
    );
    expect(
      missingWorkoutEquipment({ equipment_ids: ['dumbbells', 'yoga_block'] }, available),
    ).toEqual(['dumbbells']);
  });

  it('Studio: Studio-Geräte, Hyrox-Geräte nur mit Angabe', () => {
    const gym = availableWorkoutEquipment({
      userEquipment: [],
      trainingSlots: [{ kind: 'strength_gym' }],
    });
    expect(gym.has('barbell')).toBe(true);
    expect(gym.has('sled')).toBe(false);
    const hyroxGym = availableWorkoutEquipment({
      userEquipment: [
        { equipment_id: 'sled', location: 'gym' },
        { equipment_id: 'ski_erg', location: 'gym' },
      ],
      trainingSlots: [],
    });
    expect(hyroxGym.has('sled')).toBe(true);
    expect(hyroxGym.has('barbell')).toBe(true);
  });

  it('ohne Angaben: nur Körpergewicht; unbekannt (null) = kein Hinweis', () => {
    const none = availableWorkoutEquipment({ userEquipment: [], trainingSlots: [] });
    expect(none.size).toBe(0);
    expect(missingWorkoutEquipment({ equipment_ids: ['sled'] }, none)).toEqual(['sled']);
    expect(missingWorkoutEquipment({ equipment_ids: [] }, none)).toEqual([]);
    expect(missingWorkoutEquipment({ equipment_ids: ['sled'] }, null)).toEqual([]);
  });
});
