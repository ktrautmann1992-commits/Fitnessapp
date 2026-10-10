import { generatedPlanSchema, glossaryEntry, toSavePlanPayload } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { planPersonRows, seededBackend, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import { glossaryContextFromRows } from './glossary';
import { effectiveSafetyRules, generatePlanFromRows } from './training-plan';
import type { UserRows } from './types';

const HOME_SLOTS: UserRows['trainingSlots'] = [2, 4].map((weekday, i) => ({
  user_id: USER_ID,
  slot_no: i + 1,
  weekday,
  kind: 'strength_home',
  minutes: 45,
}));

const equipment = (equipment_id: string, location: 'home' | 'gym' = 'home') => ({
  user_id: USER_ID,
  equipment_id,
  location,
  weights_kg: [10],
  bar_kg: null,
  note: null,
});

describe('glossaryContextFromRows', () => {
  it('ohne Zeilen: keine Heim-Geräte, beide Orte, kein Plan', () => {
    const ctx = glossaryContextFromRows(null, null, null);
    expect(ctx.library).toBeNull();
    expect(ctx.rules).toBeNull();
    expect([...(ctx.homeProfile?.available ?? [])]).toEqual([]);
    expect(ctx.trainingProfiles).toHaveLength(2);
    expect(ctx.planExerciseIds?.size).toBe(0);
  });

  it('Heim-Geräte aus den aktuellen Angaben (nur Ort zu Hause, unbekannte übergangen)', () => {
    const rows = {
      ...planPersonRows({ slots: HOME_SLOTS }),
      userEquipment: [
        equipment('dumbbells'),
        equipment('gibt_es_nicht'),
        equipment('barbell', 'gym'),
      ],
    };
    const ctx = glossaryContextFromRows(rows, null, null);
    expect([...(ctx.homeProfile?.available ?? [])]).toEqual(['dumbbells']);
    // Nur Kraft zu Hause → ähnliche Übungen nur mit den Heim-Geräten.
    expect(ctx.trainingProfiles).toEqual([ctx.homeProfile]);
  });

  it('Studio-Tage → Studio-Profil; ohne Kraft-Tage → beide Orte', () => {
    const studio = glossaryContextFromRows(planPersonRows(), null, null);
    expect(studio.trainingProfiles).toHaveLength(1);
    expect(studio.trainingProfiles?.[0]?.available.has('cable_station')).toBe(true);
    const none = glossaryContextFromRows({ ...planPersonRows(), trainingSlots: [] }, null, null);
    expect(none.trainingProfiles).toHaveLength(2);
  });

  it('Übungen des aktiven Plans → „In deinem Plan“; Regeln wirken auf availableForMe', async () => {
    const rows = planPersonRows();
    const setup = seededBackend(rows, TODAY, `${TODAY}T08:00:00.000Z`);
    const library = await setup.backend.loadPlanLibrary({ allowCached: false });
    if (!library) throw new Error('Bibliothek fehlt');
    const result = generatePlanFromRows(rows, VERSIONS, library, TODAY);
    if (!result.ok) throw new Error(result.error);
    expect(generatedPlanSchema.safeParse(result.plan).success).toBe(true);
    const saved = await setup.backend.savePlan(toSavePlanPayload(result.plan), rows);
    const rules = effectiveSafetyRules(saved, VERSIONS, TODAY);
    const ctx = glossaryContextFromRows(saved, library, rules);
    const planned = result.plan.sessions[0]?.exercises[0]?.exercise_id ?? '';
    expect(ctx.planExerciseIds?.has(planned)).toBe(true);
    expect(glossaryEntry(planned, ctx)).toMatchObject({ inMyPlan: true, availableForMe: true });
  });
});
