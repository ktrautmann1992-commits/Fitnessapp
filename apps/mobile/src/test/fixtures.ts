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
