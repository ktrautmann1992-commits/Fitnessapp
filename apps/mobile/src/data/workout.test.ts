import { randomUUID } from 'node:crypto';

import {
  logEditability,
  sessionLogPayloadSchema,
  toSavePlanPayload,
  weekLogSummary,
  type PlanLibrary,
  type PlanSafetyRules,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { planPersonRows, seededBackend, USER_ID, VERSIONS } from '../test/fixtures';
import type { Backend } from './backend';
import { createMemoryProtectedStore } from './protected-store';
import { createLocalBackend } from './local-backend';
import { checkSessionLog } from './local-rules';
import { createMemoryStore } from './kv';
import { logEntriesFromRows, logForSession } from './log-rows';
import { logDetail, summaryInputs } from './log-summary';
import { activePlan, effectiveSafetyRules, generatePlanFromRows } from './training-plan';
import type { UserRows } from './types';
import { cacheableRows } from './write-ops';
import {
  chooseAlternative,
  currentTarget,
  draftCardioResult,
  draftFromLog,
  draftToPayload,
  needsWeightConfirmation,
  setCardioFields,
  setSkipped,
  updateSet,
  type WorkoutDraft,
} from './workout-draft';
import {
  alternativeTarget,
  newEnduranceDraft,
  newWorkoutDraft,
  startKind,
  workoutView,
} from './workout-session';

/**
 * Trainingsmodus im Testmodus (docs/PLAN-PHASE-4.md Etappe C1): Entwurf aus der angezeigten Einheit, Eintrag nach den
 * Regeln von save_session_log, Alternative mit eigenem Verlauf (R2), „nicht gemacht“ ohne Grund (S3), Konflikt,
 * Ablehnung, Widerruf (S1).
 */

const MONDAY = '2026-10-05';
const NOW = `${MONDAY}T17:00:00.000Z`;

interface Setup {
  backend: Backend;
  rows: UserRows;
  library: PlanLibrary;
  rules: PlanSafetyRules;
  store: ReturnType<typeof createMemoryStore>;
  drafts: ReturnType<typeof createMemoryProtectedStore>;
}

async function setup(person = planPersonRows(), today = MONDAY): Promise<Setup> {
  // Gerätespeicher wie seededBackend, aber mit UUIDs (wie in der App) und beobachtbarem Entwurfs-Speicher.
  const seeded = seededBackend(person, today, `${today}T08:00:00.000Z`);
  const drafts = createMemoryProtectedStore();
  const backend = createLocalBackend(seeded.store, {
    platform: 'web',
    today: () => today,
    now: () => NOW,
    newId: randomUUID,
    draftStore: drafts,
  });
  const library = await backend.loadPlanLibrary({ allowCached: false });
  if (!library) throw new Error('Bibliothek fehlt');
  const result = generatePlanFromRows(person, VERSIONS, library, today);
  if (!result.ok) throw new Error(result.error);
  await backend.savePlan(toSavePlanPayload(result.plan), person);
  const { rows } = await backend.loadRows();
  const rules = effectiveSafetyRules(rows, VERSIONS, today);
  if (!rules) throw new Error('Regeln fehlen');
  return { backend, rows, library, rules, store: seeded.store, drafts };
}

function todaysSession(rows: UserRows, date = MONDAY) {
  const session = activePlan(rows)?.sessions.find((s) => s.scheduled_on === date);
  if (!session) throw new Error('Keine Einheit');
  return session;
}

function startDraft(s: Setup, date = MONDAY): WorkoutDraft {
  const session = todaysSession(s.rows, date);
  const view = workoutView(s.rows, s.library, s.rules, session.id, date);
  if (!view) throw new Error('Keine Ansicht');
  const draft = newWorkoutDraft(s.rows, view, {
    ownerUserId: USER_ID,
    today: date,
    now: NOW,
    newId: randomUUID,
  });
  if (!draft) throw new Error('Kein Entwurf');
  return draft;
}

/** Alle Sätze aller Übungen abhaken (Gewicht wo nötig 20 kg). */
function tickAll(draft: WorkoutDraft): WorkoutDraft {
  let next = draft;
  next.exercises.forEach((exercise, index) => {
    exercise.sets.forEach((set, setIndex) => {
      const target = currentTarget(next.exercises[index] ?? exercise);
      next = updateSet(
        next,
        index,
        setIndex,
        {
          done: true,
          reps: target.loadType === 'time' ? null : (set.reps ?? 8),
          ...(target.loadType === 'weight' && set.weightKg === null ? { weightKg: 20 } : {}),
        },
        NOW,
      );
    });
  });
  return next;
}

const payloadOf = (draft: WorkoutDraft) =>
  draftToPayload(draft, { writeId: randomUUID(), now: NOW });

describe('Entwurf aus der angezeigten Einheit', () => {
  it('heute geplant → startbar; Vorgabe ohne Verlauf = „Startgewicht finden“, Zustand leer', async () => {
    const s = await setup();
    const session = todaysSession(s.rows);
    expect(startKind(s.rows, session, MONDAY)).toBe('today');
    const draft = startDraft(s);
    expect(draft).toMatchObject({
      key: session.id,
      plannedSessionId: session.id,
      state: 'open',
      baseRevision: null,
      fromHealthPlan: true,
      performedOn: MONDAY,
    });
    const first = draft.exercises[0];
    expect(first?.plannedExerciseId).toBe(
      s.rows.plannedExercises.find((e) => e.session_id === session.id && e.order_no === 1)?.id,
    );
    const weighted = draft.exercises.find((e) => e.planned.loadType === 'weight');
    expect(weighted?.planned.targets.target_weight_kg).toBeNull();
    expect(weighted?.planned.state.state_weight_kg).toBeNull();
    // Der Entwurf enthält keine Arzt-Hinweise, Sicherheitsregeln oder source_exercise_id (4.2).
    expect(JSON.stringify(draft)).not.toMatch(/source_exercise_id|medical_notice|safety_rules/);
  });

  it('Gewicht gilt für die folgenden, noch offenen Sätze; abgehakte bleiben', async () => {
    const s = await setup();
    let draft = startDraft(s);
    const index = draft.exercises.findIndex((e) => e.planned.loadType === 'weight');
    draft = updateSet(draft, index, 0, { weightKg: 20, done: true }, NOW);
    draft = updateSet(draft, index, 1, { weightKg: 22.5 }, NOW);
    const sets = draft.exercises[index]?.sets ?? [];
    expect(sets.map((x) => x.weightKg)).toEqual([20, 22.5, ...sets.slice(2).map(() => 22.5)]);
  });
});

describe('Training speichern (Testmodus wie save_session_log)', () => {
  it('Eintrag mit Alternative und „nicht gemacht“ (ohne Grund) → Einheit erledigt, Entwurf weg', async () => {
    const s = await setup();
    let draft = startDraft(s);
    const view = workoutView(s.rows, s.library, s.rules, draft.plannedSessionId, MONDAY);
    if (!view) throw new Error();
    // Übung mit erlaubter Alternative suchen.
    const altIndex = view.items.findIndex((item) => item.alternatives.length > 0);
    expect(altIndex).toBeGreaterThanOrEqual(0);
    const altExercise = view.items[altIndex]?.alternatives[0];
    const target = alternativeTarget(view, draft.exercises[altIndex]!, altExercise!.id);
    expect(target?.exerciseId).toBe(altExercise?.id);
    draft = chooseAlternative(draft, altIndex, target, NOW);
    const skipIndex = altIndex === 0 ? 1 : 0;
    draft = tickAll(draft);
    draft = setSkipped(draft, skipIndex, true, NOW);
    await s.backend.saveDraft(draft);
    expect(s.drafts.peek()).not.toBeNull();

    const payload = payloadOf(draft);
    expect(sessionLogPayloadSchema.safeParse(payload).success).toBe(true);
    expect(payload.status).toBe('partial');
    expect(payload.exercises[altIndex]?.status).toBe('alternative');
    expect(payload.exercises[skipIndex]).toMatchObject({ status: 'skipped', sets: [] });
    // S3: kein Grund-Feld – das strikte Schema lehnt jedes zusätzliche Feld ab.
    expect(Object.keys(payload.exercises[skipIndex] ?? {})).not.toContain('reason');
    expect(
      sessionLogPayloadSchema.safeParse({
        ...payload,
        exercises: payload.exercises.map((e, i) =>
          i === skipIndex ? { ...e, reason: 'pain' } : e,
        ),
      }).success,
    ).toBe(false);

    expect(await s.backend.submitWorkout(draft, payload)).toEqual({
      kind: 'saved',
      orphaned: false,
    });
    expect(s.drafts.peek()).toBeNull();
    const { rows } = await s.backend.loadRows();
    const log = logForSession(rows, draft.plannedSessionId);
    expect(log).toMatchObject({ status: 'partial', revision: 1, from_health_plan: true });
    expect(rows.plannedSessions.find((x) => x.id === draft.plannedSessionId)?.status).toBe(
      'completed',
    );
    // Alternative: eigene Vorgabe, Zustand der Alternativ-Übung (ohne Verlauf leer, R2) – nie die geplante.
    const altLog = rows.exerciseLogs.find((e) => e.status === 'alternative');
    expect(altLog?.exercise_id).toBe(altExercise?.id);
    expect(altLog?.state_weight_kg).toBeNull();
    // Gleiche write_id erneut gesendet → ok ohne erneutes Ersetzen (R4).
    expect(await s.backend.submitWorkout(draft, payload)).toEqual({
      kind: 'saved',
      orphaned: false,
    });
    expect(logForSession((await s.backend.loadRows()).rows, draft.plannedSessionId)?.revision).toBe(
      1,
    );
  });

  it('Ändern: Revision +1; veraltete Basis → Konflikt, Fassung bleibt als Entwurf (W3)', async () => {
    const s = await setup();
    const draft = tickAll(startDraft(s));
    await s.backend.submitWorkout(draft, payloadOf(draft));
    let { rows } = await s.backend.loadRows();
    const log = logForSession(rows, draft.plannedSessionId);
    if (!log) throw new Error();
    const edit = draftFromLog(rows, log.id, {
      ownerUserId: USER_ID,
      fromHealthPlan: true,
      now: NOW,
    });
    if (!edit) throw new Error();
    expect(edit).toMatchObject({ editing: true, baseRevision: 1, logId: log.id });
    const changed = { ...edit, sessionRpe: 6 };
    expect(await s.backend.submitWorkout(changed, payloadOf(changed))).toEqual({
      kind: 'saved',
      orphaned: false,
    });
    rows = (await s.backend.loadRows()).rows;
    expect(logForSession(rows, draft.plannedSessionId)).toMatchObject({
      id: log.id,
      revision: 2,
      session_rpe: 6,
    });
    // Ein zweites Gerät mit der alten Basis → Konflikt, Entwurf mit Server-Revision.
    const stale = { ...edit, sessionRpe: 9 };
    expect(await s.backend.submitWorkout(stale, payloadOf(stale))).toEqual({ kind: 'conflict' });
    const kept = await s.backend.loadDrafts();
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ state: 'conflict', serverRevision: 2 });
  });

  it('Nie stapeln: zweite geplante Einheit am selben Tag → abgelehnt, Entwurf bleibt (nie stilles Verwerfen)', async () => {
    const s = await setup();
    const monday = tickAll(startDraft(s));
    await s.backend.submitWorkout(monday, payloadOf(monday));
    // Mittwochs-Einheit am Montag eintragen (gleiche ISO-Woche, Tag schon belegt).
    const wednesday = todaysSession(s.rows, '2026-10-07');
    const view = workoutView(s.rows, s.library, s.rules, wednesday.id, MONDAY);
    if (!view) throw new Error();
    const draft = newWorkoutDraft(s.rows, view, {
      ownerUserId: USER_ID,
      today: MONDAY,
      now: NOW,
      newId: randomUUID,
    });
    if (!draft) throw new Error();
    const outcome = await s.backend.submitWorkout(tickAll(draft), payloadOf(tickAll(draft)));
    expect(outcome).toEqual({ kind: 'rejected', reason: 'day_taken' });
    expect((await s.backend.loadDrafts())[0]).toMatchObject({
      state: 'rejected',
      rejectReason: 'day_taken',
    });
  });

  it('Datumsfenster (W2): Eintrag 15 Tage zurück → abgelehnt', async () => {
    const s = await setup();
    const draft = tickAll(startDraft(s));
    const payload = { ...payloadOf(draft), performed_on: '2026-09-20' };
    expect(await s.backend.submitWorkout(draft, payload)).toEqual({
      kind: 'rejected',
      reason: 'date_window',
    });
  });

  it('Gewichts-Warnung: deutlich schwerer als die Schwelle nur mit Bestätigung (W5)', async () => {
    const s = await setup();
    let draft = startDraft(s);
    const index = draft.exercises.findIndex((e) => e.planned.loadType === 'weight');
    draft = updateSet(draft, index, 0, { weightKg: 250, done: true, reps: 8 }, NOW);
    expect(needsWeightConfirmation(draft.exercises[index]!)).toBe(true);
    draft = {
      ...draft,
      exercises: draft.exercises.map((e, i) => (i === index ? { ...e, weightConfirmed: true } : e)),
    };
    expect(needsWeightConfirmation(draft.exercises[index]!)).toBe(false);
  });

  it('Progression: Eintrag kalibriert, nächste Einheit zeigt das Arbeitsgewicht (aus state_*)', async () => {
    const s = await setup();
    const draft = tickAll(startDraft(s));
    await s.backend.submitWorkout(draft, payloadOf(draft));
    const { rows } = await s.backend.loadRows();
    const entries = logEntriesFromRows(rows);
    expect(entries.length).toBeGreaterThan(0);
    const weighted = draft.exercises.find((e) => e.planned.loadType === 'weight');
    // Nächster Termin derselben Übung im Plan.
    const later = activePlan(rows)?.sessions.find(
      (x) =>
        x.scheduled_on > MONDAY &&
        x.exercises.some((e) => e.exercise_id === weighted?.planned.exerciseId),
    );
    if (!later || !weighted) throw new Error();
    const view = workoutView(rows, s.library, s.rules, later.id, later.scheduled_on);
    const item = view?.items.find((i) => i.plan?.exerciseId === weighted.planned.exerciseId);
    expect(item?.plan?.progress.source).toBe('calibration');
    expect(item?.plan?.prescription.weightKg).not.toBeNull();
  });
});

