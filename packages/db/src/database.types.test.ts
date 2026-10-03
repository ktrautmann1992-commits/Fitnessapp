import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { Constants } from './database.types';

// Solange database.types.ts von Hand gepflegt wird: Enums müssen exakt zu den Migrationen passen.
const migrationsDir = new URL('../../../supabase/migrations/', import.meta.url);
const sql = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .map((name) => readFileSync(new URL(name, migrationsDir), 'utf8'))
  .join('\n');

function enumsFromSql(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const match of sql.matchAll(/create type public\.([a-z_]+) as enum \(([^)]*)\)/g)) {
    result[match[1] as string] = [...(match[2] as string).matchAll(/'([^']+)'/g)].map(
      (value) => value[1] as string,
    );
  }
  return result;
}

describe('database.types.ts', () => {
  it('enthält genau die Enums der Migrationen', () => {
    const fromTypes = Object.fromEntries(
      Object.entries(Constants.public.Enums).map(([name, values]) => [name, [...values]]),
    );
    expect(fromTypes).toEqual(enumsFromSql());
  });
});
