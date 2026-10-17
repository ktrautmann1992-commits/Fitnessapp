import { toSavePlanPayload } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { planPersonRows, seededBackend, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import {
  buildCompetitionPlan,
  competitionFollowUpFromRows,
  competitionPlanInputs,
  countdownPayload,
  type CompetitionDraft,
  draftFeasibility,
  isCompetitionPlan,
  loggedEnduranceMinutes,
  plannedCompetition,
  resavePayload,
  resultLogCandidate,
  startReferenceFromRows,
} from './competition';
import { activePlan, effectiveSafetyRules } from './training-plan';
import type { UserRows } from './types';

/**
 * Wettkampf in der App (Etappe WP4): Zeilen → Engine → save_competition/save_training_plan im Testmodus (gleiche
 * Regeln wie der Server, packages/core competition-rules.ts). TODAY = Samstag, 03.10.2026.
 */

const ENDURANCE_SLOTS: UserRows['trainingSlots'] = [
  [1, 60],
  [3, 60],
  [6, 90],
].map(([weekday, minutes], i) => ({
  user_id: USER_ID,
  slot_no: i + 1,
  weekday: weekday as number,
  kind: 'endurance',
  minutes: minutes as number,
}));

function runner(options: Parameters<typeof planPersonRows>[0] = {}): UserRows {
  const rows = planPersonRows({
    level: 'advanced',
    goal: 'endurance',
    slots: ENDURANCE_SLOTS,
    ...options,
  });
  return { ...rows, goals: rows.goals && { ...rows.goals, discipline: 'half_marathon' } };
}

const draft = (
  raceDate = '2027-01-31',
  discipline: 'half_marathon' | '10k' = 'half_marathon',
): CompetitionDraft => ({
  competition: {
    name: 'Winterlauf',
    discipline,
    raceDate,
    goal: 'finish',
    targetTimeS: null,
    reference: { discipline: '10k', timeS: 3000, date: '2026-09-20' },
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

describe('Ampel aus den Zeilen', () => {
  it('Hauptziel nicht Ausdauer bzw. Angaben unvollständig: Blocker statt Ampel', () => {
    expect(competitionPlanInputs(planPersonRows(), VERSIONS, draft())).toBe('goal_not_endurance');
    expect(competitionPlanInputs({ ...runner(), goals: null }, VERSIONS, draft())).toBe(
      'incomplete',
    );
  });
  it('Distanz des Wettkampfs gilt für die Engine (Ziel wird beim Erstellen mit geändert)', () => {
    const inputs = competitionPlanInputs(runner(), VERSIONS, draft('2027-01-31', '10k'));
    expect(typeof inputs === 'string' ? null : inputs.discipline).toBe('10k');
  });
  it('grün mit 17 Wochen, rot mit 6 Wochen (nie gestaucht)', () => {
    const rows = runner();
    const ok = draftFeasibility(rows, VERSIONS, null, draft(), TODAY);
    expect(ok.kind === 'result' && ok.result.ok && ok.result.feasibility.status).toBe('ok');
    const short = draftFeasibility(rows, VERSIONS, null, draft('2026-11-15'), TODAY);
    expect(short.kind === 'result' && short.result.ok && short.result.feasibility.status).toBe(
      'too_short',
    );
  });
  it('ohne Einwilligung: „nicht möglich“ (Gesundheits-Check nötig)', () => {
    const f = draftFeasibility(runner({ consent: 'none' }), VERSIONS, null, draft(), TODAY);
    expect(f.kind === 'result' && f.result.ok && f.result.feasibility.status).toBe('not_available');
  });
});

describe('Wettkampfplan erstellen: save_competition (mit Plan-Bezug) → save_training_plan', () => {
  it('Reihenfolge zwingend: ohne Wettkampf lehnt der Testmodus den Plan ab, danach wird er angenommen', async () => {
    const rows = runner();
    const { backend, library } = await setup(rows);
    const build = buildCompetitionPlan(rows, VERSIONS, null, library, draft(), null, TODAY);
    if (typeof build === 'string' || !build.result.ok) throw new Error('kein Plan');
    expect(build.competition).toMatchObject({ effective_goal: 'finish', id: null });
    expect(build.goalDisciplineChange).toBe(false);
    const payload = toSavePlanPayload(build.result.plan);
    expect(payload.sessions.every((s) => s.workout_type)).toBe(true);
    await expect(backend.savePlan(payload, rows)).rejects.toMatchObject({ code: 'plan_rejected' });
    const withCompetition = await backend.saveCompetition(build.competition, rows);
    expect(withCompetition.competitions[0]).toMatchObject({
      status: 'planned',
      uses_health_data: true,
      effective_goal: 'finish',
      distance_m: 21_097.5,
    });
    expect(withCompetition.goals?.target_date).toBe('2027-01-31');
    const saved = await backend.savePlan(payload, withCompetition);
    expect(isCompetitionPlan(activePlan(saved))).toBe(true);
  });

  it('Countdown ohne Plan-Bezug reicht nicht für einen Wettkampfplan', async () => {
    const rows = runner();
    const { backend, library } = await setup(rows);
    const build = buildCompetitionPlan(rows, VERSIONS, null, library, draft(), null, TODAY);
    if (typeof build === 'string' || !build.result.ok) throw new Error('kein Plan');
    const countdown = countdownPayload(draft(), null);
    if (!countdown) throw new Error('kein Countdown');
    const next = await backend.saveCompetition(countdown, rows);
    expect(next.competitions[0]).toMatchObject({ uses_health_data: false, effective_goal: null });
    await expect(
      backend.savePlan(toSavePlanPayload(build.result.plan), next),
    ).rejects.toMatchObject({
      code: 'plan_rejected',
    });
  });

  it('zweiter geplanter Wettkampf abgelehnt (W-G9), mit Grund', async () => {
    const rows = runner();
    const { backend } = await setup(rows);
    const countdown = countdownPayload(draft(), null);
    if (!countdown) throw new Error('kein Countdown');
    const next = await backend.saveCompetition(countdown, rows);
    await expect(backend.saveCompetition(countdown, next)).rejects.toMatchObject({
      code: 'competition_rejected',
      competitionReason: 'competition_exists',
    });
  });

  it('Plan-Bezug ohne Einwilligung abgelehnt; Countdown geht', async () => {
    const rows = runner({ consent: 'none' });
    const { backend } = await setup(rows);
    const withBasis = {
      ...(countdownPayload(draft(), null) as NonNullable<ReturnType<typeof countdownPayload>>),
      effective_goal: 'finish' as const,
    };
    await expect(backend.saveCompetition(withBasis, rows)).rejects.toMatchObject({
      competitionReason: 'health_check_required',
    });
  });
});

describe('Folgeblock eines Wettkampfplans', () => {
  it('ohne Wettkampfplan: normaler Folgeblock', () => {
    const rows = runner();
    const rules = effectiveSafetyRules(rows, VERSIONS, TODAY);
    if (!rules) throw new Error('Regeln fehlen');
    const plan = { plan: { id: 'p', inputs: {}, start_date: TODAY }, sessions: [] } as never;
    expect(competitionFollowUpFromRows(rows, VERSIONS, plan, rules, {} as never, TODAY)).toEqual({
      kind: 'not_competition',
    });
  });

  it('Folgeblock aus dem gespeicherten Wettkampf; abgesagt → „Plan neu erstellen“', async () => {
    const rows = runner();
    const { backend, library } = await setup(rows);
    const build = buildCompetitionPlan(rows, VERSIONS, null, library, draft(), null, TODAY);
    if (typeof build === 'string' || !build.result.ok) throw new Error('kein Plan');
    let next = await backend.saveCompetition(build.competition, rows);
    next = await backend.savePlan(toSavePlanPayload(build.result.plan), next);
    const active = activePlan(next);
    if (!active) throw new Error('kein Plan');
    const rules = effectiveSafetyRules(next, VERSIONS, TODAY);
    if (!rules) throw new Error('Regeln fehlen');
    // Letzte Woche des ersten Blocks: Folgeblock fällig.
    const last = [...active.sessions].sort((a, b) =>
      b.scheduled_on.localeCompare(a.scheduled_on),
    )[0];
    const day = last?.scheduled_on ?? TODAY;
    const follow = competitionFollowUpFromRows(next, VERSIONS, active, rules, library, day);
    expect(follow.kind).toBe('block');
    if (follow.kind === 'block') {
      expect(follow.sessions.every((s) => s.workout_type && s.training_phase)).toBe(true);
      expect(follow.sessions.every((s) => s.block_no === 2)).toBe(true);
      // Testmodus nimmt den Folgeblock an (Regeln je Person wie insert_plan_sessions).
      const appended = await backend.appendPlanBlock(
        active.plan.id,
        active.plan.uses_health_data,
        follow.sessions,
        next,
      );
      expect(appended.plannedSessions.length).toBeGreaterThan(next.plannedSessions.length);
    }
    const id = next.competitions[0]?.id ?? '';
    const cancelled = await backend.cancelCompetition(id, next);
    expect(cancelled.goals?.target_date).toBeNull();
    expect(competitionFollowUpFromRows(cancelled, VERSIONS, active, rules, library, day)).toEqual({
      kind: 'ended',
      reason: 'no_competition',
    });
  });
});

describe('Hilfen', () => {
  it('eingetragene Minuten je geplanter Einheit; Tagebuch-Bezug nur aus den letzten 4 Wochen', () => {
    const rows: UserRows = {
      ...runner(),
      sessionLogs: [
        { id: 'l1', kind: 'endurance', planned_session_id: 's1', performed_on: '2026-09-30' },
        { id: 'l2', kind: 'strength', planned_session_id: 's2', performed_on: '2026-09-30' },
      ] as UserRows['sessionLogs'],
      cardioLogs: [{ session_log_id: 'l1', duration_s: 2730 }] as UserRows['cardioLogs'],
    };
    expect(loggedEnduranceMinutes(rows)).toEqual(new Map([['s1', 45]]));
    expect(startReferenceFromRows(rows, null, TODAY)).toBeNull();
  });
  it('Ergebnis-Kandidat: neuester eigener Ausdauer-Eintrag vom Renntag', () => {
    const rows: UserRows = {
      ...runner(),
      sessionLogs: [
        {
          id: 'a',
          kind: 'endurance',
          performed_on: '2027-01-31',
          created_at: '2027-01-31T10:00:00Z',
        },
        {
          id: 'b',
          kind: 'endurance',
          performed_on: '2027-01-31',
          created_at: '2027-01-31T12:00:00Z',
        },
        {
          id: 'c',
          kind: 'strength',
          performed_on: '2027-01-31',
          created_at: '2027-01-31T13:00:00Z',
        },
      ] as UserRows['sessionLogs'],
    };
    expect(resultLogCandidate(rows, '2027-01-31')).toBe('b');
    expect(resultLogCandidate(rows, '2027-02-01')).toBeNull();
  });
  it('Erneut speichern (nur Name geändert): Plan-Bezug wird mitgeschickt', async () => {
    const rows = runner();
    const { backend, library } = await setup(rows);
    const build = buildCompetitionPlan(rows, VERSIONS, null, library, draft(), null, TODAY);
    if (typeof build === 'string') throw new Error('kein Plan');
    const next = await backend.saveCompetition(build.competition, rows);
    const planned = plannedCompetition(next);
    if (!planned) throw new Error('kein Wettkampf');
    const renamed = draft();
    renamed.competition = { ...renamed.competition, name: 'Neuer Name' };
    // IDs im Testmodus sind keine UUIDs – geprüft wird hier nur der Plan-Bezug.
    const payload = resavePayload(
      { ...planned.stored, id: '11111111-1111-4111-8111-111111111111' },
      renamed,
    );
    expect(payload).toMatchObject({ name: 'Neuer Name', effective_goal: 'finish' });
  });
  it('jede Einheit des Wettkampfplans hat Art, Phase und Schritte (Summe = Dauer)', async () => {
    const rows = runner();
    const { library } = await setup(rows);
    const build = buildCompetitionPlan(
      rows,
      VERSIONS,
      null,
      library,
      draft('2026-12-27'),
      null,
      TODAY,
    );
    if (typeof build === 'string' || !build.result.ok) throw new Error('kein Plan');
    for (const s of build.result.plan.sessions) {
      expect(s.workout_type && s.training_phase).toBeTruthy();
      expect((s.workout_steps ?? []).reduce((sum, st) => sum + st.seconds, 0)).toBe(
        s.estimated_minutes * 60,
      );
    }
  });
});
