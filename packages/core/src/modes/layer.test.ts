/**
 * Trainings-Modi im Anzeigeweg (docs/PLAN-TRAINING-MODI.md 6): prepareSessionForDisplay mit Reise- und Schmerz-Modus,
 * mit den echten Inhalten aus `content/`. Grenzfälle: alle Regionen × Stärken, 1 vs. 7 Trainingstage, keine
 * Alternative vorhanden, Reise und Schmerz gleichzeitig, „Nur heute“-Tausch auf eine gesperrte Übung, Rückkehr nach
 * dem Ende.
 */
import { describe, expect, it } from 'vitest';

import { PAIN_MODE, TEMPLATE_DOSAGE_LIMITS } from '../constants';
import type { Exercise } from '../content/schemas';
import { addDays } from '../dates';
import { BODY_REGIONS, PAIN_INTENSITIES, TRAVEL_EQUIPMENT_OPTIONS } from '../enums';
import { estimateSessionMinutes } from '../content/analysis';
import { equipmentProfile, isExerciseFeasible } from '../plan/equipment-profile';
import { generateTrainingPlan } from '../plan/generate';
import { planSafetyRules } from '../plan/safety';
import {
  daySwap,
  EXERCISES,
  ex,
  LIB,
  PLAN_ID,
  strengthSession,
  USER_ID,
  variantOf,
} from '../plan/swap-test-helpers';
import { FULL_HOME, MONDAY, person } from '../plan/test-library';
import {
  type DisplayContext,
  exerciseMark,
  prepareSessionForDisplay,
  type StoredSession,
} from '../plan/view';
import { applyModesToEndurance, reduceDosage } from './layer';
import { type PainEpisode, isBlockedByPain, painEffectOn } from './pain';
import { travelOnDay, type TravelMode } from './travel';

const healthy = planSafetyRules(person(), MONDAY);
const gym = equipmentProfile('gym', []);
const home = equipmentProfile('home', FULL_HOME);

function ctx(overrides: Partial<DisplayContext> = {}): DisplayContext {
  return {
    rules: healthy,
    previousStartGroup: 'beginner',
    library: EXERCISES,
    substituteLibrary: EXERCISES,
    profile: gym,
    ...overrides,
  };
}

let n = 0;
function pain(
  region: PainEpisode['region'],
  intensity: PainEpisode['intensity'],
  duration: 3 | 7 | 14 = 7,
  startedOn = MONDAY,
): PainEpisode {
  n += 1;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    region,
    intensity,
    duration_days: duration,
    started_on: startedOn,
    ended_early_on: null,
    created_at: `${startedOn}T08:00:00Z`,
  };
}

function travel(
  equipment: TravelMode['equipment'],
  maxMinutes: TravelMode['max_minutes'] = null,
  starts = MONDAY,
  ends = addDays(MONDAY, 6),
): TravelMode {
  n += 1;
  return {
    id: `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`,
    starts_on: starts,
    ends_on: ends,
    equipment,
    max_minutes: maxMinutes,
    created_at: `${MONDAY}T08:00:00Z`,
  };
}

const GYM_SESSION = strengthSession([
  'kniebeuge-langhantel',
  'bankdruecken-langhantel',
  'latziehen',
  'rumaenisches-kreuzheben-langhantel',
  'schulterdruecken-kurzhantel',
  'bizepscurl-kurzhantel',
]);

const shownIds = (s: { session: { exercises: readonly { exercise_id: string }[] } }) =>
  s.session.exercises.map((e) => e.exercise_id);

describe('ohne Modus: Anzeige unverändert (Regression)', () => {
  it('ohne `modes` keine neuen Felder; mit leeren Modi gleiche Einheit', () => {
    const plain = prepareSessionForDisplay(GYM_SESSION, ctx());
    expect(plain.modeNotices).toBeUndefined();
    expect(plain.modeSwapped).toBeUndefined();
    const empty = prepareSessionForDisplay(GYM_SESSION, ctx({ modes: {} }));
    expect(empty.session).toEqual(plain.session);
    expect(empty.modeNotices).toEqual([]);
    expect(empty.emptyByMode).toBe(false);
  });
});

