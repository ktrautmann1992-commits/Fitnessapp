import { createMemoryStore } from '../data/kv';
import { createLocalBackend } from '../data/local-backend';
import { CURRENT_CONSENT_VERSIONS } from '@fitnessapp/core';
import type { ConsentVersions } from '../data/mapping';
import { emptyUserRows, type ProfileRow, type UserRows } from '../data/types';

export const USER_ID = '00000000-0000-4000-8000-000000000001';
export const TODAY = '2026-10-03';
export const NOW = '2026-10-03T10:00:00.000Z';
export const VERSIONS: ConsentVersions = CURRENT_CONSENT_VERSIONS;

export function profile(patch: Partial<ProfileRow> = {}): ProfileRow {
  return {
    user_id: USER_ID,
    birth_date: '1990-05-15',
    sex: null,
    experience_level: null,
    locale: 'de-DE',
    cycle_module_interest: null,
    onboarding_step: null,
    onboarding_completed_at: null,
    ...patch,
  };
}

export function consent(
  type: 'terms' | 'privacy' | 'health_data',
  patch: Partial<UserRows['consents'][number]> = {},
): UserRows['consents'][number] {
  return {
    id: `c-${type}-${patch.version ?? 1}`,
    user_id: USER_ID,
    consent_type: type,
    version: 1,
    granted_at: NOW,
    revoked_at: null,
    platform: 'web',
    ...patch,
  };
}

export function rowsWith(patch: Partial<UserRows> = {}): UserRows {
  return { ...emptyUserRows(), profile: profile(), ...patch };
}

export function testBackend(today = TODAY) {
  const store = createMemoryStore();
  let counter = 0;
  const backend = createLocalBackend(store, {
    platform: 'web',
    today: () => today,
    now: () => NOW,
    newId: () => `id-${++counter}`,
  });
  return { store, backend };
}

// ---------------------------------------------------------------------------------------------------------
// Trainingsplan (Etappe C): fertig eingerichtete Person + Testmodus mit vorbelegtem Gerätespeicher
// ---------------------------------------------------------------------------------------------------------

export interface PlanPersonOptions {
  birthDate?: string;
  level?: 'beginner' | 'advanced' | 'competitive';
  /** Einwilligung health_data: gültig, keine oder veraltet (Version 0). */
  consent?: 'valid' | 'none' | 'outdated';
  /** Flags des Gesundheits-Checks; null = kein Check. */
  flags?: string[] | null;
  screeningAt?: string;
  slots?: UserRows['trainingSlots'];
  goal?: NonNullable<UserRows['goals']>['goal_type'];
}

const STUDIO_3_DAYS: UserRows['trainingSlots'] = [1, 3, 5].map((weekday, i) => ({
  user_id: USER_ID,
  slot_no: i + 1,
  weekday,
  kind: 'strength_gym',
  minutes: 60,
}));

export function planPersonRows(options: PlanPersonOptions = {}): UserRows {
  const consentMode = options.consent ?? 'valid';
  const consents = [consent('terms'), consent('privacy')];
  if (consentMode !== 'none') {
    consents.push(consent('health_data', { version: consentMode === 'outdated' ? 0 : 1 }));
  }
  const flags = options.flags === undefined ? [] : options.flags;
  return rowsWith({
    profile: profile({
      birth_date: options.birthDate ?? '1990-05-15',
      sex: 'male',
      experience_level: options.level ?? 'beginner',
      onboarding_step: 'cooking',
      onboarding_completed_at: NOW,
    }),
    consents,
    goals: {
      user_id: USER_ID,
      goal_type: options.goal ?? 'muscle_gain',
      discipline: null,
      target_date: null,
      training_location: 'gym',
    },
    trainingSlots: options.slots ?? STUDIO_3_DAYS,
    healthScreenings:
      flags === null
        ? []
        : [
            {
              id: 'hs-1',
              user_id: USER_ID,
              answers: {},
              flags,
              medical_notice_acknowledged_at: flags.length > 0 ? NOW : null,
              created_at: options.screeningAt ?? '2026-10-01T08:00:00.000Z',
            },
          ],
  });
}

/** Testmodus mit vorbelegtem Gerätespeicher (angemeldet), festem „heute“ und Zeitpunkt. */
export function seededBackend(rows: UserRows, today = TODAY, now = NOW) {
  const store = createMemoryStore({
    'fitnessapp.local.v1': JSON.stringify({ session: { userId: USER_ID, email: null }, rows }),
  });
  return { store, backend: localBackendOn(store, today, now) };
}

/** Weitere Instanz auf demselben Gerätespeicher (= App neu gestartet, ggf. an einem anderen Tag). */
export function localBackendOn(
  store: ReturnType<typeof createMemoryStore>,
  today: string,
  now: string,
) {
  let counter = 0;
  return createLocalBackend(store, {
    platform: 'web',
    today: () => today,
    now: () => now,
    newId: () => `id-${today}-${++counter}`,
  });
}
