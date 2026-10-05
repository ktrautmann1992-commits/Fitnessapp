/**
 * Eigenschaftstest mit UNABHÄNGIGEN Erwartungen (docs/PLAN-PHASE-4.md Abschnitt 5.7): Über viele zufällige
 * Eintragsfolgen – mit Erholungs- und Einstiegswochen, wechselnden Orten und Fassungen, eigenem Gewicht und
 * eingestreuten Tippfehlern (× 10, unbestätigt) – werden die Schutzregeln allein aus den EINGABEN (den gespeicherten
 * Einträgen) und festen Zahlen geprüft, nicht aus Zwischenwerten der Engine.
 */
import { afterAll, describe, expect, it } from 'vitest';

import { daysBetween } from '../dates';
import { prescriptionForDisplay, progressFromLogs } from './progression';
import { buildExerciseLogEntry } from './progression';
import type { ExerciseLogEntry, ExerciseProgress, LoggedSet, ProgressionContext } from './types';

// Feste Zahlen – bewusst NICHT aus constants.ts.
/** Fester Stichtag für Tests ohne Pausen-Bezug. */
const TODAY = '2026-10-20';
const MAX_KG = 500;
const DIRECT_STEP = 0.1; // 10 %
const PAUSE_DAYS = 28; // 4 Wochen
const REPS_BUFFER = 2;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CONTEXTS: { ctx: ProgressionContext; start: number; studio: number[]; home: number[] }[] = [
  {
    ctx: {
      loadType: 'weight',
      repsMin: 8,
      repsMax: 12,
      durationS: null,
      templateSets: 3,
      rpeTarget: 8,
      incrementKind: 'free_weight',
    },
    start: 10,
    studio: [4, 6, 8, 10, 12, 14, 16, 18, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40],
    home: [4, 6, 8],
  },
  {
    ctx: {
      loadType: 'weight',
      repsMin: 5,
      repsMax: 8,
      durationS: null,
      templateSets: 4,
      rpeTarget: 7,
      incrementKind: 'barbell',
    },
    start: 470,
    studio: [],
    home: [],
  },
  {
    ctx: {
      loadType: 'weight',
      repsMin: 10,
      repsMax: 15,
      durationS: null,
      templateSets: 3,
      rpeTarget: 8,
      incrementKind: 'machine',
    },
    start: 30,
    studio: [],
    home: [],
  },
];

interface Step {
  before: ExerciseProgress;
  /** Wirksamer Zustand am Ort dieser Einheit (gerundetes Gewicht mit dortigem Wdh.-Stand). */
  beforeEffective: ExerciseProgress;
  after: ExerciseProgress;
  entry: ExerciseLogEntry;
  shownRpe: number;
  plannedRpe: number;
}

