import { describe, expect, it } from 'vitest';

import { FREE_SESSION, SESSION_LOG_LIMITS, TRAINING_KCAL_DAY_MAX } from '../constants';
import { addDays } from '../dates';
import { ENDURANCE_MODALITIES, type LoadType } from '../enums';
import { sessionsForDay, trainingEnergy } from '../nutrition/energy';
import { nutritionSessionSchema } from '../nutrition/schemas';
import type { IncrementKind } from '../plan/loads';
import { loggedEnduranceMinutes } from './cardio';
import {
  dailyLogLimitReached,
  entryDateBlock,
  type FreeSessionInput,
  freeSessionDates,
  freeSessionLogFromInput,
  freeSessionName,
  freeSessionNutritionSessions,
  freeSessionPayloadIssue,
  type FreeStrengthExerciseInput,
  isBackfilledLog,
  logsCreatedOn,
} from './free-session';
import { type SessionLogPayload, sessionLogPayloadSchema } from './schemas';
import type { LoggedSet } from './types';

/** Heute: Donnerstag, 15.10.2026 (Europe/Berlin). */
const TODAY = '2026-10-15';
const NOW = '2026-10-15T12:00:00+02:00';

let counter = 0;
const uuid = () => {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
};

const set = (reps: number | null, weightKg: number | null, done = true): LoggedSet => ({
  reps,
  weightKg,
  durationS: null,
  rpe: null,
  done,
});

const exercise = (
  exerciseId: string,
  sets: LoggedSet[] = [set(10, 20), set(10, 20)],
  extra: Partial<FreeStrengthExerciseInput> = {},
): FreeStrengthExerciseInput => ({
  id: uuid(),
  exerciseId,
  nameDe: `Übung ${exerciseId}`,
  loadType: 'weight' as LoadType,
  incrementKind: 'free_weight' as IncrementKind,
  sets,
  weightConfirmed: false,
  ...extra,
});

const strength = (extra: Partial<FreeSessionInput> = {}): FreeSessionInput => ({
  id: uuid(),
  writeId: uuid(),
  kind: 'strength',
  performedOn: TODAY,
  today: TODAY,
  exercises: [exercise('goblet-kniebeuge')],
  cardio: null,
  sessionRpe: 7,
  notes: '',
  now: NOW,
  ...extra,
});

const endurance = (
  cardio: Partial<NonNullable<FreeSessionInput['cardio']>> = {},
  extra: Partial<FreeSessionInput> = {},
): FreeSessionInput => ({
  ...strength(),
  kind: 'endurance',
  exercises: [],
  cardio: { modality: 'run', hours: 0, minutes: 30, distanceKm: 5, elevationM: null, ...cardio },
  ...extra,
});

describe('Datum einer freien Einheit bzw. beim Nachtragen', () => {
  it.each([
    [TODAY, null],
    [addDays(TODAY, -1), null],
    [addDays(TODAY, -14), null],
    [addDays(TODAY, -15), 'too_old'],
    [addDays(TODAY, 1), 'future'],
    [addDays(TODAY, 30), 'future'],
  ] as const)('%s → %s', (date, expected) => {
    expect(entryDateBlock(date, TODAY)).toBe(expected);
  });

  it('freeSessionDates: heute bis 14 Tage zurück, heute zuerst (15 Tage)', () => {
    const dates = freeSessionDates(TODAY);
    expect(dates).toHaveLength(SESSION_LOG_LIMITS.backdateDays + 1);
    expect(dates[0]).toBe(TODAY);
    expect(dates.at(-1)).toBe('2026-10-01');
    expect(dates.every((d) => entryDateBlock(d, TODAY) === null)).toBe(true);
  });

  it('freeSessionDates über den Jahreswechsel', () => {
    expect(freeSessionDates('2027-01-05').at(-1)).toBe('2026-12-22');
  });
});

