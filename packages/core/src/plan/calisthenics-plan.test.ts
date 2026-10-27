/**
 * Ziel „Calisthenics / Körperbeherrschung“ (docs/PLAN-CALISTHENICS-SCHLINGE.md 2.4): eigene Vorlagen (Entwürfe,
 * ortsunabhängig), Rückfall ohne freigegebene Vorlage, Sicherheitsregeln (ab 65, vorsichtig), 1 vs. 7 Tage,
 * Zusammenspiel mit Reise- und Schon-Modus.
 */
import { describe, expect, it } from 'vitest';

import type { EquipmentId } from '../equipment';

import { addDays } from '../dates';
import { painEffectOn, type PainEpisode } from '../modes/pain';
import { travelOnDay, type TravelMode } from '../modes/travel';
import { equipmentProfile } from './equipment-profile';
import { generateTrainingPlan } from './generate';
import { goalProfile } from '../goals/profile';
import { MONDAY, person, repoLibrary } from './test-library';
import { prepareSessionForDisplay, type StoredSession } from './view';

const LIB = repoLibrary();
type HomeEquipment = { equipmentId: EquipmentId; weightsKg: number[] }[];
const BAR: HomeEquipment = [{ equipmentId: 'pull_up_bar', weightsKg: [] }];
const BAR_DIPS: HomeEquipment = [...BAR, { equipmentId: 'dip_station', weightsKg: [] }];
const PARK: HomeEquipment = [{ equipmentId: 'calisthenics_park', weightsKg: [] }];

function plan(overrides: Parameters<typeof person>[0]) {
  const result = generateTrainingPlan(
    person({ goalType: 'calisthenics', ...overrides }),
    LIB,
    MONDAY,
  );
  if (!result.ok) throw new Error(result.error);
  return result.plan;
}

describe('Vorlagen-Wahl', () => {
  it('Einsteiger zu Hause mit Stange: Calisthenics-Einsteiger-Vorlage, Güte nicht „fallback“, kein Orts-Hinweis', () => {
    const p = plan({ trainingLocation: 'home', homeEquipment: [...BAR] });
    expect(p.template_id).toBe('calisthenics-einsteiger-3t');
    expect(p.match_quality).not.toBe('fallback');
    expect(p.notes).not.toContain('location_mismatch');
    // Seit der Freigabe (27.10.2026) keine Entwürfe mehr.
    expect(p.uses_draft_content).toBe(false);
  });

  it('Fortgeschritten im Studio: Calisthenics-Fortgeschritten (ortsunabhängig, kein Orts-Hinweis)', () => {
    const p = plan({ experienceLevel: 'advanced', trainingLocation: 'gym' });
    expect(p.template_id).toBe('calisthenics-fortgeschritten-3t');
    expect(p.notes).not.toContain('location_mismatch');
  });

  it('Calisthenics-Park: Stange und Barren gelten als vorhanden – keine Dips am Stuhl nötig', () => {
    const p = plan({
      experienceLevel: 'advanced',
      trainingLocation: 'home',
      homeEquipment: [...PARK],
    });
    const ids = p.sessions.flatMap((s) => s.exercises.map((e) => e.exercise_id));
    expect(ids).toContain('dips-barren');
    expect(ids).toContain('klimmzug');
  });

  it('nur Körpergewicht zu Hause: trotzdem Calisthenics-Vorlage, Stangen-Übungen getauscht', () => {
    const p = plan({ trainingLocation: 'home', homeEquipment: [] });
    expect(p.template_id).toBe('calisthenics-einsteiger-3t');
    for (const s of p.sessions) {
      for (const e of s.exercises) {
        expect(LIB.exercises.get(e.exercise_id)!.equipment_ids, e.exercise_id).toEqual([]);
      }
    }
  });

  it('ohne freigegebene Calisthenics-Vorlage (Supabase vor der Freigabe): nächstbeste Vorlage, Güte „fallback“', () => {
    const live = { ...LIB, templates: LIB.templates.filter((t) => t.goal_type !== 'calisthenics') };
    const result = generateTrainingPlan(
      person({ goalType: 'calisthenics', trainingLocation: 'home', homeEquipment: [...BAR] }),
      live,
      MONDAY,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.match_quality).toBe('fallback');
  });

  it('andere Ziele bekommen nie eine Calisthenics-Vorlage', () => {
    for (const goalType of ['general_fitness', 'muscle_gain', 'fat_loss'] as const) {
      const p = generateTrainingPlan(
        person({ goalType, trainingLocation: 'home', homeEquipment: [...BAR_DIPS] }),
        LIB,
        MONDAY,
      );
      expect(p.ok && !p.plan.template_id?.startsWith('calisthenics-')).toBe(true);
    }
  });

  it('Ziel-Profil: Erhalt (0 %), Eiweiß 1,6 g/kg; mit Nebenziel Abnehmen −15 %, 2,0 g/kg', () => {
    expect(goalProfile({ primary: 'calisthenics', secondary: null }, 'beginner')).toMatchObject({
      templateGoal: 'calisthenics',
      proteinGPerKg: 1.6,
      energy: { direction: 'maintenance', adjustment: 0 },
    });
    expect(
      goalProfile({ primary: 'calisthenics', secondary: 'fat_loss' }, 'advanced'),
    ).toMatchObject({ proteinGPerKg: 2.0, energy: { direction: 'deficit', adjustment: -0.15 } });
  });
});

