/**
 * Test-Helfer der Live-Anpassung (nur in *.test.ts und für die Fixtures): ganze Pläne über mehrere Blöcke wie in der
 * App (nextBlockFromRows), als gespeicherte Einheiten mit ID und Status.
 */
import { addDays } from '../dates';
import { loadWeeksBeforeDeload } from '../plan/deload';
import { equipmentProfile } from '../plan/equipment-profile';
import { generateTrainingPlan, type GeneratedPlan } from '../plan/generate';
import { isBodyweightTemplateId } from '../plan/content-pool';
import type { PlanInputsInput } from '../plan/inputs';
import { planSafetyRules } from '../plan/safety';
import { type GeneratedSession, nextPlanBlock } from '../plan/schedule';
import type { StoredSession } from '../plan/view';
import { person, repoLibrary } from '../plan/test-library';
import type { ExerciseLogEntry, ProgressionContext } from '../log/types';
import type {
  LiveAdjustmentEnvironment,
  LiveAdjustmentInputs,
  LiveExerciseEntry,
  LiveSessionLog,
} from './inputs';
import type { AdjustmentProposal, StoredAdjustment } from './types';

export const adjustLibrary = repoLibrary();

/** Gespeicherte Einheiten mit fortlaufender ID (`<prefix><n>`) und Status `planned`. */
export function stored(sessions: readonly GeneratedSession[], prefix = 's', offset = 0) {
  return sessions.map((s, i): StoredSession => ({
    ...s,
    id: `${prefix}${offset + i + 1}`,
    status: 'planned',
    original_date: null,
  }));
}

export function profilesOf(inputs: PlanInputsInput) {
  const home = (inputs.homeEquipment ?? []).map((item) => ({
    equipmentId: item.equipmentId,
    weightsKg: [...(item.weightsKg ?? [])],
    ...('barKg' in item && item.barKg !== undefined ? { barKg: item.barKg } : {}),
  }));
  return new Map([
    ['home', equipmentProfile('home', home as never)],
    ['gym', equipmentProfile('gym', home as never)],
  ] as const);
}

export interface FollowUpOptions {
  /** Belastungswochen des letzten Blocks (trailingLoadWeeks) – Folgeblock nach deload_forward. */
  readonly carriedLoadWeeks?: number;
}

/** Ein Folgeblock wie in der App (nextBlockFromRows), ohne Tagebuch-Bezug (geplante Minuten). */
export function followUpBlock(
  plan: GeneratedPlan,
  inputs: PlanInputsInput,
  previous: readonly StoredSession[],
  options: FollowUpOptions = {},
): GeneratedSession[] {
  const last = previous
    .map((s) => s.scheduled_on)
    .sort()
    .at(-1) as string;
  const rules = planSafetyRules(
    {
      experienceLevel: inputs.experienceLevel,
      birthDate: inputs.birthDate,
      healthScreening: inputs.healthScreening ?? null,
    },
    addDays(last, 1),
  );
  return nextPlanBlock(previous, {
    schedule: plan.inputs.schedule,
    loadWeeks: loadWeeksBeforeDeload(plan.inputs.experienceLevel, rules.cautious),
    rules,
    library: adjustLibrary.exercises,
    profiles: profilesOf(inputs),
    endurance: {
      goalType: plan.inputs.goalType,
      discipline: plan.inputs.discipline,
      experienceLevel: plan.inputs.experienceLevel,
    },
    loadWeeksBefore: new Set(
      previous
        .filter((s) => s.week_no >= 1 && !s.is_deload)
        .map((s) => `${s.block_no}:${s.week_no}`),
    ).size,
    previousStartGroup: plan.safety_rules.enduranceStartGroup,
    protectLastCore: isBodyweightTemplateId(adjustLibrary, plan.template_id),
    ...(options.carriedLoadWeeks === undefined
      ? {}
      : { carriedLoadWeeks: options.carriedLoadWeeks }),
  });
}

/** Plan plus `followUps` Folgeblöcke (gespeicherte Einheiten). null = kein Plan möglich. */
export function planWithFollowUps(
  inputs: PlanInputsInput,
  today: string,
  followUps: number,
): { plan: GeneratedPlan; sessions: StoredSession[] } | null {
  const result = generateTrainingPlan(inputs, adjustLibrary, today);
  if (!result.ok) return null;
  let sessions = stored(result.plan.sessions);
  for (let i = 0; i < followUps; i += 1) {
    const next = followUpBlock(result.plan, inputs, sessions);
    if (next.length === 0) break;
    sessions = [...sessions, ...stored(next, 's', sessions.length)];
  }
  return { plan: result.plan, sessions };
}

// ---------------------------------------------------------------------------------------------------------
// Eingaben der Engine für Tests
// ---------------------------------------------------------------------------------------------------------

/** Kontext Langhantel-Bankdrücken (8–12 Wdh., 3 Sätze, RPE 8). */
export const BENCH: ProgressionContext = {
  loadType: 'weight',
  repsMin: 8,
  repsMax: 12,
  durationS: null,
  templateSets: 3,
  rpeTarget: 8,
  incrementKind: 'barbell',
};

export function liveInputs(
  sessions: readonly StoredSession[],
  overrides: Partial<LiveAdjustmentInputs> & {
    readonly level?: 'beginner' | 'advanced' | 'competitive';
  } = {},
): LiveAdjustmentInputs {
  const { level, ...rest } = overrides;
  const experienceLevel = level ?? 'advanced';
  return {
    today: '2026-10-16',
    entitled: true,
    healthConsentValid: true,
    person: { birthDate: '1990-01-15' },
    plan: {
      id: 'plan-1',
      startDate: sessions[0]?.scheduled_on ?? '2026-10-05',
      experienceLevel,
      fromHealthPlan: true,
      sessions,
    },
    rules: planSafetyRules(
      { experienceLevel, birthDate: '1990-01-15', healthScreening: { flags: [] } },
      '2026-10-16',
    ),
    sessionLogs: [],
    exerciseEntries: [],
    contexts: {},
    adjustments: [],
    ...rest,
  };
}

export const testEnv = (inputs: PlanInputsInput = person()): LiveAdjustmentEnvironment => ({
  library: adjustLibrary.exercises,
  profiles: profilesOf(inputs),
});

/** Session-Log zu einer geplanten Einheit (bzw. frei). */
export function sessionLog(
  id: string,
  performedOn: string,
  options: Partial<LiveSessionLog> = {},
): LiveSessionLog {
  return {
    id,
    plannedSessionId: null,
    kind: 'strength',
    performedOn,
    loggedAt: `${performedOn}T18:00:00Z`,
    status: 'completed',
    sessionRpe: null,
    isIntroWeek: false,
    isDeload: false,
    isFree: false,
    ...options,
  };
}

/** Einträge mit Einheit `log-<Datum>-<Index>`. */
export function withLogIds(entries: readonly ExerciseLogEntry[]): LiveExerciseEntry[] {
  return entries.map((e, i) => ({ ...e, sessionLogId: `log-${e.performedOn}-${i}` }));
}

/** Gespeicherte Anpassung aus einem Vorschlag. */
export function storedFrom(
  proposal: AdjustmentProposal,
  overrides: Partial<StoredAdjustment> = {},
): StoredAdjustment {
  return {
    ...proposal,
    id: `adj-${proposal.rule}-${proposal.inputFingerprint.slice(-6)}`,
    status: proposal.requiresConfirmation ? 'pending_confirmation' : 'applied',
    createdAt: '2026-10-16T19:00:00Z',
    decidedAt: null,
    ...overrides,
  };
}
