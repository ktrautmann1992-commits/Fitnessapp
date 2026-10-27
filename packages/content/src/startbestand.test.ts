/**
 * Prüft den Startbestand im Repository (content/): vollständige Matrix, KI-Kennzeichnung, Freigabe nur mit
 * Prüfvermerk und KEINE roten Fehler – auch nicht an Entwürfen (strenger als content:validate, das Entwürfe nur meldet).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  isBodyweightOrBandOnly,
  isBodyweightTemplate,
  isCalisthenicsTemplate,
  isSuspensionTemplate,
  TEMPLATE_EXPERIENCE_LEVELS,
  TEMPLATE_GOAL_TYPES,
  validateContent,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { loadContentFiles } from './validate';

const contentDir = join(import.meta.dirname, '..', '..', '..', 'content');
const { files, strayFiles } = loadContentFiles(contentDir);
const result = validateContent(files);
const bodyweight = result.templates.filter((t) => isBodyweightTemplate(t));
/** Entwürfe aus docs/PLAN-CALISTHENICS-SCHLINGE.md: Calisthenics- und „nur Schlingentrainer“-Vorlagen (eigene Prüfung). */
const extra = result.templates.filter((t) => isCalisthenicsTemplate(t) || isSuspensionTemplate(t));
const standard = result.templates.filter((t) => !isBodyweightTemplate(t) && !extra.includes(t));
/** Ziele der Matrix (Calisthenics hat eigene Vorlagen außerhalb der Matrix). */
const MATRIX_GOALS = TEMPLATE_GOAL_TYPES.filter((goal) => goal !== 'calisthenics');

describe('Startbestand (content/)', () => {
  it('ca. 170 Übungen (Startbestand + Körpergewicht K1/K2 + Aufwärmen/Dehnen + Calisthenics/Schlingentrainer/Lauf-ABC) und 24 + 18 + 7 Plan-Vorlagen, alle mit gültigem Schema', () => {
    expect(strayFiles).toEqual([]);
    expect(result.exercises.length).toBeGreaterThanOrEqual(45);
    // + 17 Hyrox-Stationen und Ersatz (Sportarten Stufe 1, Etappe H).
    expect(result.exercises.length).toBeLessThanOrEqual(200);
    expect(result.templates).toHaveLength(49);
    expect(extra.map((t) => t.id).sort()).toEqual([
      'calisthenics-einsteiger-2t',
      'calisthenics-einsteiger-3t',
      'calisthenics-fortgeschritten-3t',
      'fettverlust-einsteiger-3t-schlingentrainer',
      'fitness-einsteiger-3t-schlingentrainer',
      'fitness-fortgeschritten-3t-schlingentrainer',
      'muskelaufbau-einsteiger-3t-schlingentrainer',
    ]);
    for (const t of extra) expect(t.status, t.id).toBe('draft');
    expect(result.exercises.length + result.templates.length).toBe(files.length);
  });

  it('keine roten Fehler (auch nicht an Entwürfen)', () => {
    const red = result.issues.filter((issue) => issue.severity === 'error');
    expect(red.map((issue) => `${issue.rule} ${issue.id}: ${issue.message}`)).toEqual([]);
  });

  it('Matrix vollständig: 3 Ziele × 2 Level × 3/4 Tage × Studio/Zuhause, 45–60 Minuten', () => {
    const keys = standard.map(
      (t) => `${t.goal_type}/${t.experience_level}/${t.sessions_per_week}/${t.location}`,
    );
    const expected = MATRIX_GOALS.flatMap((goal) =>
      TEMPLATE_EXPERIENCE_LEVELS.flatMap((level) =>
        [3, 4].flatMap((days) => ['gym', 'home'].map((loc) => `${goal}/${level}/${days}/${loc}`)),
      ),
    );
    expect([...keys].sort()).toEqual([...expected].sort());
    for (const template of standard) {
      expect([template.minutes_min, template.minutes_max]).toEqual([45, 60]);
    }
  });

  it('Körpergewicht (K2): 3 Ziele × 2 Level × 2/3/4 Tage, Zuhause ohne Geräte, 30–45 Minuten', () => {
    const keys = bodyweight.map(
      (t) => `${t.goal_type}/${t.experience_level}/${t.sessions_per_week}`,
    );
    const expected = MATRIX_GOALS.flatMap((goal) =>
      TEMPLATE_EXPERIENCE_LEVELS.flatMap((level) => [2, 3, 4].map((d) => `${goal}/${level}/${d}`)),
    );
    expect([...keys].sort()).toEqual([...expected].sort());
    for (const template of bodyweight) {
      expect(template.id).toMatch(/-koerpergewicht$/);
      // Ausnahme A9: Muskelaufbau · Fortgeschritten · 2 Tage bis 60 Minuten.
      const max = template.id === 'muskelaufbau-fortgeschritten-2t-koerpergewicht' ? 60 : 45;
      expect([template.minutes_min, template.minutes_max]).toEqual([30, max]);
    }
  });

  it('Zuhause: Pflicht Kurzhanteln + Bänder, optional Flachbank + Klimmzugstange', () => {
    for (const template of standard.filter((t) => t.location === 'home')) {
      expect(template.required_equipment_ids).toEqual(['dumbbells', 'resistance_bands']);
      expect(template.optional_equipment_ids).toEqual(['flat_bench', 'pull_up_bar']);
    }
  });

  it('jeder Inhalt ist Entwurf (ohne Prüfvermerk) oder freigegeben (mit Prüfer und Datum); KI-Kennzeichnung bleibt', () => {
    for (const item of [...result.exercises, ...result.templates]) {
      expect(['draft', 'published'], item.id).toContain(item.status);
      expect(item.version, item.id).toBe(1);
      expect(item.meta, item.id).toMatchObject({
        origin: 'claude_session',
        model: 'claude-opus-5-5',
        expert_reviewed: false,
      });
      if (item.status === 'draft') {
        expect(item.meta, item.id).toMatchObject({ reviewed_by: null, reviewed_at: null });
      } else {
        expect(item.meta.reviewed_by?.trim(), item.id).toBeTruthy();
        expect(item.meta.reviewed_at, item.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
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
