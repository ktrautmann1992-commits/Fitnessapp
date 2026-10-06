import { describe, expect, it } from 'vitest';

import {
  adjustRest,
  isRestOver,
  nextSetExercise,
  remainingSeconds,
  restAfterCheckedSet,
  restAfterSet,
  type RestSetExercise,
  startRest,
} from './rest-timer';

describe('Pausentimer (Abschnitt 5.5)', () => {
  it('Restzeit aus Zeitstempeln – auch nach Zeitsprung (Hintergrund)', () => {
    const t = startRest(90, 1_000_000);
    expect(remainingSeconds(t, 1_000_000)).toBe(90);
    expect(remainingSeconds(t, 1_000_500)).toBe(90);
    expect(remainingSeconds(t, 1_001_000)).toBe(89);
    expect(isRestOver(t, 1_089_999)).toBe(false);
    // App war 10 Minuten im Hintergrund
    expect(remainingSeconds(t, 1_600_000)).toBe(0);
    expect(isRestOver(t, 1_600_000)).toBe(true);
  });

  it('Anpassen: ±15 s, nie unter 0 oder über 600 s', () => {
    const t = startRest(30, 0);
    expect(adjustRest(t, 15).durationS).toBe(45);
    expect(adjustRest(adjustRest(adjustRest(t, -15), -15), -15).durationS).toBe(0);
    expect(adjustRest(startRest(590, 0), 15).durationS).toBe(600);
    expect(startRest(-5, 0).durationS).toBe(0);
    expect(startRest(900, 0).durationS).toBe(600);
  });

  it('Supersatz: keine Pause bis zur letzten Übung der Gruppe', () => {
    const a = { order_no: 1, rest_s: 90, superset_group: 'A' };
    const b = { order_no: 2, rest_s: 60, superset_group: 'A' };
    const c = { order_no: 3, rest_s: 120, superset_group: null };
    expect(restAfterSet(a, b)).toBe(0);
    expect(restAfterSet(b, a)).toBe(60); // Runde zu Ende
    expect(restAfterSet(b, c)).toBe(60);
    expect(restAfterSet(c, c)).toBe(120);
    expect(restAfterSet(c, null)).toBe(0);
  });
});

describe('Pause nach einem abgehakten Satz (Reihenfolge im Trainingsmodus, Etappe C2)', () => {
  const ex = (
    order_no: number,
    setCount: number,
    rest_s = 90,
    superset_group: string | null = null,
    skipped = false,
  ): RestSetExercise => ({ order_no, setCount, rest_s, superset_group, skipped });

  it('ohne Supersatz: Pause zwischen den Sätzen und vor der nächsten Übung, keine nach dem letzten Satz', () => {
    const list = [ex(1, 3, 120), ex(2, 2, 60)];
    expect(restAfterCheckedSet(list, 0, 0)).toBe(120);
    expect(nextSetExercise(list, 0, 2)).toBe(list[1]);
    expect(restAfterCheckedSet(list, 0, 2)).toBe(120);
    expect(restAfterCheckedSet(list, 1, 0)).toBe(60);
    expect(nextSetExercise(list, 1, 1)).toBeNull();
    expect(restAfterCheckedSet(list, 1, 1)).toBe(0);
  });

  it('Supersatz A1/A2: keine Pause innerhalb der Runde, Pause nach A2; nach der letzten Runde Pause vor C', () => {
    const list = [ex(1, 3, 90, 'A'), ex(2, 3, 75, 'A'), ex(3, 2, 60)];
    expect(nextSetExercise(list, 0, 0)).toBe(list[1]);
    expect(restAfterCheckedSet(list, 0, 0)).toBe(0);
    expect(nextSetExercise(list, 1, 0)).toBe(list[0]);
    expect(restAfterCheckedSet(list, 1, 0)).toBe(75);
    // Letzte Runde: nach A2 geht es mit C weiter.
    expect(nextSetExercise(list, 1, 2)).toBe(list[2]);
    expect(restAfterCheckedSet(list, 1, 2)).toBe(75);
  });

  it('Supersatz mit ungleicher Satzzahl: A1 hat einen Satz mehr → nächste Runde nur A1', () => {
    const list = [ex(1, 3, 90, 'A'), ex(2, 2, 90, 'A')];
    expect(nextSetExercise(list, 1, 1)).toBe(list[0]);
    expect(restAfterCheckedSet(list, 1, 1)).toBe(90);
    expect(nextSetExercise(list, 0, 2)).toBeNull();
    expect(restAfterCheckedSet(list, 0, 2)).toBe(0);
  });

  it('„Nicht gemacht“ zählt in der Reihenfolge nicht', () => {
    const list = [ex(1, 1, 90), ex(2, 3, 60, null, true)];
    expect(nextSetExercise(list, 0, 0)).toBeNull();
    expect(restAfterCheckedSet(list, 0, 0)).toBe(0);
    const superset = [ex(1, 2, 90, 'A'), ex(2, 2, 90, 'A', true)];
    expect(restAfterCheckedSet(superset, 0, 0)).toBe(90);
  });

  it('1 Übung mit 1 Satz → keine Pause; unbekannter Index → 0; Pause über 600 s wird gekappt', () => {
    expect(restAfterCheckedSet([ex(1, 1)], 0, 0)).toBe(0);
    expect(restAfterCheckedSet([ex(1, 1)], 5, 0)).toBe(0);
    expect(nextSetExercise([], 0, 0)).toBeNull();
    expect(restAfterCheckedSet([ex(1, 2, 900)], 0, 0)).toBe(600);
  });
});
