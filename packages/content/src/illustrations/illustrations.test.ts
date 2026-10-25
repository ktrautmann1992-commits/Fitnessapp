import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { exerciseMediaSchema } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { generateIllustrationFiles, mediaFor } from './generate';
import { applyPalette, ILLUSTRATION_PALETTE } from './palette';
import { EXERCISE_ILLUSTRATIONS } from './poses';
import { CALISTHENICS_OFF_GROUND } from './poses-calisthenics';
import {
  buildScene,
  GROUND_Y,
  placeSkeleton,
  renderTemplate,
  VIEW_MARGIN,
  VIEW_WIDTH,
} from './rig';

/** Eigene Übungs-Illustrationen (Gründer-Entscheidung B): vollständig, im Bild, aktuell eingecheckt. */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const exerciseIds = readdirSync(join(repoRoot, 'content/exercises'))
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.replace(/\.json$/, ''))
  .sort();
const ids = Object.keys(EXERCISE_ILLUSTRATIONS).sort();

describe('EXERCISE_ILLUSTRATIONS', () => {
  it('jede Übung aus content/exercises hat genau eine Illustration (und keine überzählige)', () => {
    expect(exerciseIds.length).toBeGreaterThanOrEqual(80);
    expect(ids).toEqual(exerciseIds);
  });

  it.each(ids)('%s: Alt-Text beginnt mit „Ausgangsposition:“ und ist schema-gültig', (id) => {
    const alt = EXERCISE_ILLUSTRATIONS[id]!.alt;
    expect(alt).toMatch(/^Ausgangsposition: \S/);
    expect(exerciseMediaSchema.safeParse(mediaFor(id)).success).toBe(true);
  });

  it.each(ids)('%s: Figur und Geräte liegen vollständig in der Ansichtsbox', (id) => {
    const { box } = buildScene(EXERCISE_ILLUSTRATIONS[id]!.pose);
    const [x0, y0, x1, y1] = box;
    expect(x0).toBeGreaterThanOrEqual(VIEW_MARGIN);
    expect(x1).toBeLessThanOrEqual(VIEW_WIDTH - VIEW_MARGIN);
    expect(y0).toBeGreaterThanOrEqual(VIEW_MARGIN - 0.5);
    // Nichts ragt unter die Bodenlinie hinaus (runde Enden dürfen in der 2 px breiten Linie liegen).
    expect(y1).toBeLessThanOrEqual(GROUND_Y + 2.6);
  });

  /** Im Hang (Klimmzug), Stütz und Hebel berühren die Füße den Boden bewusst nicht. */
  const HANGING = new Set(['klimmzug', 'klimmzug-band-unterstuetzt', ...CALISTHENICS_OFF_GROUND]);

  it.each(ids.filter((id) => !HANGING.has(id)))(
    '%s: Bild steht auf der Bodenlinie, schwebt nicht frei',
    (id) => {
      const pose = EXERCISE_ILLUSTRATIONS[id]!.pose;
      const { box } = buildScene(pose);
      // Mindestens ein Bildelement (Figur, Gerät oder Möbel) steht auf der Bodenlinie.
      expect(box[3]).toBeGreaterThan(GROUND_Y - 1);
    },
  );
});

describe('renderTemplate', () => {
  it('ist deterministisch und enthält nur Zahlen, keine NaN/Infinity', () => {
    for (const id of ids) {
      const a = renderTemplate(EXERCISE_ILLUSTRATIONS[id]!.pose);
      expect(renderTemplate(EXERCISE_ILLUSTRATIONS[id]!.pose)).toBe(a);
      expect(a).not.toMatch(/NaN|Infinity|undefined/);
      expect(a.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180"')).toBe(
        true,
      );
    }
  });

  it('jede Farbmarke der Vorlagen hat hell und dunkel eine Farbe', () => {
    for (const id of ids) {
      const template = renderTemplate(EXERCISE_ILLUSTRATIONS[id]!.pose);
      for (const mode of ['light', 'dark'] as const) {
        const svg = applyPalette(template, ILLUSTRATION_PALETTE[mode]);
        expect(svg).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it('Gelenk-Zielpunkte ohne festes Becken sind ein Fehler', () => {
    expect(() =>
      placeSkeleton({
        view: 'side',
        torso: 90,
        near: { arm: { ik: [10, 10], bend: 'down' }, leg: [-90, -90] },
        far: { arm: [-90, -90], leg: [-90, -90] },
      }),
    ).toThrow(/pelvis/);
  });

  it('Zielpunkt wird erreicht (inverse Kinematik)', () => {
    const sk = placeSkeleton({
      view: 'side',
      torso: 90,
      pelvis: [0, 60],
      near: { arm: [-90, -90], leg: { ik: [20, 5], bend: 'fwd' } },
      far: { arm: [-90, -90], leg: [-90, -90] },
    });
    expect(sk.joints.nearAnkle[0]).toBeCloseTo(20, 5);
    expect(sk.joints.nearAnkle[1]).toBeCloseTo(5, 5);
    // Knie zeigt nach vorn.
    expect(sk.joints.nearKnee[0]).toBeGreaterThan(10);
  });
});

describe('eingecheckte Dateien', () => {
  it('SVGs, Zuordnungen und App-Modul entsprechen dem Generator (sonst: pnpm illustrations)', async () => {
    const files = await generateIllustrationFiles(repoRoot);
    expect(files.size).toBe(ids.length * 2 + 1);
    for (const [path, content] of files) {
      const full = join(repoRoot, path);
      expect(existsSync(full), path).toBe(true);
      expect(readFileSync(full, 'utf8'), path).toBe(content);
    }
  });
});
