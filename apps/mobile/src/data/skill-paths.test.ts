/**
 * Skill-Pfade, Lauf-Kraft und Schlingentrainer in der App (docs/PLAN-CALISTHENICS-SCHLINGE.md 2.5/3/4): Abbildung
 * der Zeilen auf den Core-Kontext, Hinweis im Training aus der laufenden Einheit, Lauf-Kraft am Lauftag, Texte.
 */
import {
  findTextRuleHits,
  type PlanLibrary,
  SKILL_LOCK_REASONS,
  SKILL_PATH_IDS,
  SUSPENSION_POSITIONS,
  suspensionTrainerReady,
  type Workout,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { deCalisthenics } from '../i18n/de-calisthenics';
import { CONTENT_BUNDLE } from '../generated/content-files';
import { planPersonRows, seededBackend, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import { pendingRunStrengthWorkoutFiles } from '../test/pending-content';
import { runStrengthFor } from './run-strength';
import { draftSkillEntry, skillGateContextFromRows, skillHintsForDraft } from './skill-paths';
import { effectiveSafetyRules as effectiveSafetyRulesOrNull } from './training-plan';
import type { UserRows } from './types';
import type { WorkoutDraft } from './workout-draft';
import { workoutsFromBundle } from './workout-library';

async function library(): Promise<PlanLibrary> {
  const { backend } = seededBackend(planPersonRows());
  const lib = await backend.loadPlanLibrary({ allowCached: false });
  if (!lib) throw new Error('Bibliothek fehlt');
  return lib;
}

/**
 * Workouts im Testmodus plus die Lauf-Kraft-Einheiten, die erst mit claude/calisthenics-inhalte-2 (nach PR #182)
 * ins Bündel kommen (siehe test/pending-content).
 */
async function workouts(): Promise<readonly Workout[]> {
  const { backend } = seededBackend(planPersonRows());
  return [
    ...(await backend.loadWorkoutLibrary()).workouts,
    ...workoutsFromBundle(CONTENT_BUNDLE.files, pendingRunStrengthWorkoutFiles()),
  ];
}

function effectiveSafetyRules(...args: Parameters<typeof effectiveSafetyRulesOrNull>) {
  const rules = effectiveSafetyRulesOrNull(...args);
  if (!rules) throw new Error('Regeln fehlen');
  return rules;
}

const homeSlots: UserRows['trainingSlots'] = [1, 3, 5].map((weekday, i) => ({
  user_id: USER_ID,
  slot_no: i + 1,
  weekday,
  kind: 'strength_home',
  minutes: 45,
}));

describe('skillGateContextFromRows', () => {
  it('Level, Alter, Regeln und Tagebuch aus den Zeilen; Studio-Tage → Studio-Geräte', async () => {
    const rows = planPersonRows({ level: 'advanced' });
    const lib = await library();
    const rules = effectiveSafetyRules(rows, VERSIONS, TODAY);
    const ctx = skillGateContextFromRows({ rows, library: lib, rules, modes: null, today: TODAY });
    expect(ctx?.experienceLevel).toBe('advanced');
    expect(ctx?.age).toBe(36);
    expect(ctx?.profile?.available.has('dip_station')).toBe(true);
    expect(ctx?.pain).toBeNull();
    expect(ctx?.logs).toEqual([]);
  });

  it('nur zu Hause: Heim-Geräte (Park bringt Stange und Barren mit)', async () => {
    const rows: UserRows = {
      ...planPersonRows({ slots: homeSlots }),
      userEquipment: [
        {
          user_id: USER_ID,
          equipment_id: 'calisthenics_park',
          location: 'home',
          weights_kg: [],
          bar_kg: null,
          note: null,
        },
      ],
    };
    const lib = await library();
    const ctx = skillGateContextFromRows({
      rows,
      library: lib,
      rules: effectiveSafetyRules(rows, VERSIONS, TODAY),
      modes: null,
      today: TODAY,
    });
    expect([...(ctx?.profile?.available ?? [])].sort()).toEqual([
      'calisthenics_park',
      'dip_station',
      'pull_up_bar',
    ]);
  });

  it('ohne Profil-Level → kein Kontext (keine Hinweise)', async () => {
    const rows = planPersonRows();
    const broken = {
      ...rows,
      profile: rows.profile ? { ...rows.profile, experience_level: null } : null,
    };
    const lib = await library();
    expect(
      skillGateContextFromRows({
        rows: broken as UserRows,
        library: lib,
        rules: effectiveSafetyRules(rows, VERSIONS, TODAY),
        modes: null,
        today: TODAY,
      }),
    ).toBeNull();
  });
});

describe('Hinweis im Training (skillHintsForDraft)', () => {
  const set = (reps: number, done = true) => ({
    reps,
    weightKg: null,
    durationS: null,
    rpe: null,
    done,
  });
  const draftWith = (sets: ReturnType<typeof set>[], extra: Partial<WorkoutDraft> = {}) =>
    ({
      performedOn: TODAY,
      isIntroWeek: false,
      isDeload: false,
      isFree: false,
      updatedAt: `${TODAY}T18:00:00.000Z`,
      editing: false,
      exercises: [
        {
          planned: { exerciseId: 'liegestuetz' },
          alternative: null,
          skipped: false,
          sets,
        },
      ],
      ...extra,
    }) as unknown as WorkoutDraft;

  it('zweite saubere Einheit → „Nächste Stufe freigeschaltet: Diamant-Liegestütz“', async () => {
    const rows = planPersonRows();
    const lib = await library();
    const ctx = skillGateContextFromRows({
      rows,
      library: lib,
      rules: effectiveSafetyRules(rows, VERSIONS, TODAY),
      modes: null,
      today: TODAY,
    });
    const earlier = draftSkillEntry(
      { ...draftWith([]), performedOn: '2026-09-30' },
      { exerciseId: 'liegestuetz', skipped: false, sets: [set(10), set(10), set(11)] },
    );
    const withHistory = ctx && earlier ? { ...ctx, logs: [earlier] } : null;
    const hints = skillHintsForDraft(draftWith([set(10), set(10), set(10)]), withHistory);
    expect(hints[0]).toMatchObject({ kind: 'unlocked', nameDe: 'Diamant-Liegestütz' });
    // Noch kein Satz abgehakt, ausgelassen, Erholungswoche oder Bearbeiten → kein Hinweis.
    expect(skillHintsForDraft(draftWith([set(10, false)]), withHistory)[0]).toBeNull();
    expect(skillHintsForDraft(draftWith([set(10)], { isDeload: true }), withHistory)[0]).toBeNull();
    expect(skillHintsForDraft(draftWith([set(10)], { editing: true }), withHistory)[0]).toBeNull();
    expect(skillHintsForDraft(draftWith([set(10)]), null)[0]).toBeNull();
  });
});

describe('Lauf-Kraft am Lauftag (runStrengthFor)', () => {
  it('lockerer Lauf eines Laufplans bekommt eine Einheit (Testmodus mit Entwürfen); Kraft-Tag nicht', async () => {
    const lib = await library();
    const ws = await workouts();
    const rows = planPersonRows({ level: 'advanced' });
    const rules = effectiveSafetyRules(rows, VERSIONS, TODAY);
    const run = (date: string, minutes: number) => ({
      scheduled_on: date,
      kind: 'endurance' as const,
      endurance_modality: 'run' as const,
      workout_type: null,
      estimated_minutes: minutes,
      is_deload: false,
      is_intro_week: false,
      week_no: 2,
    });
    const sessions = [run('2026-10-06', 30), run('2026-10-08', 30), run('2026-10-11', 70)];
    const result = runStrengthFor({
      date: '2026-10-06',
      sessions,
      library: lib,
      workouts: ws,
      rules,
      modes: null,
    });
    expect(result?.unit.workout.category).toBe('run_strength');
    expect(result?.unit.items.length).toBeGreaterThanOrEqual(3);
    expect(
      runStrengthFor({
        date: '2026-10-11',
        sessions,
        library: lib,
        workouts: ws,
        rules,
        modes: null,
      }),
    ).toBeNull();
    // Ohne Workouts (Supabase vor der Freigabe) → nichts.
    expect(
      runStrengthFor({
        date: '2026-10-06',
        sessions,
        library: lib,
        workouts: [],
        rules,
        modes: null,
      }),
    ).toBeNull();
  });
});

describe('Schlingentrainer im Testmodus', () => {
  it('mit Entwürfen bereit, Bibliothek kennzeichnet Entwürfe', async () => {
    const lib = await library();
    expect(suspensionTrainerReady(lib.exercises)).toBe(true);
    expect(lib.containsDrafts).toBe(true);
  });
});

describe('Texte (de-calisthenics.ts)', () => {
  const texts: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === 'string') texts.push(value);
    else if (typeof value === 'function') {
      const out = (value as (...a: unknown[]) => unknown)('X', 1, 2);
      if (typeof out === 'string') texts.push(out);
    } else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect(deCalisthenics);

  it('keine Heilversprechen, keine Marken, keine Abzeichen/Ranglisten-Sprache', () => {
    for (const text of texts) {
      expect(findTextRuleHits(text), text).toEqual([]);
      expect(text).not.toMatch(/\bTRX\b|Abzeichen verdient|Rangliste(?!n,)|Punkte/i);
    }
  });

  it('jeder Pfad, jeder Sperr-Grund und jede Aufstellung hat einen Text', () => {
    for (const id of SKILL_PATH_IDS) expect(deCalisthenics.skills.paths[id]).toBeTruthy();
    for (const r of SKILL_LOCK_REASONS) expect(deCalisthenics.skills.locks[r]).toBeTruthy();
    for (const p of SUSPENSION_POSITIONS) expect(deCalisthenics.sling.positions[p]).toBeTruthy();
    expect(deCalisthenics.sling.anchor).toContain('zu der sich die Tür schließt');
  });
});
