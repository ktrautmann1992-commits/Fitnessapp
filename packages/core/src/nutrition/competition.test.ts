/**
 * Wettkampf-Ernährung (docs/PLAN-PHASE-10.md Abschnitt 10, Etappe W1; PLAN-PHASE-5 19.7 W1, 19.8). Die Erwartungen sind
 * aus dem Plan abgeschrieben (nicht aus constants.ts), damit ein Fehler in den Konstanten auffällt.
 */
import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import type { Recipe } from '../content/recipe-schema';
import type { WeightGoal } from '../goals/weight-goal-schema';
import {
  carbLoadingDayCount,
  competitionDayFor,
  competitionDays,
  competitionGuideId,
  expectedRaceMinutes,
  type NutritionCompetitionInput,
  raceBreakfastCarbs,
  raceFuelingPlan,
} from './competition';
import { nutritionEligibility } from './eligibility';
import { nutritionMacros, proteinReferenceWeight } from './macros';
import { buildMealPlanWeek, daySafetyKey, isCompetitionMealDay } from './meal-plan';
import { N3_FOODS, N3_RECIPES } from './meal-plan-fixtures';
import { needsAutomaticReplan } from './replan';
import type { NutritionInputsInput } from './schemas';
import { nutritionTargetsForWeek } from './targets';
import { independentLimits, inputs, MONDAY, run, seededRandom } from './test-helpers';

// Woche ab Montag 12.10.2026: Fr 16., Sa 17., So 18.10.; nächste Woche Mo 19.10.
const FRIDAY = '2026-10-16';
const SATURDAY = '2026-10-17';
const SUNDAY = '2026-10-18';
const NEXT_MONDAY = '2026-10-19';
const PREVIOUS_MONDAY = '2026-10-05';

function competition(
  overrides: Partial<NutritionCompetitionInput> = {},
): NutritionCompetitionInput {
  return {
    id: 'c1',
    status: 'planned',
    discipline: 'half_marathon',
    raceDate: SUNDAY,
    ...overrides,
  };
}

const week = (p: NutritionInputsInput, monday = MONDAY, adjustmentKcal = 0) =>
  nutritionTargetsForWeek(p, monday, { adjustmentKcal });
const dayOf = (targets: ReturnType<typeof week>, date: string) => {
  const day = targets.days.find((d) => d.date === date);
  if (day === undefined) throw new Error(`Tag ${date} fehlt`);
  return day;
};

describe('expectedRaceMinutes (Plan 10: Zielzeit, Referenzzeit, sonst vorsichtige Schätzung)', () => {
  it('Zielzeit hat Vorrang (gerundet auf Minuten)', () => {
    expect(
      expectedRaceMinutes(
        competition({
          targetTimeS: 1 * 3600 + 44 * 60 + 40,
          reference: { discipline: '10k', timeS: 48 * 60, date: '2026-09-01' },
        }),
        'beginner',
      ),
    ).toEqual({ minutes: 105, source: 'target_time' });
  });

  it('Referenzzeit mit Riegel (10 km in 50 min → Halbmarathon ≈ 110 min)', () => {
    const result = expectedRaceMinutes(
      competition({ reference: { discipline: '10k', timeS: 50 * 60, date: '2026-09-01' } }),
      'beginner',
    );
    expect(result.source).toBe('reference');
    // 3000 × 2,10975^1,06 = 6.623 s
    expect(result.minutes).toBe(Math.round((3000 * 2.10975 ** 1.06) / 60));
  });

  it('Referenz zu weit entfernt (5 km → Marathon, Faktor > 4) → Schätzung', () => {
    expect(
      expectedRaceMinutes(
        competition({
          discipline: 'marathon',
          reference: { discipline: '5k', timeS: 25 * 60, date: '2026-09-01' },
        }),
        'advanced',
      ),
    ).toEqual({ minutes: 270, source: 'estimate' });
  });

  it.each([
    ['5k', 'beginner', 40],
    ['5k', 'competitive', 24],
    ['10k', 'beginner', 80],
    ['10k', 'competitive', 48],
    ['half_marathon', 'beginner', 165],
    ['half_marathon', 'advanced', 130],
    ['half_marathon', 'competitive', 105],
    ['marathon', 'beginner', 330],
    ['marathon', 'competitive', 225],
  ] as const)('Schätzung %s / %s = %i min', (discipline, level, minutes) => {
    expect(expectedRaceMinutes(competition({ discipline }), level)).toEqual({
      minutes,
      source: 'estimate',
    });
  });
});

describe('carbLoadingDayCount (≥ 90 min, CARB_LOADING_DAYS 1–2)', () => {
  it.each([
    [0, 0],
    [59, 0],
    [89, 0],
    [90, 1],
    [149, 1],
    [150, 2],
    [600, 2],
  ])('%i min → %i Tage', (minutes, days) => {
    expect(carbLoadingDayCount(minutes)).toBe(days);
  });
});

