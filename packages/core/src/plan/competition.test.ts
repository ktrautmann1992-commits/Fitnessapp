import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import {
  type CompetitionFeasibility,
  competitionFeasibility,
  competitionFollowUpBlock,
  competitionStartReference,
  competitionStartReferenceSchema,
  type CompetitionRequest,
  competitionVolumePreview,
  earliestRaceDate,
  leadLevel,
  minimumLeadWeeks,
  ownStartMinutes,
  requiredPeak,
} from './competition';
import { COMPETITION_DISCIPLINES, type CompetitionDiscipline } from './competition-schema';
import type { PlanInputsInput } from './inputs';
import type { PreviousSession } from './schedule';
import { MONDAY, person } from './test-library';

// Feste Tabellen (Plan 3.2, W-G3/W-G5) – bewusst nicht aus constants.ts.
const LEAD = {
  '5k': { beginner: 8, advanced: 6, competitive: 4 },
  '10k': { beginner: 10, advanced: 8, competitive: 6 },
  half_marathon: { beginner: 16, advanced: 12, competitive: 10 },
  marathon: { beginner: 24, advanced: 16, competitive: 14 },
} as const;
const START = { beginner: 60, advanced: 120, competitive: 150, cautious: 45 } as const;

type Level = 'beginner' | 'advanced' | 'competitive';
type Flag = 'pregnancy' | 'injury' | 'medication' | 'conservative_plan';

const runs = (n: number, minutes = 90) => ({
  mode: 'fixed' as const,
  slots: [2, 4, 6, 7, 3, 5, 1]
    .slice(0, n)
    .map((weekday) => ({ weekday, kind: 'endurance' as const, minutes })),
});

function runner(
  discipline: CompetitionDiscipline,
  overrides: Partial<PlanInputsInput> & { level?: Level; flags?: Flag[] | null } = {},
): PlanInputsInput {
  const { level, flags, ...rest } = overrides;
  return person({
    goalType: 'endurance',
    discipline,
    experienceLevel: level ?? 'beginner',
    schedule: runs(4),
    healthScreening: flags === null ? null : { flags: flags ?? [] },
    ...rest,
  });
}

function feasibility(
  inputs: PlanInputsInput,
  competition: Partial<CompetitionRequest['competition']> & { raceDate: string },
  today = MONDAY,
  extra: Omit<CompetitionRequest, 'competition'> = {},
): CompetitionFeasibility {
  const discipline = (competition.discipline ?? inputs.discipline) as CompetitionDiscipline;
  const result = competitionFeasibility(
    inputs,
    { competition: { name: 'Lauf', discipline, ...competition }, ...extra },
    today,
  );
  if (!result.ok) throw new Error(result.error);
  return result.feasibility;
}

const weeks = (n: number, today = MONDAY) => addDays(today, n * 7);
const reference = { discipline: '10k', timeS: 50 * 60, date: addDays(MONDAY, -30) } as const;

describe('Tabellen', () => {
  it('minimumLeadWeeks = Tabelle 3.2; Vorsichtige wie Einsteiger', () => {
    for (const d of COMPETITION_DISCIPLINES) {
      for (const level of ['beginner', 'advanced', 'competitive'] as const) {
        expect(minimumLeadWeeks(d, level)).toBe(LEAD[d][level]);
        expect(earliestRaceDate(MONDAY, d, level)).toBe(weeks(LEAD[d][level]));
      }
    }
    expect(leadLevel('competitive', 'cautious')).toBe('beginner');
    expect(leadLevel('advanced', 'advanced')).toBe('advanced');
  });

  it('requiredPeak: Halbmarathon ca. 150 und Marathon ca. 240 min/Woche (Plan 3.2), Zielzeit höher', () => {
    expect(requiredPeak('half_marathon').weeklyMinutes).toBeGreaterThanOrEqual(135);
    expect(requiredPeak('half_marathon').weeklyMinutes).toBeLessThanOrEqual(150);
    expect(requiredPeak('marathon').weeklyMinutes).toBe(240);
    expect(requiredPeak('marathon').longRunMinutes).toBeGreaterThanOrEqual(150);
    expect(requiredPeak('half_marathon').longRunMinutes).toBeLessThanOrEqual(120);
    for (const d of COMPETITION_DISCIPLINES) {
      expect(requiredPeak(d, 'time').weeklyMinutes).toBeGreaterThan(requiredPeak(d).weeklyMinutes);
    }
    // Aufsteigend mit der Distanz.
    const finish = COMPETITION_DISCIPLINES.map((d) => requiredPeak(d).weeklyMinutes);
    expect([...finish].sort((a, b) => a - b)).toEqual(finish);
  });

  it('Tabelle passt zur Kette: Einsteiger erreichen „Ankommen“ genau zum Mindestvorlauf (jeder Wochentag)', () => {
    for (const d of COMPETITION_DISCIPLINES) {
      for (let start = 0; start < 7; start += 1) {
        for (let race = 0; race < 7; race += 1) {
          const today = addDays(MONDAY, start);
          const f = feasibility(
            runner(d),
            { raceDate: addDays(weeks(LEAD[d].beginner, today), race) },
            today,
          );
          expect(['ok', 'tight'], `${d} ${today} +${race}`).toContain(f.status);
        }
      }
    }
  }, 60_000);
});

