/**
 * Übersetzt die Invarianten-Fixtures (`invariants.json`, docs/PLAN-PHASE-4B.md 5.8, Wächter B2) in den pgTAP-Test
 * `supabase/tests/50_week_invariants.test.sql` (Plan nannte 22 – die Nummern 20–47 sind belegt, daher die nächste freie
 * nach dem höchsten vorhandenen Test). Erwartet wird jeweils die VOLLE Liste der Verstöße, wie sie Core rechnet
 * (`checkWeekInvariants`) bzw. der Vergleich vorher/nachher (`newInvariantViolations`) – damit ist bewiesen, dass die
 * SQL-Nachrechnung (`private.week_invariant_violations`, `private.new_week_invariant_violations`) genau wie Core
 * entscheidet. `db-sync.test.ts` prüft, dass die Datei aktuell ist; neu schreiben:
 * `pnpm --filter @fitnessapp/content exec tsx ../core/src/adjust/fixtures/write-invariant-sql.ts`.
 */
import type { StoredSession } from '../../plan/view';
import {
  checkWeekInvariants,
  type InvariantViolation,
  newInvariantViolations,
  type WeekInvariantOptions,
} from '../invariants';
import type { FixtureSession, InvariantFixture } from './invariant-cases';

/** Paare vorher → nachher (gleicher Ausgangsplan) für newInvariantViolations. */
const NEW_VIOLATION_PAIRS: readonly (readonly [string, string])[] = [
  ['gueltig_fortgeschritten_montag_2_bloecke', 'verletzt_folgeblock_l_plus_1'],
  ['gueltig_fortgeschritten_montag_2_bloecke', 'verletzt_erholung_saetze'],
  ['gueltig_fortgeschritten_montag_2_bloecke', 'verletzt_erholung_rpe'],
  ['gueltig_einsteiger_woche0_2_bloecke', 'verletzt_erster_block_l_plus_1'],
  ['gueltig_kraft_und_ausdauer', 'verletzt_ausdauer_plus_20'],
  ['gueltig_kraft_und_ausdauer', 'verletzt_erholung_ausdauer_voll'],
  // Rückweg und gleicher Stand: nichts Neues.
  ['verletzt_erholung_saetze', 'gueltig_fortgeschritten_montag_2_bloecke'],
  ['verletzt_ausdauer_plus_20', 'verletzt_ausdauer_plus_20'],
  // Getauschte Woche über der Vorwoche bzw. zweiter Tausch (vorher: ein Tausch).
  ['verletzt_zweiter_tausch_im_block', 'verletzt_getauschte_woche_ueber_vorwoche'],
];

const toStored = (sessions: readonly FixtureSession[]) =>
  sessions as unknown as readonly StoredSession[];

/** Kanonisches JSON eines Werts (für den Vergleich in SQL ohnehin als jsonb sortiert). */
const json = (value: unknown) => JSON.stringify(value);

/** jsonb-Literal mit Dollar-Quoting (die Fixtures enthalten kein `$j$`). */
const lit = (value: unknown) => `$j$${json(value)}$j$::jsonb`;

const plain = (v: InvariantViolation) => JSON.parse(JSON.stringify(v)) as unknown;

/** Verschlimmerung: jede Erholungs-Übung des ersten Blocks einen Satz mehr (Überschreitung wächst). */
function worsened(f: InvariantFixture): FixtureSession[] {
  return f.sessions.map((s) =>
    s.block_no === 1 && s.is_deload
      ? { ...s, exercises: s.exercises.map((e) => ({ ...e, sets: Math.min(6, e.sets + 1) })) }
      : s,
  );
}

