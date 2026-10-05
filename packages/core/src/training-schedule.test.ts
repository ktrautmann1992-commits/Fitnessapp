import { describe, expect, it } from 'vitest';

import { ENDURANCE_START_RULES } from './constants';
import { ENDURANCE_DISCIPLINES, EXPERIENCE_LEVELS, GOAL_TYPES } from './enums';

import {
  deriveTrainingLocation,
  enduranceSlotSubtitle,
  groupSlots,
  hasHomeStrength,
  scheduleFromLegacyGoals,
  scheduleFromSlots,
  scheduleHints,
  scheduleToSlots,
  scheduleTotals,
  suggestedSlotKind,
  suggestedTrainingSlots,
  suggestedWeekSlots,
  trainingScheduleSchema,
  trainingSlotsSchema,
  weeklySessionCap,
  type TrainingSchedule,
} from './training-schedule';

const ok = (result: { success: boolean }) => expect(result.success).toBe(true);
const fail = (result: { success: boolean }) => expect(result.success).toBe(false);

const fixed = (...slots: [number, TrainingSchedule['slots'][number]['kind'], number][]) =>
  trainingScheduleSchema.parse({
    mode: 'fixed',
    slots: slots.map(([weekday, kind, minutes]) => ({ weekday, kind, minutes })),
  });
const flex = (...slots: [TrainingSchedule['slots'][number]['kind'], number][]) =>
  trainingScheduleSchema.parse({
    mode: 'flex',
    slots: slots.map(([kind, minutes]) => ({ kind, minutes })),
  });

describe('trainingScheduleSchema', () => {
  const day = (weekday: number, minutes = 30) => ({ weekday, kind: 'endurance', minutes });

  it('feste Tage: 1 und 7 erlaubt, 0 und 8 nicht', () => {
    ok(trainingScheduleSchema.safeParse({ mode: 'fixed', slots: [day(1)] }));
    ok(
      trainingScheduleSchema.safeParse({
        mode: 'fixed',
        slots: [1, 2, 3, 4, 5, 6, 7].map((d) => day(d)),
      }),
    );
    const none = trainingScheduleSchema.safeParse({ mode: 'fixed', slots: [] });
    fail(none);
    expect(none.error?.issues[0]?.message).toBe('Bitte wähle mindestens einen Trainingstag.');
    fail(
      trainingScheduleSchema.safeParse({
        mode: 'fixed',
        slots: [1, 2, 3, 4, 5, 6, 7, 1].map((d) => day(d)),
      }),
    );
  });

  it('Wochentag doppelt oder außerhalb 1–7 abgelehnt', () => {
    fail(trainingScheduleSchema.safeParse({ mode: 'fixed', slots: [day(2), day(2)] }));
    fail(trainingScheduleSchema.safeParse({ mode: 'fixed', slots: [day(0)] }));
    fail(trainingScheduleSchema.safeParse({ mode: 'fixed', slots: [day(8)] }));
  });

  it('Minuten 10 und 240 erlaubt; 9, 241 und 45,5 nicht', () => {
    ok(trainingScheduleSchema.safeParse({ mode: 'fixed', slots: [day(1, 10)] }));
    ok(trainingScheduleSchema.safeParse({ mode: 'fixed', slots: [day(1, 240)] }));
    const nine = trainingScheduleSchema.safeParse({ mode: 'fixed', slots: [day(1, 9)] });
    fail(nine);
    expect(nine.error?.issues[0]?.message).toBe('Minuten: mindestens 10.');
    fail(trainingScheduleSchema.safeParse({ mode: 'fixed', slots: [day(1, 241)] }));
    fail(trainingScheduleSchema.safeParse({ mode: 'fixed', slots: [day(1, 45.5)] }));
  });

  it('kein gemischter Modus: Wochentag nur bei „fixed“, Pflicht bei „fixed“', () => {
    fail(trainingScheduleSchema.safeParse({ mode: 'flex', slots: [day(1)] }));
    fail(
      trainingScheduleSchema.safeParse({
        mode: 'fixed',
        slots: [{ kind: 'endurance', minutes: 30 }],
      }),
    );
    fail(trainingScheduleSchema.safeParse({ mode: 'weekly', slots: [day(1)] }));
    fail(trainingScheduleSchema.safeParse({ mode: 'fixed', slots: [{ ...day(1), extra: 1 }] }));
  });

  it('„Tage egal“: Summe 1–7, 0 und 8 abgelehnt', () => {
    const slot = { kind: 'strength_gym', minutes: 60 };
    ok(trainingScheduleSchema.safeParse({ mode: 'flex', slots: Array(7).fill(slot) }));
    fail(trainingScheduleSchema.safeParse({ mode: 'flex', slots: Array(8).fill(slot) }));
    fail(trainingScheduleSchema.safeParse({ mode: 'flex', slots: [] }));
  });

  it('sortiert: feste Tage Mo → So, „Tage egal“ nach Art und Dauer', () => {
    const sorted = fixed([6, 'strength_home', 90], [1, 'endurance', 30]).slots;
    expect(sorted.map((s) => ('weekday' in s ? s.weekday : 0))).toEqual([1, 6]);
    expect(flex(['endurance', 30], ['strength_gym', 45], ['strength_gym', 60]).slots).toEqual([
      { kind: 'strength_gym', minutes: 60 },
      { kind: 'strength_gym', minutes: 45 },
      { kind: 'endurance', minutes: 30 },
    ]);
  });
});

