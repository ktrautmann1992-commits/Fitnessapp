import { randomUUID } from 'node:crypto';

import {
  type Exercise,
  freeSessionLogFromInput,
  isBackfilledLog,
  type PlanLibrary,
  type PlanSafetyRules,
  type SessionLogPayload,
  sessionLogPayloadSchema,
  toSavePlanPayload,
  weekLogSummary,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { planPersonRows, seededBackend, USER_ID, VERSIONS } from '../test/fixtures';
import type { Backend } from './backend';
import { backfillDatesFromRows, backfillDayFromRows, freeExerciseCandidates } from './backfill';
import { createMemoryStore } from './kv';
import { createLocalBackend } from './local-backend';
import { checkSessionLog } from './local-rules';
import { summaryInputs } from './log-summary';
import { nutritionInputsFromRows } from './nutrition-plan';
import { createMemoryProtectedStore } from './protected-store';
import { activePlan, effectiveSafetyRules, generatePlanFromRows } from './training-plan';
import type { UserRows } from './types';
import {
  createFreeDraft,
  currentTarget,
  draftToPayload,
  freeDraftKey,
  freeDraftResult,
  isValidPayload,
  refreshFreeDraft,
  removeDraftExercise,
  setCardioFields,
  setPerformedOn,
  setSkipped,
  updateSet,
  type WorkoutDraft,
} from './workout-draft';
import { newWorkoutDraft, workoutView } from './workout-session';

/**
 * Etappe A1b (docs/PLAN-AUSWERTUNG.md 4) im Testmodus: freie Einheit und Nachtragen einer geplanten Einheit – gleiche
 * Regeln wie save_session_log (local-rules.ts), Wirkung auf Woche, Progression und Tagesziel.
 */

const MONDAY = '2026-10-05';
const WEDNESDAY = '2026-10-07';

interface Setup {
  backend: Backend;
  rows: UserRows;
  library: PlanLibrary;
  rules: PlanSafetyRules;
  store: ReturnType<typeof createMemoryStore>;
}

async function setup(): Promise<Setup> {
  const person = planPersonRows();
  const seeded = seededBackend(person, MONDAY, `${MONDAY}T08:00:00.000Z`);
  const backend = createLocalBackend(seeded.store, {
    platform: 'web',
    today: () => MONDAY,
    now: () => `${MONDAY}T17:00:00.000Z`,
    newId: randomUUID,
    draftStore: createMemoryProtectedStore(),
  });
  const library = await backend.loadPlanLibrary({ allowCached: false });
  if (!library) throw new Error('Bibliothek fehlt');
  const result = generatePlanFromRows(person, VERSIONS, library, MONDAY);
  if (!result.ok) throw new Error(result.error);
  await backend.savePlan(toSavePlanPayload(result.plan), person);
  const { rows } = await backend.loadRows();
  const rules = effectiveSafetyRules(rows, VERSIONS, MONDAY);
  if (!rules) throw new Error('Regeln fehlen');
  return { backend, rows, library, rules, store: seeded.store };
}

/** Derselbe Gerätespeicher, aber „heute“ ist ein anderer Tag (Nachtragen am Mittwoch). */
function backendOn(s: Setup, today: string): Backend {
  return createLocalBackend(s.store, {
    platform: 'web',
    today: () => today,
    now: () => `${today}T18:00:00.000Z`,
    newId: randomUUID,
    draftStore: createMemoryProtectedStore(),
  });
}

function weightExercises(library: PlanLibrary, count: number): Exercise[] {
  return [...library.exercises.values()]
    .filter((e) => e.load_type === 'weight')
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, count);
}

function tick(draft: WorkoutDraft, weightKg = 20, reps = 10): WorkoutDraft {
  let next = draft;
  next.exercises.forEach((exercise, index) => {
    exercise.sets.forEach((_set, setIndex) => {
      const loadType = currentTarget(exercise).loadType;
      next = updateSet(
        next,
        index,
        setIndex,
        {
          done: true,
          reps: loadType === 'time' ? null : reps,
          durationS: loadType === 'time' ? 30 : null,
          weightKg: loadType === 'weight' ? weightKg : null,
        },
        `${MONDAY}T17:00:00.000Z`,
      );
    });
  });
  return next;
}

