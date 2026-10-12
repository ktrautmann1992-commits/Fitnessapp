/**
 * W18 (docs/PLAN-PHASE-5.md 12.2): Herkunftsprüfung `sources-integrity` – jede Manipulation am Quellauszug,
 * an SOURCE.json, an der Adresse oder an der Commit-Herkunft wird rot; der unveränderte Workflow-Auszug ist grün.
 */
import { describe, expect, it } from 'vitest';

import { checkSourcesIntegrity, formatIntegrityResult, type IntegrityDeps } from './integrity';
import {
  attributionMarkdown,
  extractSourceRows,
  readOriginalRecords,
  sha256Hex,
  type SourceManifest,
} from './extract-source';
import type { SourceDefinition } from './sources';
import { fetchSourceOriginal } from './download';
import {
  downloadPageHtml,
  fakeSite,
  type FakeRoute,
  TEST_PAGE_SOURCE,
  TEST_SOURCE,
  testOriginal,
} from './test-helpers';

const DIR = 'content/sources/bls/4.0';
const ORIGINAL = testOriginal();
const BOT_SHA = 'a'.repeat(40);
const FAKE_SHA = 'f'.repeat(40);

interface Scenario {
  files: Map<string, Buffer>;
  /** Was unter der Allowlist-Adresse von main liegt. */
  served: Map<string, Buffer>;
  mainSources: readonly SourceDefinition[] | null;
  changed: string[] | null;
  commits: string[];
  verified: Set<string>;
  branch: string | null;
  downloads: string[];
  fork: boolean;
  links: string[];
  /** Lauf-IDs, die echte foods-import-Läufe auf main sind. */
  importRuns: Set<string>;
}

/** Stand so, wie ihn der Workflow foods-import erzeugt. */
function workflowScenario(): Scenario {
  const extract = extractSourceRows(readOriginalRecords(ORIGINAL, TEST_SOURCE), TEST_SOURCE, [
    'C133000',
    'F110100',
  ]);
  const manifest: SourceManifest = {
    db: 'bls',
    version: '4.0',
    title: TEST_SOURCE.title,
    url: TEST_SOURCE.url,
    original_filename: TEST_SOURCE.originalFilename,
    original_bytes: ORIGINAL.length,
    original_sha256: sha256Hex(ORIGINAL),
    extract_sha256: sha256Hex(extract.csv),
    extract_rows: 2,
    retrieved_at: '2026-10-11T10:00:00Z',
    workflow_run_id: '4711',
    license: TEST_SOURCE.license,
    license_url: TEST_SOURCE.licenseUrl,
    attribution: TEST_SOURCE.attribution,
  };
  return {
    files: new Map([
      [`${DIR}/extract.csv`, Buffer.from(extract.csv)],
      [`${DIR}/SOURCE.json`, Buffer.from(JSON.stringify(manifest, null, 2))],
      [`${DIR}/ATTRIBUTION.md`, Buffer.from(attributionMarkdown(TEST_SOURCE))],
    ]),
    served: new Map([[TEST_SOURCE.url, ORIGINAL]]),
    mainSources: [TEST_SOURCE],
    changed: [`${DIR}/extract.csv`, `${DIR}/SOURCE.json`, `${DIR}/ATTRIBUTION.md`],
    commits: [BOT_SHA],
    verified: new Set([BOT_SHA]),
    branch: 'foods-import/4711',
    downloads: [],
    fork: false,
    links: [],
    importRuns: new Set(['4711']),
  };
}

function deps(s: Scenario): IntegrityDeps {
  return {
    symlinks: () => s.links,
    branch: s.branch,
    headIsFork: s.fork,
    importRunProvenance: (runId) =>
      Promise.resolve(
        s.importRuns.has(runId)
          ? { ok: true, reason: 'foods-import.yml auf main' }
          : { ok: false, reason: 'Workflow „.github/workflows/anderer.yml“' },
      ),
    loadMainSources: () => Promise.resolve(s.mainSources),
    download: (def) => {
      s.downloads.push(def.url);
      const body = s.served.get(def.url);
      return body === undefined ? Promise.reject(new Error('HTTP 404')) : Promise.resolve(body);
    },
    listSourceDirs: () =>
      [...new Set([...s.files.keys()].map((p) => p.split('/').slice(0, 4).join('/')))].filter((d) =>
        d.startsWith('content/sources/'),
      ),
    listFiles: (dir) =>
      [...s.files.keys()]
        .filter((p) => p.startsWith(`${dir}/`))
        .map((p) => p.slice(dir.length + 1)),
    readFile: (path) => s.files.get(path),
    changedPaths: () => s.changed,
    commitsTouching: () => s.commits,
    commitProvenance: (sha) =>
      Promise.resolve(
        s.verified.has(sha)
          ? { ok: true, reason: 'verified' }
          : { ok: false, reason: 'nicht „verified“ (unsigned)' },
      ),
  };
}

