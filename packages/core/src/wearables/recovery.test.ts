import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { RECOVERY } from '../constants';
import { findTextRuleHits } from '../content/text-rules';
import { addDays } from '../dates';
import { aggregateDailyMetrics } from './daily';
import {
  hasRecoveryData,
  recoveryBaseline,
  recoveryOffer,
  type RecoveryDayInput,
  recoveryStatus,
  recoveryTrend,
} from './recovery';
import {
  RECOVERY_STATUS_LABEL_DE,
  RECOVERY_SUMMARY_DE,
  RECOVERY_TEXTS_DE,
  recoveryA11yDe,
  recoveryReasonsDe,
  recoverySignalDe,
  sleepDurationDe,
} from './recovery-texts-de';

const TODAY = '2026-10-25';
const ADULT = { age: 35 } as const;

/** 14 ruhige Tage vor heute (Schlaf 7:30, Ruhepuls 55, HRV 60 ms) plus der heutige Tag. */
function history(
  todayValues: Partial<Omit<RecoveryDayInput, 'day'>>,
  options: { days?: number; resting?: number; hrv?: number; sleep?: number } = {},
): RecoveryDayInput[] {
  const days = options.days ?? 14;
  const rows: RecoveryDayInput[] = Array.from({ length: days }, (_, i) => ({
    day: addDays(TODAY, -days + i),
    resting_hr_bpm: options.resting ?? 55,
    sleep_min: options.sleep ?? 450,
    hrv_rmssd_ms: options.hrv ?? 60,
  }));
  rows.push({
    day: TODAY,
    resting_hr_bpm: null,
    sleep_min: null,
    hrv_rmssd_ms: null,
    ...todayValues,
  });
  return rows;
}

const states = (rows: RecoveryDayInput[], options: Parameters<typeof recoveryStatus>[2] = ADULT) =>
  recoveryStatus(rows, TODAY, options).signals.map((s) => `${s.kind}:${s.state}`);

describe('recoveryStatus – Ampel', () => {
  it('alles im üblichen Bereich → gut', () => {
    const r = recoveryStatus(
      history({ sleep_min: 460, resting_hr_bpm: 56, hrv_rmssd_ms: 58 }),
      TODAY,
      ADULT,
    );
    expect(r.status).toBe('good');
    expect(r.flags).toBe(0);
    expect(r.evaluated).toBe(3);
    expect(r.learning).toBe(false);
    expect(r.signals.map((s) => s.baseline)).toEqual([360, 55, 60]);
  });

  it('ein auffälliger Wert → mittel (ein Wert allein nie niedrig)', () => {
    for (const today of [
      { sleep_min: 300, resting_hr_bpm: 55, hrv_rmssd_ms: 60 },
      { sleep_min: 450, resting_hr_bpm: 62, hrv_rmssd_ms: 60 },
      { sleep_min: 450, resting_hr_bpm: 55, hrv_rmssd_ms: 40 },
    ]) {
      const r = recoveryStatus(history(today), TODAY, ADULT);
      expect(r.status, JSON.stringify(today)).toBe('medium');
      expect(r.flags).toBe(1);
    }
  });

  it('zwei oder drei auffällige Werte → niedrig', () => {
    expect(
      recoveryStatus(
        history({ sleep_min: 310, resting_hr_bpm: 61, hrv_rmssd_ms: 60 }),
        TODAY,
        ADULT,
      ).status,
    ).toBe('low');
    const all = recoveryStatus(
      history({ sleep_min: 310, resting_hr_bpm: 62, hrv_rmssd_ms: 45 }),
      TODAY,
      ADULT,
    );
    expect(all.status).toBe('low');
    expect(all.flags).toBe(3);
  });

  it('Schwellen genau auf der Grenze', () => {
    // Schlaf: genau 6 h ist nicht auffällig, 5:59 schon.
    expect(states(history({ sleep_min: 360 }))[0]).toBe('sleep:ok');
    expect(states(history({ sleep_min: 359 }))[0]).toBe('sleep:flag');
    // Ruhepuls: Basis 55 → ab 60 auffällig, 59 nicht.
    expect(states(history({ resting_hr_bpm: 59 }))[1]).toBe('resting_hr:ok');
    expect(states(history({ resting_hr_bpm: 60 }))[1]).toBe('resting_hr:flag');
    // HRV: Basis 60 → ab 48 (80 %) auffällig, 49 nicht.
    expect(states(history({ hrv_rmssd_ms: 49 }))[2]).toBe('hrv:ok');
    expect(states(history({ hrv_rmssd_ms: 48 }))[2]).toBe('hrv:flag');
  });

  it('niedrigerer Ruhepuls bzw. höhere HRV als üblich sind nie auffällig', () => {
    const r = recoveryStatus(
      history({ sleep_min: 600, resting_hr_bpm: 44, hrv_rmssd_ms: 140 }),
      TODAY,
      ADULT,
    );
    expect(r.status).toBe('good');
  });

  it('unter 18 Jahren: Schlaf-Schwelle 7 h; ab 18: 6 h', () => {
    const rows = history({ sleep_min: 400 });
    expect(states(rows, { age: 16 })[0]).toBe('sleep:flag');
    expect(states(rows, { age: 17 })[0]).toBe('sleep:flag');
    expect(states(rows, { age: 18 })[0]).toBe('sleep:ok');
    expect(states(rows, { age: 90 })[0]).toBe('sleep:ok');
    expect(states(rows, { age: null })[0]).toBe('sleep:ok');
    expect(recoveryStatus(rows, TODAY, { age: 16 }).signals[0]?.baseline).toBe(420);
  });
});

