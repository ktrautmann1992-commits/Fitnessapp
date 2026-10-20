import { describe, expect, it } from 'vitest';

import {
  COMPETITION_PHASE_TREND,
  type CompetitionOutlineSession,
  competitionPlanOutline,
} from './competition-outline';
import { competitionPlanWeek } from './competition-view';
import type { MacroCycleInputs } from './periodization';

/**
 * „So ist dein Plan aufgebaut“ (Gründer-Rückmeldung 20.10.2026): Phasen-Zeitleiste des Wettkampfplans. Erwartungen als
 * feste Werte (Kalender: 05.10.2026 = Montag). Grenzfälle: sehr kurzer Vorlauf, sehr langer Vorlauf (52 Wochen),
 * Wettkampf diese Woche, Renntag vorbei (Erholung bzw. ganz vorbei), vor dem Planstart, gespeicherte Erholungswochen.
 */

const half: MacroCycleInputs = {
  discipline: 'half_marathon',
  raceDate: '2027-01-31', // Sonntag
  experienceLevel: 'advanced',
  group: 'advanced',
  cautious: false,
};

const outline = (
  today: string,
  cycle: MacroCycleInputs = half,
  planStart = '2026-10-07', // Mittwoch → angebrochene Startwoche = Woche 0
  sessions: readonly CompetitionOutlineSession[] = [],
) => competitionPlanOutline({ cycle, planStart, today, sessions });

const summary = (o: ReturnType<typeof outline>) =>
  o?.phases.map((p) => [p.phase, p.firstWeekNo, p.lastWeekNo, p.from, p.to, p.recoveryWeeks]);