function run(seed: number): { steps: Step[]; ctx: ProgressionContext } {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)] as T;
  const { ctx, start, studio, home } = pick(CONTEXTS);
  const entries: ExerciseLogEntry[] = [];
  const steps: Step[] = [];
  let date = Date.parse('2026-10-05T00:00:00Z');
  const sessions = 25 + Math.floor(r() * 25);
  for (let i = 0; i < sessions; i += 1) {
    date += (1 + Math.floor(r() * 4)) * 86_400_000;
    const performedOn = new Date(date).toISOString().slice(0, 10);
    const isIntroWeek = i < 2 && r() < 0.5;
    const isDeload = !isIntroWeek && r() < 0.1;
    const steps_ = r() < 0.2 ? home : studio;
    const plannedSets = pick([ctx.templateSets, ctx.templateSets, 2, 1]);
    const local = { ...ctx, steps: steps_, allowExtraSet: r() < 0.9 };
    const result = progressFromLogs('x', entries, local, { today: TODAY, startWeightKg: start });
    const plannedRpe = ctx.rpeTarget - (isIntroWeek ? 1 : 0) - (isDeload ? 2 : 0);
    const rpeMax = r() < 0.3 ? 7 : undefined;
    const p = prescriptionForDisplay(
      {
        sets: plannedSets,
        reps_min: ctx.repsMin,
        reps_max: ctx.repsMax,
        duration_s: null,
        rpe_target: plannedRpe,
      },
      result,
      {
        isDeload,
        steps: steps_,
        allowExtraSet: local.allowExtraSet,
        ...(rpeMax !== undefined ? { rpeMax } : {}),
      },
    );
    // Was die Person macht
    const mode = r();
    const shownWeight = p.weightKg ?? start;
    let weightConfirmed = false;
    let weights: number[];
    if (mode < 0.08) {
      weights = Array(p.sets).fill(Math.min(MAX_KG, shownWeight * 10)); // Tippfehler × 10, unbestätigt
    } else if (mode < 0.12) {
      weights = Array(p.sets)
        .fill(shownWeight)
        .map((w, k) => (k === 0 ? Math.min(MAX_KG, w * 10) : w));
    } else if (mode < 0.17) {
      weights = Array(p.sets).fill(Math.max(0.5, Math.round(shownWeight * 0.8 * 2) / 2)); // leichter, eigene Wahl
    } else if (mode < 0.2) {
      weights = Array(p.sets).fill(Math.min(MAX_KG, Math.round(shownWeight * 1.3 * 2) / 2));
      weightConfirmed = true; // bewusst schwerer, bestätigt
    } else {
      weights = Array(p.sets).fill(shownWeight);
    }
    const reps = (p.targetReps ?? 8) + (r() < 0.75 ? 0 : -Math.floor(r() * 3));
    const sets: LoggedSet[] = weights.map((weightKg) => ({
      reps,
      weightKg,
      durationS: null,
      rpe: r() < 0.5 ? null : pick([6, 7, 8, 9]),
      done: r() < 0.97,
    }));
    const entry = buildExerciseLogEntry({
      exerciseId: 'x',
      performedOn,
      loggedAt: `${performedOn}T18:00:00Z`,
      status: 'done',
      loadType: 'weight',
      isIntroWeek,
      isDeload,
      progress: result,
      prescription: p,
      weightConfirmed,
      sets,
    });
    entries.push(entry);
    const after = progressFromLogs('x', entries, local, {
      today: TODAY,
      startWeightKg: start,
    }).progress;
    steps.push({
      before: result.progress,
      beforeEffective: result.effective,
      after,
      entry,
      shownRpe: p.rpeTarget,
      plannedRpe: rpeMax !== undefined ? Math.min(plannedRpe, rpeMax) : plannedRpe,
    });
  }
  return { steps, ctx };
}

const allEqual = (sets: readonly LoggedSet[], weight: number) => {
  const working = sets.filter((s) => s.done && (s.reps ?? 0) > 0 && s.weightKg !== null);
  return (
    working.length > 0 && working.every((s) => Math.abs((s.weightKg as number) - weight) < 1e-9)
  );
};

describe('Eigenschaften der Progression über zufällige Eintragsfolgen', () => {
  it('die Folgen enthalten alle geprüften Fälle (Test ist nicht leer)', () => {
    const seen = { jump: 0, bigJump: 0, lighter: 0, typo: 0, deload: 0 };
    for (let seed = 1; seed <= 300; seed += 1) {
      for (const { before, after, entry } of run(seed).steps) {
        if (entry.isDeload) seen.deload += 1;
        if (entry.sets.some((s) => (s.weightKg ?? 0) > (before.weightKg ?? Infinity) * 5))
          seen.typo += 1;
        if (before.weightKg === null || after.weightKg === null) continue;
        if (after.weightKg > before.weightKg) seen.jump += 1;
        if (after.weightKg > before.weightKg * 1.1 + 1e-9) seen.bigJump += 1;
        if (after.weightKg < before.weightKg) seen.lighter += 1;
      }
    }
    for (const count of Object.values(seen)) expect(count).toBeGreaterThan(10);
  });

  for (let seed = 1; seed <= 300; seed += 1) {
    it(`Folge ${seed}`, () => {
      const { steps, ctx } = run(seed);
      const repsCap = Math.min((ctx.repsMax ?? 0) + REPS_BUFFER, 30);
      for (const { before, beforeEffective, after, entry, shownRpe, plannedRpe } of steps) {
        // nie über 500 kg
        if (after.weightKg !== null) expect(after.weightKg).toBeLessThanOrEqual(MAX_KG);
        // RPE nie über dem Plan bzw. Deckel
        expect(shownRpe).toBeLessThanOrEqual(plannedRpe);
        if (before.weightKg === null || after.weightKg === null) continue;
        const ownChoice =
          !entry.isDeload && !entry.isIntroWeek && allEqual(entry.sets, after.weightKg);
        // nie automatisch weniger Gewicht: der gespeicherte Rohwert sinkt nur durch eigene Wahl (alle
        // Arbeitssätze mit diesem Gewicht) – nie durch eine Orts-Rundung (Wächter Etappe A, B1)
        if (after.weightKg < before.weightKg - 1e-9) {
          expect(ownChoice).toBe(true);
        }
        // Sprung > 10 % nur nach Puffer (Wdh. am Puffer-Ende und Zusatzsatz bzw. kein Zusatzsatz möglich) oder
        // bestätigter eigener Wahl
        if (after.weightKg > before.weightKg * (1 + DIRECT_STEP) + 1e-9) {
          // Puffer am vollen Gewicht oder am gerundeten Gewicht dieses Orts
          const buffered =
            Math.max(before.targetReps ?? 0, beforeEffective.targetReps ?? 0) >= repsCap;
          const confirmedOwn = ownChoice && entry.weightConfirmed;
          expect(buffered || confirmedOwn).toBe(true);
        }
        // Erholungs- und Einstiegswoche ändern einen vorhandenen Zustand nie
        if ((entry.isDeload || entry.isIntroWeek) && entry.state !== null) {
          expect(after).toEqual(before);
        }
      }
    });
  }
});

