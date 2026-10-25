/**
 * Fortschritts-Regel der Skill-Pfade (docs/PLAN-CALISTHENICS-SCHLINGE.md 2.2, SKILL_PROGRESSION): „3 × 8 sauber“ in
 * zwei Einheiten hintereinander → nächste Stufe; dreimal deutlich verfehlt → vorige Stufe. Grenzfälle: RPE 9, ohne
 * RPE, Einstiegs-/Erholungswoche, freie Einheit, Wiedereinstieg, ausgelassen, Zeitfenster, Halteübungen.
 */
import { describe, expect, it } from 'vitest';

import { SKILL_PROGRESSION } from '../constants';
import {
  bestCleanReps,
  countedEntries,
  countsForSkill,
  isCleanSet,
  skillSessionVerdict,
  skillStageProgress,
} from './progression';
import { entry, holdSets, repSets, TODAY } from './test-helpers';

const T8 = { sets: 3, reps: 8, seconds: null };
const H30 = { sets: 3, reps: null, seconds: 30 };

describe('skillSessionVerdict', () => {
  it('3 × 8 mit RPE ≤ 8 bzw. ohne RPE = sauber', () => {
    expect(skillSessionVerdict({ sets: repSets([8, 8, 8], 8) }, T8)).toBe('clean');
    expect(skillSessionVerdict({ sets: repSets([10, 9, 8]) }, T8)).toBe('clean');
    // Bester Satz zählt: 4 Sätze, davon 3 über dem Ziel.
    expect(skillSessionVerdict({ sets: repSets([5, 8, 9, 8]) }, T8)).toBe('clean');
  });

  it('RPE 9 (nur 1 Wdh. Reserve) ist nicht „sauber“ → teilweise', () => {
    expect(isCleanSet({ rpe: SKILL_PROGRESSION.cleanRpeMax })).toBe(true);
    expect(isCleanSet({ rpe: 9 })).toBe(false);
    expect(skillSessionVerdict({ sets: repSets([8, 8, 8], 9) }, T8)).toBe('partial');
  });

  it('zu wenige Sätze oder ein Satz unter dem Ziel → teilweise', () => {
    expect(skillSessionVerdict({ sets: repSets([8, 8]) }, T8)).toBe('partial');
    expect(skillSessionVerdict({ sets: repSets([8, 8, 7]) }, T8)).toBe('partial');
  });

  it('deutlich verfehlt: bester Satz unter 60 % des Ziels (aufgerundet), oder nichts gemacht', () => {
    // ceil(8 × 0,6) = 5 → 4 ist verfehlt, 5 nicht.
    expect(skillSessionVerdict({ sets: repSets([4, 3, 3]) }, T8)).toBe('miss');
    expect(skillSessionVerdict({ sets: repSets([5, 3, 3]) }, T8)).toBe('partial');
    expect(skillSessionVerdict({ sets: [] }, T8)).toBe('miss');
    expect(
      skillSessionVerdict(
        { sets: [{ reps: 9, weightKg: null, durationS: null, rpe: null, done: false }] },
        T8,
      ),
    ).toBe('miss');
  });

  it('Halteübung: Sekunden statt Wiederholungen', () => {
    expect(skillSessionVerdict({ sets: holdSets([30, 32, 30]) }, H30)).toBe('clean');
    expect(skillSessionVerdict({ sets: holdSets([30, 25, 30]) }, H30)).toBe('partial');
    expect(skillSessionVerdict({ sets: holdSets([15, 10]) }, H30)).toBe('miss');
  });
});

describe('countsForSkill / countedEntries', () => {
  it('Einstiegs-/Erholungswoche, Wiedereinstieg, freie Einheit und „ausgelassen“ zählen nicht', () => {
    const base = entry('klimmzug', 1, repSets([8, 8, 8]));
    expect(countsForSkill(base)).toBe(true);
    expect(countsForSkill({ ...base, isIntroWeek: true })).toBe(false);
    expect(countsForSkill({ ...base, isDeload: true })).toBe(false);
    expect(countsForSkill({ ...base, isReturn: true })).toBe(false);
    expect(countsForSkill({ ...base, isFree: true })).toBe(false);
    expect(countsForSkill({ ...base, status: 'skipped' })).toBe(false);
    // Alternative = tatsächlich gemachte Übung zählt.
    expect(countsForSkill({ ...base, status: 'alternative' })).toBe(true);
  });

  it('Fenster: nur die letzten 90 Tage, nichts aus der Zukunft, neueste zuerst', () => {
    const logs = [
      entry('klimmzug', 91, repSets([8, 8, 8])),
      entry('klimmzug', 89, repSets([6, 6, 6])),
      entry('klimmzug', 2, repSets([7, 7, 7])),
      entry('klimmzug', -1, repSets([9, 9, 9])),
      entry('liegestuetz', 1, repSets([9, 9, 9])),
    ];
    const counted = countedEntries('klimmzug', logs, TODAY);
    expect(counted.map((e) => e.sets[0]?.reps)).toEqual([7, 6]);
  });
});