describe('Widerruf im Testmodus (S1, R3)', () => {
  it('„Tagebuch behalten“: Einträge bleiben ohne Vorgaben/Zustand, Name neutral, Verweis leer', async () => {
    const s = await setup();
    const draft = tickAll(startDraft(s));
    await s.backend.submitWorkout(draft, payloadOf(draft));
    // Ein offener Entwurf einer anderen Einheit des Gesundheits-Plans wird ebenfalls neutralisiert.
    const other = startDraft(s, '2026-10-07');
    await s.backend.saveDraft(other);
    await s.backend.revokeHealthData(false);
    const { rows } = await s.backend.loadRows();
    expect(rows.plans).toHaveLength(0);
    expect(rows.sessionLogs).toHaveLength(1);
    expect(rows.sessionLogs[0]).toMatchObject({
      name_de: 'Kraft-Einheit',
      from_health_plan: false,
      planned_session_id: null,
    });
    expect(
      rows.exerciseLogs.every(
        (e) =>
          e.target_sets === null &&
          e.target_weight_kg === null &&
          e.state_weight_kg === null &&
          e.planned_exercise_id === null,
      ),
    ).toBe(true);
    expect(rows.setLogs.length).toBeGreaterThan(0);
    const [neutral] = await s.backend.loadDrafts();
    expect(neutral).toMatchObject({
      fromHealthPlan: false,
      nameDe: 'Kraft-Einheit',
      editing: true,
    });
    expect(neutral?.exercises.every((e) => e.planned.targets.target_sets === null)).toBe(true);
  });

  it('„auch löschen“: Einträge und Entwürfe aus Gesundheits-Plänen weg, übrige bleiben', async () => {
    const s = await setup();
    const draft = tickAll(startDraft(s));
    await s.backend.submitWorkout(draft, payloadOf(draft));
    await s.backend.saveDraft(startDraft(s, '2026-10-07'));
    await s.backend.revokeHealthData(true);
    const { rows } = await s.backend.loadRows();
    expect(rows.sessionLogs).toHaveLength(0);
    expect(rows.exerciseLogs).toHaveLength(0);
    expect(rows.setLogs).toHaveLength(0);
    expect(await s.backend.loadDrafts()).toHaveLength(0);
  });

  it('Plan ohne Gesundheits-Check: Widerruf ändert das Tagebuch nicht', async () => {
    const s = await setup(planPersonRows({ consent: 'none' }));
    const draft = tickAll(startDraft(s));
    expect(draft.fromHealthPlan).toBe(false);
    await s.backend.submitWorkout(draft, payloadOf(draft));
    const before = (await s.backend.loadRows()).rows;
    await s.backend.revokeHealthData(true);
    const after = (await s.backend.loadRows()).rows;
    expect(after.sessionLogs).toEqual(before.sessionLogs);
    expect(after.exerciseLogs).toEqual(before.exerciseLogs);
  });
});

