/**
 * Live-Begleitung: Code (packages/core/src/live) und Datenbank (20261027170000_live_companion.sql,
 * 20261027170100_live_export_my_data.sql) nutzen dieselben Grenzen. Eigene Datei (statt db-sync.test.ts), damit
 * parallele Etappen nicht in derselben Datei arbeiten.
 */
import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { LIVE_COMPANION } from '../constants';
import { DATA_EXPORT_TABLES } from '../export/data-export';
import {
  LIVE_PUSH_RESULTS,
  LIVE_SPORTS,
  LIVE_STATUSES,
  livePositionSchema,
  liveViewSchema,
} from './schema';

const dir = new URL('../../../../supabase/migrations/', import.meta.url);
const files = readdirSync(dir).sort();
const read = (suffix: string) => {
  const file = files.find((name) => name.endsWith(suffix));
  return { file, sql: file ? readFileSync(new URL(file, dir), 'utf8') : '' };
};
const { file, sql } = read('_live_companion.sql');
const exportFile = read('_live_export_my_data.sql');
const L = LIVE_COMPANION;

/** Rumpf einer Funktion bis zum Ende ihres $$-Blocks. */
const fn = (name: string) => {
  const start = sql.indexOf(`create or replace function ${name}(`);
  if (start < 0) throw new Error(`${name} fehlt`);
  return sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start)));
};

