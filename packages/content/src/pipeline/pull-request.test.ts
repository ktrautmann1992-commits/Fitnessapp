import { describe, expect, it } from 'vitest';

import { createPrAndStartCi } from './pull-request';
import type { PipelineTools } from './tools';

/** gh gefälscht: zeichnet Aufrufe getrennt nach GITHUB_TOKEN (gh) und BOT_PR_TOKEN (ghPr) auf. */
function tools(options: { withPrToken: boolean; prTokenFails?: boolean }) {
  const gh: string[][] = [];
  const ghPr: string[][] = [];
  const t: PipelineTools = {
    git: () => '',
    gh: (args) => {
      gh.push([...args]);
      return args[1] === 'create' ? 'https://github.com/o/r/pull/1\n' : '';
    },
    typecheck: () => undefined,
    ...(options.withPrToken
      ? {
          ghPr: (args: readonly string[]) => {
            ghPr.push([...args]);
            if (options.prTokenFails) throw new Error('gh pr create fehlgeschlagen: HTTP 401');
            return 'https://github.com/o/r/pull/2\n';
          },
        }
      : {}),
  };
  return { t, gh, ghPr };
}

const args = ['--base', 'main', '--head', 'content/batch-x', '--title', 'T', '--body', 'B'];

describe('createPrAndStartCi (BOT_PR_TOKEN, docs/SETUP.md Teil P)', () => {
  it('mit Token: gh pr create mit dem Token, ci NICHT zusätzlich per workflow_dispatch', () => {
    const { t, gh, ghPr } = tools({ withPrToken: true });
    expect(createPrAndStartCi(t, args, 'content/batch-x')).toEqual({
      url: 'https://github.com/o/r/pull/2',
      ciWarning: null,
    });
    expect(ghPr).toEqual([['pr', 'create', ...args]]);
    expect(gh).toEqual([]);
  });

  it('ohne Token: wie bisher – gh pr create mit GITHUB_TOKEN und ci per workflow_dispatch', () => {
    const { t, gh } = tools({ withPrToken: false });
    expect(createPrAndStartCi(t, args, 'content/batch-x').ciWarning).toBeNull();
    expect(gh).toEqual([
      ['pr', 'create', ...args],
      ['workflow', 'run', 'ci.yml', '--ref', 'content/batch-x'],
    ]);
  });

  it('Token abgelehnt: Rückfall auf GITHUB_TOKEN + ci-Start, mit Warnung', () => {
    const { t, gh } = tools({ withPrToken: true, prTokenFails: true });
    const result = createPrAndStartCi(t, args, 'content/batch-x');
    expect(result.url).toBe('https://github.com/o/r/pull/1');
    expect(result.ciWarning).toContain('BOT_PR_TOKEN wurde abgelehnt');
    expect(gh.map((call) => call.slice(0, 2))).toEqual([
      ['pr', 'create'],
      ['workflow', 'run'],
    ]);
  });

  it('nie eine Genehmigung (kein gh pr review / merge)', () => {
    const { t, gh, ghPr } = tools({ withPrToken: true });
    createPrAndStartCi(t, args, 'content/batch-x');
    expect([...gh, ...ghPr].some((call) => call[1] === 'review' || call[1] === 'merge')).toBe(
      false,
    );
  });
});