describe('Gerätespeicher', () => {
  it('Tagebuch nie im normalen Zwischenspeicher (rowsCache) – nur getrennt für den geschützten logCache', async () => {
    const s = await setup();
    const draft = tickAll(startDraft(s));
    await s.backend.submitWorkout(draft, payloadOf(draft));
    const { rows } = await s.backend.loadRows();
    const split = cacheableRows(rows, { allowHealthPlanCache: true });
    expect(split.rows.sessionLogs).toEqual([]);
    expect(split.rows.exerciseLogs).toEqual([]);
    expect(split.rows.setLogs).toEqual([]);
    expect(split.logs.sessionLogs).toHaveLength(1);
    expect(JSON.stringify(split.rows)).not.toMatch(
      /source_exercise_id|safety_rules|medical_notice/,
    );
  });

  it('Abmelden, Konto löschen und Testdaten löschen leeren den Entwurf; Widerruf nicht', async () => {
    const s = await setup();
    await s.backend.saveDraft(startDraft(s));
    await s.backend.revokeHealthData(false);
    expect(s.drafts.peek()).not.toBeNull();
    await s.backend.clearDeviceData();
    expect(s.drafts.peek()).toBeNull();
    const t = await setup();
    await t.backend.saveDraft(startDraft(t));
    expect(await t.backend.pendingWorkouts()).toEqual({ queued: 0, drafts: 1 });
    await t.backend.signOut();
    expect(t.drafts.peek()).toBeNull();
  });
});