describe('ownStartMinutes (W-G5)', () => {
  it('nur Fortgeschritten/Leistungssport, gedeckelt auf das Doppelte, Tagebuch hat Vorrang', () => {
    const own = { weeklyMinutes: 300 };
    expect(ownStartMinutes(own, 'beginner', 'beginner', false)).toEqual({
      minutes: null,
      notice: 'own_start_ignored',
    });
    expect(ownStartMinutes(own, 'advanced', 'cautious', false)).toEqual({
      minutes: null,
      notice: 'own_start_ignored',
    });
    expect(ownStartMinutes(own, 'advanced', 'advanced', false)).toEqual({
      minutes: 2 * START.advanced,
      notice: 'own_start_capped',
    });
    expect(ownStartMinutes({ weeklyMinutes: 240 }, 'advanced', 'advanced', false)).toEqual({
      minutes: 240,
      notice: null,
    });
    expect(ownStartMinutes(own, 'competitive', 'competitive', false)).toEqual({
      minutes: 2 * START.competitive,
      notice: null,
    });
    expect(ownStartMinutes(own, 'competitive', 'competitive', true)).toEqual({
      minutes: null,
      notice: 'own_start_journal_used',
    });
    expect(ownStartMinutes(null, 'advanced', 'advanced', false)).toEqual({
      minutes: null,
      notice: null,
    });
  });
});

