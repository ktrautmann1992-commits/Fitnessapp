import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import { dayEnergy } from './energy';
import { dayFloorKcal, roundWithin } from './limits';
import { nutritionTargetsForWeek } from './targets';
import { inputs, janmahasatian, katch, mifflin, MONDAY, run, session } from './test-helpers';

/** Rechenbeispiel R2-B1: Frau 100 kg/170 cm/30 J./KF 50 %, sitzend, Fettverlust, Check ohne Auffälligkeit. */
const exampleH = inputs({
  birthDate: '1996-01-01',
  sex: 'female',
  goalType: 'fat_loss',
  bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 170, weightKg: 100, bodyFatPct: 50 }],
});

describe('W17 – Rechenbeispiel R2-B1 wörtlich', () => {
  const week = nutritionTargetsForWeek(exampleH, MONDAY);
  const day = week.days[0]!;

  it('Zwischenwerte 1.751,5 / 1.450 / 2.102,5 / 2.539,675 / 1.682 / 1.904,756 / 1.439,675 / 1.614,7', () => {
    const e = dayEnergy({
      day: MONDAY,
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
    expect(e.bmrForFloor).toBe(1751.5);
    expect(e.needs).toBeCloseTo(2102.5, 9);
    expect(e.limitNeeds).toBeCloseTo(2539.675, 9);
    expect(e.baseNeeds * 0.8).toBeCloseTo(1682, 9);
    const floor = dayFloorKcal({
      bmrForFloor: e.bmrForFloor,
      baseNeeds: e.baseNeeds,
      needs: e.needs,
      limitNeeds: e.limitNeeds,
      weightKg: 100,
      ffmKg: e.ffmForEnergyAvailability,
      trainingGrossKcal: 0,
      trainingCapped: false,
      mode: 'full',
      goalIsSurplus: false,
      deficitCap: 0.25,
      surplusCap: 0.1,
    });
    expect(floor.parts.bmr).toBe(1751.5);
    expect(floor.parts.deficit).toBeCloseTo(1904.75625, 9);
    expect(floor.parts.weeklyLoss).toBeCloseTo(1439.675, 9);
    expect(floor.parts.energyAvailability).toBeCloseTo(1614.7, 1);
    expect(floor.kcal).toBeCloseTo(1904.75625, 9);
  });

  it('Ziel 1.910 kcal (24,8 % unter dem Mifflin-Gesamtumsatz), greift deficit_cap', () => {
    expect(day.mode).toBe('full');
    expect(day.targetKcal).toBe(1910);
    expect(day.targetKcal! / 2539.675).toBeCloseTo(0.752, 3);
    expect(day.targetKcal!).toBeGreaterThanOrEqual(0.75 * 2539.675);
    expect(day.appliedCaps).toEqual(['deficit_cap']);
    expect(day.bmrKcal).toBe(1752);
    expect(day.tdeeKcal).toBe(2540);
  });

  it('Planband [1.904,76; 2.101], Mitte ≈ 2.003', () => {
    expect(day.band!.min).toBeCloseTo(1904.756, 3);
    expect(day.band!.max).toBeCloseTo(2101, 9);
    expect((day.band!.min + day.band!.max) / 2).toBeCloseTo(2002.9, 1);
  });

  it('ohne Körperfett (nur Mifflin): 2.539,675 × 0,8 = 2.031,7 → 2.030, keine Grenze greift', () => {
    const plain = nutritionTargetsForWeek(
      {
        ...exampleH,
        bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 170, weightKg: 100 }],
      },
      MONDAY,
    ).days[0]!;
    expect(plain.targetKcal).toBe(2030);
    expect(plain.appliedCaps).toEqual([]);
  });
});

