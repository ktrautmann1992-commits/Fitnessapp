import { describe, expect, it } from 'vitest';

import { NOW, TODAY, testBackend, VERSIONS } from '../test/fixtures';
import { BackendError } from './backend';
import { STORAGE_KEYS } from './kv';
import { answersFromRows } from './mapping';
import type { StepSave, UserRows } from './types';

const screeningAllNoMale = {
  heart_condition: false,
  chest_pain_exercise: false,
  chest_pain_rest: false,
  dizziness: false,
  blood_pressure: false,
  bone_joint: false,
  medication: false,
  other_reason: false,
};
const screeningAllNo = { ...screeningAllNoMale, pregnancy: false };

async function signedInWithProfile() {
  const setup = testBackend();
  const { backend } = setup;
  if (backend.signIn.kind !== 'test_mode') {
    throw new Error('Testmodus erwartet');
  }
  await backend.signIn.start();
  await backend.createProfile('1990-05-15');
  await backend.grantConsents(['terms', 'privacy'], VERSIONS);
  return setup;
}

async function save(
  backend: ReturnType<typeof testBackend>['backend'],
  step: StepSave,
): Promise<UserRows> {
  const { rows } = await backend.loadRows();
  return backend.saveStep(step, { answers: answersFromRows(rows), rows, versions: VERSIONS });
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(BackendError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe('Testmodus: Anmeldung und Profil', () => {
  it('ohne Sitzung keine Daten', async () => {
    const { backend } = testBackend();
    expect(await backend.getSession()).toBeNull();
    await expectCode(backend.createProfile('1990-01-01'), 'not_signed_in');
  });

  it('Mindestalter 16 wird beim Profil erzwungen (genau 16 ok, einen Tag jünger nicht)', async () => {
    const { backend } = testBackend(TODAY);
    if (backend.signIn.kind !== 'test_mode') throw new Error();
    await backend.signIn.start();
    await expectCode(backend.createProfile('2010-10-04'), 'min_age');
    await expectCode(backend.createProfile('2030-01-01'), 'min_age');
    await backend.createProfile('2010-10-03');
    expect((await backend.loadRows()).rows.profile?.birth_date).toBe('2010-10-03');
  });

  it('ohne Profil keine Einwilligungen', async () => {
    const { backend } = testBackend();
    if (backend.signIn.kind !== 'test_mode') throw new Error();
    await backend.signIn.start();
    await expectCode(backend.grantConsents(['terms'], VERSIONS), 'profile_missing');
  });

  it('Einwilligungen mit Version, Zeitstempel und Plattform; doppelt = einmal', async () => {
    const { backend } = await signedInWithProfile();
    await backend.grantConsents(['terms'], VERSIONS);
    const { rows } = await backend.loadRows();
    expect(rows.consents).toHaveLength(2);
    expect(rows.consents[0]).toMatchObject({
      consent_type: 'terms',
      version: 1,
      granted_at: NOW,
      revoked_at: null,
      platform: 'web',
    });
  });

  it('nur die aktuelle Textversion kann erteilt werden', async () => {
    const { backend } = await signedInWithProfile();
    await expectCode(backend.grantConsents(['terms'], { ...VERSIONS, terms: 2 }), 'unknown');
  });

  it('Abmelden behält die Daten, erneuter Start nutzt denselben Nutzer', async () => {
    const { backend } = await signedInWithProfile();
    if (backend.signIn.kind !== 'test_mode') throw new Error();
    const before = await backend.getSession();
    await backend.signOut();
    expect(await backend.getSession()).toBeNull();
    const after = await backend.signIn.start();
    expect(after.userId).toBe(before?.userId);
    expect((await backend.loadRows()).rows.profile).not.toBeNull();
  });
});

describe('Testmodus: Gesundheitsdaten nur mit Einwilligung', () => {
  it('ohne Einwilligung werden Körperdaten abgelehnt', async () => {
    const { backend } = await signedInWithProfile();
    await expectCode(
      save(backend, {
        step: 'body_metrics',
        value: { heightCm: 170, weightKg: 70 },
        measuredOn: TODAY,
      }),
      'consent_required',
    );
    expect((await backend.loadRows()).rows.bodyMetrics).toEqual([]);
  });

  it('mit Einwilligung: Körperdaten, Umfänge, Check (Flags selbst berechnet), Unverträglichkeit', async () => {
    const { backend } = await signedInWithProfile();
    await save(backend, { step: 'sex', sex: 'female', cycleModuleInterest: false });
    await save(backend, { step: 'health_consent', granted: true });
    await save(backend, {
      step: 'body_metrics',
      value: { heightCm: 170, weightKg: 70 },
      measuredOn: TODAY,
    });
    await save(backend, {
      step: 'body_measurements',
      value: { waistCm: 75 },
      measuredOn: TODAY,
      reminderEnabled: true,
    });
    // Arzt-Hinweis muss bei Flags bestätigt sein.
    await expectCode(
      save(backend, {
        step: 'health_screening',
        answers: { ...screeningAllNo, pregnancy: true },
        acknowledgedAt: null,
      }),
      'unknown',
    );
    const rows = await save(backend, {
      step: 'health_screening',
      answers: { ...screeningAllNo, pregnancy: true },
      acknowledgedAt: NOW,
    });
    expect(rows.healthScreenings[0]?.flags).toEqual(['pregnancy', 'conservative_plan']);
    expect(rows.bodyMetrics).toHaveLength(1);
    expect(rows.bodyMeasurements[0]?.waist_cm).toBe(75);
    expect(rows.reminder).toMatchObject({
      enabled: true,
      interval_days: 28,
      next_due_on: '2026-10-31',
    });
    expect(rows.profile?.onboarding_step).toBe('experience');
  });

  it('Widerruf health_data löscht alle Gesundheitsdaten, Rest bleibt', async () => {
    const { backend } = await signedInWithProfile();
    await save(backend, { step: 'sex', sex: 'male', cycleModuleInterest: null });
    await save(backend, { step: 'health_consent', granted: true });
    await save(backend, {
      step: 'body_metrics',
      value: { heightCm: 180, weightKg: 80 },
      measuredOn: TODAY,
    });
    await save(backend, {
      step: 'health_screening',
      answers: screeningAllNoMale,
      acknowledgedAt: null,
    });
    await save(backend, { step: 'experience', experienceLevel: 'beginner' });
    await save(backend, {
      step: 'goal',
      goal: { goalType: 'fat_loss', discipline: null, targetDate: null },
    });
    await save(backend, {
      step: 'time_budget',
      schedule: {
        mode: 'flex',
        slots: [
          { kind: 'strength_gym', minutes: 45 },
          { kind: 'strength_gym', minutes: 45 },
          { kind: 'endurance', minutes: 30 },
        ],
      },
    });
    const afterNutrition = await save(backend, {
      step: 'nutrition',
      nutrition: {
        dietType: 'omnivore',
        eatsPork: true,
        mealsPerDay: 3,
        foodPreferences: [
          { foodGroup: 'peanuts', kind: 'intolerance' },
          { foodGroup: 'fish', kind: 'like' },
        ],
      },
    });
    expect(afterNutrition.foodPreferences).toHaveLength(2);
    // Kein Tag „Kraft zu Hause“ → Equipment übersprungen.
    expect(afterNutrition.profile?.onboarding_step).toBe('cooking');

    expect(afterNutrition.trainingSlots).toHaveLength(3);
    expect(afterNutrition.goals?.training_location).toBe('gym');
    await backend.revokeConsent('health_data');
    const { rows } = await backend.loadRows();
    expect(rows.bodyMetrics).toEqual([]);
    expect(rows.healthScreenings).toEqual([]);
    expect(rows.foodPreferences).toEqual([
      { user_id: rows.profile?.user_id, food_group: 'fish', kind: 'like' },
    ]);
    expect(rows.goals?.goal_type).toBe('fat_loss');
    // Trainingstage sind kein Gesundheitsdatum und bleiben.
    expect(rows.trainingSlots).toHaveLength(3);
    expect(rows.consents.find((c) => c.consent_type === 'health_data')?.revoked_at).toBe(NOW);
  });

  it('Unverträglichkeiten ohne Einwilligung werden nicht gespeichert', async () => {
    const { backend } = await signedInWithProfile();
    await save(backend, {
      step: 'goal',
      goal: { goalType: 'fat_loss', discipline: null, targetDate: null },
    });
    const rows = await save(backend, {
      step: 'nutrition',
      nutrition: {
        dietType: 'vegan',
        eatsPork: null,
        mealsPerDay: 2,
        foodPreferences: [{ foodGroup: 'peanuts', kind: 'intolerance' }],
      },
    });
    expect(rows.foodPreferences).toEqual([]);
  });
});

describe('Testmodus: Konto und Gerät', () => {
  it('Mess-Erinnerung: Abstand 7–90 Tage', async () => {
    const { backend } = await signedInWithProfile();
    const { rows } = await backend.loadRows();
    await expectCode(
      backend.saveReminder({ enabled: true, intervalDays: 5 }, null, rows),
      'unknown',
    );
    const saved = await backend.saveReminder(
      { enabled: false, intervalDays: 14 },
      '2026-10-17',
      rows,
    );
    expect(saved.reminder).toEqual({
      user_id: rows.profile?.user_id,
      enabled: false,
      interval_days: 14,
      next_due_on: '2026-10-17',
    });
  });

  it('Konto löschen entfernt alle Daten und die Sitzung', async () => {
    const { backend } = await signedInWithProfile();
    await backend.deleteAccount();
    expect(await backend.getSession()).toBeNull();
    if (backend.signIn.kind !== 'test_mode') throw new Error();
    await backend.signIn.start();
    expect((await backend.loadRows()).rows.profile).toBeNull();
  });

  it('Testdaten löschen leert alle App-Schlüssel', async () => {
    const { backend, store } = await signedInWithProfile();
    await store.setItem(STORAGE_KEYS.pendingBirthDate, '"1990-01-01"');
    await backend.clearDeviceData();
    expect(store.dump()).toEqual({});
  });
});

describe('Testmodus: Wertebereiche wie in der Datenbank', () => {
  it('lehnt Größe außerhalb 100–250 cm und Messdatum übermorgen ab – nichts wird gespeichert', async () => {
    const { backend } = await signedInWithProfile();
    await save(backend, { step: 'health_consent', granted: true });
    await expectCode(
      save(backend, {
        step: 'body_metrics',
        value: { heightCm: 500, weightKg: 70 },
        measuredOn: TODAY,
      }),
      'unknown',
    );
    await expectCode(
      save(backend, {
        step: 'body_metrics',
        value: { heightCm: 170, weightKg: 70 },
        measuredOn: '2026-10-05',
      }),
      'unknown',
    );
    const { rows } = await backend.loadRows();
    expect(rows.bodyMetrics).toEqual([]);
    expect(rows.profile?.onboarding_step).toBe('body_metrics');
  });
});

describe('Testmodus: Gerätespeicher älterer App-Versionen (vor Etappe B2)', () => {
  it('wandelt altes Zeitbudget in Trainingstage um und entfernt Langhantel-Werte über 25 kg', async () => {
    const { store, backend } = await signedInWithProfile();
    const raw = JSON.parse((await store.getItem(STORAGE_KEYS.localDb)) ?? '{}');
    const userId = raw.session.userId as string;
    // So sah der Gerätespeicher bis Etappe B2 aus: Zeitbudget in goals, keine trainingSlots, kein bar_kg.
    delete raw.rows.trainingSlots;
    raw.rows.profile.onboarding_step = 'training_location';
    raw.rows.goals = {
      user_id: userId,
      goal_type: 'muscle_gain',
      discipline: null,
      target_date: null,
      sessions_per_week: 2,
      minutes_per_session: 45,
      preferred_days: [4, 1],
      training_location: 'home',
    };
    raw.rows.userEquipment = [
      {
        user_id: userId,
        equipment_id: 'barbell',
        location: 'home',
        weights_kg: [2.5, 40],
        note: null,
      },
    ];
    await store.setItem(STORAGE_KEYS.localDb, JSON.stringify(raw));

    const { rows } = await backend.loadRows();
    expect(rows.goals).toEqual({
      user_id: userId,
      goal_type: 'muscle_gain',
      discipline: null,
      target_date: null,
      training_location: 'home',
    });
    expect(rows.trainingSlots).toEqual([
      { user_id: userId, slot_no: 1, weekday: 1, kind: 'strength_home', minutes: 45 },
      { user_id: userId, slot_no: 2, weekday: 4, kind: 'strength_home', minutes: 45 },
    ]);
    expect(rows.userEquipment[0]).toMatchObject({ weights_kg: [2.5], bar_kg: null });

    // Weiter im Onboarding: der alte Schritt „Trainingsort“ wird übersprungen, Speichern klappt.
    const saved = await save(backend, {
      step: 'equipment',
      items: [
        { equipmentId: 'barbell', location: 'home', weightsKg: [2.5], barKg: 20, note: null },
      ],
    });
    expect(saved.userEquipment[0]?.bar_kg).toBe(20);
    expect(saved.profile?.onboarding_step).toBe('nutrition');
  });
});