describe('Live-Begleitung: Datenbank = Core', () => {
  it('Migrationen vorhanden, nur additiv', () => {
    expect(file).toBe('20261027170000_live_companion.sql');
    expect(exportFile.file).toBe('20261027170100_live_export_my_data.sql');
    for (const text of [sql, exportFile.sql]) {
      expect(text).not.toMatch(/drop table|alter column|rename |disable row|drop function/i);
    }
  });

  it('keine Kontakte-Tabelle auf dem Server (CLAUDE.md: Kontakte nur auf dem Gerät)', () => {
    expect(sql).not.toMatch(/create table [a-z_.]*contact/i);
    expect(sql).not.toMatch(/phone|e_?mail/i);
  });

  it('Token: 32 zufällige Bytes, nur SHA-256 gespeichert', () => {
    expect(L.tokenBytes).toBe(32);
    expect(sql).toContain(`extensions.gen_random_bytes(${L.tokenBytes})`);
    expect(sql).toContain(`octet_length(token_hash) = ${L.tokenBytes}`);
    expect(sql).toContain('pg_catalog.sha256(v_token)');
    expect(sql).not.toMatch(/token text|token_plain/);
  });

  it('Zeitgrenzen: 12 h, Ende + 2 h, Löschen 24 h nach Ablauf, Ratenbremse 1 h', () => {
    expect(sql).toContain(`expires_at <= started_at + interval '${L.sessionMaxH} hours'`);
    expect(sql).toContain(`now() + interval '${L.sessionMaxH} hours'`);
    expect(sql).toContain(
      `least(now() + interval '${L.linkGraceH} hours', started_at + interval '${L.sessionMaxH} hours')`,
    );
    expect(fn('private.purge_live_sessions')).toContain(
      `expires_at < now() - interval '${L.purgeAfterExpiryH} hours'`,
    );
    expect(fn('private.purge_live_sessions')).toContain(
      `created_at < now() - interval '${L.rateLimit.keepH} hour'`,
    );
  });

  it('Anzeigename, Dauer, Intervall, Genauigkeit, Koordinaten', () => {
    expect(sql).toContain(`char_length(display_name) between 1 and ${L.displayNameMax}`);
    expect(fn('public.start_live_session')).toContain(
      `char_length(v_name) not between 1 and ${L.displayNameMax}`,
    );
    expect(fn('public.start_live_session')).toContain(
      `p_planned_minutes not between ${L.plannedMinutes.min} and ${L.plannedMinutes.max}`,
    );
    const [minInterval, , maxInterval] = L.pushIntervalChoicesS;
    expect(sql).toContain(`update_interval_s between ${minInterval} and ${maxInterval}`);
    expect(fn('public.start_live_session')).toContain(
      `p_update_interval_s not between ${minInterval} and ${maxInterval}`,
    );
    expect(fn('public.start_live_session')).toContain(
      `p_update_interval_s integer default ${L.pushIntervalS}`,
    );
    expect(sql).toContain(`accuracy_m between 0 and ${L.accuracyMaxM}`);
    expect(fn('public.push_live_position')).toContain(`least(p_accuracy_m, ${L.accuracyMaxM})`);
    expect(sql).toContain(`numeric(8, ${L.coordDecimals})`);
    expect(fn('public.push_live_position')).toContain(`round(p_lat::numeric, ${L.coordDecimals})`);
    expect(fn('public.push_live_position')).toContain(
      `received_at > now() - interval '${L.serverMinGapS} seconds'`,
    );
  });

  it('Sportarten und Status = LIVE_SPORTS / LIVE_STATUSES', () => {
    const values = (re: RegExp) =>
      [...(re.exec(sql)?.[1] ?? '').matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
    expect(values(/check \(sport in \(([^)]+)\)\)/)).toEqual([...LIVE_SPORTS].sort());
    expect(values(/check \(status in \(([^)]+)\)\)/)).toEqual([...LIVE_STATUSES].sort());
  });

  it('Ergebnisse von push_live_position = LIVE_PUSH_RESULTS', () => {
    const results = [...fn('public.push_live_position').matchAll(/return '([a-z]+)'/g)]
      .map((m) => m[1])
      .sort();
    expect([...new Set(results)]).toEqual([...LIVE_PUSH_RESULTS].sort());
  });

  it('Ratenbremse der Lese-Funktion: je IP 10/min, je Sitzung 30/min; nur service_role', () => {
    const view = fn('public.get_live_view');
    expect(view).toContain(`if v_count > ${L.rateLimit.perIpPerMin} then`);
    expect(view).toContain(`if v_count > ${L.rateLimit.perSessionPerMin} then`);
    expect(sql).toContain(
      'grant execute on function public.get_live_view(text, text) to service_role;',
    );
    expect(sql).toContain(
      'revoke all on function public.get_live_view(text, text) from public, anon, authenticated;',
    );
  });

  it('Antwort der Lese-Funktion = liveViewSchema (Felder), abgeschlossen ohne Ort', () => {
    const view = fn('public.get_live_view');
    const keys = [
      ...view.matchAll(/'([a-z_]+)', (?:v_|now\(\)|case|'invalid'|'rate_limited')/g),
    ].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(10);
    const schemaKeys = new Set([
      ...liveViewSchema.options.flatMap((option) => Object.keys(option.shape)),
      ...Object.keys(livePositionSchema.shape),
    ]);
    for (const key of keys) expect(schemaKeys.has(key as string), key).toBe(true);
    const closedPart = view.slice(
      view.indexOf("if v_session.status in ('arrived', 'ended') then"),
      view.indexOf('select * into v_position'),
    );
    expect(closedPart).not.toMatch(/lat|lon|position/);
    // Keine Gesundheits- oder Leistungswerte.
    expect(view).not.toMatch(/heart|puls|kcal|pace|distance|weight|cycle/i);
  });

  it('Fehlermeldungen ohne Werte (keine Koordinaten in Logs)', () => {
    for (const match of sql.matchAll(/raise exception '([^']*)'/g)) {
      expect(match[1]).not.toContain('%');
    }
  });

  it('Export: live_sessions ohne token_hash, Obermenge der Integrations-Fassung', () => {
    expect(DATA_EXPORT_TABLES.at(-1)).toBe('live_sessions');
    const marker = 'create or replace function public.export_my_data()';
    const body = (text: string) =>
      text.slice(text.indexOf(marker), text.indexOf('$$;', text.indexOf(marker)));
    const older = body(read('_export_my_data_integration.sql').sql).split('\n');
    const newer = body(exportFile.sql).split('\n');
    const missing = older.filter((l) => !newer.includes(l) && !newer.includes(`${l},`));
    expect(missing).toEqual([]);
    const live = newer.find((l) => l.includes("'live_sessions', (select coalesce")) ?? '';
    expect(live).not.toContain('token_hash');
    expect(live).not.toContain('to_jsonb(s)');
  });
});