describe('competitionDays (je Tag carb_loading | race_eve | race_day | post_race | normal)', () => {
  it('Halbmarathon Einsteiger am Sonntag (165 min → 2 Tage): Fr Carb-Loading, Sa Vorabend, So Renntag', () => {
    const days = competitionDays([competition()], MONDAY, 'beginner');
    expect(days.map((d) => d.kind)).toEqual([
      'normal',
      'normal',
      'normal',
      'normal',
      'carb_loading',
      'race_eve',
      'race_day',
    ]);
    expect(days.map((d) => d.carbLoading)).toEqual([false, false, false, false, true, true, false]);
    // Ganze Rennwoche ohne Defizit (Plan 10 1.6 Nr. 2).
    expect(days.every((d) => d.noDeficit)).toBe(true);
    expect(days.every((d) => d.competition?.id === 'c1')).toBe(true);
    const after = competitionDayFor([competition()], NEXT_MONDAY, 'beginner');
    expect(after).toMatchObject({ kind: 'post_race', noDeficit: true, carbLoading: false });
    const later = competitionDayFor([competition()], addDays(NEXT_MONDAY, 1), 'beginner');
    expect(later).toEqual({
      date: addDays(NEXT_MONDAY, 1),
      kind: 'normal',
      carbLoading: false,
      noDeficit: false,
      competition: null,
    });
  });

  it('Halbmarathon Leistungssport (105 min → 1 Tag): nur der Vorabend ist Carb-Loading', () => {
    const days = competitionDays([competition()], MONDAY, 'competitive');
    expect(days.map((d) => d.kind).slice(4)).toEqual(['normal', 'race_eve', 'race_day']);
    expect(days.map((d) => d.carbLoading).slice(4)).toEqual([false, true, false]);
  });

  it('Wettkampf unter 90 min (5 km): kein Carb-Loading, Vorabend ohne Verschiebung, Woche trotzdem ohne Defizit', () => {
    const days = competitionDays([competition({ discipline: '5k' })], MONDAY, 'beginner');
    expect(days.some((d) => d.carbLoading)).toBe(false);
    expect(days.map((d) => d.kind).slice(5)).toEqual(['race_eve', 'race_day']);
    expect(days.every((d) => d.noDeficit)).toBe(true);
  });

  it('Wettkampf am Montag: Carb-Loading und Vorabend liegen in der Vorwoche', () => {
    const marathon = competition({ discipline: 'marathon', raceDate: NEXT_MONDAY });
    const before = competitionDays([marathon], MONDAY, 'beginner');
    expect(before.map((d) => d.kind)).toEqual([
      'normal',
      'normal',
      'normal',
      'normal',
      'normal',
      'carb_loading',
      'race_eve',
    ]);
    // Freitag gehört nicht dazu: Wochen-Fenster ab Samstag (2 Tage Carb-Loading).
    expect(before.map((d) => d.noDeficit)).toEqual([false, false, false, false, false, true, true]);
    const raceWeek = competitionDays([marathon], NEXT_MONDAY, 'beginner');
    expect(raceWeek.map((d) => d.kind)).toEqual([
      'race_day',
      'post_race',
      'normal',
      'normal',
      'normal',
      'normal',
      'normal',
    ]);
    expect(raceWeek.every((d) => d.noDeficit)).toBe(true);
  });

  it('Wettkampf abgesagt: alle Tage normal', () => {
    for (const day of competitionDays([competition({ status: 'cancelled' })], MONDAY, 'beginner')) {
      expect(day).toMatchObject({ kind: 'normal', noDeficit: false, competition: null });
    }
  });

  it('erledigter Wettkampf: Renntag und Tag danach bleiben (Auswertung der vergangenen Tage)', () => {
    const done = competitionDays([competition({ status: 'done' })], MONDAY, 'beginner');
    expect(done[6]?.kind).toBe('race_day');
  });

  it('zwei Wettkämpfe: Renntag hat Vorrang vor „Nach dem Rennen“, ohne Defizit bleibt', () => {
    const first = competition({ id: 'a', discipline: '5k', raceDate: SATURDAY });
    const second = competition({ id: 'b', discipline: '5k', raceDate: SUNDAY });
    const day = competitionDayFor([second, first], SUNDAY, 'beginner');
    expect(day.kind).toBe('race_day');
    expect(day.competition?.id).toBe('b');
    expect(competitionDayFor([second, first], SATURDAY, 'beginner').kind).toBe('race_day');
  });

  it('Woche muss am Montag beginnen; ungültige Eingaben werden abgelehnt', () => {
    expect(() => competitionDays([competition()], FRIDAY, 'beginner')).toThrow(RangeError);
    expect(() => competitionDayFor([competition(), competition()], MONDAY, 'beginner')).toThrow();
    expect(() =>
      competitionDayFor([{ ...competition(), discipline: 'ultra' as never }], MONDAY, 'beginner'),
    ).toThrow();
  });
});