describe('trainingSlotsSchema (= replace_training_slots)', () => {
  const row = (slot_no: number, weekday: number | null, minutes = 30) => ({
    slot_no,
    weekday,
    kind: 'endurance',
    minutes,
  });

  it('lückenlos 1…n, alle oder keiner mit Wochentag, Tag eindeutig', () => {
    ok(trainingSlotsSchema.safeParse([row(1, 1), row(2, 3)]));
    ok(trainingSlotsSchema.safeParse([row(2, null), row(1, null)]));
    fail(trainingSlotsSchema.safeParse([row(1, 1), row(3, 3)]));
    fail(trainingSlotsSchema.safeParse([row(1, 1), row(1, 3)]));
    fail(trainingSlotsSchema.safeParse([row(1, 1), row(2, null)]));
    fail(trainingSlotsSchema.safeParse([row(1, 4), row(2, 4)]));
  });

  it('0 und 8 Einträge abgelehnt, Minuten-Grenzen, unbekannte Felder', () => {
    fail(trainingSlotsSchema.safeParse([]));
    fail(trainingSlotsSchema.safeParse(Array.from({ length: 8 }, (_, i) => row(i + 1, null))));
    fail(trainingSlotsSchema.safeParse([row(1, null, 9)]));
    fail(trainingSlotsSchema.safeParse([row(1, null, 241)]));
    fail(trainingSlotsSchema.safeParse([{ ...row(1, null), user_id: 'x' }]));
  });

  it('scheduleToSlots / scheduleFromSlots sind zueinander passend', () => {
    const plan = fixed([6, 'strength_home', 90], [1, 'endurance', 30], [3, 'strength_gym', 60]);
    const slots = scheduleToSlots(plan);
    expect(slots).toEqual([
      { slot_no: 1, weekday: 1, kind: 'endurance', minutes: 30 },
      { slot_no: 2, weekday: 3, kind: 'strength_gym', minutes: 60 },
      { slot_no: 3, weekday: 6, kind: 'strength_home', minutes: 90 },
    ]);
    ok(trainingSlotsSchema.safeParse(slots));
    expect(scheduleFromSlots([...slots].reverse())).toEqual(plan);

    const loose = flex(['endurance', 30], ['strength_gym', 45]);
    expect(scheduleToSlots(loose).map((s) => s.weekday)).toEqual([null, null]);
    expect(scheduleFromSlots(scheduleToSlots(loose))).toEqual(loose);
    expect(scheduleFromSlots([])).toBeNull();
    expect(
      scheduleFromSlots([{ slot_no: 1, weekday: 1, kind: 'endurance', minutes: 5 }]),
    ).toBeNull();
  });
});

