import { describe, expect, it } from 'vitest';

import { nutritionSessionSchema } from './schemas';
import {
  activityFactor,
  bmrForFloor,
  bmrForNeeds,
  bmrKatchMcArdle,
  bmrMifflinStJeor,
  dayEnergy,
  estimateFatFreeMass,
  fatFreeMassFromBodyFat,
  isBodyFatUsable,
  metForSession,
  sessionsForDay,
  trainingEnergy,
} from './energy';
import { janmahasatian, katch, mifflin, PLAN, session, sessionMet } from './test-helpers';

const parse = (s: unknown) => nutritionSessionSchema.parse(s);

describe('Grundumsatz (4.3)', () => {
  it('Mifflin-St Jeor je Geschlecht (+5 / −161 / −78 Mittelwert)', () => {
    expect(bmrMifflinStJeor({ weightKg: 80, heightCm: 180, ageYears: 30, sex: 'male' })).toBe(1780);
    expect(bmrMifflinStJeor({ weightKg: 100, heightCm: 170, ageYears: 30, sex: 'female' })).toBe(
      1751.5,
    );
    expect(bmrMifflinStJeor({ weightKg: 80, heightCm: 180, ageYears: 30, sex: 'diverse' })).toBe(
      1697,
    );
    expect(bmrMifflinStJeor({ weightKg: 80, heightCm: 180, ageYears: 30, sex: null })).toBe(1697);
    expect(
      bmrMifflinStJeor({ weightKg: 80, heightCm: 180, ageYears: 30, sex: 'unspecified' }),
    ).toBe((1780 + (1780 - 166)) / 2);
  });

  it('für die Grenzen: divers/keine Angabe mit männlichem Offset +5 und Männer-FFM (Wächter N1, S1)', () => {
    for (const sex of ['diverse', 'unspecified', null] as const) {
      expect(bmrMifflinStJeor({ weightKg: 80, heightCm: 180, ageYears: 36, sex }, 'limits')).toBe(
        1750,
      );
      expect(estimateFatFreeMass({ weightKg: 80, heightCm: 180, sex }, 'limits')).toBeCloseTo(
        janmahasatian(80, 180, 'male'),
        9,
      );
    }
    expect(
      bmrMifflinStJeor({ weightKg: 80, heightCm: 180, ageYears: 36, sex: 'female' }, 'limits'),
    ).toBe(1584);
    expect(() =>
      bmrMifflinStJeor({ weightKg: 80, heightCm: 180, ageYears: Number.NaN, sex: null }),
    ).toThrow();
  });

  it('Grenzfälle aus 12.1: 45 kg/150 cm Frau 25 J. = 1.101,5; 200 kg/190 cm Mann 60 J. = 2.892,5', () => {
    expect(bmrMifflinStJeor({ weightKg: 45, heightCm: 150, ageYears: 25, sex: 'female' })).toBe(
      1101.5,
    );
    expect(bmrMifflinStJeor({ weightKg: 200, heightCm: 190, ageYears: 60, sex: 'male' })).toBe(
      2892.5,
    );
  });

  it('Katch-McArdle und fettfreie Masse (Rechenbeispiel R2-B1: FFM 50 kg → 1.450)', () => {
    expect(fatFreeMassFromBodyFat(100, 50)).toBe(50);
    expect(bmrKatchMcArdle(50)).toBe(1450);
    expect(bmrKatchMcArdle(fatFreeMassFromBodyFat(80, 3))).toBeCloseTo(katch(80, 3), 9);
  });

  it('bmrForNeeds = Katch, wenn zulässig; bmrForFloor = max(Mifflin, Katch) (B3)', () => {
    expect(bmrForNeeds(1751.5, 1450)).toBe(1450);
    expect(bmrForNeeds(1751.5, null)).toBe(1751.5);
    expect(bmrForFloor(1751.5, 1450)).toBe(1751.5);
    expect(bmrForFloor(1700, 1900)).toBe(1900);
    expect(bmrForFloor(1700, null)).toBe(1700);
  });

  it('Janmahasatian 2005 (Rechenbeispiel: Frau 100 kg/170 cm → 53,82 kg)', () => {
    expect(estimateFatFreeMass({ weightKg: 100, heightCm: 170, sex: 'female' })).toBeCloseTo(
      53.82,
      2,
    );
    for (const sex of ['male', 'female', 'diverse', null] as const) {
      expect(estimateFatFreeMass({ weightKg: 70, heightCm: 175, sex })).toBeCloseTo(
        janmahasatian(70, 175, sex),
        9,
      );
    }
  });

  it('Körperfett nur bis 90 Tage alt (89/90/91 Tage, W3); spätere Messung zählt an diesem Tag nicht', () => {
    const bodyFat = { value: 20, measuredOn: '2026-07-14' };
    expect(isBodyFatUsable(bodyFat, '2026-10-11')).toBe(true); // 89 Tage
    expect(isBodyFatUsable(bodyFat, '2026-10-12')).toBe(true); // 90 Tage
    expect(isBodyFatUsable(bodyFat, '2026-10-13')).toBe(false); // 91 Tage
    expect(isBodyFatUsable(bodyFat, '2026-07-13')).toBe(false);
    expect(isBodyFatUsable(null, '2026-10-12')).toBe(false);
  });
});