const NOW = `${MONDAY}T17:00:00.000Z`;

describe('Freie Einheit im Trainingsmodus (Entwurf)', () => {
  it('createFreeDraft: kein Planbezug, Name aus der Liste, leere Sätze, Schlüssel frei-<id>', async () => {
    const s = await setup();
    const exercises = weightExercises(s.library, 2);
    const draft = createFreeDraft({
      ownerUserId: USER_ID,
      kind: 'strength',
      modality: 'run',
      exercises,
      performedOn: MONDAY,
      today: MONDAY,
      now: NOW,
      newId: randomUUID,
    });
    expect(draft).toMatchObject({
      key: freeDraftKey(draft.logId),
      plannedSessionId: null,
      plannedDate: MONDAY,
      nameDe: 'Freie Kraft-Einheit',
      isFree: true,
      // Heute = normaler Trainingsmodus (Wächter G2/H2), nur vergangene Tage = Nachtragen.
      backfill: false,
      cardio: null,
    });
    expect(
      createFreeDraft({
        ownerUserId: USER_ID,
        kind: 'endurance',
        modality: 'run',
        exercises: [],
        performedOn: '2026-10-02',
        today: MONDAY,
        now: NOW,
        newId: randomUUID,
      }).backfill,
    ).toBe(true);
    expect(draft.exercises.map((e) => e.planned.exerciseId)).toEqual(exercises.map((e) => e.id));
    expect(draft.exercises.every((e) => e.sets.every((x) => !x.done && x.reps === null))).toBe(
      true,
    );
    expect(draft.exercises[0]?.planned.targets.target_weight_kg).toBeNull();
  });

  it('Ausdauer: Art gewählt, Dauer leer; ohne Dauer ungültig (nie still gesendet)', () => {
    const draft = createFreeDraft({
      ownerUserId: USER_ID,
      kind: 'endurance',
      modality: 'bike',
      exercises: [],
      performedOn: MONDAY,
      today: MONDAY,
      now: NOW,
      newId: randomUUID,
    });
    expect(draft.nameDe).toBe('Radfahrt');
    const result = freeDraftResult(draft, { writeId: randomUUID(), now: NOW, today: MONDAY });
    expect(!result.ok && result.errors).toEqual(['cardio_invalid']);
    expect(
      isValidPayload(draftToPayload(draft, { writeId: randomUUID(), now: NOW, today: MONDAY })),
    ).toBe(false);
  });

  it('ungültiger freier Entwurf ergibt nie einen gültigen Eintrag (zu alt, kein Satz abgehakt)', async () => {
    const s = await setup();
    const base = createFreeDraft({
      ownerUserId: USER_ID,
      kind: 'strength',
      modality: 'run',
      exercises: weightExercises(s.library, 1),
      performedOn: MONDAY,
      today: MONDAY,
      now: NOW,
      newId: randomUUID,
    });
    const options = { writeId: randomUUID(), now: NOW, today: MONDAY };
    // Ohne abgehakten Satz wäre der Eintrag für das Schema gültig – die Regeln der freien Einheit nicht.
    expect(isValidPayload(draftToPayload(base, options))).toBe(false);
    const old = setPerformedOn(tick(base), '2026-09-20', NOW);
    expect(isValidPayload(draftToPayload(old, options))).toBe(false);
    expect(isValidPayload(draftToPayload(tick(base), options))).toBe(true);
  });

  it('„Nicht gemacht“ lässt die Übung weg; alle weggelassen → no_exercises', async () => {
    const s = await setup();
    let draft = tick(
      createFreeDraft({
        ownerUserId: USER_ID,
        kind: 'strength',
        modality: 'run',
        exercises: weightExercises(s.library, 2),
        performedOn: MONDAY,
        today: MONDAY,
        now: NOW,
        newId: randomUUID,
      }),
    );
    draft = setSkipped(draft, 1, true, NOW);
    const one = freeDraftResult(draft, { writeId: randomUUID(), now: NOW, today: MONDAY });
    expect(one.ok && one.payload.exercises).toHaveLength(1);
    draft = setSkipped(draft, 0, true, NOW);
    const none = freeDraftResult(draft, { writeId: randomUUID(), now: NOW, today: MONDAY });
    expect(!none.ok && none.errors).toEqual(['no_exercises']);
  });

  it('setPerformedOn: Datum ändern, planned_date folgt bei freien Einheiten', () => {
    const draft = createFreeDraft({
      ownerUserId: USER_ID,
      kind: 'endurance',
      modality: 'run',
      exercises: [],
      performedOn: MONDAY,
      today: MONDAY,
      now: NOW,
      newId: randomUUID,
    });
    const moved = setPerformedOn(draft, '2026-10-02', NOW);
    expect(moved).toMatchObject({ performedOn: '2026-10-02', plannedDate: '2026-10-02' });
  });
});

