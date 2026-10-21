import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runContentReview } from './review-ids';
import { draftSupplementIds } from './review-supplements';
import { createTempRepo, fakeTools, REAL_REPO_ROOT, type TempRepo } from './test-helpers';

// content-review für Supplemente (docs/PLAN-PHASE-6.md 6/7, Etappe SU3) gegen ein Test-Repository mit dem echten
// Startbestand (18 Entwürfe).

let repo: TempRepo | undefined;
afterEach(() => {
  repo?.cleanup();
  repo = undefined;
});

function setup(): TempRepo {
  const r = createTempRepo();
  cpSync(join(REAL_REPO_ROOT, 'content/supplements'), join(r.root, 'content/supplements'), {
    recursive: true,
  });
  r.git(['add', '-A']);
  r.git(['commit', '--quiet', '-m', 'Supplemente']);
  r.git(['push', '--quiet', 'origin', 'main']);
  return r;
}

const INPUT = {
  kind: 'ids',
  ids: '',
  status: 'published',
  reviewer: 'Karsten',
  category: '-',
  expertReviewed: 'false',
  confirmAssumptions: 'false',
};

const deps = (r: TempRepo, tools = fakeTools(r.root)) => ({
  repoRoot: r.root,
  tools,
  now: () => new Date('2026-10-21T10:00:00Z'),
  randomShort: () => 'sup123',
});

const ALL_IDS =
  'creatine, protein_powder, vitamin_d, omega3, caffeine, bcaa, glutamine, l_carnitine, cla, fat_burner, testo_booster, pre_workout, hmb, ashwagandha, collagen, multivitamin, iron, melatonin';

describe('content-review Art „ids“ mit Supplementen (SU3)', () => {
  it('alle 18 per ID → ein Pull Request, Status published, Prüfer und Datum, Version bleibt', async () => {
    repo = setup();
    const tools = fakeTools(repo.root);
    const result = await runContentReview({ ...INPUT, ids: ALL_IDS }, deps(repo, tools));
    expect(result.exitCode, result.markdown).toBe(0);
    expect(result.branch).toBe('content/review-2026-10-21-sup123');
    for (const id of ['creatine', 'protein_powder', 'caffeine', 'melatonin']) {
      const released = JSON.parse(
        repo.showRemote(result.branch!, `content/supplements/${id}.json`),
      ) as { status: string; version: number; meta: Record<string, unknown> };
      expect(released.status).toBe('published');
      expect(released.version).toBe(1);
      expect(released.meta).toMatchObject({
        reviewed_by: 'Karsten',
        reviewed_at: '2026-10-21',
        expert_reviewed: false,
      });
    }
    const body = tools.prBodies[0] ?? '';
    expect(body).toContain('## Freigabe Supplemente per ID');
    expect(body).toContain('18 Supplemente · 18 werden freigegeben · 0 übersprungen.');
    expect(body).toContain('`creatine_performance`');
    expect(body).toContain('Testphase – noch nicht fachlich geprüft');
    expect(body).toContain('So testest du es am Handy');
    expect(tools.ghCalls.some((call) => call[0] === 'pr' && call[1] === 'merge')).toBe(false);
  });

  it('Stichwort „supplemente“ = alle im Entwurf; mit Häkchen „fachlich geprüft“', async () => {
    repo = setup();
    expect(draftSupplementIds(repo.root)).toHaveLength(18);
    const tools = fakeTools(repo.root);
    const result = await runContentReview(
      { ...INPUT, ids: 'Supplemente', expertReviewed: 'true', confirmAssumptions: 'true' },
      deps(repo, tools),
    );
    expect(result.exitCode, result.markdown).toBe(0);
    const released = JSON.parse(
      repo.showRemote(result.branch!, 'content/supplements/omega3.json'),
    ) as { meta: { expert_reviewed: boolean } };
    expect(released.meta.expert_reviewed).toBe(true);
    // Häkchen ohne Wirkung wird genannt.
    expect(result.markdown).toContain('Import-Annahmen geprüft');
  });

  it('roter Befund → übersprungen mit Grund, der Rest wird freigegeben', async () => {
    repo = setup();
    const path = join(repo.root, 'content/supplements/bcaa.json');
    const data = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    data.summary_de = 'BCAA steigert die Kraft im Training deutlich und schnell.';
    writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
    repo.git(['commit', '--quiet', '-am', 'kaputt']);
    repo.git(['push', '--quiet', 'origin', 'main']);
    const tools = fakeTools(repo.root);
    const result = await runContentReview({ ...INPUT, ids: 'bcaa iron' }, deps(repo, tools));
    expect(result.exitCode, result.markdown).toBe(0);
    expect(
      JSON.parse(repo.showRemote(result.branch!, 'content/supplements/iron.json')),
    ).toMatchObject({
      status: 'published',
    });
    expect(
      JSON.parse(repo.showRemote(result.branch!, 'content/supplements/bcaa.json')),
    ).toMatchObject({
      status: 'draft',
    });
    expect(tools.prBodies[0]).toContain('rote Befunde: SK3');
  });

  it('Abbrüche ohne Änderung: gemischt, unbekannt, Zielstatus, nichts mehr im Entwurf', async () => {
    repo = setup();
    const tools = fakeTools(repo.root);
    const mixed = await runContentReview(
      { ...INPUT, ids: 'creatine kniebeuge-langhantel' },
      deps(repo, tools),
    );
    expect(mixed.exitCode).toBe(1);
    expect(mixed.markdown).toContain('mischen Supplemente');
    const archived = await runContentReview(
      { ...INPUT, ids: 'creatine', status: 'archived' },
      deps(repo, tools),
    );
    expect(archived.exitCode).toBe(1);
    expect(archived.markdown).toContain('nur mit Neuer Status = published');
    expect(tools.prBodies).toHaveLength(0);
  });

  it('schon freigegeben → nichts zu tun, kein Pull Request', async () => {
    repo = setup();
    const first = await runContentReview({ ...INPUT, ids: ALL_IDS }, deps(repo));
    expect(first.exitCode).toBe(0);
    repo.git(['checkout', '--quiet', 'main']);
    repo.git(['merge', '--quiet', '--ff-only', `origin/${first.branch!}`]);
    repo.git(['push', '--quiet', 'origin', 'main']);
    const tools = fakeTools(repo.root);
    const again = await runContentReview({ ...INPUT, ids: 'creatine' }, deps(repo, tools));
    expect(again.exitCode).toBe(0);
    expect(again.markdown).toContain('schon freigegeben');
    expect(tools.prBodies).toHaveLength(0);
    const keyword = await runContentReview({ ...INPUT, ids: 'supplemente' }, deps(repo, tools));
    expect(keyword.markdown).toContain('Kein Supplement ist mehr im Entwurf');
  });
});