describe('competitionFeasibility – Mindestvorlauf und Datum', () => {
  it('genau am Mindestvorlauf: Plan; 1 Tag darunter: zu kurz mit frühestem Datum und Vorschlägen', () => {
    const at = feasibility(runner('half_marathon'), { raceDate: weeks(16) });
    expect(['ok', 'tight']).toContain(at.status);
    expect(at.leadWeeks).toBe(16);
    const below = feasibility(runner('half_marathon'), { raceDate: addDays(weeks(16), -1) });
    expect(below.status).toBe('too_short');
    expect(below.reasons).toContain('lead_time_below_minimum');
    expect(below.leadWeeks).toBe(15);
    expect(below.earliestRaceDate).toBe(weeks(16));
    expect(below.suggestions).toContainEqual({ kind: 'shorter_distance', discipline: '10k' });
    expect(below.suggestions).toContainEqual({ kind: 'later_date', raceDate: weeks(16) });
    expect(below.suggestions.at(-1)).toEqual({ kind: 'without_competition' });
    expect(below.plannedPeakMinutes).toBe(0);
  });

  it('52 Wochen: Plan (lange Basis, Umfang bleibt beim Spitzenumfang); 52 Wochen + 1 Tag ungültig', () => {
    const far = feasibility(runner('half_marathon'), { raceDate: weeks(52) });
    expect(far.status).toBe('ok');
    expect(far.plannedPeakMinutes).toBe(requiredPeak('half_marathon').weeklyMinutes);
    const preview = competitionVolumePreview(
      runner('half_marathon'),
      { competition: { name: 'Lauf', discipline: 'half_marathon', raceDate: weeks(52) } },
      MONDAY,
    );
    expect(Math.max(...(preview ?? []).map((w) => w.minutes))).toBe(
      requiredPeak('half_marathon').weeklyMinutes,
    );
    const result = competitionFeasibility(
      runner('half_marathon'),
      {
        competition: { name: 'Lauf', discipline: 'half_marathon', raceDate: addDays(weeks(52), 1) },
      },
      MONDAY,
    );
    expect(result).toEqual({ ok: false, error: 'invalid_inputs' });
  });

  it('Renntag Sonntag und Montag (Wochengrenze): Ampel rechnet mit dem Tapering der jeweiligen Woche', () => {
    const sunday = feasibility(runner('half_marathon'), { raceDate: addDays(weeks(16), 6) });
    const monday = feasibility(runner('half_marathon'), { raceDate: addDays(weeks(17), 0) });
    expect(sunday.status).toBe('ok');
    expect(['ok', 'tight']).toContain(monday.status);
    expect(sunday.leadWeeks).toBe(16);
    expect(monday.leadWeeks).toBe(17);
  });

  it('Planstart mitten in der Woche: Woche 0 zählt nicht als Belastungswoche', () => {
    const thursday = addDays(MONDAY, 3);
    const f = feasibility(runner('5k'), { raceDate: weeks(8, thursday) }, thursday);
    expect(['ok', 'tight']).toContain(f.status);
    const preview = competitionVolumePreview(
      runner('5k'),
      { competition: { name: 'Lauf', discipline: '5k', raceDate: weeks(8, thursday) } },
      thursday,
    );
    expect(preview?.[0]).toMatchObject({ index: 0, load: false });
    expect(preview?.[1]).toMatchObject({ load: true, minutes: START.beginner });
  });

  it('Einsteiger Marathon: 23 Wochen zu kurz, 24 und 25 Wochen Plan mit Hinweis', () => {
    const at = (n: number, extraDays = 0) =>
      feasibility(runner('marathon'), { raceDate: addDays(weeks(n), extraDays) });
    expect(at(23, 6).status).toBe('too_short');
    expect(at(23, 6).reasons).toContain('lead_time_below_minimum');
    expect(['ok', 'tight']).toContain(at(24).status);
    expect(at(25).status).toBe('ok');
    expect(at(24).notices).toContain('beginner_marathon');
    expect(at(24).plannedPeakMinutes).toBe(240);
    expect(at(23, 6).suggestions).toContainEqual({
      kind: 'shorter_distance',
      discipline: 'half_marathon',
    });
    expect(
      feasibility(runner('marathon', { level: 'advanced' }), { raceDate: weeks(24) }).notices,
    ).not.toContain('beginner_marathon');
  });
});