describe('competitionPlanOutline', () => {
  it('Halbmarathon, 17 Wochen: Phasen in Reihenfolge mit Wochen-Spanne, Datum und Erholungswochen', () => {
    const o = outline('2026-10-21');
    expect(summary(o)).toEqual([
      ['base', 0, 7, '2026-10-05', '2026-11-29', 1],
      ['build', 8, 11, '2026-11-30', '2026-12-27', 1],
      ['peak', 12, 14, '2026-12-28', '2027-01-17', 0],
      ['taper', 15, 15, '2027-01-18', '2027-01-24', 0],
      ['race_week', 16, 16, '2027-01-25', '2027-01-31', 0],
      ['recovery', null, null, '2027-02-01', '2027-02-07', 0],
    ]);
    expect(o).toMatchObject({ totalWeeks: 16, currentWeekNo: 2, status: 'running' });
    // Aktuelle Woche markiert (genau eine), in der Basis.
    const weeks = o?.phases.flatMap((p) => p.weeks) ?? [];
    expect(weeks.filter((w) => w.current).map((w) => w.weekNo)).toEqual([2]);
    expect(o?.phases.map((p) => p.current)).toEqual([true, false, false, false, false, false]);
    expect(weeks[0]).toMatchObject({ weekNo: 0, entryWeek: true, past: true, projected: true });
    // Erholungswochen (Vorschau aus dem Makrozyklus), Tapering/Rennwoche/Erholung mit Umfang in Prozent.
    expect(weeks.filter((w) => w.recoveryWeek).map((w) => w.weekNo)).toEqual([5, 10]);
    expect(weeks.map((w) => w.volumePercent).slice(-3)).toEqual([70, 40, 50]);
    expect(weeks.find((w) => w.raceWeek)?.weekNo).toBe(16);
    // Trend je Phase.
    expect(o?.phases.map((p) => p.trend)).toEqual([
      'rising',
      'rising',
      'holding',
      'falling',
      'easy',
      'easy',
    ]);
    // Kalender: ab heute − 14 Tage (Woche ab 05.10.) bis zur Rennwoche, nicht die Erholung danach.
    expect(weeks.filter((w) => !w.inCalendar).map((w) => w.monday)).toEqual(['2027-02-01']);
  });

  it('gleiche Wochenzählung wie competitionPlanWeek („Woche X von Y“)', () => {
    const sessions = [{ scheduled_on: '2026-10-21', training_phase: 'base' as const }];
    for (const today of ['2026-10-07', '2026-10-21', '2027-01-29', '2027-02-03']) {
      const week = competitionPlanWeek(sessions, '2026-10-07', '2027-01-31', today);
      const o = outline(today);
      const current = o?.phases.flatMap((p) => p.weeks).find((w) => w.current);
      expect(current?.weekNo ?? null).toBe(week?.weekNo ?? null);
      expect(o?.totalWeeks).toBe(week?.totalWeeks);
    }
    // Planstart an einem Montag: erste Woche = Woche 1.
    const monday = outline('2026-10-05', half, '2026-10-05');
    expect(monday?.phases[0]).toMatchObject({ firstWeekNo: 1 });
    expect(monday).toMatchObject({ totalWeeks: 17, currentWeekNo: 1 });
  });

  it('gespeicherte Einheiten haben Vorrang: Erholungswoche und geplante Minuten (ohne übersprungene)', () => {
    const sessions: CompetitionOutlineSession[] = [
      // Woche 1 (12.10.) gespeichert als Erholungswoche, obwohl die Vorschau eine Belastungswoche hätte.
      { scheduled_on: '2026-10-13', kind: 'endurance', estimated_minutes: 40, is_deload: true },
      { scheduled_on: '2026-10-17', kind: 'endurance', estimated_minutes: 60, is_deload: true },
      // Woche 2 (19.10.): eine übersprungene Einheit zählt nicht, Kraft zählt nicht zum Ausdauer-Umfang.
      { scheduled_on: '2026-10-20', kind: 'endurance', estimated_minutes: 45, is_deload: false },
      {
        scheduled_on: '2026-10-22',
        kind: 'endurance',
        status: 'skipped',
        estimated_minutes: 50,
        is_deload: false,
      },
      { scheduled_on: '2026-10-24', kind: 'strength', estimated_minutes: 60, is_deload: false },
    ];
    const weeks = outline('2026-10-14', half, '2026-10-07', sessions)?.phases.flatMap(
      (p) => p.weeks,
    );
    expect(weeks?.[1]).toMatchObject({
      weekNo: 1,
      recoveryWeek: true,
      projected: false,
      plannedMinutes: 100,
    });
    expect(weeks?.[2]).toMatchObject({ weekNo: 2, recoveryWeek: false, plannedMinutes: 45 });
    expect(weeks?.[3]).toMatchObject({ weekNo: 3, plannedMinutes: null, projected: true });
  });

  it('sehr kurzer Vorlauf (5 km, kleinster möglicher Zyklus): nur Spitze, Tapering, Rennwoche, Erholung', () => {
    const fiveK = { ...half, discipline: '5k' as const, raceDate: '2026-10-25' };
    const o = outline('2026-10-07', fiveK, '2026-10-05');
    expect(summary(o)).toEqual([
      ['peak', 1, 1, '2026-10-05', '2026-10-11', 0],
      ['taper', 2, 2, '2026-10-12', '2026-10-18', 0],
      ['race_week', 3, 3, '2026-10-19', '2026-10-25', 0],
      ['recovery', null, null, '2026-10-26', '2026-11-01', 0],
    ]);
    expect(o).toMatchObject({ totalWeeks: 3, currentWeekNo: 1, status: 'running' });
    // Noch kürzer (angebrochene Startwoche zählt nicht als Belastungswoche) → kein Wettkampfplan.
    expect(outline('2026-10-07', fiveK, '2026-10-07')).toBeNull();
    // Renntag nicht nach dem Planstart → null.
    expect(outline('2026-10-07', { ...half, raceDate: '2026-10-07' })).toBeNull();
  });

  it('sehr langer Vorlauf (Marathon, 52 Wochen, Einsteiger): lange Basis mit regelmäßigen Erholungswochen', () => {
    const marathon = {
      ...half,
      discipline: 'marathon' as const,
      raceDate: '2027-10-03',
      experienceLevel: 'beginner' as const,
      group: 'beginner' as const,
    };
    const o = outline('2026-10-21', marathon);
    expect(o?.phases.map((p) => p.phase)).toEqual([
      'base',
      'build',
      'peak',
      'taper',
      'race_week',
      'recovery',
    ]);
    expect(o).toMatchObject({ totalWeeks: 51, currentWeekNo: 2, status: 'running' });
    const base = o?.phases[0];
    expect(base).toMatchObject({ firstWeekNo: 0, lastWeekNo: 39, recoveryWeeks: 6 });
    // Nie mehr als 5 Belastungswochen am Stück (Einsteiger) – unabhängig geprüft.
    let run = 0;
    for (const w of o?.phases.slice(0, 3).flatMap((p) => p.weeks) ?? []) {
      run = w.recoveryWeek || w.entryWeek ? 0 : run + 1;
      expect(run).toBeLessThanOrEqual(5);
    }
    // Zwei Erholungswochen nach dem Marathon.
    expect(o?.phases.at(-1)?.weeks).toHaveLength(2);
    // Kalender nur bis zur Rennwoche.
    expect(o?.phases.at(-2)?.weeks[0]?.inCalendar).toBe(true);
  });

  it('Wettkampf diese Woche: Status Rennwoche, aktuelle Woche = letzte Woche, nur Rennwoche aktuell', () => {
    const o = outline('2027-01-27');
    expect(o).toMatchObject({ status: 'race_week', currentWeekNo: 16, totalWeeks: 16 });
    expect(o?.phases.filter((p) => p.current).map((p) => p.phase)).toEqual(['race_week']);
    // Renntag selbst (Sonntag) gehört noch zur Rennwoche.
    expect(outline('2027-01-31')).toMatchObject({ status: 'race_week', currentWeekNo: 16 });
  });

  it('Renntag vorbei: Erholung (ohne Wochennummer), danach ganz vorbei', () => {
    const recovery = outline('2027-02-03');
    expect(recovery).toMatchObject({ status: 'recovery', currentWeekNo: null });
    expect(recovery?.phases.find((p) => p.current)?.phase).toBe('recovery');
    const finished = outline('2027-02-20');
    expect(finished).toMatchObject({ status: 'finished', currentWeekNo: null });
    expect(finished?.phases.some((p) => p.current)).toBe(false);
    expect(finished?.phases.flatMap((p) => p.weeks).every((w) => w.past)).toBe(true);
  });

  it('vor dem Planstart: Status before_start, keine Wochennummer', () => {
    expect(outline('2026-09-20')).toMatchObject({ status: 'before_start', currentWeekNo: null });
  });

  it('Trend-Tabelle deckt jede Phase ab', () => {
    expect(Object.keys(COMPETITION_PHASE_TREND).sort()).toEqual(
      ['base', 'build', 'peak', 'race_week', 'recovery', 'taper'].sort(),
    );
  });
});
