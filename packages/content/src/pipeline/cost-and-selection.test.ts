import { describe, expect, it } from 'vitest';

import {
  CONTENT_MAX_USD_LIMIT,
  DEFAULT_CONTENT_MAX_USD,
  DEFAULT_CONTENT_MODEL,
  parseBooleanFlag,
  readPipelineSettings,
} from './config';
import { loadLibrary } from './files';
import { exerciseKind } from './kinds/exercise';
import { planTemplateKind } from './kinds/plan-template';
import { actualCostUsd, batchPriceFor, emptyUsage, estimateWorstCase, formatUsd } from './pricing';
import { buildBatchRequests, countInputTokens, estimateRun } from './requests';
import { matchesSelection, parseSelection, planCells } from './selection';
import { mockClient, REAL_REPO_ROOT } from './test-helpers';

const context = loadLibrary(REAL_REPO_ROOT);

describe('Einstellungen', () => {
  it('Standardwerte: Opus 5.5, Denktiefe high, Deckel 15 $', () => {
    expect(readPipelineSettings({})).toEqual({
      model: DEFAULT_CONTENT_MODEL,
      effort: 'high',
      maxUsd: DEFAULT_CONTENT_MAX_USD,
    });
    expect(DEFAULT_CONTENT_MODEL).toBe('claude-opus-5-5');
    expect(DEFAULT_CONTENT_MAX_USD).toBe(15);
    // Nicht gesetzte GitHub-Variablen kommen als leere Strings an.
    expect(readPipelineSettings({ CONTENT_MODEL: '', CONTENT_MAX_USD: ' ' }).maxUsd).toBe(15);
  });

  it('übernimmt gültige Werte und lehnt ungültige ab', () => {
    expect(
      readPipelineSettings({
        CONTENT_MODEL: 'claude-sonnet-5-5',
        CONTENT_EFFORT: 'max',
        CONTENT_MAX_USD: '7.5',
      }),
    ).toEqual({ model: 'claude-sonnet-5-5', effort: 'max', maxUsd: 7.5 });
    expect(() => readPipelineSettings({ CONTENT_MAX_USD: 'zehn' })).toThrow();
    expect(() => readPipelineSettings({ CONTENT_MAX_USD: '0' })).toThrow(/größer als 0/);
    // Harte Obergrenze 100 $ pro Lauf: genau 100 geht, alles darüber bricht ab.
    expect(CONTENT_MAX_USD_LIMIT).toBe(100);
    expect(readPipelineSettings({ CONTENT_MAX_USD: '100' }).maxUsd).toBe(100);
    expect(() => readPipelineSettings({ CONTENT_MAX_USD: '100.01' })).toThrow(/höchstens 100/);
    expect(() => readPipelineSettings({ CONTENT_MAX_USD: '1000' })).toThrow(/höchstens 100/);
    expect(() => readPipelineSettings({ CONTENT_EFFORT: 'turbo' })).toThrow(/CONTENT_EFFORT/);
    expect(() => readPipelineSettings({ CONTENT_MODEL: 'Claude Opus; rm -rf' })).toThrow();
  });

  it('Probelauf-Schalter', () => {
    expect(parseBooleanFlag('true')).toBe(true);
    expect(parseBooleanFlag('false')).toBe(false);
    expect(parseBooleanFlag(undefined)).toBe(false);
  });
});

