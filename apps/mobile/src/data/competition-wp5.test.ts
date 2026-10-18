import {
  brickWorkout,
  type CompetitionFeasibility,
  sportMinutes,
  toSavePlanPayload,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import {
  disciplineText,
  feasibilityFacts,
  stepLines,
  stepTitle,
  suggestionText,
  workoutInfoLines,
} from '../lib/competition-format';
import { planPersonRows, seededBackend, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import {
  buildCompetitionPlan,
  competitionFollowUpFromRows,
  type CompetitionDraft,
  draftFeasibility,
  isCompetitionPlan,
  planBasisChanged,
  plannedCompetition,
} from './competition';
import { activePlan, effectiveSafetyRules } from './training-plan';
import type { UserRows } from './types';

/**
 * Rad und Triathlon in der App (Etappe WP5, docs/PLAN-PHASE-10.md Abschnitt 9): Wettkampf mit Rad-Distanz bzw. Triathlon
 * im Testmodus speichern (gleiche Regeln wie der Server), Wettkampfplan mit Koppeltraining und Schwimmtechnik, Texte.
 * TODAY = Samstag, 03.10.2026.
 */

const SLOTS: UserRows['trainingSlots'] = [
  [2, 60],
  [4, 60],
  [6, 60],
  [7, 150],
].map(([weekday, minutes], i) => ({
  user_id: USER_ID,
  slot_no: i + 1,
  weekday: weekday as number,
  kind: 'endurance',
  minutes: minutes as number,
}));

function athlete(options: Parameters<typeof planPersonRows>[0] = {}): UserRows {
  const rows = planPersonRows({ level: 'advanced', goal: 'endurance', slots: SLOTS, ...options });
  return { ...rows, goals: rows.goals && { ...rows.goals, discipline: 'half_marathon' } };
}

const draft = (
  discipline: 'cycling' | 'triathlon_sprint' | 'triathlon_olympic',
  distanceKm: number | null = null,
  raceDate = '2027-02-28',
): CompetitionDraft => ({
  competition: {
    name: 'Wettkampf',
    discipline,
    raceDate,
    goal: 'finish',
    targetTimeS: null,
    reference: null,
    distanceKm,
  },
  longRunWeekday: null,
  ownStart: null,
});

async function setup(rows: UserRows) {
  const { backend } = seededBackend(rows);
  const library = await backend.loadPlanLibrary({ allowCached: false });
  if (!library) throw new Error('Bibliothek fehlt');
  return { backend, library };
}

describe('Wettkampfplan Triathlon und Rad im Testmodus', () => {
  it('Triathlon Sprint: save_competition → save_training_plan, Koppeltraining und Schwimmtechnik gespeichert', async () => {
    const rows = athlete();
    const { backend, library } = await setup(rows);
    const build = buildCompetitionPlan(
      rows,
      VERSIONS,
      null,
      library,
      draft('triathlon_sprint'),
      null,
      TODAY,
    );
    if (typeof build === 'string' || !build.result.ok) throw new Error('kein Plan');
    expect(build.goalDisciplineChange).toBe(true);
    expect(build.competition).toMatchObject({ discipline: 'triathlon_sprint' });
    expect('distance_km' in build.competition).toBe(false);
    const payload = toSavePlanPayload(build.result.plan);
    const saved = await backend.savePlan(
      payload,
      await backend.saveCompetition(build.competition, rows),
    );
    const active = activePlan(saved);
    expect(isCompetitionPlan(active)).toBe(true);
    expect(saved.competitions[0]).toMatchObject({ distance_m: 25_750, uses_health_data: true });
    const sessions = active?.sessions ?? [];
    expect(
      sessions.some((s) => s.workout_type === 'technique' && s.endurance_modality === 'swim'),
    ).toBe(true);
    const minutes = sportMinutes(sessions);
    expect(minutes.swim > 0 && minutes.bike > 0 && minutes.run > 0).toBe(true);
  });

  it('Triathlon: Folgeblock (Aufbau) mit Koppeltraining wird im Testmodus angenommen', async () => {
    const rows = athlete();
    const { backend, library } = await setup(rows);
    const build = buildCompetitionPlan(
      rows,
      VERSIONS,
      null,
      library,
      draft('triathlon_sprint', null, '2026-12-27'),
      null,
      TODAY,
    );
    if (typeof build === 'string' || !build.result.ok) throw new Error('kein Plan');
    let next = await backend.saveCompetition(build.competition, rows);
    next = await backend.savePlan(toSavePlanPayload(build.result.plan), next);
    const active = activePlan(next);
    if (!active) throw new Error('kein Plan');
    const rules = effectiveSafetyRules(next, VERSIONS, TODAY);
    if (!rules) throw new Error('Regeln fehlen');
    const last = [...active.sessions].sort((a, b) =>
      b.scheduled_on.localeCompare(a.scheduled_on),
    )[0];
    const follow = competitionFollowUpFromRows(
      next,
      VERSIONS,
      active,
      rules,
      library,
      last?.scheduled_on ?? TODAY,
    );
    expect(follow.kind).toBe('block');
    if (follow.kind !== 'block') return;
    expect(follow.sessions.some((s) => s.workout_type === 'brick')).toBe(true);
    const appended = await backend.appendPlanBlock(
      active.plan.id,
      active.plan.uses_health_data,
      follow.sessions,
      next,
    );
    expect(appended.plannedSessions.length).toBeGreaterThan(next.plannedSessions.length);
  });

  it('Rad 100 km: Distanz im Datensatz, Plan nur Rad; Distanz ändern ist plan-relevant', async () => {
    const rows = athlete();
    const { backend, library } = await setup(rows);
    const build = buildCompetitionPlan(
      rows,
      VERSIONS,
      null,
      library,
      draft('cycling', 100),
      null,
      TODAY,
    );
    if (typeof build === 'string' || !build.result.ok) throw new Error('kein Plan');
    const withCompetition = await backend.saveCompetition(build.competition, rows);
    expect(withCompetition.competitions[0]).toMatchObject({
      discipline: 'cycling',
      distance_m: 100_000,
    });
    const saved = await backend.savePlan(toSavePlanPayload(build.result.plan), withCompetition);
    const endurance = (activePlan(saved)?.sessions ?? []).filter((s) => s.kind === 'endurance');
    expect(endurance.length).toBeGreaterThan(10);
    expect(endurance.every((s) => s.endurance_modality === 'bike')).toBe(true);
    const planned = plannedCompetition(saved);
    expect(planned?.stored.competition.distanceKm).toBe(100);
    if (!planned) throw new Error('kein Wettkampf');
    expect(
      planBasisChanged(planned.stored, { ...draft('cycling', 100), longRunWeekday: null }),
    ).toBe(false);
    expect(planBasisChanged(planned.stored, draft('cycling', 150))).toBe(true);
  });

  it('Triathlon mit 2 Ausdauer-Tagen: „zu kurz“ mit Grund; unter 18 kein Olympisch', () => {
    const two = athlete({ slots: SLOTS.slice(2) });
    const f = draftFeasibility(two, VERSIONS, null, draft('triathlon_sprint'), TODAY);
    expect(f.kind === 'result' && f.result.ok && f.result.feasibility.reasons).toEqual([
      'triathlon_days_too_few',
    ]);
    const minor = athlete({ birthDate: '2009-12-01' });
    const g = draftFeasibility(minor, VERSIONS, null, draft('triathlon_olympic'), TODAY);
    expect(g.kind === 'result' && g.result.ok && g.result.feasibility.status).toBe('not_available');
  });
});

describe('Texte Rad und Triathlon', () => {
  it('Distanz als Wort, Vorschlag mit km, lange Ausfahrt in der Ampel', () => {
    expect(disciplineText('cycling', 120)).toBe('Radrennen 120 km');
    expect(disciplineText('cycling')).toBe('Radrennen');
    expect(disciplineText('triathlon_olympic')).toBe('Triathlon olympisch');
    expect(
      suggestionText({ kind: 'shorter_distance', discipline: 'cycling', distanceKm: 100 }),
    ).toBe('Kürzere Distanz: Radrennen 100 km');
    const f = {
      status: 'ok',
      leadWeeks: 20,
      minimumLeadWeeks: 12,
      plannedPeakMinutes: 180,
      requiredWeeklyMinutes: 180,
      plannedLongRunMinutes: 90,
      requiredLongRunMinutes: 90,
      effectiveGoal: 'finish',
    } as CompetitionFeasibility;
    expect(feasibilityFacts(f, 'cycling')).toContain(
      'Längste Ausfahrt im Plan: 90 min (nötig: 90 min).',
    );
    expect(feasibilityFacts(f, '10k')).toContain('Längster Lauf im Plan: 90 min (nötig: 90 min).');
  });

  it('Koppeltraining: zwei Teile in der Anzeige, Sportart je Schritt im Ablauf und im Timer', () => {
    const brick = brickWorkout(40, 4);
    if (!brick) throw new Error('kein Koppeltraining');
    expect(
      workoutInfoLines(
        { workout_type: 'brick', estimated_minutes: 40 },
        { pace: null, distanceM: null, hard: false },
      ),
    ).toEqual([
      'Art: Koppeltraining (Rad → Lauf)',
      'Zwei Teile in einer Einheit: Teil 1 Rad 28 min, Teil 2 Laufen 12 min – direkt hintereinander.',
    ]);
    expect(stepLines(brick.steps, ['bike', 'bike', 'run'])).toEqual([
      'Aufwärmen (Rad): 5 min locker (Anstrengung 2)',
      'Hauptteil (Rad): 23 min locker (Anstrengung 4)',
      'Hauptteil (Laufen): 12 min locker (Anstrengung 4)',
    ]);
    expect(stepTitle(brick.steps[2]!, 'run')).toBe('Hauptteil (Laufen): 12 min locker');
    expect(stepTitle(brick.steps[2]!)).toBe('Hauptteil: 12 min locker');
  });
});
