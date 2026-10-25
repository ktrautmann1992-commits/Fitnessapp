import { COMPETITION_DISTANCE_M, racePacePlan, type RacePacePlan } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import {
  courseFits,
  racePaceBars,
  racePaceFuelNotice,
  racePacePrintDocument,
  racePaceRows,
  racePaceTarget,
} from './race-pace-format';

function plan(input: Parameters<typeof racePacePlan>[0]): RacePacePlan {
  const result = racePacePlan(input);
  if (!result.ok) throw new Error(result.error);
  return result.plan;
}

const reference = { discipline: '10k' as const, timeS: 50 * 60, date: '2026-09-01' };

describe('Zielzeit für den Pace-Plan', () => {
  it('Zielzeit vor Vorhersage; Vorhersage auf Wunsch bzw. ohne Zielzeit', () => {
    const c = { discipline: 'half_marathon', targetTimeS: 6900, reference };
    expect(racePaceTarget(c)).toEqual({ timeS: 6900, source: 'target' });
    expect(racePaceTarget(c, true)?.source).toBe('predicted');
    expect(racePaceTarget({ ...c, targetTimeS: null })?.source).toBe('predicted');
    expect(racePaceTarget({ ...c, targetTimeS: null, reference: null })).toBeNull();
    // Referenz zu weit weg (5 km → Marathon): keine Vorhersage.
    expect(
      racePaceTarget({
        discipline: 'marathon',
        targetTimeS: null,
        reference: { ...reference, discipline: '5k' },
      }),
    ).toBeNull();
  });
});

describe('Tabelle, Balken, Druck', () => {
  const half = plan({
    distanceM: COMPETITION_DISTANCE_M.half_marathon,
    targetTimeS: 110 * 60,
    fueling: { level: 'beginner', generalOnly: false },
  });

  it('Zeilen: Abschnitt, Tempo, Uhr; Verpflegung mit Gramm nur mit Zahlen', () => {
    const rows = racePaceRows(half, true);
    expect(rows).toHaveLength(22);
    expect(rows[0]).toMatchObject({ segment: 'km 0–1', pace: '5:13', total: '5:13' });
    expect(rows[21]).toMatchObject({ segment: 'km 21–21,1', total: '1:50:00' });
    const withFuel = rows.find((r) => r.fuel.length > 0);
    expect(withFuel?.fuel[0]).toBe(
      '◆ Verpflegung bei km 5,8 (nach 30 min): bis 15 g Kohlenhydrate',
    );
    expect(racePaceRows(half, false).find((r) => r.fuel.length > 0)?.fuel[0]).toBe(
      '◆ Verpflegung bei km 5,8 (nach 30 min)',
    );
    expect(rows[0]?.elevation).toBeNull();
  });

  it('Balken: gleichmäßig = gleich lang; negativ = Unterschiede sichtbar', () => {
    const even = plan({ distanceM: 10000, targetTimeS: 3000 });
    expect(new Set(racePaceBars(even).map((b) => b.share))).toEqual(new Set([1]));
    const negative = plan({ distanceM: 10000, targetTimeS: 3000, strategy: 'negative' });
    const shares = racePaceBars(negative).map((b) => b.share);
    expect(Math.max(...shares)).toBe(1);
    // 2 % Unterschied → kleiner, aber sichtbarer Unterschied (Spanne mindestens 10 %).
    expect(Math.min(...shares)).toBeGreaterThan(0.85);
    expect(Math.min(...shares)).toBeLessThan(0.95);
  });

  it('Verpflegungs-Hinweis unter 60 min bzw. nur allgemein', () => {
    expect(
      racePaceFuelNotice(
        plan({
          distanceM: 10000,
          targetTimeS: 3000,
          fueling: { level: 'advanced', generalOnly: false },
        }),
      ),
    ).toMatch(/unter einer Stunde/);
    expect(
      racePaceFuelNotice(
        plan({
          distanceM: 21097.5,
          targetTimeS: 7200,
          fueling: { level: 'beginner', generalOnly: true },
        }),
      ),
    ).toMatch(/Banane/);
    expect(racePaceFuelNotice(half)).toBeNull();
  });

  it('Druck-Dokument: Tabelle mit allen Abschnitten, Hinweis „Anstrengung hat Vorrang“, keine Gesundheitsangaben', () => {
    const doc = racePacePrintDocument({
      name: 'Stadtlauf',
      discipline: 'half_marathon',
      distanceKm: null,
      plan: half,
      target: { timeS: 6600, source: 'target' },
      showNumbers: true,
      courseName: null,
    });
    expect(doc.title).toBe('Pace-Plan');
    const table = doc.blocks.find((b) => b.type === 'table');
    expect(table && table.type === 'table' && table.rows).toHaveLength(22);
    expect(table && table.type === 'table' && table.columns.map((c) => c.header)).toEqual([
      'Abschnitt',
      'Tempo',
      'Zeit',
      'Uhr',
      'Verpflegung unterwegs',
    ]);
    const text = JSON.stringify(doc);
    expect(text).toContain('Die Anstrengung hat Vorrang');
    expect(text).not.toMatch(/Gewicht|Puls|Zyklus|Gesundheits/);
  });

  it('Strecke passt bei ±10 %', () => {
    expect(courseFits(23000, 21097.5)).toBe(true);
    expect(courseFits(24000, 21097.5)).toBe(false);
  });
});