describe('W3 – Katch-McArdle senkt keine Untergrenze', () => {
  it('3 % und 60 % Körperfett: Untergrenze ≥ Mifflin-Variante aller vier Untergrenzen', () => {
    for (const bodyFatPct of [3, 60]) {
      for (const [kg, cm] of [
        [300, 250],
        [100, 170],
        [45, 150],
      ] as const) {
        const week = nutritionTargetsForWeek(
          inputs({
            goalType: 'fat_loss',
            sex: 'female',
            birthDate: '1996-01-01',
            bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: cm, weightKg: kg, bodyFatPct }],
          }),
          MONDAY,
        );
        const m = mifflin(kg, cm, 30, 'female');
        const mTdee = m * 1.45;
        const d = week.days[0]!;
        expect(d.floorKcal!).toBeGreaterThanOrEqual(m - 1e-9);
        expect(d.floorKcal!).toBeGreaterThanOrEqual(0.75 * mTdee - 1e-9);
        expect(d.floorKcal!).toBeGreaterThanOrEqual(mTdee - (0.01 * kg * 7700) / 7 - 1e-9);
        const ffm = Math.max(janmahasatian(kg, cm, 'female'), kg * (1 - bodyFatPct / 100));
        expect(d.floorKcal!).toBeGreaterThanOrEqual(Math.min(mTdee, 30 * ffm) - 1e-9);
        expect(d.targetKcal!).toBeGreaterThanOrEqual(d.floorKcal!);
      }
    }
  });

  it('maintenance_only bei 300 kg/60 %, 250 cm, 16 J.: Band beginnt nie unter dem Grundumsatz', () => {
    const week = nutritionTargetsForWeek(
      inputs({
        birthDate: '2010-01-01',
        goalType: 'fat_loss',
        bodyMetricsRows: [
          { measuredOn: '2026-10-01', heightCm: 250, weightKg: 300, bodyFatPct: 60 },
        ],
      }),
      MONDAY,
    );
    const d = week.days[0]!;
    expect(d.mode).toBe('maintenance_only');
    const m = mifflin(300, 250, 16, 'male');
    expect(d.band!.min).toBeGreaterThanOrEqual(m);
    expect(d.band!.min).toBeGreaterThanOrEqual(m * 1.45 - 1e-9);
    expect(d.targetKcal!).toBeGreaterThanOrEqual(Math.max(m, katch(300, 60)) * 1.45);
  });

  it('Körperfett 89/90/91 Tage alt: ab Tag 91 Mifflin statt Katch (für den Vorschlag)', () => {
    // Messung am 2026-07-15 → Mo 12.10. = 89, Di = 90, Mi = 91 Tage
    const week = nutritionTargetsForWeek(
      inputs({
        goalType: 'fat_loss',
        sex: 'female',
        birthDate: '1996-01-01',
        bodyMetricsRows: [
          { measuredOn: '2026-07-15', bodyFatPct: 50 },
          { measuredOn: '2026-10-01', heightCm: 170, weightKg: 100 },
        ],
      }),
      MONDAY,
    );
    expect(week.days[0]!.targetKcal).toBe(1910);
    expect(week.days[1]!.targetKcal).toBe(1910);
    expect(week.days[2]!.targetKcal).toBe(2030);
  });
});

describe('W5 – Energieverfügbarkeit', () => {
  const lean = (bodyFatPct?: number) =>
    inputs({
      birthDate: '2001-01-01',
      goalType: 'fat_loss',
      experienceLevel: 'competitive',
      bodyMetricsRows: [
        { measuredOn: '2026-10-01', heightCm: 180, weightKg: 70, bodyFatPct: bodyFatPct ?? null },
      ],
      sessions: [run(MONDAY, 240)],
    });

  it('240-min-Tag mit Fettverlust → Defizit verkleinert, Hinweis; Ruhetag ohne EA-Deckel', () => {
    for (const bf of [8, undefined]) {
      const week = nutritionTargetsForWeek(lean(bf), MONDAY);
      const long = week.days[0]!;
      expect(long.appliedCaps).toContain('energy_availability_cap');
      expect(long.notices).toContain('energy_availability_cap');
      const ffm = Math.max(janmahasatian(70, 180, 'male'), bf ? 70 * (1 - bf / 100) : 0);
      expect(long.targetKcal!).toBeGreaterThanOrEqual(30 * ffm + 7 * 70 * 4 - 1e-9);
      // EA-Untergrenze erzwingt nie einen Überschuss
      expect(long.targetKcal!).toBeLessThanOrEqual(long.tdeeKcal! + 10);
      expect(week.days[1]!.appliedCaps).not.toContain('energy_availability_cap');
    }
  });
});

