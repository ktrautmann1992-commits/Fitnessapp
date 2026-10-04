import { describe, expect, it } from 'vitest';

import {
  distributeEnduranceMinutes,
  ENDURANCE_TEXTS_DE,
  enduranceEffort,
  enduranceVariant,
  enduranceWeekVolumes,
  type EnduranceWeekInput,
} from './endurance';
import { planSafetyRules } from './safety';

const TODAY = '2026-10-05';
const rulesFor = (
  flags: string[] | null,
  birthDate = '1990-01-01',
  experienceLevel: 'beginner' | 'advanced' | 'competitive' = 'advanced',
) =>
  planSafetyRules(
    {
      experienceLevel,
      birthDate,
      healthScreening: flags === null ? null : { flags: flags as never },
    },
    TODAY,
  );

const ctx = (
  discipline: Parameters<typeof enduranceVariant>[0]['discipline'],
  rules = rulesFor([]),
  experienceLevel: 'beginner' | 'advanced' | 'competitive' = 'advanced',
) => ({ discipline, rules, experienceLevel });

describe('enduranceVariant – Tabelle 5.5 (strengste Zeile gewinnt)', () => {
  const pregnant = rulesFor(['pregnancy', 'conservative_plan']);

  it('Schwangerschaft: zügiges Gehen bzw. Ergometer, Schwimmen locker, NIE Rad im Freien', () => {
    expect(enduranceVariant(ctx(null, pregnant), 5, 0)).toBe('brisk_walk');
    expect(enduranceVariant(ctx('marathon', pregnant), 5, 0)).toBe('brisk_walk');
    expect(enduranceVariant(ctx('cycling', pregnant), 5, 0)).toBe('ergometer');
    expect(enduranceVariant(ctx('swimming', pregnant), 5, 0)).toBe('easy_swim');
    for (const index of [0, 1, 2, 3]) {
      const variant = enduranceVariant(ctx('triathlon_olympic', pregnant), 5, index);
      expect(['brisk_walk', 'ergometer']).toContain(variant);
      expect(variant).not.toBe('easy_bike');
    }
  });

  it.each([
    ['Herz-Frage', rulesFor(['medical_clearance_recommended', 'conservative_plan'])],
    ['Verletzung', rulesFor(['injury', 'conservative_plan'])],
    ['Medikamente', rulesFor(['medication', 'conservative_plan'])],
    ['ab 65', rulesFor([], '1961-10-05')],
    ['95 Jahre', rulesFor([], '1931-01-01')],
  ])('%s: zügiges Gehen, bei Rad Ergometer, bei Schwimmen locker', (_l, rules) => {
    expect(enduranceVariant(ctx('10k', rules), 5, 0)).toBe('brisk_walk');
    expect(enduranceVariant(ctx('cycling', rules), 5, 0)).toBe('ergometer');
    expect(enduranceVariant(ctx('swimming', rules), 5, 0)).toBe('easy_swim');
    expect(rules.enduranceEffortMax).toBe(3);
  });

  it('64 Jahre ohne Flag: noch Laufen', () => {
    expect(enduranceVariant(ctx('10k', rulesFor([], '1962-01-01')), 5, 0)).toBe('easy_run');
  });

  it('ohne Gesundheits-Check: Geh-Lauf-Wechsel (immer), Anstrengung ≤ 3', () => {
    const rules = rulesFor(null);
    expect(enduranceVariant(ctx(null, rules), 10, 0)).toBe('walk_run');
    expect(enduranceVariant(ctx('cycling', rules), 10, 0)).toBe('easy_bike');
    expect(rules.enduranceEffortMax).toBe(3);
    expect(rules.enduranceStartGroup).toBe('cautious');
    expect(rules.enduranceWalkOnly).toBe(false);
  });

  it('Einsteiger: Geh-Lauf-Wechsel in den ersten 4 Belastungswochen, danach Dauerlauf', () => {
    const rules = rulesFor([], '1990-01-01', 'beginner');
    expect(enduranceVariant(ctx(null, rules, 'beginner'), 4, 0)).toBe('walk_run');
    expect(enduranceVariant(ctx(null, rules, 'beginner'), 5, 0)).toBe('easy_run');
    expect(enduranceEffort(rules, false)).toBe(4);
  });

  it('sonst nach Disziplin, Triathlon abwechselnd Laufen/Rad', () => {
    expect(enduranceVariant(ctx(null), 1, 0)).toBe('easy_run');
    expect(enduranceVariant(ctx('half_marathon'), 1, 0)).toBe('easy_run');
    expect(enduranceVariant(ctx('cycling'), 1, 0)).toBe('easy_bike');
    expect(enduranceVariant(ctx('swimming'), 1, 0)).toBe('easy_swim');
    expect([0, 1, 2].map((i) => enduranceVariant(ctx('triathlon_long'), 1, i))).toEqual([
      'easy_run',
      'easy_bike',
      'easy_run',
    ]);
  });

  it('unter 18: Anstrengung ≤ 4, Start vorsichtig', () => {
    const minor = rulesFor([], '2009-06-01');
    expect(minor.enduranceEffortMax).toBe(4);
    expect(minor.enduranceStartGroup).toBe('cautious');
  });

  it('Anstrengung: Einstiegs-/Erholungswoche 3, sonst bis zum Deckel; feste Texte vorhanden', () => {
    expect(enduranceEffort({ enduranceEffortMax: 4 }, true)).toBe(3);
    expect(enduranceEffort({ enduranceEffortMax: 4 }, false)).toBe(4);
    expect(enduranceEffort({ enduranceEffortMax: 3 }, false)).toBe(3);
    expect(ENDURANCE_TEXTS_DE.talkTest(3)).toContain('ganzen Sätzen');
    expect(ENDURANCE_TEXTS_DE.alternativesPregnancy).not.toMatch(/Rad im Freien|Rudergerät/);
  });
});