describe('Ableitungen', () => {
  it('deriveTrainingLocation: Studio, Zuhause, beides, nur Ausdauer', () => {
    expect(deriveTrainingLocation(fixed([1, 'strength_gym', 60]))).toBe('gym');
    expect(deriveTrainingLocation(flex(['strength_home', 60], ['endurance', 30]))).toBe('home');
    expect(deriveTrainingLocation(fixed([1, 'strength_gym', 60], [2, 'strength_home', 60]))).toBe(
      'both',
    );
    expect(deriveTrainingLocation(fixed([1, 'endurance', 30]))).toBeNull();
  });

  it('hasHomeStrength', () => {
    expect(hasHomeStrength(fixed([1, 'strength_home', 20]))).toBe(true);
    expect(hasHomeStrength(flex(['strength_gym', 60], ['endurance', 30]))).toBe(false);
  });

  it('suggestedSlotKind: Ausdauer-Ziel → Ausdauer, sonst Kraft im Studio', () => {
    expect(suggestedSlotKind('endurance')).toBe('endurance');
    expect(suggestedSlotKind('muscle_gain')).toBe('strength_gym');
    expect(suggestedSlotKind(undefined)).toBe('strength_gym');
  });

  it('enduranceSlotSubtitle nach Disziplin', () => {
    expect(enduranceSlotSubtitle(null)).toBe('running');
    expect(enduranceSlotSubtitle('5k')).toBe('running');
    expect(enduranceSlotSubtitle('marathon')).toBe('running');
    expect(enduranceSlotSubtitle('cycling')).toBe('cycling');
    expect(enduranceSlotSubtitle('swimming')).toBe('swimming');
    expect(enduranceSlotSubtitle('triathlon_sprint')).toBe('running_cycling');
    expect(enduranceSlotSubtitle('triathlon_long')).toBe('running_cycling');
  });

  it('scheduleTotals und groupSlots', () => {
    const plan = flex(
      ['strength_gym', 60],
      ['endurance', 30],
      ['strength_gym', 60],
      ['endurance', 30],
    );
    expect(scheduleTotals(plan)).toEqual({
      sessions: 4,
      minutesPerWeek: 180,
      byKind: { strength_gym: 2, strength_home: 0, endurance: 2 },
    });
    expect(groupSlots(plan.slots)).toEqual([
      { kind: 'strength_gym', minutes: 60, count: 2 },
      { kind: 'endurance', minutes: 30, count: 2 },
    ]);
  });
});

describe('weeklySessionCap', () => {
  const base = { experienceLevel: 'advanced', ageYears: 30, cautious: false } as const;

  it('Fortgeschritten/Leistungssport 18–64 ohne Vorsicht: kein Deckel', () => {
    expect(weeklySessionCap(base)).toBeNull();
    expect(weeklySessionCap({ ...base, experienceLevel: 'competitive', ageYears: 18 })).toBeNull();
    expect(weeklySessionCap({ ...base, ageYears: 64 })).toBeNull();
  });

  it('Einsteiger, vorsichtig, unter 18, ab 65, unbekannt: 5 Einheiten', () => {
    expect(weeklySessionCap({ ...base, experienceLevel: 'beginner' })).toBe(5);
    expect(weeklySessionCap({ ...base, cautious: true })).toBe(5);
    expect(weeklySessionCap({ ...base, ageYears: 16 })).toBe(5);
    expect(weeklySessionCap({ ...base, ageYears: 17 })).toBe(5);
    expect(weeklySessionCap({ ...base, ageYears: 65 })).toBe(5);
    expect(weeklySessionCap({ ...base, ageYears: 95 })).toBe(5);
    expect(weeklySessionCap({ ...base, ageYears: null })).toBe(5);
    expect(weeklySessionCap({ ...base, experienceLevel: undefined })).toBe(5);
  });
});

