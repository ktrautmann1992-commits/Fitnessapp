import { type CompetitionFeasibility, competitionPlanOutline } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import {
  clockA11y,
  clockText,
  countdownText,
  feasibilityFacts,
  feasibilityHeadline,
  kmText,
  outlinePhaseDates,
  outlinePhaseTitle,
  outlineStatusText,
  outlineWeekLabel,
  paceText,
  partsFromSeconds,
  phaseBandText,
  secondsFromParts,
  stepDurationText,
  stepLines,
  suggestionText,
  workoutInfoLines,
} from './competition-format';

/** Anzeige-Texte zum Wettkampf (WP4) – feste deutsche Texte. */

describe('Zeiten und Strecken', () => {
  it('Schritt-Dauer, Uhr, Bildschirmleser', () => {
    expect(stepDurationText(20)).toBe('20 s');
    expect(stepDurationText(180)).toBe('3 min');
    expect(stepDurationText(90)).toBe('1:30 min');
    expect(clockText(65)).toBe('1:05');
    expect(clockText(6800)).toBe('1:53:20');
    expect(clockText(-3)).toBe('0:00');
    expect(clockA11y(3661)).toBe('1 Stunde 1 Minute 1 Sekunde');
    expect(clockA11y(0)).toBe('0 Sekunden');
  });
  it('Pace und Kilometer', () => {
    expect(paceText(365)).toBe('6:05');
    expect(kmText(12_000)).toBe('12');
    expect(kmText(21_097.5)).toBe('21,1');
  });
  it('Zeit-Felder: leer, ungültig, Rundreise', () => {
    expect(secondsFromParts('', '', '')).toBeNull();
    expect(secondsFromParts('1', '60', '')).toBeNull();
    expect(secondsFromParts('x', '', '')).toBeNull();
    expect(secondsFromParts('0', '0', '0')).toBeNull();
    expect(secondsFromParts('1', '53', '20')).toBe(6800);
    expect(partsFromSeconds(6800)).toEqual({ hours: '1', minutes: '53', seconds: '20' });
    expect(partsFromSeconds(null)).toEqual({ hours: '', minutes: '', seconds: '' });
  });
});

describe('Einheit: Art, Pace (immer mit Hinweis), Distanz-Richtwert, Ablauf', () => {
  it('mit Pace und Distanz', () => {
    expect(
      workoutInfoLines(
        { workout_type: 'long' },
        { pace: { fastSPerKm: 360, slowSPerKm: 390 }, distanceM: 12_500, hard: false },
      ),
    ).toEqual([
      'Art: Langer Lauf',
      'Pace-Richtwert: 6:00–6:30 min/km',
      'Die Anstrengung hat Vorrang – bei Hitze, Wind und Steigungen langsamer.',
      'Distanz-Richtwert: etwa 12,5 km (die Dauer ist dein Ziel)',
    ]);
  });
  it('harte Art mit Wort, ohne Art nichts', () => {
    expect(
      workoutInfoLines({ workout_type: 'intervals' }, { pace: null, distanceM: null, hard: true }),
    ).toEqual(['Art: Intervalle (hart)']);
    expect(workoutInfoLines({}, { pace: null, distanceM: null, hard: false })).toEqual([]);
  });
  it('Ablauf: Wiederholungen zusammengefasst', () => {
    expect(
      stepLines([
        { part: 'warmup', kind: 'easy', seconds: 600, effort: 3 },
        { part: 'main', kind: 'work', seconds: 180, effort: 8 },
        { part: 'main', kind: 'rest', seconds: 120, effort: 3 },
        { part: 'main', kind: 'work', seconds: 180, effort: 8 },
        { part: 'cooldown', kind: 'easy', seconds: 300, effort: 3 },
      ]),
    ).toEqual([
      'Aufwärmen: 10 min locker (Anstrengung 3)',
      '2 × 3 min zügig (Anstrengung 8), dazwischen 2 min locker',
      'Abwärmen: 5 min locker (Anstrengung 3)',
    ]);
  });
});

