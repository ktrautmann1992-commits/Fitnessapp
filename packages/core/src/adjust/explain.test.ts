import { describe, expect, it } from 'vitest';

import { ADJUSTMENT_STEP_MAX_KCAL, LIVE_ADJUSTMENT } from '../constants';
import { findTextRuleHits } from '../content/text-rules';
import { clampCalorieAdjustment } from '../nutrition/limits';
import { ADJUST_HINTS_DE, ADJUST_TEXTS_DE, explainAdjustment, renderExplanation } from './explain';
import { liveEntriesFromRows, liveSessionLogsFromRows } from './inputs';
import { explainParamsSchema, stateOverrideSchema } from './schemas';
import { ADJUSTMENT_RULES } from './types';

/** Begriffe über Körper und Gesundheit – in Erklärungen verboten (nur Aussagen über das Training). */
const FORBIDDEN = [
  'krankheit',
  'schmerz',
  'verletz',
  'gesund',
  'körper',
  'gewicht verlier',
  'abnehm',
  'arzt',
  'zyklus',
];

describe('Erklärungen (Plan 5.5)', () => {
  it('jede Regel aus adjustment_rule (auch reservierte) hat einen Text', () => {
    for (const rule of ADJUSTMENT_RULES) expect(ADJUST_TEXTS_DE[rule]).toBeTruthy();
  });

  it('kein Text enthält verbotene Wörter (Textregeln Ü6 und Körper-/Gesundheitsbegriffe)', () => {
    for (const text of [...Object.values(ADJUST_TEXTS_DE), ...Object.values(ADJUST_HINTS_DE)]) {
      expect(findTextRuleHits(text)).toEqual([]);
      for (const word of FORBIDDEN)
        expect(text.toLowerCase().includes(word), `${word}: ${text}`).toBe(false);
    }
  });

  it('Satz mit Übungsnamen aus der Bibliothek, deutschen Zahlen und Datum', () => {
    const { key, params } = explainAdjustment({
      rule: 'load_reduce',
      explainParams: {
        weight_before: 62.5,
        weight_after: 56.25,
        exercise_id: 'bankdruecken-langhantel',
      },
      stateBefore: null,
      stateAfter: null,
    });
    expect(
      renderExplanation(key, params, new Map([['bankdruecken-langhantel', 'Bankdrücken']])),
    ).toBe('Bankdrücken war zweimal deutlich zu schwer – nächstes Mal 56,25 kg statt 62,5 kg.');
    const fewer = renderExplanation('fewer_days', { done: 5, planned: 9, days: 2 }, new Map());
    expect(fewer).toBe(
      'Du hast in den letzten 3 Wochen 5 von 9 Einheiten geschafft. Möchtest du auf 2 Tage umstellen?',
    );
    expect(
      renderExplanation(
        'volume_reduce',
        { week_start: '2026-10-19', sets_reduction: 1 },
        new Map(),
      ),
    ).toContain('19.10.');
  });

  it('explain_params: nur Zahlen, Datum und Übungs-IDs – kein Freitext', () => {
    expect(
      explainParamsSchema.safeParse({
        weight: 60,
        week_start: '2026-10-19',
        exercise_id: 'liegestuetz',
      }).success,
    ).toBe(true);
    expect(explainParamsSchema.safeParse({ note: 'Knie tut weh' }).success).toBe(false);
    expect(
      stateOverrideSchema.safeParse({
        weightKg: 600,
        targetReps: 8,
        extraSet: false,
        durationS: null,
      }).success,
    ).toBe(false);
  });
});

describe('Kalorien: in 4b nur reserviert (Plan 5.2, Phase 5 K1)', () => {
  it('Schritt der Live-Anpassung ≤ ADJUSTMENT_STEP_MAX_KCAL; Begrenzung nur über clampCalorieAdjustment', () => {
    expect(LIVE_ADJUSTMENT.calorieStepKcal).toBeLessThanOrEqual(ADJUSTMENT_STEP_MAX_KCAL);
    expect(LIVE_ADJUSTMENT.calorieStepKcal).toBeGreaterThanOrEqual(100);
    expect(clampCalorieAdjustment(0, -LIVE_ADJUSTMENT.calorieStepKcal)).toBe(
      -LIVE_ADJUSTMENT.calorieStepKcal,
    );
  });
});

describe('Zeilen → Eingaben (eine Abbildung für App und Server, A0)', () => {
  it('liveEntriesFromRows hängt die ID der Einheit an; liveSessionLogsFromRows übernimmt Belastung und Kennzeichen', () => {
    const session = {
      id: 'sl1',
      user_id: 'u',
      planned_session_id: 'ps1',
      kind: 'strength' as const,
      performed_on: '2026-10-12',
      started_at: null,
      finished_at: '2026-10-12T19:00:00Z',
      status: 'completed' as const,
      session_rpe: 9,
      notes: null,
      name_de: 'Ganzkörper A',
      is_intro_week: false,
      is_deload: false,
      from_health_plan: false,
      is_free: false,
      revision: 1,
      last_write_id: 'w',
      source: 'manual' as const,
      client_updated_at: '2026-10-12T19:00:00Z',
      created_at: '2026-10-12T19:00:00Z',
      updated_at: '2026-10-12T19:00:00Z',
    };
    const exercise = {
      id: 'el1',
      session_log_id: 'sl1',
      user_id: 'u',
      order_no: 1,
      planned_exercise_id: null,
      exercise_id: 'bankdruecken-langhantel',
      exercise_name_de: 'Bankdrücken',
      load_type: 'weight' as const,
      status: 'done' as const,
      target_sets: 3,
      reps_min: 8,
      reps_max: 12,
      target_reps: 8,
      target_extra_set: false,
      target_weight_kg: 60,
      target_duration_s: null,
      target_rpe: 8,
      state_weight_kg: 60,
      state_target_reps: 8,
      state_extra_set: false,
      state_duration_s: null,
      weight_confirmed: false,
      is_return: false,
    };
    const orphan = { ...exercise, id: 'el2', session_log_id: 'unbekannt' };
    const entries = liveEntriesFromRows({
      sessionLogs: [session],
      exerciseLogs: [orphan, exercise],
      setLogs: [],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.sessionLogId).toBe('sl1');
    expect(liveSessionLogsFromRows([session])[0]).toMatchObject({
      sessionRpe: 9,
      plannedSessionId: 'ps1',
      isFree: false,
    });
  });
});