describe('recoveryStatus – fehlende und unvollständige Daten', () => {
  it('keine Zeilen → keine Einschätzung', () => {
    const r = recoveryStatus([], TODAY, ADULT);
    expect(r.status).toBe('unknown');
    expect(r.evaluated).toBe(0);
    expect(r.signals.map((s) => s.state)).toEqual(['no_data', 'no_data', 'no_data']);
    expect(hasRecoveryData([])).toBe(false);
  });

  it('nur Schritte (keine Erholungswerte) → keine Einschätzung', () => {
    const rows = [{ day: TODAY, resting_hr_bpm: null, sleep_min: null, hrv_rmssd_ms: null }];
    expect(recoveryStatus(rows, TODAY, ADULT).status).toBe('unknown');
    expect(hasRecoveryData(rows)).toBe(false);
  });

  it('nur Schlaf (ohne Uhr-Puls) → bewertbar, höchstens mittel', () => {
    const rows: RecoveryDayInput[] = [
      { day: TODAY, sleep_min: 240, resting_hr_bpm: null, hrv_rmssd_ms: null },
    ];
    const r = recoveryStatus(rows, TODAY, ADULT);
    expect(r.status).toBe('medium');
    expect(r.evaluated).toBe(1);
    expect(hasRecoveryData(rows)).toBe(true);
  });

  it('kein HRV (Samsung schreibt es evtl. nicht) → Schlaf + Ruhepuls reichen für niedrig', () => {
    const rows = history({ sleep_min: 300, resting_hr_bpm: 63 }).map((r) => ({
      ...r,
      hrv_rmssd_ms: null,
    }));
    const r = recoveryStatus(rows, TODAY, ADULT);
    expect(r.signals[2]?.state).toBe('no_data');
    expect(r.status).toBe('low');
  });

  it('heute noch kein Wert, aber Verlauf da → keine Einschätzung (nie aus gestern)', () => {
    expect(recoveryStatus(history({}), TODAY, ADULT).status).toBe('unknown');
  });

  it('Basis mit weniger als 7 Tagen → „wir lernen noch“, Ruhepuls/HRV zählen nicht', () => {
    const rows = history({ sleep_min: 450, resting_hr_bpm: 70, hrv_rmssd_ms: 20 }, { days: 6 });
    const r = recoveryStatus(rows, TODAY, ADULT);
    expect(r.signals.map((s) => s.state)).toEqual(['ok', 'no_baseline', 'no_baseline']);
    expect(r.learning).toBe(true);
    expect(r.status).toBe('good');
    expect(r.signals[1]?.baselineValues).toBe(6);
  });

  it('genau 7 Werte reichen für eine Basis', () => {
    const rows = history({ resting_hr_bpm: 70 }, { days: 7 });
    expect(states(rows)[1]).toBe('resting_hr:flag');
  });

  it('nur Werte älter als 14 Tage zählen nicht zur Basis', () => {
    const old = Array.from({ length: 10 }, (_, i) => ({
      day: addDays(TODAY, -30 + i),
      resting_hr_bpm: 50,
      sleep_min: 450,
      hrv_rmssd_ms: 60,
    }));
    const rows = [...old, { day: TODAY, resting_hr_bpm: 70, sleep_min: 450, hrv_rmssd_ms: 30 }];
    const r = recoveryStatus(rows, TODAY, ADULT);
    expect(r.signals[1]?.state).toBe('no_baseline');
    expect(r.signals[1]?.baselineValues).toBe(0);
    expect(r.status).toBe('good');
  });

  it('der Tag selbst und spätere Tage zählen nie zur Basis', () => {
    const rows = history({ resting_hr_bpm: 70 }, { days: 7 });
    // Spätere (Zukunfts-)Werte dürfen nichts ändern.
    rows.push({ day: addDays(TODAY, 1), resting_hr_bpm: 90, sleep_min: 100, hrv_rmssd_ms: 5 });
    const base = recoveryBaseline(new Map(rows.map((r) => [r.day, r.resting_hr_bpm ?? 0])), TODAY);
    expect(base).toEqual({ value: 55, count: 7 });
  });
});