describe('competitionFeasibility – Personengruppen (Tabelle 3.3, W-G4)', () => {
  it('Schwangerschaft: kein Wettkampfplan, nur „ohne Wettkampf weiter“', () => {
    const f = feasibility(runner('10k', { flags: ['pregnancy'] }), { raceDate: weeks(30) });
    expect(f.status).toBe('not_available');
    expect(f.reasons).toEqual(['pregnancy']);
    expect(f.suggestions).toEqual([{ kind: 'without_competition' }]);
  });

  it('ohne Gesundheits-Check: erst nach dem Check', () => {
    const f = feasibility(runner('10k', { flags: null }), { raceDate: weeks(30) });
    expect(f.status).toBe('not_available');
    expect(f.reasons).toEqual(['health_check_required']);
    expect(f.suggestions).toEqual([{ kind: 'health_check' }, { kind: 'without_competition' }]);
  });

  it('unter 18: höchstens Halbmarathon, keine Zielzeit; 16 Jahre (sehr jung) über die vorsichtige Startgruppe', () => {
    const minor = { birthDate: '2010-01-01', level: 'competitive' as const };
    const marathon = feasibility(runner('marathon', minor), { raceDate: weeks(40) });
    expect(marathon.status).toBe('not_available');
    expect(marathon.reasons).toEqual(['minor_distance_limit']);
    expect(marathon.suggestions).toContainEqual({
      kind: 'shorter_distance',
      discipline: 'half_marathon',
    });
    const half = feasibility(runner('half_marathon', minor), { raceDate: weeks(40) });
    expect(half.status).toBe('ok');
    expect(half.notices).toContain('minor_no_target_time');
    // Vorsichtig: Mindestvorlauf aus der Einsteiger-Spalte, Start 45 min.
    expect(half.minimumLeadWeeks).toBe(LEAD.half_marathon.beginner);
    expect(half.startMinutes).toBe(START.cautious);
    const time = feasibility(runner('half_marathon', minor), {
      raceDate: weeks(40),
      goal: 'time',
      targetTimeS: 2 * 3600,
      reference,
    });
    expect(time.effectiveGoal).toBe('finish');
    expect(time.reasons).toContain('goal_time_not_allowed');
    expect(time.status).toBe('tight');
  });

  it('Gesundheits-Flag und ab 65 (sehr alt: 90): nur „Ankommen“, Hinweis ärztliche Abklärung', () => {
    for (const overrides of [
      { flags: ['injury'] as Flag[], level: 'competitive' as const },
      { birthDate: '1960-01-01', level: 'competitive' as const },
      { birthDate: '1936-06-01', level: 'advanced' as const },
    ]) {
      const f = feasibility(runner('10k', overrides), {
        raceDate: weeks(40),
        goal: 'time',
        targetTimeS: 50 * 60,
        reference,
      });
      expect(f.effectiveGoal).toBe('finish');
      expect(f.reasons).toContain('goal_time_not_allowed');
      expect(f.notices).toContain('medical_clearance');
      expect(f.startMinutes).toBe(START.cautious);
      expect(f.minimumLeadWeeks).toBe(LEAD['10k'].beginner);
    }
  });

  it('vorsichtige Gruppe: Halbmarathon genau zum Einsteiger-Vorlauf zu kurz (Start 45 min), später möglich', () => {
    const cautious = runner('half_marathon', {
      flags: ['injury'],
      level: 'advanced',
      schedule: runs(3),
    });
    const f = feasibility(cautious, { raceDate: weeks(16) });
    expect(f.status).toBe('too_short');
    expect(f.reasons).toContain('peak_not_reachable');
    const later = f.suggestions.find((s) => s.kind === 'later_date');
    expect(later).toBeDefined();
    if (later?.kind !== 'later_date') return;
    expect(['ok', 'tight']).toContain(feasibility(cautious, { raceDate: later.raceDate }).status);
    expect(feasibility(cautious, { raceDate: addDays(later.raceDate, -1) }).status).toBe(
      'too_short',
    );
  });

  it('Einsteiger: keine Zielzeit; Fortgeschritten mit Referenz: Zielzeit, wenn erreichbar', () => {
    const beginner = feasibility(runner('10k'), {
      raceDate: weeks(30),
      goal: 'time',
      targetTimeS: 60 * 60,
      reference,
    });
    expect(beginner.reasons).toContain('goal_time_not_allowed');
    expect(beginner.effectiveGoal).toBe('finish');
    const advanced = runner('10k', { level: 'advanced', schedule: runs(4, 60) });
    const time = feasibility(advanced, {
      raceDate: weeks(20),
      goal: 'time',
      targetTimeS: 45 * 60,
      reference,
    });
    expect(time).toMatchObject({ status: 'ok', effectiveGoal: 'time', requiredWeeklyMinutes: 180 });
    // Zielzeit-Umfang in 8 Wochen nicht zweimal erreichbar → knapp, Ziel „Ankommen“.
    const short = feasibility(advanced, {
      raceDate: weeks(8),
      goal: 'time',
      targetTimeS: 45 * 60,
      reference,
    });
    expect(short.effectiveGoal).toBe('finish');
    expect(short.reasons).toContain('goal_time_not_reachable');
    expect(short.status).toBe('tight');
    expect(short.suggestions.some((s) => s.kind === 'later_date')).toBe(true);
  });
});

