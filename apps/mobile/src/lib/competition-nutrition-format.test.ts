import {
  CARB_LOADING_NOTICE_DE,
  type CompetitionRow,
  nutritionTargetsForWeek,
  type NutritionInputsInput,
  raceFuelingPlan,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { nutritionCompetitionsFromRows } from '../data/nutrition-plan';
import { rowsWith } from '../test/fixtures';
import {
  competitionDayLabel,
  competitionDayLines,
  durationText,
  raceFuelingLines,
  raceTimelineRows,
} from './competition-nutrition-format';

/** Anzeige der Wettkampf-Ernährung (Phase 10, Etappe W1) – feste deutsche Texte, Gramm nur mit Zahlen. */

const MONDAY = '2026-10-12';
const FRIDAY = '2026-10-16';
const SATURDAY = '2026-10-17';
const SUNDAY = '2026-10-18';

function person(overrides: Partial<NutritionInputsInput> = {}): NutritionInputsInput {
  return {
    today: MONDAY,
    birthDate: '1990-01-01',
    sex: 'male',
    goalType: 'endurance',
    experienceLevel: 'beginner',
    healthDataConsent: true,
    bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 180, weightKg: 80 }],
    healthFlags: { flags: [] },
    activityLevel: 'sedentary',
    competitions: [{ id: 'c1', status: 'planned', discipline: 'half_marathon', raceDate: SUNDAY }],
    ...overrides,
  };
}

const day = (date: string, overrides: Partial<NutritionInputsInput> = {}) => {
  const found = nutritionTargetsForWeek(person(overrides), MONDAY).days.find(
    (d) => d.date === date,
  );
  if (found === undefined) throw new Error('Tag fehlt');
  return found;
};

describe('durationText', () => {
  it.each([
    [0, '0 min'],
    [45, '45 min'],
    [60, '1 Std.'],
    [165, '2 Std. 45 min'],
    [330, '5 Std. 30 min'],
  ])('%i → %s', (minutes, text) => {
    expect(durationText(minutes)).toBe(text);
  });
});

describe('Tag rund um den Wettkampf', () => {
  it('Carb-Loading mit Zahlen: Art, Tagesziel bleibt, Richtwert nicht erreicht, ohne Defizit, Dauer', () => {
    const friday = day(FRIDAY);
    expect(competitionDayLabel(friday.competition!)).toBe('▲ Carb-Loading-Tag: Halbmarathon');
    const lines = competitionDayLines(friday, true);
    expect(lines[0]).toContain('Heute mehr Kohlenhydrate – so geplant');
    expect(lines).toContain(
      'Dein Tagesziel bleibt gleich – mehr Kohlenhydrate, etwas weniger Fett.',
    );
    expect(lines.some((l) => l.includes('8–10 g'))).toBe(true);
    expect(lines.some((l) => l.includes('ohne Defizit'))).toBe(true);
    expect(lines.at(-1)).toBe('Erwartete Dauer: etwa 2 Std. 45 min (grob geschätzt)');
  });

  it('„Kalorienzahlen anzeigen“ aus: keine Gramm, kein „Tagesziel“', () => {
    const lines = competitionDayLines(day(FRIDAY), false);
    expect(lines.join(' ')).not.toMatch(/\d+\s*g\b|kcal|Tagesziel/);
  });

  it('ohne Ziele (keine Einwilligung): fester Carb-Loading-Hinweis statt Verschiebung', () => {
    const lines = competitionDayLines(day(FRIDAY, { healthDataConsent: false }), true);
    expect(lines).toContain(CARB_LOADING_NOTICE_DE);
    expect(lines.some((l) => l.includes('ohne Defizit'))).toBe(false);
  });

  it('Vorabend und Renntag mit Zeichen und Wort', () => {
    expect(competitionDayLabel(day(SATURDAY).competition!)).toBe('◇ Vorabend: Halbmarathon');
    expect(competitionDayLabel(day(SUNDAY).competition!)).toBe('◆ Renntag: Halbmarathon');
    expect(competitionDayLines(day(SUNDAY), true)).toContain(
      'Dein Wettkampf ist in deinem Tagesziel schon eingerechnet (geschätzt).',
    );
  });

  it('unter 18: keine Verschiebung, kein „so geplant“, kein g/kg-Satz – fester Hinweis; am Renntag Milliliter ja, Gramm nein', () => {
    const teen = { birthDate: '2010-01-01' };
    const lines = competitionDayLines(day(FRIDAY, teen), true);
    expect(lines).toContain(CARB_LOADING_NOTICE_DE);
    expect(lines.join(' ')).not.toMatch(/so geplant|g\/kg|pro kg|\d+\s*g\b|Tagesziel bleibt/);
    const plan = day(SUNDAY, teen).competition!.fueling!;
    const text = [
      ...raceTimelineRows(plan, true).flatMap((r) => [r.title, r.detail ?? '']),
      ...raceFuelingLines(plan, true),
    ].join(' ');
    expect(text).not.toMatch(/\d+\s*g\b/);
    expect(text).toContain('400–800 ml');
  });

  it('Abnehm-Ziel ruht wegen Wettkampf: eigener Satz (N4)', () => {
    const paused = day(FRIDAY, {
      goalType: 'fat_loss',
      weightGoal: {
        targetWeightKg: 75,
        startDate: '2026-10-05',
        targetDate: '2027-04-05',
        amountMode: 'kg_to_lose',
        timeMode: 'weeks',
      },
    });
    expect(competitionDayLines(paused, true)).toContain(
      'Dein Abnehm-Ziel ruht wegen deines Wettkampfs und läuft danach von selbst weiter – ohne Aufholen.',
    );
  });

  it('ohne Wettkampf keine Zeilen', () => {
    expect(competitionDayLines(day(FRIDAY, { competitions: [] }), true)).toEqual([]);
  });
});