describe('scheduleHints', () => {
  const noCap = { goalType: 'general_fitness', weeklySessionCap: null } as const;

  it('ein einzelner Tag ohne Auffälligkeit: keine Hinweise', () => {
    expect(scheduleHints(fixed([3, 'strength_gym', 60]), noCap)).toEqual([]);
  });

  it('Ziel Ausdauer mit weniger als 2 Ausdauer-Tagen', () => {
    const plan = fixed([1, 'endurance', 30], [3, 'strength_gym', 60]);
    expect(scheduleHints(plan, { ...noCap, goalType: 'endurance' })).toEqual([
      'endurance_goal_no_endurance',
    ]);
    const two = fixed([1, 'endurance', 30], [4, 'endurance', 30]);
    expect(scheduleHints(two, { ...noCap, goalType: 'endurance' })).toEqual([]);
  });

  it('Muskelaufbau/Definition mit weniger als 2 Kraft-Tagen', () => {
    const plan = flex(['endurance', 30], ['strength_home', 45]);
    expect(scheduleHints(plan, { ...noCap, goalType: 'muscle_gain' })).toEqual([
      'strength_goal_no_strength',
    ]);
    expect(scheduleHints(plan, { ...noCap, goalType: 'definition' })).toEqual([
      'strength_goal_no_strength',
    ]);
    expect(scheduleHints(plan, { ...noCap, goalType: 'fat_loss' })).toEqual([]);
  });

  it('7 Tage Kraft (Fortgeschritten): über 4 Kraft-Tagen, hintereinander, kein Ruhetag', () => {
    const plan = fixed(
      ...[1, 2, 3, 4, 5, 6, 7].map(
        (d) => [d, 'strength_gym', 60] as [number, 'strength_gym', number],
      ),
    );
    expect(scheduleHints(plan, noCap)).toEqual([
      'strength_days_over_max',
      'strength_back_to_back',
      'no_rest_day',
    ]);
  });

  it('mit Gesamt-Deckel: über 5 Einheiten → week_total_capped statt no_rest_day', () => {
    const plan = flex(
      ...Array.from({ length: 6 }, () => ['endurance', 30] as ['endurance', number]),
    );
    expect(scheduleHints(plan, { ...noCap, weeklySessionCap: 5 })).toEqual(['week_total_capped']);
    expect(scheduleHints(plan, noCap)).toEqual([]);
    const five = flex(
      ...Array.from({ length: 5 }, () => ['endurance', 30] as ['endurance', number]),
    );
    expect(scheduleHints(five, { ...noCap, weeklySessionCap: 5 })).toEqual([]);
  });

  it('Kraft hintereinander auch So → Mo; Ausdauer dazwischen zählt nicht', () => {
    expect(scheduleHints(fixed([7, 'strength_home', 60], [1, 'strength_gym', 60]), noCap)).toEqual([
      'strength_back_to_back',
    ]);
    expect(
      scheduleHints(
        fixed([1, 'strength_gym', 60], [2, 'endurance', 30], [3, 'strength_gym', 60]),
        noCap,
      ),
    ).toEqual([]);
    // „Tage egal“: die Engine verteilt – kein Hinweis zu Nachbartagen.
    expect(scheduleHints(flex(['strength_gym', 60], ['strength_gym', 60]), noCap)).toEqual([]);
  });
});

