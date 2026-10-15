import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { INTAKE_ZONES } from '../constants';
import { addDays } from '../dates';
import { nutritionTargetsForWeek, type NutritionDayTargets } from '../nutrition/targets';
import { inputs, MONDAY, run, seededRandom, session } from '../nutrition/test-helpers';
import {
  INTAKE_ZONE_IDS,
  intakeZone,
  type IntakeZoneInput,
  type IntakeZoneResult,
} from './intake-zone';

/**
 * Kalorienbalken (docs/PLAN-AUSWERTUNG.md 2.1–2.3, Abschnitt 6, Etappe A2): jede Zonengrenze genau und ± 1 kcal,
 * Sonderfälle der Engine und Eigenschaften (a)–(d).
 */

type Day = IntakeZoneInput['day'];

/** `goalAdjustment` < 0 = Tag mit Defizit (Abnehmen, G1); Standard 0 = Halten. */
function day(
  z: number,
  u: number,
  bandMin: number,
  bandMax: number,
  o: number,
  goalAdjustment = 0,
): Day {
  return {
    mode: 'full',
    goalAdjustment,
    targetKcal: z,
    floorKcal: u,
    band: { min: bandMin, max: bandMax },
    ceilingKcal: o,
  };
}

const past = (d: Day, eaten: number, extra: Partial<IntakeZoneInput> = {}) =>
  intakeZone({
    eatenKcal: eaten,
    hasEntries: true,
    day: d,
    isToday: false,
    isFuture: false,
    showNumbers: true,
    ...extra,
  });

function zoneOf(result: IntakeZoneResult): string {
  return result.kind === 'bar' ? result.zone : result.kind;
}