describe('W6 – neueste Körperdaten je Feld, Gewicht 90/91 Tage alt', () => {
  it('Größe von vor 2 Jahren + neuestes Gewicht werden kombiniert', () => {
    const week = nutritionTargetsForWeek(
      inputs({
        bodyMetricsRows: [
          { measuredOn: '2024-10-12', heightCm: 180, weightKg: 90 },
          { measuredOn: '2026-10-10', weightKg: 80 },
        ],
      }),
      MONDAY,
    );
    expect(week.days[0]!.bmrKcal).toBe(Math.round(mifflin(80, 180, 36, 'male')));
  });

  it('Hinweis weight_outdated erst über 90 Tage (Gewichts-Datum)', () => {
    // Gewicht am 2026-07-14 → Mo 90 Tage, Di 91 Tage
    const week = nutritionTargetsForWeek(
      inputs({ bodyMetricsRows: [{ measuredOn: '2026-07-14', heightCm: 180, weightKg: 80 }] }),
      MONDAY,
    );
    expect(week.days[0]!.notices).not.toContain('weight_outdated');
    expect(week.days[1]!.notices).toContain('weight_outdated');
    expect(week.days[1]!.targetKcal).not.toBeNull();
  });
});

describe('W7 – tagesgenau: Geburtstage, Zeitumstellung, 29. Februar', () => {
  it('18. Geburtstag am Mittwoch: Mo/Di Erhalt, ab Mi Defizit erlaubt', () => {
    const week = nutritionTargetsForWeek(
      inputs({ birthDate: '2008-10-14', goalType: 'fat_loss' }),
      MONDAY,
    );
    expect(week.days.map((d) => d.mode)).toEqual([
      'maintenance_only',
      'maintenance_only',
      'full',
      'full',
      'full',
      'full',
      'full',
    ]);
    expect(week.days[1]!.targetKcal!).toBeGreaterThan(week.days[2]!.targetKcal!);
  });

  it('65. Geburtstag am Donnerstag: ab Do Eiweiß ≤ 1,6 g/kg und Defizit ≤ 15 %', () => {
    const week = nutritionTargetsForWeek(
      inputs({ birthDate: '1961-10-15', goalType: 'fat_loss' }),
      MONDAY,
    );
    expect(week.days[2]!.proteinG).toBe(160);
    expect(week.days[3]!.proteinG!).toBeLessThanOrEqual(1.6 * 80);
    expect(week.days[3]!.floorKcal!).toBeGreaterThanOrEqual(0.85 * week.days[3]!.tdeeKcal! - 1);
  });

  it('Woche mit Zeitumstellung (So 25.10.2026) hat 7 aufeinanderfolgende Tage', () => {
    const week = nutritionTargetsForWeek(inputs({ today: '2026-10-19' }), '2026-10-19');
    expect(week.days.map((d) => d.date)).toEqual(
      Array.from({ length: 7 }, (_, i) => addDays('2026-10-19', i)),
    );
    expect(week.days[6]!.date).toBe('2026-10-25');
  });

  it('29. Februar als Wochentag und als Geburtstag', () => {
    const leap = nutritionTargetsForWeek(inputs({ today: '2028-02-28' }), '2028-02-28');
    expect(leap.days[1]!.date).toBe('2028-02-29');
    // geboren am 29.02.2008 → 18 Jahre am 01.03.2026 (Sonntag)
    const born = nutritionTargetsForWeek(
      inputs({
        today: '2026-02-23',
        birthDate: '2008-02-29',
        goalType: 'fat_loss',
        bodyMetricsRows: [{ measuredOn: '2026-02-01', heightCm: 180, weightKg: 80 }],
      }),
      '2026-02-23',
    );
    expect(born.days.map((d) => d.ageYears)).toEqual([17, 17, 17, 17, 17, 17, 18]);
    expect(born.days[5]!.mode).toBe('maintenance_only');
    expect(born.days[6]!.mode).toBe('full');
  });
});

describe('W8 – Trainingsenergie aus aktivem und ersetztem Plan', () => {
  it('heute erledigte Einheit des ersetzten Plans, neuer Plan heute ohne Einheit → Trainingsenergie > 0', () => {
    const today = addDays(MONDAY, 2);
    const week = nutritionTargetsForWeek(
      inputs({
        today,
        sessions: [
          session(today, { planId: 'old', planStatus: 'replaced', status: 'completed' }),
          session(addDays(MONDAY, 1), {
            planId: 'old',
            planStatus: 'replaced',
            status: 'completed',
          }),
          session(addDays(MONDAY, 1)),
          session(addDays(MONDAY, 3), { planId: 'old', planStatus: 'replaced' }),
          session(addDays(MONDAY, 4)),
          session(addDays(MONDAY, 5), { status: 'skipped' }),
        ],
      }),
      MONDAY,
    );
    const kcal = week.days.map((d) => d.trainingKcal);
    expect(kcal[2]).toBeGreaterThan(0);
    expect(kcal[1]).toBe(200); // nur die erledigte Einheit (2,5 × 80 × 1 h), nicht die geplante
    expect(kcal[3]).toBe(0); // geplante Einheit des ersetzten Plans zählt nicht
    expect(kcal[4]).toBe(200);
    expect(kcal[5]).toBe(0); // skipped = 0
    expect(week.days[4]!.targetKcal!).toBeGreaterThan(week.days[3]!.targetKcal!);
  });
});

