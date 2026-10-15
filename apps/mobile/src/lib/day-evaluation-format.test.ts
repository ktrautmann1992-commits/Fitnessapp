import { intakeZone, sessionAchievement } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { t } from '../i18n';
import { achievementView, intakeBarView, intakeTextLine } from './day-evaluation-format';

/** Formulierung „Dein Tag“ (Etappe A2): Texte, Bedienhilfen, Balken-Anteile, ruhige Sprache (2.4). */

const day = {
  mode: 'full' as const,
  targetKcal: 1800,
  floorKcal: 1500,
  band: { min: 1620, max: 1980 },
  ceilingKcal: 2300,
  goalAdjustment: 0,
};

function bar(eaten: number, isToday = false) {
  const r = intakeZone({
    eatenKcal: eaten,
    hasEntries: true,
    day,
    isToday,
    isFuture: false,
    showNumbers: true,
  });
  if (r.kind !== 'bar') throw new Error('Balken erwartet');
  return r;
}

describe('intakeBarView', () => {
  it('Ist und Ziel über dem Balken, Bedienhilfe mit Zone (Plan 6: „1.640 von 1.800 Kilokalorien, im Zielbereich“)', () => {
    const v = intakeBarView(bar(1640));
    expect(v.headline).toBe('1.640 von 1.800 kcal');
    expect(v.a11y).toBe('1.640 von 1.800 Kilokalorien, im Zielbereich');
    expect(v.zoneText).toBe('Im Zielbereich');
    expect(v.symbol).toBe('✓');
    expect(v.tone).toBe('success');
  });

  it('Anteile: Zonen ergeben zusammen 100 %, Füllstand und Zielmarke liegen auf der Skala', () => {
    const v = intakeBarView(bar(1640));
    expect(v.segments.reduce((sum, s) => sum + s.widthPct, 0)).toBeCloseTo(100, 6);
    expect(v.fillPct).toBeGreaterThan(0);
    expect(v.targetPct).toBeGreaterThan(v.fillPct);
  });

  it('heute unter dem Zielbereich: neutral „Noch offen“', () => {
    const v = intakeBarView(bar(400, true));
    expect([v.zoneText, v.tone, v.detail]).toEqual([
      'Noch offen',
      'neutral',
      'Der Tag läuft noch.',
    ]);
  });

  it('rot unten = Fürsorge, rot oben = ruhig, ohne Ausrufezeichen', () => {
    const low = intakeBarView(bar(900));
    expect(low.zoneText).toBe('Unter deinem Mindestbedarf');
    expect(low.detail).toContain('Dein Körper braucht an solchen Tagen mehr');
    const high = intakeBarView(bar(3500));
    expect(high.zoneText).toBe('Deutlich über deinem Ziel');
    expect(high.detail).toBe('Ein einzelner Tag ändert wenig.');
  });
});

describe('intakeTextLine', () => {
  it('Vorschau, nichts eingetragen, nur Einträge ohne Wert, kein Ziel, hidden', () => {
    expect(intakeTextLine({ kind: 'future', targetKcal: 1800 }, 0)).toBe('Tagesziel: 1.800 kcal');
    expect(intakeTextLine({ kind: 'no_entries', targetKcal: 1800 }, 0)).toBe(
      'Nichts eingetragen. Tagesziel: 1.800 kcal',
    );
    expect(intakeTextLine({ kind: 'no_entries', targetKcal: 1800 }, 2)).toBe(t.day.noValues);
    expect(intakeTextLine({ kind: 'no_target' }, 0)).toBe(t.day.noTarget);
    expect(intakeTextLine({ kind: 'hidden' }, 3)).toBeNull();
  });
});

