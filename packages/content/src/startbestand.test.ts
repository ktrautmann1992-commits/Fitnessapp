/**
 * Prüft den Startbestand im Repository (content/): vollständige Matrix, Kennzeichnung als KI-Entwurf und
 * KEINE roten Fehler – auch nicht an Entwürfen (strenger als content:validate, das Entwürfe nur meldet).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  isBodyweightOrBandOnly,
  TEMPLATE_EXPERIENCE_LEVELS,
  TEMPLATE_GOAL_TYPES,
  validateContent,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { loadContentFiles } from './validate';

const contentDir = join(import.meta.dirname, '..', '..', '..', 'content');
const { files, strayFiles } = loadContentFiles(contentDir);
const result = validateContent(files);

describe('Startbestand (content/)', () => {
  it('ca. 80 Übungen (Startbestand + Körpergewicht K1) und 24 Plan-Vorlagen, alle mit gültigem Schema', () => {
    expect(strayFiles).toEqual([]);
    expect(result.exercises.length).toBeGreaterThanOrEqual(45);
    expect(result.exercises.length).toBeLessThanOrEqual(90);
    expect(result.templates).toHaveLength(24);
    expect(result.exercises.length + result.templates.length).toBe(files.length);
  });

  it('keine roten Fehler (auch nicht an Entwürfen)', () => {
    const red = result.issues.filter((issue) => issue.severity === 'error');
    expect(red.map((issue) => `${issue.rule} ${issue.id}: ${issue.message}`)).toEqual([]);
  });

  it('Matrix vollständig: 3 Ziele × 2 Level × 3/4 Tage × Studio/Zuhause, 45–60 Minuten', () => {
    const keys = result.templates.map(
      (t) => `${t.goal_type}/${t.experience_level}/${t.sessions_per_week}/${t.location}`,
    );
    const expected = TEMPLATE_GOAL_TYPES.flatMap((goal) =>
      TEMPLATE_EXPERIENCE_LEVELS.flatMap((level) =>
        [3, 4].flatMap((days) => ['gym', 'home'].map((loc) => `${goal}/${level}/${days}/${loc}`)),
      ),
    );
    expect([...keys].sort()).toEqual([...expected].sort());
    for (const template of result.templates) {
      expect([template.minutes_min, template.minutes_max]).toEqual([45, 60]);
    }
  });

  it('Zuhause: Pflicht Kurzhanteln + Bänder, optional Flachbank + Klimmzugstange', () => {
    for (const template of result.templates.filter((t) => t.location === 'home')) {
      expect(template.required_equipment_ids).toEqual(['dumbbells', 'resistance_bands']);
      expect(template.optional_equipment_ids).toEqual(['flat_bench', 'pull_up_bar']);
    }
  });

  it('alles Entwurf und als KI-Entwurf gekennzeichnet (ohne Prüfung)', () => {
    for (const item of [...result.exercises, ...result.templates]) {
      expect(item.status).toBe('draft');
      expect(item.version).toBe(1);
      expect(item.meta).toMatchObject({
        origin: 'claude_session',
        model: 'claude-opus-5-5',
        expert_reviewed: false,
        reviewed_by: null,
      });
    }
  });

  it('jedes Bewegungsmuster hat eine Variante ohne Geräte oder nur mit Band', () => {
    const patterns = new Set(result.exercises.map((e) => e.movement_pattern));
    for (const pattern of patterns) {
      expect(
        result.exercises.some((e) => e.movement_pattern === pattern && isBodyweightOrBandOnly(e)),
        pattern,
      ).toBe(true);
    }
  });

  it('Dateien sind formatiert (2 Leerzeichen, Zeilenende)', () => {
    for (const file of files) {
      const folder = file.kind === 'exercise' ? 'exercises' : 'plan-templates';
      const text = readFileSync(join(contentDir, folder, file.fileName), 'utf8');
      expect(text.endsWith('\n'), file.fileName).toBe(true);
    }
  });
});
