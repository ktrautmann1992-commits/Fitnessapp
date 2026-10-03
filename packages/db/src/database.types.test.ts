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
  // Später ergänzte Werte (alter type … add value …) hängen hinten an.
  for (const match of sql.matchAll(
    /alter type public\.([a-z_]+) add value (?:if not exists )?'([^']+)'/g,
  )) {
    result[match[1] as string]?.push(match[2] as string);
  }
  return result;
}

describe('database.types.ts', () => {
  it('kennt alle Tabellen der Migrationen (Schema public)', () => {
    const fromSql = [...sql.matchAll(/create table public\.([a-z_]+)/g)].map((m) => m[1]).sort();
    const source = readFileSync(new URL('./database.types.ts', import.meta.url), 'utf8');
    const tablesBlock = source.slice(source.indexOf('Tables: {'), source.indexOf('Views: {'));
    const fromTypes = [...tablesBlock.matchAll(/^ {6}([a-z_]+): \{$/gm)].map((m) => m[1]).sort();
    expect(fromTypes).toEqual(fromSql);
  });

  it('enthält genau die Enums der Migrationen', () => {
    const fromTypes = Object.fromEntries(
      Object.entries(Constants.public.Enums).map(([name, values]) => [name, [...values]]),
    );
    expect(fromTypes).toEqual(enumsFromSql());
  });
});