describe('recoveryStatus – Ausreißer und Plausibilität', () => {
  it('Median: einzelne Ausreißer in der Basis verschieben sie nicht', () => {
    const rows = history({ resting_hr_bpm: 61 });
    // Zwei Messfehler-Tage (plausibel, aber extrem) in der Basis.
    rows[2] = { ...(rows[2] as RecoveryDayInput), resting_hr_bpm: 110 };
    rows[5] = { ...(rows[5] as RecoveryDayInput), resting_hr_bpm: 31 };
    const r = recoveryStatus(rows, TODAY, ADULT);
    expect(r.signals[1]?.baseline).toBe(55);
    expect(r.signals[1]?.state).toBe('flag');
  });

  it('unplausible Werte zählen als fehlend (heute und in der Basis)', () => {
    const rows = history({ resting_hr_bpm: 250, hrv_rmssd_ms: 2, sleep_min: 1500 });
    rows[0] = { ...(rows[0] as RecoveryDayInput), resting_hr_bpm: 10, hrv_rmssd_ms: 900 };
    const r = recoveryStatus(rows, TODAY, ADULT);
    expect(r.signals.map((s) => s.state)).toEqual(['no_data', 'no_data', 'no_data']);
    expect(r.signals[1]?.baselineValues).toBe(13);
    expect(r.status).toBe('unknown');
  });

  it('Schlaf unter 2 h zählt nicht als Nacht (Mittagsschlaf, Uhr abgelegt)', () => {
    expect(states(history({ sleep_min: 90 }))[0]).toBe('sleep:no_data');
    expect(states(history({ sleep_min: 120 }))[0]).toBe('sleep:flag');
  });

  it('mehrere Zeilen am selben Tag (zwei Quellen) → Median, nie addiert', () => {
    const rows = history({});
    rows.push(
      { day: TODAY, resting_hr_bpm: 58, sleep_min: 300, hrv_rmssd_ms: null },
      { day: TODAY, resting_hr_bpm: 64, sleep_min: 340, hrv_rmssd_ms: null },
    );
    const r = recoveryStatus(rows, TODAY, ADULT);
    expect(r.signals[0]?.value).toBe(320);
    expect(r.signals[1]?.value).toBe(61);
  });

  it('nicht-endliche Werte werden verworfen', () => {
    const rows = history({ resting_hr_bpm: Number.NaN, sleep_min: Number.POSITIVE_INFINITY });
    expect(recoveryStatus(rows, TODAY, ADULT).signals[0]?.state).toBe('no_data');
    expect(recoveryStatus(rows, TODAY, ADULT).signals[1]?.state).toBe('no_data');
  });
});

describe('recoveryStatus – Medikamente', () => {
  it('Ruhepuls und HRV zählen nicht, nur der Schlaf (höchstens mittel)', () => {
    const rows = history({ sleep_min: 300, resting_hr_bpm: 70, hrv_rmssd_ms: 30 });
    const r = recoveryStatus(rows, TODAY, { age: 50, ignoreHeartValues: true });
    expect(r.signals.map((s) => s.state)).toEqual(['flag', 'ignored', 'ignored']);
    expect(r.status).toBe('medium');
    expect(r.evaluated).toBe(1);
  });
});

describe('recoveryTrend', () => {
  it('7 Tage, älteste zuerst, je Tag mit eigener Basis', () => {
    const rows: RecoveryDayInput[] = Array.from({ length: 21 }, (_, i) => ({
      day: addDays(TODAY, -20 + i),
      resting_hr_bpm: 55,
      sleep_min: 450,
      hrv_rmssd_ms: 60,
    }));
    // Vorgestern: kurz geschlafen; heute: kurz + Ruhepuls hoch.
    rows[18] = { ...(rows[18] as RecoveryDayInput), sleep_min: 300 };
    rows[20] = { ...(rows[20] as RecoveryDayInput), sleep_min: 300, resting_hr_bpm: 62 };
    const trend = recoveryTrend(rows, TODAY, ADULT);
    expect(trend).toHaveLength(RECOVERY.trendDays);
    expect(trend[0]?.day).toBe(addDays(TODAY, -6));
    expect(trend[6]?.day).toBe(TODAY);
    expect(trend.map((t) => t.status)).toEqual([
      'good',
      'good',
      'good',
      'good',
      'medium',
      'good',
      'low',
    ]);
  });

  it('ohne Daten: 7 × keine Einschätzung', () => {
    expect(recoveryTrend([], TODAY, ADULT).map((t) => t.status)).toEqual(Array(7).fill('unknown'));
  });
});