describe('checkSessionLog (local-rules.ts) – gleiche Regeln wie save_session_log', () => {
  async function context(overrides: Partial<Parameters<typeof checkSessionLog>[1]> = {}) {
    const s = await setup();
    const draft = tickAll(startDraft(s));
    return {
      s,
      draft,
      payload: payloadOf(draft),
      ctx: {
        today: MONDAY,
        rows: s.rows,
        exercises: s.library.displayExercises ?? s.library.exercises,
        healthConsentValid: true,
        createdToday: 0,
        ...overrides,
      },
    };
  }

  it('neu: schreiben mit Vorgaben und Kennzeichen aus dem Plan (nur Server bzw. Regel, B1)', async () => {
    const { payload, ctx } = await context();
    expect(checkSessionLog(payload, ctx)).toMatchObject({
      kind: 'write',
      result: 'ok',
      revision: 1,
      linked: true,
      keepTargets: true,
      fromHealthPlan: true,
      isNew: true,
    });
  });

  it('Gesundheits-Plan ohne gültige Einwilligung: verknüpft, aber neutral (Festlegung 4, H-c)', async () => {
    const { payload, ctx } = await context({ healthConsentValid: false });
    expect(checkSessionLog(payload, ctx)).toMatchObject({
      kind: 'write',
      keepTargets: false,
      fromHealthPlan: false,
    });
  });

  it('verwaist (Einheit gelöscht/erfunden): gespeichert ohne Verweis, Antwort orphaned (B4)', async () => {
    const { payload, ctx } = await context();
    const orphan = { ...payload, planned_session_id: randomUUID() };
    expect(
      checkSessionLog(
        { ...orphan, exercises: orphan.exercises.map((e) => ({ ...e, status: 'done' as const })) },
        ctx,
      ),
    ).toMatchObject({ kind: 'write', result: 'orphaned', linked: false, keepTargets: false });
  });

  it('skipped → completed ist erlaubt (W8)', async () => {
    const { payload, ctx, draft } = await context();
    const rows = {
      ...ctx.rows,
      plannedSessions: ctx.rows.plannedSessions.map((x) =>
        x.id === draft.plannedSessionId ? { ...x, status: 'skipped' as const } : x,
      ),
    };
    expect(checkSessionLog(payload, { ...ctx, rows }).kind).toBe('write');
  });

  it('Art passt nicht, Alternative ohne andere Übung, unbekannte Übung → ungültig', async () => {
    const { payload, ctx } = await context();
    expect(
      checkSessionLog(
        {
          ...payload,
          kind: 'endurance',
          exercises: [],
          cardio: { modality: 'run', duration_s: 600, distance_m: null, elevation_m: null },
        },
        ctx,
      ),
    ).toEqual({ kind: 'reject', reason: 'invalid' });
    const sameAsPlanned = {
      ...payload,
      exercises: payload.exercises.map((e, i) =>
        i === 0 ? { ...e, status: 'alternative' as const } : e,
      ),
    };
    expect(checkSessionLog(sameAsPlanned, ctx)).toEqual({ kind: 'reject', reason: 'invalid' });
    const unknown = {
      ...payload,
      exercises: payload.exercises.map((e, i) =>
        i === 0 ? { ...e, exercise_id: 'gibt-es-nicht' } : e,
      ),
    };
    expect(checkSessionLog(unknown, ctx)).toEqual({ kind: 'reject', reason: 'invalid' });
  });

  it('Tageslimit (K1) nur für neue Einträge', async () => {
    const { payload, ctx } = await context({ createdToday: 10 });
    expect(checkSessionLog(payload, ctx)).toEqual({ kind: 'reject', reason: 'daily_limit' });
  });

  it('Datumsfenster an den Rändern (W2): heute + 1 ok, heute + 2 nicht', async () => {
    const { payload, ctx } = await context();
    expect(checkSessionLog({ ...payload, performed_on: '2026-10-06' }, ctx).kind).toBe('write');
    expect(checkSessionLog({ ...payload, performed_on: '2026-10-07' }, ctx)).toEqual({
      kind: 'reject',
      reason: 'date_window',
    });
  });

  it('S4: ein neuer Plan darf am Tag einer erledigten Einheit eine Einheit haben (wie die Datenbank)', async () => {
    const s = await setup();
    const draft = tickAll(startDraft(s));
    await s.backend.submitWorkout(draft, payloadOf(draft));
    const { rows } = await s.backend.loadRows();
    const result = generatePlanFromRows(rows, VERSIONS, s.library, MONDAY);
    if (!result.ok) throw new Error(result.error);
    const saved = await s.backend.savePlan(toSavePlanPayload(result.plan), rows);
    // Erledigte Einheit des alten Plans und geplante des neuen am selben Tag; Eintrag bleibt verknüpft.
    const onMonday = saved.plannedSessions.filter((x) => x.scheduled_on === MONDAY);
    expect(onMonday.map((x) => x.status).sort()).toEqual(['completed', 'planned']);
    expect(saved.sessionLogs[0]?.planned_session_id).toBe(draft.plannedSessionId);
    // „Heute“ zeigt die offene Einheit des neuen Plans (sessionOn), die alte bleibt erledigt.
    const active = activePlan(saved);
    const fresh = active?.sessions.find((x) => x.scheduled_on === MONDAY);
    expect(fresh?.status).toBe('planned');
    // Heute ist schon trainiert – kein zweites Training am selben Tag anbieten (nie stapeln).
    if (fresh) expect(startKind(saved, fresh, MONDAY)).toBeNull();
  });
});