describe('Zonengrenzen genau und ± 1 kcal (2.1)', () => {
  // Erhalt (Plan-Beispiel): Z 2.400, U 1.800, B [2.160; 2.640], O 2.640 → R = max(2.640; 2.880) = 2.880.
  const keep = day(2400, 1800, 2160, 2640, 2640);

  it.each([
    [1799, 'below_floor'],
    [1800, 'below_target'],
    [1801, 'below_target'],
    [2159, 'below_target'],
    [2160, 'in_range'],
    [2161, 'in_range'],
    [2400, 'in_range'],
    [2639, 'in_range'],
    [2640, 'in_range'],
    [2641, 'above_target'],
    [2879, 'above_target'],
    [2880, 'above_target'],
    [2881, 'well_above'],
  ])('Erhalt: %i kcal → %s', (eaten, zone) => {
    expect(zoneOf(past(keep, eaten))).toBe(zone);
  });

  it('Farben: rot/gelb/grün/gelb/rot (Design-Token-Rollen)', () => {
    const tones = [1000, 2000, 2400, 2700, 3000].map((g) => {
      const r = past(keep, g);
      return r.kind === 'bar' ? r.tone : null;
    });
    expect(tones).toEqual(['danger', 'warning', 'success', 'warning', 'danger']);
  });

  it('R = max(O; Z × 1,2): liegt O höher, gilt O (Abnehmen, Erhaltungsniveau ist gelb, nicht rot)', () => {
    // Abnehmen Ruhetag (Plan-Beispiel 2.1, neu gerechnet mit G1): Z 1.800, U 1.725 → Grün ab max(U; 0,95 × Z; B_min)
    // = max(1.725; 1.710; 1.725) = 1.725 (keine gelbe Zone unten), B_max 1.980, O 2.530.
    const loss = day(1800, 1725, 1725, 1980, 2530, -0.2);
    expect(zoneOf(past(loss, 1724))).toBe('below_floor');
    expect(zoneOf(past(loss, 1725))).toBe('in_range');
    expect(zoneOf(past(loss, 1980))).toBe('in_range');
    expect(zoneOf(past(loss, 1981))).toBe('above_target');
    expect(zoneOf(past(loss, 2400))).toBe('above_target');
    expect(zoneOf(past(loss, 2530))).toBe('above_target');
    expect(zoneOf(past(loss, 2531))).toBe('well_above');
    const bar = past(loss, 1900);
    expect(bar.kind === 'bar' && bar.markers.upperKcal).toBe(2530);
  });

  it('G1 Abnehmen: Grün erst ab max(U; Z × 0,95) – darunter gelb, unter U rot (±1 kcal)', () => {
    // Z 2.000, U 1.700, B [1.800; 2.200], O 2.640, Defizit → Grün ab 1.900.
    const loss = day(2000, 1700, 1800, 2200, 2640, -0.2);
    expect(zoneOf(past(loss, 1699))).toBe('below_floor');
    expect(zoneOf(past(loss, 1700))).toBe('below_target');
    expect(zoneOf(past(loss, 1800))).toBe('below_target');
    expect(zoneOf(past(loss, 1899))).toBe('below_target');
    expect(zoneOf(past(loss, 1900))).toBe('in_range');
    expect(zoneOf(past(loss, 1901))).toBe('in_range');
    expect(zoneOf(past(loss, 2000))).toBe('in_range');
    const bar = past(loss, 1950);
    expect(bar.kind === 'bar' && bar.markers.greenFromKcal).toBe(1900);
    // Heute: unter 1.900 noch offen.
    const today = past(loss, 1850, { isToday: true });
    expect(today.kind === 'bar' && today.zone).toBe('open');
    // Gleiche Zahlen ohne Defizit (Halten/Aufbau): Grün wie bisher ab B_min.
    const keep = day(2000, 1700, 1800, 2200, 2640, 0);
    expect(zoneOf(past(keep, 1800))).toBe('in_range');
    const gain = day(2000, 1700, 1800, 2200, 2640, 0.1);
    expect(zoneOf(past(gain, 1800))).toBe('in_range');
  });

  it('U ≥ 0,9 × Z: keine gelbe Zone unten – direkt von rot nach grün', () => {
    const tight = day(1800, 1700, 1700, 1980, 2400);
    const bar = past(tight, 1750);
    expect(bar.kind).toBe('bar');
    if (bar.kind !== 'bar') return;
    expect(bar.scale.zones.map((z) => z.zone)).toEqual([
      'below_floor',
      'in_range',
      'above_target',
      'well_above',
    ]);
    expect(zoneOf(past(tight, 1699))).toBe('below_floor');
    expect(zoneOf(past(tight, 1700))).toBe('in_range');
  });

  it('Muskelaufbau (O nah an Z): Z × 1,2 sorgt für eine sichtbare gelbe Zone oben', () => {
    const gain = day(2800, 2100, 2520, 2860, 2860);
    const bar = past(gain, 2900);
    expect(bar.kind === 'bar' && bar.zone).toBe('above_target');
    expect(bar.kind === 'bar' && bar.markers.upperKcal).toBe(
      2800 * INTAKE_ZONES.upperRedTargetFactor,
    );
    expect(zoneOf(past(gain, 3360))).toBe('above_target');
    expect(zoneOf(past(gain, 3361))).toBe('well_above');
  });

  it('U = O (Überschussdeckel greift) und Z durch Rundung knapp über O: Z ist grün, kein Datenfehler', () => {
    // Aus der Engine (Eigenschaftstest gefunden): U = O = 2.478,725, B [2.478,725; 2.498,725], Z 2.480.
    const capped = day(2480, 2478.725, 2478.725, 2498.725, 2478.725);
    expect(zoneOf(past(capped, 2480))).toBe('in_range');
    expect(zoneOf(past(capped, 2478))).toBe('below_floor');
    expect(zoneOf(past(capped, 2976))).toBe('above_target');
    expect(zoneOf(past(capped, 2977))).toBe('well_above');
  });

  it('Planband bis 20 kcal über O (Mindestbreite der Engine): R liegt nie unter B_max', () => {
    // Künstlich: Z × 1,2 < B_max wäre nur bei sehr kleinen Zielen möglich – R bleibt mindestens B_max.
    const odd = day(90, 80, 81, 101, 100);
    expect(zoneOf(past(odd, 101))).toBe('in_range');
    expect(zoneOf(past(odd, 108))).toBe('above_target');
  });
});

