/**
 * Ende-zu-Ende ohne Netz und ohne Schlüssel: generate → collect im temporären git-Repository mit lokalem
 * „origin“; gh und die Typprüfung sind gefälscht, die Anthropic-API ist ein Mock.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { batchRecordSchema } from './batch-record';
import { runCollect } from './collect';
import type { PipelineSettings } from './config';
import { runGenerate } from './generate';
import { exerciseKind } from './kinds/exercise';
import { runReview } from './review';
import {
  createTempRepo,
  fakeTools,
  mockClient,
  recordingTools,
  succeeded,
  type TempRepo,
} from './test-helpers';

const settings: PipelineSettings = { model: 'claude-opus-5-5', effort: 'high', maxUsd: 15 };
const now = () => new Date('2026-10-03T10:00:00Z');
const repos: TempRepo[] = [];
function repo(): TempRepo {
  const created = createTempRepo();
  repos.push(created);
  return created;
}
afterEach(() => {
  while (repos.length > 0) {
    repos.pop()!.cleanup();
  }
});

/** Workflows öffnen Pull Requests, genehmigen oder mergen aber nie. */
function neverApproves(calls: readonly string[][]): boolean {
  return calls.every(
    (call) =>
      !(call[0] === 'pr' && ['review', 'merge'].includes(call[1] ?? '')) &&
      !call.includes('--approve'),
  );
}

function remoteBranches(r: TempRepo): string[] {
  return r
    .git(['ls-remote', '--heads', 'origin'])
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t')[1]!.replace('refs/heads/', ''));
}

describe('content-generate', () => {
  it('bricht über dem Kostendeckel ab, BEVOR etwas gesendet wird', async () => {
    const r = repo();
    const tools = fakeTools(r.root);
    const client = mockClient({ inputTokensPerRequest: 200_000 });
    const result = await runGenerate(
      { kind: 'plan-templates', selection: 'alle', count: 48, dryRun: false, settings },
      { repoRoot: r.root, tools, client, now },
    );
    expect(result.status).toBe('cap_exceeded');
    expect(result.markdown).toContain('nichts');
    expect(client.calls.countTokens).toBe(48);
    expect(client.calls.create).toBe(0);
    expect(remoteBranches(r)).toEqual(['main']);
  });

  it('höchstens 200 Anfragen pro Lauf', async () => {
    const r = repo();
    await expect(
      runGenerate(
        { kind: 'exercises', selection: 'alle', count: 201, dryRun: false, settings },
        { repoRoot: r.root, tools: recordingTools(), client: mockClient(), now },
      ),
    ).rejects.toThrow(/1 bis 200/);
  });

  it('ohne Schlüssel nur Probelauf', async () => {
    const r = repo();
    await expect(
      runGenerate(
        { kind: 'exercises', selection: 'alle', count: 5, dryRun: false, settings },
        { repoRoot: r.root, tools: recordingTools(), now },
      ),
    ).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });

  it('nichts zu tun, wenn alle ausgewählten Vorlagen existieren', async () => {
    const r = repo();
    const client = mockClient();
    const result = await runGenerate(
      { kind: 'plan-templates', selection: '45-60', count: 10, dryRun: false, settings },
      { repoRoot: r.root, tools: fakeTools(r.root), client, now },
    );
    expect(result.status).toBe('nothing');
    expect(client.calls.countTokens).toBe(0);
  });

  it('sendet einen Batch, legt Branch + Merkdatei an und endet', async () => {
    const r = repo();
    const client = mockClient({ inputTokensPerRequest: 8000, batchId: 'msgbatch_01XyZ9abcDEF' });
    const result = await runGenerate(
      {
        kind: 'plan-templates',
        selection: 'muskelaufbau 30-45',
        count: 3,
        dryRun: false,
        settings,
      },
      { repoRoot: r.root, tools: fakeTools(r.root), client, now },
    );
    expect(result.status).toBe('submitted');
    if (result.status !== 'submitted') return;
    expect(client.calls.create).toBe(1);
    expect(client.created[0]!.requests.map((q) => q.custom_id)).toEqual([
      'tpl-muscle_gain-beginner-3-gym-30-45',
      'tpl-muscle_gain-beginner-3-home-30-45',
      'tpl-muscle_gain-beginner-4-gym-30-45',
    ]);
    expect(result.branch).toBe('content/batch-2026-10-03-abcdef');
    expect(remoteBranches(r)).toContain(result.branch);
    const record = batchRecordSchema.parse(
      JSON.parse(r.showRemote(result.branch, 'content/batches/2026-10-03-abcdef.json')),
    );
    expect(record).toMatchObject({
      status: 'submitted',
      dry_run: false,
      batch_id: 'msgbatch_01XyZ9abcDEF',
      kind: 'plan_template',
      model: 'claude-opus-5-5',
      effort: 'high',
      count: 3,
      estimate: { input_tokens: 24_000, max_tokens_per_request: 24_000, max_usd: 15 },
    });
    expect(record.estimate.worst_case_usd).toBeCloseTo(0.77, 2);
    expect(record.requests[0]?.target_id).toBe('muskelaufbau-einsteiger-3t-studio-30-45min');
  });
});