describe('recoveryOffer – nie Pflicht, nur mit Live-Anpassung', () => {
  it('nur niedrig + offene Einheit heute + berechtigt → „leichter“', () => {
    expect(recoveryOffer({ status: 'low', plannedSessionOpenToday: true, entitled: true })).toBe(
      'lighter',
    );
    for (const status of ['good', 'medium', 'unknown'] as const) {
      expect(recoveryOffer({ status, plannedSessionOpenToday: true, entitled: true })).toBe(
        'as_planned',
      );
    }
    expect(recoveryOffer({ status: 'low', plannedSessionOpenToday: false, entitled: true })).toBe(
      'as_planned',
    );
    // Gratis (ohne Live-Anpassung): Status sichtbar, aber kein Angebot.
    expect(recoveryOffer({ status: 'low', plannedSessionOpenToday: true, entitled: false })).toBe(
      'as_planned',
    );
  });
});

describe('aggregateDailyMetrics – HRV', () => {
  it('Median je Tag (Europe/Berlin), gerundet, nur 5–300 ms', () => {
    const days = aggregateDailyMetrics({
      heartRateVariabilities: [
        { time: '2026-10-25T01:00:00Z', rmssdMs: 40 },
        { time: '2026-10-25T02:00:00Z', rmssdMs: 51 },
        { time: '2026-10-25T03:00:00Z', rmssdMs: 47 },
        { time: '2026-10-25T03:30:00Z', rmssdMs: 900 },
        { time: '2026-10-24T22:30:00Z', rmssdMs: 4 },
        { time: 'kaputt', rmssdMs: 50 },
      ],
    });
    expect(days).toEqual([
      { day: '2026-10-25', resting_hr_bpm: null, sleep_min: null, steps: null, hrv_rmssd_ms: 47 },
    ]);
  });

  it('Messung kurz vor Mitternacht (UTC) gehört zum Berliner Folgetag', () => {
    const days = aggregateDailyMetrics({
      heartRateVariabilities: [{ time: '2026-10-24T22:30:00Z', rmssdMs: 55.4 }],
    });
    expect(days[0]?.day).toBe('2026-10-25');
    expect(days[0]?.hrv_rmssd_ms).toBe(55);
  });
});

describe('Texte (neutral, keine medizinischen Begriffe)', () => {
  const r = recoveryStatus(
    history({ sleep_min: 310, resting_hr_bpm: 62, hrv_rmssd_ms: 45 }),
    TODAY,
    ADULT,
  );

  it('Gründe, Ansage und Sätze je Wert', () => {
    expect(recoveryReasonsDe(r)).toEqual(['Schlaf kurz', 'Ruhepuls erhöht', 'HRV niedriger']);
    expect(recoveryA11yDe(r)).toBe(
      'Erholung heute: niedrig. Schlaf kurz, Ruhepuls erhöht, HRV niedriger.',
    );
    expect(r.signals.map(recoverySignalDe)).toEqual([
      'Schlaf: 5 Std. 10 Min. – kürzer als 6 Std.',
      'Ruhepuls: 62 /min (7 über deinem Üblichen).',
      'HRV: 45 ms (25 % unter deinem Üblichen).',
    ]);
    expect(sleepDurationDe(420)).toBe('7 Std.');
    expect(RECOVERY_SUMMARY_DE.low).toBe('Deine Werte sprechen für einen leichteren Tag.');
  });

  it('keine Wörter aus FORBIDDEN_MEDICAL_TERMS', () => {
    const all = [
      ...Object.values(RECOVERY_STATUS_LABEL_DE),
      ...Object.values(RECOVERY_SUMMARY_DE),
      ...Object.values(RECOVERY_TEXTS_DE).flatMap((v) =>
        typeof v === 'function' ? [v(24, 30)] : Array.isArray(v) ? v : [v],
      ),
      ...r.signals.map(recoverySignalDe),
      recoveryA11yDe(r),
    ];
    for (const text of all) expect(findTextRuleHits(text), text).toEqual([]);
    // Zusätzlich (Plan 8B 4.8): keine Begriffe wie Übertraining, Infekt, Stress-Level, Schlafstörung.
    for (const text of all) {
      expect(text, text).not.toMatch(/übertrain|infekt|stress|störung|krank|warnung/i);
    }
  });
});

describe('Struktur', () => {
  it('wearables/ importiert nie aus cycle/ (Erholung liest keine Zyklusdaten)', () => {
    const dir = fileURLToPath(new URL('.', import.meta.url));
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
      expect(readFileSync(`${dir}/${name}`, 'utf8'), name).not.toMatch(/from ['"]\.\.\/cycle/);
    }
  });
});