describe('„nachgetragen“ aus created_at und performed_on', () => {
  it('am selben Tag angelegt: nicht nachgetragen', () => {
    expect(isBackfilledLog({ performed_on: TODAY, created_at: '2026-10-15T18:00:00Z' })).toBe(
      false,
    );
  });
  it('am nächsten Tag angelegt: nachgetragen', () => {
    expect(
      isBackfilledLog({ performed_on: '2026-10-14', created_at: '2026-10-15T08:00:00Z' }),
    ).toBe(true);
  });
  it('Kalendertag in Europe/Berlin: 23:30 UTC ist schon der nächste Tag', () => {
    expect(
      isBackfilledLog({ performed_on: '2026-10-14', created_at: '2026-10-14T23:30:00Z' }),
    ).toBe(true);
    expect(
      isBackfilledLog({ performed_on: '2026-10-14', created_at: '2026-10-14T21:30:00Z' }),
    ).toBe(false);
  });
  it('Eintrag für morgen (Zeitzonen-Toleranz) ist nie nachgetragen', () => {
    expect(
      isBackfilledLog({ performed_on: '2026-10-16', created_at: '2026-10-15T20:00:00Z' }),
    ).toBe(false);
  });
  it('ungültiger Zeitstempel → nicht nachgetragen (kein Fehler)', () => {
    expect(isBackfilledLog({ performed_on: TODAY, created_at: 'kaputt' })).toBe(false);
  });
});

describe('Tageslimit (maxLogsPerDay)', () => {
  it('9 heute angelegt: noch möglich; 10: Limit', () => {
    expect(dailyLogLimitReached(9)).toBe(false);
    expect(dailyLogLimitReached(SESSION_LOG_LIMITS.maxLogsPerDay)).toBe(true);
    expect(dailyLogLimitReached(11)).toBe(true);
  });
  it('logsCreatedOn zählt nach Berliner Kalendertag, ungültige Zeitstempel nicht', () => {
    const logs = [
      { created_at: '2026-10-15T06:00:00Z' },
      { created_at: '2026-10-14T22:30:00Z' }, // 00:30 Berlin am 15.
      { created_at: '2026-10-14T21:00:00Z' },
      { created_at: 'kaputt' },
    ];
    expect(logsCreatedOn(logs, TODAY)).toBe(2);
    const ten = Array.from({ length: 10 }, () => ({ created_at: '2026-10-15T08:00:00Z' }));
    expect(dailyLogLimitReached(logsCreatedOn(ten, TODAY))).toBe(true);
  });
});

describe('Name aus fester Liste', () => {
  it('Kraft und jede Ausdauer-Art', () => {
    expect(freeSessionName('strength', null)).toBe(FREE_SESSION.names.strength);
    for (const modality of ENDURANCE_MODALITIES) {
      expect(freeSessionName('endurance', modality)).toBe(FREE_SESSION.names.endurance[modality]);
    }
  });
});