describe('scheduleFromLegacyGoals (nur Gerätespeicher des Testmodus)', () => {
  it('Anzahl Wunsch-Tage = Tage pro Woche → feste Tage', () => {
    expect(
      scheduleFromLegacyGoals({
        sessions_per_week: 2,
        minutes_per_session: 45,
        preferred_days: [4, 1],
        training_location: 'home',
      }),
    ).toEqual({
      mode: 'fixed',
      slots: [
        { weekday: 1, kind: 'strength_home', minutes: 45 },
        { weekday: 4, kind: 'strength_home', minutes: 45 },
      ],
    });
  });

  it('sonst „Tage egal“; Studio, beides und ohne Ort → Kraft im Studio', () => {
    for (const training_location of ['gym', 'both', null] as const) {
      expect(
        scheduleFromLegacyGoals({
          sessions_per_week: 3,
          minutes_per_session: 60,
          preferred_days: [1],
          training_location,
        }),
      ).toEqual({
        mode: 'flex',
        slots: Array.from({ length: 3 }, () => ({ kind: 'strength_gym', minutes: 60 })),
      });
    }
  });

  it('ohne (vollständiges) altes Zeitbudget → null; 1 und 7 Tage', () => {
    expect(scheduleFromLegacyGoals({})).toBeNull();
    expect(scheduleFromLegacyGoals({ sessions_per_week: 3, minutes_per_session: null })).toBeNull();
    expect(
      scheduleFromLegacyGoals({ sessions_per_week: 1, minutes_per_session: 10 })?.slots,
    ).toHaveLength(1);
    expect(
      scheduleFromLegacyGoals({
        sessions_per_week: 7,
        minutes_per_session: 240,
        preferred_days: [1, 2, 3, 4, 5, 6, 7],
      })?.mode,
    ).toBe('fixed');
  });
});

describe('suggestedTrainingSlots (Ziel Ausdauer → Ausdauer-Tage vorbelegt)', () => {
  const base = {
    goalType: 'endurance' as const,
    discipline: 'marathon' as const,
    experienceLevel: 'advanced' as const,
    ageYears: 35,
    cautious: false,
  };
  const count = (s: TrainingSchedule | null) => scheduleTotals(s ?? { slots: [] }).byKind;

  it('andere Ziele → keine Vorbelegung', () => {
    for (const goalType of GOAL_TYPES.filter((g) => g !== 'endurance')) {
      expect(suggestedTrainingSlots({ ...base, goalType })).toBeNull();
    }
    expect(suggestedTrainingSlots({ ...base, goalType: undefined })).toBeNull();
  });

  it('Marathon, Fortgeschritten: 3× Ausdauer + 2× Kraft im Studio, feste Tage, kein Kraft-Tag hintereinander', () => {
    const s = suggestedTrainingSlots(base);
    expect(s?.mode).toBe('fixed');
    expect(count(s)).toEqual({ strength_gym: 2, strength_home: 0, endurance: 3 });
    expect(s?.slots).toEqual([
      { weekday: 1, kind: 'strength_gym', minutes: 60 },
      { weekday: 2, kind: 'endurance', minutes: 30 },
      { weekday: 4, kind: 'strength_gym', minutes: 60 },
      { weekday: 5, kind: 'endurance', minutes: 30 },
      { weekday: 6, kind: 'endurance', minutes: 30 },
    ]);
    expect(scheduleHints(s!, { goalType: 'endurance', weeklySessionCap: null })).toEqual([]);
  });

  it('Kraft-Ort aus bisheriger Auswahl (zu Hause)', () => {
    const s = suggestedTrainingSlots({ ...base, strengthKind: 'strength_home' });
    expect(count(s)).toEqual({ strength_gym: 0, strength_home: 2, endurance: 3 });
  });

  it('Einsteiger und vorsichtig: höchstens 5 Einheiten, Ausdauer im Deckel der Startgruppe', () => {
    const beginner = suggestedTrainingSlots({ ...base, experienceLevel: 'beginner' });
    expect(beginner?.slots).toHaveLength(5);
    expect(count(beginner).endurance).toBe(3);
    const cautious = suggestedTrainingSlots({ ...base, cautious: true });
    expect(count(cautious)).toEqual({ strength_gym: 1, strength_home: 0, endurance: 2 });
    expect(count(cautious).endurance).toBeLessThanOrEqual(
      ENDURANCE_START_RULES.maxSessionsPerWeek.cautious,
    );
    // unter 18, ab 65, Alter unbekannt, ohne Level → vorsichtig bzw. Deckel 5
    for (const ageYears of [16, 17, 65, 90, null]) {
      expect(count(suggestedTrainingSlots({ ...base, ageYears })).endurance).toBe(2);
    }
    const noLevel = suggestedTrainingSlots({ ...base, experienceLevel: null });
    expect(noLevel?.slots.length).toBeLessThanOrEqual(5);
  });

  it('Leistungssport: 4× Ausdauer + 2× Kraft (6 Tage, 1 Ruhetag); Triathlon 5 + 1', () => {
    const competitive = suggestedTrainingSlots({ ...base, experienceLevel: 'competitive' });
    expect(count(competitive)).toEqual({ strength_gym: 2, strength_home: 0, endurance: 4 });
    const tri = suggestedTrainingSlots({
      ...base,
      experienceLevel: 'competitive',
      discipline: 'triathlon_long',
    });
    expect(count(tri)).toEqual({ strength_gym: 1, strength_home: 0, endurance: 5 });
    const triAdvanced = suggestedTrainingSlots({ ...base, discipline: 'triathlon_sprint' });
    expect(count(triAdvanced)).toEqual({ strength_gym: 2, strength_home: 0, endurance: 4 });
  });

  it('alle Disziplinen × Level × vorsichtig: gültig, Deckel eingehalten, mind. 2 Ausdauer-Tage, ≥ 1 Ruhetag', () => {
    for (const discipline of [...ENDURANCE_DISCIPLINES, null]) {
      for (const experienceLevel of EXPERIENCE_LEVELS) {
        for (const cautious of [false, true]) {
          const input = { ...base, discipline, experienceLevel, cautious };
          const s = suggestedTrainingSlots(input);
          expect(s).not.toBeNull();
          expect(trainingScheduleSchema.safeParse(s).success).toBe(true);
          const cap = weeklySessionCap(input);
          const byKind = count(s);
          expect(s!.slots.length).toBeLessThanOrEqual(cap ?? 6);
          expect(byKind.endurance).toBeGreaterThanOrEqual(2);
          expect(byKind.endurance).toBeGreaterThan(byKind.strength_gym);
          expect(byKind.endurance).toBeLessThanOrEqual(
            ENDURANCE_START_RULES.maxSessionsPerWeek[cautious ? 'cautious' : experienceLevel],
          );
          const hints = scheduleHints(s!, { goalType: 'endurance', weeklySessionCap: cap });
          expect(hints).not.toContain('endurance_goal_no_endurance');
          expect(hints).not.toContain('week_total_capped');
          expect(hints).not.toContain('strength_back_to_back');
        }
      }
    }
  });
});

