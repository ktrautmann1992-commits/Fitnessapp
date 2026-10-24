import { describe, expect, it } from 'vitest';

import { SESSION_KCAL, TRAINING_MET } from '../constants';
import {
  sessionCalories,
  type SessionCaloriesInput,
  sessionCaloriesForLog,
  sessionCaloriesTotal,
  sessionCaloriesVisibility,
  sessionLogDurationS,
} from './session-calories';

const RUN: SessionCaloriesInput = {
  kind: 'endurance',
  enduranceModality: 'run',
  effortTarget: null,
  durationS: 3600,
  bodyWeightKg: 70,
  measuredKcal: null,
};
const STRENGTH: SessionCaloriesInput = {
  kind: 'strength',
  enduranceModality: null,
  effortTarget: null,
  durationS: 3600,
  bodyWeightKg: 80,
  measuredKcal: null,
};

describe('sessionCalories – Schätzung brutto MET × kg × h', () => {
  it('Kraft 60 min, 80 kg → 3,5 × 80 = 280 kcal (Quelle Schätzung)', () => {
    expect(sessionCalories(STRENGTH)).toEqual({
      kcal: 280,
      source: 'estimate',
      reason: null,
      met: TRAINING_MET.strength,
    });
  });

  it('Laufen ohne Intensität nimmt den höheren Wert (7,0): 60 min, 70 kg → 490 kcal', () => {
    expect(sessionCalories(RUN).kcal).toBe(490);
  });

  it('Laufen „sehr locker“ (effort 1–2) nimmt den niedrigeren Wert: 6,0 × 70 = 420', () => {
    expect(sessionCalories({ ...RUN, effortTarget: 2 }).kcal).toBe(420);
    expect(sessionCalories({ ...RUN, effortTarget: 3 }).kcal).toBe(490);
  });

  it('Kraft ignoriert eine Sportart', () => {
    expect(sessionCalories({ ...STRENGTH, enduranceModality: 'run' }).kcal).toBe(280);
  });

  it('unbekannte Sportart (null) → TRAINING_MET.unknownEndurance (7,0)', () => {
    const result = sessionCalories({ ...RUN, enduranceModality: null });
    expect(result).toMatchObject({
      kcal: 490,
      source: 'estimate',
      met: TRAINING_MET.unknownEndurance,
    });
  });

  it('nicht vorgesehene Sportart wird abgewiesen (Zod)', () => {
    expect(() =>
      sessionCalories({ ...RUN, enduranceModality: 'ski' as unknown as 'run' }),
    ).toThrow();
  });

  it('Gehen zügig 60 min, 70 kg → 4,3 × 70 = 301 → 300 (auf 5 gerundet)', () => {
    expect(sessionCalories({ ...RUN, enduranceModality: 'walk' }).kcal).toBe(300);
  });
});

describe('sessionCalories – Grenzfälle Dauer', () => {
  it('1 Minute Laufen, 70 kg → 8,2 → 10 kcal', () => {
    expect(sessionCalories({ ...RUN, durationS: 60 }).kcal).toBe(10);
  });

  it('unter 1 Minute → keine Zahl (no_duration)', () => {
    expect(sessionCalories({ ...RUN, durationS: 59 })).toEqual({
      kcal: null,
      source: null,
      reason: 'no_duration',
    });
  });

  it('4 Stunden Laufen, 70 kg → 1.960 kcal', () => {
    expect(sessionCalories({ ...RUN, durationS: 4 * 3600 }).kcal).toBe(1960);
  });

  it('über 8 Stunden (z. B. nicht beendet) → keine Zahl', () => {
    expect(sessionCalories({ ...STRENGTH, durationS: SESSION_KCAL.maxDurationS + 1 }).reason).toBe(
      'no_duration',
    );
  });

  it('Dauer unbekannt → keine Zahl', () => {
    expect(sessionCalories({ ...RUN, durationS: null }).reason).toBe('no_duration');
  });

  it('Pausen werden abgezogen: 60 min mit 30 min Pause → 245 kcal', () => {
    expect(sessionCalories({ ...RUN, pausedS: 1800 }).kcal).toBe(245);
  });

  it('Pause länger als die Dauer → keine Zahl', () => {
    expect(sessionCalories({ ...RUN, pausedS: 4000 }).reason).toBe('no_duration');
  });

  it('sehr kurze leichte Einheit rundet nie auf 0 (mindestens 5 kcal)', () => {
    const result = sessionCalories({
      ...RUN,
      enduranceModality: 'walk',
      effortTarget: 1,
      bodyWeightKg: 30,
      durationS: 60,
    });
    expect(result.kcal).toBe(5);
  });
});