describe('Tage und Sicherheit', () => {
  it.each([1, 2, 3, 4, 7])('%i Wunsch-Tage: Plan mit 1–4 Kraft-Tagen pro Woche', (days) => {
    const p = plan({
      trainingLocation: 'home',
      homeEquipment: [...BAR],
      sessionsPerWeek: days,
      preferredDays: days === 7 ? [1, 2, 3, 4, 5, 6, 7] : [1, 3, 5, 6].slice(0, days),
    });
    const week = p.sessions.filter((s) => s.week_no === 1 && s.kind === 'strength');
    expect(week.length).toBeGreaterThanOrEqual(1);
    expect(week.length).toBeLessThanOrEqual(Math.min(days, 4));
  });

  it('ab 65 (Fortgeschritten): keine Übung mit hoher Technik im Plan, RPE ≤ 7', () => {
    const birthDate = addDays(MONDAY, -Math.round(66 * 365.25));
    const p = plan({
      experienceLevel: 'advanced',
      birthDate,
      trainingLocation: 'home',
      homeEquipment: [...BAR_DIPS],
    });
    for (const s of p.sessions) {
      for (const e of s.exercises) {
        expect(LIB.exercises.get(e.exercise_id)!.caution_tags, e.exercise_id).not.toContain(
          'high_skill',
        );
        expect(e.rpe_target).toBeLessThanOrEqual(7);
      }
    }
  });

  it('ohne Gesundheits-Check: nur Einsteiger-Vorlage (vorsichtig)', () => {
    const p = plan({ experienceLevel: 'advanced', healthScreening: null, trainingLocation: 'gym' });
    expect(p.template_id).toBe('calisthenics-einsteiger-3t');
  });
});

describe('Reise- und Schon-Modus mit Calisthenics', () => {
  const p = plan({
    experienceLevel: 'advanced',
    trainingLocation: 'home',
    homeEquipment: [...BAR_DIPS],
  });
  const first = p.sessions.find((s) => s.kind === 'strength')!;
  const stored = { ...first, id: 's1', status: 'planned' } as unknown as StoredSession;
  const display = (modes: Parameters<typeof prepareSessionForDisplay>[1]['modes']) =>
    prepareSessionForDisplay(stored, {
      rules: p.safety_rules,
      previousStartGroup: 'advanced',
      library: LIB.exercises,
      substituteLibrary: LIB.exercises,
      profile: equipmentProfile('home', [...BAR_DIPS]),
      modes,
    });
  const travel = (equipment: TravelMode['equipment']): TravelMode => ({
    id: '77777777-7777-4777-8777-777777777777',
    starts_on: first.scheduled_on,
    ends_on: addDays(first.scheduled_on, 6),
    equipment,
    max_minutes: null,
    created_at: `${MONDAY}T08:00:00Z`,
  });

  it('Reise mit Calisthenics-Park: Barren-Dips bleiben; Reise nur Körpergewicht: keine Geräte', () => {
    const park = display({ travel: travelOnDay([travel('outdoor_park')], first.scheduled_on) });
    const parkIds = park.session.exercises.map((e) => e.exercise_id);
    const original = first.exercises.map((e) => e.exercise_id);
    expect(parkIds).toEqual(original);
    const bw = display({ travel: travelOnDay([travel('bodyweight')], first.scheduled_on) });
    for (const e of bw.session.exercises) {
      expect(LIB.exercises.get(e.exercise_id)!.equipment_ids, e.exercise_id).toEqual([]);
    }
  });

  it('Reise + Schon-Modus Schulter gleichzeitig: keine Zug-/Stütz-Übung über Kopf, Plan bleibt gespeichert', () => {
    const episode: PainEpisode = {
      id: '88888888-8888-4888-8888-888888888888',
      region: 'shoulder',
      intensity: 'moderate',
      duration_days: 7,
      started_on: first.scheduled_on,
      ended_early_on: null,
      created_at: `${MONDAY}T08:00:00Z`,
    };
    const pain = painEffectOn([episode], first.scheduled_on);
    const shown = display({
      travel: travelOnDay([travel('rings')], first.scheduled_on),
      pain,
    });
    for (const e of shown.session.exercises) {
      const ex = LIB.exercises.get(e.exercise_id)!;
      expect(['vertical_pull', 'vertical_push']).not.toContain(ex.movement_pattern);
      expect(ex.equipment_ids.every((id) => id === 'gymnastic_rings')).toBe(true);
    }
    expect(stored.exercises.map((e) => e.exercise_id)).toEqual(
      first.exercises.map((e) => e.exercise_id),
    );
  });
});