describe('Zeitleiste am Renntag', () => {
  it('mit Zahlen: Frühstück mit Gramm, Portionen, Ziel, Erholung, Richtwerte, Hinweise', () => {
    const plan = day(SUNDAY).competition!.fueling!;
    const rows = raceTimelineRows(plan, true);
    expect(rows[0]).toMatchObject({
      title: expect.stringContaining('2 Std. bis 4 Std. vor dem Start') as string,
      detail: 'etwa 160–320 g Kohlenhydrate',
    });
    expect(rows.filter((r) => r.title.startsWith('Nach '))).toHaveLength(5);
    expect(rows.find((r) => r.title.startsWith('Nach 30 min'))?.detail).toBe(
      'etwa 15–30 g Kohlenhydrate (z. B. Gel, Banane oder Sportgetränk)',
    );
    expect(rows.at(-2)?.title).toBe('Ziel (erwartet nach 2 Std. 45 min)');
    expect(rows.at(-1)?.title).toContain('1 Std. bis 2 Std. nach dem Ziel');
    const lines = raceFuelingLines(plan, true);
    expect(lines).toContain('Richtwert unterwegs: 30–60 g Kohlenhydrate pro Stunde.');
    expect(lines).toContain('Trinken: Richtwert 400–800 ml pro Stunde.');
    expect(lines.some((l) => l.startsWith('Nichts Neues am Renntag'))).toBe(true);
  });

  it('ohne Zahlen: keine Gramm, Milliliter bleiben', () => {
    const plan = day(SUNDAY).competition!.fueling!;
    const text = [
      ...raceTimelineRows(plan, false).flatMap((r) => [r.title, r.detail ?? '']),
      ...raceFuelingLines(plan, false),
    ].join(' ');
    expect(text).not.toMatch(/\d+\s*g\b/);
    expect(text).toContain('400–800 ml');
  });

  it('60–120 min: „bis 30 g pro Stunde“, Portionen „bis 15 g“', () => {
    const plan = raceFuelingPlan(100, 'competitive', { generalOnly: false });
    expect(raceFuelingLines(plan, true)).toContain(
      'Richtwert unterwegs: bis 30 g Kohlenhydrate pro Stunde.',
    );
    expect(
      raceTimelineRows(plan, true).find((r) => r.title.startsWith('Nach 30 min'))?.detail,
    ).toBe('bis 15 g Kohlenhydrate (z. B. Gel, Banane oder Sportgetränk)');
  });

  it('kurzer Wettkampf: nichts nötig; keine Marken, kein Koffein', () => {
    const plan = raceFuelingPlan(25, 'competitive', { generalOnly: false });
    const text = [
      ...raceTimelineRows(plan, true).flatMap((r) => [r.title, r.detail ?? '']),
      ...raceFuelingLines(plan, true),
    ].join(' ');
    expect(text).toContain('weniger als einer Stunde');
    expect(text).not.toMatch(/Koffein|Kaffee|®|™/);
  });
});

describe('nutritionCompetitionsFromRows', () => {
  const row = (patch: Partial<CompetitionRow> = {}): CompetitionRow => ({
    id: 'c1',
    user_id: 'u1',
    name: 'Stadtlauf',
    discipline: 'half_marathon',
    distance_m: 21097.5,
    race_date: SUNDAY,
    goal_kind: 'finish',
    target_time_s: null,
    reference_discipline: '10k',
    reference_time_s: 3000,
    reference_date: '2026-09-01',
    long_run_weekday: null,
    status: 'planned',
    result_session_log_id: null,
    own_start_weekly_minutes: null,
    start_reference_volume: null,
    start_reference_session_cap: null,
    start_reference_start_group: null,
    effective_goal: null,
    uses_health_data: false,
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
    ...patch,
  });

  it('nur die Felder für die Ernährung; Zielzeit nur beim Ziel „Zielzeit“; unlesbare Zeilen fallen weg', () => {
    expect(nutritionCompetitionsFromRows(rowsWith({ competitions: [row()] }))).toEqual([
      {
        id: 'c1',
        status: 'planned',
        discipline: 'half_marathon',
        raceDate: SUNDAY,
        targetTimeS: null,
        reference: { discipline: '10k', timeS: 3000, date: '2026-09-01' },
        resultSessionLogId: null,
      },
    ]);
    expect(
      nutritionCompetitionsFromRows(
        rowsWith({ competitions: [row({ goal_kind: 'time', target_time_s: 6300 })] }),
      )[0]?.targetTimeS,
    ).toBe(6300);
    expect(
      nutritionCompetitionsFromRows(rowsWith({ competitions: [row({ race_date: 'kaputt' })] })),
    ).toEqual([]);
  });
});
