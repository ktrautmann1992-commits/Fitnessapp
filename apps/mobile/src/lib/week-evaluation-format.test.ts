import {
  dayEvaluation,
  type DayEvaluationInput,
  type WeekFoodWithNumbers,
  type WeekTraining,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { t } from '../i18n';
import {
  weekDayView,
  weekFoodLines,
  weekFoodLinesWithoutNumbers,
  weekFreeLine,
  weekTrainingLines,
} from './week-evaluation-format';

/** Formulierung der Wochenauswertung (Etappe A3): Kurztexte, Bedienhilfen, Zeilen, ruhige Sprache (2.4). */

const targets = {
  date: '2026-10-12',
  mode: 'full',
  targetKcal: 1800,
  floorKcal: 1500,
  band: { min: 1620, max: 1980 },
  ceilingKcal: 2300,
  goalAdjustment: 0,
  sessions: [],
  notices: [],
} as unknown as NonNullable<DayEvaluationInput['targets']>;

function day(
  kcal: number | null,
  extra: Partial<DayEvaluationInput> = {},
): ReturnType<typeof dayEvaluation> {
  return dayEvaluation({
    date: '2026-10-12',
    today: '2026-10-14',
    showNumbers: true,
    targets,
    foodLog: {
      available: true,
      entries:
        kcal === undefined
          ? []
          : [
              {
                kcal,
                protein_g: null,
                carbs_g: null,
                fat_g: null,
                source: 'quick',
                slot: 'other',
              },
            ],
    },
    mealPlan: null,
    trainingItems: [],
    achievements: new Map(),
    ...extra,
  });
}

describe('weekDayView', () => {
  it('Balken mit Farbe, Zeichen und Kurztext; Bedienhilfe ohne Zeichen', () => {
    const v = weekDayView(day(1700));
    expect(v.short).toBe('✓ Im Zielbereich');
    expect(v.tone).toBe('success');
    expect(v.fillPct).toBeGreaterThan(0);
    expect(v.targetPct).toBeGreaterThan(v.fillPct as number);
    expect(v.a11y).toBe('Montag, 12.10.: Im Zielbereich. Dein Tag öffnen');
  });

  it('alle Zonen haben Zeichen + Wort', () => {
    expect(weekDayView(day(1000)).short).toBe('↓ Unter Mindestbedarf');
    expect(weekDayView(day(1550)).short).toBe('↘ Etwas darunter');
    expect(weekDayView(day(2100)).short).toBe('↗ Etwas darüber');
    expect(weekDayView(day(4000)).short).toBe('↑ Deutlich darüber');
    expect(weekDayView(day(500, { today: '2026-10-12' })).short).toBe('○ Noch offen');
    expect(weekDayView(day(500, { today: '2026-10-12' })).tone).toBe('neutral');
  });

  it('ohne Eintrag, ohne kcal, künftig, ohne Ziel, ohne Tagebuch: kein Balken', () => {
    const empty = weekDayView(
      dayEvaluation({ ...base(), foodLog: { available: true, entries: [] } }),
    );
    expect(empty).toMatchObject({ short: '– Nichts eingetragen', tone: null, fillPct: null });
    expect(weekDayView(day(null)).short).toBe('– Ohne Kalorienangabe');
    expect(weekDayView(day(1000, { today: '2026-10-10' })).short).toBe('Geplant');
    expect(weekDayView(day(1000, { targets: null })).short).toBe('– Kein Tagesziel');
    expect(
      weekDayView(dayEvaluation({ ...base(), foodLog: { available: false, entries: [] } })).tone,
    ).toBeNull();
  });

  it('ohne Zahlen: keine Farbe, kein Balken, keine kcal – nur Anzahlen', () => {
    const hidden = weekDayView(day(4000, { showNumbers: false }));
    expect(hidden).toMatchObject({
      short: '• Eingetragen',
      tone: null,
      fillPct: null,
      targetPct: null,
    });
    const meals = weekDayView(
      day(4000, {
        showNumbers: false,
        mealPlan: { slots: ['breakfast', 'lunch'], belowFloor: true },
      }),
    );
    expect(meals.short).toBe('0 von 2 Mahlzeiten');
    for (const text of [hidden.short, hidden.a11y, meals.short, meals.a11y]) {
      expect(text).not.toMatch(/kcal|Kilokalorien|\d{3}/);
    }
  });
});

function base(): DayEvaluationInput {
  return {
    date: '2026-10-12',
    today: '2026-10-14',
    showNumbers: true,
    targets,
    foodLog: { available: true, entries: [] },
    mealPlan: null,
    trainingItems: [],
    achievements: new Map(),
  };
}

const food = (extra: Partial<WeekFoodWithNumbers> = {}): WeekFoodWithNumbers => ({
  kind: 'numbers',
  available: true,
  entryDays: 5,
  valuedDays: 5,
  withoutValueDays: 0,
  noTargetDays: 0,
  zoneCounts: { below_floor: 0, below_target: 1, in_range: 3, above_target: 1, well_above: 0 },
  average: { eatenKcal: 1760.4, targetKcal: 1839.6 },
  belowFloorDays: 0,
  patternNotice: false,
  planBelowFloorDays: 0,
  meals: null,
  todayOpen: false,
  targetNotices: [],
  ...extra,
});

describe('weekFoodLines (Plan-Beispiel Abschnitt 8)', () => {
  it('„An 5 Tagen eingetragen. Davon 3 im Zielbereich, 1 etwas darunter, 1 etwas darüber.“, Ø je Tag', () => {
    const lines = weekFoodLines(food());
    expect(lines.entryDays).toBe('An 5 Tagen eingetragen.');
    expect(lines.zones).toBe('Davon 3 im Zielbereich, 1 etwas darunter, 1 etwas darüber.');
    expect(lines.average?.text).toBe('Ø 1.760 von Ø 1.840 kcal je eingetragenem Tag');
    expect(lines.average?.a11y).toBe(
      'Durchschnittlich 1.760 von durchschnittlich 1.840 Kilokalorien je eingetragenem Tag',
    );
  });

  it('Einzahl, ohne Kalorienangabe, ohne Tage', () => {
    const lines = weekFoodLines(
      food({
        entryDays: 2,
        valuedDays: 1,
        withoutValueDays: 1,
        zoneCounts: {
          below_floor: 1,
          below_target: 0,
          in_range: 0,
          above_target: 0,
          well_above: 0,
        },
      }),
    );
    expect(lines.zones).toBe('Davon 1 unter deinem Mindestbedarf, 1 ohne Kalorienangabe.');
    expect(weekFoodLines(food({ entryDays: 1 })).entryDays).toBe('An 1 Tag eingetragen.');
    const none = weekFoodLines(
      food({
        entryDays: 0,
        valuedDays: 0,
        zoneCounts: {
          below_floor: 0,
          below_target: 0,
          in_range: 0,
          above_target: 0,
          well_above: 0,
        },
        average: null,
      }),
    );
    expect(none).toEqual({
      entryDays: 'An keinem vergangenen Tag eingetragen.',
      zones: null,
      average: null,
    });
  });

  it('ohne Zahlen: nur Anzahlen', () => {
    const lines = weekFoodLinesWithoutNumbers({
      kind: 'hidden',
      available: true,
      entryDays: 4,
      meals: { eaten: 9, planned: 16 },
      todayOpen: true,
      helpNotice: false,
    });
    expect(lines).toEqual(['An 4 Tagen eingetragen.', 'Mahlzeiten: 9 von 16 abgehakt']);
  });
});

const training = (extra: Partial<WeekTraining> = {}): WeekTraining => ({
  items: [],
  free: [],
  sessions: { done: 2, planned: 3 },
  strengthSets: { fulfilled: 14, planned: 18, done: 15 },
  enduranceMinutes: { done: 25, planned: 30 },
  distanceM: 4250,
  freeTotals: { sessions: 0, strengthSets: 0, enduranceMinutes: 0, distanceM: 0 },
  ...extra,
});

describe('Training', () => {
  it('Summen: Einheiten, Kraft-Sätze, Ausdauer-Minuten, Strecke (Bedienhilfe ausgeschrieben)', () => {
    expect(weekTrainingLines(training())).toEqual([
      { text: 'Einheiten: 2 von 3 erledigt', a11y: 'Einheiten: 2 von 3 erledigt' },
      { text: 'Kraft-Sätze: 14 von 18 erfüllt', a11y: 'Kraft-Sätze: 14 von 18 erfüllt' },
      { text: 'Ausdauer: 25 von 30 min', a11y: 'Ausdauer: 25 von 30 Minuten' },
      { text: 'Strecke: 4,3 km', a11y: 'Strecke: 4,3 Kilometer' },
    ]);
  });

  it('nur was vorkommt', () => {
    const lines = weekTrainingLines(
      training({
        strengthSets: { fulfilled: 0, planned: 0, done: 0 },
        enduranceMinutes: { done: 0, planned: 0 },
        distanceM: 0,
      }),
    );
    expect(lines.map((l) => l.text)).toEqual(['Einheiten: 2 von 3 erledigt']);
  });

  it('freie Einheiten extra', () => {
    expect(weekFreeLine(training())).toBeNull();
    expect(
      weekFreeLine(
        training({
          freeTotals: { sessions: 2, strengthSets: 4, enduranceMinutes: 30, distanceM: 5000 },
        }),
      ),
    ).toBe('2 freie Einheiten · 4 Sätze · 30 min · 5,0 km');
    expect(
      weekFreeLine(
        training({
          freeTotals: { sessions: 1, strengthSets: 1, enduranceMinutes: 0, distanceM: 0 },
        }),
      ),
    ).toBe('1 freie Einheit · 1 Satz');
  });
});

describe('Sprache (2.4): ruhig, ohne Schuld- und Leistungswörter, keine Bilanz', () => {
  function texts(value: unknown): string[] {
    if (typeof value === 'string') return [value];
    if (typeof value === 'function') {
      const fn = value as (...args: unknown[]) => unknown;
      try {
        return texts(fn('X', 'Y', 'Z'));
      } catch {
        return texts(fn(['X', 'Y']));
      }
    }
    if (value && typeof value === 'object') return Object.values(value).flatMap(texts);
    return [];
  }
  const all = texts(t.weekEval);

  it('keine verbotenen Wörter, kein Ausrufezeichen, keine Bilanz oder Prognose', () => {
    expect(all.length).toBeGreaterThan(40);
    for (const text of all) {
      expect(text).not.toMatch(
        /geschafft|versagt|gesündigt|cheat|zu viel gegessen|verdient|verbrannt|perfekt|Serie|Bilanz|eingespart|Prognose|abnehmen wirst|!/i,
      );
    }
  });

  it('Muster-Hinweis: Fürsorge, kein Lob, keine Zahl', () => {
    expect(t.weekEval.patternLead).toMatch(/Dein Körper braucht/);
    expect(t.weekEval.patternLead).not.toMatch(/\d/);
  });
});

describe('Wächter A3', () => {
  it('S2: Tage ohne Tagesziel eigener ruhiger Text, nicht „ohne Kalorienangabe“', () => {
    const lines = weekFoodLines(
      food({
        entryDays: 2,
        valuedDays: 0,
        withoutValueDays: 0,
        noTargetDays: 2,
        zoneCounts: {
          below_floor: 0,
          below_target: 0,
          in_range: 0,
          above_target: 0,
          well_above: 0,
        },
        average: null,
      }),
    );
    expect(lines.zones).toBe('Davon 2 ohne Tagesziel.');
    expect(lines.zones).not.toContain('Kalorienangabe');
  });

  it('H5: ohne Geplantes nie „x von 0“', () => {
    const lines = weekTrainingLines(
      training({
        sessions: { done: 1, planned: 0 },
        strengthSets: { fulfilled: 0, planned: 0, done: 0 },
        enduranceMinutes: { done: 30, planned: 0 },
        distanceM: 0,
      }),
    );
    expect(lines).toEqual([
      { text: 'Einheiten: 1 erledigt', a11y: 'Einheiten: 1 erledigt' },
      { text: 'Ausdauer: 30 min', a11y: 'Ausdauer: 30 Minuten' },
    ]);
    expect(lines.map((l) => l.text).join(' ')).not.toMatch(/von 0/);
  });

  it('H2: Bedienhilfe nie leer, heute angesagt', () => {
    const unavailable = weekDayView(
      dayEvaluation({ ...base(), foodLog: { available: false, entries: [] } }),
    );
    expect(unavailable.a11y).toBe(
      'Montag, 12.10.: Ernährungstagebuch hier nicht verfügbar. Dein Tag öffnen',
    );
    const today = weekDayView(day(500, { today: '2026-10-12' }));
    expect(today.a11y).toBe('Montag, 12.10., heute: Noch offen. Dein Tag öffnen');
  });

  it('G2: Plan-Hinweis der Woche ruhig, ohne kcal', () => {
    expect(t.weekEval.planBelowFloor(2)).toBe(
      'An 2 Tagen erreichte schon dein Essensplan deinen Mindestbedarf nicht – ergänze dort z. B. eine Portion Obst, Nüsse oder Joghurt.',
    );
    expect(t.weekEval.planBelowFloor(1)).toMatch(/^An 1 Tag /);
  });
});