describe('Heute, vergangen, künftig, ohne Einträge (2.2)', () => {
  const keep = day(2400, 1800, 2160, 2640, 2640);
  const today = (eaten: number) => past(keep, eaten, { isToday: true });

  it('heute unter B_min: neutral „Noch offen“ – auch unter der Untergrenze (nie rot am Morgen)', () => {
    for (const eaten of [0, 300, 1799, 1800, 2159]) {
      const r = today(eaten);
      expect(r.kind === 'bar' && [r.zone, r.tone]).toEqual(['open', 'neutral']);
    }
  });

  it('heute ab B_min wie vergangene Tage (grün, gelb, rot)', () => {
    expect(zoneOf(today(2160))).toBe('in_range');
    expect(zoneOf(today(2700))).toBe('above_target');
    expect(zoneOf(today(3000))).toBe('well_above');
  });

  it('gestern gleiche Menge → volle Farbskala', () => {
    expect(zoneOf(past(keep, 1000))).toBe('below_floor');
    expect(zoneOf(past(keep, 2000))).toBe('below_target');
  });

  it('keine Einträge: grau, nie 0 kcal und nie rot – heute wie gestern', () => {
    for (const isToday of [true, false]) {
      expect(past(keep, 0, { hasEntries: false, isToday })).toEqual({
        kind: 'no_entries',
        targetKcal: 2400,
      });
    }
  });

  it('künftiger Tag: nur das Tagesziel, kein Balken (auch mit Einträgen)', () => {
    expect(past(keep, 500, { isFuture: true })).toEqual({ kind: 'future', targetKcal: 2400 });
  });

  it('heute und künftig gleichzeitig ist ein Fehler', () => {
    expect(() => past(keep, 0, { isToday: true, isFuture: true })).toThrow();
  });

  it('ungültige Menge wird abgelehnt (Zod)', () => {
    expect(() => past(keep, -1)).toThrow();
    expect(() => past(keep, Number.NaN)).toThrow();
  });

  it('Datenfehler in den Zielen (U > B_min) bricht ab statt still zu raten', () => {
    expect(() => past(day(2000, 1900, 1800, 2200, 2200), 2000)).toThrow(RangeError);
  });
});

describe('Ohne Zahlen und ohne Ziel (2.3)', () => {
  const keep = day(2400, 1800, 2160, 2640, 2640);

  it('„Kalorienzahlen aus“: hidden – Typ und Wert ohne jede Zahl', () => {
    const hidden = intakeZone({
      eatenKcal: 3000,
      hasEntries: true,
      day: keep,
      isToday: false,
      isFuture: false,
      showNumbers: false,
    });
    // Typ: IntakeHidden (Overload) – nur `kind`.
    const kind: 'hidden' = hidden.kind;
    expect(kind).toBe('hidden');
    expect(hidden).toEqual({ kind: 'hidden' });
  });

  it('no_targets (Schwangerschaft, keine Einwilligung, keine Körperdaten): kein Balken', () => {
    const none: Day = {
      mode: 'no_targets',
      targetKcal: null,
      floorKcal: null,
      band: null,
      ceilingKcal: null,
      goalAdjustment: null,
    };
    expect(past(none, 1500)).toEqual({ kind: 'no_target' });
    expect(past(none, 1500, { showNumbers: false })).toEqual({ kind: 'hidden' });
  });
});

// ---------------------------------------------------------------------------------------------------------
// Echte Tagesziele aus der Engine
// ---------------------------------------------------------------------------------------------------------

function engineDays(overrides: Parameters<typeof inputs>[0] = {}): NutritionDayTargets[] {
  return [...nutritionTargetsForWeek(inputs(overrides), MONDAY).days];
}