describe('Reise-Modus', () => {
  it.each(TRAVEL_EQUIPMENT_OPTIONS)(
    '%s: jede angezeigte Übung ist mit den Reise-Geräten machbar; Kennzeichen „travel_swap“',
    (equipment) => {
      const day = travelOnDay([travel(equipment)], MONDAY);
      expect(day).not.toBeNull();
      const shown = prepareSessionForDisplay(GYM_SESSION, ctx({ modes: { travel: day } }));
      expect(shown.session.exercises.length).toBeGreaterThan(0);
      for (const e of shown.session.exercises) {
        expect(
          isExerciseFeasible(ex(e.exercise_id), { available: day!.available }),
          e.exercise_id,
        ).toBe(true);
      }
      expect(shown.modeNotices).toContain('travel_active');
      expect(shown.modeNotices).toContain('travel_swapped');
      const first = shown.session.exercises[0]!;
      expect(
        exerciseMark(first, GYM_SESSION, ctx(), {
          storedOrderNo: shown.storedOrderNos![0]!,
          display: shown,
        }),
      ).toBe('travel_swap');
      // Zuordnung zur gespeicherten Übung bleibt (Tagebuch).
      expect(shown.storedOrderNos).toHaveLength(shown.session.exercises.length);
    },
  );

  it('Schlingentrainer ohne eigene Übungen = Rückfall auf Körpergewicht (gleiche Anzeige)', () => {
    const sling = prepareSessionForDisplay(
      GYM_SESSION,
      ctx({ modes: { travel: travelOnDay([travel('suspension_trainer')], MONDAY) } }),
    );
    const bodyweight = prepareSessionForDisplay(
      GYM_SESSION,
      ctx({ modes: { travel: travelOnDay([travel('bodyweight')], MONDAY) } }),
    );
    expect(shownIds(sling)).toEqual(shownIds(bodyweight));
  });

  it('Hotel-Gym: Kurzhantel-Übungen bleiben, Langhantel wird getauscht', () => {
    const shown = prepareSessionForDisplay(
      GYM_SESSION,
      ctx({ modes: { travel: travelOnDay([travel('hotel_gym')], MONDAY) } }),
    );
    expect(shownIds(shown)).toContain('schulterdruecken-kurzhantel');
    expect(shownIds(shown)).not.toContain('kniebeuge-langhantel');
  });

  it('kürzere Einheit: höchstens die Reise-Minuten (oder mindestens 3 Übungen), Hinweis', () => {
    const day = travelOnDay([travel('dumbbells', 20)], MONDAY);
    const shown = prepareSessionForDisplay(GYM_SESSION, ctx({ modes: { travel: day } }));
    expect(shown.modeNotices).toContain('travel_shortened');
    expect(shown.session.exercises.length).toBeGreaterThanOrEqual(3);
    const minutes = estimateSessionMinutes({ exercises: [...shown.session.exercises] });
    expect(minutes <= 20 || shown.session.exercises.length === 3).toBe(true);
  });

  it('nach dem letzten Reisetag gilt automatisch wieder der Plan', () => {
    const modes = [travel('bodyweight', null, MONDAY, addDays(MONDAY, 2))];
    const after = addDays(MONDAY, 3);
    expect(travelOnDay(modes, after)).toBeNull();
    const session = { ...GYM_SESSION, scheduled_on: after };
    const shown = prepareSessionForDisplay(
      session,
      ctx({ modes: { travel: travelOnDay(modes, after) } }),
    );
    expect(shown.session).toEqual(prepareSessionForDisplay(session, ctx()).session);
  });

  it('Ausdauer: Reise-Minuten kürzen nur (nie verlängern), Ablauf-Einheiten bleiben', () => {
    const run = {
      kind: 'endurance' as const,
      estimated_minutes: 45,
      effort_target: 4,
    };
    const day = travelOnDay([travel('bodyweight', 30)], MONDAY);
    expect(applyModesToEndurance(run, { travel: day }).session.estimated_minutes).toBe(30);
    expect(
      applyModesToEndurance({ ...run, estimated_minutes: 20 }, { travel: day }).session
        .estimated_minutes,
    ).toBe(20);
    const fixed = { ...run, workout_steps: [{ kind: 'work' }] };
    expect(applyModesToEndurance(fixed, { travel: day }).session).toBe(fixed);
  });
});

