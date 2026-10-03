import { describe, expect, it } from 'vitest';

import type { BatchRecord } from './batch-record';
import { dryRunResults } from './dry-run';
import { loadLibrary } from './files';
import type { GenerationCell } from './kinds';
import { exerciseKind } from './kinds/exercise';
import { planTemplateKind } from './kinds/plan-template';
import { actualCostUsd } from './pricing';
import { type BatchResult, processResults } from './results';
import { REAL_REPO_ROOT, succeeded } from './test-helpers';

const context = loadLibrary(REAL_REPO_ROOT);

function record(
  cells: readonly GenerationCell[],
  overrides: Partial<BatchRecord> = {},
): BatchRecord {
  return {
    record_version: 1,
    status: 'submitted',
    dry_run: false,
    batch_id: 'msgbatch_abc123',
    kind: 'exercise',
    model: 'claude-opus-5-5',
    effort: 'high',
    selection: 'alle',
    count: cells.length,
    created_at: '2026-10-03T10:00:00.000Z',
    branch: 'content/batch-2026-10-03-abc123',
    estimate: { input_tokens: 0, max_tokens_per_request: 12000, worst_case_usd: 1, max_usd: 15 },
    requests: cells.map((cell) => ({
      custom_id: cell.customId,
      target_id: cell.targetId,
      label: cell.label,
      values: { ...cell.values },
    })),
    collected: null,
    ...overrides,
  };
}

const fixtures = exerciseKind.dryRunFixtures();
const wandsitzen = (fixtures[0]!.response as { data: Record<string, unknown> }).data;
const seitstuetz = (fixtures[1]!.response as { data: Record<string, unknown> }).data;
const squatCell = fixtures[0]!.cell;
const coreCell = fixtures[1]!.cell;

function cell(pattern: string, focus: string): GenerationCell {
  return exerciseKind.cells(context).find((c) => c.customId === `ex-${pattern}-${focus}`)!;
}