describe('Phasen-Band, Countdown, Ampel', () => {
  it('Phasen-Band', () => {
    expect(phaseBandText({ phase: 'build', weekNo: 6, totalWeeks: 14, raceWeek: false })).toBe(
      'Aufbau · Woche 6 von 14',
    );
    expect(phaseBandText({ phase: 'base', weekNo: 0, totalWeeks: 16, raceWeek: false })).toBe(
      'Basis · Einstiegswoche (bis zum Renntag 16 Wochen)',
    );
    expect(phaseBandText({ phase: null, weekNo: 3, totalWeeks: 16, raceWeek: false })).toBe(
      'Woche 3 von 16',
    );
    expect(
      phaseBandText({ phase: 'recovery', weekNo: null, totalWeeks: 16, raceWeek: false }),
    ).toBe('Erholung nach dem Rennen');
  });
  it('Countdown', () => {
    expect(
      countdownText({ kind: 'upcoming', daysLeft: 23, raceWeek: false }, 'half_marathon'),
    ).toBe('Noch 23 Tage bis zum Halbmarathon');
    expect(countdownText({ kind: 'upcoming', daysLeft: 1, raceWeek: true }, '10k')).toBe(
      'Noch 1 Tag bis zum 10 km',
    );
    expect(countdownText({ kind: 'race_day' }, 'marathon')).toContain('Heute ist Renntag');
  });
  it('Ampel: Zeichen + Wort, Vorschläge, Zahlen', () => {
    expect(feasibilityHeadline({ status: 'ok' })).toBe('✓ Passt');
    expect(feasibilityHeadline({ status: 'tight' })).toBe('! Knapp');
    expect(feasibilityHeadline({ status: 'too_short' })).toBe('✕ Zu kurz');
    expect(feasibilityHeadline({ status: 'not_available' })).toBe('✕ Nicht möglich');
    expect(suggestionText({ kind: 'later_date', raceDate: '2026-12-30' })).toBe(
      'Späterer Renntag: ab 30.12.2026',
    );
    expect(suggestionText({ kind: 'shorter_distance', discipline: '10k' })).toBe(
      'Kürzere Distanz: 10 km',
    );
    const f = {
      status: 'ok',
      effectiveGoal: 'finish',
      leadWeeks: 17,
      minimumLeadWeeks: 12,
      plannedPeakMinutes: 150,
      requiredWeeklyMinutes: 140,
      plannedLongRunMinutes: 75,
      requiredLongRunMinutes: 70,
    } as CompetitionFeasibility;
    expect(feasibilityFacts(f)).toEqual([
      'Noch 17 Wochen bis zum Renntag – empfohlen sind mindestens 12.',
      'Höchster Wochenumfang im Plan: 150 min (nötig: 140 min).',
      'Längster Lauf im Plan: 75 min (nötig: 70 min).',
      'Ziel im Plan: Ankommen',
    ]);
    expect(feasibilityFacts({ ...f, status: 'not_available' })).toEqual([]);
  });
});

describe('So ist dein Plan aufgebaut (Gründer-Rückmeldung 20.10.2026)', () => {
  const outline = competitionPlanOutline({
    cycle: {
      discipline: 'half_marathon',
      raceDate: '2027-01-31',
      experienceLevel: 'advanced',
      group: 'advanced',
      cautious: false,
    },
    planStart: '2026-10-07',
    today: '2026-10-21',
    sessions: [],
  });
  if (!outline) throw new Error('kein Zyklus');
  const phase = (p: string) => outline.phases.find((x) => x.phase === p);

  it('Stand: Woche X von Y, Einstieg, Rennwoche, Erholung, vorbei', () => {
    expect(outlineStatusText(outline)).toBe('Du bist in Woche 2 von 16.');
    expect(outlineStatusText({ ...outline, currentWeekNo: 0 })).toBe(
      'Du bist in der Einstiegswoche (bis zum Renntag 16 Wochen).',
    );
    expect(outlineStatusText({ ...outline, status: 'race_week' })).toBe(
      'Diese Woche ist Rennwoche.',
    );
    expect(outlineStatusText({ ...outline, status: 'recovery' })).toContain('Erholung');
    expect(outlineStatusText({ ...outline, status: 'finished' })).toBe(
      'Dein Wettkampfplan ist abgeschlossen.',
    );
    expect(outlineStatusText({ ...outline, status: 'before_start' })).toBe(
      'Dein Plan beginnt bald.',
    );
  });

  it('Phase: Name mit Wochen-Spanne und Datum (auch für den Bildschirmleser)', () => {
    const base = phase('base');
    const race = phase('race_week');
    const recovery = phase('recovery');
    if (!base || !race || !recovery) throw new Error('Phase fehlt');
    expect(outlinePhaseTitle(base)).toEqual({
      text: 'Basis · Wochen 0–7',
      a11y: 'Basis, Wochen 0 bis 7',
    });
    expect(outlinePhaseTitle(race).text).toBe('Rennwoche · Woche 16');
    expect(outlinePhaseTitle(recovery).text).toBe('Erholung nach dem Rennen');
    expect(outlinePhaseDates(base)).toEqual({
      text: '05.10.2026 – 29.11.2026',
      a11y: 'vom 05.10.2026 bis 29.11.2026',
    });
  });

  it('Woche: Markierung immer mit Wort (jetzt, Erholung, Renntag, Prozent)', () => {
    const weeks = outline.phases.flatMap((p) => p.weeks);
    const byNo = (n: number | null) => weeks.find((w) => w.weekNo === n);
    expect(outlineWeekLabel(byNo(0)!)).toMatchObject({ title: 'Einstieg', marker: '' });
    expect(outlineWeekLabel(byNo(2)!)).toMatchObject({ title: 'Woche 2', marker: 'jetzt' });
    expect(outlineWeekLabel(byNo(2)!).a11y).toBe(
      'Woche 2, vom 19.10.2026 bis 25.10.2026, Basis, aktuelle Woche',
    );
    expect(outlineWeekLabel(byNo(5)!)).toMatchObject({ marker: 'Erholung' });
    expect(outlineWeekLabel(byNo(5)!).a11y).toContain('Erholungswoche, Vorschau');
    expect(outlineWeekLabel(byNo(15)!)).toMatchObject({ marker: '70 %' });
    expect(outlineWeekLabel(byNo(16)!)).toMatchObject({ title: 'Woche 16', marker: 'Renntag' });
    expect(outlineWeekLabel(byNo(null)!)).toMatchObject({ title: 'Danach', marker: '50 %' });
    expect(outlineWeekLabel({ ...byNo(3)!, plannedMinutes: 210, projected: false }).a11y).toContain(
      '210 Minuten Ausdauer geplant',
    );
  });
});