function manifestOf(s: Scenario): SourceManifest {
  return JSON.parse(s.files.get(`${DIR}/SOURCE.json`)?.toString('utf8') ?? '{}') as SourceManifest;
}

function setManifest(s: Scenario, change: Partial<SourceManifest>): void {
  s.files.set(`${DIR}/SOURCE.json`, Buffer.from(JSON.stringify({ ...manifestOf(s), ...change })));
}

async function run(s: Scenario) {
  return checkSourcesIntegrity(deps(s));
}

describe('W18 – sources-integrity', () => {
  it('unveränderter Workflow-Auszug (verifizierter Bot-Commit) → grün', async () => {
    const s = workflowScenario();
    const result = await run(s);
    expect(result.errors).toEqual([]);
    expect(result.fullCheck).toBe(true);
    expect(s.downloads).toEqual([TEST_SOURCE.url]);
    expect(formatIntegrityResult(result)).toContain('✅');
  });

  it('extract.csv verändert, Prüfsumme in SOURCE.json passt nicht → rot', async () => {
    const s = workflowScenario();
    const text = s.files.get(`${DIR}/extract.csv`)?.toString('utf8') ?? '';
    s.files.set(`${DIR}/extract.csv`, Buffer.from(text.replace(',370,', ',350,')));
    const result = await run(s);
    expect(result.errors.join('\n')).toMatch(/SHA-256 von extract.csv passt nicht/);
  });

  it('Prüfsumme mit angepasst, aber Zeile nicht in der Original-Datei (geänderter Wert) → rot', async () => {
    const s = workflowScenario();
    const text = (s.files.get(`${DIR}/extract.csv`)?.toString('utf8') ?? '').replace(
      ',370,',
      ',350,',
    );
    s.files.set(`${DIR}/extract.csv`, Buffer.from(text));
    setManifest(s, { extract_sha256: sha256Hex(text) });
    const result = await run(s);
    expect(result.errors.join('\n')).toMatch(/Quell-ID „C133000“\) ist keine unveränderte Zeile/);
    expect(result.errors.join('\n')).not.toMatch(/SHA-256 von extract.csv/);
  });

  it('erfundene Zeile mit passender Prüfsumme und Zeilenzahl → rot', async () => {
    const s = workflowScenario();
    const text = `${s.files.get(`${DIR}/extract.csv`)?.toString('utf8') ?? ''}Z000001,Proteinpulver,,400,A,80,5,2,5,1,0,100\n`;
    s.files.set(`${DIR}/extract.csv`, Buffer.from(text));
    setManifest(s, { extract_sha256: sha256Hex(text), extract_rows: 3 });
    const result = await run(s);
    expect(result.errors.join('\n')).toMatch(/Z000001.*keine unveränderte Zeile/);
  });

  it('Änderung unter content/sources/** in einem PR außerhalb foods-import/<run-id> → rot', async () => {
    const s = workflowScenario();
    s.branch = 'claude/neue-werte';
    const result = await run(s);
    expect(result.errors.join('\n')).toMatch(/nur über den Workflow foods-import/);
  });

  it('Branch foods-import/x mit gefälschtem Bot-Autor (nicht „verified“) → rot', async () => {
    const s = workflowScenario();
    s.branch = 'foods-import/4711';
    s.commits = [BOT_SHA, FAKE_SHA];
    const result = await run(s);
    expect(result.errors.join('\n')).toMatch(
      new RegExp(`Commit ${FAKE_SHA.slice(0, 12)} .*kein verifizierter Commit`),
    );
  });

  it('Fork-PR ändert content/sources (auch mit „verified“ Bot-Commits aus dem Fork) → rot (Wächter N2b, S1)', async () => {
    const s = workflowScenario();
    s.fork = true;
    const result = await run(s);
    expect(result.errors.join('\n')).toMatch(/Pull Request aus einem Fork/);
  });

  it('Branch foods-import/<id>, aber die Lauf-ID ist kein foods-import-Lauf auf main → rot', async () => {
    const s = workflowScenario();
    s.branch = 'foods-import/999';
    const result = await run(s);
    expect(result.errors.join('\n')).toMatch(/Lauf 999 .*kein Lauf von foods-import.yml/);
  });

  it('Branch-Name ohne Lauf-ID (foods-import/x) → rot', async () => {
    const s = workflowScenario();
    s.branch = 'foods-import/x';
    const result = await run(s);
    expect(result.errors.join('\n')).toMatch(/foods-import\/<Lauf-ID>/);
  });

  it('Lebensmittel (content/foods/**) per Hand geändert → rot (einzige Schreibstelle foods-import)', async () => {
    const s = workflowScenario();
    s.changed = ['content/foods/haferflocken.json'];
    s.branch = 'claude/korrektur';
    s.commits = [FAKE_SHA];
    const result = await run(s);
    expect(result.errors.join('\n')).toMatch(/kein verifizierter Commit von github-actions\[bot\]/);
  });

  it('URL in SOURCE.json geändert (nicht in der Allowlist von main) → rot', async () => {
    const s = workflowScenario();
    const evil = 'https://example.com/eigene-datei.xlsx';
    s.served.set(evil, ORIGINAL);
    setManifest(s, { url: evil });
    const result = await run(s);
    expect(result.errors.join('\n')).toMatch(/URL in SOURCE.json .* ≠ Allowlist von main/);
    // Geladen wird trotzdem nur von der Allowlist-Adresse aus main.
    expect(s.downloads).toEqual([TEST_SOURCE.url]);
  });

  it('URL in SOURCE.json UND sources.ts im PR geändert → rot (Allowlist kommt von main)', async () => {
    const s = workflowScenario();
    const evil = 'https://example.com/eigene-datei.xlsx';
    const fakeOriginal = testOriginal([['Z1', 'Erfunden', '', 1, '', 1, 1, 1, 1, 1, 1, 1]]);
    s.served.set(evil, fakeOriginal);
    setManifest(s, { url: evil, original_sha256: sha256Hex(fakeOriginal) });
    s.changed = [...(s.changed ?? []), 'packages/content/src/foods/sources.ts'];
    const result = await run(s);
    const errors = result.errors.join('\n');
    expect(errors).toMatch(/≠ Allowlist von main/);
    expect(errors).toMatch(/Neu geladene Original-Datei hat SHA-256/);
    expect(result.notes.join('\n')).toMatch(/sources-integrity-main/);
  });

  it('Original-Datei und original_sha256 im selben PR gemeinsam geändert → rot (Neuladen von main-URL)', async () => {
    const s = workflowScenario();
    const forged = testOriginal([['Z1', 'Erfunden', '', 1, '', 1, 1, 1, 1, 1, 1, 1]]);
    s.files.set(`${DIR}/original.xlsx`, forged);
    setManifest(s, { original_sha256: sha256Hex(forged) });
    const result = await run(s);
    expect(result.errors.join('\n')).toMatch(/Neu geladene Original-Datei hat SHA-256/);
  });

  it('eingecheckte Original-Datei weicht vom Neudownload ab → rot', async () => {
    const s = workflowScenario();
    s.files.set(
      `${DIR}/original.xlsx`,
      testOriginal([['Z1', 'X', '', 1, '', 1, 1, 1, 1, 1, 1, 1]]),
    );
    const result = await run(s);
    expect(result.errors.join('\n')).toMatch(/Eingecheckte „original.xlsx“ weicht/);
  });

  it('Quelle nicht in der Allowlist von main bzw. Allowlist fehlt → rot', async () => {
    const s = workflowScenario();
    s.mainSources = [];
    expect((await run(s)).errors.join('\n')).toMatch(/nicht in der Allowlist von main/);
    const t = workflowScenario();
    t.mainSources = null;
    expect((await run(t)).errors.join('\n')).toMatch(/Allowlist .* fehlt auf main/);
  });

  it('festgenagelte Prüfsumme in sources.ts (main) weicht ab → rot', async () => {
    const s = workflowScenario();
    s.mainSources = [{ ...TEST_SOURCE, originalSha256: 'c'.repeat(64) }];
    expect((await run(s)).errors.join('\n')).toMatch(/festgenagelte Prüfsumme/);
  });

  it('Original-Datei nicht erreichbar (z. B. wöchentlicher Lauf) → rot', async () => {
    const s = workflowScenario();
    s.served.clear();
    s.changed = null;
    const result = await run(s);
    expect(result.errors.join('\n')).toMatch(/Original-Datei nicht geladen: HTTP 404/);
  });

  it('Kopfzeile, kanonische Form, Zeilenzahl, fehlende Dateien, fremde Dateien → rot', async () => {
    const header = workflowScenario();
    const lines = (header.files.get(`${DIR}/extract.csv`)?.toString('utf8') ?? '').split('\n');
    const text = [`${lines[0]},EXTRA`, ...lines.slice(1)].join('\n');
    header.files.set(`${DIR}/extract.csv`, Buffer.from(text));
    setManifest(header, { extract_sha256: sha256Hex(text) });
    expect((await run(header)).errors.join('\n')).toMatch(/Kopfzeile von extract.csv/);

    const crlf = workflowScenario();
    const crlfText = (crlf.files.get(`${DIR}/extract.csv`)?.toString('utf8') ?? '').replace(
      /\n/g,
      '\r\n',
    );
    crlf.files.set(`${DIR}/extract.csv`, Buffer.from(crlfText));
    setManifest(crlf, { extract_sha256: sha256Hex(crlfText) });
    expect((await run(crlf)).errors.join('\n')).toMatch(/kanonischen Form/);

    const count = workflowScenario();
    setManifest(count, { extract_rows: 5 });
    expect((await run(count)).errors.join('\n')).toMatch(/2 Datenzeilen, SOURCE.json nennt 5/);

    const missing = workflowScenario();
    missing.files.delete(`${DIR}/ATTRIBUTION.md`);
    missing.files.set(`${DIR}/notizen.txt`, Buffer.from('x'));
    const errors = (await run(missing)).errors.join('\n');
    expect(errors).toMatch(/ATTRIBUTION.md/);
    expect(errors).toMatch(/unerwartete Datei „notizen.txt“/);

    const noManifest = workflowScenario();
    noManifest.files.delete(`${DIR}/SOURCE.json`);
    expect((await run(noManifest)).errors.join('\n')).toMatch(/SOURCE.json fehlt/);

    const badManifest = workflowScenario();
    badManifest.files.set(`${DIR}/SOURCE.json`, Buffer.from('{"db":"bls"}'));
    expect((await run(badManifest)).errors.join('\n')).toMatch(/SOURCE.json ungültig/);
  });

  it('symbolischer Link unter content/sources, content/foods oder content/food-mapping → rot (GK2)', async () => {
    const s = workflowScenario();
    s.links = ['content/foods/apfel.json'];
    expect((await run(s)).errors.join('\n')).toMatch(
      /Symbolischer Link „content\/foods\/apfel.json“/,
    );
    const t = workflowScenario();
    t.changed = ['apps/mobile/src/app/index.tsx'];
    t.links = ['content/food-mapping/x.json'];
    expect((await run(t)).errors).toHaveLength(1);
  });

  it('PR ohne Quellen-/Lebensmittel-Änderung → kein Neuladen, grün', async () => {
    const s = workflowScenario();
    s.changed = ['apps/mobile/src/app/index.tsx'];
    const result = await run(s);
    expect(result.errors).toEqual([]);
    expect(result.fullCheck).toBe(false);
    expect(s.downloads).toEqual([]);
  });

  it('wöchentlicher Lauf/main (kein Vergleichsstand) → volle Prüfung ohne Commit-Prüfung', async () => {
    const s = workflowScenario();
    s.changed = null;
    s.branch = 'main';
    s.verified.clear();
    const result = await run(s);
    expect(result.errors).toEqual([]);
    expect(s.downloads).toHaveLength(1);
  });

  it('noch keine Quellauszüge → grün mit Hinweis', async () => {
    const s = workflowScenario();
    s.files.clear();
    s.changed = ['packages/content/src/foods/sources.ts'];
    const result = await run(s);
    expect(result.errors).toEqual([]);
    expect(result.notes.join('\n')).toMatch(/Noch keine Quellauszüge/);
  });
});