describe('Testmodus: freie Einheit speichern (Regeln wie save_session_log)', () => {
  it('Kraft frei speichern: Eintrag frei, ohne Vorgaben; nächste Vorgabe der geplanten Einheit bleibt gleich', async () => {
    const s = await setup();
    const session = activePlan(s.rows)?.sessions.find((x) => x.scheduled_on === MONDAY);
    if (!session) throw new Error('Keine Einheit');
    const before = workoutView(s.rows, s.library, s.rules, session.id, MONDAY);
    const planned = before?.items.find((i) => i.plan?.loadType === 'weight');
    if (!planned?.plan) throw new Error('Keine Gewichtsübung');
    const exercise = s.library.exercises.get(planned.plan.exerciseId) as Exercise;

    let draft = createFreeDraft({
      ownerUserId: USER_ID,
      kind: 'strength',
      modality: 'run',
      exercises: [exercise],
      performedOn: MONDAY,
      today: MONDAY,
      now: NOW,
      newId: randomUUID,
    });
    draft = tick(draft, 30, 12);
    const payload = draftToPayload(draft, { writeId: randomUUID(), now: NOW, today: MONDAY });
    expect(sessionLogPayloadSchema.safeParse(payload).success).toBe(true);
    expect(await s.backend.submitWorkout(draft, payload)).toEqual({
      kind: 'saved',
      orphaned: false,
    });

    const { rows } = await s.backend.loadRows();
    const log = rows.sessionLogs.find((l) => l.id === draft.logId);
    expect(log).toMatchObject({
      is_free: true,
      planned_session_id: null,
      name_de: 'Freie Kraft-Einheit',
      performed_on: MONDAY,
    });
    expect(rows.exerciseLogs.find((e) => e.session_log_id === draft.logId)).toMatchObject({
      exercise_id: exercise.id,
      target_weight_kg: null,
      state_weight_kg: null,
      planned_exercise_id: null,
    });
    // Die geplante Einheit ist NICHT erledigt, ihre Vorgabe unverändert (freie Einträge zählen nie).
    expect(rows.plannedSessions.find((x) => x.id === session.id)?.status).toBe('planned');
    const after = workoutView(rows, s.library, s.rules, session.id, MONDAY);
    const same = after?.items.find((i) => i.plan?.exerciseId === exercise.id);
    expect(same?.plan?.prescription).toEqual(planned.plan.prescription);
    expect(same?.plan?.progress.source).toBe(planned.plan.progress.source);
    // Woche: zählt als Einheit, markiert als frei.
    const { sessions, logs } = summaryInputs(rows);
    const week = weekLogSummary(sessions, logs, MONDAY, MONDAY);
    expect(week.days[0]?.items.find((i) => i.logId === draft.logId)).toMatchObject({
      free: true,
      backfilled: false,
    });
  });

  it('Ausdauer frei 30 min: gespeichert; zählt fürs Tagesziel (A-G7), nicht als geplante Einheit', async () => {
    const s = await setup();
    let draft = createFreeDraft({
      ownerUserId: USER_ID,
      kind: 'endurance',
      modality: 'run',
      exercises: [],
      performedOn: MONDAY,
      today: MONDAY,
      now: NOW,
      newId: randomUUID,
    });
    draft = setCardioFields(draft, { minutes: '30', distanceKm: '5' }, NOW);
    const payload = draftToPayload(draft, { writeId: randomUUID(), now: NOW, today: MONDAY });
    expect(await s.backend.submitWorkout(draft, payload)).toEqual({
      kind: 'saved',
      orphaned: false,
    });
    const { rows } = await s.backend.loadRows();
    expect(rows.sessionLogs.find((l) => l.id === draft.logId)).toMatchObject({
      is_free: true,
      name_de: 'Lauf',
    });
    const inputs = nutritionInputsFromRows(rows, VERSIONS, MONDAY, MONDAY);
    expect(inputs?.sessions).toContainEqual(
      expect.objectContaining({
        sessionId: `free:${draft.logId}`,
        scheduledOn: MONDAY,
        kind: 'endurance',
        minutes: 30,
        status: 'completed',
      }),
    );
  });

  it('Ablehnung: 15 Tage zurück, Freitext-Name, Übungsname nicht aus der Bibliothek, frei ↔ nicht frei', async () => {
    const s = await setup();
    const [exercise] = weightExercises(s.library, 1);
    if (!exercise) throw new Error('Keine Übung');
    const ctx = {
      today: MONDAY,
      rows: s.rows,
      exercises: s.library.exercises,
      healthConsentValid: true,
      createdToday: 0,
    };
    const build = (performedOn: string, name = exercise.name_de) => {
      const result = freeSessionLogFromInput({
        id: randomUUID(),
        writeId: randomUUID(),
        kind: 'strength',
        performedOn,
        today: performedOn,
        exercises: [
          {
            id: randomUUID(),
            exerciseId: exercise.id,
            nameDe: name,
            loadType: 'weight',
            incrementKind: 'free_weight',
            sets: [{ reps: 10, weightKg: 20, durationS: null, rpe: null, done: true }],
            weightConfirmed: false,
          },
        ],
        cardio: null,
        sessionRpe: null,
        notes: '',
        now: NOW,
      });
      if (!result.ok) throw new Error('Vorlage ungültig');
      return result.payload;
    };
    expect(checkSessionLog(build('2026-09-21'), ctx)).toMatchObject({ kind: 'write' });
    expect(checkSessionLog(build('2026-09-20'), ctx)).toEqual({
      kind: 'reject',
      reason: 'date_window',
    });
    expect(checkSessionLog(build('2026-10-06'), ctx)).toEqual({
      kind: 'reject',
      reason: 'date_window',
    });
    expect(checkSessionLog({ ...build(MONDAY), name_de: 'Mein Training' }, ctx)).toEqual({
      kind: 'reject',
      reason: 'invalid',
    });
    // Wächter S1: abweichender Übungsname wird angenommen (gespeichert wird der Bibliotheksname, siehe unten) …
    expect(checkSessionLog(build(MONDAY, 'Meine Übung'), ctx)).toMatchObject({ kind: 'write' });
    // … eine nicht (mehr) freigegebene Übung nicht – auch wenn sie zur Anzeige noch bekannt ist.
    expect(
      checkSessionLog(build(MONDAY), {
        ...ctx,
        exercises: s.library.exercises,
        publishedExercises: new Map(),
      }),
    ).toEqual({ kind: 'reject', reason: 'invalid' });
    expect(checkSessionLog(build(MONDAY), { ...ctx, createdToday: 10 })).toEqual({
      kind: 'reject',
      reason: 'daily_limit',
    });
    // Ein bestehender, nicht freier Eintrag wird nie zur freien Einheit (und umgekehrt).
    const free = build(MONDAY);
    const orphan: SessionLogPayload = { ...free, name_de: 'Kraft-Einheit' };
    delete orphan.is_free;
    const saved = await s.backend.submitWorkout(
      createFreeDraft({
        ownerUserId: USER_ID,
        kind: 'strength',
        modality: 'run',
        exercises: [exercise],
        performedOn: MONDAY,
        today: MONDAY,
        now: NOW,
        newId: randomUUID,
      }),
      orphan,
    );
    expect(saved.kind).toBe('saved');
    const { rows } = await s.backend.loadRows();
    expect(
      checkSessionLog({ ...free, base_revision: 1, write_id: randomUUID() }, { ...ctx, rows }),
    ).toEqual({ kind: 'reject', reason: 'invalid' });
  });
});