describe('Testmodus wie die Datenbank (Wächter C1 K1, K2)', () => {
  it('Tageslimit zählt Erstellungen – auch später gelöschte', async () => {
    const s = await setup();
    const draft = tickAll(startDraft(s));
    await s.backend.submitWorkout(draft, payloadOf(draft));
    const log = logForSession((await s.backend.loadRows()).rows, draft.plannedSessionId);
    if (!log) throw new Error();
    expect(await s.backend.deleteSessionLog(log.id, 1)).toBe('ok');
    const db = JSON.parse(s.store.dump()['fitnessapp.local.v1'] ?? '{}') as {
      logCounter: { day: string; created: number };
    };
    expect(db.logCounter).toEqual({ day: MONDAY, created: 1 });
  });

  it('schon vergebene id eines anderen Eintrags → neue id, der andere Eintrag bleibt', async () => {
    const s = await setup();
    const monday = tickAll(startDraft(s));
    await s.backend.submitWorkout(monday, payloadOf(monday));
    const before = (await s.backend.loadRows()).rows;
    const mondayLog = logForSession(before, monday.plannedSessionId);
    // Mittwoch, gleiche Geräte-id wie der Montags-Eintrag (uuid-Kollision).
    const s2 = { ...s, rows: before };
    const wednesday = tickAll({ ...startDraft(s2, '2026-10-07'), logId: mondayLog?.id ?? '' });
    const payload = { ...payloadOf(wednesday), performed_on: '2026-10-06' };
    expect(await s.backend.submitWorkout(wednesday, payload)).toEqual({
      kind: 'saved',
      orphaned: false,
    });
    const after = (await s.backend.loadRows()).rows;
    expect(after.sessionLogs).toHaveLength(2);
    expect(new Set(after.sessionLogs.map((l) => l.id)).size).toBe(2);
    expect(logForSession(after, monday.plannedSessionId)?.id).toBe(mondayLog?.id);
  });
});

