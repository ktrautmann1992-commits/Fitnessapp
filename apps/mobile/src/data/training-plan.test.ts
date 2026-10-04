import {
  addDays,
  generatedPlanSchema,
  nextPlanBlock,
  startOfIsoWeek,
  toSavePlanPayload,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import {
  localBackendOn,
  planPersonRows,
  seededBackend,
  TODAY,
  USER_ID,
  VERSIONS,
} from '../test/fixtures';
import {
  activePlan,
  effectiveSafetyRules,
  generatePlanFromRows,
  healthPlanBasis,
  healthScreeningForPlan,
  nextBlockFromRows,
  planInputsFromRows,
  planOffer,
  rescheduleInRows,
  startGroupOf,
} from './training-plan';

describe('Angaben → Plan-Engine', () => {
  it('unvollständiges Onboarding → null', () => {
    const rows = planPersonRows();
    expect(planInputsFromRows({ ...rows, goals: null }, VERSIONS)).toBeNull();
    expect(planInputsFromRows({ ...rows, trainingSlots: [] }, VERSIONS)).toBeNull();
    expect(
      planInputsFromRows(
        { ...rows, profile: rows.profile && { ...rows.profile, experience_level: null } },
        VERSIONS,
      ),
    ).toBeNull();
  });

  it('Angaben ohne Körperdaten; Gesundheits-Check nur mit GÜLTIGER Einwilligung', () => {
    const inputs = planInputsFromRows(planPersonRows({ flags: ['injury'] }), VERSIONS);
    expect(inputs).toMatchObject({
      goalType: 'muscle_gain',
      experienceLevel: 'beginner',
      birthDate: '1990-05-15',
      healthScreening: { flags: ['injury'] },
      schedule: { mode: 'fixed' },
    });
    expect(JSON.stringify(inputs)).not.toMatch(/weight_kg|height|body/);
    expect(
      healthScreeningForPlan(planPersonRows({ consent: 'outdated', flags: ['injury'] }), VERSIONS),
    ).toBeNull();
    expect(healthScreeningForPlan(planPersonRows({ consent: 'none' }), VERSIONS)).toBeNull();
    expect(healthScreeningForPlan(planPersonRows({ flags: null }), VERSIONS)).toBeNull();
  });

  it('uses_health_data / medical_notice wie private.plan_health_basis()', () => {
    expect(healthPlanBasis(planPersonRows(), VERSIONS)).toEqual({
      usesHealthData: true,
      medicalNotice: false,
    });
    expect(healthPlanBasis(planPersonRows({ flags: ['pregnancy'] }), VERSIONS)).toEqual({
      usesHealthData: true,
      medicalNotice: true,
    });
    expect(healthPlanBasis(planPersonRows({ consent: 'outdated' }), VERSIONS)).toEqual({
      usesHealthData: false,
      medicalNotice: false,
    });
  });

  it('erzeugter Plan erfüllt die Datenbank-Grenzen (Zod)', async () => {
    const { backend } = seededBackend(planPersonRows());
    const library = await backend.loadPlanLibrary({ allowCached: false });
    if (!library) throw new Error('Bibliothek fehlt');
    const result = generatePlanFromRows(planPersonRows(), VERSIONS, library, TODAY);
    expect(result.ok).toBe(true);
    if (result.ok) expect(generatedPlanSchema.safeParse(result.plan).success).toBe(true);
    expect(
      generatePlanFromRows({ ...planPersonRows(), goals: null }, VERSIONS, library, TODAY),
    ).toEqual({ ok: false, error: 'incomplete' });
  });
});

/** Plan erzeugen und im Testmodus speichern (wie „Plan erstellen“ in der App). */
async function savedPlan(rows = planPersonRows(), today = TODAY) {
  const setup = seededBackend(rows, today, `${today}T08:00:00.000Z`);
  const library = await setup.backend.loadPlanLibrary({ allowCached: false });
  if (!library) throw new Error('Bibliothek fehlt');
  const result = generatePlanFromRows(rows, VERSIONS, library, today);
  if (!result.ok) throw new Error(result.error);
  const saved = await setup.backend.savePlan(toSavePlanPayload(result.plan), rows);
  return { ...setup, library, generated: result.plan, rows: saved };
}

describe('Gespeicherter Plan', () => {
  it('activePlan: Einheiten nach Datum, Übungen nach order_no, Schnappschuss-Spalten', async () => {
    const { rows, generated } = await savedPlan();
    const active = activePlan(rows);
    expect(active?.plan.uses_health_data).toBe(true);
    expect(active?.sessions).toHaveLength(generated.sessions.length);
    expect(active?.sessions.map((s) => s.scheduled_on)).toEqual(
      generated.sessions.map((s) => s.scheduled_on),
    );
    const first = active?.sessions[0];
    expect(first?.exercises.map((e) => e.order_no)).toEqual(
      generated.sessions[0]?.exercises.map((e) => e.order_no),
    );
    expect(first?.status).toBe('planned');
  });

  it('Verschieben über die Regeln aus packages/core (nie stapeln, gleiche Woche)', async () => {
    const { rows } = await savedPlan();
    const active = activePlan(rows);
    const session = active?.sessions.find((s) => s.scheduled_on === '2026-10-05');
    if (!session) throw new Error('Montag fehlt');
    const result = rescheduleInRows(rows, session.id, '2026-10-05');
    expect(['moved', 'skipped']).toContain(result.kind);
    if (result.kind === 'moved') {
      expect(startOfIsoWeek(result.date)).toBe('2026-10-05');
      expect(rows.plannedSessions.some((s) => s.scheduled_on === result.date)).toBe(false);
    }
  });

  it('„Plan neu erstellen?“ bei geänderten Angaben und deutlich bei neuem Flag', async () => {
    const { rows } = await savedPlan();
    const active = activePlan(rows);
    if (!active) throw new Error();
    const rules = effectiveSafetyRules(rows, VERSIONS, TODAY);
    if (!rules) throw new Error();
    expect(planOffer(rows, VERSIONS, active, rules, TODAY)?.offer).toBe(false);

    const changed = {
      ...rows,
      goals: rows.goals && { ...rows.goals, goal_type: 'fat_loss' as const },
    };
    expect(planOffer(changed, VERSIONS, active, rules, TODAY)?.reasons).toEqual(['inputs_changed']);

    const flagged = {
      ...rows,
      healthScreenings: [
        {
          ...rows.healthScreenings[0]!,
          id: 'hs-2',
          flags: ['injury', 'conservative_plan'],
          created_at: '2026-10-04T08:00:00.000Z',
        },
      ],
    };
    const stricter = effectiveSafetyRules(flagged, VERSIONS, '2026-10-04');
    if (!stricter) throw new Error();
    const offer = planOffer(flagged, VERSIONS, active, stricter, '2026-10-04');
    expect(offer?.stricter).toBe(true);
    expect(offer?.reasons).toContain('health_check_newer');
  });
});

describe('Folgeblock', () => {
  // Fortgeschritten, Ausdauer Di/Do/Sa à 60 min; 65. Geburtstag zwischen Erstellen und Folgeblock.
  const slots = [2, 4, 6].map((weekday, i) => ({
    user_id: USER_ID,
    slot_no: i + 1,
    weekday,
    kind: 'endurance' as const,
    minutes: 60,
  }));
  const person = planPersonRows({
    level: 'advanced',
    birthDate: '1961-10-20',
    goal: 'endurance',
    slots,
  });

  it('Folgeblock nach Neuladen (ohne safety_rules) setzt zurück – Startgruppe nur aus planStartGroup()', async () => {
    const { store, rows, generated, library } = await savedPlan(person, '2026-10-05');
    expect(generated.safety_rules.enduranceStartGroup).toBe('advanced');
    const active = activePlan(rows);
    if (!active) throw new Error();
    // Letzte Woche des Blocks: App neu gestartet (keine safety_rules mehr im Speicher), jetzt 65.
    const lastWeek = startOfIsoWeek(active.sessions.at(-1)?.scheduled_on ?? TODAY);
    const reloaded = localBackendOn(store, lastWeek, `${lastWeek}T08:00:00.000Z`);
    const { rows: loaded } = await reloaded.loadRows();
    const reActive = activePlan(loaded);
    if (!reActive) throw new Error();
    expect(startGroupOf(reActive, '1961-10-20')).toBe('advanced');
    const rules = effectiveSafetyRules(loaded, VERSIONS, lastWeek);
    if (!rules) throw new Error();
    expect(rules.enduranceStartGroup).toBe('cautious');

    const block = nextBlockFromRows(loaded, reActive, rules, library, lastWeek);
    expect(block).not.toBeNull();
    const firstWeek = block?.filter((s) => s.week_no === 1) ?? [];
    expect(firstWeek.length).toBeGreaterThan(0);
    for (const s of firstWeek) {
      // Strengere Gruppe: Start-Deckel je Einheit (vorsichtig 20 min), Gehen statt Laufen.
      expect(s.estimated_minutes).toBeLessThanOrEqual(20);
      expect(s.endurance_modality).toBe('walk');
      expect(s.effort_target).toBeLessThanOrEqual(3);
    }
    // Gegenprobe: ohne Rücksetzen (falsche Startgruppe) wären die Einheiten länger.
    const wrong = nextPlanBlock(reActive.sessions, {
      schedule: {
        mode: 'fixed',
        slots: slots.map(({ weekday, kind, minutes }) => ({ weekday, kind, minutes })),
      },
      loadWeeks: 4,
      rules,
      library: library.exercises,
      profiles: new Map(),
      endurance: { goalType: 'endurance', discipline: null, experienceLevel: 'advanced' },
      previousStartGroup: 'cautious',
    });
    expect(
      Math.max(...wrong.filter((s) => s.week_no === 1).map((s) => s.estimated_minutes)),
    ).toBeGreaterThan(20);

    // Der Testmodus nimmt den Folgeblock an (block_no + 1, ab Montag nach der letzten Einheit).
    const appended = await reloaded.appendPlanBlock(
      reActive.plan.id,
      reActive.plan.uses_health_data,
      block ?? [],
      loaded,
    );
    const blocks = new Set(appended.plannedSessions.map((s) => s.block_no));
    expect([...blocks].sort()).toEqual([1, 2]);
    expect(
      appended.plannedSessions
        .filter((s) => s.block_no === 2)
        .every((s) => s.scheduled_on >= addDays(lastWeek, 7)),
    ).toBe(true);
  });
});