describe('competitionFeasibility – Zeitbudget und Startumfang', () => {
  it('1 Ausdauer-Tag (60 min): zu wenig Zeit für den Halbmarathon → zu kurz, mehr Trainingszeit', () => {
    const f = feasibility(runner('half_marathon', { schedule: runs(1, 60) }), {
      raceDate: weeks(30),
    });
    expect(f.status).toBe('too_short');
    expect(f.reasons).toEqual(['peak_not_reachable', 'weekly_time_too_low']);
    expect(f.suggestions).toContainEqual({
      kind: 'more_training_time',
      weeklyMinutes: requiredPeak('half_marathon').weeklyMinutes,
    });
    expect(f.suggestions.some((s) => s.kind === 'later_date')).toBe(false);
  });

  it('7 Ausdauer-Tage: auf die Höchstzahl der Startgruppe gedeckelt (Einsteiger 4), Plan möglich', () => {
    const f = feasibility(runner('half_marathon', { schedule: runs(7, 40) }), {
      raceDate: weeks(20),
    });
    expect(f.status).toBe('ok');
    expect(f.plannedPeakMinutes).toBe(requiredPeak('half_marathon').weeklyMinutes);
  });

  it('1 Tag mit viel Zeit: Einsteiger-Deckel je Einheit (30 min, +10 %) bremst die Kette', () => {
    const f = feasibility(runner('5k', { schedule: runs(1, 120) }), { raceDate: weeks(8) });
    expect(f.status).toBe('too_short');
    expect(f.reasons).toEqual(['peak_not_reachable']);
  });

  it('eigener Startumfang (W-G5): Leistungssport 300 → Kette startet bei 300; gedeckelt mit Hinweis', () => {
    const competitive = runner('marathon', { level: 'competitive', schedule: runs(5, 90) });
    const own = feasibility(competitive, { raceDate: weeks(14) }, MONDAY, {
      ownStart: { weeklyMinutes: 400, confirmed: true },
    });
    expect(own.startMinutes).toBe(2 * START.competitive);
    expect(own.notices).toContain('own_start_capped');
    expect(own.plannedPeakMinutes).toBe(2 * START.competitive);
    const preview = competitionVolumePreview(
      competitive,
      {
        competition: { name: 'Lauf', discipline: 'marathon', raceDate: weeks(14) },
        ownStart: { weeklyMinutes: 400, confirmed: true },
      },
      MONDAY,
    );
    expect(preview?.[0]?.minutes).toBe(2 * START.competitive);
    const ignored = feasibility(runner('marathon'), { raceDate: weeks(30) }, MONDAY, {
      ownStart: { weeklyMinutes: 200, confirmed: true },
    });
    expect(ignored.startMinutes).toBe(START.beginner);
    expect(ignored.notices).toContain('own_start_ignored');
    // Ohne Bestätigung ungültig.
    expect(
      competitionFeasibility(
        competitive,
        {
          competition: { name: 'Lauf', discipline: 'marathon', raceDate: weeks(14) },
          ownStart: { weeklyMinutes: 200, confirmed: false as unknown as true },
        },
        MONDAY,
      ).ok,
    ).toBe(false);
  });

  it('Bezug aus dem Tagebuch: Kette steigt ab floor(1,1 × Bezug)', () => {
    const f = feasibility(
      runner('half_marathon', { level: 'advanced' }),
      { raceDate: weeks(12) },
      MONDAY,
      {
        startReference: { volume: 100, sessionCap: 40, startGroup: 'advanced' },
        ownStart: { weeklyMinutes: 200, confirmed: true },
      },
    );
    expect(f.startMinutes).toBeNull();
    expect(f.notices).toContain('own_start_journal_used');
    const preview = competitionVolumePreview(
      runner('half_marathon', { level: 'advanced' }),
      {
        competition: { name: 'Lauf', discipline: 'half_marathon', raceDate: weeks(12) },
        startReference: { volume: 100, sessionCap: 40, startGroup: 'advanced' },
      },
      MONDAY,
    );
    expect(preview?.[0]?.minutes).toBe(110);
  });
});

describe('competitionFeasibility – ungültige Eingaben', () => {
  it.each([
    ['Ziel nicht Ausdauer', { goalType: 'muscle_gain' as const, discipline: null }],
    ['Disziplin passt nicht zum Ziel', { discipline: '10k' as const }],
    ['unter 16', { birthDate: '2011-01-01' }],
    ['Rad (erst WP5)', { discipline: 'cycling' as const }],
  ])('%s', (_, overrides) => {
    const result = competitionFeasibility(
      { ...runner('half_marathon'), ...overrides },
      { competition: { name: 'Lauf', discipline: 'half_marathon', raceDate: weeks(20) } },
      MONDAY,
    );
    expect(result).toEqual({ ok: false, error: 'invalid_inputs' });
  });

  it('ungültiges Datum', () => {
    expect(
      competitionFeasibility(
        runner('5k'),
        { competition: { name: 'Lauf', discipline: '5k', raceDate: weeks(20) } },
        '2026-13-01',
      ).ok,
    ).toBe(false);
  });
});