describe('skillStageProgress', () => {
  it('ohne Eintrag: nicht begonnen', () => {
    expect(skillStageProgress('klimmzug', T8, [], TODAY).status).toBe('not_started');
  });

  it('eine saubere Einheit reicht nicht, zwei hintereinander → bereit', () => {
    const one = [entry('klimmzug', 3, repSets([8, 8, 8]))];
    expect(skillStageProgress('klimmzug', T8, one, TODAY)).toMatchObject({
      status: 'practicing',
      cleanStreak: 1,
    });
    const two = [...one, entry('klimmzug', 1, repSets([9, 8, 8], 7))];
    expect(skillStageProgress('klimmzug', T8, two, TODAY)).toMatchObject({
      status: 'ready',
      cleanStreak: 2,
    });
  });

  it('eine teilweise Einheit dazwischen unterbricht die Serie', () => {
    const logs = [
      entry('klimmzug', 5, repSets([8, 8, 8])),
      entry('klimmzug', 3, repSets([8, 8, 6])),
      entry('klimmzug', 1, repSets([8, 8, 8])),
    ];
    expect(skillStageProgress('klimmzug', T8, logs, TODAY).status).toBe('practicing');
  });

  it('Erholungswoche dazwischen zählt nicht und unterbricht nicht', () => {
    const logs = [
      entry('klimmzug', 8, repSets([8, 8, 8])),
      entry('klimmzug', 4, repSets([5, 5, 5]), { isDeload: true }),
      entry('klimmzug', 1, repSets([8, 8, 8])),
    ];
    expect(skillStageProgress('klimmzug', T8, logs, TODAY).status).toBe('ready');
  });

  it('dreimal deutlich verfehlt → zurückstufen; zweimal reicht nicht', () => {
    const two = [entry('klimmzug', 4, repSets([3, 2])), entry('klimmzug', 2, repSets([4, 3]))];
    expect(skillStageProgress('klimmzug', T8, two, TODAY).status).toBe('practicing');
    const three = [...two, entry('klimmzug', 1, repSets([2, 2, 1]))];
    expect(skillStageProgress('klimmzug', T8, three, TODAY).status).toBe('struggling');
    // Eine bessere Einheit danach hebt das auf.
    const better = [...three, entry('klimmzug', 0, repSets([6, 5, 5]))];
    expect(skillStageProgress('klimmzug', T8, better, TODAY).status).toBe('practicing');
  });

  it('gleicher Tag: der später gespeicherte Eintrag ist der neueste', () => {
    const a = entry('klimmzug', 0, repSets([2, 2]));
    const b = { ...entry('klimmzug', 0, repSets([8, 8, 8])), loggedAt: `${TODAY}T19:00:00Z` };
    const c = entry('klimmzug', 2, repSets([8, 8, 8]));
    // Neueste (b) sauber, davor a verfehlt → keine Serie von 2.
    expect(skillStageProgress('klimmzug', T8, [c, a, b], TODAY).cleanStreak).toBe(1);
  });
});

describe('bestCleanReps (Voraussetzungen)', () => {
  it('bester sauberer Satz in 180 Tagen; RPE 10 zählt nicht', () => {
    const logs = [
      entry('klimmzug', 200, repSets([12])),
      entry('klimmzug', 30, repSets([9], 10)),
      entry('klimmzug', 10, repSets([7, 6], 8)),
      entry('klimmzug', 5, repSets([8], null)),
    ];
    expect(bestCleanReps('klimmzug', logs, TODAY)).toBe(8);
    expect(bestCleanReps('dips-barren', logs, TODAY)).toBe(0);
  });
});