export function weekInvariantsTestSql(fixtures: readonly InvariantFixture[]): string {
  const byName = new Map(fixtures.map((f) => [f.name, f] as const));
  const get = (name: string) => {
    const f = byName.get(name);
    if (!f) throw new Error(`Fixture ${name} fehlt`);
    return f;
  };
  const lines: string[] = [];
  let count = 0;
  const test = (sql: string) => {
    lines.push(sql);
    count += 1;
  };

  // Jeder Fall einmal als Zeile (Einheiten, Optionen); die Tests verweisen per Name.
  const s = (name: string) => `(select f.sessions from pg_temp.fx f where f.name = '${name}')`;
  const o = (name: string) => `(select f.options from pg_temp.fx f where f.name = '${name}')`;
  for (const f of fixtures) {
    const options: WeekInvariantOptions = f.options;
    const expected = checkWeekInvariants(toStored(f.sessions), options).map(plain);
    test(
      `select is(pg_temp.sorted(private.week_invariant_violations(${s(f.name)}, ${o(f.name)})), ` +
        `pg_temp.sorted(${lit(expected)}), '${f.name}: Verstöße = Core');`,
    );
    test(
      `select is(pg_temp.codes(private.week_invariant_violations(${s(f.name)}, ${o(f.name)})), ` +
        `array[${f.expected.map((c) => `'${c}'`).join(', ')}]::text[], '${f.name}: Codes = expected');`,
    );
  }

  // fromMonday: nur Verstöße ab dieser Woche (Bezüge und Zähler laufen ab Planbeginn).
  for (const name of ['verletzt_folgeblock_l_plus_1', 'verletzt_ausdauer_plus_20']) {
    const f = get(name);
    const monday = f.sessions
      .filter((s) => s.block_no === 2)
      .map((s) => s.scheduled_on)
      .sort()[0];
    const options = { ...f.options, fromMonday: monday };
    const expected = checkWeekInvariants(toStored(f.sessions), options).map(plain);
    test(
      `select is(pg_temp.sorted(private.week_invariant_violations(${s(name)}, ${lit(options)})), ` +
        `pg_temp.sorted(${lit(expected)}), '${name} ab Block 2 (fromMonday): Verstöße = Core');`,
    );
  }

  // Woche 0 (Teilwoche zum Start) zählt nie als Belastungswoche (S-n1) – die Fixtures haben keine, daher hier eine
  // vorangestellte Einheit am Vortag der ersten Einheit (Block 1, Woche 0, Dosierung der ersten Einheit).
  for (const name of ['gueltig_einsteiger_woche0_2_bloecke', 'verletzt_erster_block_l_plus_1']) {
    const f = get(name);
    const first = [...f.sessions].sort((x, y) => x.scheduled_on.localeCompare(y.scheduled_on))[0];
    if (!first) throw new Error('leer');
    const day = new Date(`${first.scheduled_on}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() - 1);
    const zero = {
      ...first,
      week_no: 0,
      is_intro_week: false,
      scheduled_on: day.toISOString().slice(0, 10),
    };
    const sessions = [zero, ...f.sessions];
    const expected = checkWeekInvariants(toStored(sessions), f.options).map(plain);
    test(
      `select is(pg_temp.sorted(private.week_invariant_violations(${lit(sessions)}, ${o(name)})), ` +
        `pg_temp.sorted(${lit(expected)}), '${name} mit Woche 0: Verstöße = Core (Woche 0 zählt nicht)');`,
    );
  }

  const pairs: [string, InvariantFixture, InvariantFixture, readonly FixtureSession[], string][] =
    NEW_VIOLATION_PAIRS.map(([a, b]) => [`${a} → ${b}`, get(a), get(b), get(b).sessions, s(b)]);
  for (const name of ['verletzt_erholung_saetze', 'verletzt_erholung_ausdauer_voll']) {
    const w = worsened(get(name));
    pairs.push([`${name} → verschlimmert`, get(name), get(name), w, lit(w)]);
  }
  for (const [label, before, after, afterSessions, afterSql] of pairs) {
    const expected = newInvariantViolations(
      toStored(before.sessions),
      toStored(afterSessions),
      after.options,
      before.options,
    ).map(plain);
    test(
      `select is(pg_temp.sorted(private.new_week_invariant_violations(${s(before.name)}, ` +
        `${afterSql}, ${o(after.name)}, ${o(before.name)})), pg_temp.sorted(${lit(expected)}), ` +
        `'neu ${label}: = newInvariantViolations');`,
    );
  }

  return [
    '-- GENERIERT aus packages/core/src/adjust/fixtures/invariants.json von',
    '-- packages/core/src/adjust/fixtures/invariants-sql.ts – nicht von Hand ändern (db-sync.test.ts prüft die Aktualität).',
    '-- Phase 4b Etappe B (docs/PLAN-PHASE-4B.md 5.8, Wächter B2): Die SQL-Nachrechnung der Wochen-Invarianten',
    '-- entscheidet für jeden Fixture-Fall genau wie Core (volle Verstoß-Liste, Codes, fromMonday, Vergleich',
    '-- vorher/nachher). Datei-Nummer 50 statt 22 (20–47 belegt).',
    'begin;',
    'create extension if not exists pgtap with schema extensions;',
    `select plan(${count});`,
    '',
    'create function pg_temp.sorted(p jsonb) returns jsonb language sql as $$',
    "  select coalesce(jsonb_agg(v order by v::text), '[]'::jsonb) from jsonb_array_elements(p) v",
    '$$;',
    'create function pg_temp.codes(p jsonb) returns text[] language sql as $$',
    "  select coalesce(array_agg(distinct v ->> 'code' order by v ->> 'code'), '{}') from jsonb_array_elements(p) v",
    '$$;',
    'create temp table fx (name text primary key, sessions jsonb not null, options jsonb not null);',
    ...fixtures.map(
      (f) => `insert into pg_temp.fx values ('${f.name}', ${lit(f.sessions)}, ${lit(f.options)});`,
    ),
    '',
    ...lines,
    '',
    'select * from finish();',
    'rollback;',
    '',
  ].join('\n');
}