describe('Nachtragen einer geplanten Einheit (Testmodus)', () => {
  it('Montag am Mittwoch nachgetragen: zählt normal, Woche zeigt „nachgetragen“', async () => {
    const s = await setup();
    const wednesday = backendOn(s, WEDNESDAY);
    const { rows } = await wednesday.loadRows();
    const monday = activePlan(rows)?.sessions.find((x) => x.scheduled_on === MONDAY);
    if (!monday) throw new Error('Keine Einheit');

    const day = backfillDayFromRows(rows, MONDAY, WEDNESDAY);
    expect(day.block).toBeNull();
    expect(day.options.find((o) => o.sessionId === monday.id)).toMatchObject({ allowed: true });
    const dates = backfillDatesFromRows(rows, monday.id, WEDNESDAY);
    expect(dates).toContain(MONDAY);
    expect(dates[0]).toBe(WEDNESDAY);

    const view = workoutView(rows, s.library, s.rules, monday.id, WEDNESDAY);
    if (!view) throw new Error('Keine Ansicht');
    const draft = newWorkoutDraft(rows, view, {
      ownerUserId: USER_ID,
      today: WEDNESDAY,
      now: `${WEDNESDAY}T18:00:00.000Z`,
      newId: randomUUID,
      performedOn: MONDAY,
    });
    if (!draft) throw new Error('Kein Entwurf');
    expect(draft).toMatchObject({
      backfill: true,
      performedOn: MONDAY,
      plannedSessionId: monday.id,
    });
    const done = tick(draft);
    const outcome = await wednesday.submitWorkout(
      done,
      draftToPayload(done, {
        writeId: randomUUID(),
        now: `${WEDNESDAY}T18:00:00.000Z`,
        today: WEDNESDAY,
      }),
    );
    expect(outcome).toEqual({ kind: 'saved', orphaned: false });

    const after = (await wednesday.loadRows()).rows;
    const log = after.sessionLogs.find((l) => l.planned_session_id === monday.id);
    expect(log).toMatchObject({ performed_on: MONDAY, is_free: false });
    expect(log && isBackfilledLog(log)).toBe(true);
    expect(after.plannedSessions.find((x) => x.id === monday.id)?.status).toBe('completed');
    const { sessions, logs } = summaryInputs(after);
    const week = weekLogSummary(sessions, logs, MONDAY, WEDNESDAY);
    expect(week.days[0]?.items[0]).toMatchObject({ logId: log?.id, backfilled: true, free: false });
    // Tag jetzt belegt: keine zweite geplante Einheit am Montag.
    expect(backfillDayFromRows(after, MONDAY, WEDNESDAY).dayTaken).toBe(true);
  });

  it('Tag vor 15 Tagen: gesperrt mit Grund, keine freie Einheit', async () => {
    const s = await setup();
    expect(backfillDayFromRows(s.rows, '2026-09-20', MONDAY)).toMatchObject({
      block: 'too_old',
      freeAllowed: false,
      options: [],
    });
    expect(backfillDayFromRows(s.rows, '2026-10-06', MONDAY).block).toBe('future');
  });
});