describe('Schmerz-Modus: alle Regionen × Stärken', () => {
  const plans = [
    { label: 'Studio', session: GYM_SESSION, profile: gym },
    {
      label: 'Zuhause',
      session: strengthSession([
        'goblet-kniebeuge',
        'liegestuetz',
        'rudern-band',
        'rumaenisches-kreuzheben-kurzhantel',
        'schulterdruecken-band',
        'unterarmstuetz',
      ]),
      profile: home,
    },
  ];
  for (const { label, session, profile } of plans) {
    for (const region of BODY_REGIONS) {
      for (const intensity of PAIN_INTENSITIES) {
        it(`${label} · ${region} · ${intensity}: keine belastende Übung, Dosierung nur gesenkt`, () => {
          const effect = painEffectOn([pain(region, intensity)], MONDAY)!;
          const before = prepareSessionForDisplay(session, ctx({ profile }));
          const shown = prepareSessionForDisplay(
            session,
            ctx({ profile, modes: { pain: effect } }),
          );
          for (const e of shown.session.exercises) {
            expect(isBlockedByPain(ex(e.exercise_id), effect), e.exercise_id).toBe(false);
            expect(e.sets).toBeGreaterThanOrEqual(PAIN_MODE.minSets);
            expect(e.rpe_target).toBeGreaterThanOrEqual(TEMPLATE_DOSAGE_LIMITS.rpe.min);
            if (effect.conservative) {
              expect(e.rpe_target).toBeLessThanOrEqual(PAIN_MODE.conservative.rpeMax);
            }
          }
          expect(shown.modeNotices).toContain('pain_active');
          expect(shown.modeNotices?.includes('pain_medical_advice')).toBe(intensity === 'severe');
          // Nie schwerer als vorher: je gespeicherter Position weniger/gleich Sätze und RPE, nie schwierigere Übung.
          shown.session.exercises.forEach((e, i) => {
            const orderNo = shown.storedOrderNos![i]!;
            const index = before.storedOrderNos!.indexOf(orderNo);
            const prev = before.session.exercises[index]!;
            expect(e.sets).toBeLessThanOrEqual(prev.sets);
            expect(e.rpe_target).toBeLessThanOrEqual(prev.rpe_target);
            expect(ex(e.exercise_id).difficulty).toBeLessThanOrEqual(
              ex(prev.exercise_id).difficulty,
            );
          });
          expect(shown.storedOrderNos).toHaveLength(shown.session.exercises.length);
          expect(shown.hidden).toEqual(before.hidden);
        });
      }
    }
  }

  it('Knie mittel: Beintag ohne Kniebeugen/Ausfallschritte, Hüftstrecken bleibt; Kennzeichen „pain_swap“', () => {
    const legs = strengthSession([
      'kniebeuge-langhantel',
      'beinpresse',
      'split-kniebeuge',
      'hip-thrust-langhantel',
    ]);
    const effect = painEffectOn([pain('knee', 'moderate')], MONDAY)!;
    const shown = prepareSessionForDisplay(legs, ctx({ modes: { pain: effect } }));
    const ids = shownIds(shown);
    expect(ids).toContain('hip-thrust-langhantel');
    for (const id of ids) expect(['squat', 'lunge']).not.toContain(ex(id).movement_pattern);
    const swapped = shown.modeSwapped ?? [];
    for (const record of swapped) expect(record.reason).toBe('pain');
    if (swapped[0]) {
      const i = shown.storedOrderNos!.indexOf(swapped[0].storedOrderNo);
      expect(
        exerciseMark(shown.session.exercises[i]!, legs, ctx(), {
          storedOrderNo: swapped[0].storedOrderNo,
          display: shown,
        }),
      ).toBe('pain_swap');
    }
  });

  it('Dosierung: leicht nur RPE −1, mittel Sätze −1, stark RPE −2 und konservativ ≤ 6', () => {
    const base = strengthSession(['beinpresse']).exercises[0]!;
    expect(reduceDosage(base, 1, 0, 9)).toMatchObject({ sets: 3, rpe_target: 7 });
    expect(reduceDosage(base, 1, 1, 9)).toMatchObject({ sets: 2, rpe_target: 7 });
    expect(reduceDosage(base, 2, 1, 6)).toMatchObject({ sets: 2, rpe_target: 6 });
    expect(reduceDosage({ ...base, sets: 1, rpe_target: 5 }, 2, 1, 6)).toMatchObject({
      sets: 1,
      rpe_target: 5,
    });
    expect(reduceDosage({ ...base, rpe_target: 5.5 }, 1, 0, 9).rpe_target).toBe(5);
  });

  it('keine Alternative vorhanden: Übung entfällt, leere Einheit → eigener Hinweis', () => {
    const only = new Map<string, Exercise>(
      ['split-kniebeuge', 'step-up-stufe'].map((id) => [id, ex(id)]),
    );
    const session = strengthSession(['split-kniebeuge', 'step-up-stufe']);
    const effect = painEffectOn([pain('knee', 'mild')], MONDAY)!;
    const shown = prepareSessionForDisplay(
      session,
      ctx({ library: only, substituteLibrary: only, profile: home, modes: { pain: effect } }),
    );
    expect(shown.session.exercises).toEqual([]);
    expect(shown.hiddenByMode).toEqual(['split-kniebeuge', 'step-up-stufe']);
    expect(shown.emptyByMode).toBe(true);
    expect(shown.modeNotices).toEqual(
      expect.arrayContaining(['pain_removed', 'pain_session_empty']),
    );
    // Ausgeblendet durch den Modus löst NIE „Plan neu erstellen“ aus.
    expect(shown.hidden).toEqual([]);
  });

  it('ohne Geräte-Profil (offline) wird eine belastende Übung ausgeblendet statt ersetzt', () => {
    const effect = painEffectOn([pain('elbow', 'mild')], MONDAY)!;
    const shown = prepareSessionForDisplay(
      strengthSession(['bizepscurl-kurzhantel', 'beinpresse']),
      { ...ctx({ modes: { pain: effect } }), profile: undefined },
    );
    expect(shownIds(shown)).toEqual(['beinpresse']);
  });

  it('„Nur heute“-Tausch auf eine gesperrte Übung wird überstimmt (Schmerz-Schicht läuft zuletzt)', () => {
    const session = strengthSession(['beinpresse', 'bankdruecken-kurzhantel']);
    const effect = painEffectOn([pain('knee', 'moderate')], MONDAY)!;
    const withSwap: DisplayContext = {
      ...ctx({ modes: { pain: effect } }),
      swap: {
        swapRules: healthy,
        location: 'gym',
        daySwaps: {
          swaps: [daySwap(1, 'beinpresse', 'goblet-kniebeuge')],
          planId: PLAN_ID,
          ownerUserId: USER_ID,
          today: MONDAY,
        },
      },
    };
    const shown = prepareSessionForDisplay(session, withSwap);
    for (const id of shownIds(shown)) expect(isBlockedByPain(ex(id), effect), id).toBe(false);
  });

  it('nach dem Ende gilt wieder der Plan (automatisch, auch nach vorzeitigem Ende)', () => {
    const e = pain('shoulder', 'moderate', 3);
    expect(painEffectOn([e], addDays(MONDAY, 3))).toBeNull();
    expect(
      painEffectOn([{ ...e, ended_early_on: addDays(MONDAY, 1) }], addDays(MONDAY, 1)),
    ).toBeNull();
  });

  it('synthetische Übung ohne Merkmale, aber mit Hauptmuskel Quadrizeps: bei „mittel“ fürs Knie gesperrt', () => {
    const odd = variantOf('beinpresse', { id: 'neu-maschine', movement_pattern: 'carry' });
    const effect = painEffectOn([pain('knee', 'moderate')], MONDAY)!;
    expect(isBlockedByPain(odd, effect)).toBe(true);
  });
});

