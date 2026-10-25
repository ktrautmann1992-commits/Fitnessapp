/**
 * Schuh-Kilometerzähler: Code (packages/core) und Datenbank (20261025120000_shoes.sql) nutzen dieselben Grenzen und
 * Felder. Eigene Datei (statt db-sync.test.ts), damit parallele Etappen nicht in derselben Datei arbeiten.
 */
import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { SHOE_MILEAGE } from '../constants';
import { DATA_EXPORT_TABLES } from '../export/data-export';
import {
  SHOE_SPORTS,
  shoeAssignmentSchema,
  shoeDataSchema,
  shoeDefaultSchema,
  shoeSchema,
} from './shoes';

const dir = new URL('../../../../supabase/migrations/', import.meta.url);
const file = readdirSync(dir).find((name) => name.endsWith('_shoes.sql'));
const sql = file ? readFileSync(new URL(file, dir), 'utf8') : '';

describe('Schuhe: Datenbank = Core', () => {
  it('Migration vorhanden, nur additiv', () => {
    expect(file).toBe('20261025120000_shoes.sql');
    expect(sql).not.toMatch(/drop table|alter column|rename |disable row/i);
  });

  it('Grenzen der CHECKs = SHOE_MILEAGE', () => {
    const S = SHOE_MILEAGE;
    expect(sql).toContain(`char_length(name) between 1 and ${S.nameMaxLength}`);
    expect(sql).toContain(`char_length(brand) between 1 and ${S.brandMaxLength}`);
    expect(sql).toContain(`start_km between 0 and ${S.startKmMax}`);
    expect(sql).toContain(
      `replace_km between ${S.replaceKmLimits.min} and ${S.replaceKmLimits.max}`,
    );
    expect(sql).toContain(`max_shoes constant integer := ${S.maxShoes};`);
    expect(sql).toContain(`max_assignments constant integer := ${S.maxAssignments};`);
    expect(sql).toContain(`max_defaults constant integer := ${S.maxShoes * 20};`);
    expect(sql).toContain(
      `private.jsonb_number_between(e -> 'replace_km', ${S.replaceKmLimits.min}, ${S.replaceKmLimits.max}, 0)`,
    );
    expect(sql).toContain(`private.jsonb_number_between(e -> 'start_km', 0, ${S.startKmMax}, 0)`);
  });

  it('Sportarten = SHOE_SPORTS', () => {
    const match = /check \(sport in \(([^)]+)\)\)/.exec(sql);
    const values = [...(match?.[1] ?? '').matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect([...values].sort()).toEqual([...SHOE_SPORTS].sort());
  });

  it('Felder von save_shoe_data = shoeDataSchema', () => {
    const keys = (name: string) =>
      [
        ...(
          new RegExp(`${name} constant text\\[\\] := array\\[([^\\]]+)\\]`).exec(sql)?.[1] ?? ''
        ).matchAll(/'([a-z_]+)'/g),
      ].map((m) => m[1]);
    const sorted = (shape: object) => Object.keys(shape).sort();
    expect(keys('shoe_keys')).toEqual(sorted(shoeSchema.shape));
    expect(keys('default_keys')).toEqual(sorted(shoeDefaultSchema.shape));
    expect(keys('assignment_keys')).toEqual(sorted(shoeAssignmentSchema.shape));
    expect(sql).toContain("is distinct from array['assignments', 'defaults', 'shoes']");
    expect(sorted(shoeDataSchema.shape)).toEqual(['assignments', 'defaults', 'shoes']);
  });

  it('Export enthält die drei Tabellen', () => {
    for (const table of ['shoes', 'shoe_defaults', 'shoe_assignments'] as const) {
      expect(DATA_EXPORT_TABLES).toContain(table);
      expect(sql).toContain(`'${table}', (select coalesce`);
    }
  });
});