describe('Alltagsfaktor (4.4, S1)', () => {
  it('Mitte der D-A-CH-Spannen, ohne Angabe 1,45', () => {
    for (const [level, factor] of Object.entries(PLAN.factor)) {
      expect(activityFactor(level as 'sedentary')).toBe(factor);
    }
    expect(activityFactor(null)).toBe(1.45);
  });
});

describe('MET-Zuordnung lückenlos (S11b, W8)', () => {
  it('effort_target 1, 2, 3, 4 und fehlend je Sportart; Kraft 3,5; unbekannte Sportart 7,0', () => {
    for (const modality of ['run', 'walk', 'bike', 'swim'] as const) {
      for (const effortTarget of [1, 2, 3, 4, null]) {
        const s = { kind: 'endurance' as const, enduranceModality: modality, effortTarget };
        expect(metForSession(s)).toBe(sessionMet(s));
      }
      // Ersatzwert = der höhere Wert (sichere Richtung)
      expect(
        metForSession({ kind: 'endurance', enduranceModality: modality, effortTarget: null }),
      ).toBe(PLAN.met[modality][1]);
    }
    expect(metForSession({ kind: 'strength', enduranceModality: null, effortTarget: null })).toBe(
      3.5,
    );
    expect(metForSession({ kind: 'endurance', enduranceModality: null, effortTarget: 3 })).toBe(7);
  });
});

describe('Trainingsenergie (4.4)', () => {
  it('netto (MET − 1) × kg × h, brutto MET × kg × h', () => {
    const e = trainingEnergy([parse(session('2026-10-12', { minutes: 60 }))], 80);
    expect(e.netKcal).toBeCloseTo(2.5 * 80, 9);
    expect(e.grossKcal).toBeCloseTo(3.5 * 80, 9);
    expect(e.capped).toBe(false);
    expect(e.minutes).toBe(60);
  });

  it('Ruhetag = 0', () => {
    expect(trainingEnergy([], 80)).toMatchObject({ netKcal: 0, grossKcal: 0, capped: false });
  });

  it('Deckel 3.000 kcal (300 kg × 240 min Laufen = 7.200 kcal), brutto bleibt ungedeckelt', () => {
    const s = parse(
      session('2026-10-12', {
        kind: 'endurance',
        enduranceModality: 'run',
        effortTarget: 3,
        minutes: 240,
      }),
    );
    const e = trainingEnergy([s], 300);
    expect(e.netUncappedKcal).toBeCloseTo(7200, 9);
    expect(e.netKcal).toBe(PLAN.trainingMax);
    expect(e.capped).toBe(true);
    expect(e.grossKcal).toBeCloseTo(8400, 9);
  });

  it('genau am Deckel greift er nicht (3.000 kcal)', () => {
    // 6 × 125 kg × 4 h = 3.000
    const s = parse(
      session('2026-10-12', {
        kind: 'endurance',
        enduranceModality: 'run',
        effortTarget: 3,
        minutes: 240,
      }),
    );
    expect(trainingEnergy([s], 125)).toMatchObject({ netKcal: 3000, capped: false });
  });
});