describe('Probelauf Ende-zu-Ende: generate → collect (ohne Netz, ohne Schlüssel)', () => {
  it('Übungen: Pull Request mit zwei Entwürfen, ungültige und abgelehnte Antwort nur im Bericht', async () => {
    const r = repo();
    const tools = fakeTools(r.root);
    const generated = await runGenerate(
      { kind: 'exercises', selection: 'alle', count: 10, dryRun: true, settings },
      { repoRoot: r.root, tools, now, randomShort: () => 'a1b2c3' },
    );
    expect(generated.status).toBe('submitted');
    if (generated.status !== 'submitted') return;
    expect(generated.record.dry_run).toBe(true);
    expect(generated.branch).toBe('content/batch-2026-10-03-a1b2c3');
    expect(tools.ghCalls).toEqual([]); // generate öffnet keinen Pull Request

    // Ein anderer Lauf (z. B. per Zeitplan) startet auf main – ohne Schlüssel.
    r.git(['checkout', '--quiet', 'main']);
    const collected = await runCollect({ repoRoot: r.root, tools, now });
    expect(collected.exitCode).toBe(0);
    expect(collected.outcomes.map((o) => o.status)).toEqual(['pr_opened']);
    const outcome = collected.outcomes[0]!;
    // Ergebnisse kamen in umgekehrter Reihenfolge – die Zuordnung stimmt trotzdem (custom_id).
    expect(outcome.saved).toEqual(['probelauf-seitstuetz', 'probelauf-wandsitzen']);

    const branch = generated.branch;
    const draft = JSON.parse(r.showRemote(branch, 'content/exercises/probelauf-wandsitzen.json'));
    expect(draft.status).toBe('draft');
    expect(draft.meta.origin).toBe('batch');
    expect(draft.meta.expert_reviewed).toBe(false);
    expect(() => r.showRemote(branch, 'content/exercises/probelauf-ungueltig.json')).toThrow();
    const record = batchRecordSchema.parse(
      JSON.parse(r.showRemote(branch, 'content/batches/2026-10-03-a1b2c3.json')),
    );
    expect(record.status).toBe('collected');
    expect(record.collected?.saved).toEqual(['probelauf-seitstuetz', 'probelauf-wandsitzen']);
    expect(record.collected?.not_saved).toBe(2);

    // gh: Pull Request gegen main, danach ci ausdrücklich starten. Nie genehmigen.
    const create = tools.ghCalls.find((call) => call[0] === 'pr' && call[1] === 'create')!;
    expect(create).toEqual(expect.arrayContaining(['--base', 'main', '--head', branch]));
    expect(create[create.indexOf('--title') + 1]).toMatch(/^Probelauf: .*nicht mergen/);
    expect(tools.ghCalls).toContainEqual(['workflow', 'run', 'ci.yml', '--ref', branch]);
    expect(neverApproves(tools.ghCalls)).toBe(true);
    expect(tools.typecheckCalls).toBe(1);
    expect(outcome.markdown).toContain('ungültig (Schema/Grenzen)');
    expect(outcome.markdown).toContain('abgelehnt (refusal)');
    expect(outcome.markdown).toContain('Probelauf: keine KI, keine Kosten.');
    expect(tools.prBodies[0]).toContain('So testest du es am Handy');
    expect(tools.prBodies[0]).toContain('Bitte NICHT mergen');
    expect(tools.prBodies[0]).toContain('content:validate: ✅');

    // Zweiter Lauf: nichts mehr offen.
    const again = await runCollect({ repoRoot: r.root, tools, now });
    expect(again.outcomes.map((o) => o.status)).toEqual(['already_collected']);
  });

  it('Plan-Vorlagen: Probelauf bis zum Pull Request', async () => {
    const r = repo();
    const tools = fakeTools(r.root);
    await runGenerate(
      { kind: 'plan-templates', selection: 'alle', count: 10, dryRun: true, settings },
      { repoRoot: r.root, tools, now, randomShort: () => 'tpl001' },
    );
    const collected = await runCollect({ repoRoot: r.root, tools, now });
    expect(collected.exitCode).toBe(0);
    expect(collected.outcomes[0]?.saved).toEqual(['fitness-einsteiger-3t-zuhause-30-45min']);
    expect(collected.outcomes[0]?.markdown).toContain('Fehler bei der API – erneut versuchen');
  });

  it('überschreibt keinen Inhalt, der nach dem Absenden in main dazugekommen ist', async () => {
    const r = repo();
    const tools = fakeTools(r.root);
    await runGenerate(
      { kind: 'exercises', selection: 'alle', count: 1, dryRun: true, settings },
      { repoRoot: r.root, tools, now, randomShort: () => 'late01' },
    );
    r.git(['checkout', '--quiet', '-B', 'main', 'origin/main']);
    const source = join(r.root, 'content/exercises/kniebeuge-koerpergewicht.json');
    const copy = JSON.parse(readFileSync(source, 'utf8'));
    copy.id = 'probelauf-wandsitzen';
    writeFileSync(
      join(r.root, 'content/exercises/probelauf-wandsitzen.json'),
      `${JSON.stringify(copy, null, 2)}\n`,
    );
    r.git(['add', '-A']);
    r.git(['commit', '--quiet', '-m', 'Neue Übung in main']);
    r.git(['push', '--quiet', 'origin', 'main']);
    const result = await runCollect({ repoRoot: r.root, tools, now });
    expect(result.outcomes[0]?.saved).toEqual(['probelauf-seitstuetz']);
    expect(result.outcomes[0]?.markdown).toContain('ID existiert bereits');
  });

  it('ohne offenen Batch-Branch endet collect sofort (kein Schlüssel nötig)', async () => {
    const r = repo();
    const tools = fakeTools(r.root);
    const result = await runCollect({ repoRoot: r.root, tools, now });
    expect(result.exitCode).toBe(0);
    expect(result.outcomes).toEqual([]);
    expect(result.markdown).toContain('keine offenen Batch-Läufe');
  });

  it('kein Pull Request, wenn die Prüfung rot ist (z. B. Typprüfung)', async () => {
    const r = repo();
    const tools = fakeTools(r.root, { typecheckError: 'TS2322' });
    await runGenerate(
      { kind: 'exercises', selection: 'alle', count: 1, dryRun: true, settings },
      { repoRoot: r.root, tools, now, randomShort: () => 'bad001' },
    );
    const result = await runCollect({ repoRoot: r.root, tools, now });
    expect(result.exitCode).toBe(1);
    expect(result.outcomes[0]?.status).toBe('blocked');
    expect(tools.ghCalls).toEqual([]);
    // Branch unverändert: Merkdatei bleibt „submitted“, keine Entwürfe hochgeladen.
    const record = JSON.parse(
      r.showRemote('content/batch-2026-10-03-bad001', 'content/batches/2026-10-03-bad001.json'),
    );
    expect(record.status).toBe('submitted');
  });

  it('kein Pull Request, wenn ein freigegebener Inhalt in main einen roten Fehler hat', async () => {
    const r = repo();
    // Freigegebene Vorlage mit Übungen im Entwurf → V3 rot an freigegebenem Inhalt.
    const path = join(r.root, 'content/plan-templates/fitness-einsteiger-3t-zuhause.json');
    const template = JSON.parse(readFileSync(path, 'utf8'));
    template.status = 'published';
    template.meta.reviewed_by = 'KT';
    template.meta.reviewed_at = '2026-10-03';
    writeFileSync(path, `${JSON.stringify(template, null, 2)}\n`);
    r.git(['commit', '--quiet', '-am', 'kaputt']);
    r.git(['push', '--quiet', 'origin', 'main']);
    const tools = fakeTools(r.root);
    await runGenerate(
      { kind: 'exercises', selection: 'alle', count: 1, dryRun: true, settings },
      { repoRoot: r.root, tools, now, randomShort: () => 'red001' },
    );
    const result = await runCollect({ repoRoot: r.root, tools, now });
    expect(result.outcomes[0]?.status).toBe('blocked');
    expect(result.outcomes[0]?.markdown).toContain('kein Pull Request');
    expect(tools.ghCalls.some((call) => call[1] === 'create')).toBe(false);
  });

  it('echter Lauf: läuft noch → warten; ohne Schlüssel → überspringen; fertig → Pull Request mit Kosten', async () => {
    const r = repo();
    const tools = fakeTools(r.root);
    const fixture = exerciseKind.dryRunFixtures()[0]!;
    const submit = mockClient({ batchId: 'msgbatch_real00ab12cd' });
    const generated = await runGenerate(
      { kind: 'exercises', selection: 'squat koerpergewicht', count: 1, dryRun: false, settings },
      { repoRoot: r.root, tools, client: submit, now },
    );
    expect(generated.status).toBe('submitted');

    const noKey = await runCollect({ repoRoot: r.root, tools, now });
    expect(noKey.exitCode).toBe(0);
    expect(noKey.outcomes[0]?.status).toBe('no_key');

    const pending = await runCollect({
      repoRoot: r.root,
      tools,
      now,
      client: mockClient({ processingStatus: 'in_progress' }),
    });
    expect(pending.outcomes[0]?.status).toBe('pending');

    const done = mockClient({
      results: [
        succeeded(
          fixture.cell.customId,
          JSON.stringify((fixture.response as { data: unknown }).data),
          'end_turn',
          { input: 9000, output: 6000 },
        ),
      ],
    });
    const result = await runCollect({ repoRoot: r.root, tools, now, client: done });
    expect(result.outcomes[0]?.status).toBe('pr_opened');
    expect(result.outcomes[0]?.markdown).toContain('Tatsächlich: 0,08 $');
    const create = tools.ghCalls.find((call) => call[1] === 'create')!;
    expect(create[create.indexOf('--title') + 1]).toBe(
      'Neue Entwürfe: 1 Übungen (2026-10-03-ab12cd)',
    );
  });

  it('holt einen fehlenden Pull Request nach (abgeholt, aber gh war fehlgeschlagen)', async () => {
    const r = repo();
    const failing = fakeTools(r.root, { failPrCreate: true });
    await runGenerate(
      { kind: 'exercises', selection: 'alle', count: 1, dryRun: true, settings },
      { repoRoot: r.root, tools: failing, now, randomShort: () => 'fix001' },
    );
    const first = await runCollect({ repoRoot: r.root, tools: failing, now });
    expect(first.outcomes[0]?.status).toBe('error');
    const tools = fakeTools(r.root, { prListCount: '0' });
    const second = await runCollect({ repoRoot: r.root, tools, now });
    expect(second.outcomes[0]?.status).toBe('pr_opened');
    expect(tools.ghCalls.some((call) => call[1] === 'create')).toBe(true);
  });
});

