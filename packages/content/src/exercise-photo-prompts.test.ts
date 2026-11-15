/**
 * Prüft die Bild-Prompts für die Übungsfotos (content/exercise-photos/prompts.json): Start- und End-Foto je Übung,
 * die im Trainings-Player die Strichmännchen ersetzen.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const contentDir = join(import.meta.dirname, '..', '..', '..', 'content');

const promptSchema = z.object({
  id: z.string().min(1),
  uses: z.number().int().nonnegative(),
  start: z.string().min(1).max(900),
  end: z.string().min(1).max(900),
});

const prompts = z
  .array(promptSchema)
  .parse(JSON.parse(readFileSync(join(contentDir, 'exercise-photos', 'prompts.json'), 'utf8')));

describe('Übungsfoto-Prompts', () => {
  it('enthält Einträge', () => {
    expect(prompts.length).toBeGreaterThan(0);
  });

  it('verweist nur auf vorhandene Übungen', () => {
    const missing = prompts.filter(
      (p) => !existsSync(join(contentDir, 'exercises', `${p.id}.json`)),
    );
    expect(missing.map((p) => p.id)).toEqual([]);
  });

  it('hat jede Übung nur einmal', () => {
    const ids = prompts.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Start-Prompts schließen Text im Bild aus', () => {
    expect(prompts.filter((p) => !p.start.includes('No text')).map((p) => p.id)).toEqual([]);
  });

  it('End-Prompts sind Bearbeitungs-Prompts', () => {
    expect(
      prompts.filter((p) => !p.end.startsWith('Edit the reference photo')).map((p) => p.id),
    ).toEqual([]);
  });

  it('ist nach Häufigkeit sortiert', () => {
    for (let i = 1; i < prompts.length; i++) {
      expect(prompts[i - 1]!.uses).toBeGreaterThanOrEqual(prompts[i]!.uses);
    }
  });
});