describe('Eigenschaft „es geht weiter“ (Wächter Etappe A, Befund 1c)', () => {
  let sessionsRun = 0;
  let weightSteps = 0;
  afterAll(() => {
    // nicht leer: viele Einheiten und echte Gewichtsschritte
    expect(sessionsRun).toBeGreaterThan(200 * 20);
    expect(weightSteps).toBeGreaterThan(200);
  });
  for (let seed = 1; seed <= 200; seed += 1) {
    it(`Stufen-Raster ${seed}: wer immer genau die Vorgabe schafft, kommt voran`, () => {
      const r = rng(seed * 7919);
      // zufälliges Raster: Startwert und unregelmäßige Abstände (0,5–6 kg), bis 120 kg
      const steps: number[] = [];
      let w = 1 + Math.floor(r() * 8);
      while (w <= 120) {
        steps.push(w);
        w = Math.round((w + 0.5 + r() * 5.5) * 2) / 2;
      }
      const repsMin = 5 + Math.floor(r() * 6);
      const repsMax = repsMin + 2 + Math.floor(r() * 5);
      const ctx: ProgressionContext = {
        loadType: 'weight',
        repsMin,
        repsMax,
        durationS: null,
        templateSets: 3,
        rpeTarget: 8,
        incrementKind: 'free_weight',
        steps,
      };
      const window = 2 * (repsMax - repsMin + 3);
      // erster Eintrag kalibriert: Gewicht irgendwo im Raster, nicht auf einer Stufe nötig
      const firstWeight = steps[Math.floor(r() * Math.min(5, steps.length))] as number;
      const entries: ExerciseLogEntry[] = [
        {
          exerciseId: 'x',
          performedOn: '2026-10-01',
          loggedAt: '2026-10-01T18:00:00Z',
          status: 'done',
          loadType: 'weight',
          isIntroWeek: false,
          isDeload: false,
          targetSets: 3,
          targetWeightKg: null,
          targetReps: null,
          targetExtraSet: null,
          targetRpe: 8,
          state: null,
          weightConfirmed: false,
          sets: Array.from({ length: 3 }, () => ({
            reps: repsMin + 2,
            weightKg: firstWeight,
            durationS: null,
            rpe: 8,
            done: true,
          })),
        },
      ];
      let previous = progressFromLogs('x', entries, ctx, { today: TODAY }).progress;
      let sinceChange = 0;
      let date = Date.parse('2026-10-03T00:00:00Z');
      for (let i = 0; i < 4 * window; i += 1) {
        const result = progressFromLogs('x', entries, ctx, { today: TODAY });
        if (result.hint === 'no_heavier_weight') break; // Raster zu Ende – legitimer Stillstand
        const p = prescriptionForDisplay(
          { sets: 3, reps_min: repsMin, reps_max: repsMax, duration_s: null, rpe_target: 8 },
          result,
          { isDeload: false, steps },
        );
        if (p.weightKg === null) break; // unter der kleinsten Stufe – App fragt nach der leichtesten Stufe
        const performedOn = new Date(date).toISOString().slice(0, 10);
        date += 2 * 86_400_000;
        entries.push(
          buildExerciseLogEntry({
            exerciseId: 'x',
            performedOn,
            loggedAt: `${performedOn}T18:00:00Z`,
            status: 'done',
            loadType: 'weight',
            isIntroWeek: false,
            isDeload: false,
            progress: result,
            prescription: p,
            sets: Array.from({ length: p.sets }, () => ({
              reps: p.targetReps,
              weightKg: p.weightKg,
              durationS: null,
              rpe: null,
              done: true,
            })),
          }),
        );
        const after = progressFromLogs('x', entries, ctx, { today: TODAY }).progress;
        sessionsRun += 1;
        if ((after.weightKg ?? 0) > (previous.weightKg ?? 0)) weightSteps += 1;
        const changed = JSON.stringify(after) !== JSON.stringify(previous);
        sinceChange = changed ? 0 : sinceChange + 1;
        expect(sinceChange).toBeLessThanOrEqual(window);
        // Orts-Rundung ist nie ein eigener Wunsch
        expect(progressFromLogs('x', entries, ctx, { today: TODAY }).selfChosenWeight).toBe(false);
        previous = after;
      }
    });
  }
});