describe('Übungssuche für die freie Kraft-Einheit', () => {
  const ex = (id: string, name: string) => ({ id, name_de: name }) as Exercise;
  const lib = new Map(
    [
      ex('a', 'Goblet-Kniebeuge'),
      ex('b', 'Kniebeuge mit Langhantel'),
      ex('c', 'Bankdrücken'),
      ex('d', 'Rudern am Kabel'),
    ].map((e) => [e.id, e] as const),
  );

  it('alle Wörter, ohne Groß/Klein und Umlaut-Akzente, alphabetisch', () => {
    expect(freeExerciseCandidates(lib, 'kniebeuge', []).items.map((e) => e.id)).toEqual(['a', 'b']);
    expect(freeExerciseCandidates(lib, 'BANKDRUCKEN', []).items.map((e) => e.id)).toEqual(['c']);
    expect(freeExerciseCandidates(lib, 'kniebeuge lang', []).items.map((e) => e.id)).toEqual(['b']);
    expect(freeExerciseCandidates(lib, 'xyz', []).items).toEqual([]);
  });

  it('gewählte Übungen stehen vorn (auch wenn die Suche sie nicht trifft), Begrenzung mit „weitere“', () => {
    const result = freeExerciseCandidates(lib, 'kniebeuge', ['d'], 2);
    expect(result.items.map((e) => e.id)).toEqual(['d', 'a']);
    expect(result.more).toBe(1);
  });
});