describe('achievementView', () => {
  it('Kraft: „Größtenteils gemacht · 66 %“, je Übung „2/3 Sätze“, Erholungswoche', () => {
    const a = sessionAchievement({
      kind: 'strength',
      isFree: false,
      easyWeek: 'recovery',
      exercises: [
        {
          status: 'done',
          loadType: 'bodyweight',
          targetSets: 3,
          repsMin: 8,
          targetReps: 8,
          targetWeightKg: null,
          targetDurationS: null,
          incrementKind: 'none',
          steps: [],
          sets: [
            { done: true, reps: 8, weightKg: null, durationS: null },
            { done: true, reps: 8, weightKg: null, durationS: null },
          ],
        },
        {
          status: 'skipped',
          loadType: 'bodyweight',
          targetSets: 2,
          repsMin: 8,
          targetReps: 8,
          targetWeightKg: null,
          targetDurationS: null,
          incrementKind: 'none',
          steps: [],
          sets: [],
        },
      ],
    });
    const v = achievementView('Ganzkörper A', a, ['Liegestütz', 'Plank']);
    expect(v.levelText).toBe('Teilweise gemacht');
    expect(v.percentText).toBe('33 %');
    expect(v.lines).toEqual(['Liegestütz: 2/3 Sätze', 'Plank: nicht gemacht']);
    expect(v.hints).toEqual(['Erholungswoche – leichter ist hier richtig.']);
    expect(v.a11y).toBe('Ganzkörper A: Teilweise gemacht, 33 %');
  });

  it('Ausdauer: Minuten von geplant, Distanz, Hinweise', () => {
    const a = sessionAchievement({
      kind: 'endurance',
      isFree: false,
      easyWeek: null,
      plannedMinutes: 30,
      effortTarget: 3,
      durationS: 40 * 60,
      distanceM: 6000,
      sessionRpe: 7,
    });
    const v = achievementView('Lauf', a, []);
    expect(v.levelText).toBe('Ziel erreicht');
    expect(v.lines).toEqual(['40 von 30 min · 6,0 km']);
    expect(v.hints).toEqual([
      'Etwas lockerer als geplant hilft der Erholung.',
      'Länger als geplant – dein Plan steigert trotzdem nur in kleinen Schritten.',
    ]);
  });

  it('frei bzw. ohne Vorgabe: „Gemacht“ ohne Prozent', () => {
    const a = sessionAchievement({
      kind: 'endurance',
      isFree: true,
      easyWeek: null,
      plannedMinutes: null,
      effortTarget: null,
      durationS: 20 * 60,
      distanceM: null,
      sessionRpe: null,
    });
    const v = achievementView('Spaziergang', a, []);
    expect([v.levelText, v.percentText, v.lines]).toEqual(['Gemacht', null, ['20 min']]);
  });
});

describe('Wächter A2 H4: nur „Ziel erreicht“ trägt ✓', () => {
  it('Ausdauer ohne eingetragene Dauer: „• Eingetragen“, ohne Prozent', () => {
    const a = sessionAchievement({
      kind: 'endurance',
      isFree: false,
      easyWeek: null,
      plannedMinutes: 40,
      effortTarget: 3,
      durationS: null,
      distanceM: null,
      sessionRpe: null,
    });
    const v = achievementView('Lauf', a, []);
    expect([v.symbol, v.levelText, v.percentText]).toEqual(['•', 'Eingetragen', null]);
  });
  it('Symbole: ✓ nur bei „reached“', () => {
    const symbols = t.day.levelSymbols;
    for (const [level, symbol] of Object.entries(symbols)) {
      expect(symbol === '✓').toBe(level === 'reached');
    }
  });
});

describe('Sprache (2.4): ruhig, ohne Schuld- und Leistungswörter', () => {
  function texts(value: unknown): string[] {
    if (typeof value === 'string') return [value];
    if (typeof value === 'function') {
      const fn = value as (...args: unknown[]) => unknown;
      return texts(fn('X', 'Y', 'Z'));
    }
    if (value && typeof value === 'object') return Object.values(value).flatMap(texts);
    return [];
  }
  const all = texts(t.day);

  it('keine verbotenen Wörter, kein Ausrufezeichen, keine „verbrannten Kalorien“', () => {
    for (const text of all) {
      expect(text).not.toMatch(
        /geschafft|versagt|gesündigt|cheat|zu viel gegessen|verdient|verbrannt|perfekt|Serie|!/i,
      );
    }
  });
});