describe('content-review', () => {
  it('gibt eine Übung frei: Status, Prüfer, Datum, Pull Request, ci – Version bleibt', async () => {
    const r = repo();
    const tools = fakeTools(r.root);
    const result = await runReview(
      { ids: 'goblet-kniebeuge, goblet-kniebeuge', status: 'published', reviewer: 'KT' },
      { repoRoot: r.root, tools, now, randomShort: () => 'rev001' },
    );
    expect(result.exitCode).toBe(0);
    expect(result.branch).toBe('content/review-2026-10-03-rev001');
    const file = JSON.parse(
      r.showRemote(result.branch!, 'content/exercises/goblet-kniebeuge.json'),
    );
    expect(file.status).toBe('published');
    expect(file.version).toBe(1);
    expect(file.meta.reviewed_by).toBe('KT');
    expect(file.meta.reviewed_at).toBe('2026-10-03');
    expect(tools.ghCalls).toContainEqual(['workflow', 'run', 'ci.yml', '--ref', result.branch]);
    expect(neverApproves(tools.ghCalls)).toBe(true);
    // main selbst bleibt unverändert (Freigabe erst mit dem Merge).
    expect(JSON.parse(r.showRemote('main', 'content/exercises/goblet-kniebeuge.json')).status).toBe(
      'draft',
    );
  });

  it('blockiert die Freigabe einer Vorlage mit Übungen im Entwurf (V3) – kein Pull Request', async () => {
    const r = repo();
    const tools = fakeTools(r.root);
    const result = await runReview(
      { ids: 'fitness-einsteiger-3t-zuhause', status: 'published', reviewer: 'KT' },
      { repoRoot: r.root, tools, now },
    );
    expect(result.exitCode).toBe(1);
    expect(result.markdown).toContain('V3');
    expect(tools.ghCalls).toEqual([]);
    expect(
      existsSync(join(r.root, 'content/plan-templates/fitness-einsteiger-3t-zuhause.json')),
    ).toBe(true);
    expect(r.git(['status', '--porcelain'])).toBe('');
  });

  it('lehnt ungültige Eingaben ab (unbekannte ID, fehlender Prüfer, Pfad-Tricks)', async () => {
    const r = repo();
    const tools = fakeTools(r.root);
    const deps = { repoRoot: r.root, tools, now };
    expect(
      (await runReview({ ids: 'gibt-es-nicht', status: 'published', reviewer: 'KT' }, deps))
        .markdown,
    ).toContain('nicht gefunden');
    expect(
      (await runReview({ ids: 'goblet-kniebeuge', status: 'published', reviewer: ' ' }, deps))
        .exitCode,
    ).toBe(1);
    expect(
      (await runReview({ ids: '../../etc/passwd', status: 'published', reviewer: 'KT' }, deps))
        .exitCode,
    ).toBe(1);
    expect(
      (await runReview({ ids: 'goblet-kniebeuge', status: 'geloescht', reviewer: 'KT' }, deps))
        .exitCode,
    ).toBe(1);
    expect(tools.ghCalls).toEqual([]);
  });

  it('nichts zu tun, wenn der Status schon stimmt', async () => {
    const r = repo();
    const tools = fakeTools(r.root);
    const result = await runReview(
      { ids: 'goblet-kniebeuge', status: 'draft', reviewer: 'KT' },
      { repoRoot: r.root, tools, now },
    );
    expect(result.exitCode).toBe(0);
    expect(result.markdown).toContain('nichts zu tun');
    expect(tools.ghCalls).toEqual([]);
  });
});