describe('raceFuelingPlan (Gel-/Trinkplan, Jeukendrup 2014)', () => {
  it('unter 60 min: nichts nötig, kein Trink-Richtwert, keine Portionen', () => {
    const plan = raceFuelingPlan(59, 'competitive', { generalOnly: false });
    expect(plan.stage).toBe('none');
    expect(plan.carbsGPerHour).toBeNull();
    expect(plan.drinkMlPerHour).toBeNull();
    expect(plan.steps.map((s) => s.kind)).toEqual([
      'breakfast',
      'start',
      'finish',
      'recovery_meal',
    ]);
    expect(plan.notices).toEqual(['nothing_new', 'no_fuel_needed']);
  });

  it('60–120 min: bis 30 g/h (Portionen bis 15 g), 400–800 ml/h (Jeukendrup 2014: 1–2 h bis 30 g/h)', () => {
    const plan = raceFuelingPlan(120, 'competitive', { generalOnly: false });
    expect(plan.stage).toBe('light');
    expect(plan.carbsGPerHour).toEqual({ min: 0, max: 30 });
    expect(plan.drinkMlPerHour).toEqual({ min: 400, max: 800 });
    const fuel = plan.steps.filter((s) => s.kind === 'fuel');
    expect(fuel.map((s) => s.fromMinute)).toEqual([30, 60, 90]);
    expect(fuel.every((s) => s.carbsG?.min === 0 && s.carbsG.max === 15)).toBe(true);
    expect(plan.notices).toEqual(['nothing_new', 'test_in_long_run', 'heat_and_salt']);
    expect(raceFuelingPlan(60, 'beginner', { generalOnly: false }).stage).toBe('light');
  });

  it('121–150 min: 30–60 g/h, Portionen 15–30 g (2–3 h bis 60 g/h)', () => {
    for (const minutes of [121, 150]) {
      const plan = raceFuelingPlan(minutes, 'competitive', { generalOnly: false });
      expect(plan.stage).toBe('moderate');
      expect(plan.carbsGPerHour).toEqual({ min: 30, max: 60 });
      expect(plan.steps.find((s) => s.kind === 'fuel')?.carbsG).toEqual({ min: 15, max: 30 });
    }
  });

  it('über 150 min: 60–90 g/h nur für Fortgeschrittene/Leistungssport, Einsteiger bleiben bei 30–60 g/h mit Hinweis', () => {
    for (const level of ['advanced', 'competitive'] as const) {
      const plan = raceFuelingPlan(151, level, { generalOnly: false });
      expect(plan.stage).toBe('high');
      expect(plan.carbsGPerHour).toEqual({ min: 60, max: 90 });
      expect(plan.notices).toContain('test_in_long_run');
      expect(plan.steps.find((s) => s.kind === 'fuel')?.carbsG).toEqual({ min: 30, max: 45 });
    }
    const beginner = raceFuelingPlan(330, 'beginner', { generalOnly: false });
    expect(beginner.stage).toBe('moderate');
    expect(beginner.carbsGPerHour).toEqual({ min: 30, max: 60 });
    expect(beginner.notices).toContain('beginner_moderate_only');
    // Portionen bis vor das Ziel (330 min → 30 … 300, 10 Portionen).
    expect(beginner.steps.filter((s) => s.kind === 'fuel')).toHaveLength(10);
  });

  it('unter 18: nur allgemein – keine Gramm, auch nicht beim Frühstück', () => {
    const plan = raceFuelingPlan(200, 'competitive', { generalOnly: true, weightKg: 60 });
    expect(plan.stage).toBe('general');
    expect(plan.carbsGPerHour).toBeNull();
    expect(plan.steps.some((s) => s.carbsG !== null)).toBe(false);
    expect(plan.notices).toContain('general_only');
    expect(plan.notices).not.toContain('test_in_long_run');
  });

  it('Frühstück 2–4 h vorher mit 1–4 g/kg nur mit Körpergewicht; Erholungsmahlzeit 1–2 h nach dem Ziel', () => {
    const plan = raceFuelingPlan(100, 'advanced', { generalOnly: false, weightKg: 63 });
    expect(plan.steps[0]).toEqual({
      kind: 'breakfast',
      fromMinute: -240,
      toMinute: -120,
      // 2–4 h vorher → etwa 2–4 g/kg (1 g/kg je Stunde, N6): 126 → 130, 252 → 250.
      carbsG: { min: 130, max: 250 },
    });
    expect(plan.steps.at(-1)).toEqual({
      kind: 'recovery_meal',
      fromMinute: 160,
      toMinute: 220,
      carbsG: null,
    });
    expect(raceFuelingPlan(100, 'advanced', { generalOnly: false }).steps[0]?.carbsG).toBeNull();
  });

  it('raceBreakfastCarbs: sehr leicht und sehr schwer, immer innerhalb 1–4 g/kg', () => {
    for (const kg of [30, 40, 63, 80, 150, 300]) {
      const range = raceBreakfastCarbs(kg);
      expect(range.min).toBeGreaterThanOrEqual(2 * kg);
      expect(range.max).toBeLessThanOrEqual(4 * kg);
      expect(range.min).toBeLessThanOrEqual(range.max);
    }
  });

  it('lehnt unplausible Dauer ab', () => {
    expect(() => raceFuelingPlan(0, 'beginner', { generalOnly: false })).toThrow();
    expect(() => raceFuelingPlan(25 * 60, 'beginner', { generalOnly: false })).toThrow();
    expect(() => raceFuelingPlan(90.5, 'beginner', { generalOnly: false })).toThrow();
  });
});