describe('Ausdauer-Eintrag (Etappe C2)', () => {
  /** Mo Ausdauer 30 min, Mi + Fr Kraft im Studio. */
  const person = () =>
    planPersonRows({
      slots: [
        { user_id: USER_ID, slot_no: 1, weekday: 1, kind: 'endurance', minutes: 30 },
        { user_id: USER_ID, slot_no: 2, weekday: 3, kind: 'strength_gym', minutes: 60 },
        { user_id: USER_ID, slot_no: 3, weekday: 5, kind: 'strength_gym', minutes: 60 },
      ],
    });
  const meta = { ownerUserId: USER_ID, today: MONDAY, now: NOW, newId: randomUUID };

  it('startbar ohne Bibliothek; Art und Dauer aus der geplanten Einheit vorbelegt', async () => {
    const s = await setup(person());
    const session = todaysSession(s.rows);
    expect(session.kind).toBe('endurance');
    expect(startKind(s.rows, session, MONDAY)).toBe('today');
    const draft = newEnduranceDraft(s.rows, session.id, meta);
    expect(draft).toMatchObject({
      kind: 'endurance',
      exercises: [],
      plannedSessionId: session.id,
      cardio: {
        modality: session.endurance_modality,
        hours: String(Math.floor(session.estimated_minutes / 60)),
        minutes: String(session.estimated_minutes % 60),
        distanceKm: '',
        elevationM: '',
      },
    });
    // Kraft-Einheit liefert keinen Ausdauer-Entwurf.
    const wednesday = activePlan(s.rows)?.sessions.find((x) => x.kind === 'strength');
    if (wednesday) expect(newEnduranceDraft(s.rows, wednesday.id, meta)).toBeNull();
  });

  it('Eintrag über save_session_log mit cardio-Teil (Testmodus: checkSessionLog) → erledigt, Ansehen/Ändern', async () => {
    const s = await setup(person());
    const session = todaysSession(s.rows);
    let draft = newEnduranceDraft(s.rows, session.id, meta);
    if (!draft) throw new Error('Kein Entwurf');
    draft = setCardioFields(
      draft,
      { modality: 'run', hours: '0', minutes: '33', distanceKm: '6,0', elevationM: '45' },
      NOW,
    );
    draft = { ...draft, sessionRpe: 4 };
    const payload = payloadOf(draft);
    expect(sessionLogPayloadSchema.safeParse(payload).success).toBe(true);
    expect(payload).toMatchObject({
      kind: 'endurance',
      status: 'completed',
      exercises: [],
      session_rpe: 4,
      cardio: { modality: 'run', duration_s: 1980, distance_m: 6000, elevation_m: 45 },
    });
    expect(await s.backend.submitWorkout(draft, payload)).toEqual({
      kind: 'saved',
      orphaned: false,
    });
    const { rows } = await s.backend.loadRows();
    const log = logForSession(rows, session.id);
    expect(log).toMatchObject({ kind: 'endurance', status: 'completed', session_rpe: 4 });
    expect(rows.cardioLogs).toEqual([
      expect.objectContaining({
        session_log_id: log?.id,
        modality: 'run',
        duration_s: 1980,
        distance_m: 6000,
        elevation_m: 45,
      }),
    ]);
    expect(rows.plannedSessions.find((x) => x.id === session.id)?.status).toBe('completed');
    // Entwurf weg; Ändern zeigt die gespeicherten Werte.
    expect(await s.backend.loadDrafts()).toEqual([]);
    const edit = log
      ? draftFromLog(rows, log.id, { ownerUserId: USER_ID, fromHealthPlan: true, now: NOW })
      : null;
    expect(edit?.cardio).toEqual({
      modality: 'run',
      hours: '0',
      minutes: '33',
      distanceKm: '6',
      elevationM: '45',
    });
    expect(edit?.editing).toBe(true);
  });

  it('ungültige Eingabe → kein cardio-Teil, Zod lehnt den Eintrag ab (nie halb gespeichert)', async () => {
    const s = await setup(person());
    const draft = newEnduranceDraft(s.rows, todaysSession(s.rows).id, meta);
    if (!draft) throw new Error('Kein Entwurf');
    const broken = setCardioFields(draft, { hours: '', minutes: '', distanceKm: '5,' }, NOW);
    const result = draftCardioResult(broken);
    expect(result).toEqual({
      ok: false,
      errors: { duration: 'duration_missing', distance: 'distance_invalid' },
    });
    const payload = payloadOf(broken);
    expect(payload.cardio).toBeNull();
    expect(sessionLogPayloadSchema.safeParse(payload).success).toBe(false);
    expect(await s.backend.submitWorkout(broken, payload)).toEqual({
      kind: 'rejected',
      reason: 'invalid',
    });
  });

  it('Entwurf aus C1 (ohne cardio-Feld) bleibt lesbar; Kraft hat keinen cardio-Teil', async () => {
    const s = await setup();
    const draft = tickAll(startDraft(s));
    const legacy = { ...draft } as WorkoutDraft;
    delete legacy.cardio;
    expect(draftCardioResult(legacy)).toBeNull();
    expect(payloadOf(legacy).cardio).toBeNull();
  });
});