describe('freeSessionLogFromInput – Kraft', () => {
  it('gültig: frei, ohne Planbezug, ohne Vorgaben und Zustand, Name aus der Liste', () => {
    const result = freeSessionLogFromInput(strength({ notes: '  gut  ' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p = result.payload;
    expect(sessionLogPayloadSchema.safeParse(p).success).toBe(true);
    expect(p).toMatchObject({
      is_free: true,
      planned_session_id: null,
      planned_date: TODAY,
      performed_on: TODAY,
      name_de: 'Freie Kraft-Einheit',
      is_intro_week: false,
      is_deload: false,
      status: 'completed',
      notes: 'gut',
      base_revision: null,
      cardio: null,
    });
    const e = p.exercises[0];
    expect(e).toMatchObject({
      planned_exercise_id: null,
      status: 'done',
      target_sets: null,
      target_weight_kg: null,
      target_reps: null,
      state_weight_kg: null,
      state_extra_set: null,
      is_return: false,
    });
    expect(freeSessionPayloadIssue(p, TODAY)).toBeNull();
  });

  it('nur abgehakte Sätze werden gespeichert, neu nummeriert', () => {
    const result = freeSessionLogFromInput(
      strength({
        exercises: [exercise('a', [set(10, 20, false), set(8, 22.5), set(null, null, false)])],
      }),
    );
    expect(result.ok && result.payload.exercises[0]?.sets).toEqual([
      { set_no: 1, reps: 8, weight_kg: 22.5, duration_s: null, rpe: null, done: true },
    ]);
  });

  it('0 Sätze (nichts abgehakt) → no_sets', () => {
    const result = freeSessionLogFromInput(
      strength({ exercises: [exercise('a', [set(10, 20, false)])] }),
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toContain('no_sets');
  });

  it('ohne Übung → no_exercises', () => {
    const result = freeSessionLogFromInput(strength({ exercises: [] }));
    expect(!result.ok && result.errors).toEqual(['no_exercises']);
  });

  it('12 Übungen: ok; 13: too_many_exercises', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => exercise(`u${i}`));
    expect(freeSessionLogFromInput(strength({ exercises: twelve })).ok).toBe(true);
    const thirteen = [...twelve, exercise('u12')];
    const result = freeSessionLogFromInput(strength({ exercises: thirteen }));
    expect(!result.ok && result.errors).toContain('too_many_exercises');
  });

  it('10 Sätze: ok; 11: too_many_sets', () => {
    const ten = Array.from({ length: 10 }, () => set(5, 20));
    expect(freeSessionLogFromInput(strength({ exercises: [exercise('a', ten)] })).ok).toBe(true);
    const result = freeSessionLogFromInput(
      strength({ exercises: [exercise('a', [...ten, set(5, 20)])] }),
    );
    expect(!result.ok && result.errors).toContain('too_many_sets');
  });

  it('dieselbe Übung zweimal → duplicate_exercise', () => {
    const result = freeSessionLogFromInput(strength({ exercises: [exercise('a'), exercise('a')] }));
    expect(!result.ok && result.errors).toContain('duplicate_exercise');
  });

  it('Satz passt nicht zur Belastungsart → invalid_set', () => {
    const body = exercise('liegestuetz', [set(10, 5)], {
      loadType: 'bodyweight',
      incrementKind: 'none',
    });
    expect(!freeSessionLogFromInput(strength({ exercises: [body] })).ok).toBe(true);
    const noReps = exercise('a', [set(null, 20)]);
    const result = freeSessionLogFromInput(strength({ exercises: [noReps] }));
    expect(!result.ok && result.errors).toContain('invalid_set');
  });

  it('Halteübung: Dauer statt Wiederholungen', () => {
    const plank = exercise(
      'unterarmstuetz',
      [{ reps: null, weightKg: null, durationS: 45, rpe: null, done: true }],
      { loadType: 'time', incrementKind: 'none' },
    );
    const result = freeSessionLogFromInput(strength({ exercises: [plank] }));
    expect(result.ok && result.payload.exercises[0]?.sets[0]).toMatchObject({
      reps: null,
      weight_kg: null,
      duration_s: 45,
    });
  });

  it('Plausibilität: über der absoluten Schwelle nur mit Bestätigung (needsWeightConfirmation)', () => {
    const heavy = exercise('a', [set(5, 80)]); // Kurzhantel je Stück > 50 kg
    const result = freeSessionLogFromInput(strength({ exercises: [heavy] }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toEqual(['confirm_weight']);
    expect(result.warnings.sets).toEqual([
      { exerciseIndex: 0, setIndex: 0, warnings: ['confirm_absolute'] },
    ]);
    const confirmed = freeSessionLogFromInput(
      strength({ exercises: [{ ...heavy, weightConfirmed: true }] }),
    );
    expect(confirmed.ok).toBe(true);
    expect(confirmed.ok && confirmed.payload.exercises[0]?.weight_confirmed).toBe(true);
    // Warnung bleibt sichtbar, ist aber kein Fehler mehr.
    expect(confirmed.warnings.sets).toHaveLength(1);
  });

  it('Plausibilität: nicht abgehakte Sätze lösen keine Bestätigung aus', () => {
    const result = freeSessionLogFromInput(
      strength({ exercises: [exercise('a', [set(5, 400, false), set(5, 20)])] }),
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.sets).toEqual([]);
  });

  it('Gewicht unter der Schwelle: keine Warnung', () => {
    expect(freeSessionLogFromInput(strength()).warnings.sets).toEqual([]);
  });
});

describe('freeSessionLogFromInput – Ausdauer', () => {
  it('Lauf 30 min, 5 km: ok, Name „Lauf“', () => {
    const result = freeSessionLogFromInput(endurance());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toMatchObject({
      kind: 'endurance',
      name_de: 'Lauf',
      exercises: [],
      cardio: { modality: 'run', duration_s: 1800, distance_m: 5000, elevation_m: null },
      is_free: true,
      session_rpe: 7,
    });
    expect(result.warnings.cardio).toBe('ok');
  });

  it.each(ENDURANCE_MODALITIES)('Art %s: Name passend zur Art', (modality) => {
    const result = freeSessionLogFromInput(endurance({ modality, distanceKm: null }));
    expect(result.ok && result.payload.name_de).toBe(FREE_SESSION.names.endurance[modality]);
  });

  it('1 Minute: ok (Untergrenze)', () => {
    expect(freeSessionLogFromInput(endurance({ minutes: 1, distanceKm: null })).ok).toBe(true);
  });

  it('12 Stunden: ok; 12 h 1 min: Fehler duration_range', () => {
    expect(freeSessionLogFromInput(endurance({ hours: 12, minutes: 0, distanceKm: null })).ok).toBe(
      true,
    );
    const result = freeSessionLogFromInput(endurance({ hours: 12, minutes: 1, distanceKm: null }));
    expect(!result.ok && result.errors).toEqual(['cardio_invalid']);
    expect(!result.ok && result.cardioErrors).toEqual({ duration: 'duration_range' });
  });

  it('ohne Dauer: duration_missing', () => {
    const result = freeSessionLogFromInput(endurance({ hours: null, minutes: null }));
    expect(!result.ok && result.cardioErrors).toEqual({ duration: 'duration_missing' });
  });

  it('ohne Ausdauer-Angaben überhaupt: cardio_invalid', () => {
    const result = freeSessionLogFromInput(endurance({}, { cardio: null }));
    expect(!result.ok && result.errors).toEqual(['cardio_invalid']);
  });

  it('zu schnell (cardioPlausibility): nur Warnung, kein Fehler', () => {
    const result = freeSessionLogFromInput(endurance({ minutes: 10, distanceKm: 10 }));
    expect(result.ok).toBe(true);
    expect(result.warnings.cardio).toBe('check_speed');
  });

  it('Übungen bei Ausdauer → invalid', () => {
    const result = freeSessionLogFromInput(endurance({}, { exercises: [exercise('a')] }));
    expect(!result.ok && result.errors).toContain('invalid');
  });
});

describe('freeSessionLogFromInput – Datum und Notiz', () => {
  it('genau 14 Tage zurück: ok; 15: date_too_old; morgen: date_future', () => {
    expect(freeSessionLogFromInput(endurance({}, { performedOn: '2026-10-01' })).ok).toBe(true);
    const old = freeSessionLogFromInput(endurance({}, { performedOn: '2026-09-30' }));
    expect(!old.ok && old.errors).toEqual(['date_too_old']);
    const tomorrow = freeSessionLogFromInput(endurance({}, { performedOn: '2026-10-16' }));
    expect(!tomorrow.ok && tomorrow.errors).toEqual(['date_future']);
  });

  it('nachgetragen: planned_date = performed_on, keine Uhrzeiten', () => {
    const result = freeSessionLogFromInput(endurance({}, { performedOn: '2026-10-13' }));
    expect(result.ok && result.payload).toMatchObject({
      planned_date: '2026-10-13',
      performed_on: '2026-10-13',
      started_at: null,
      finished_at: null,
    });
  });

  it('Notiz: 280 Zeichen (Code-Points) ok, 281 zu lang', () => {
    expect(freeSessionLogFromInput(strength({ notes: '😀'.repeat(280) })).ok).toBe(true);
    const result = freeSessionLogFromInput(strength({ notes: 'x'.repeat(281) }));
    expect(!result.ok && result.errors).toEqual(['notes_too_long']);
  });

  it('Eigenschaft: jedes Ergebnis „ok“ ist Zod-gültig und erfüllt die Server-Regeln', () => {
    let seed = 7;
    const r = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    let ok = 0;
    for (let i = 0; i < 600; i += 1) {
      const kind = r() < 0.5 ? 'strength' : 'endurance';
      const performedOn = addDays(TODAY, Math.floor(r() * 18) - 16);
      const input: FreeSessionInput =
        kind === 'strength'
          ? strength({
              performedOn,
              exercises: Array.from({ length: Math.floor(r() * 14) }, (_, k) =>
                exercise(
                  `u${Math.floor(r() * 20)}-${k % 3 === 0 ? 'x' : k}`,
                  Array.from({ length: Math.floor(r() * 12) }, () =>
                    set(Math.floor(r() * 30), Math.round(r() * 120 * 2) / 2, r() < 0.8),
                  ),
                  { weightConfirmed: r() < 0.5 },
                ),
              ),
            })
          : endurance(
              {
                modality: ENDURANCE_MODALITIES[Math.floor(r() * 4)] ?? 'run',
                hours: Math.floor(r() * 14),
                minutes: Math.floor(r() * 70),
                distanceKm: r() < 0.3 ? null : Math.round(r() * 600 * 10) / 10,
              },
              { performedOn },
            );
      const result = freeSessionLogFromInput(input);
      if (!result.ok) continue;
      ok += 1;
      expect(sessionLogPayloadSchema.safeParse(result.payload).success).toBe(true);
      expect(freeSessionPayloadIssue(result.payload, TODAY)).toBeNull();
      expect(entryDateBlock(result.payload.performed_on, TODAY)).toBeNull();
    }
    expect(ok).toBeGreaterThan(50);
  });
});

describe('freeSessionPayloadIssue (= Regeln von save_session_log und Testmodus)', () => {
  const valid = (): SessionLogPayload => {
    const result = freeSessionLogFromInput(strength());
    if (!result.ok) throw new Error('Vorlage ungültig');
    return result.payload;
  };

  it('nicht freie Einträge: keine Prüfung', () => {
    expect(freeSessionPayloadIssue({ ...valid(), is_free: false }, TODAY)).toBeNull();
    const older: SessionLogPayload = { ...valid() };
    delete older.is_free;
    expect(freeSessionPayloadIssue(older, TODAY)).toBeNull();
  });

  it.each<[string, (p: SessionLogPayload) => SessionLogPayload, string]>([
    ['mit geplanter Einheit', (p) => ({ ...p, planned_session_id: uuid() }), 'invalid'],
    ['planned_date ≠ performed_on', (p) => ({ ...p, planned_date: '2026-10-12' }), 'invalid'],
    [
      '15 Tage zurück',
      (p) => ({ ...p, performed_on: '2026-09-30', planned_date: '2026-09-30' }),
      'date_window',
    ],
    [
      'morgen',
      (p) => ({ ...p, performed_on: '2026-10-16', planned_date: '2026-10-16' }),
      'date_window',
    ],
    ['Erholungswoche', (p) => ({ ...p, is_deload: true }), 'invalid'],
    ['Einstiegswoche', (p) => ({ ...p, is_intro_week: true }), 'invalid'],
    ['Freitext-Name', (p) => ({ ...p, name_de: 'Mein Training' }), 'invalid'],
    [
      'Vorgabe target_weight_kg',
      (p) => ({ ...p, exercises: p.exercises.map((e) => ({ ...e, target_weight_kg: 20 })) }),
      'invalid',
    ],
    [
      'Zustand state_target_reps',
      (p) => ({ ...p, exercises: p.exercises.map((e) => ({ ...e, state_target_reps: 8 })) }),
      'invalid',
    ],
    [
      'planned_exercise_id',
      (p) => ({ ...p, exercises: p.exercises.map((e) => ({ ...e, planned_exercise_id: uuid() })) }),
      'invalid',
    ],
    [
      'Status alternative',
      (p) => ({
        ...p,
        exercises: p.exercises.map((e) => ({ ...e, status: 'alternative' as const })),
      }),
      'invalid',
    ],
    [
      'Wiedereinstieg',
      (p) => ({ ...p, exercises: p.exercises.map((e) => ({ ...e, is_return: true })) }),
      'invalid',
    ],
  ])('%s → %s', (_label, change, expected) => {
    expect(freeSessionPayloadIssue(change(valid()), TODAY)).toBe(expected);
  });

  it('Ausdauer-Name muss zur Art passen', () => {
    const result = freeSessionLogFromInput(endurance({ modality: 'bike' }));
    if (!result.ok) throw new Error('Vorlage ungültig');
    expect(freeSessionPayloadIssue(result.payload, TODAY)).toBeNull();
    expect(freeSessionPayloadIssue({ ...result.payload, name_de: 'Lauf' }, TODAY)).toBe('invalid');
  });

  it('Zod: freie Einheit mit geplanter Einheit ist schon am Schema ungültig', () => {
    expect(
      sessionLogPayloadSchema.safeParse({ ...valid(), planned_session_id: uuid() }).success,
    ).toBe(false);
    expect(sessionLogPayloadSchema.safeParse({ ...valid(), is_free: 'ja' }).success).toBe(false);
    expect(sessionLogPayloadSchema.safeParse({ ...valid(), is_free: null }).success).toBe(false);
  });
});

describe('Trainingsenergie freier Einheiten fürs Tagesziel (A-G7)', () => {
  const freeLog = (
    id: string,
    kind: 'strength' | 'endurance',
    extra: { is_free?: boolean; session_rpe?: number | null; performed_on?: string } = {},
  ) => ({
    id,
    is_free: true,
    performed_on: '2026-10-14',
    kind,
    session_rpe: 5,
    ...extra,
  });
  const cardio = [{ session_log_id: 'run', modality: 'run' as const, duration_s: 1830 }];

  it('Ausdauer: Art, Minuten, Anstrengung 0–10 → 1–4', () => {
    const sessions = freeSessionNutritionSessions(
      [
        freeLog('run', 'endurance', { session_rpe: 8 }),
        freeLog('x', 'endurance'), // ohne Ausdauer-Zeile → ausgelassen
      ],
      { cardio, doneSets: new Map() },
    );
    expect(sessions).toEqual([
      {
        sessionId: 'free:run',
        planId: 'free',
        planStatus: 'active',
        scheduledOn: '2026-10-14',
        kind: 'endurance',
        enduranceModality: 'run',
        effortTarget: 4,
        minutes: 31,
        isDeload: false,
        status: 'completed',
      },
    ]);
    expect(nutritionSessionSchema.safeParse(sessions[0]).success).toBe(true);
  });

  it.each([
    [0, 1],
    [2, 2],
    [4, 4],
    [10, 4],
    [null, null],
  ])('Anstrengung %s → effortTarget %s', (rpe, expected) => {
    const [s] = freeSessionNutritionSessions([freeLog('run', 'endurance', { session_rpe: rpe })], {
      cardio,
      doneSets: new Map(),
    });
    expect(s?.effortTarget).toBe(expected);
  });

  it('Kraft: abgehakte Sätze × Minuten je Satz, gedeckelt', () => {
    const [few, many] = freeSessionNutritionSessions(
      [freeLog('a', 'strength'), freeLog('b', 'strength')],
      {
        cardio: [],
        doneSets: new Map([
          ['a', 9],
          ['b', 120],
        ]),
      },
    );
    expect(few?.minutes).toBe(9 * FREE_SESSION.strengthMinutesPerSet);
    expect(many?.minutes).toBe(FREE_SESSION.strengthMinutesMax);
    expect(few?.enduranceModality).toBeNull();
  });

  it('nicht freie Einträge zählen hier nicht (die zählen über ihre geplante Einheit)', () => {
    expect(
      freeSessionNutritionSessions([freeLog('run', 'endurance', { is_free: false })], {
        cardio,
        doneSets: new Map(),
      }),
    ).toEqual([]);
  });

  it('zählt am Tag (sessionsForDay) und erhöht nur die Trainingsenergie, Deckel bleibt', () => {
    const sessions = freeSessionNutritionSessions(
      [freeLog('run', 'endurance', { session_rpe: 3 })],
      { cardio, doneSets: new Map() },
    );
    const counted = sessionsForDay(sessions, '2026-10-14', TODAY);
    expect(counted).toHaveLength(1);
    const energy = trainingEnergy(counted, 70);
    expect(energy.netKcal).toBeGreaterThan(0);
    const huge = freeSessionNutritionSessions(
      Array.from({ length: 10 }, (_, i) => freeLog(`r${i}`, 'endurance')),
      {
        cardio: Array.from({ length: 10 }, (_, i) => ({
          session_log_id: `r${i}`,
          modality: 'run' as const,
          duration_s: 12 * 3600,
        })),
        doneSets: new Map(),
      },
    );
    expect(trainingEnergy(sessionsForDay(huge, '2026-10-14', TODAY), 150).netKcal).toBe(
      TRAINING_KCAL_DAY_MAX,
    );
  });
});

describe('10-%-Bezug der Ausdauer (loggedEnduranceMinutes)', () => {
  it('freie Einträge zählen nie – auch nicht mit (fehlerhaftem) Planbezug', () => {
    const minutes = loggedEnduranceMinutes([
      { plannedSessionId: 's1', durationS: 1800 },
      { plannedSessionId: null, durationS: 3600, isFree: true },
      { plannedSessionId: 's2', durationS: 7200, isFree: true },
    ]);
    expect([...minutes]).toEqual([['s1', 30]]);
  });
});