describe('Ergebnisse verarbeiten', () => {
  it('ordnet NUR über custom_id zu – auch bei vertauschter Reihenfolge', () => {
    const cells = [squatCell, coreCell];
    const results: BatchResult[] = [
      succeeded(coreCell.customId, JSON.stringify(seitstuetz)),
      succeeded(squatCell.customId, JSON.stringify(wandsitzen)),
    ];
    const processed = processResults({
      kind: exerciseKind,
      record: record(cells),
      results,
      context,
      today: '2026-10-04',
    });
    expect(processed.notSaved).toEqual([]);
    expect(processed.drafts.map((d) => [d.customId, d.id])).toEqual([
      [coreCell.customId, 'probelauf-seitstuetz'],
      [squatCell.customId, 'probelauf-wandsitzen'],
    ]);
    const draft = processed.drafts[1]!.content;
    expect(draft.status).toBe('draft');
    expect(draft.version).toBe(1);
    expect(draft.meta).toEqual({
      origin: 'batch',
      model: 'claude-opus-5-5',
      batch_id: 'msgbatch_abc123',
      created_on: '2026-10-04',
      expert_reviewed: false,
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
    });
  });

  it('eine Antwort für die falsche Zelle wird abgelehnt (Bewegungsmuster fest je custom_id)', () => {
    // Antwort „Wandsitzen“ (squat) unter der custom_id der Zelle core_anti_rotation.
    const processed = processResults({
      kind: exerciseKind,
      record: record([coreCell]),
      results: [succeeded(coreCell.customId, JSON.stringify(wandsitzen))],
      context,
      today: '2026-10-04',
    });
    expect(processed.drafts).toEqual([]);
    expect(processed.notSaved[0]?.reason).toBe('invalid');
    expect(processed.notSaved[0]?.detail).toContain('movement_pattern');
  });

  it('behandelt alle Ergebnis-Arten und Stopp-Gründe', () => {
    const cells = [
      'squat-band',
      'hinge-band',
      'lunge-band',
      'carry-band',
      'mobility-band',
      'calf_raise-band',
      'knee_flexion-band',
      'conditioning-band',
      'core_flexion-band',
    ].map((key) => {
      const [pattern, focus] = key.split('-') as [string, string];
      return cell(pattern, focus);
    });
    const [a, b, c, d, e, f, g, h, i] = cells.map((x) => x.customId) as string[];
    const results: BatchResult[] = [
      {
        custom_id: a!,
        result: {
          type: 'errored',
          error: {
            type: 'error',
            request_id: null,
            error: { type: 'overloaded_error', message: 'x' },
          },
        },
      },
      { custom_id: b!, result: { type: 'expired' } },
      { custom_id: c!, result: { type: 'canceled' } },
      succeeded(d!, '', 'refusal'),
      succeeded(e!, '{"id": "abgeschnit', 'max_tokens'),
      succeeded(f!, 'kein json'),
      succeeded(
        g!,
        JSON.stringify({ ...wandsitzen, movement_pattern: 'knee_flexion', description_de: 'kurz' }),
      ),
      succeeded(h!, '{}', 'tool_use'),
      succeeded('ex-fremd-unbekannt', '{}'),
      // i fehlt ganz
    ];
    const processed = processResults({
      kind: exerciseKind,
      record: record(cells),
      results,
      context,
      today: '2026-10-04',
    });
    expect(processed.drafts).toEqual([]);
    const reasons = Object.fromEntries(processed.notSaved.map((n) => [n.customId, n.reason]));
    expect(reasons).toEqual({
      [a!]: 'errored',
      [b!]: 'expired',
      [c!]: 'canceled',
      [d!]: 'refusal',
      [e!]: 'max_tokens',
      [f!]: 'no_json',
      [g!]: 'invalid',
      [h!]: 'stop_reason',
      'ex-fremd-unbekannt': 'unknown_custom_id',
      [i!]: 'missing',
    });
    expect(processed.notSaved.find((n) => n.customId === d)?.detail).toContain('cyber');
    // Abgerechnet: alle succeeded-Ergebnisse (6 × 1000 Eingabe, 6 × 2000 Ausgabe), nicht errored/expired.
    expect(processed.usage.inputTokens).toBe(6000);
    expect(processed.usage.outputTokens).toBe(12000);
    expect(actualCostUsd('claude-opus-5-5', processed.usage)).toBeCloseTo(0.132, 6);
  });

  it('überschreibt keine vorhandenen Inhalte und erkennt doppelte IDs im Lauf', () => {
    const taken = { ...wandsitzen, id: 'goblet-kniebeuge' };
    const cells = [cell('squat', 'band'), cell('squat', 'kettlebell'), cell('squat', 'kurzhantel')];
    const processed = processResults({
      kind: exerciseKind,
      record: record(cells),
      results: [
        succeeded(cells[0]!.customId, JSON.stringify(taken)),
        succeeded(cells[1]!.customId, JSON.stringify(wandsitzen)),
        succeeded(cells[2]!.customId, JSON.stringify(wandsitzen)),
        succeeded(cells[2]!.customId, JSON.stringify(wandsitzen)),
      ],
      context,
      today: '2026-10-04',
    });
    expect(processed.drafts.map((d) => d.id)).toEqual(['probelauf-wandsitzen']);
    expect(processed.notSaved.map((n) => n.reason)).toEqual([
      'id_taken',
      'duplicate_id',
      'duplicate_result',
    ]);
  });

  it('Vorlagen: ID aus der Zelle, Matrix-Werte fest', () => {
    const [valid] = planTemplateKind.dryRunFixtures();
    const processed = processResults({
      kind: planTemplateKind,
      record: record([valid!.cell], { kind: 'plan_template' }),
      results: [
        succeeded(
          valid!.cell.customId,
          JSON.stringify((valid!.response as { data: unknown }).data),
        ),
      ],
      context,
      today: '2026-10-04',
    });
    expect(processed.drafts.map((d) => d.id)).toEqual(['fitness-einsteiger-3t-zuhause-30-45min']);
  });

  it('Probelauf: feste Antworten in umgekehrter Reihenfolge, je eine ungültig und abgelehnt', () => {
    for (const kind of [exerciseKind, planTemplateKind]) {
      const kindFixtures = kind.dryRunFixtures();
      const results = dryRunResults(kindFixtures);
      expect(results.map((r) => r.custom_id)).toEqual(
        kindFixtures.map((f) => f.cell.customId).reverse(),
      );
      const processed = processResults({
        kind,
        record: record(
          kindFixtures.map((f) => f.cell),
          {
            dry_run: true,
            kind: kind.kind,
            batch_id: 'probelauf_abc123',
            model: 'probelauf-ohne-ki',
          },
        ),
        results,
        context,
        today: '2026-10-04',
      });
      const reasons = processed.notSaved.map((n) => n.reason);
      expect(reasons).toContain('invalid');
      expect(reasons).toContain('refusal');
      expect(processed.drafts.length).toBeGreaterThanOrEqual(1);
      for (const draft of processed.drafts) {
        expect((draft.content.meta as Record<string, unknown>).review_note).toMatch(/Probelauf/);
      }
    }
  });
});