describe('competitionFollowUpBlock – Ränder', () => {
  const req = {
    competition: { name: 'Lauf', discipline: 'half_marathon' as const, raceDate: weeks(20) },
  };
  const week1 = [0, 1, 3].map((d) => ({
    scheduled_on: addDays(MONDAY, d),
    week_no: 1,
    is_deload: false,
  }));
  const options = {
    planStart: MONDAY,
    today: MONDAY,
    previous: week1,
    effectiveGoal: 'finish' as const,
  };
  it('ungültig: heute vor dem Planstart, kaputtes Datum, keine Einheiten', () => {
    expect(
      competitionFollowUpBlock(runner('half_marathon'), req, {
        ...options,
        today: addDays(MONDAY, -1),
      }),
    ).toEqual({ ok: false, reason: 'invalid_inputs' });
    expect(
      competitionFollowUpBlock(runner('half_marathon'), req, {
        ...options,
        previous: [{ scheduled_on: '2026-02-31', week_no: 1, is_deload: false }],
      }),
    ).toEqual({ ok: false, reason: 'invalid_inputs' });
    expect(
      competitionFollowUpBlock(runner('half_marathon'), req, { ...options, previous: [] }),
    ).toEqual({
      ok: false,
      reason: 'invalid_inputs',
    });
  });
  it('nach dem Rennen (Renntag vorbei) bzw. nach der Erholung: Zyklus zu Ende', () => {
    expect(
      competitionFollowUpBlock(runner('half_marathon'), req, {
        ...options,
        today: weeks(21),
        previous: [{ scheduled_on: weeks(21), week_no: 1, is_deload: true }],
      }),
    ).toEqual({ ok: false, reason: 'cycle_finished' });
  });
  it('Folgeblock: beginnt am Montag nach der letzten Einheit, keine Woche 0/Einstiegswoche, ohne eigenen Start', () => {
    const result = competitionFollowUpBlock(runner('half_marathon'), req, options);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.block.specs[0]?.monday).toBe(weeks(1));
    expect(result.block.specs.every((s) => s.weekNo >= 1 && s.kind !== 'intro')).toBe(true);
    expect(result.block.weeks.map((w) => w.phase)).toContain('base');
    // Einsteiger, Basis 5 : 1 – eine Belastungswoche davor → 4 weitere, dann Erholung.
    expect(result.block.specs.map((s) => s.kind[0]).join('')).toBe('lllld');
    expect(result.block.startMinutes).toBeUndefined();
    expect(result.block.reference).toBeNull();
  });
  it('Folgeblock mit eigenem Startumfang und Tagebuch-Bezug: beides nur im ersten Block (Wächter M2)', () => {
    const result = competitionFollowUpBlock(
      runner('half_marathon', { level: 'advanced' }),
      {
        ...req,
        ownStart: { weeklyMinutes: 200, confirmed: true },
      },
      options,
    );
    expect(result.ok && result.block.startMinutes).toBeUndefined();
    const withRef = competitionFollowUpBlock(
      runner('half_marathon', { level: 'advanced' }),
      { ...req, startReference: { volume: 100, sessionCap: 40, startGroup: 'competitive' } },
      options,
    );
    expect(withRef.ok && withRef.block.reference).toBeNull();
    expect(withRef.ok && withRef.block.stricterGroup).toBe(false);
  });
});