function boundaryCheck(d: NutritionDayTargets) {
  if (d.floorKcal === null || d.band === null || d.targetKcal === null)
    throw new Error('kein Ziel');
  const u = Math.ceil(d.floorKcal);
  // Orakel G1 mit Zahl aus der Gründer-Entscheidung (nicht aus constants.ts): beim Defizit Grün ab max(B_min; U; 0,95 Z).
  const deficit = d.goalAdjustment !== null && d.goalAdjustment < 0;
  const greenFrom = deficit
    ? Math.min(d.targetKcal, Math.max(d.band.min, d.floorKcal, d.targetKcal * 0.95))
    : d.band.min;
  const bMin = Math.ceil(greenFrom);
  if (bMin - 1 >= u) expect(zoneOf(past(d, bMin - 1))).toBe('below_target');
  expect(zoneOf(past(d, u - 1))).toBe('below_floor');
  expect(zoneOf(past(d, bMin))).toBe('in_range');
  expect(zoneOf(past(d, d.targetKcal))).toBe('in_range');
  expect(zoneOf(past(d, Math.floor(d.band.max)))).toBe('in_range');
}

describe('Sonderfälle der Engine (Abschnitt 6)', () => {
  it('Abnehmen, Erhalt, Muskelaufbau: Ziel liegt immer im grünen Bereich, U − 1 ist rot', () => {
    for (const goalType of ['fat_loss', 'general_fitness', 'muscle_gain'] as const) {
      for (const d of engineDays({ goalType })) boundaryCheck(d);
    }
  });

  it('maintenance_only (ohne Gesundheits-Check, weiblich, Abnehmen): Balken normal', () => {
    const days = engineDays({ goalType: 'fat_loss', sex: 'female', healthFlags: null });
    expect(days.every((d) => d.mode === 'maintenance_only')).toBe(true);
    for (const d of days) boundaryCheck(d);
  });

  it('unter 18: Balken normal, Grenzen aus der Engine', () => {
    const days = engineDays({ birthDate: '2009-06-01', goalType: 'fat_loss' });
    expect(days[0]?.ageYears).toBe(17);
    for (const d of days) boundaryCheck(d);
  });

  it('Schwangerschaft: no_targets → kein Balken, ohne Zahlen hidden', () => {
    const days = engineDays({ sex: 'female', healthFlags: { flags: ['pregnancy'] } });
    for (const d of days) {
      expect(d.mode).toBe('no_targets');
      expect(past(d, 2000)).toEqual({ kind: 'no_target' });
      expect(past(d, 2000, { showNumbers: false })).toEqual({ kind: 'hidden' });
    }
  });

  it('ohne Einwilligung bzw. ohne Körperdaten: kein Ziel → kein Balken', () => {
    for (const d of [
      ...engineDays({ healthDataConsent: false }),
      ...engineDays({ bodyMetricsRows: [] }),
    ]) {
      expect(past(d, 2000)).toEqual({ kind: 'no_target' });
    }
  });

  it('45 kg und 200 kg', () => {
    for (const weightKg of [45, 200]) {
      const days = engineDays({
        goalType: 'fat_loss',
        bodyMetricsRows: [
          { measuredOn: '2026-10-01', heightCm: weightKg === 45 ? 160 : 190, weightKg },
        ],
      });
      for (const d of days) boundaryCheck(d);
    }
  });

  it('1 und 7 Trainingstage: Trainingstage haben höhere Ziele, alle Grenzen geordnet', () => {
    const one = engineDays({ sessions: [session(MONDAY)] });
    const seven = engineDays({
      sessions: Array.from({ length: 7 }, (_, i) =>
        i % 2 === 0 ? session(addDays(MONDAY, i)) : run(addDays(MONDAY, i), 45),
      ),
    });
    for (const d of [...one, ...seven]) boundaryCheck(d);
    expect((one[0]?.targetKcal ?? 0) > (one[1]?.targetKcal ?? 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Eigenschaften (a)–(d)
// ---------------------------------------------------------------------------------------------------------

function randomDays(count: number): NutritionDayTargets[] {
  const rand = seededRandom(20261015);
  const pick = <T>(values: readonly T[]): T => values[Math.floor(rand() * values.length)] as T;
  const result: NutritionDayTargets[] = [];
  while (result.length < count) {
    const weightKg = 45 + Math.round(rand() * 155);
    const heightCm = 150 + Math.round(rand() * 50);
    const sessions = Array.from({ length: Math.floor(rand() * 8) }, (_, i) =>
      rand() < 0.5
        ? session(addDays(MONDAY, i % 7), { minutes: 20 + Math.round(rand() * 100) })
        : run(addDays(MONDAY, i % 7), 20 + Math.round(rand() * 160), 1 + Math.floor(rand() * 4)),
    );
    const week = nutritionTargetsForWeek(
      inputs({
        sex: pick(['male', 'female', 'diverse'] as const),
        birthDate: pick(['1950-03-01', '1990-01-01', '2009-06-01', '1975-07-15']),
        goalType: pick(['fat_loss', 'general_fitness', 'muscle_gain', 'endurance'] as const),
        bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm, weightKg }],
        healthFlags: rand() < 0.15 ? null : { flags: [] },
        activityLevel: pick(['sedentary', 'light', 'active', 'very_active'] as const),
        sessions,
      }),
      MONDAY,
    );
    result.push(...week.days.filter((d) => d.targetKcal !== null));
  }
  return result.slice(0, count);
}

const ORDER = new Map(INTAKE_ZONE_IDS.map((z, i) => [z, i] as const));

function containsNumber(value: unknown): boolean {
  if (typeof value === 'number') return true;
  if (Array.isArray(value)) return value.some(containsNumber);
  if (value !== null && typeof value === 'object') return Object.values(value).some(containsNumber);
  return false;
}

describe('Eigenschaften (Abschnitt 6)', () => {
  const days = randomDays(400);

  it('(a) G < U ergibt nie gelb oder grün (vergangen); heute höchstens neutral', () => {
    for (const d of days) {
      const u = d.floorKcal as number;
      for (const g of [0, u * 0.5, Math.ceil(u) - 1, u - 0.01]) {
        if (g < 0 || g >= u) continue;
        const r = past(d, g);
        expect(r.kind === 'bar' && r.tone).toBe('danger');
        const t = past(d, g, { isToday: true });
        expect(t.kind === 'bar' && t.tone).toBe('neutral');
      }
    }
  }, 60_000);

  it('(b) Zonen sind von links nach rechts geordnet (Skala und Zuordnung monoton)', () => {
    for (const d of days) {
      const target = d.targetKcal as number;
      let last = -1;
      for (let g = 0; g <= target * 2; g += Math.max(1, Math.round(target / 50))) {
        const r = past(d, g);
        if (r.kind !== 'bar') throw new Error('Balken erwartet');
        const index = ORDER.get(r.zone as (typeof INTAKE_ZONE_IDS)[number]) as number;
        expect(index).toBeGreaterThanOrEqual(last);
        last = index;
        const zones = r.scale.zones;
        for (let i = 1; i < zones.length; i += 1) {
          const prev = zones[i - 1];
          const cur = zones[i];
          if (!prev || !cur) continue;
          expect(cur.fromKcal).toBeCloseTo(prev.toKcal, 9);
          expect(ORDER.get(cur.zone) as number).toBeGreaterThan(ORDER.get(prev.zone) as number);
        }
        expect(zones[0]?.fromKcal).toBe(0);
        expect(zones.at(-1)?.toKcal).toBe(r.scale.maxKcal);
        expect(r.scale.maxKcal).toBeGreaterThanOrEqual(g);
      }
    }
  }, 60_000);

  it('(b) auch heute und künftig: heute „offen“ links vor allen Zonen, danach geordnet; künftig nie ein Balken', () => {
    for (const d of days) {
      const target = d.targetKcal as number;
      let last = -2;
      let seenOpen = false;
      for (let g = 0; g <= target * 2; g += Math.max(1, Math.round(target / 50))) {
        const r = past(d, g, { isToday: true });
        if (r.kind !== 'bar') throw new Error('Balken erwartet');
        // „open“ = links vor allen Zonen (Index −1); danach wie vergangene Tage, nie zurück nach „open“.
        const index =
          r.zone === 'open'
            ? -1
            : (ORDER.get(r.zone as (typeof INTAKE_ZONE_IDS)[number]) as number);
        expect(index).toBeGreaterThanOrEqual(last);
        if (r.zone === 'open') seenOpen = true;
        else expect(['below_floor', 'below_target']).not.toContain(r.zone);
        last = index;
        const future = past(d, g, { isFuture: true });
        expect(future).toEqual({ kind: 'future', targetKcal: target });
      }
      expect(seenOpen).toBe(true);
    }
  }, 60_000);

  it('G1-Eigenschaft: bei Defizit nie Grün unter max(U; 0,95 × Z), Z immer grün, Ordnung bleibt', () => {
    let deficitDays = 0;
    for (const d of days) {
      const z0 = d.targetKcal as number;
      expect(zoneOf(past(d, z0))).toBe('in_range');
      if (d.goalAdjustment === null || d.goalAdjustment >= 0) continue;
      deficitDays += 1;
      const limit = Math.max(d.floorKcal as number, z0 * 0.95);
      for (const g of [limit - 1, limit - 0.01, (d.floorKcal as number) + 0.5]) {
        if (g >= limit || g < 0) continue;
        expect(zoneOf(past(d, g))).not.toBe('in_range');
      }
      expect(zoneOf(past(d, Math.min(z0, Math.ceil(limit))))).toBe('in_range');
    }
    expect(deficitDays).toBeGreaterThan(20);
  }, 60_000);

  it('(c) bei showNumbers = false steht nirgends eine kcal-Zahl', () => {
    for (const d of days) {
      for (const g of [0, d.targetKcal as number, 5000]) {
        for (const flags of [
          { isToday: false, isFuture: false },
          { isToday: true, isFuture: false },
          { isToday: false, isFuture: true },
        ]) {
          for (const hasEntries of [true, false]) {
            const r = intakeZone({
              eatenKcal: g,
              hasEntries,
              day: d,
              showNumbers: false,
              ...flags,
            });
            expect(containsNumber(r)).toBe(false);
            expect(JSON.stringify(r)).not.toMatch(/\d/);
          }
        }
      }
    }
  }, 60_000);

  it('(d) Strukturtest: intake-zone.ts/day-evaluation.ts lesen nur Werte aus nutritionTargetsForWeek – keine eigenen Grenzen', () => {
    for (const file of ['intake-zone.ts', 'day-evaluation.ts']) {
      const source = readFileSync(join(import.meta.dirname, file), 'utf8');
      // Keine Grenzen-Funktionen und keine Schutzgrenzen-Konstanten.
      expect(source).not.toMatch(
        /\b(clampCalorieTarget|dayFloorKcal|dayCeilingKcal|planBand|dayLimitContext|dayEnergy|nutritionMacros|mealPlanBand)\s*\(/,
      );
      expect(source).not.toMatch(
        /\b(MAX_CALORIE_DEFICIT_FRACTION|MIN_INTAKE_RELATIVE_TO_BMR|MAX_WEEKLY_WEIGHT_LOSS_FRACTION|MAX_WEEKLY_WEIGHT_GAIN_FRACTION|EA_MIN_KCAL_PER_KG_FFM|SPECIAL_CASE_DEFICIT_CAPS|SURPLUS_CAP|PORTION_TOLERANCE|PLAN_BAND_MIN_WIDTH_KCAL|TRAINING_KCAL_DAY_MAX)\b/,
      );
      // Importe nur aus erlaubten Modulen (keine Engine-Interna wie limits/energy/macros).
      const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
      for (const path of imports) {
        expect([
          'zod',
          '../constants',
          '../age',
          '../nutrition/targets',
          '../nutrition/food-log',
          '../nutrition/notices',
          '../log/achievement',
          '../log/summary',
          './intake-zone',
        ]).toContain(path);
      }
      // Aus constants.ts nur INTAKE_ZONES.
      const constants = source.match(/import \{([^}]*)\} from '\.\.\/constants'/)?.[1];
      if (constants !== undefined) expect(constants.trim()).toBe('INTAKE_ZONES');
      // Keine Zahl-Literale außer 0, 1 und der Rechen-Toleranz 1e-9 (Kommentare ausgenommen).
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/'[^']*'/g, "''");
      const numbers = [...code.matchAll(/(?<![\w.])(\d+(?:\.\d+)?(?:e-?\d+)?)(?![\w])/g)].map(
        (m) => m[1],
      );
      expect(numbers.filter((n) => !['0', '1', '1e-9'].includes(n as string))).toEqual([]);
    }
  });
});