describe('competitionGuideId', () => {
  it('findet den Ratgeber „Wettkampf-Ernährung“ (oder keinen)', () => {
    expect(competitionGuideId([{ id: 'demo-unterwegs' }, { id: 'demo-wettkampf' }])).toBe(
      'demo-wettkampf',
    );
    // Feste ID hat Vorrang; ähnliche IDs zählen nicht (Wächter N9).
    expect(competitionGuideId([{ id: 'demo-wettkampf' }, { id: 'wettkampf' }])).toBe('wettkampf');
    expect(competitionGuideId([{ id: 'wettkampf-alt' }, { id: 'unterwegs' }])).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------
// Einbindung in nutritionTargetsForWeek
// ---------------------------------------------------------------------------------------------------------

describe('nutritionTargetsForWeek mit Wettkampf', () => {
  it('ohne Wettkampf (und mit abgesagtem) genau wie vorher – kein Feld `competition`', () => {
    const base = inputs({ goalType: 'fat_loss' });
    const plain = week(base);
    expect(week({ ...base, competitions: [] })).toEqual(plain);
    expect(week({ ...base, competitions: [competition({ status: 'cancelled' })] })).toEqual(plain);
    expect(plain.days.some((d) => 'competition' in d)).toBe(false);
  });

  it('Fettverlust: Rennwoche ohne Defizit, Carb-Loading mit mehr Kohlenhydraten, Fett ≥ 20 %', () => {
    const base = inputs({ goalType: 'fat_loss', secondaryGoalType: 'endurance' });
    const plain = week(base);
    const race = week({ ...base, competitions: [competition()] });
    for (const day of race.days) {
      expect(day.competition?.noDeficit).toBe(true);
      expect(day.goalAdjustment).toBeGreaterThanOrEqual(0);
      const before = dayOf(plain, day.date);
      expect(before.goalAdjustment).toBeLessThan(0);
      expect(day.targetKcal!).toBeGreaterThan(before.targetKcal!);
    }
    const friday = dayOf(race, FRIDAY);
    expect(friday.competition).toMatchObject({
      kind: 'carb_loading',
      carbLoading: true,
      carbsShifted: true,
      discipline: 'half_marathon',
      expectedMinutes: 165,
    });
    expect(9 * friday.fatG!).toBeGreaterThanOrEqual(0.2 * friday.targetKcal! - 1e-9);
    // Mehr Kohlenhydrate als derselbe Erhaltungstag ohne Carb-Loading (Mittwoch, gleiches Ziel).
    const wednesday = dayOf(race, '2026-10-14');
    expect(wednesday.targetKcal).toBe(friday.targetKcal);
    expect(friday.carbsG!).toBeGreaterThan(wednesday.carbsG!);
    expect(friday.proteinG).toBe(wednesday.proteinG);
    // 80 kg × 8 g/kg = 640 g passt nicht in ein Erhaltungsziel → Hinweis über `carbLoadingReached`.
    expect(friday.competition?.carbLoadingReached).toBe(false);
    expect(wednesday.competition).toMatchObject({
      kind: 'normal',
      carbLoading: false,
      carbsShifted: false,
    });
    expect(wednesday.competition?.carbLoadingReached).toBeNull();
  });

  it('Carb-Loading erreicht den Richtwert, wenn die Energie reicht (leichte Person, viel Alltag)', () => {
    const light = inputs({
      goalType: 'endurance',
      sex: 'female',
      activityLevel: 'very_active',
      bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 165, weightKg: 45 }],
      competitions: [competition()],
    });
    const friday = dayOf(week(light), FRIDAY);
    expect(friday.competition?.carbLoadingReached).toBe(true);
    expect(friday.carbsG!).toBeGreaterThanOrEqual(8 * 45 - 2.5);
  });

  it('Wettkampf unter 90 min: keine Verschiebung, aber Woche ohne Defizit', () => {
    const base = inputs({
      goalType: 'fat_loss',
      competitions: [competition({ discipline: '5k' })],
    });
    const targets = week(base);
    expect(targets.days.some((d) => d.competition?.carbsShifted === true)).toBe(false);
    expect(targets.days.every((d) => d.goalAdjustment === 0)).toBe(true);
    expect(dayOf(targets, SATURDAY).competition?.kind).toBe('race_eve');
  });

  it('Wettkampf am Montag: Carb-Loading in der Vorwoche, Freitag davor mit Defizit', () => {
    const base = inputs({
      goalType: 'fat_loss',
      competitions: [competition({ discipline: 'marathon', raceDate: NEXT_MONDAY })],
    });
    const before = week(base);
    expect(dayOf(before, FRIDAY).goalAdjustment).toBeLessThan(0);
    expect(dayOf(before, SATURDAY).competition).toMatchObject({
      kind: 'carb_loading',
      carbsShifted: true,
    });
    expect(dayOf(before, SUNDAY).competition).toMatchObject({
      kind: 'race_eve',
      carbsShifted: true,
    });
    const raceWeek = week({ ...base, today: NEXT_MONDAY }, NEXT_MONDAY);
    expect(raceWeek.days[0]?.competition?.kind).toBe('race_day');
    expect(raceWeek.days.every((d) => d.goalAdjustment === 0)).toBe(true);
  });

  it('Renntag: geschätzte Renn-Energie zählt (Deckel bleibt) – mit Ergebnis-Eintrag zählt nur der Eintrag', () => {
    const base = inputs({ goalType: 'endurance' });
    const plain = dayOf(week(base), SUNDAY);
    const race = dayOf(week({ ...base, competitions: [competition()] }), SUNDAY);
    // 80 kg, Laufen 7,0 MET (Ersatzwert), 165 min: (7 − 1) × 80 × 2,75 h = 1.320 kcal.
    expect(race.trainingKcal).toBe(1320);
    expect(race.competition?.raceEnergyIncluded).toBe(true);
    expect(race.targetKcal!).toBeGreaterThan(plain.targetKcal!);
    // Timing und Einheiten-Liste bleiben ohne Renn-Einheit (der Wettkampf ist keine geplante Einheit).
    expect(race.sessions).toEqual([]);
    const logged = dayOf(
      week({
        ...base,
        today: NEXT_MONDAY,
        competitions: [competition({ status: 'done', resultSessionLogId: 'log-1' })],
        sessions: [
          {
            ...run(SUNDAY, 118, 4),
            sessionId: 'free:log-1',
            planId: 'free',
            status: 'completed',
          },
        ],
      }),
      SUNDAY,
    );
    expect(logged.competition?.raceEnergyIncluded).toBe(false);
    expect(logged.trainingKcal).toBe(Math.round(6 * 80 * (118 / 60)));
    // Vergangener Renntag ohne Ergebnis (N5): keine geschätzte Renn-Energie.
    const past = dayOf(
      week({ ...base, today: NEXT_MONDAY, competitions: [competition()] }),
      SUNDAY,
    );
    expect(past.competition?.raceEnergyIncluded).toBe(false);
    expect(past.trainingKcal).toBe(0);
    // Heute ist Renntag: zählt.
    const today = dayOf(week({ ...base, today: SUNDAY, competitions: [competition()] }), SUNDAY);
    expect(today.competition?.raceEnergyIncluded).toBe(true);
  });

  it('Renntag trägt den Gel-/Trinkplan: Erwachsene mit Gramm, unter 18 und ohne Ziele nur allgemein', () => {
    const adult = dayOf(
      week(inputs({ goalType: 'endurance', competitions: [competition()] })),
      SUNDAY,
    );
    expect(adult.competition?.fueling).toMatchObject({
      expectedMinutes: 165,
      stage: 'moderate',
      notices: ['nothing_new', 'beginner_moderate_only', 'test_in_long_run', 'heat_and_salt'],
    });
    expect(adult.competition?.fueling?.steps[0]?.carbsG).toEqual({ min: 160, max: 320 });
    // Nur am Renntag.
    expect(
      dayOf(week(inputs({ competitions: [competition()] })), SATURDAY).competition?.fueling,
    ).toBeUndefined();
    const teen = dayOf(
      week(inputs({ birthDate: '2010-01-01', competitions: [competition()] })),
      SUNDAY,
    );
    expect(teen.competition?.fueling?.stage).toBe('general');
    expect(teen.competition?.fueling?.steps.every((step) => step.carbsG === null)).toBe(true);
    const none = dayOf(
      week(inputs({ healthDataConsent: false, competitions: [competition()] })),
      SUNDAY,
    );
    expect(none.competition?.fueling?.stage).toBe('general');
    expect(none.competition?.fueling?.steps.every((step) => step.carbsG === null)).toBe(true);
    // 18. Geburtstag am Renntag: ab dem Tag erwachsen (tagesgenau).
    const birthday = dayOf(
      week(inputs({ birthDate: '2008-10-18', competitions: [competition()] })),
      SUNDAY,
    );
    expect(birthday.competition?.fueling?.stage).toBe('moderate');
  });

  it('Marathon 300 kg: Renn-Energie über dem Tagesdeckel → gedeckelt mit Hinweis', () => {
    const heavy = inputs({
      goalType: 'endurance',
      bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 200, weightKg: 300 }],
      competitions: [competition({ discipline: 'marathon' })],
    });
    const race = dayOf(week(heavy), SUNDAY);
    expect(race.trainingKcal).toBe(3000);
    expect(race.notices).toContain('training_energy_capped');
  });

  it.each([
    ['16 Jahre', '2010-01-01', false],
    ['17 Jahre (18. Geburtstag erst nach dem Wettkampf)', '2008-10-20', false],
    ['18 Jahre (Geburtstag am Carb-Loading-Tag)', '2008-10-16', true],
  ])(
    'unter 18 keine Carb-Loading-Verschiebung, nur Erhalt (W1-G4): %s',
    (_, birthDate, shifted) => {
      const targets = week(
        inputs({ birthDate, goalType: 'endurance', competitions: [competition()] }),
      );
      const friday = dayOf(targets, FRIDAY);
      const wednesday = dayOf(targets, '2026-10-14');
      expect(friday.competition?.carbLoading).toBe(true);
      expect(friday.competition?.carbsShifted).toBe(shifted);
      expect(friday.competition?.carbLoadingReached).toBe(shifted ? false : null);
      if (!shifted) {
        expect(friday.targetKcal).toBe(wednesday.targetKcal);
        expect([friday.proteinG, friday.fatG, friday.carbsG]).toEqual([
          wednesday.proteinG,
          wednesday.fatG,
          wednesday.carbsG,
        ]);
      } else {
        // Ab dem 18. Geburtstag (tagesgenau) gilt die Verschiebung; Fett bleibt ≥ 20 %.
        expect(9 * friday.fatG!).toBeGreaterThanOrEqual(0.2 * friday.targetKcal! - 1e-9);
        expect(friday.carbsG! / friday.targetKcal!).toBeGreaterThan(
          wednesday.carbsG! / wednesday.targetKcal!,
        );
      }
    },
  );

  it('unter 18 (Fettverlust → nur Erhalt): Erhaltungsband, keine Verschiebung', () => {
    const teen = inputs({
      birthDate: '2010-01-01',
      goalType: 'fat_loss',
      competitions: [competition()],
    });
    const targets = week(teen);
    const friday = dayOf(targets, FRIDAY);
    expect(friday.mode).toBe('maintenance_only');
    expect(friday.competition?.carbsShifted).toBe(false);
    expect(friday.targetKcal).toBe(dayOf(targets, '2026-10-14').targetKcal);
    const limits = independentLimits({ birthDate: '2010-01-01' }, FRIDAY)!;
    expect(friday.targetKcal!).toBeGreaterThanOrEqual(limits.lower);
    expect(friday.targetKcal!).toBeLessThanOrEqual(limits.upper);
  });

  it('maintenance_only ohne Gesundheits-Check (Frau): Verschiebung im Erhaltungsband', () => {
    const p = inputs({
      sex: 'female',
      healthFlags: null,
      goalType: 'fat_loss',
      competitions: [competition()],
    });
    const friday = dayOf(week(p), FRIDAY);
    expect(friday.mode).toBe('maintenance_only');
    expect(friday.competition?.carbsShifted).toBe(true);
    expect(9 * friday.fatG!).toBeGreaterThanOrEqual(0.2 * friday.targetKcal! - 1e-9);
  });

  it.each([
    ['ohne Einwilligung', { healthDataConsent: false }],
    ['Schwangerschaft', { sex: 'female' as const, healthFlags: { flags: ['pregnancy' as const] } }],
  ])('no_targets (%s): nur die Art des Tages, keine Zahlen, keine Verschiebung', (_, overrides) => {
    const targets = week(inputs({ ...overrides, competitions: [competition()] }));
    const friday = dayOf(targets, FRIDAY);
    expect(friday.mode).toBe('no_targets');
    expect(friday.targetKcal).toBeNull();
    expect(friday.carbsG).toBeNull();
    expect(friday.competition).toMatchObject({
      kind: 'carb_loading',
      carbLoading: true,
      carbsShifted: false,
      carbLoadingReached: null,
      raceEnergyIncluded: false,
    });
    expect(dayOf(targets, SUNDAY).trainingKcal).toBeNull();
  });

  it('4b-Versatz: an Carb-Loading-Tagen 0, an anderen Tagen ohne Defizit nie negativ, sonst unverändert', () => {
    const base = inputs({ goalType: 'endurance', competitions: [competition()] });
    const zero = week(base);
    const minus = week(base, MONDAY, -300);
    const plus = week(base, MONDAY, 200);
    expect(dayOf(minus, FRIDAY).targetKcal).toBe(dayOf(zero, FRIDAY).targetKcal);
    expect(dayOf(plus, FRIDAY).targetKcal).toBe(dayOf(zero, FRIDAY).targetKcal);
    expect(dayOf(minus, '2026-10-13').targetKcal).toBe(dayOf(zero, '2026-10-13').targetKcal);
    expect(dayOf(plus, '2026-10-13').targetKcal!).toBeGreaterThan(
      dayOf(zero, '2026-10-13').targetKcal!,
    );
    // Ohne Wettkampf wirkt der Versatz wie bisher.
    const noRace = inputs({ goalType: 'endurance' });
    expect(dayOf(week(noRace, MONDAY, -300), FRIDAY).targetKcal!).toBeLessThan(
      dayOf(week(noRace), FRIDAY).targetKcal!,
    );
  });

  it('konkretes Abnehmziel ruht in der Wettkampfwoche, davor und danach wirkt es wie ohne Wettkampf (kein Aufholen)', () => {
    const goal: WeightGoal = {
      targetWeightKg: 75,
      startDate: PREVIOUS_MONDAY,
      targetDate: addDays(PREVIOUS_MONDAY, 26 * 7),
      amountMode: 'kg_to_lose',
      timeMode: 'weeks',
    };
    const base = inputs({ goalType: 'fat_loss', weightGoal: goal, today: PREVIOUS_MONDAY });
    const withRace = { ...base, competitions: [competition()] };
    const raceWeek = week(withRace);
    for (const day of raceWeek.days) {
      expect(day.weightGoalStatus).toBe('paused');
      expect(day.weightGoalPaceCapped).toBe(false);
      expect(day.goalAdjustment).toBe(0);
    }
    expect(raceWeek.weightGoalNotices).toEqual([]);
    // Woche davor und Woche danach (ab Dienstag): genau wie ohne Wettkampf.
    for (const monday of [PREVIOUS_MONDAY, NEXT_MONDAY]) {
      const a = week(withRace, monday).days.filter((d) => d.competition === undefined);
      const b = week(base, monday).days.filter((d) => a.some((x) => x.date === d.date));
      expect(a.length).toBeGreaterThanOrEqual(6);
      expect(a).toEqual(b);
    }
  });

  // 300 Zufallsfälle: unter CI-Last (viele parallele Läufe) über 5 s – eigener Zeitrahmen statt Standard.
  it(
    'Eigenschaft: Carb-Loading-Tag ≥ Untergrenze und ≤ Obergrenze, Fett ≥ 20 %, Eiweiß ≥ Minimum (wie ohne Verschiebung)',
    { timeout: 30_000 },
    () => {
      const random = seededRandom(1910);
      const goals = [
        'fat_loss',
        'definition',
        'muscle_gain',
        'general_fitness',
        'endurance',
      ] as const;
      const levels = ['beginner', 'advanced', 'competitive'] as const;
      const disciplines = ['5k', '10k', 'half_marathon', 'marathon'] as const;
      let checked = 0;
      for (let i = 0; i < 300; i += 1) {
        const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)] as T;
        const weightKg = Math.round(40 + random() * 160);
        const heightCm = Math.round(150 + random() * 50);
        const birthYear = 1940 + Math.floor(random() * 70); // 16 bis 86 Jahre
        const flags = random() < 0.2 ? (['medication'] as const) : ([] as const);
        const person: NutritionInputsInput = inputs({
          birthDate: `${birthYear}-03-15`,
          sex: pick(['male', 'female', 'diverse'] as const),
          goalType: pick(goals),
          experienceLevel: pick(levels),
          activityLevel: pick(['sedentary', 'light', 'active', 'very_active'] as const),
          bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm, weightKg }],
          healthFlags: { flags: [...flags] },
          competitions: [
            competition({
              discipline: pick(disciplines),
              raceDate: addDays(MONDAY, Math.floor(random() * 9)),
            }),
          ],
          sessions: random() < 0.5 ? [run('2026-10-14', 30 + Math.floor(random() * 60))] : [],
        });
        const targets = week(person);
        for (const day of targets.days) {
          if (day.competition?.carbsShifted !== true) continue;
          checked += 1;
          expect(day.targetKcal!).toBeGreaterThanOrEqual(day.floorKcal!);
          expect(day.targetKcal!).toBeLessThanOrEqual(day.ceilingKcal!);
          const limits = independentLimits(person, day.date);
          if (limits !== null && day.sessions.length === 0) {
            expect(day.targetKcal!).toBeGreaterThanOrEqual(limits.lower);
            expect(day.targetKcal!).toBeLessThanOrEqual(limits.upper);
          }
          expect(9 * day.fatG!).toBeGreaterThanOrEqual(0.2 * day.targetKcal! - 1e-9);
          expect(
            Math.abs(4 * day.proteinG! + 4 * day.carbsG! + 9 * day.fatG! - day.targetKcal!),
          ).toBeLessThanOrEqual(10);
          // Eiweiß wie ohne Verschiebung (also ≥ Minimum aus 4.7), Kohlenhydrate nie weniger, Fett nie mehr.
          const ref = proteinReferenceWeight(weightKg, heightCm);
          const eligibility = nutritionEligibility({
            ageYears: day.ageYears,
            sex: person.sex ?? null,
            goalType: person.goalType,
            secondaryGoalType: null,
            healthDataConsent: true,
            body: { weightKg, heightCm },
            healthFlags: [...flags],
          });
          const without = nutritionMacros({
            targetKcal: day.targetKcal!,
            goalType: person.goalType,
            weightKg,
            heightCm,
            proteinMin: eligibility.proteinMin,
            proteinCap: eligibility.proteinCap,
            trainingMinutes: day.sessions.reduce((sum, s) => sum + s.minutes, 0),
          });
          expect(day.proteinG).toBe(without.proteinG);
          expect(day.proteinG!).toBeGreaterThanOrEqual(eligibility.proteinMin * ref - 1e-9);
          expect(day.carbsG!).toBeGreaterThanOrEqual(without.carbsG);
          expect(day.fatG!).toBeLessThanOrEqual(without.fatG);
          expect(day.goalAdjustment!).toBeGreaterThanOrEqual(0);
        }
      }
      expect(checked).toBeGreaterThan(100);
    },
  );

  it('Makros: Verschiebung ändert Eiweiß nie, senkt Fett höchstens auf 20 % und hebt Kohlenhydrate', () => {
    for (const targetKcal of [1200, 1800, 2600, 3800]) {
      for (const weightKg of [40, 80, 200]) {
        const common = {
          targetKcal,
          goalType: 'endurance' as const,
          weightKg,
          heightCm: 175,
          proteinMin: 0,
          proteinCap: 2.2,
          trainingMinutes: 0,
        };
        const plain = nutritionMacros(common);
        const loaded = nutritionMacros({ ...common, carbsTargetGPerKg: 8 });
        expect(loaded.proteinG).toBe(plain.proteinG);
        expect(loaded.carbsG).toBeGreaterThanOrEqual(plain.carbsG);
        expect(loaded.fatG).toBeLessThanOrEqual(plain.fatG);
        expect(9 * loaded.fatG).toBeGreaterThanOrEqual(0.2 * targetKcal - 1e-9);
        expect(typeof loaded.carbsTargetReached).toBe('boolean');
        expect('carbsTargetReached' in plain).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------
// Essensplan: Wettkampf-Rezepte nur an Wettkampftagen, Neuplanung
// ---------------------------------------------------------------------------------------------------------

describe('Essensplan an Wettkampftagen (filter.ts, meal-plan.ts)', () => {
  const SUNDAY_BEFORE = '2026-10-11';
  const recipes: readonly Recipe[] = N3_RECIPES.map((r) =>
    r.id === 'overnight-oats' ? { ...r, categories: ['wettkampf' as const] } : r,
  );
  const plan = (competitions: NutritionCompetitionInput[]) => {
    const targets = week(
      inputs({ today: SUNDAY_BEFORE, mealsPerDay: 4, goalType: 'endurance', competitions }),
    );
    const input = {
      targets,
      profile: { diet: 'omnivore' as const, eatsPork: true },
      recipes,
      foods: N3_FOODS,
      allowDrafts: true,
      today: SUNDAY_BEFORE,
    };
    return { targets, input, week: buildMealPlanWeek(input) };
  };
  const daysWith = (p: ReturnType<typeof plan>['week'], id: string) =>
    p.days.filter((d) => d.meals.some((m) => m.recipeId === id)).map((d) => d.date);

  it('ohne Wettkampf nie im Plan; mit Wettkampf nur an Carb-Loading-Tagen, Vorabend und Renntag', () => {
    expect(daysWith(plan([]).week, 'overnight-oats')).toEqual([]);
    const withRace = plan([competition()]);
    const used = daysWith(withRace.week, 'overnight-oats');
    expect(used.length).toBeGreaterThan(0);
    for (const date of used) {
      expect(isCompetitionMealDay(dayOf(withRace.targets, date))).toBe(true);
    }
    expect(used.every((d) => [FRIDAY, SATURDAY, SUNDAY].includes(d))).toBe(true);
  });

  it('Wettkampf neu → Neuplanung mit Grund `competition_changed`; Abgesagt → wieder neu', () => {
    const before = plan([]);
    const after = plan([competition()]);
    const check = needsAutomaticReplan(before.week, after.input);
    expect(check.reasons).toContain('competition_changed');
    expect(check.reasons).not.toContain('caps_changed');
    expect(check.reasons).not.toContain('weight_goal_changed');
    const cancelled = plan([competition({ status: 'cancelled' })]);
    expect(needsAutomaticReplan(after.week, cancelled.input).reasons).toContain(
      'competition_changed',
    );
    // Ohne Wettkampf bleibt der Schlüssel wie bisher.
    expect(daySafetyKey(dayOf(before.targets, FRIDAY))).not.toContain('wk=');
    expect(daySafetyKey(dayOf(after.targets, FRIDAY))).toContain('wk=carb_loading:cl');
  });

  it('Zielzeit 85 → 95 min: Vorabend wird Carb-Loading-Tag → Neuplanung `competition_changed` (M3)', () => {
    const fast = competition({ targetTimeS: 85 * 60 });
    const slower = competition({ targetTimeS: 95 * 60 });
    const before = plan([fast]);
    const after = plan([slower]);
    expect(daySafetyKey(dayOf(before.targets, SATURDAY))).toMatch(/wk=race_eve$/);
    expect(daySafetyKey(dayOf(after.targets, SATURDAY))).toMatch(/wk=race_eve:cl$/);
    expect(needsAutomaticReplan(before.week, after.input).reasons).toContain('competition_changed');
  });
});