describe('W25 – Band bei maintenance_only und Trainingsdeckel', () => {
  const minor = (goalType: 'fat_loss' | 'general_fitness') =>
    nutritionTargetsForWeek(inputs({ birthDate: '2010-01-01', goalType }), MONDAY).days[0]!;

  it('16 J. mit Fettverlust: Untergrenze ≥ TagesbedarfGrenze, Obergrenze ≤ +5 %', () => {
    const d = minor('fat_loss');
    const tbg = mifflin(80, 180, 16, 'male') * 1.45;
    expect(d.mode).toBe('maintenance_only');
    expect(d.band!.min).toBeGreaterThanOrEqual(tbg - 1e-9);
    expect(d.band!.max).toBeLessThanOrEqual(tbg * 1.05 + 1e-9);
    expect(d.band!.max - d.band!.min).toBeGreaterThanOrEqual(0.05 * tbg - 10 - 1e-9);
    expect(d.notices).toContain('minor_no_deficit');
    expect(d.notices).toContain('bmr_estimate_age');
  });

  it('16 J. mit general_fitness: ebenfalls ≤ +5 %', () => {
    const d = minor('general_fitness');
    expect(d.ceilingKcal!).toBeCloseTo(mifflin(80, 180, 16, 'male') * 1.45 * 1.05, 6);
  });

  it('Tag mit gedeckelter Trainingsenergie: ohne Defizit + Hinweis training_energy_capped', () => {
    const week = nutritionTargetsForWeek(
      inputs({
        goalType: 'fat_loss',
        bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 200, weightKg: 150 }],
        sessions: [run(MONDAY, 240)],
      }),
      MONDAY,
    );
    const d = week.days[0]!;
    expect(d.trainingKcal).toBe(3000);
    expect(d.notices).toContain('training_energy_capped');
    expect(d.appliedCaps).toContain('training_energy_capped');
    expect(d.targetKcal!).toBeGreaterThanOrEqual(mifflin(150, 200, 36, 'male') * 1.45 + 3000);
    expect(week.days[1]!.notices).not.toContain('training_energy_capped');
  });
});

describe('W23 / W27 – 4b-Versatz', () => {
  const people = [
    exampleH,
    inputs({ goalType: 'fat_loss' }),
    inputs({ goalType: 'muscle_gain', sessions: [run(MONDAY, 60), session(addDays(MONDAY, 2))] }),
    inputs({ birthDate: '2010-01-01', goalType: 'general_fitness' }),
    inputs({ healthFlags: null, sex: 'female', goalType: 'definition' }),
    inputs({ birthDate: '1950-01-01', goalType: 'endurance', sessions: [run(MONDAY, 240)] }),
  ];

  it('W23: −1.000 kcal → an Tagen, an denen schon ohne Versatz eine Untergrenze greift, dasselbe Ziel', () => {
    let bound = 0;
    for (const person of people) {
      const without = nutritionTargetsForWeek(person, MONDAY);
      const minus = nutritionTargetsForWeek(person, MONDAY, { adjustmentKcal: -1000 });
      without.days.forEach((day, i) => {
        const other = minus.days[i]!;
        // Untergrenze greift schon ohne Versatz ⇔ Ziel = gerichtet gerundete Untergrenze
        const atFloor = roundWithin(day.floorKcal!, day.floorKcal!, day.ceilingKcal!, 10);
        if (day.targetKcal === atFloor) {
          expect(other.targetKcal).toBe(day.targetKcal);
          bound += 1;
        }
        expect(other.floorKcal).toBeCloseTo(day.floorKcal!, 9);
        expect(other.targetKcal!).toBeGreaterThanOrEqual(other.floorKcal! - 1e-9);
        expect(other.targetKcal!).toBeLessThanOrEqual(day.targetKcal!);
      });
    }
    expect(bound).toBeGreaterThan(7);
  });

  it('W27: 16 J. mit general_fitness und +1.000 kcal → Ziel ≤ TagesbedarfGrenze × 1,05', () => {
    const d = nutritionTargetsForWeek(people[3]!, MONDAY, { adjustmentKcal: 1000 }).days[0]!;
    expect(d.targetKcal!).toBeLessThanOrEqual(mifflin(80, 180, 16, 'male') * 1.45 * 1.05);
    expect(d.appliedCaps).toEqual(['gain_cap', 'special_case_cap']);
  });

  it('Versatz über ±1.000 wird abgelehnt (Summe begrenzt clampCalorieAdjustment)', () => {
    expect(() => nutritionTargetsForWeek(exampleH, MONDAY, { adjustmentKcal: 1001 })).toThrow();
    expect(() => nutritionTargetsForWeek(exampleH, MONDAY, { adjustmentKcal: -1001 })).toThrow();
  });
});