describe('sessionCalories – Grenzfälle Gewicht', () => {
  it('40 kg, 30 min lockeres Laufen → 6,0 × 40 × 0,5 = 120', () => {
    expect(
      sessionCalories({ ...RUN, bodyWeightKg: 40, effortTarget: 1, durationS: 1800 }).kcal,
    ).toBe(120);
  });

  it('200 kg, 4 h Laufen → 5.600 kcal (unter dem Deckel)', () => {
    expect(sessionCalories({ ...RUN, bodyWeightKg: 200, durationS: 4 * 3600 }).kcal).toBe(5600);
  });

  it('300 kg, 8 h Laufen → gedeckelt auf SESSION_KCAL.maxKcal', () => {
    expect(
      sessionCalories({ ...RUN, bodyWeightKg: 300, durationS: SESSION_KCAL.maxDurationS }).kcal,
    ).toBe(SESSION_KCAL.maxKcal);
  });

  it('ohne Körpergewicht (keine Einwilligung) → keine Zahl, Grund no_weight', () => {
    expect(sessionCalories({ ...RUN, bodyWeightKg: null })).toEqual({
      kcal: null,
      source: null,
      reason: 'no_weight',
    });
  });

  it('unplausibles Gewicht wird abgewiesen (Zod)', () => {
    expect(() => sessionCalories({ ...RUN, bodyWeightKg: 20 })).toThrow();
    expect(() => sessionCalories({ ...RUN, bodyWeightKg: 400 })).toThrow();
  });
});

describe('sessionCalories – Wert der Uhr', () => {
  it('Uhr-Wert geht vor, gerundet auf 5 – auch ohne Gewicht', () => {
    expect(sessionCalories({ ...RUN, measuredKcal: 412, bodyWeightKg: null })).toEqual({
      kcal: 410,
      source: 'watch',
      reason: null,
    });
  });

  it('Uhr-Wert 0 gilt als „keine Messung“ → Schätzung', () => {
    expect(sessionCalories({ ...RUN, measuredKcal: 0 }).source).toBe('estimate');
  });

  it('Uhr-Wert über dem Deckel wird gedeckelt', () => {
    expect(sessionCalories({ ...RUN, measuredKcal: 9000 }).kcal).toBe(SESSION_KCAL.maxKcal);
  });

  it('negative Uhr-Werte werden abgewiesen', () => {
    expect(() => sessionCalories({ ...RUN, measuredKcal: -5 })).toThrow();
  });
});

describe('sessionCaloriesVisibility', () => {
  it('„Kalorienzahlen anzeigen“ aus → hidden', () => {
    expect(
      sessionCaloriesVisibility({
        showEnergyNumbers: false,
        pregnancy: false,
        healthConsent: 'valid',
      }),
    ).toBe('hidden');
  });

  it('Schwangerschaft → hidden (keine Energie-Zahlen)', () => {
    expect(
      sessionCaloriesVisibility({
        showEnergyNumbers: true,
        pregnancy: true,
        healthConsent: 'valid',
      }),
    ).toBe('hidden');
  });

  it('ohne bzw. mit veralteter Einwilligung → needs_consent', () => {
    expect(
      sessionCaloriesVisibility({
        showEnergyNumbers: true,
        pregnancy: false,
        healthConsent: 'none',
      }),
    ).toBe('needs_consent');
    expect(
      sessionCaloriesVisibility({
        showEnergyNumbers: true,
        pregnancy: false,
        healthConsent: 'outdated',
      }),
    ).toBe('needs_consent');
  });

  it('mit Einwilligung → show', () => {
    expect(
      sessionCaloriesVisibility({
        showEnergyNumbers: true,
        pregnancy: false,
        healthConsent: 'valid',
      }),
    ).toBe('show');
  });
});

describe('Tagebuch-Eintrag → kcal', () => {
  const LOG = {
    kind: 'strength' as const,
    started_at: '2026-10-20T17:00:00.000Z',
    finished_at: '2026-10-20T17:45:00.000Z',
  };

  it('Kraft: Dauer aus Beginn und Ende', () => {
    expect(sessionLogDurationS({ log: LOG, cardio: null, planned: null })).toBe(2700);
  });

  it('Kraft ohne Zeiten: geplante Minuten', () => {
    expect(
      sessionLogDurationS({
        log: { ...LOG, started_at: null, finished_at: null },
        cardio: null,
        planned: { endurance_modality: null, effort_target: null, estimated_minutes: 50 },
      }),
    ).toBe(3000);
  });

  it('Kraft ohne Zeiten und ohne Plan (nachgetragen): keine Dauer', () => {
    expect(
      sessionLogDurationS({
        log: { ...LOG, started_at: null, finished_at: null },
        cardio: null,
        planned: null,
      }),
    ).toBeNull();
  });

  it('Ende vor Beginn gilt nicht', () => {
    expect(
      sessionLogDurationS({
        log: { ...LOG, finished_at: '2026-10-20T16:00:00.000Z' },
        cardio: null,
        planned: null,
      }),
    ).toBeNull();
  });

  it('Ausdauer: Dauer und Sportart aus dem Eintrag, Intensität aus dem Plan', () => {
    const result = sessionCaloriesForLog({
      log: { kind: 'endurance', started_at: null, finished_at: null },
      cardio: { modality: 'bike', duration_s: 3600 },
      planned: { endurance_modality: 'run', effort_target: 1, estimated_minutes: 30 },
      bodyWeightKg: 70,
      measuredKcal: null,
    });
    // Rad „sehr locker“ 5,5 × 70 = 385
    expect(result).toMatchObject({ kcal: 385, source: 'estimate' });
  });

  it('Kraft 45 min, 80 kg → 210 kcal', () => {
    expect(
      sessionCaloriesForLog({
        log: LOG,
        cardio: null,
        planned: null,
        bodyWeightKg: 80,
        measuredKcal: null,
      }).kcal,
    ).toBe(210);
  });
});