describe('suggestedWeekSlots (1–7 Tage)', () => {
  it('jede Kombination mit 1–7 Einheiten: richtige Anzahl je Art, gültig, Kraft nie direkt hintereinander, wenn möglich', () => {
    for (let total = 1; total <= 7; total += 1) {
      for (let strength = 0; strength <= Math.min(2, total); strength += 1) {
        const slots = suggestedWeekSlots(total - strength, strength);
        expect(slots).toHaveLength(total);
        expect(slots.filter((s) => s.kind === 'strength_gym')).toHaveLength(strength);
        const schedule = trainingScheduleSchema.parse({ mode: 'fixed', slots });
        if (total <= 6) {
          expect(scheduleHints(schedule, { goalType: null, weeklySessionCap: null })).not.toContain(
            'strength_back_to_back',
          );
        }
      }
    }
  });

  it('1 Tag → Samstag Ausdauer; 7 Tage → jeder Tag', () => {
    expect(suggestedWeekSlots(1, 0)).toEqual([{ weekday: 6, kind: 'endurance', minutes: 30 }]);
    expect(suggestedWeekSlots(5, 2).map((s) => s.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('ungültige Anzahl → leer', () => {
    expect(suggestedWeekSlots(0, 0)).toEqual([]);
    expect(suggestedWeekSlots(6, 2)).toEqual([]);
    expect(suggestedWeekSlots(-1, 2)).toEqual([]);
  });
});