describe('Grundumfang 12.1', () => {
  it('45 kg/150 cm Frau 25 J., sitzend, Ruhetag: gerundetes Ziel nie unter 1.101,5 – alle Ziele', () => {
    for (const goalType of [
      'fat_loss',
      'definition',
      'muscle_gain',
      'general_fitness',
      'endurance',
    ] as const) {
      for (const adjustmentKcal of [-1000, 0, 1000]) {
        const d = nutritionTargetsForWeek(
          inputs({
            sex: 'female',
            birthDate: '2001-01-01',
            goalType,
            bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 150, weightKg: 45 }],
          }),
          MONDAY,
          { adjustmentKcal },
        ).days[0]!;
        expect(d.targetKcal!).toBeGreaterThanOrEqual(1101.5);
        expect(d.targetKcal!).toBeGreaterThanOrEqual(0.75 * 1101.5 * 1.45);
      }
    }
  });

  it('30 kg/150 cm und 300 kg/250 cm liefern Ziele im erlaubten Bereich', () => {
    for (const [kg, cm] of [
      [30, 150],
      [300, 250],
    ] as const) {
      const week = nutritionTargetsForWeek(
        inputs({
          goalType: 'fat_loss',
          bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: cm, weightKg: kg }],
        }),
        MONDAY,
      );
      for (const d of week.days) {
        expect(d.targetKcal!).toBeGreaterThanOrEqual(d.floorKcal!);
        expect(d.targetKcal!).toBeLessThanOrEqual(d.ceilingKcal! + 10);
        expect(
          Math.abs(4 * d.proteinG! + 4 * d.carbsG! + 9 * d.fatG! - d.targetKcal!),
        ).toBeLessThanOrEqual(10);
      }
    }
    const thin = nutritionTargetsForWeek(
      inputs({
        goalType: 'fat_loss',
        bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 150, weightKg: 30 }],
      }),
      MONDAY,
    ).days[0]!;
    expect(thin.mode).toBe('maintenance_only'); // BMI 13,3
    expect(thin.notices).toContain('severe_underweight');
  });

  it('200 kg/190 cm Mann 60 J.: BMR 2.892,5, Eiweiß über Referenzgewicht ≈ 180 g', () => {
    const d = nutritionTargetsForWeek(
      inputs({
        birthDate: '1966-01-01',
        goalType: 'fat_loss',
        bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 190, weightKg: 200 }],
      }),
      MONDAY,
    ).days[0]!;
    expect(d.bmrKcal).toBe(2893);
    expect(d.proteinG).toBe(180);
  });

  it('Alter 16, 79, 95, 100: Ziele vorhanden, Hinweis bmr_estimate_age; ab 65 Eiweiß ≤ 1,6', () => {
    for (const age of [16, 79, 95, 100]) {
      const d = nutritionTargetsForWeek(
        inputs({ birthDate: `${2026 - age}-01-01`, goalType: 'definition' }),
        MONDAY,
      ).days[0]!;
      expect(d.targetKcal).not.toBeNull();
      expect(d.notices).toContain('bmr_estimate_age');
      expect(d.proteinG!).toBeLessThanOrEqual(1.6 * 80);
      if (age === 16) expect(d.targetKcal!).toBeGreaterThanOrEqual(d.tdeeKcal! - 1);
    }
  });

  it('1 vs. 7 Trainingstage: Trainingstag höher als Ruhetag, tagesgenau', () => {
    const one = nutritionTargetsForWeek(
      inputs({ sessions: [session(addDays(MONDAY, 2))] }),
      MONDAY,
    );
    expect(one.days.map((d) => d.trainingKcal)).toEqual([0, 0, 200, 0, 0, 0, 0]);
    expect(one.days[2]!.targetKcal!).toBeGreaterThan(one.days[1]!.targetKcal!);
    const seven = nutritionTargetsForWeek(
      inputs({ sessions: Array.from({ length: 7 }, (_, i) => session(addDays(MONDAY, i))) }),
      MONDAY,
    );
    expect(new Set(seven.days.map((d) => d.targetKcal)).size).toBe(1);
    expect(seven.days[0]!.targetKcal!).toBe(one.days[2]!.targetKcal!);
  });

  it('7 × 240 min Ausdauer (Ziel Ausdauer): Kohlenhydrate nach Last, Deckel → ohne Defizit, Fett ≥ 20 %', () => {
    const week = nutritionTargetsForWeek(
      inputs({
        goalType: 'endurance',
        bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 190, weightKg: 130 }],
        sessions: Array.from({ length: 7 }, (_, i) => run(addDays(MONDAY, i), 240)),
      }),
      MONDAY,
    );
    for (const d of week.days) {
      expect(d.trainingKcal).toBe(3000);
      expect(d.notices).toContain('training_energy_capped');
      expect(d.notices).toContain('long_session_fueling');
      expect(9 * d.fatG!).toBeGreaterThanOrEqual(0.2 * d.targetKcal! - 1e-9);
      expect(d.carbsG!).toBeGreaterThanOrEqual(6 * 130 - 5);
    }
  });

  it('Erholungswoche: kürzere Minuten → weniger Trainingsenergie', () => {
    const normal = nutritionTargetsForWeek(inputs({ sessions: [run(MONDAY, 60)] }), MONDAY)
      .days[0]!;
    const deload = nutritionTargetsForWeek(
      inputs({ sessions: [{ ...run(MONDAY, 36), isDeload: true }] }),
      MONDAY,
    ).days[0]!;
    expect(deload.trainingKcal!).toBeLessThan(normal.trainingKcal!);
  });

  it('divers/keine Angabe: Vorschlag mit −78, Grenzen mit dem männlichen Offset +5 (Wächter N1, S1)', () => {
    for (const sex of ['diverse', 'unspecified', null] as const) {
      // Beispiel aus dem Wächter-Bericht: 80 kg/180 cm/36 J., sitzend, Fettverlust, Versatz −1.000
      const d = nutritionTargetsForWeek(inputs({ sex, goalType: 'fat_loss' }), MONDAY, {
        adjustmentKcal: -1000,
      }).days[0]!;
      const maleBmr = mifflin(80, 180, 36, 'male');
      const maleTdee = maleBmr * 1.45;
      expect(d.bmrKcal).toBe(Math.round(maleBmr));
      expect(d.targetKcal!).toBeGreaterThanOrEqual(0.75 * maleTdee); // ≤ 25 % unter Gesamtumsatz (Männer-Formel)
      expect(d.targetKcal).toBe(1910);
      // ohne Versatz: Vorschlag mit dem Mittelwert −78
      const plain = nutritionTargetsForWeek(inputs({ sex, goalType: 'fat_loss' }), MONDAY).days[0]!;
      expect(plain.targetKcal).toBe(
        Math.round((mifflin(80, 180, 36, 'diverse') * 1.45 * 0.8) / 10) * 10,
      );
    }
  });

  it('S2: Tagessumme über 24 h (2 × 800 min) bricht die Woche nicht ab – Deckel, kein Defizit', () => {
    const week = nutritionTargetsForWeek(
      inputs({ goalType: 'fat_loss', sessions: [run(MONDAY, 800), run(MONDAY, 800)] }),
      MONDAY,
    );
    expect(week.days[0]!.appliedCaps).toContain('training_energy_capped');
    expect(week.days[0]!.targetKcal!).toBeGreaterThanOrEqual(
      mifflin(80, 180, 36, 'male') * 1.45 + 3000,
    );
    expect(week.days[1]!.targetKcal).not.toBeNull();
  });

  it('K3: Körperdaten mit Datum nach heute zählen nicht', () => {
    const week = nutritionTargetsForWeek(
      inputs({
        bodyMetricsRows: [
          { measuredOn: '2026-10-01', heightCm: 180, weightKg: 80 },
          { measuredOn: '2030-01-01', weightKg: 300 },
        ],
      }),
      MONDAY,
    );
    expect(week.days[0]!.bmrKcal).toBe(Math.round(mifflin(80, 180, 36, 'male')));
  });

  it('K5: Alter über 120 und Woche weit weg von heute → verständlicher Fehler', () => {
    expect(() => nutritionTargetsForWeek(inputs({ birthDate: '1900-01-01' }), MONDAY)).toThrow(
      /höchstens 120 Jahre/,
    );
    expect(() => nutritionTargetsForWeek(inputs(), '2000-01-03')).toThrow(/mehr als ein Jahr/);
  });
});