describe('Ausdauer bei Schmerz', () => {
  const run = { kind: 'endurance' as const, estimated_minutes: 40, effort_target: 4 };
  it.each(BODY_REGIONS)(
    '%s mittel: Unterkörper → kürzer und locker; Oberkörper unverändert',
    (region) => {
      const effect = painEffectOn([pain(region, 'moderate')], MONDAY)!;
      const result = applyModesToEndurance(run, { pain: effect });
      if (['knee', 'hip', 'ankle', 'lower_back'].includes(region)) {
        expect(result.session.estimated_minutes).toBe(28);
        expect(result.session.effort_target).toBe(3);
        expect(result.notices).toEqual(['pain_endurance_easier']);
      } else {
        expect(result.session).toBe(run);
        expect(result.notices).toEqual([]);
      }
    },
  );

  it('leicht: unverändert; kurze Einheit nie unter 10 min gekürzt (und nie verlängert)', () => {
    expect(
      applyModesToEndurance(run, { pain: painEffectOn([pain('knee', 'mild')], MONDAY)! }).session,
    ).toBe(run);
    const short = { ...run, estimated_minutes: 12 };
    const effect = painEffectOn([pain('knee', 'severe')], MONDAY)!;
    expect(applyModesToEndurance(short, { pain: effect }).session.estimated_minutes).toBe(10);
    const tiny = { ...run, estimated_minutes: 8 };
    expect(applyModesToEndurance(tiny, { pain: effect }).session.estimated_minutes).toBe(8);
  });

  it('Wettkampf-Einheit mit festem Ablauf: nur Hinweis', () => {
    const fixed = { ...run, workout_steps: [{ kind: 'work' }] };
    const result = applyModesToEndurance(fixed, {
      pain: painEffectOn([pain('ankle', 'moderate')], MONDAY)!,
    });
    expect(result.session).toBe(fixed);
    expect(result.notices).toEqual(['pain_endurance_check']);
  });
});

