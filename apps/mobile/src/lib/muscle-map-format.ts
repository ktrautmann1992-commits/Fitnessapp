import type { MuscleMapHighlights } from '@fitnessapp/core';

import { t } from '@/i18n';

import { MUSCLE_MAP_CENTER_X, type MuscleMapShape } from './muscle-map-paths';

/**
 * Anzeige-Helfer der Muskelkarte (Texte, Spiegeln der Pfade). Die Zuordnung Muskel → Region kommt aus
 * packages/core (muscleMapHighlights), hier nur Darstellung.
 */

/** Screenreader-Text, z. B. „Trainiert vor allem: Brust. Mitbeteiligt: Trizeps, vordere Schulter.“ */
export function muscleMapA11yLabel(
  highlights: Pick<MuscleMapHighlights, 'primaryNamesDe' | 'secondaryNamesDe'>,
): string {
  const parts: string[] = [];
  if (highlights.primaryNamesDe.length > 0) {
    parts.push(t.muscleMap.a11yPrimary(highlights.primaryNamesDe));
  }
  if (highlights.secondaryNamesDe.length > 0) {
    parts.push(t.muscleMap.a11ySecondary(highlights.secondaryNamesDe));
  }
  return parts.length > 0 ? parts.join(' ') : t.muscleMap.a11yNone;
}

export interface MuscleMapLegendLine {
  readonly level: 'primary' | 'secondary';
  readonly text: string;
}

/** Legende in Worten (leere Stufen entfallen). */
export function muscleMapLegend(
  highlights: Pick<MuscleMapHighlights, 'primaryNamesDe' | 'secondaryNamesDe'>,
): MuscleMapLegendLine[] {
  const lines: MuscleMapLegendLine[] = [];
  if (highlights.primaryNamesDe.length > 0) {
    lines.push({
      level: 'primary',
      text: t.muscleMap.legendLine(t.muscleMap.primaryLegend, highlights.primaryNamesDe),
    });
  }
  if (highlights.secondaryNamesDe.length > 0) {
    lines.push({
      level: 'secondary',
      text: t.muscleMap.legendLine(t.muscleMap.secondaryLegend, highlights.secondaryNamesDe),
    });
  }
  return lines;
}

const POINT = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;

/**
 * Spiegelt einen Pfad an der Körpermitte. Die Pfade nutzen nur absolute Befehle (M, L, C, Z) mit Punkten „x,y“ –
 * so bleibt das Spiegeln eine reine Umrechnung der x-Werte (ohne SVG-Transformation, gleich auf Web und Handy).
 */
export function mirrorPath(d: string): string {
  return d.replace(POINT, (_, x: string, y: string) => {
    const mirrored = 2 * MUSCLE_MAP_CENTER_X - Number(x);
    return `${Math.round(mirrored * 100) / 100},${y}`;
  });
}

/** Alle zu zeichnenden Pfade einer Form: linke Hälfte, gespiegelte Hälfte, Mitte. */
export function shapePaths(shape: MuscleMapShape | undefined): string[] {
  if (!shape) return [];
  return [...(shape.half ?? []).flatMap((d) => [d, mirrorPath(d)]), ...(shape.center ?? [])];
}
