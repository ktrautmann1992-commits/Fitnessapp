import { describe, expect, it } from 'vitest';

import type { WorkoutStep } from './intensity';
import { planSafetyRules } from './safety';
import { prepareSessionForDisplay, type StoredSession } from './view';

/**
 * Anzeige von Wettkampf-Einheiten (WP4, Wächter N3 zu WP2): prepareSessionForDisplay mit `competitionWeek` wendet
 * applyCompetitionWeekLimits an – wird das Level strenger, bleibt je Woche nur die früheste harte Einheit.
 */

const steps: WorkoutStep[] = [
  { part: 'warmup', kind: 'easy', seconds: 600, effort: 3 },
  { part: 'main', kind: 'work', seconds: 1500, effort: 7 },
  { part: 'cooldown', kind: 'easy', seconds: 300, effort: 3 },
];
const session = (id: string, scheduled_on: string): StoredSession => ({
  id,
  status: 'planned',
  original_date: null,
  block_no: 1,
  week_no: 3,
  is_intro_week: false,
  is_deload: false,
  kind: 'endurance',
  template_day_index: null,
  scheduled_on,
  name_de: 'Tempodauerlauf',
  focus: null,
  endurance_modality: 'run',
  effort_target: 7,
  estimated_minutes: 40,
  warmup_de: 'Einlaufen',
  cooldown_de: 'Auslaufen',
  workout_type: 'tempo',
  training_phase: 'build',
  workout_steps: steps,
  target_distance_m: null,
  exercises: [],
});
const tue = session('tue', '2026-11-03');
const thu = session('thu', '2026-11-05');
const nextWeek = session('next', '2026-11-10');
const rules = (level: 'beginner' | 'advanced') =>
  planSafetyRules(
    { experienceLevel: level, birthDate: '1990-01-01', healthScreening: { flags: [] } },
    '2026-10-16',
  );
const display = (s: StoredSession, level: 'beginner' | 'advanced', withWeek = true) =>
  prepareSessionForDisplay(s, {
    rules: rules(level),
    previousStartGroup: rules(level).enduranceStartGroup,
    library: null,
    ...(withWeek ? { competitionWeek: { sessions: [tue, thu, nextWeek], level } } : {}),
  }).session;

describe('prepareSessionForDisplay mit competitionWeek', () => {
  it('Fortgeschritten: beide harten Einheiten der Woche bleiben', () => {
    expect(display(tue, 'advanced').workout_type).toBe('tempo');
    expect(display(thu, 'advanced').workout_type).toBe('tempo');
  });
  it('jetzt Einsteiger: die frühere bleibt, die spätere wird locker (Name, Schritte, Anstrengung)', () => {
    expect(display(tue, 'beginner').workout_type).toBe('tempo');
    const later = display(thu, 'beginner');
    expect(later.workout_type).toBe('easy');
    expect(later.effort_target).toBeLessThanOrEqual(4);
    expect((later.workout_steps ?? []).every((st) => st.effort <= 4)).toBe(true);
    expect(later.name_de).not.toBe('Tempodauerlauf');
    // Andere Woche: zählt für sich.
    expect(display(nextWeek, 'beginner').workout_type).toBe('tempo');
  });
  it('ohne competitionWeek: wie bisher (nur applyCurrentEnduranceRules)', () => {
    expect(display(thu, 'beginner', false).workout_type).toBe('tempo');
  });
});
