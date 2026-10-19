import { describe, expect, it } from 'vitest';

import {
  CONTENT_MAX_USD_LIMIT,
  DEFAULT_CONTENT_MAX_USD,
  DEFAULT_CONTENT_MODEL,
  DEFAULT_REQUEST_COUNT,
  MODEL_FLASH,
  MODEL_FLASH_LITE,
  parseBooleanFlag,
  readPipelineSettings,
  resolveRunSettings,
} from './config';
import { CONTENT_KINDS } from './kinds';
import { loadLibrary } from './files';
import { exerciseKind } from './kinds/exercise';
import { packageSizeKind } from './kinds/package-size';
import { planTemplateKind } from './kinds/plan-template';
import { actualCostUsd, batchPriceFor, emptyUsage, estimateWorstCase, formatUsd } from './pricing';
import { buildBatchRequests, countInputTokens, estimateRun } from './requests';
import { matchesSelection, parseSelection, planCells } from './selection';
import { mockClient, REAL_REPO_ROOT } from './test-helpers';

const context = loadLibrary(REAL_REPO_ROOT);

describe('Einstellungen', () => {
  it('Standardwerte: Modell/Denktiefe je Art, Deckel 3 $, Anzahl 3 (Gründer-Vorgabe „günstig“)', () => {
    expect(readPipelineSettings({})).toEqual({
      model: undefined,
      effort: undefined,
      maxUsd: DEFAULT_CONTENT_MAX_USD,
    });
    expect(DEFAULT_CONTENT_MODEL).toBe('gemini-3.8-flash');
    expect(DEFAULT_CONTENT_MAX_USD).toBe(3);
    expect(DEFAULT_REQUEST_COUNT).toBe(3);
    // Nicht gesetzte GitHub-Variablen kommen als leere Strings an.
    const empty = readPipelineSettings({
      CONTENT_MODEL: '',
      CONTENT_EFFORT: '',
      CONTENT_MAX_USD: ' ',
    });
    expect(empty).toEqual({ model: undefined, effort: undefined, maxUsd: 3 });
  });

  it('Standard je Art: günstiges Flash-Lite für einfache Arten, Flash für Rezepte/Übungen/Vorlagen/Supplemente', () => {
    const defaults = Object.fromEntries(
      Object.values(CONTENT_KINDS).map((kind) => [
        kind.kind,
        resolveRunSettings(kind, readPipelineSettings({})),
      ]),
    );
    expect(defaults).toEqual({
      exercise: { model: MODEL_FLASH, effort: 'medium', maxUsd: 3 },
      plan_template: { model: MODEL_FLASH, effort: 'medium', maxUsd: 3 },
      recipe: { model: MODEL_FLASH, effort: 'medium', maxUsd: 3 },
      ingredient_substitution: { model: MODEL_FLASH_LITE, effort: 'low', maxUsd: 3 },
      package_size: { model: MODEL_FLASH_LITE, effort: 'low', maxUsd: 3 },
      supplement: { model: MODEL_FLASH, effort: 'medium', maxUsd: 3 },
    });
    // Jedes Standardmodell hat einen Preis (sonst bräche jeder echte Lauf ab).
    for (const kind of Object.values(CONTENT_KINDS)) {
      expect(() => batchPriceFor(kind.defaultModel)).not.toThrow();
    }
    // Eingabe/GitHub-Variable geht vor.
    expect(
      resolveRunSettings(
        packageSizeKind,
        readPipelineSettings({ CONTENT_MODEL: 'gemini-3.8-flash', CONTENT_EFFORT: 'high' }),
      ),
    ).toEqual({ model: 'gemini-3.8-flash', effort: 'high', maxUsd: 3 });
  });

  it('übernimmt gültige Werte und lehnt ungültige ab', () => {
    expect(
      readPipelineSettings({
        CONTENT_MODEL: 'gemini-4-argon',
        CONTENT_EFFORT: 'medium',
        CONTENT_MAX_USD: '7.5',
      }),
    ).toEqual({ model: 'gemini-4-argon', effort: 'medium', maxUsd: 7.5 });
    // Gemini-Denkstufen: minimal, low, medium, high – die alten Claude-Stufen gibt es nicht mehr.
    expect(readPipelineSettings({ CONTENT_EFFORT: 'minimal' }).effort).toBe('minimal');
    expect(() => readPipelineSettings({ CONTENT_EFFORT: 'max' })).toThrow(/CONTENT_EFFORT/);
    expect(() => readPipelineSettings({ CONTENT_MAX_USD: 'zehn' })).toThrow();
    expect(() => readPipelineSettings({ CONTENT_MAX_USD: '0' })).toThrow(/größer als 0/);
    // Harte Obergrenze 20 $ pro Lauf: genau 20 geht, alles darüber bricht ab.
    expect(CONTENT_MAX_USD_LIMIT).toBe(20);
    expect(readPipelineSettings({ CONTENT_MAX_USD: '20' }).maxUsd).toBe(20);
    expect(() => readPipelineSettings({ CONTENT_MAX_USD: '20.01' })).toThrow(/höchstens 20/);
    expect(() => readPipelineSettings({ CONTENT_MAX_USD: '100' })).toThrow(/höchstens 20/);
    expect(() => readPipelineSettings({ CONTENT_EFFORT: 'turbo' })).toThrow(/CONTENT_EFFORT/);
    expect(() => readPipelineSettings({ CONTENT_MODEL: 'Gemini Flash; rm -rf' })).toThrow();
  });

  it('Probelauf-Schalter', () => {
    expect(parseBooleanFlag('true')).toBe(true);
    expect(parseBooleanFlag('false')).toBe(false);
    expect(parseBooleanFlag(undefined)).toBe(false);
  });
});