describe('Eigenschaft „gemessen am Gestemmten“ (Wächter Etappe A, Runden 2–4)', () => {
  let returns = 0;
  let continued = 0;
  afterAll(() => {
    // Wiedereinstiege und „es geht weiter“ kommen wirklich vor (Test nicht leer)
    expect(returns).toBeGreaterThan(20);
    expect(continued).toBeGreaterThan(200);
  });
  const grid = (r: () => number, from: number, to: number): number[] => {
    const out: number[] = [];
    let w = from;
    while (w <= to) {
      out.push(w);
      w = Math.round((w + 0.5 + r() * 5.5) * 2) / 2;
    }
    return out;
  };
  for (let seed = 1; seed <= 200; seed += 1) {
    it(`Orte ${seed}: nächste Vorgabe nie > 10 % über dem schwersten Satz der letzten zählenden Einheit`, () => {
      const r = rng(seed * 104_729);
      // zwei Orte mit eigenen, zufälligen Rastern (zu Hause meist gröber und leichter)
      const places = [
        grid(r, 2 + Math.floor(r() * 6), 80),
        grid(r, 2 + Math.floor(r() * 4), 20 + r() * 30),
      ];
      const repsMin = 5 + Math.floor(r() * 6);
      const repsMax = repsMin + 2 + Math.floor(r() * 5);
      const repsCap = Math.min(repsMax + REPS_BUFFER, 30);
      const base: ProgressionContext = {
        loadType: 'weight',
        repsMin,
        repsMax,
        durationS: null,
        templateSets: 3,
        rpeTarget: 8,
        incrementKind: 'free_weight',
      };
      const entries: ExerciseLogEntry[] = [];
      let date = Date.parse('2026-10-01T00:00:00Z');
      const startWeightKg = Math.round((10 + r() * 20) * 2) / 2;
      let place = Math.floor(r() * places.length);
      let steps = places[place] as number[];
      const placeOf: number[] = [];
      let checked = 0;
      for (let i = 0; i < 40; i += 1) {
        const ctx = { ...base, steps };
        // meist alle 2 Tage, manchmal eine längere Pause (bis 3 Wochen)
        date += (r() < 0.1 ? 7 + Math.floor(r() * 15) : 2) * 86_400_000;
        const performedOn = new Date(date).toISOString().slice(0, 10);
        const result = progressFromLogs('x', entries, ctx, { startWeightKg, today: performedOn });
        const p = prescriptionForDisplay(
          { sets: 3, reps_min: repsMin, reps_max: repsMax, duration_s: null, rpe_target: 8 },
          result,
          { isDeload: false, steps },
        );
        const lifted = (e: ExerciseLogEntry) =>
          e.sets
            .filter((s) => s.done && (s.reps ?? 0) > 0 && s.weightKg !== null)
            .map((s) => s.weightKg as number);
        const bufferDone = (e: ExerciseLogEntry, weight: number) =>
          Math.max(e.targetReps ?? 0, e.state?.targetReps ?? 0) >= repsCap &&
          e.sets.every(
            (s) => s.done && (s.reps ?? 0) >= repsCap && (s.weightKg ?? 0) >= weight - 1e-9,
          );
        // letzte ZÄHLENDE Einheit (Wiedereinstiegs-Einheiten zählen nicht)
        let lastIndex = entries.length - 1;
        while (lastIndex >= 0 && entries[lastIndex]?.isReturn) lastIndex -= 1;
        const last = entries[lastIndex];
        // Pause = 28 Tage ohne Training an mindestens dem heute gezeigten Gewicht W (D1), gemessen am Gestemmten
        const window = entries.filter((e) => daysBetween(e.performedOn, performedOn) <= PAUSE_DAYS);
        // trainiertes Gewicht wie in der Engine: angezeigt; ein anderes gestemmtes nur einheitlich und bestätigt bzw.
        // plausibel (≤ 10 % über max(Zustand, Anzeige)); ohne Anzeige der schwerste Satz
        const trained = (e: ExerciseLogEntry): number => {
          const weights = lifted(e);
          if (e.targetWeightKg === null) return Math.max(0, ...weights);
          const uniform =
            weights.length > 0 && weights.every((w) => Math.abs(w - (weights[0] as number)) <= 1e-9)
              ? (weights[0] as number)
              : null;
          const ref = Math.max(e.state?.weightKg ?? 0, e.targetWeightKg);
          return uniform !== null &&
            uniform > e.targetWeightKg &&
            (e.weightConfirmed || uniform <= ref * (1 + DIRECT_STEP) + 1e-9)
            ? uniform
            : e.targetWeightKg;
        };
        const heaviestRecent = Math.max(0, ...window.map(trained));
        const shownW = result.effective.weightKg;
        if (result.returnAfterPause && shownW !== null) {
          // Wiedereinstieg nur, wenn in den letzten 28 Tagen kein Satz mit Gewicht ≥ W gestemmt wurde
          expect(heaviestRecent).toBeLessThan(shownW - 1e-9);
          expect(window.some((e) => e.isReturn)).toBe(false);
        } else if (
          entries.length > 0 &&
          p.weightKg !== null &&
          !window.some((e) => e.isReturn) &&
          !entries.some((e) => e.weightConfirmed || bufferDone(e, Math.max(0, ...lifted(e))))
        ) {
          // kein Wiedereinstieg: in den letzten 28 Tagen ein Satz mit Gewicht ≥ W (bzw. ≤ 10 % darunter beim
          // ersten Tag nach einem Gewichtsschritt)
          expect(p.weightKg).toBeLessThanOrEqual(heaviestRecent * (1 + DIRECT_STEP) + 1e-9);
          continued += 1;
        }
        if (result.returnAfterPause && p.weightKg !== null) {
          // länger als 4 Wochen kein volles Gewicht → Wiedereinstiegs-Anzeige
          expect(p.isReturn).toBe(true);
          expect(p.weightKg).toBeLessThanOrEqual((result.progress.weightKg ?? 0) * 0.9 + 1e-9);
          expect(p.extraSet).toBe(false);
          returns += 1;
        } else if (last && p.weightKg !== null && lifted(last).length > 0) {
          const heaviest = Math.max(...lifted(last));
          if (placeOf[lastIndex] === place) {
            // gleicher Ort: gemessen an der letzten Einheit
            if (!bufferDone(last, heaviest) && !last.weightConfirmed) {
              expect(p.weightKg).toBeLessThanOrEqual(heaviest * (1 + DIRECT_STEP) + 1e-9);
              checked += 1;
            }
          } else {
            // Ortswechsel: nie > 10 % über dem schwersten gestemmten Satz der letzten 4 Wochen bzw. dem eigenen
            // Startgewicht (zurück im Studio: Studio-Stand); ist das volle Gewicht länger her → Wiedereinstieg
            const recent = entries.filter(
              (e) => daysBetween(e.performedOn, performedOn) <= PAUSE_DAYS,
            );
            const ref = Math.max(startWeightKg, ...recent.flatMap(lifted));
            const exception = entries.some(
              (e) => e.weightConfirmed || bufferDone(e, Math.max(0, ...lifted(e))),
            );
            if (!exception) {
              expect(p.weightKg).toBeLessThanOrEqual(ref * (1 + DIRECT_STEP) + 1e-9);
              checked += 1;
            }
          }
        }
        if (p.weightKg === null) break;
        // Was die Person macht: meist genau die Vorgabe, manchmal weniger Wdh., manchmal bestätigt schwerer
        const mode = r();
        const confirmed = mode < 0.05;
        const weight = confirmed ? Math.round(p.weightKg * 1.3 * 2) / 2 : p.weightKg;
        const reps =
          mode < 0.8 ? (p.targetReps ?? repsMin) : Math.max(1, (p.targetReps ?? repsMin) - 2);
        entries.push(
          buildExerciseLogEntry({
            exerciseId: 'x',
            performedOn,
            loggedAt: `${performedOn}T18:00:00Z`,
            status: 'done',
            loadType: 'weight',
            isIntroWeek: false,
            isDeload: false,
            progress: result,
            prescription: p,
            weightConfirmed: confirmed,
            sets: Array.from({ length: p.sets }, () => ({
              reps,
              weightKg: weight,
              durationS: null,
              rpe: null,
              done: true,
            })),
          }),
        );
        placeOf.push(place);
        // Ortswechsel
        if (r() < 0.3) {
          place = Math.floor(r() * places.length);
          steps = places[place] as number[];
        }
      }
      expect(checked).toBeGreaterThan(3);
    });
  }
});