describe('Wächter S1: Bibliothek ändert sich nach dem Anlegen des Entwurfs', () => {
  it('umbenannt → Name wird aufgefrischt, Entwurf bleibt speicherbar und speichert den Bibliotheksnamen', async () => {
    const s = await setup();
    const [exercise] = weightExercises(s.library, 1);
    if (!exercise) throw new Error('Keine Übung');
    let draft = tick(
      createFreeDraft({
        ownerUserId: USER_ID,
        kind: 'strength',
        modality: 'run',
        exercises: [{ ...exercise, name_de: 'Alter Name' }],
        performedOn: MONDAY,
        today: MONDAY,
        now: NOW,
        newId: randomUUID,
      }),
    );
    const refreshed = refreshFreeDraft(draft, s.library.exercises, NOW);
    expect(refreshed.missing).toEqual([]);
    expect(refreshed.draft.exercises[0]?.planned.nameDe).toBe(exercise.name_de);
    // Auch ungefrischt (z. B. Senden aus der Warteschlange) speichert der Testmodus wie der Server den Bibliotheksnamen.
    const payload = draftToPayload(draft, { writeId: randomUUID(), now: NOW, today: MONDAY });
    expect(await s.backend.submitWorkout(draft, payload)).toEqual({
      kind: 'saved',
      orphaned: false,
    });
    const { rows } = await s.backend.loadRows();
    expect(rows.exerciseLogs.find((e) => e.session_log_id === draft.logId)?.exercise_name_de).toBe(
      exercise.name_de,
    );
    draft = refreshed.draft;
    expect(refreshFreeDraft(draft, s.library.exercises, NOW).draft).toBe(draft);
  });

  it('nicht mehr freigegeben → benannt; Entfernen behält die übrigen Werte', async () => {
    const s = await setup();
    const [a, b] = weightExercises(s.library, 2);
    if (!a || !b) throw new Error('Keine Übungen');
    const draft = tick(
      createFreeDraft({
        ownerUserId: USER_ID,
        kind: 'strength',
        modality: 'run',
        exercises: [a, b],
        performedOn: '2026-10-02',
        today: MONDAY,
        now: NOW,
        newId: randomUUID,
      }),
      25,
      7,
    );
    const library = new Map([...s.library.exercises].filter(([id]) => id !== a.id));
    const { missing } = refreshFreeDraft(draft, library, NOW);
    expect(missing).toEqual([{ index: 0, nameDe: a.name_de }]);
    const removed = removeDraftExercise(draft, 0, NOW);
    expect(removed.exercises.map((e) => [e.orderNo, e.planned.exerciseId])).toEqual([[1, b.id]]);
    expect(removed.exercises[0]?.sets).toEqual(draft.exercises[1]?.sets);
    expect(removed).toMatchObject({
      performedOn: '2026-10-02',
      logId: draft.logId,
      backfill: true,
    });
    expect(refreshFreeDraft(removed, library, NOW).missing).toEqual([]);
    // „Nicht gemacht“ gilt nicht als fehlend (wird ohnehin weggelassen).
    expect(refreshFreeDraft(setSkipped(draft, 0, true, NOW), library, NOW).missing).toEqual([]);
  });

  it('nicht freie Entwürfe bleiben unverändert', async () => {
    const s = await setup();
    const draft = createFreeDraft({
      ownerUserId: USER_ID,
      kind: 'endurance',
      modality: 'run',
      exercises: [],
      performedOn: MONDAY,
      today: MONDAY,
      now: NOW,
      newId: randomUUID,
    });
    const planned = { ...draft, isFree: false };
    expect(refreshFreeDraft(planned, s.library.exercises, NOW).draft).toBe(planned);
  });
});