describe('distributeEnduranceMinutes', () => {
  it('proportional, Rest an den längsten Wunsch-Tag, nie über Wunsch', () => {
    expect(distributeEnduranceMinutes(50, [30, 30], 1000).minutes).toEqual([25, 25]);
    // 50 %-Deckel (30) schneidet die 60er-Einheit, Abgeschnittenes geht an die 30er (bis zu ihrem Wunsch).
    expect(distributeEnduranceMinutes(61, [30, 60], 1000).minutes).toEqual([30, 30]);
    expect(distributeEnduranceMinutes(61, [60], 1000).minutes).toEqual([60]);
    // Budget über dem Wunsch: nie über Wunsch, 50 % von 90 = 45.
    expect(distributeEnduranceMinutes(500, [30, 60], 1000).minutes).toEqual([30, 45]);
  });

  it('50 % je Einheit bei ≥ 2 Einheiten; Abgeschnittenes an Tage mit Luft, Rest verfällt', () => {
    const { minutes } = distributeEnduranceMinutes(60, [20, 90], 1000);
    expect(minutes).toEqual([20, 30]);
    expect(minutes.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(60);
  });

  it('Einheit unter 10 Minuten gestrichen, Minuten an die übrigen, Summe ≤ Budget', () => {
    const result = distributeEnduranceMinutes(30, [10, 60, 60], 1000);
    expect(result.dropped).toBe(1);
    expect(result.minutes[0]).toBe(0);
    expect(result.minutes.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(30);
    expect(result.minutes.filter((m) => m > 0).every((m) => m >= 10)).toBe(true);
  });

  it('Budget reicht nicht für 10 Minuten → keine Ausdauer in dieser Woche', () => {
    expect(distributeEnduranceMinutes(9, [30], 1000).minutes).toEqual([0]);
    expect(
      distributeEnduranceMinutes(15, [30, 30], 1000).minutes.filter((m) => m > 0),
    ).toHaveLength(1);
  });
});

const weeks = (kinds: EnduranceWeekInput['kind'][], wishes: number[]): EnduranceWeekInput[] =>
  kinds.map((kind) => ({ kind, wishes }));

describe('enduranceWeekVolumes – 10-%-Regel, Deload, Deckel', () => {
  it('ohne Bezug gilt der Startumfang (nicht der Wunsch); danach floor(1,1 × letzte Belastungswoche)', () => {
    const result = enduranceWeekVolumes(
      weeks(['load', 'load', 'load', 'load', 'deload'], [120, 120]),
      {
        group: 'advanced',
        wishWeekly: 240,
      },
    );
    const sums = result.weeks.map((w) => w.minutes.reduce((a, b) => a + b, 0));
    expect(sums[0]).toBe(120);
    expect(sums[1]).toBe(132);
    // 145 Minuten erlaubt, aber 50 % je Einheit (72) → 144; der Rest verfällt.
    expect(sums[2]).toBe(144);
    expect(sums[3]).toBe(158);
    expect(sums[4]).toBe(94); // floor(0,6 × 158)
    expect(result.ramped).toBe(true);
  });

  it('Rundung mit Math.floor: Bezug 55 → 60, 59 → 64', () => {
    const fromRef = (volume: number) =>
      enduranceWeekVolumes(weeks(['load'], [200]), {
        group: 'competitive',
        wishWeekly: 200,
        reference: { volume, sessionCap: null },
      }).weeks[0]?.budget;
    expect(fromRef(55)).toBe(60);
    expect(fromRef(59)).toBe(64);
    expect(fromRef(0)).toBe(150); // Bezug 0 → Startumfang
  });

  it('Woche 0 und Erholungswoche sind nie Bezug', () => {
    const result = enduranceWeekVolumes(weeks(['week0', 'load', 'load', 'deload'], [60, 60]), {
      group: 'advanced',
      wishWeekly: 120,
    });
    const sums = result.weeks.map((w) => w.minutes.reduce((a, b) => a + b, 0));
    expect(sums[0]).toBeLessThanOrEqual(120);
    expect(sums[1]).toBe(120); // erste Belastungswoche startet mit S, nicht mit Woche 0
    expect(sums[2]).toBe(120); // Wunsch erreicht
    expect(sums[3]).toBe(72);
    // Folgeblock nach der Erholungswoche: Bezug = letzte Belastungswoche (120), nicht 72.
    const next = enduranceWeekVolumes(weeks(['load'], [90, 90]), {
      group: 'advanced',
      wishWeekly: 180,
      reference: { volume: 120, sessionCap: null },
    });
    expect(next.weeks[0]?.budget).toBe(132);
  });

  it('Start-Deckel je Einheit: Einsteiger Wunsch 60 min → Woche 1 höchstens 30, Woche 2 höchstens 33', () => {
    const result = enduranceWeekVolumes(weeks(['intro', 'load', 'load'], [60]), {
      group: 'beginner',
      wishWeekly: 60,
    });
    expect(result.weeks.map((w) => w.minutes[0])).toEqual([30, 33, 36]);
    expect(result.weeks.map((w) => w.sessionCap)).toEqual([30, 33, 36]);
  });

  it('vorsichtig: Start-Deckel 20 → 22, Startumfang 45; Überschuss verfällt', () => {
    const result = enduranceWeekVolumes(weeks(['load', 'load'], [60, 60]), {
      group: 'cautious',
      wishWeekly: 120,
    });
    expect(result.weeks[0]?.minutes).toEqual([20, 20]);
    expect(result.weeks[1]?.minutes).toEqual([22, 22]);
  });

  it('erste Belastungswoche höchstens 90 Minuten je Einheit', () => {
    const result = enduranceWeekVolumes(weeks(['load', 'load'], [240]), {
      group: 'competitive',
      wishWeekly: 240,
    });
    expect(result.weeks[0]?.minutes).toEqual([90]);
    expect(result.weeks[1]?.minutes).toEqual([99]);
  });

  it('Folgeblock: Start-Deckel aus der längsten nicht gestrichenen Einheit fortgeschrieben', () => {
    const result = enduranceWeekVolumes(weeks(['load'], [60, 60]), {
      group: 'beginner',
      wishWeekly: 120,
      reference: { volume: 60, sessionCap: 30 },
    });
    expect(result.weeks[0]?.sessionCap).toBe(33);
    expect(result.weeks[0]?.minutes).toEqual([33, 33]);
  });
});