describe('Modus no_targets und Gesundheitsdaten', () => {
  it('keine Einwilligung: keine Zahlen, keine Gesundheitsdaten – auch wenn Körperdaten mitgegeben werden', () => {
    const week = nutritionTargetsForWeek(
      inputs({ healthDataConsent: false, healthFlags: { flags: ['pregnancy'] } }),
      MONDAY,
    );
    expect(week.usesHealthData).toBe(false);
    for (const d of week.days) {
      expect(d).toMatchObject({
        mode: 'no_targets',
        targetKcal: null,
        proteinG: null,
        bmrKcal: null,
        band: null,
      });
      expect(d.notices).toContain('no_health_data_consent');
    }
  });

  it('Schwangerschaft: keine Kalorienzahl, keine Makro-Gramm, Hinweise, Ausschluss pregnancy_caution (W4)', () => {
    const week = nutritionTargetsForWeek(
      inputs({ sex: 'female', healthFlags: { flags: ['pregnancy', 'conservative_plan'] } }),
      MONDAY,
    );
    expect(week.usesHealthData).toBe(true);
    for (const d of week.days) {
      expect(d.targetKcal).toBeNull();
      expect(d.carbsG).toBeNull();
      expect(d.recipeExclusions).toEqual(['pregnancy_caution']);
      expect(d.notices).toEqual(
        expect.arrayContaining(['pregnancy_no_targets', 'pregnancy_caffeine']),
      );
    }
  });

  it('keine Größe → no_targets; Alltag ohne Angabe → Hinweis activity_level_default', () => {
    expect(
      nutritionTargetsForWeek(
        inputs({ bodyMetricsRows: [{ measuredOn: '2026-10-01', weightKg: 80 }] }),
        MONDAY,
      ).days[0]!.mode,
    ).toBe('no_targets');
    const d = nutritionTargetsForWeek(inputs({ activityLevel: null }), MONDAY).days[0]!;
    expect(d.notices).toContain('activity_level_default');
    expect(d.tdeeKcal).toBe(Math.round(mifflin(80, 180, 36, 'male') * 1.45));
  });

  it('kein Gesundheits-Check, weiblich: Erhalt + Hinweis (Testperson G)', () => {
    const d = nutritionTargetsForWeek(
      inputs({ sex: 'female', healthFlags: null, goalType: 'fat_loss' }),
      MONDAY,
    ).days[0]!;
    expect(d.mode).toBe('maintenance_only');
    expect(d.notices).toContain('health_check_missing');
    expect(d.targetKcal!).toBeGreaterThanOrEqual(d.tdeeKcal! - 1);
  });
});

describe('Eingaben mit Zod geprüft', () => {
  it('Woche nicht ab Montag, unter 16, doppelte Einheit, effort 5, unbekannte Felder → Fehler', () => {
    expect(() => nutritionTargetsForWeek(inputs(), '2026-10-13')).toThrow();
    expect(() => nutritionTargetsForWeek(inputs({ birthDate: '2011-01-01' }), MONDAY)).toThrow();
    const s = session(MONDAY);
    expect(() => nutritionTargetsForWeek(inputs({ sessions: [s, s] }), MONDAY)).toThrow();
    expect(() =>
      nutritionTargetsForWeek(inputs({ sessions: [session(MONDAY, { effortTarget: 5 })] }), MONDAY),
    ).toThrow();
    expect(() =>
      nutritionTargetsForWeek({ ...inputs(), unlockLimits: true } as never, MONDAY),
    ).toThrow();
    expect(() => nutritionTargetsForWeek(inputs({ mealsPerDay: 9 }), MONDAY)).toThrow();
  });
});
