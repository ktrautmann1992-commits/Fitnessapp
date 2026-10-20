import { type CompetitionFeasibility, toSavePlanPayload } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { planPersonRows, seededBackend, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import {
  buildCompetitionPlan,
  type CompetitionDraft,
  competitionOverview,
  countdownPayload,
  draftFeasibility,
  shownFeasibility,
} from './competition';
import { activePlan } from './training-plan';
import type { UserRows } from './types';

/**
 * Übersicht „Mein Wettkampf“ (Gründer-Feedback 19.10.2026): Ampel direkt in der Übersicht, wenn der Plan kein passender
 * Wettkampfplan ist – dieselbe Rechnung wie im Formular. TODAY = Samstag, 03.10.2026.
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

const draft = (raceDate = '2027-01-31'): CompetitionDraft => ({
  competition: {
    name: 'Winterlauf',
    discipline: 'half_marathon',
    raceDate,
    goal: 'finish',
    targetTimeS: null,
    reference: null,
  },
  longRunWeekday: null,
  ownStart: null,
});

/** Nur Countdown gespeichert (Grundlagen-Plan bleibt). */
async function withCountdown(rows: UserRows, raceDate: string): Promise<UserRows> {
  const { backend } = seededBackend(rows);
  const payload = countdownPayload(draft(raceDate), null);
  if (!payload) throw new Error('kein Countdown');
  return backend.saveCompetition(payload, rows);
}

/** Wettkampf mit Plan-Bezug und Wettkampfplan. */
async function withCompetitionPlan(rows: UserRows): Promise<UserRows> {
  const { backend } = seededBackend(rows);
  const library = await backend.loadPlanLibrary({ allowCached: false });
  if (!library) throw new Error('Bibliothek fehlt');
  const build = buildCompetitionPlan(rows, VERSIONS, null, library, draft(), null, TODAY);
  if (typeof build === 'string' || !build.result.ok) throw new Error('kein Plan');
  const next = await backend.saveCompetition(build.competition, rows);
  return backend.savePlan(toSavePlanPayload(build.result.plan), next);
}

function overviewOf(rows: UserRows, options: { today?: string; offline?: boolean } = {}) {
  return competitionOverview({
    rows,
    versions: VERSIONS,
    active: activePlan(rows),
    today: options.today ?? TODAY,
    offline: options.offline ?? false,
  });
}

const statusOf = (o: ReturnType<typeof overviewOf>) => {
  const f = o?.ampel?.feasibility;
  return f?.kind === 'result' && f.result.ok ? f.result.feasibility.status : null;
};

describe('competitionOverview', () => {
  it('ohne geplanten Wettkampf: nichts', () => {
    expect(overviewOf(runner())).toBeNull();
  });

  it('Grundlagen-Plan, genug Zeit: Ampel „Passt“ mit denselben Angaben wie im Formular', async () => {
    const rows = await withCountdown(runner(), '2027-01-31');
    const o = overviewOf(rows);
    expect(o?.planState).toBe('basic');
    expect(statusOf(o)).toBe('ok');
    expect(o?.ampel?.draft.competition).toMatchObject({
      raceDate: '2027-01-31',
      discipline: 'half_marathon',
    });
    // Gleiche Rechnung wie das Formular.
    const form = draftFeasibility(rows, VERSIONS, activePlan(rows), o!.ampel!.draft, TODAY);
    expect(o?.ampel?.feasibility).toEqual(form);
    expect(shownFeasibility(o!.ampel!.feasibility, null).canCreate).toBe(true);
  });

  it('Grundlagen-Plan, zu knapp: Ampel „Zu kurz“, kein Erstellen', async () => {
    // Speicherbar (Server-Mindestvorlauf 10 Wochen), aber unter dem Vorlauf für Fortgeschrittene (12 Wochen).
    const rows = await withCountdown(runner(), '2026-12-15');
    const o = overviewOf(rows);
    expect(o?.planState).toBe('basic');
    expect(statusOf(o)).toBe('too_short');
    expect(shownFeasibility(o!.ampel!.feasibility, null)).toMatchObject({
      usable: false,
      canCreate: false,
    });
  });

  it('ohne Einwilligung: „Nicht möglich“ (Gesundheits-Check)', async () => {
    const rows = await withCountdown(runner({ consent: 'none' }), '2027-01-31');
    expect(statusOf(overviewOf(rows))).toBe('not_available');
  });

  it('Hauptziel nicht Ausdauer: Blocker statt Ampel', async () => {
    const rows = await withCountdown(planPersonRows(), '2027-01-31');
    const o = overviewOf(rows);
    expect(o?.ampel?.feasibility).toEqual({ kind: 'blocked', blocker: 'goal_not_endurance' });
    expect(shownFeasibility(o!.ampel!.feasibility, null).canCreate).toBe(false);
  });

  it('Renntag heute bzw. vorbei: keine Ampel, eigener Text', async () => {
    const rows = await withCountdown(runner(), '2026-12-15');
    expect(overviewOf(rows, { today: '2026-12-15' })).toEqual({
      planState: 'basic_race_over',
      ampel: null,
    });
  });

  it('passender Wettkampfplan: keine Ampel', async () => {
    const rows = await withCompetitionPlan(runner());
    expect(overviewOf(rows)).toEqual({ planState: 'competition', ampel: null });
  });

  it('Wettkampfplan passt nicht mehr (andere Distanz): Ampel für den gespeicherten Wettkampf', async () => {
    const rows = await withCompetitionPlan(runner());
    const changed: UserRows = {
      ...rows,
      competitions: rows.competitions.map((c) => ({ ...c, discipline: '10k', distance_m: 10_000 })),
    };
    const o = overviewOf(changed);
    expect(o?.planState).toBe('mismatch');
    expect(o?.ampel?.draft.competition.discipline).toBe('10k');
    expect(statusOf(o)).toBe('ok');
  });

  it('offline ohne Plan-Bezug: Stand unbekannt, keine Ampel (nichts Falsches)', async () => {
    const rows = await withCompetitionPlan(runner());
    const noBasis: UserRows = {
      ...rows,
      competitions: rows.competitions.map((c) => ({ ...c, effective_goal: null })),
    };
    expect(overviewOf(noBasis, { offline: true })).toEqual({
      planState: 'offline_unknown',
      ampel: null,
    });
    expect(overviewOf(noBasis)?.planState).toBe('mismatch');
  });
});

describe('shownFeasibility', () => {
  const rejected = { status: 'too_short' } as CompetitionFeasibility;
  it('ohne Rechnung: nichts', () => {
    expect(shownFeasibility(null, null)).toEqual({ shown: null, usable: false, canCreate: false });
  });
  it('Ablehnung vom Server hat Vorrang vor „Passt“', async () => {
    const rows = await withCountdown(runner(), '2027-01-31');
    const f = draftFeasibility(rows, VERSIONS, null, draft(), TODAY);
    expect(shownFeasibility(f, null).canCreate).toBe(true);
    expect(shownFeasibility(f, rejected)).toEqual({
      shown: rejected,
      usable: false,
      canCreate: false,
    });
  });
  it('„Knapp“ zählt als nutzbar', async () => {
    const rows = await withCountdown(runner(), '2027-01-31');
    const f = draftFeasibility(rows, VERSIONS, null, draft(), TODAY);
    if (f.kind !== 'result' || !f.result.ok) throw new Error('keine Ampel');
    const tight = {
      ...f,
      result: { ...f.result, feasibility: { ...f.result.feasibility, status: 'tight' as const } },
    };
    expect(shownFeasibility(tight, null)).toMatchObject({ usable: true, canCreate: true });
  });
});
