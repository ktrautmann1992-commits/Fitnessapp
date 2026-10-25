/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { CURRENT_CONSENT_VERSIONS } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { LOCAL_CONSENT_DOCUMENTS } from './consent-texts';

const read = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`../../../../supabase/migrations/${name}`, import.meta.url)),
    'utf8',
  );
/**
 * Phase 1 (terms, privacy, health_data), Etappe E3 (ai_food_photo), Phase 8 (wearable_data) und Phase 6 SU3
 * (health_data Fassung 2, Entwurf) und Phase 9 (cycle_data).
 */
const migration = [
  read('20261003120800_seed_consent_documents.sql'),
  read('20261016160100_ai_food_photo.sql'),
  read('20261021120100_wearables.sql'),
  read('20261021130200_supplement_user_data.sql'),
  read('20261021140000_cycle_module.sql'),
  read('20261023120100_wearable_routes.sql'),
  read('20261025120000_recovery_hrv.sql'),
].join('\n');

/** Liest (Art, Version, Titel, Text) aus der Seed-Migration. */
function seedDocuments() {
  const pattern = /\(\s*'(\w+)',\s*(\d+),\s*'([^']+)',\s*\$txt\$([\s\S]*?)\$txt\$/g;
  return [...migration.matchAll(pattern)].map((m) => ({
    type: m[1],
    version: Number(m[2]),
    title: m[3],
    body: m[4],
  }));
}

describe('Einwilligungstexte im Testmodus', () => {
  it('sind wörtlich identisch mit der jeweils höchsten Fassung aus den Seed-Migrationen', () => {
    const seed = seedDocuments();
    expect(seed).toHaveLength(9);
    const latest = seed.filter(
      (doc) => !seed.some((other) => other.type === doc.type && other.version > doc.version),
    );
    const byType = (a: { type?: string }, b: { type?: string }) =>
      (a.type ?? '').localeCompare(b.type ?? '');
    expect([...LOCAL_CONSENT_DOCUMENTS].sort(byType)).toEqual([...latest].sort(byType));
  });

  it('health_data Fassung 2 (Supplement-Modul): nennt Supplement-Check, „Meine Supplements“ und keine Weitergabe an Shops', () => {
    const doc = LOCAL_CONSENT_DOCUMENTS.find((d) => d.type === 'health_data');
    expect(doc?.version).toBe(2);
    expect(doc?.body).toContain('Supplement-Check');
    expect(doc?.body).toContain('„Meine Supplements“');
    expect(doc?.body).toContain('Shops und Partnernetzwerke erhalten keine dieser Angaben.');
  });

  it('entsprechen den aktuellen Versionen in packages/core', () => {
    for (const doc of LOCAL_CONSENT_DOCUMENTS) {
      expect(doc.version).toBe(CURRENT_CONSENT_VERSIONS[doc.type]);
    }
  });

  it('sind als Entwurf gekennzeichnet', () => {
    for (const doc of LOCAL_CONSENT_DOCUMENTS) {
      expect(doc.body.startsWith('ENTWURF – juristisch prüfen')).toBe(true);
    }
  });
});
