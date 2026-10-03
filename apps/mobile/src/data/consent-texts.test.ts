/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { CURRENT_CONSENT_VERSIONS } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { LOCAL_CONSENT_DOCUMENTS } from './consent-texts';

const migration = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../supabase/migrations/20261003120800_seed_consent_documents.sql',
      import.meta.url,
    ),
  ),
  'utf8',
);

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
  it('sind wörtlich identisch mit der Seed-Migration (Version 1)', () => {
    const seed = seedDocuments();
    expect(seed).toHaveLength(3);
    expect(LOCAL_CONSENT_DOCUMENTS).toEqual(seed);
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
