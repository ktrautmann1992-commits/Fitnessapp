import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { MONDAY, person } from '../plan/test-library';
import { buildInvariantFixtures, codesOf, type InvariantFixture } from './fixtures/invariant-cases';
import {
  checkWeekInvariants,
  COMPETITION_DELOAD_MAX_FACTOR,
  deloadVolumeFactor,
  newInvariantViolations,
} from './invariants';
import { planWithFollowUps } from './test-helpers';
import type { StoredSession } from '../plan/view';
import { planWeeks } from './weeks';

const fixtures = JSON.parse(
  readFileSync(new URL('./fixtures/invariants.json', import.meta.url), 'utf8'),
) as InvariantFixture[];

describe('checkWeekInvariants – Grundregeln', () => {
  const plan = planWithFollowUps(person({ experienceLevel: 'advanced' }), MONDAY, 1);
  if (!plan) throw new Error('kein Plan');

  it('gültiger Plan (2 Blöcke) → keine Verstöße; Woche 0 zählt nicht, Einstiegswoche zählt', () => {
    expect(checkWeekInvariants(plan.sessions, { maxLoadWeeks: 4 })).toEqual([]);
    // Mit L = 3 wäre jeder Block zu lang (Einstiegswoche zählt mit).
    expect(checkWeekInvariants(plan.sessions, { maxLoadWeeks: 3 }).map((v) => v.code)).toContain(
      'too_many_load_weeks',
    );
  });

  it('carriedLoadWeeks zählt die Belastungswochen davor mit', () => {
    const block2 = plan.sessions.filter((s) => s.block_no === 2);
    expect(checkWeekInvariants(block2, { maxLoadWeeks: 4, carriedLoadWeeks: 0 })).toEqual([]);
    expect(checkWeekInvariants(block2, { maxLoadWeeks: 4, carriedLoadWeeks: 1 })[0]?.code).toBe(
      'too_many_load_weeks',
    );
  });

  it('fromMonday meldet nur Verstöße ab dieser Woche (Bezug und Zähler laufen trotzdem ab Planbeginn)', () => {
    const broken = plan.sessions.map((s) =>
      s.block_no === 1 && s.is_deload ? { ...s, is_deload: false } : s,
    );
    expect(checkWeekInvariants(broken, { maxLoadWeeks: 4 })).not.toEqual([]);
    expect(checkWeekInvariants(broken, { maxLoadWeeks: 4, fromMonday: '2027-06-07' })).toEqual([]);
  });

  it('Erholungs-Faktor: 0,6; im Tapering/Rennwoche/Erholung nach dem Rennen der größte Wettkampf-Faktor', () => {
    expect(deloadVolumeFactor({ phase: null })).toBe(0.6);
    expect(deloadVolumeFactor({ phase: 'build' })).toBe(0.6);
    expect(deloadVolumeFactor({ phase: 'taper' })).toBe(COMPETITION_DELOAD_MAX_FACTOR);
    expect(COMPETITION_DELOAD_MAX_FACTOR).toBe(0.75);
  });

  it('newInvariantViolations: Altverstöße zählen nicht, neue und verschlimmerte schon (Wächter-Auflage 5)', () => {
    const broken = plan.sessions.map((s) =>
      s.block_no === 1 && s.is_deload ? { ...s, is_deload: false } : s,
    );
    expect(checkWeekInvariants(broken, { maxLoadWeeks: 4 }).length).toBeGreaterThan(0);
    expect(newInvariantViolations(broken, broken, { maxLoadWeeks: 4 })).toEqual([]);
    const worse = broken.map((s) =>
      s.block_no === 2 && s.is_deload ? { ...s, is_deload: false } : s,
    );
    expect(newInvariantViolations(broken, worse, { maxLoadWeeks: 4 }).length).toBeGreaterThan(0);
  });

  it('Erholungswoche: RPE höchstens Belastungswoche − 2 (mindestens 5)', () => {
    const softer = plan.sessions.map((s) =>
      s.block_no === 1 && s.is_deload
        ? {
            ...s,
            exercises: s.exercises.map((e) => ({
              ...e,
              rpe_target: Math.min(10, e.rpe_target + 1),
            })),
          }
        : s,
    );
    expect(
      checkWeekInvariants(softer, { maxLoadWeeks: 4 }).some((v) => v.code === 'deload_rpe'),
    ).toBe(true);
  });

  it('newInvariantViolations Lücke A: sinkt nur die Grenze, wächst die Überschreitung → neu', () => {
    const run = (id: string, date: string, week: number, minutes: number) =>
      ({
        id,
        block_no: 1,
        week_no: week,
        is_deload: false,
        is_intro_week: false,
        kind: 'endurance',
        scheduled_on: date,
        estimated_minutes: minutes,
        exercises: [],
      }) as unknown as StoredSession;
    const before = [run('a', '2026-10-05', 1, 100), run('b', '2026-10-12', 2, 125)];
    const after = [run('a', '2026-10-05', 1, 85), run('b', '2026-10-12', 2, 125)];
    expect(checkWeekInvariants(before, { maxLoadWeeks: 4 })).toHaveLength(1);
    expect(newInvariantViolations(before, before, { maxLoadWeeks: 4 })).toEqual([]);
    const fresh = newInvariantViolations(before, after, { maxLoadWeeks: 4 });
    expect(fresh.map((v) => [v.code, v.value, v.limit])).toEqual([['endurance_increase', 125, 93]]);
  });

  it('newInvariantViolations Lücke B: gleicher Verstoß in einer zweiten Einheit wird nicht verdeckt', () => {
    const deloadSessions = plan.sessions.filter((s) => s.block_no === 1 && s.is_deload);
    const sameId = deloadSessions[0]?.exercises[0]?.exercise_id as string;
    const bump = (ids: readonly string[]) =>
      plan.sessions.map((s) =>
        ids.includes(s.id)
          ? {
              ...s,
              // Dieselbe Übung in beiden Einheiten (wie bei gleicher Vorlagen-Einheit) – nur Einheit/Stelle unterscheiden.
              exercises: s.exercises.map((e, i) =>
                i === 0 ? { ...e, exercise_id: sameId, sets: 6 } : e,
              ),
            }
          : s,
      );
    const [first, second] = deloadSessions;
    const one = bump([first?.id as string]);
    const two = bump([first?.id as string, second?.id as string]);
    expect(newInvariantViolations(one, one, { maxLoadWeeks: 4 })).toEqual([]);
    const fresh = newInvariantViolations(one, two, { maxLoadWeeks: 4 });
    expect(fresh.some((v) => v.code === 'deload_sets' && v.sessionRef === second?.id)).toBe(true);
  });

  it('newInvariantViolations: Multimenge – ein zusätzlicher Verstoß mit gleichem Schlüssel ist neu', () => {
    const deload = plan.sessions.find((s) => s.block_no === 1 && s.is_deload) as StoredSession;
    const heavy = {
      ...deload,
      exercises: deload.exercises.map((e, i) => (i === 0 ? { ...e, sets: 6 } : e)),
    };
    const base = plan.sessions.map((s) => (s.id === deload.id ? heavy : s));
    // Gleiche Einheit (gleiche ID, gleiches Datum) doppelt: gleicher Schlüssel zweimal.
    const doubled = [...base, heavy];
    const fresh = newInvariantViolations(base, doubled, { maxLoadWeeks: 4 });
    expect(fresh.filter((v) => v.code === 'deload_sets')).toHaveLength(1);
  });

  it('Wochen-Satz-Deckel der getauschten Woche hat einen eigenen Code', () => {
    const swappedBig = plan.sessions.map((s) =>
      s.block_no === 1 && s.week_no === 5
        ? {
            ...s,
            is_deload: false,
            exercises: [
              ...s.exercises,
              ...s.exercises.map((e) => ({
                ...e,
                order_no: e.order_no + 20,
                exercise_id: `${e.exercise_id}-x`,
              })),
            ],
          }
        : s,
    );
    const codes = checkWeekInvariants(swappedBig, {
      maxLoadWeeks: 9,
      swappedWeeks: [{ blockNo: 1, weekNo: 5 }],
    }).map((v) => v.code);
    expect(codes).toContain('swapped_week_sets_total');
  });

  it('planWeeks: gemischte Woche gilt vorsichtig als Belastungswoche', () => {
    const week = plan.sessions.filter((s) => s.block_no === 1 && s.is_deload);
    const mixed = week.map((s, i) => (i === 0 ? { ...s, is_deload: false } : s));
    expect(planWeeks(mixed)[0]?.isDeload).toBe(false);
  });
});

describe('Invarianten-Fixtures (adjust/fixtures/invariants.json, für pgTAP 50_week_invariants)', () => {
  it('26 Fälle (20 aus Etappe A, 6 aus Wächter B Auflage 5), gültige und absichtlich verletzte, jeder Code mindestens einmal', () => {
    expect(fixtures).toHaveLength(26);
    const codes = new Set(fixtures.flatMap((f) => f.expected));
    for (const code of [
      'too_many_load_weeks',
      'endurance_increase',
      'deload_endurance',
      'deload_sets',
      'deload_rpe',
      'swapped_week_above_previous',
      'swapped_week_sets_total',
      'second_deload_forward_in_block',
    ]) {
      expect(codes.has(code)).toBe(true);
    }
    expect(fixtures.filter((f) => f.expected.length === 0).length).toBeGreaterThanOrEqual(10);
  });

  it('Core entscheidet jeden Fall wie festgehalten', () => {
    for (const f of fixtures) {
      expect(codesOf(f.sessions, f.options), f.name).toEqual(f.expected);
    }
  });

  it('die Datei ist aktuell (neu erzeugt = gespeichert)', () => {
    expect(buildInvariantFixtures()).toEqual(fixtures);
  });
});
