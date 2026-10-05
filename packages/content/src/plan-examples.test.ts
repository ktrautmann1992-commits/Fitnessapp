import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  EXAMPLE_PERSONS,
  exampleLibrary,
  PLAN_NOTE_TEXTS_DE,
  PROGRESSION_EXAMPLES,
  type ProgressionExample,
  renderPlanExamples,
  renderProgressionExamples,
  simulateProgression,
  todayInBerlin,
} from './plan-examples';
import { generateTrainingPlan } from '@fitnessapp/core';

import { loadContentFiles } from './validate';

const contentDir = join(import.meta.dirname, '../../../content');

describe('Beispielpläne', () => {
  const library = exampleLibrary(loadContentFiles(contentDir).files);

  it('erzeugt für jede Test-Person einen Plan', () => {
    const markdown = renderPlanExamples(library, '2026-10-05');
    for (const person of EXAMPLE_PERSONS) {
      expect(markdown).toContain(`### ${person.name}`);
    }
    expect(markdown).not.toContain('Kein Plan');
    expect(markdown).toContain('Muskelaufbau · Einsteiger · 3 Tage · Studio (passt genau)');
    expect(markdown).toContain('Arzt-Hinweis vor jeder Einheit');
    // Etappe K1 (Körpergewicht): Clara (zu Hause ohne Geräte) bekommt jetzt Türrahmen-Rudern statt des Hinweises.
    expect(markdown).not.toContain(PLAN_NOTE_TEXTS_DE.no_pull_exercise);
    expect(markdown).toContain('Türrahmen-Rudern');
    expect(markdown).toContain(PLAN_NOTE_TEXTS_DE.goal_endurance_not_yet);
    expect(markdown).toContain('**Plan:** Ausdauer-Grundlage – Halbmarathon');
    // Etappe B3: nur Laufen, gemischt, Mo 20 / Sa 90, Schwangerschaft, ab 65, ohne Check
    expect(markdown).toContain('**Vorlage:** keine (nur Ausdauer)');
    expect(markdown).toContain('Ausdauer-Minuten je Woche');
    expect(markdown).toContain('Ergometer locker');
    expect(markdown).toContain('Zügiges Gehen');
    expect(markdown).toContain('Geh-Lauf-Wechsel');
    expect(markdown).toContain(PLAN_NOTE_TEXTS_DE.endurance_walk);
    expect(markdown).toContain(PLAN_NOTE_TEXTS_DE.minutes_shortened);
    expect(markdown).not.toMatch(/Lockere Radeinheit[^|]*\| [^|]*\|[^\n]*Lena/);
  });

  it('Lena (Schwangerschaft): nie Rad im Freien, nie Laufen', () => {
    const lena = EXAMPLE_PERSONS.find((p) => p.name === 'Lena');
    if (!lena) throw new Error('Lena fehlt');
    const result = generateTrainingPlan(lena.inputs, library, '2026-10-05');
    if (!result.ok) throw new Error(result.error);
    const modalities = new Set(
      result.plan.sessions.filter((s) => s.kind === 'endurance').map((s) => s.name_de),
    );
    expect(
      [...modalities].every((name) => ['Ergometer locker', 'Zügiges Gehen'].includes(name)),
    ).toBe(true);
  });

  it('deterministisch für ein festes Datum', () => {
    expect(renderPlanExamples(library, '2026-10-09')).toBe(
      renderPlanExamples(library, '2026-10-09'),
    );
  });

  it('ohne Inhalte: verständliche Meldung statt Absturz', () => {
    expect(renderPlanExamples(exampleLibrary([]), '2026-10-05')).toContain(
      'Kein Plan: keine passende Vorlage',
    );
  });

  it('Datum in Europe/Berlin', () => {
    expect(todayInBerlin(new Date('2026-10-04T22:30:00Z'))).toBe('2026-10-05');
  });
});

describe('Beispiel-Progression (Phase 4, Etappe A)', () => {
  it('vier Personen mit je 8 Einheiten in der Zusammenfassung', () => {
    expect(PROGRESSION_EXAMPLES).toHaveLength(4);
    for (const example of PROGRESSION_EXAMPLES) {
      expect(example.sessions).toHaveLength(8);
    }
    const markdown = renderProgressionExamples('2026-10-05').join('\n');
    expect(markdown).toContain('## Beispiel-Progression aus dem Trainingstagebuch');
    for (const example of PROGRESSION_EXAMPLES) expect(markdown).toContain(`### ${example.name}`);
  });

  it('Anna: Einstiegswoche kalibriert, nicht geschafft → gleiches Ziel, Puffer statt 25-%-Sprung', () => {
    const rows = simulateProgression(PROGRESSION_EXAMPLES[0] as ProgressionExample, '2026-10-05');
    expect(rows[0]?.after.source).toBe('calibration');
    expect(rows[3]?.after.progress.targetReps).toBe(rows[2]?.after.progress.targetReps);
    expect(rows.at(-1)?.after.progress).toMatchObject({ weightKg: 8, targetReps: 13 });
  });

  it('Ben: Tippfehler zählt nicht, Erholungswoche ändert nichts, Sprung +2,5 kg', () => {
    const rows = simulateProgression(PROGRESSION_EXAMPLES[1] as ProgressionExample, '2026-10-05');
    expect(rows[2]?.after.progress.weightKg).toBe(80);
    expect(rows[4]?.after.progress).toMatchObject({ weightKg: 82.5, targetReps: 5 });
    expect(rows[6]?.prescription.weightKg).toBe(72.5);
    expect(rows[6]?.after.progress).toEqual(rows[5]?.after.progress);
  });

  it('Clara: zweimal kurz → kein Sprung; kurz + lang → Sprung', () => {
    const rows = simulateProgression(PROGRESSION_EXAMPLES[2] as ProgressionExample, '2026-10-05');
    expect(rows[3]?.after.progress).toMatchObject({ weightKg: 40, targetReps: 10 });
    expect(rows[5]?.after.progress).toMatchObject({ weightKg: 42.5, targetReps: 8 });
  });

  it('Dana: Studio → zu Hause → Studio – zurück im Studio 22,5 kg mit Studio-Stand, nie direkt 25 kg', () => {
    const rows = simulateProgression(PROGRESSION_EXAMPLES[3] as ProgressionExample, '2026-10-05');
    expect(rows.slice(2, 5).every((r) => r.prescription.weightKg === 20)).toBe(true);
    expect(rows.slice(2, 5).every((r) => r.after.progress.weightKg === 22.5)).toBe(true);
    expect(rows[5]?.prescription).toMatchObject({ weightKg: 22.5, targetReps: 10 });
    expect(rows.every((r) => (r.prescription.weightKg ?? 0) <= 22.5)).toBe(true);
  });

  it('erscheint in renderPlanExamples', () => {
    const library = exampleLibrary(loadContentFiles(contentDir).files);
    expect(renderPlanExamples(library, '2026-10-05')).toContain('Beispiel-Progression');
  });
});