describe('ganze Pläne: 1 vs. 7 Trainingstage, Reise + Schmerz gleichzeitig', () => {
  const asStored = (sessions: readonly Omit<StoredSession, 'id' | 'status' | 'original_date'>[]) =>
    sessions.map((s, i) => ({
      ...s,
      id: `00000000-0000-4000-a000-${String(i).padStart(12, '0')}`,
      status: 'planned' as const,
      original_date: null,
    }));

  const oneDay = generateTrainingPlan(
    person({ sessionsPerWeek: 1, preferredDays: [3] }),
    LIB,
    MONDAY,
  );
  const sevenDays = generateTrainingPlan(
    person({
      schedule: {
        mode: 'fixed',
        slots: [
          { weekday: 1, kind: 'strength_gym', minutes: 60 },
          { weekday: 2, kind: 'endurance', minutes: 40 },
          { weekday: 3, kind: 'strength_gym', minutes: 60 },
          { weekday: 4, kind: 'endurance', minutes: 40 },
          { weekday: 5, kind: 'strength_gym', minutes: 60 },
          { weekday: 6, kind: 'endurance', minutes: 40 },
          { weekday: 7, kind: 'strength_gym', minutes: 45 },
        ],
      },
      experienceLevel: 'advanced',
    }),
    LIB,
    MONDAY,
  );

  it.each([
    ['1 Tag', oneDay],
    ['7 Tage', sevenDays],
  ] as const)(
    '%s: jede Einheit im Zeitraum mit Reise (Körpergewicht, 30 min) + Handgelenk stark',
    (_, result) => {
      if (!result.ok) throw new Error(result.error);
      const sessions = asStored(result.plan.sessions);
      const modes = [travel('bodyweight', 30, MONDAY, addDays(MONDAY, 20))];
      const episodes = [pain('wrist', 'severe', 14, MONDAY)];
      let strength = 0;
      for (const s of sessions) {
        const t = travelOnDay(modes, s.scheduled_on);
        const p = painEffectOn(episodes, s.scheduled_on);
        const shown = prepareSessionForDisplay(s, ctx({ modes: { travel: t, pain: p } }));
        if (s.kind === 'strength' && t && p) {
          strength += 1;
          for (const e of shown.session.exercises) {
            expect(ex(e.exercise_id).equipment_ids, e.exercise_id).toEqual([]);
            expect(isBlockedByPain(ex(e.exercise_id), p), e.exercise_id).toBe(false);
            expect(e.rpe_target).toBeLessThanOrEqual(PAIN_MODE.conservative.rpeMax);
          }
          expect(shown.modeNotices).toEqual(
            expect.arrayContaining(['travel_active', 'pain_active', 'pain_medical_advice']),
          );
        }
        if (s.kind === 'endurance' && t) {
          expect(shown.session.estimated_minutes).toBeLessThanOrEqual(30);
        }
        if (!t && !p) {
          expect(shown.session).toEqual(prepareSessionForDisplay(s, ctx()).session);
        }
      }
      expect(strength).toBeGreaterThan(0);
    },
  );
});