describe('E-Bike (TRAINING_MET.eBike, Compendium 2024 01084/01088)', () => {
  const BIKE: SessionCaloriesInput = { ...RUN, enduranceModality: 'bike' };

  it('E-Bike ohne Intensität 6,0 × 70 = 420 < Fahrrad 6,8 × 70 = 476 → 475', () => {
    expect(sessionCalories(BIKE)).toMatchObject({ kcal: 475, met: 6.8 });
    expect(sessionCalories({ ...BIKE, eBike: true })).toMatchObject({
      kcal: 420,
      met: TRAINING_MET.eBike.fallback,
    });
  });

  it('E-Bike „sehr locker“ (effort 1–2) 4,0, „locker“ (3–4) 6,0', () => {
    expect(sessionCalories({ ...BIKE, eBike: true, effortTarget: 1 }).kcal).toBe(280);
    expect(sessionCalories({ ...BIKE, eBike: true, effortTarget: 4 }).kcal).toBe(420);
  });

  it('jede Stufe E-Bike liegt unter der gleichen Stufe Fahrrad', () => {
    for (const effortTarget of [null, 1, 2, 3, 4]) {
      const bike = sessionCalories({ ...BIKE, effortTarget }).kcal ?? 0;
      const eBike = sessionCalories({ ...BIKE, eBike: true, effortTarget }).kcal ?? 0;
      expect(eBike, String(effortTarget)).toBeLessThan(bike);
    }
  });

  it('E-Bike gilt nur beim Rad (Laufen, Kraft, unbekannte Sportart unverändert)', () => {
    expect(sessionCalories({ ...RUN, eBike: true }).kcal).toBe(490);
    expect(sessionCalories({ ...STRENGTH, eBike: true }).kcal).toBe(280);
    expect(sessionCalories({ ...RUN, enduranceModality: null, eBike: true }).kcal).toBe(490);
  });

  it('Grenzfälle Gewicht und Dauer: 40 kg 1 min, 250 kg 8 h (Deckel)', () => {
    expect(sessionCalories({ ...BIKE, eBike: true, bodyWeightKg: 40, durationS: 60 }).kcal).toBe(5);
    expect(
      sessionCalories({ ...BIKE, eBike: true, bodyWeightKg: 250, durationS: 8 * 3600 }).kcal,
    ).toBe(SESSION_KCAL.maxKcal);
  });

  it('Uhr-Wert geht auch beim E-Bike vor', () => {
    expect(sessionCalories({ ...BIKE, eBike: true, measuredKcal: 512 })).toMatchObject({
      kcal: 510,
      source: 'watch',
    });
  });

  it('Tagebuch-Eintrag mit cardio.e_bike → E-Bike-MET; fehlendes Feld (ältere Zeile) → Fahrrad', () => {
    const base = {
      log: { kind: 'endurance' as const, started_at: null, finished_at: null },
      planned: null,
      bodyWeightKg: 70,
      measuredKcal: null,
    };
    expect(
      sessionCaloriesForLog({
        ...base,
        cardio: { modality: 'bike', duration_s: 3600, e_bike: true },
      }).kcal,
    ).toBe(420);
    expect(
      sessionCaloriesForLog({ ...base, cardio: { modality: 'bike', duration_s: 3600 } }).kcal,
    ).toBe(475);
    // Fehlerhafte Zeile (E-Bike beim Laufen) zählt wie Laufen.
    expect(
      sessionCaloriesForLog({
        ...base,
        cardio: { modality: 'run', duration_s: 3600, e_bike: true },
      }).kcal,
    ).toBe(490);
  });
});

describe('sessionCaloriesTotal', () => {
  it('summiert nur Einheiten mit Zahl', () => {
    expect(
      sessionCaloriesTotal([
        sessionCalories(STRENGTH),
        sessionCalories({ ...RUN, bodyWeightKg: null }),
        sessionCalories({ ...RUN, measuredKcal: 300 }),
      ]),
    ).toEqual({ kcal: 580, allFromWatch: false });
  });

  it('keine Zahl → null', () => {
    expect(sessionCaloriesTotal([sessionCalories({ ...RUN, bodyWeightKg: null })])).toBeNull();
    expect(sessionCaloriesTotal([])).toBeNull();
  });

  it('alle von der Uhr → allFromWatch', () => {
    expect(sessionCaloriesTotal([sessionCalories({ ...RUN, measuredKcal: 300 })])).toEqual({
      kcal: 300,
      allFromWatch: true,
    });
  });
});
