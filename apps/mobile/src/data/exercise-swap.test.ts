import { randomUUID } from 'node:crypto';

import {
  alwaysAllowedFor,
  exerciseMark,
  type PlanLibrary,
  type PlanSafetyRules,
  prepareSessionForDisplay,
  toSavePlanPayload,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { planPersonRows, seededBackend, USER_ID, VERSIONS } from '../test/fixtures';
import type { Backend } from './backend';
import {
  canSwapIn,
  newDaySwap,
  preferenceContextOf,
  preferenceSaveFor,
  preferencesFromRows,
  sessionDisplay,
  swapTargetFor,
  workoutSwapTarget,
} from './exercise-swap';
import { createLocalBackend } from './local-backend';
import { isValidPreferenceOp } from './local-rules';
import {
  activePlan,
  effectiveSafetyRules,
  generatePlanFromRows,
  planSnapshot,
  profilesFor,
  startGroupOf,
} from './training-plan';
import type { UserRows } from './types';
import {
  chooseAlternative,
  currentTarget,
  draftToPayload,
  updateSet,
  type WorkoutDraft,
} from './workout-draft';
import {
  alternativeTarget,
  newWorkoutDraft,
  replannedTarget,
  workoutView,
} from './workout-session';

/**
 * Übungstausch in der App (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md Etappe T2): EIN Anzeigeweg mit Präferenzen und
 * Day-Swaps, Tausch-Dialog, Speichern im Testmodus mit denselben Regeln wie der Dialog (canExclude), Rückgängig,
 * Trainingsmodus und laufender Entwurf (N4).
 */

const MONDAY = '2026-10-05';
const NOW = `${MONDAY}T17:00:00.000Z`;

interface Setup {
  backend: Backend;
  rows: UserRows;
  library: PlanLibrary;
  rules: PlanSafetyRules;
}

async function setup(person = planPersonRows(), today = MONDAY): Promise<Setup> {
  const seeded = seededBackend(person, today, `${today}T08:00:00.000Z`);
  const backend = createLocalBackend(seeded.store, {
    platform: 'web',
    today: () => today,
    now: () => NOW,
    newId: randomUUID,
  });
  const library = await backend.loadPlanLibrary({ allowCached: false });
  if (!library) throw new Error('Bibliothek fehlt');
  const result = generatePlanFromRows(person, VERSIONS, library, today);
  if (!result.ok) throw new Error(result.error);
  await backend.savePlan(toSavePlanPayload(result.plan), person);
  const { rows } = await backend.loadRows();
  const rules = effectiveSafetyRules(rows, VERSIONS, today);
  if (!rules) throw new Error('Regeln fehlen');
  return { backend, rows, library, rules };
}

function session(rows: UserRows, date = MONDAY) {
  const found = activePlan(rows)?.sessions.find((s) => s.scheduled_on === date);
  if (!found) throw new Error('Keine Einheit');
  return found;
}

function display(
  s: Setup,
  rows = s.rows,
  daySwaps: Parameters<typeof sessionDisplay>[0]['daySwaps'] = null,
  date = MONDAY,
) {
  const active = activePlan(rows);
  if (!active) throw new Error('Kein Plan');
  return sessionDisplay({
    rows,
    active,
    library: s.library,
    rules: s.rules,
    session: session(rows, date),
    today: MONDAY,
    daySwaps,
    ownerUserId: USER_ID,
  });
}

/** Erste angezeigte Übung mit Kandidaten für „immer“ (Index, Ziel). */
function swappable(s: Setup, rows = s.rows) {
  const shown = display(s, rows);
  for (let index = 0; index < shown.shown.session.exercises.length; index += 1) {
    const target = swapTargetFor(session(rows), shown, s.library, rows, index, MONDAY);
    if (target && alwaysAllowedFor(target.choices, target.location, null)) return { index, target };
  }
  throw new Error('Keine tauschbare Übung');
}

function tickAll(draft: WorkoutDraft): WorkoutDraft {
  let next = draft;
  draft.exercises.forEach((exercise, index) => {
    exercise.sets.forEach((set, setIndex) => {
      const target = currentTarget(next.exercises[index] ?? exercise);
      next = updateSet(
        next,
        index,
        setIndex,
        {
          done: true,
          reps: target.loadType === 'time' ? null : (set.reps ?? 8),
          durationS: target.loadType === 'time' ? 30 : null,
          ...(target.loadType === 'weight' && set.weightKg === null ? { weightKg: 20 } : {}),
        },
        NOW,
      );
    });
  });
  return next;
}

describe('sessionDisplay – ein Anzeigeweg', () => {
  it('ohne Präferenzen und Day-Swaps identisch zur bisherigen Anzeige (Regression)', async () => {
    const s = await setup();
    const active = activePlan(s.rows);
    if (!active) throw new Error('Kein Plan');
    const stored = session(s.rows);
    const shown = display(s);
    const snapshot = planSnapshot(active.plan);
    const lookup = s.library.displayExercises ?? s.library.exercises;
    const before = prepareSessionForDisplay(stored, {
      rules: s.rules,
      previousStartGroup: startGroupOf(active, s.rows.profile?.birth_date ?? MONDAY),
      library: lookup,
      substituteLibrary: s.library.exercises,
      profile: profilesFor(snapshot).get('gym'),
    });
    expect(shown.shown.session).toEqual(before.session);
    expect(shown.shown.hidden).toEqual(before.hidden);
    expect(shown.shown.replaced).toEqual(before.replaced);
    expect(shown.location).toEqual({ location: 'gym', ambiguous: false });
    expect(shown.swapReady).toBe(true);
    expect(canSwapIn(stored, shown, false, true)).toBe(true);
    expect(canSwapIn(stored, shown, true, true)).toBe(false);
  });

  it('ohne Bibliothek: keine Tausch-Schichten (Day-Swaps würden sonst verworfen), kein Tausch', async () => {
    const s = await setup();
    const active = activePlan(s.rows);
    if (!active) throw new Error('Kein Plan');
    const { index, target } = swappable(s);
    const swap = newDaySwap(target, {
      ownerUserId: USER_ID,
      planId: active.plan.id,
      scheduledOn: MONDAY,
      alternativeId: target.choices.today[0]?.id ?? '',
      now: NOW,
    });
    if (!swap) throw new Error('kein Swap');
    const offline = sessionDisplay({
      rows: s.rows,
      active,
      library: null,
      rules: s.rules,
      session: session(s.rows),
      today: MONDAY,
      daySwaps: [swap],
      ownerUserId: USER_ID,
    });
    expect(offline.swapReady).toBe(false);
    expect(offline.shown.droppedDaySwaps).toEqual([]);
    expect(offline.shown.daySwapped).toEqual([]);
    expect(canSwapIn(session(s.rows), offline, false, true)).toBe(false);
    expect(index).toBeGreaterThanOrEqual(0);
  });
});

describe('„Nur heute“ (Day-Swap) vor dem Training', () => {
  it('Tausch → angezeigt mit „heute getauscht“; Training übernimmt ihn, Eintrag als Alternative', async () => {
    const s = await setup();
    const active = activePlan(s.rows);
    if (!active) throw new Error('Kein Plan');
    const { index, target } = swappable(s);
    expect(target.later).toBe(false);
    const alternativeId = target.choices.today[0]?.id ?? '';
    const swap = newDaySwap(target, {
      ownerUserId: USER_ID,
      planId: active.plan.id,
      scheduledOn: MONDAY,
      alternativeId,
      now: NOW,
    });
    expect(swap).not.toBeNull();
    const shown = display(s, s.rows, swap ? [swap] : null);
    expect(shown.shown.session.exercises[index]?.exercise_id).toBe(alternativeId);
    expect(shown.shown.daySwapped).toEqual([
      { storedOrderNo: target.storedOrderNo, from: target.shownExerciseId, to: alternativeId },
    ]);
    const exercise = shown.shown.session.exercises[index];
    if (!exercise) throw new Error('Übung fehlt');
    expect(
      exerciseMark(exercise, session(s.rows), shown.context, {
        storedOrderNo: target.storedOrderNo,
        display: shown.shown,
      }),
    ).toBe('day_swap');

    // Trainingsmodus: gleicher Anzeigeweg → der Entwurf hat die getauschte Übung, Status „alternative“.
    const view = workoutView(s.rows, s.library, s.rules, session(s.rows).id, MONDAY, {
      daySwaps: swap ? [swap] : null,
      ownerUserId: USER_ID,
    });
    if (!view) throw new Error('Keine Ansicht');
    const draft = newWorkoutDraft(s.rows, view, {
      ownerUserId: USER_ID,
      today: MONDAY,
      now: NOW,
      newId: randomUUID,
    });
    if (!draft) throw new Error('Kein Entwurf');
    expect(draft.exercises[index]?.planned.exerciseId).toBe(alternativeId);
    expect(draft.exercises[index]?.storedExerciseId).toBe(target.storedExerciseId);
    const payload = draftToPayload(tickAll(draft), { writeId: randomUUID(), now: NOW });
    expect(payload.exercises[index]?.status).toBe('alternative');
    const planned = s.rows.plannedExercises.find(
      (e) => e.session_id === session(s.rows).id && e.order_no === target.storedOrderNo,
    );
    expect(payload.exercises[index]?.planned_exercise_id).toBe(planned?.id);
    const outcome = await s.backend.submitWorkout(draft, payload);
    expect(outcome).toEqual({ kind: 'saved', orphaned: false });
  });

  it('späterer Termin → „Nur bei diesem Training“; fremdes Konto bzw. ungültige ID → kein Swap', async () => {
    const s = await setup();
    const later = activePlan(s.rows)?.sessions.find(
      (x) => x.kind === 'strength' && x.scheduled_on > MONDAY,
    );
    if (!later) throw new Error('keine spätere Einheit');
    const shown = display(s, s.rows, null, later.scheduled_on);
    const target = swapTargetFor(later, shown, s.library, s.rows, 0, MONDAY);
    expect(target?.later).toBe(true);
    if (!target) return;
    expect(
      newDaySwap(target, {
        ownerUserId: 'kein-uuid',
        planId: activePlan(s.rows)?.plan.id ?? '',
        scheduledOn: later.scheduled_on,
        alternativeId: target.choices.today[0]?.id ?? '',
        now: NOW,
      }),
    ).toBeNull();
  });
});

describe('„Ab jetzt immer“ im Testmodus', () => {
  it('speichern (canExclude), Anzeige „deine Wahl“, Rückgängig stellt den alten Stand her', async () => {
    const s = await setup();
    const { index, target } = swappable(s);
    const replacementId = [...(target.choices.always.get(target.location) ?? [])][0] ?? '';
    const save = preferenceSaveFor(target, s.rows, {
      location: target.location,
      kind: 'dislike',
      replacementId,
      now: NOW,
    });
    const at = preferenceContextOf(target);
    const after = await s.backend.updateExercisePreferences(save.changes, at, s.rows);
    expect(preferencesFromRows(after)).toEqual([
      {
        exercise_id: target.shownExerciseId,
        location: target.location,
        kind: 'dislike',
        replacement_exercise_id: replacementId,
        created_at: NOW,
        updated_at: NOW,
      },
    ]);
    expect(after.exercisePreferences[0]?.user_id).toBe(USER_ID);
    const shown = display(s, after);
    expect(shown.shown.session.exercises[index]?.exercise_id).toBe(replacementId);
    expect(shown.shown.preferenceSwapped?.[0]?.to).toBe(replacementId);
    // In allen Einheiten am Ort (hier: jeder weitere Termin mit derselben Übung).
    for (const other of activePlan(after)?.sessions ?? []) {
      if (other.kind !== 'strength' || other.status !== 'planned') continue;
      const d = display(s, after, null, other.scheduled_on);
      expect(d.shown.session.exercises.map((e) => e.exercise_id)).not.toContain(
        target.shownExerciseId,
      );
    }
    const undone = await s.backend.updateExercisePreferences(save.undo, at, after);
    expect(undone.exercisePreferences).toEqual([]);
    expect(display(s, undone).shown.session.exercises[index]?.exercise_id).toBe(
      target.shownExerciseId,
    );
  });

  it('Kette X → Y → Z: Präferenz auf Y und neuer Ersatz für X, Anzeige zeigt die Wahl Z', async () => {
    const s = await setup();
    const { index, target } = swappable(s);
    const always = [...(target.choices.always.get(target.location) ?? [])];
    const y = always[0] ?? '';
    const first = preferenceSaveFor(target, s.rows, {
      location: target.location,
      kind: 'dislike',
      replacementId: y,
      now: NOW,
    });
    const rows1 = await s.backend.updateExercisePreferences(
      first.changes,
      preferenceContextOf(target),
      s.rows,
    );
    const shown1 = display(s, rows1);
    const target2 = swapTargetFor(session(rows1), shown1, s.library, rows1, index, MONDAY);
    if (!target2) throw new Error('kein Ziel');
    expect(target2.shownExerciseId).toBe(y);
    expect(target2.chainFromId).toBe(target.shownExerciseId);
    const z = [...(target2.choices.always.get(target2.location) ?? [])][0];
    if (!z) return; // keine weitere Alternative im Inhaltsstand – Kette nicht prüfbar
    const second = preferenceSaveFor(target2, rows1, {
      location: target2.location,
      kind: 'not_feasible',
      replacementId: z,
      now: NOW,
    });
    expect(second.changes).toHaveLength(2);
    const rows2 = await s.backend.updateExercisePreferences(
      second.changes,
      preferenceContextOf(target2),
      rows1,
    );
    expect(display(s, rows2).shown.session.exercises[index]?.exercise_id).toBe(z);
    // Rückgängig in derselben Reihenfolge (erst Y, dann X) – zurück zu Y.
    const back = await s.backend.updateExercisePreferences(
      second.undo,
      preferenceContextOf(target2),
      rows2,
    );
    expect(display(s, back).shown.session.exercises[index]?.exercise_id).toBe(y);
  });

  it('abgelehnt: Ersatz kein Kandidat, ohne Einheit, Obergrenze; Entfernen geht immer (wie local-rules)', async () => {
    const s = await setup();
    const { target } = swappable(s);
    const notCandidate = [...s.library.exercises.keys()].find(
      (id) =>
        id !== target.shownExerciseId &&
        !target.choices.always.get(target.location)?.has(id) &&
        !target.inSession.includes(id),
    );
    const bad = preferenceSaveFor(target, s.rows, {
      location: target.location,
      kind: 'dislike',
      replacementId: notCandidate ?? '',
      now: NOW,
    });
    await expect(
      s.backend.updateExercisePreferences(bad.changes, preferenceContextOf(target), s.rows),
    ).rejects.toMatchObject({ code: 'preference_rejected' });
    const good = preferenceSaveFor(target, s.rows, {
      location: target.location,
      kind: 'dislike',
      replacementId: [...(target.choices.always.get(target.location) ?? [])][0] ?? '',
      now: NOW,
    });
    await expect(
      s.backend.updateExercisePreferences(good.changes, null, s.rows),
    ).rejects.toMatchObject({ code: 'preference_rejected' });
    // Nichts gespeichert (alles oder nichts).
    expect((await s.backend.loadRows()).rows.exercisePreferences).toEqual([]);
    const removed = await s.backend.updateExercisePreferences(
      [{ op: 'remove', exercise_id: 'gibt-es-nicht', location: 'home' }],
      null,
      s.rows,
    );
    expect(removed.exercisePreferences).toEqual([]);
  });

  it('isValidPreferenceOp: fremde user_id, Freitext-Feld, unbekannte Übung → ungültig', async () => {
    const s = await setup();
    const { target } = swappable(s);
    const replacement = [...(target.choices.always.get(target.location) ?? [])][0] ?? '';
    const stored = session(s.rows).exercises.find((e) => e.order_no === target.storedOrderNo);
    if (!stored) throw new Error('fehlt');
    const active = activePlan(s.rows);
    if (!active) throw new Error('Kein Plan');
    const ctx = {
      rows: s.rows,
      library: s.library,
      pair: { stored, shown: { ...stored, exercise_id: target.shownExerciseId } },
      inSession: new Set(target.inSession),
      ambiguousLocation: false,
      swapRules: display(s).swapRules,
      profiles: profilesFor(planSnapshot(active.plan)),
    };
    const row = {
      user_id: USER_ID,
      exercise_id: target.shownExerciseId,
      location: target.location,
      kind: 'dislike' as const,
      replacement_exercise_id: replacement,
      created_at: NOW,
      updated_at: NOW,
    };
    expect(isValidPreferenceOp({ kind: 'upsert_exercise_preference', row }, ctx)).toBe(true);
    expect(
      isValidPreferenceOp(
        { kind: 'upsert_exercise_preference', row: { ...row, user_id: randomUUID() } },
        ctx,
      ),
    ).toBe(false);
    expect(
      isValidPreferenceOp(
        {
          kind: 'upsert_exercise_preference',
          row: { ...row, note: 'Knie' } as unknown as typeof row,
        },
        ctx,
      ),
    ).toBe(false);
    expect(
      isValidPreferenceOp(
        { kind: 'upsert_exercise_preference', row: { ...row, exercise_id: 'gibt-es-nicht' } },
        { ...ctx, pair: { stored, shown: { ...stored, exercise_id: 'gibt-es-nicht' } } },
      ),
    ).toBe(false);
    expect(
      isValidPreferenceOp(
        { kind: 'delete_exercise_preference', exerciseId: 'x', location: 'gym' },
        { ...ctx, pair: null },
      ),
    ).toBe(true);
    expect(
      isValidPreferenceOp(
        { kind: 'delete_exercise_preference', exerciseId: 'x', location: 'gym' },
        { ...ctx, rows: { ...s.rows, profile: null } },
      ),
    ).toBe(false);
  });
});

describe('Trainingsmodus', () => {
  it('Tausch-Ziel aus dem Entwurf: Übungen des Entwurfs ausgeschlossen, gleiche Liste wie die Alternativen', async () => {
    const s = await setup();
    const stored = session(s.rows);
    const view = workoutView(s.rows, s.library, s.rules, stored.id, MONDAY);
    if (!view) throw new Error('Keine Ansicht');
    const draft = newWorkoutDraft(s.rows, view, {
      ownerUserId: USER_ID,
      today: MONDAY,
      now: NOW,
      newId: randomUUID,
    });
    if (!draft) throw new Error('Kein Entwurf');
    const item = view.items[0];
    const exercise = draft.exercises[0];
    if (!item || !exercise) throw new Error('fehlt');
    const target = workoutSwapTarget({
      session: view.stored,
      display: view.display,
      library: s.library,
      rows: s.rows,
      storedOrderNo: item.plannedOrderNo,
      plannedExerciseId: exercise.planned.exerciseId,
      draftExerciseIds: draft.exercises.slice(1).map((e) => currentTarget(e).exerciseId),
      harderVariantId: item.plan?.hint.harderVariant?.exerciseId ?? null,
    });
    if (!target) throw new Error('kein Ziel');
    // Dieselbe Core-Funktion wie planWorkout (Wächter S1): gleiche Liste.
    expect(target.choices.today.map((c) => c.id)).toEqual(item.alternatives.map((a) => a.id));
    for (const id of draft.exercises.map((e) => currentTarget(e).exerciseId)) {
      expect(target.choices.today.map((c) => c.id)).not.toContain(id);
    }
    expect(
      workoutSwapTarget({
        session: view.stored,
        display: view.display,
        library: s.library,
        rows: s.rows,
        storedOrderNo: null,
        plannedExerciseId: exercise.planned.exerciseId,
        draftExerciseIds: [],
        harderVariantId: null,
      }),
    ).toBeNull();
  });

  it('N4: laufender Entwurf mit Alternative, die nicht (mehr) in der Liste steht, bleibt fortsetzbar und speicherbar', async () => {
    const s = await setup();
    const stored = session(s.rows);
    const view = workoutView(s.rows, s.library, s.rules, stored.id, MONDAY);
    if (!view) throw new Error('Keine Ansicht');
    let draft = newWorkoutDraft(s.rows, view, {
      ownerUserId: USER_ID,
      today: MONDAY,
      now: NOW,
      newId: randomUUID,
    });
    if (!draft) throw new Error('Kein Entwurf');
    const exercise = draft.exercises[0];
    const item = view.items[0];
    if (!exercise || !item) throw new Error('fehlt');
    // Alternative „aus der alten Liste“: eine Übung, die die neue Liste NICHT anbietet (gleiche Belastungsart).
    const listed = new Set(item.alternatives.map((a) => a.id));
    const shownExercise = s.library.exercises.get(exercise.planned.exerciseId);
    const old = [...s.library.exercises.values()].find(
      (e) =>
        !listed.has(e.id) &&
        e.id !== exercise.planned.exerciseId &&
        e.load_type === shownExercise?.load_type,
    );
    if (!old) throw new Error('keine Übung außerhalb der Liste');
    const alternative = alternativeTarget(view, exercise, old.id);
    if (!alternative) throw new Error('Alternative fehlt');
    draft = chooseAlternative(draft, 0, alternative, NOW);
    await s.backend.saveDraft(draft);
    // „App-Update“: Präferenz schließt die Alternative inzwischen aus, Entwurf wird neu geladen.
    const [loaded] = await s.backend.loadDrafts();
    expect(loaded?.exercises[0]?.alternative?.exerciseId).toBe(old.id);
    if (!loaded) throw new Error('Entwurf fehlt');
    const payload = draftToPayload(tickAll(loaded), { writeId: randomUUID(), now: NOW });
    expect(payload.exercises[0]?.status).toBe('alternative');
    expect(payload.exercises[0]?.exercise_id).toBe(old.id);
    expect(await s.backend.submitWorkout(loaded, payload)).toEqual({
      kind: 'saved',
      orphaned: false,
    });
  });
});

describe('Nachprüfung Wächter T2', () => {
  it('S1: verpasster, nicht nachholbarer Termin → „Nur heute“ wirkt nicht und wird nicht angeboten', async () => {
    const s = await setup();
    const active = activePlan(s.rows);
    if (!active) throw new Error('Kein Plan');
    const friday = '2026-10-09';
    const monday = session(s.rows);
    const late = sessionDisplay({
      rows: s.rows,
      active,
      library: s.library,
      rules: s.rules,
      session: monday,
      today: friday,
      daySwaps: null,
      ownerUserId: USER_ID,
    });
    // Freitag steht selbst eine Einheit → Montag ist nicht nachholbar.
    expect(late.daySwapActive).toBe(false);
    expect(canSwapIn(monday, late, false, false)).toBe(false);
    expect(canSwapIn(monday, late, false, true)).toBe(true);
    const target = swapTargetFor(monday, late, s.library, s.rows, 0, friday);
    expect(target?.todayAllowed).toBe(false);
    // Gegenprobe: ein Day-Swap dort würde vom Core verworfen.
    if (!target?.choices.today[0]) return;
    const swap = newDaySwap(target, {
      ownerUserId: USER_ID,
      planId: active.plan.id,
      scheduledOn: monday.scheduled_on,
      alternativeId: target.choices.today[0].id,
      now: NOW,
    });
    const applied = sessionDisplay({
      rows: s.rows,
      active,
      library: s.library,
      rules: s.rules,
      session: monday,
      today: friday,
      daySwaps: swap ? [swap] : null,
      ownerUserId: USER_ID,
    });
    expect(applied.shown.daySwapped).toEqual([]);
    expect(applied.shown.droppedDaySwaps).toHaveLength(1);
    // Heute bzw. später: wirkt.
    expect(display(s).daySwapActive).toBe(true);
  });

  it('S2: eigenes Startgewicht für eine „nur heute“ getauschte Übung kommt im Entwurf an', async () => {
    const s = await setup();
    const active = activePlan(s.rows);
    if (!active) throw new Error('Kein Plan');
    const shown = display(s);
    let found: {
      index: number;
      alternativeId: string;
      target: ReturnType<typeof swapTargetFor>;
    } | null = null;
    for (let index = 0; index < shown.shown.session.exercises.length && !found; index += 1) {
      const target = swapTargetFor(session(s.rows), shown, s.library, s.rows, index, MONDAY);
      const weighted = target?.choices.today.find((c) => c.load_type === 'weight');
      if (target && weighted) found = { index, alternativeId: weighted.id, target };
    }
    if (!found?.target) throw new Error('keine gewichtete Alternative');
    const swap = newDaySwap(found.target, {
      ownerUserId: USER_ID,
      planId: active.plan.id,
      scheduledOn: MONDAY,
      alternativeId: found.alternativeId,
      now: NOW,
    });
    if (!swap) throw new Error('kein Swap');
    const options = { daySwaps: [swap], ownerUserId: USER_ID };
    const view = workoutView(s.rows, s.library, s.rules, session(s.rows).id, MONDAY, options);
    if (!view) throw new Error('Keine Ansicht');
    const draft = newWorkoutDraft(s.rows, view, {
      ownerUserId: USER_ID,
      today: MONDAY,
      now: NOW,
      newId: randomUUID,
    });
    const exercise = draft?.exercises[found.index];
    if (!exercise) throw new Error('Kein Entwurf');
    expect(exercise.planned.exerciseId).toBe(found.alternativeId);
    const rows2 = await s.backend.setStartWeight(found.alternativeId, 30, s.rows);
    const withSwaps = workoutView(rows2, s.library, s.rules, session(rows2).id, MONDAY, options);
    const replanned = withSwaps ? replannedTarget(withSwaps, exercise) : null;
    expect(replanned?.exerciseId).toBe(found.alternativeId);
    expect(replanned?.source).toBe('start_weight');
    // Ohne Day-Swaps (der frühere Fehler) fände die Neuberechnung die Übung nicht.
    const without = workoutView(rows2, s.library, s.rules, session(rows2).id, MONDAY);
    expect(without ? replannedTarget(without, exercise) : null).toBeNull();
  });

  it('S3: mehrdeutiger Ort (Tage egal, Studio und Zuhause) → beide Orte wählbar, gewählter Ort gespeichert und angewendet', async () => {
    const slots = (['strength_gym', 'strength_home', 'strength_gym'] as const).map((kind, i) => ({
      user_id: USER_ID,
      slot_no: i + 1,
      weekday: null,
      kind,
      minutes: 60,
    }));
    const s = await setup(planPersonRows({ slots }));
    const active = activePlan(s.rows);
    if (!active) throw new Error('Kein Plan');
    let picked: ReturnType<typeof swapTargetFor> = null;
    let pickedIndex = -1;
    let pickedSession = null as ReturnType<typeof session> | null;
    for (const candidate of active.sessions) {
      if (candidate.kind !== 'strength' || candidate.status !== 'planned' || picked) continue;
      const d = display(s, s.rows, null, candidate.scheduled_on);
      expect(d.location.ambiguous).toBe(true);
      for (let index = 0; index < d.shown.session.exercises.length; index += 1) {
        const target = swapTargetFor(candidate, d, s.library, s.rows, index, MONDAY);
        const other = target?.location === 'home' ? 'gym' : 'home';
        if (target && (target.choices.always.get(other)?.size ?? 0) > 0) {
          picked = target;
          pickedIndex = index;
          pickedSession = candidate;
          break;
        }
      }
    }
    if (!picked || !pickedSession) throw new Error('keine tauschbare Übung');
    expect(picked.ambiguousLocation).toBe(true);
    expect(picked.choices.locations).toEqual(['home', 'gym']);
    const chosen = picked.location === 'home' ? 'gym' : 'home';
    const replacementId = [...(picked.choices.always.get(chosen) ?? [])][0] ?? '';
    const save = preferenceSaveFor(picked, s.rows, {
      location: chosen,
      kind: 'dislike',
      replacementId,
      now: NOW,
    });
    const at = preferenceContextOf(picked);
    expect(at.ambiguousLocation).toBe(true);
    const after = await s.backend.updateExercisePreferences(save.changes, at, s.rows);
    expect(after.exercisePreferences[0]).toMatchObject({ location: chosen });
    // Anzeige wendet bei mehrdeutigem Ort die Präferenzen beider Orte an (4.4).
    const d2 = display(s, after, null, pickedSession.scheduled_on);
    expect(d2.shown.session.exercises[pickedIndex]?.exercise_id).not.toBe(picked.shownExerciseId);
    expect(d2.shown.preferenceSwapped?.[0]?.from).toBe(picked.shownExerciseId);
  });

  it('K1/K2: Präferenz für eine nicht angezeigte Übung abgelehnt; Obergrenze mit eigenem Fehlercode', async () => {
    const s = await setup();
    const { target } = swappable(s);
    const replacementId = [...(target.choices.always.get(target.location) ?? [])][0] ?? '';
    const other = session(s.rows).exercises.find(
      (e) => e.exercise_id !== target.shownExerciseId,
    )?.exercise_id;
    const wrong = preferenceSaveFor({ ...target, shownExerciseId: other ?? '' }, s.rows, {
      location: target.location,
      kind: 'dislike',
      replacementId,
      now: NOW,
    });
    await expect(
      s.backend.updateExercisePreferences(wrong.changes, preferenceContextOf(target), s.rows),
    ).rejects.toMatchObject({ code: 'preference_rejected' });
    const full = {
      ...s.rows,
      exercisePreferences: [...s.library.exercises.keys()]
        .filter((id) => id !== target.shownExerciseId)
        .slice(0, 50)
        .flatMap((id) =>
          (['home', 'gym'] as const).map((location) => ({
            user_id: USER_ID,
            exercise_id: id,
            location,
            kind: 'dislike' as const,
            replacement_exercise_id: null,
            created_at: NOW,
            updated_at: NOW,
          })),
        ),
    };
    expect(full.exercisePreferences).toHaveLength(100);
    const seeded = seededBackend(full, MONDAY, NOW);
    const save = preferenceSaveFor(target, full, {
      location: target.location,
      kind: 'dislike',
      replacementId,
      now: NOW,
    });
    await expect(
      seeded.backend.updateExercisePreferences(save.changes, preferenceContextOf(target), full),
    ).rejects.toMatchObject({ code: 'preference_limit' });
  });
});