describe('Tagebuch-Bezug: strengere Gruppe und Grenzen (Wächter H1/H2)', () => {
  const at = (
    inputs: PlanInputsInput,
    startReference: CompetitionRequest['startReference'],
    n = 30,
  ) =>
    competitionVolumePreview(
      inputs,
      {
        competition: {
          name: 'Lauf',
          discipline: inputs.discipline as CompetitionDiscipline,
          raceDate: weeks(n),
        },
        startReference,
      },
      MONDAY,
    ) ?? [];

  it('70 Jahre mit Bezug aus einem Plan vor dem 65. Geburtstag: Start wieder bei 45 min (≤ floor(1,1 × 45))', () => {
    const senior = runner('half_marathon', { birthDate: '1956-01-01', level: 'advanced' });
    const preview = at(senior, { volume: 200, sessionCap: 90, startGroup: 'advanced' });
    expect(preview[0]?.minutes).toBeLessThanOrEqual(Math.floor(START.cautious * 1.1));
    // Gleiche (vorsichtige) Gruppe beim Bezug → kein Neustart, aber Deckel 2 × 45.
    const same = at(senior, { volume: 200, sessionCap: 90, startGroup: 'cautious' });
    expect(same[0]?.minutes).toBe(Math.floor(2 * START.cautious * 1.1));
  });

  it('Einsteiger mit Bezug aus einem Leistungssport-Plan: Neustart beim Einsteiger-Start', () => {
    const preview = at(runner('marathon'), {
      volume: 300,
      sessionCap: 120,
      startGroup: 'competitive',
    });
    expect(preview[0]?.minutes).toBeLessThanOrEqual(Math.floor(START.beginner * 1.1));
  });

  it('Bezug über 2 × Startumfang der Gruppe wird gedeckelt (Hinweis), auch ohne Gruppenwechsel', () => {
    const f = feasibility(runner('marathon'), { raceDate: weeks(30) }, MONDAY, {
      startReference: { volume: 1000, sessionCap: 200, startGroup: 'beginner' },
    });
    expect(f.notices).toContain('start_reference_capped');
    const preview = at(runner('marathon'), {
      volume: 1000,
      sessionCap: 200,
      startGroup: 'beginner',
    });
    expect(preview[0]?.minutes).toBeLessThanOrEqual(Math.floor(2 * START.beginner * 1.1));
  });

  it.each([
    ['Wochenumfang 5 (unter 10)', { volume: 5, sessionCap: null, startGroup: 'beginner' }],
    ['Wochenumfang 100000', { volume: 100000, sessionCap: 100000, startGroup: 'beginner' }],
    ['Wochenumfang 1681', { volume: 1681, sessionCap: 240, startGroup: 'beginner' }],
    ['Einheit länger als die Woche', { volume: 50, sessionCap: 60, startGroup: 'beginner' }],
    ['Einheit 241 min', { volume: 600, sessionCap: 241, startGroup: 'beginner' }],
    ['ohne Startgruppe', { volume: 100, sessionCap: 40 }],
    ['Bruchteil', { volume: 100.5, sessionCap: 40, startGroup: 'beginner' }],
  ])('ungültig: %s', (_, startReference) => {
    expect(
      competitionFeasibility(
        runner('marathon'),
        {
          competition: { name: 'Lauf', discipline: 'marathon', raceDate: weeks(30) },
          startReference: startReference as never,
        },
        MONDAY,
      ),
    ).toEqual({ ok: false, error: 'invalid_inputs' });
  });

  it('gültige Ränder: 0 (ohne Bezug), 10, 1680 mit 240', () => {
    for (const startReference of [
      { volume: 0, sessionCap: null, startGroup: 'beginner' as const },
      { volume: 10, sessionCap: 10, startGroup: 'beginner' as const },
      { volume: 1680, sessionCap: 240, startGroup: 'beginner' as const },
    ]) {
      expect(competitionStartReferenceSchema.safeParse(startReference).success).toBe(true);
    }
  });

  it('competitionStartReference: aus gespeicherten Einheiten, Tagebuch nur min(geplant, eingetragen)', () => {
    const session = (id: string, minutes: number, extra: Partial<PreviousSession> = {}) =>
      ({
        id,
        block_no: 1,
        week_no: 3,
        is_intro_week: false,
        is_deload: false,
        kind: 'endurance',
        template_day_index: null,
        scheduled_on: '2026-10-20',
        name_de: 'Lauf',
        focus: null,
        endurance_modality: 'run',
        effort_target: 4,
        estimated_minutes: minutes,
        warmup_de: '',
        cooldown_de: '',
        exercises: [],
        ...extra,
      }) as PreviousSession;
    const previous = [session('a', 40), session('b', 50, { scheduled_on: '2026-10-22' })];
    expect(competitionStartReference(previous, 'advanced')).toEqual({
      volume: 90,
      sessionCap: 50,
      startGroup: 'advanced',
    });
    expect(competitionStartReference(previous, 'beginner', new Map([['a', 60]]))).toEqual({
      volume: 40,
      sessionCap: 40,
      startGroup: 'beginner',
    });
    expect(competitionStartReference(previous, 'beginner', new Map())).toBeNull();
  });
});