describe('Kosten', () => {
  it('Batch-Preis Opus 5.5: 2 $ / 10 $ je 1 Mio. Token; unbekanntes Modell bricht ab', () => {
    expect(batchPriceFor('claude-opus-5-5')).toEqual({ inputPerMTok: 2, outputPerMTok: 10 });
    expect(() => batchPriceFor('claude-unbekannt')).toThrow(/kein Preis/);
  });

  it('schlimmster Fall wie die Tabelle in Abschnitt 10 (24 Vorlagen ≈ 6,15 $, 50 Übungen ≈ 6,30 $)', () => {
    const templates = estimateWorstCase({
      model: 'claude-opus-5-5',
      requests: 24,
      inputTokens: 24 * 8000,
      maxTokensPerRequest: 24_000,
      maxUsd: 15,
    });
    expect(templates.worstCaseUsd).toBeCloseTo(6.144, 3);
    expect(templates.withinCap).toBe(true);
    const exercises = estimateWorstCase({
      model: 'claude-opus-5-5',
      requests: 50,
      inputTokens: 50 * 3000,
      maxTokensPerRequest: 12_000,
      maxUsd: 15,
    });
    expect(exercises.worstCaseUsd).toBeCloseTo(6.3, 3);
  });

  it('Deckel: genau am Deckel erlaubt, darüber nicht', () => {
    const base = {
      model: 'claude-opus-5-5',
      requests: 125,
      maxTokensPerRequest: 12_000,
      maxUsd: 15,
    };
    expect(estimateWorstCase({ ...base, inputTokens: 0 }).withinCap).toBe(true); // 15,00 $
    expect(estimateWorstCase({ ...base, inputTokens: 1 }).withinCap).toBe(false);
  });

  it('tatsächliche Kosten aus den gemeldeten Token', () => {
    const usage = { ...emptyUsage(), inputTokens: 1_000_000, outputTokens: 100_000 };
    expect(actualCostUsd('claude-opus-5-5', usage)).toBeCloseTo(3, 6);
    expect(formatUsd(6.144)).toBe('6,14 $');
  });

  it('zählt Eingabe-Token per count_tokens für jede Anfrage', async () => {
    const client = mockClient({ inputTokensPerRequest: 8000 });
    const cells = planTemplateKind.cells(context).slice(0, 24);
    const requests = buildBatchRequests(planTemplateKind, cells, context, {
      model: 'claude-opus-5-5',
      effort: 'high',
    });
    expect(await countInputTokens(client, requests)).toBe(24 * 8000);
    expect(client.calls.countTokens).toBe(24);
    const estimate = await estimateRun(client, planTemplateKind, requests, {
      model: 'claude-opus-5-5',
      effort: 'high',
      maxUsd: 15,
    });
    expect(estimate.worstCaseUsd).toBeCloseTo(6.144, 3);
    expect(client.calls.create).toBe(0); // Schätzen sendet nichts ab
  });
});

describe('Auswahl aus der Matrix', () => {
  it('„alle“ wählt alles; Begriffe einer Achse ODER, verschiedene Achsen UND', () => {
    expect(parseSelection(planTemplateKind, 'alle').size).toBe(0);
    expect(parseSelection(planTemplateKind, '').size).toBe(0);
    const selection = parseSelection(planTemplateKind, 'muskelaufbau, fat_loss; einsteiger 30-45');
    const cells = planTemplateKind
      .cells(context)
      .filter((cell) => matchesSelection(cell, selection));
    expect(cells).toHaveLength(2 * 1 * 2 * 2 * 1);
    expect(cells.every((cell) => cell.values.level === 'beginner')).toBe(true);
  });

  it('Aliase für Übungen (z. B. „band“, „studio“)', () => {
    const selection = parseSelection(exerciseKind, 'squat hinge band');
    const cells = exerciseKind.cells(context).filter((cell) => matchesSelection(cell, selection));
    expect(cells.map((cell) => cell.customId)).toEqual(['ex-squat-band', 'ex-hinge-band']);
  });

  it('unbekannte Begriffe werden mit Liste der erlaubten Werte abgelehnt', () => {
    expect(() => parseSelection(planTemplateKind, 'yoga')).toThrow(/„yoga“ ist unbekannt/);
  });

  it('überspringt Vorhandenes und kürzt auf die Anzahl', () => {
    const planned = planCells(
      planTemplateKind,
      context,
      parseSelection(planTemplateKind, 'alle'),
      10,
    );
    expect(planned.present).toHaveLength(24);
    expect(planned.cells).toHaveLength(10);
    expect(planned.deferred).toBe(48 - 10);
    const onlyExisting = planCells(
      planTemplateKind,
      context,
      parseSelection(planTemplateKind, '45-60'),
      200,
    );
    expect(onlyExisting.cells).toHaveLength(0);
  });
});
