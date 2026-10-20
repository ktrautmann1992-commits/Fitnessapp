import { toSavePlanPayload } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { planPersonRows, seededBackend, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import { buildCompetitionPlan, type CompetitionDraft, countdownPayload } from './competition';
import { competitionOutlineFromRows, competitionTileView } from './competition-dashboard';
import { activePlan, effectiveSafetyRules } from './training-plan';
import type { UserRows } from './types';

/**
 * Wettkampfplan leicht finden (Gründer-Rückmeldung 20.10.2026): Kachel „Mein Wettkampf“ und „So ist dein Plan
 * aufgebaut“ aus den Zeilen. TODAY = Samstag, 03.10.2026.
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

function runner(): UserRows {
  const rows = planPersonRows({ level: 'advanced', goal: 'endurance', slots: ENDURANCE_SLOTS });
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

async function withCountdown(rows: UserRows, raceDate: string): Promise<UserRows> {
  const { backend } = seededBackend(rows);
  const payload = countdownPayload(draft(raceDate), null);
  if (!payload) throw new Error('kein Countdown');
  return backend.saveCompetition(payload, rows);
}

async function withCompetitionPlan(rows: UserRows): Promise<UserRows> {
  const { backend } = seededBackend(rows);
  const library = await backend.loadPlanLibrary({ allowCached: false });
  if (!library) throw new Error('Bibliothek fehlt');
  const build = buildCompetitionPlan(rows, VERSIONS, null, library, draft(), null, TODAY);
  if (typeof build === 'string' || !build.result.ok) throw new Error('kein Plan');
  const next = await backend.saveCompetition(build.competition, rows);
  return backend.savePlan(toSavePlanPayload(build.result.plan), next);
}

const rulesOf = (rows: UserRows, today = TODAY) => effectiveSafetyRules(rows, VERSIONS, today);

function tile(rows: UserRows, today = TODAY, offline = false) {
  return competitionTileView({
    rows,
    versions: VERSIONS,
    active: activePlan(rows),
    rules: rulesOf(rows, today),
    today,
    offline,
  });
}

describe('competitionTileView', () => {
  it('ohne Wettkampf: „Wettkampf planen“', () => {
    expect(tile(runner())).toEqual({ kind: 'none' });
  });

  it('geplanter Wettkampf mit unlesbaren Angaben: Fehlerzustand statt „kein Wettkampf“', async () => {
    const rows = await withCountdown(runner(), '2027-01-31');
    const broken: UserRows = {
      ...rows,
      competitions: rows.competitions.map((c) => ({ ...c, discipline: 'raketen' as never })),
    };
    expect(tile(broken)).toEqual({ kind: 'unreadable' });
  });

  it('nur Countdown (Grundlagen-Plan): Name, Distanz, Countdown, Ampel „Passt“, keine Phase', async () => {
    const rows = await withCountdown(runner(), '2027-01-31');
    expect(tile(rows)).toMatchObject({
      kind: 'competition',
      name: 'Winterlauf',
      discipline: 'half_marathon',
      raceDate: '2027-01-31',
      countdown: { kind: 'upcoming', daysLeft: 120, raceWeek: false },
      week: null,
      planState: 'basic',
      ampel: { kind: 'feasibility', status: 'ok' },
    });
    // Zu knapp → Ampel „Zu kurz“.
    const tight = await withCountdown(runner(), '2026-12-15');
    expect(tile(tight)).toMatchObject({ ampel: { kind: 'feasibility', status: 'too_short' } });
  });

  it('Wettkampfplan aktiv: Phase und „Woche X von Y“, Ampel „Wettkampfplan aktiv“', async () => {
    const rows = await withCompetitionPlan(runner());
    const view = tile(rows, '2026-10-14');
    expect(view).toMatchObject({
      kind: 'competition',
      planState: 'competition',
      ampel: { kind: 'plan_active' },
      week: { phase: 'base', raceWeek: false },
    });
    if (view.kind !== 'competition' || !view.week) throw new Error('keine Woche');
    expect(view.week.weekNo).toBeGreaterThanOrEqual(1);
    expect(view.week.totalWeeks).toBeGreaterThan(view.week.weekNo ?? 0);
  });

  it('Renntag vorbei, noch geplant: Countdown „Ergebnis eintragen“, keine Ampel mehr', async () => {
    const rows = await withCountdown(runner(), '2026-12-15');
    expect(tile(rows, '2026-12-16')).toMatchObject({
      countdown: { kind: 'awaiting_result', daysSince: 1 },
      planState: 'basic_race_over',
      ampel: null,
    });
  });
});

describe('competitionOutlineFromRows', () => {
  it('nur bei passendem Wettkampfplan; Wochen wie „Woche X von Y“, aktuelle Woche markiert', async () => {
    expect(competitionOutlineFromRows(runner(), activePlan(runner()), null, TODAY)).toBeNull();
    const countdownOnly = await withCountdown(runner(), '2027-01-31');
    expect(
      competitionOutlineFromRows(countdownOnly, activePlan(countdownOnly), null, TODAY),
    ).toBeNull();

    const rows = await withCompetitionPlan(runner());
    const active = activePlan(rows);
    const outline = competitionOutlineFromRows(
      rows,
      active,
      rulesOf(rows, '2026-10-14'),
      '2026-10-14',
    );
    expect(outline).not.toBeNull();
    expect(outline?.phases.map((p) => p.phase)).toEqual([
      'base',
      'build',
      'peak',
      'taper',
      'race_week',
      'recovery',
    ]);
    const tileWeek = tile(rows, '2026-10-14');
    if (tileWeek.kind !== 'competition') throw new Error('kein Wettkampf');
    expect(outline?.currentWeekNo).toBe(tileWeek.week?.weekNo);
    expect(outline?.totalWeeks).toBe(tileWeek.week?.totalWeeks);
    // Geplante Wochen tragen den gespeicherten Stand (keine Vorschau), spätere sind Vorschau.
    const weeks = outline?.phases.flatMap((p) => p.weeks) ?? [];
    expect(weeks.some((w) => !w.projected)).toBe(true);
    expect(weeks.at(-1)?.projected).toBe(true);
    // Ohne Regeln (offline ohne Zwischenspeicher) geht es trotzdem.
    expect(competitionOutlineFromRows(rows, active, null, '2026-10-14')).not.toBeNull();
  });
});
