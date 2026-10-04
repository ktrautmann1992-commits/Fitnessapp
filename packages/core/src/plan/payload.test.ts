import { describe, expect, it } from 'vitest';

import { generateTrainingPlan } from './generate';
import { toSavePlanPayload } from './payload';
import { MONDAY, person, repoLibrary } from './test-library';

describe('toSavePlanPayload', () => {
  const result = generateTrainingPlan(
    person({ healthScreening: { flags: ['pregnancy', 'injury', 'conservative_plan'] } }),
    repoLibrary(),
    MONDAY,
  );
  if (!result.ok) throw new Error(result.error);
  const payload = toSavePlanPayload(result.plan);

  it('enthält nur die Spalten aus Abschnitt 8', () => {
    expect(Object.keys(payload).sort()).toEqual([
      'engine_version',
      'inputs',
      'match_quality',
      'medical_notice',
      'notes',
      'sessions',
      'start_date',
      'template_id',
      'template_title_de',
      'template_version',
      'uses_health_data',
    ]);
    expect(Object.keys(payload.sessions[0] ?? {}).sort()).toEqual([
      'block_no',
      'cooldown_de',
      'estimated_minutes',
      'exercises',
      'focus',
      'is_deload',
      'is_intro_week',
      'name_de',
      'scheduled_on',
      'template_day_index',
      'warmup_de',
      'week_no',
    ]);
  });

  it('nie Sicherheitsregeln, Schwangerschafts-Hinweis, Gesundheits-Check oder Geburtsdatum', () => {
    const json = JSON.stringify(payload);
    for (const forbidden of [
      'safety_rules',
      'safetyRules',
      'pregnancyNotice',
      'pregnancy',
      'healthScreening',
      'flags',
      'birthDate',
      '1996-01-15',
      'excludedCautionTags',
      'training_days',
      'uses_draft_content',
    ]) {
      expect(json).not.toContain(forbidden);
    }
  });

  it('Werte stimmen mit dem Plan überein', () => {
    expect(payload.sessions).toHaveLength(result.plan.sessions.length);
    expect(payload.medical_notice).toBe(true);
    expect(payload.uses_health_data).toBe(true);
  });
});