describe('Kosten', () => {
  it('Batch-Preise vorsichtig (Flash 0,75/3,75; Flash-Lite ohne Batch-Rabatt); unbekanntes Modell bricht ab', () => {
    expect(batchPriceFor('gemini-3.8-flash')).toEqual({ inputPerMTok: 0.75, outputPerMTok: 3.75 });
    expect(batchPriceFor('gemini-3.5-flash-lite')).toEqual({
      inputPerMTok: 0.3,
      outputPerMTok: 2.5,
    });
    expect(batchPriceFor('gemini-3.1-flash-lite')).toEqual({
      inputPerMTok: 0.25,
      outputPerMTok: 1.5,
    });
    // Flash-Lite ist im schlimmsten Fall günstiger als Flash.
    expect(batchPriceFor(MODEL_FLASH_LITE).outputPerMTok).toBeLessThan(
      batchPriceFor(MODEL_FLASH).outputPerMTok,
    );
    expect(() => batchPriceFor('gemini-4-argon')).toThrow(/kein Preis/);
    // Der Claude-Pfad ist entfernt: auch frühere Claude-Modelle haben keinen Preis mehr.
    expect(() => batchPriceFor('claude-opus-5-5')).toThrow(/kein Preis/);
  });

  it('schlimmster Fall (24 Vorlagen ≈ 2,30 $, 50 Übungen ≈ 2,36 $ mit Gemini 3.8 Flash)', () => {
    const templates = estimateWorstCase({
      model: 'gemini-3.8-flash',
      requests: 24,
      inputTokens: 24 * 8000,
      maxTokensPerRequest: 24_000,
      maxUsd: 15,
    });
    expect(templates.worstCaseUsd).toBeCloseTo(2.304, 3);
    expect(templates.withinCap).toBe(true);
    const exercises = estimateWorstCase({
      model: 'gemini-3.8-flash',
      requests: 50,
      inputTokens: 50 * 3000,
      maxTokensPerRequest: 12_000,
      maxUsd: 15,
    });
    expect(exercises.worstCaseUsd).toBeCloseTo(2.3625, 4);
  });

  it('Deckel: genau am Deckel erlaubt, darüber nicht', () => {
    const base = {
      model: 'gemini-3.8-flash',
      requests: 500,
      maxTokensPerRequest: 8_000,
      maxUsd: 15,
    };
    expect(estimateWorstCase({ ...base, inputTokens: 0 }).withinCap).toBe(true); // 15,00 $
    expect(estimateWorstCase({ ...base, inputTokens: 1 }).withinCap).toBe(false);
  });

  it('tatsächliche Kosten aus den gemeldeten Token', () => {
    const usage = { ...emptyUsage(), inputTokens: 1_000_000, outputTokens: 100_000 };
    expect(actualCostUsd('gemini-3.8-flash', usage)).toBeCloseTo(1.125, 6);
    expect(formatUsd(6.144)).toBe('6,14 $');
  });

  it('zählt Eingabe-Token per countTokens für jede Anfrage', async () => {
    const client = mockClient({ inputTokensPerRequest: 8000 });
    const cells = planTemplateKind.cells(context).slice(0, 24);
    const requests = buildBatchRequests(planTemplateKind, cells, context, {
      model: 'gemini-3.8-flash',
      effort: 'high',
    });
    expect(await countInputTokens(client, 'gemini-3.8-flash', requests)).toBe(24 * 8000);
    expect(client.calls.countTokens).toBe(24);
    const estimate = await estimateRun(client, planTemplateKind, requests, {
      model: 'gemini-3.8-flash',
      effort: 'high',
      maxUsd: 15,
    });
    expect(estimate.worstCaseUsd).toBeCloseTo(2.304, 3);
    expect(client.calls.create).toBe(0); // Schätzen sendet nichts ab
  });

  it('Modell ohne Preis: Abbruch VOR dem ersten API-Aufruf', async () => {
    const client = mockClient();
    const requests = buildBatchRequests(
      planTemplateKind,
      planTemplateKind.cells(context).slice(0, 2),
      context,
      {
        model: 'gemini-4-argon',
        effort: 'high',
      },
    );
    await expect(
      estimateRun(client, planTemplateKind, requests, {
        model: 'gemini-4-argon',
        effort: 'high',
        maxUsd: 15,
      }),
    ).rejects.toThrow(/kein Preis/);
    expect(client.calls.countTokens).toBe(0);
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
