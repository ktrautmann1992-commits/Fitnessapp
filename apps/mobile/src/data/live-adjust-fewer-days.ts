import {
  type FewerDaysChange,
  generatedPlanSchema,
  scheduleWithFewerDays,
  type TrainingSchedule,
  toSavePlanPayload,
} from '@fitnessapp/core';

import { type Backend, type BackendErrorCode, errorCode } from './backend';
import type { LocalAdjustment } from './live-adjust';
import { type ConsentVersions, answersFromRows, toTrainingSlotRows } from './mapping';
import { isCompetitionPlan } from './competition';
import { activePlan, generatePlanFromRows } from './training-plan';
import type { UserRows } from './types';

/** Trainingstage je Woche wie R5 sie zählt (feste Tage: verschiedene Wochentage; „Tage egal“: Einträge). */
const trainingDays = (schedule: TrainingSchedule) =>
  schedule.mode === 'fixed'
    ? new Set(schedule.slots.map((s) => s.weekday)).size
    : schedule.slots.length;

/** Ergebnis von „Umstellen“ (weniger Trainingstage, docs/PLAN-PHASE-4B.md 8.1 Punkt 3). */
export type FewerDaysOutcome =
  | { ok: true; days: number; rows: UserRows }
  | {
      ok: false;
      code: BackendErrorCode | 'expired' | 'not_possible' | 'incomplete';
      /** Neuer Stand, falls schon etwas geschrieben wurde (sonst null = nichts geändert). */
      rows: UserRows | null;
    };

/**
 * „Umstellen“ (Wächter D M1 – nie halb hängen bleiben):
 * 1. Vorschlag offen, nicht abgelaufen und passend zur AKTUELLEN Zahl der Trainingstage (`change_before.days`),
 * 2. neuen Plan ZUERST auf einer Kopie der Zeilen mit den neuen Trainingstagen erzeugen und prüfen (Zod) – scheitert das,
 *    wird NICHTS gespeichert,
 * 3. erst dann Tagebuch-Warteschlange senden, Trainingstage speichern, Plan speichern; scheitert das Speichern des Plans,
 *    werden die alten Trainingstage zurückgeschrieben,
 * 4. Vorschlag bestätigen – nur „confirmed“ gilt als Erfolg.
 * Wettkampfpläne werden hier nicht umgestellt (der Makrozyklus hängt am Wettkampf, „Mein Wettkampf“).
 */
export async function applyFewerDays(
  backend: Backend,
  params: {
    rows: UserRows;
    versions: ConsentVersions;
    proposal: LocalAdjustment | undefined;
    dropWeekday: number;
    today: string;
  },
): Promise<FewerDaysOutcome> {
  const live = backend.liveAdjust;
  const { rows, versions, proposal, today } = params;
  if (!live) return { ok: false, code: 'not_signed_in', rows: null };
  if (
    !proposal ||
    proposal.rule !== 'fewer_days' ||
    proposal.status !== 'pending_confirmation' ||
    (proposal.expiresOn !== null && proposal.expiresOn < today)
  ) {
    return { ok: false, code: 'expired', rows: null };
  }
  const answers = answersFromRows(rows);
  const schedule = answers.trainingSchedule;
  const before = proposal.changeBefore as FewerDaysChange | null;
  // Basis an den Vorschlag binden: hat sich die Zahl der Tage inzwischen geändert, gilt er nicht mehr.
  if (!schedule || !before || trainingDays(schedule) !== before.days) {
    return { ok: false, code: 'expired', rows: null };
  }
  const next = scheduleWithFewerDays(schedule, params.dropWeekday);
  const userId = rows.profile?.user_id;
  if (!next || !userId) return { ok: false, code: 'not_possible', rows: null };
  if (isCompetitionPlan(activePlan(rows))) return { ok: false, code: 'not_possible', rows: null };
  // 2. Plan auf einer Kopie erzeugen und prüfen – noch nichts gespeichert.
  let library;
  try {
    library = await backend.loadPlanLibrary({ allowCached: false });
  } catch (error) {
    return { ok: false, code: errorCode(error), rows: null };
  }
  if (!library) return { ok: false, code: 'network', rows: null };
  const candidate: UserRows = { ...rows, trainingSlots: toTrainingSlotRows(userId, next) };
  const result = generatePlanFromRows(candidate, versions, library, today);
  if (!result.ok) {
    return {
      ok: false,
      code:
        result.error === 'incomplete'
          ? 'incomplete'
          : result.error === 'no_template'
            ? 'no_template'
            : 'plan_rejected',
      rows: null,
    };
  }
  if (!generatedPlanSchema.safeParse(result.plan).success) {
    return { ok: false, code: 'plan_rejected', rows: null };
  }
  // 3. Speichern (H-b: erst wartende Trainings senden).
  let saved: UserRows;
  try {
    await backend.flush();
    saved = await backend.saveStep(
      { step: 'time_budget', schedule: next },
      { answers, rows, versions },
    );
  } catch (error) {
    return { ok: false, code: errorCode(error), rows: null };
  }
  let planned: UserRows;
  try {
    planned = await backend.savePlan(toSavePlanPayload(result.plan), saved);
  } catch (error) {
    // Alte Trainingstage zurückschreiben – nie neue Tage ohne neuen Plan.
    const restored = await backend
      .saveStep(
        { step: 'time_budget', schedule },
        { answers: answersFromRows(saved), rows: saved, versions },
      )
      .catch(() => saved);
    return { ok: false, code: errorCode(error), rows: restored };
  }
  // 4. Bestätigen – nur „confirmed“ ist Erfolg.
  const decided = await live.decide(proposal.id, true).catch(() => 'expired' as const);
  if (decided !== 'confirmed') return { ok: false, code: 'expired', rows: planned };
  return { ok: true, days: next.slots.length, rows: planned };
}