describe('Welche Einheiten zählen (S11a, R2-K3, W8)', () => {
  const today = '2026-10-14';
  const replacedDone = parse(
    session('2026-10-13', { planId: 'old', planStatus: 'replaced', status: 'completed' }),
  );
  const activePlannedPast = parse(session('2026-10-13'));
  const activeDonePast = parse(session('2026-10-13', { status: 'completed' }));
  const replacedDoneToday = parse(
    session(today, { planId: 'old', planStatus: 'replaced', status: 'completed' }),
  );
  const replacedPlannedToday = parse(session(today, { planId: 'old', planStatus: 'replaced' }));
  const activePlannedFuture = parse(session('2026-10-15'));
  const replacedPlannedFuture = parse(
    session('2026-10-15', { planId: 'old', planStatus: 'replaced' }),
  );
  const skippedFuture = parse(session('2026-10-15', { status: 'skipped' }));
  const all = [
    replacedDone,
    activePlannedPast,
    activeDonePast,
    replacedDoneToday,
    replacedPlannedToday,
    activePlannedFuture,
    replacedPlannedFuture,
    skippedFuture,
  ];

  it('vergangene Tage: nur erledigte Einheiten aus aktivem und ersetztem Plan', () => {
    expect(sessionsForDay(all, '2026-10-13', today)).toEqual([replacedDone, activeDonePast]);
  });

  it('heute: erledigte Einheit des ersetzten Plans zählt, auch wenn der neue Plan heute nichts hat', () => {
    const counted = sessionsForDay(all, today, today);
    expect(counted).toEqual([replacedDoneToday]);
    expect(trainingEnergy(counted, 80).netKcal).toBeGreaterThan(0);
  });

  it('heute: erledigt (alt) + geplant (aktiv) zählen beide, geplant (ersetzt) nicht', () => {
    const activeToday = parse(session(today));
    expect(sessionsForDay([...all, activeToday], today, today)).toEqual([
      replacedDoneToday,
      activeToday,
    ]);
  });

  it('künftige Tage: nur geplante Einheiten des aktiven Plans; skipped zählt 0', () => {
    expect(sessionsForDay(all, '2026-10-15', today)).toEqual([activePlannedFuture]);
  });

  it('keine Doppelzählung über sessionId', () => {
    expect(sessionsForDay([replacedDone, replacedDone], '2026-10-13', today)).toHaveLength(1);
  });
});

describe('Tagesbedarf und Bedarf für Grenzen (R2-B1)', () => {
  it('Rechenbeispiel: Tagesbedarf 2.102,5, TagesbedarfGrenze 2.539,675', () => {
    const e = dayEnergy({
      day: '2026-10-12',
      weightKg: 100,
      heightCm: 170,
      ageYears: 30,
      sex: 'female',
      bodyFat: { value: 50, measuredOn: '2026-10-01' },
      activityLevel: 'sedentary',
      sessions: [],
    });
    expect(e.bmrMifflin).toBe(1751.5);
    expect(e.bmrKatch).toBe(1450);
    expect(e.needs).toBeCloseTo(2102.5, 9);
    expect(e.limitNeeds).toBeCloseTo(2539.675, 9);
    expect(e.ffmForEnergyAvailability).toBeCloseTo(53.82, 2);
  });

  it('TagesbedarfGrenze ≥ Tagesbedarf und ≥ 1,45 × bmrForFloor – auch 300 kg/60 %, sehr groß, jung', () => {
    for (const [kg, cm, bf, age] of [
      [300, 250, 60, 16],
      [300, 250, 3, 16],
      [30, 100, 3, 90],
      [30, 100, 60, 90],
      [80, 180, 15, 30],
    ] as const) {
      for (const level of ['sedentary', 'very_active', null] as const) {
        const e = dayEnergy({
          day: '2026-10-12',
          weightKg: kg,
          heightCm: cm,
          ageYears: age,
          sex: 'male',
          bodyFat: { value: bf, measuredOn: '2026-10-12' },
          activityLevel: level,
          sessions: [],
        });
        expect(e.limitNeeds).toBeGreaterThanOrEqual(e.needs);
        expect(e.limitNeeds).toBeGreaterThanOrEqual(1.45 * e.bmrForFloor - 1e-9);
        expect(e.bmrForFloor).toBeGreaterThanOrEqual(mifflin(kg, cm, age, 'male'));
      }
    }
  });
});