describe('Etappe D im Testmodus: Woche, Eintrag, Löschen, Export', () => {
  it('Woche zeigt das Training am Montag, Eintrag mit Übungen; Löschen macht die Einheit wieder offen', async () => {
    const s = await setup();
    const draft = tickAll(startDraft(s));
    await s.backend.submitWorkout(draft, payloadOf(draft));
    const { rows } = await s.backend.loadRows();
    const { sessions, logs } = summaryInputs(rows);
    const week = weekLogSummary(sessions, logs, MONDAY, MONDAY);
    expect(week.days[0]?.status).toBe('done');
    expect(week.sessionsDone).toBe(1);
    expect(week.strengthSets).toBeGreaterThan(0);

    const log = logForSession(rows, draft.plannedSessionId);
    if (!log) throw new Error('Eintrag fehlt');
    const detail = logDetail(rows, log.id);
    expect(detail?.exercises.length).toBeGreaterThan(0);
    const session = rows.plannedSessions.find((x) => x.id === log.planned_session_id) ?? null;
    expect(logEditability(log, session, MONDAY)).toBe('editable');

    // Falsche Revision → Konflikt, nichts gelöscht; richtige → weg, Einheit wieder geplant.
    expect(await s.backend.deleteSessionLog(log.id, log.revision + 1)).toBe('conflict');
    expect(await s.backend.deleteSessionLog(log.id, log.revision)).toBe('ok');
    const after = (await s.backend.loadRows()).rows;
    expect(after.sessionLogs).toHaveLength(0);
    expect(after.plannedSessions.find((x) => x.id === draft.plannedSessionId)?.status).toBe(
      'planned',
    );
  });

  it('Export enthält Tagebuch, Einwilligungs-Verlauf und alle Tabellen; nichts nachzuladen', async () => {
    const s = await setup();
    const draft = tickAll(startDraft(s));
    await s.backend.submitWorkout(draft, payloadOf(draft));
    const file = await s.backend.exportMyData();
    expect(file.data.session_logs).toHaveLength(1);
    expect(file.data.set_logs.length).toBeGreaterThan(0);
    expect(file.data.consents.length).toBeGreaterThanOrEqual(2);
    expect(file.data.user_plans).toHaveLength(1);
    expect(file.account.email).toBeNull();
    expect(s.backend.logHistoryStart()).toBeNull();
    expect(await s.backend.loadOlderLogs(MONDAY)).toEqual({
      logs: { sessionLogs: [], exerciseLogs: [], setLogs: [], cardioLogs: [] },
      nextBefore: null,
    });
  });
});
