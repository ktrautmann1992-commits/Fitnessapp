import { toSavePlanPayload } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { planPersonRows, TODAY, USER_ID, uuidBackend, VERSIONS } from '../test/fixtures';
import {
  buildCompetitionPlan,
  competitionFollowUpFromRows,
  competitionPlanView,
  competitionSaveOptions,
  type CompetitionDraft,
  countdownPayload,
  displayedSessionNames,
  draftFromStored,
  planBasisChanged,
  plannedCompetition,
  resultLogToReuse,
  timeGoalOffered,
} from './competition';
import { sessionDisplay } from './exercise-swap';
import { activePlan, effectiveSafetyRules } from './training-plan';
import type { UserRows } from './types';

/**
 * Auflagen des Wächters zu WP4 (H1, M2, M3, M4, M6, M7, N8) – App-Pfad über den Testmodus (gleiche Regeln wie der
 * Server). TODAY = Samstag, 03.10.2026.
 */

const SLOTS: UserRows['trainingSlots'] = [
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

function runner(discipline: '5k' | 'half_marathon' = 'half_marathon'): UserRows {
  const rows = planPersonRows({ level: 'advanced', goal: 'endurance', slots: SLOTS });
  return { ...rows, goals: rows.goals && { ...rows.goals, discipline } };
}

const draft = (
  raceDate: string,
  discipline: '5k' | 'half_marathon' = 'half_marathon',
): CompetitionDraft => ({
  competition: {
    name: 'Lauf',
    discipline,
    raceDate,
    goal: 'finish',
    targetTimeS: null,
    reference: { discipline: '10k', timeS: 3000, date: '2026-09-20' },
  },
  longRunWeekday: null,
  ownStart: null,
});

/** Wettkampfplan im Testmodus anlegen: save_competition (mit Bezug) → save_training_plan. */
async function withCompetitionPlan(rows: UserRows, d: CompetitionDraft) {
  const { backend } = uuidBackend(rows);
  const library = await backend.loadPlanLibrary({ allowCached: false });
  if (!library) throw new Error('Bibliothek fehlt');
  const build = buildCompetitionPlan(rows, VERSIONS, null, library, d, null, TODAY);
  if (typeof build === 'string' || !build.result.ok) throw new Error('kein Plan');
  let next = await backend.saveCompetition(build.competition, rows);
  next = await backend.savePlan(toSavePlanPayload(build.result.plan), next);
  return { backend, library, rows: next };
}

describe('H1: Wettkampf geändert, Plan läuft weiter → kein Phasen-Band/keine Pace, Hinweis', () => {
  it('Renntag vorverlegt (nur Countdown gespeichert, z. B. von einem anderen Gerät) → mismatch', async () => {
    const { backend, rows } = await withCompetitionPlan(runner('5k'), draft('2026-11-22', '5k'));
    const active = activePlan(rows);
    const rules = effectiveSafetyRules(rows, VERSIONS, TODAY);
    const before = competitionPlanView(rows, active, TODAY, false, rules);
    expect(before.mismatch).toBe(false);
    expect(before.week).not.toBeNull();
    expect(before.paceProfile).not.toBeNull();
    const planned = plannedCompetition(rows);
    if (!planned) throw new Error('kein Wettkampf');
    const moved = countdownPayload(
      {
        ...draftFromStored(planned.stored),
        competition: { ...planned.stored.competition, raceDate: '2026-11-01' },
      },
      planned.stored.id,
    );
    if (!moved) throw new Error('kein Payload');
    const after = await backend.saveCompetition(moved, rows);
    const view = competitionPlanView(after, activePlan(after), TODAY, false, rules);
    expect(view).toMatchObject({ mismatch: true, week: null, paceProfile: null });
    // Offline (Zwischenspeicher ohne Plan-Bezug): nichts Falsches behaupten, aber auch kein Phasen-Band.
    expect(competitionPlanView(after, activePlan(after), TODAY, true, rules)).toMatchObject({
      mismatch: false,
      week: null,
    });
  });

  it('Speichern-Optionen: bei laufendem Wettkampfplan und geändertem Datum kein „nur Countdown“', async () => {
    const { rows } = await withCompetitionPlan(runner('5k'), draft('2026-11-22', '5k'));
    const planned = plannedCompetition(rows);
    if (!planned) throw new Error('kein Wettkampf');
    const stored = planned.stored;
    const base = draftFromStored(stored);
    const earlier = { ...base, competition: { ...base.competition, raceDate: '2026-11-08' } };
    expect(
      competitionSaveOptions({
        stored,
        draft: earlier,
        competitionPlanActive: true,
        feasibilityUsable: true,
      }),
    ).toEqual({ saveOnly: null, recreateCompetitionPlan: true, recreateBasicPlan: true });
    // Ampel rot → nur „ohne Wettkampf neu erstellen“.
    expect(
      competitionSaveOptions({
        stored,
        draft: earlier,
        competitionPlanActive: true,
        feasibilityUsable: false,
      }),
    ).toEqual({ saveOnly: null, recreateCompetitionPlan: false, recreateBasicPlan: true });
    // Nur der Name: Plan-Bezug mitschicken.
    const renamed = { ...base, competition: { ...base.competition, name: 'Neu' } };
    expect(
      competitionSaveOptions({
        stored,
        draft: renamed,
        competitionPlanActive: true,
        feasibilityUsable: true,
      }).saveOnly,
    ).toBe('resave');
    // Ohne Wettkampfplan: Countdown speichern ist erlaubt.
    expect(
      competitionSaveOptions({
        stored,
        draft: earlier,
        competitionPlanActive: false,
        feasibilityUsable: false,
      }).saveOnly,
    ).toBe('countdown');
  });
});

describe('M4: plan-relevante Angaben', () => {
  it('Wunsch-Tag des langen Laufs und eigener Startumfang zählen; nur der Name nicht', async () => {
    const { rows } = await withCompetitionPlan(runner(), draft('2027-01-31'));
    const stored = plannedCompetition(rows)?.stored;
    if (!stored) throw new Error('kein Wettkampf');
    const base = draftFromStored(stored);
    expect(
      planBasisChanged(stored, { ...base, competition: { ...base.competition, name: 'X' } }),
    ).toBe(false);
    expect(planBasisChanged(stored, { ...base, longRunWeekday: 7 })).toBe(true);
    expect(
      planBasisChanged(stored, { ...base, ownStart: { weeklyMinutes: 150, confirmed: true } }),
    ).toBe(true);
    // Gespeicherter Startumfang bleibt Teil des Vergleichs – auch wenn das Feld beim aktuellen Level fehlt.
    const withOwn = { ...stored, ownStart: { weeklyMinutes: 150, confirmed: true as const } };
    expect(planBasisChanged(withOwn, draftFromStored(withOwn))).toBe(false);
    expect(planBasisChanged(withOwn, { ...draftFromStored(withOwn), ownStart: null })).toBe(true);
  });
});

/** Zwei Ausdauer-Einheiten derselben Woche zu Tempo-Einheiten machen (harte Art, Anstrengung 7). */
function twoHardInOneWeek(rows: UserRows): { rows: UserRows; first: string; second: string } {
  const active = activePlan(rows);
  if (!active) throw new Error('kein Plan');
  const byWeek = new Map<string, string[]>();
  for (const s of active.sessions) {
    if (s.kind !== 'endurance' || s.estimated_minutes < 25) continue;
    const key = `${s.block_no}:${s.week_no}`;
    byWeek.set(key, [...(byWeek.get(key) ?? []), s.id]);
  }
  const pair = [...byWeek.values()].find((ids) => ids.length >= 2);
  if (!pair) throw new Error('keine Woche mit zwei Einheiten');
  const [first, second] = pair as [string, string];
  const plannedSessions = rows.plannedSessions.map((s) => {
    if (s.id !== first && s.id !== second) return s;
    const minutes = s.estimated_minutes;
    return {
      ...s,
      workout_type: 'tempo' as const,
      name_de: 'Tempodauerlauf',
      effort_target: 7,
      workout_steps: [
        { part: 'warmup', kind: 'easy', seconds: 600, effort: 3 },
        { part: 'main', kind: 'work', seconds: (minutes - 15) * 60, effort: 7 },
        { part: 'cooldown', kind: 'easy', seconds: 300, effort: 3 },
      ],
    };
  });
  return { rows: { ...rows, plannedSessions }, first, second };
}

describe('M3/M2: Wochenzahl harter Einheiten im App-Pfad und in Kalender/Wochenübersicht', () => {
  it('Profil jetzt Einsteiger: die zweite harte Einheit wird locker – Anzeige, Timer-Schritte und Name', async () => {
    const created = await withCompetitionPlan(runner(), draft('2027-01-31'));
    const { rows: hard, first, second } = twoHardInOneWeek(created.rows);
    const beginner: UserRows = {
      ...hard,
      profile: hard.profile && { ...hard.profile, experience_level: 'beginner' },
    };
    const active = activePlan(beginner);
    const rules = effectiveSafetyRules(beginner, VERSIONS, TODAY);
    if (!active || !rules) throw new Error('fehlt');
    const show = (id: string) =>
      sessionDisplay({
        rows: beginner,
        active,
        library: null,
        rules,
        session: active.sessions.find((s) => s.id === id) ?? active.sessions[0]!,
        today: TODAY,
        daySwaps: null,
        ownerUserId: null,
      }).shown.session;
    expect(show(first).workout_type).toBe('tempo');
    const later = show(second);
    expect(later.workout_type).toBe('easy');
    expect((later.workout_steps ?? []).every((st) => st.effort <= 4)).toBe(true);
    // Kalender/Wochenübersicht: angezeigter Name statt „Tempodauerlauf“.
    const names = displayedSessionNames(beginner, active, rules);
    expect(names.has(first)).toBe(false);
    expect(names.get(second)).toBeDefined();
    expect(names.get(second)).not.toBe('Tempodauerlauf');
    // Fortgeschritten: beide bleiben hart.
    const advRules = effectiveSafetyRules(hard, VERSIONS, TODAY);
    const advActive = activePlan(hard);
    if (!advRules || !advActive) throw new Error('fehlt');
    expect(displayedSessionNames(hard, advActive, advRules).has(second)).toBe(false);
  });
});

describe('M6: Ergebnis ohne zweiten Tagebuch-Eintrag', () => {
  const log = (id: string, notes: string | null, performed_on = '2027-01-31', is_free = true) =>
    ({
      id,
      kind: 'endurance',
      is_free,
      performed_on,
      notes,
      created_at: `${performed_on}T12:00:00Z`,
    }) as UserRows['sessionLogs'][number];
  it('gemerkte ID bzw. eigener Ergebnis-Eintrag vom Renntag wird wiederverwendet', () => {
    const rows = { sessionLogs: [log('a', 'Ergebnis: 1:58:20 · gut'), log('b', 'Lockerer Lauf')] };
    expect(resultLogToReuse(rows, '2027-01-31', null, 'Ergebnis: ')).toBe('a');
    expect(resultLogToReuse(rows, '2027-01-31', 'b', 'Ergebnis: ')).toBe('b');
    expect(resultLogToReuse(rows, '2027-02-01', null, 'Ergebnis: ')).toBeNull();
    expect(
      resultLogToReuse(
        { sessionLogs: [log('c', 'Lockerer Lauf')] },
        '2027-01-31',
        null,
        'Ergebnis: ',
      ),
    ).toBeNull();
    expect(
      resultLogToReuse(
        { sessionLogs: [log('d', 'Ergebnis: 1:00:00', '2027-01-31', false)] },
        '2027-01-31',
        null,
        'Ergebnis: ',
      ),
    ).toBeNull();
  });
});

describe('M7: Folgeblock nach strengerem Level → Ampel neu prüfen', () => {
  it('Halbmarathon in 12 Wochen als Fortgeschritten, dann Einsteiger → „nicht mehr erreichbar“', async () => {
    const { rows, library } = await withCompetitionPlan(runner(), draft('2026-12-27'));
    const beginner: UserRows = {
      ...rows,
      profile: rows.profile && { ...rows.profile, experience_level: 'beginner' },
    };
    const active = activePlan(beginner);
    const rules = effectiveSafetyRules(beginner, VERSIONS, TODAY);
    if (!active || !rules) throw new Error('fehlt');
    const last = [...active.sessions].sort((a, b) =>
      b.scheduled_on.localeCompare(a.scheduled_on),
    )[0];
    const day = last?.scheduled_on ?? TODAY;
    expect(competitionFollowUpFromRows(beginner, VERSIONS, active, rules, library, day)).toEqual({
      kind: 'ended',
      reason: 'unreachable',
    });
    // Gleiches Level: Folgeblock wie bisher.
    const sameRules = effectiveSafetyRules(rows, VERSIONS, TODAY);
    if (!sameRules) throw new Error('fehlt');
    expect(
      competitionFollowUpFromRows(rows, VERSIONS, activePlan(rows)!, sameRules, library, day).kind,
    ).toBe('block');
  });
});

describe('N8: Zielzeit nur anbieten, wenn erlaubt', () => {
  it('Fortgeschritten ohne Flag ja; Einsteiger, Flag oder ohne Check nein', () => {
    const adv = runner();
    expect(timeGoalOffered(adv, effectiveSafetyRules(adv, VERSIONS, TODAY))).toBe(true);
    const beginner = planPersonRows({ goal: 'endurance' });
    expect(timeGoalOffered(beginner, effectiveSafetyRules(beginner, VERSIONS, TODAY))).toBe(false);
    const flag = planPersonRows({ level: 'advanced', goal: 'endurance', flags: ['injury'] });
    expect(timeGoalOffered(flag, effectiveSafetyRules(flag, VERSIONS, TODAY))).toBe(false);
    expect(timeGoalOffered(adv, null)).toBe(false);
  });
});