/**
 * Quelle über eine Download-Seite mit wechselndem Link (blsdb.de, Umsetzungsstand N2b): Die Echtheit sichert die
 * Prüfsumme – Neuladen über dieselbe Seiten-Logik wie foods-import (`fetchSourceOriginal`).
 */
describe('W18 – sources-integrity mit Download-Seite (Link mit wechselndem Code)', () => {
  const PAGE = TEST_PAGE_SOURCE.url;
  const FILE = 'https://daten.example.org/download?token=*';

  function pageScenario(routes: Record<string, FakeRoute>) {
    const s = workflowScenario();
    s.mainSources = [TEST_PAGE_SOURCE];
    setManifest(s, { url: PAGE });
    const site = fakeSite(routes);
    const d: IntegrityDeps = {
      ...deps(s),
      download: async (def) => {
        s.downloads.push(def.url);
        return (await fetchSourceOriginal(def, site.fetch, { retryDelaysMs: [] })).data;
      },
    };
    return { s, site, run: () => checkSourcesIntegrity(d) };
  }

  const goodRoutes = (): Record<string, FakeRoute> => ({
    [PAGE]: { body: downloadPageHtml(['/download?token=NEU1-2345']) },
    [FILE]: { body: ORIGINAL },
  });

  it('neuer Code, gleiche Datei → grün (Seite + Link neu gelesen)', async () => {
    const { s, site, run } = pageScenario(goodRoutes());
    const result = await run();
    expect(result.errors).toEqual([]);
    expect(s.downloads).toEqual([PAGE]);
    expect(site.requests.map((r) => r.url)).toEqual([
      PAGE,
      'https://daten.example.org/download?token=NEU1-2345',
    ]);
  });

  it('Seiten-Adresse in SOURCE.json geändert → rot', async () => {
    const { s, run } = pageScenario(goodRoutes());
    setManifest(s, { url: 'https://daten.example.org/andere-seite' });
    expect((await run()).errors.join('\n')).toMatch(/URL in SOURCE.json .* ≠ Allowlist von main/);
  });

  it('Seite liefert eine abweichende Datei (andere Prüfsumme) → rot', async () => {
    const forged = testOriginal([['Z1', 'Erfunden', '', 1, '', 1, 1, 1, 1, 1, 1, 1]]);
    const { run } = pageScenario({ ...goodRoutes(), [FILE]: { body: forged } });
    expect((await run()).errors.join('\n')).toMatch(
      new RegExp(`Neu geladene Original-Datei hat SHA-256 ${sha256Hex(forged)}`),
    );
  });

  it('Download-Link zeigt auf einen fremden Host → rot (nie geladen)', async () => {
    const { site, run } = pageScenario({
      [PAGE]: { body: downloadPageHtml(['https://boese.example.com/download?token=XXXX-1234']) },
      'https://boese.example.com/download?token=*': { body: ORIGINAL },
    });
    const errors = (await run()).errors.join('\n');
    expect(errors).toMatch(/Original-Datei nicht geladen: Kein Download-Link/);
    expect(site.requests.map((r) => r.url)).toEqual([PAGE]);
  });

  it('Bot-Sperre statt Seite → rot mit klarer Meldung', async () => {
    const { run } = pageScenario({
      [PAGE]: {
        body: '<html><title>Bitte warten</title></html>',
        redirectTo: 'https://daten.example.org/pow-challenge?redirect_url=%2Fdownload',
      },
    });
    expect((await run()).errors.join('\n')).toMatch(/Bot-Sperre .*NICHT umgangen/);
  });

  it('festgenagelte Prüfsumme (Gründer-PR nach erstem Import) passt → grün, weicht ab → rot', async () => {
    const pinned = pageScenario(goodRoutes());
    pinned.s.mainSources = [{ ...TEST_PAGE_SOURCE, originalSha256: sha256Hex(ORIGINAL) }];
    expect((await pinned.run()).errors).toEqual([]);
    const wrong = pageScenario(goodRoutes());
    wrong.s.mainSources = [{ ...TEST_PAGE_SOURCE, originalSha256: 'c'.repeat(64) }];
    expect((await wrong.run()).errors.join('\n')).toMatch(/festgenagelte Prüfsumme/);
  });
});
