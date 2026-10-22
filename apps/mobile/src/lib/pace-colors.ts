import { RUN_INSIGHTS } from '@fitnessapp/core';

/**
 * Farben der Tempo-Stufen (Auswertung je Lauf): Index 0 = am schnellsten … 4 = am langsamsten. Eine geordnete Folge
 * Violett → Pink → Orange → Bernstein (Helligkeit steigt gleichmäßig, auch bei Farbschwäche unterscheidbar). Die
 * Werte stehen immer auch als Text daneben (Kilometerzeiten), die Farbe ist nur Zusatz.
 * - `light`: auf Weiß und hellen Kartenkacheln (jede Stufe ≥ 3 : 1 zu Weiß, WCAG 1.4.11).
 * - `dark`: auf Graphit (Hero-Karte, Skizze, Dunkelmodus).
 */
export const PACE_COLORS = {
  light: ['#6D28D9', '#A21CAF', '#DB2777', '#EA580C', '#D97706'],
  dark: ['#A78BFA', '#E879F9', '#F472B6', '#FB923C', '#FCD34D'],
} as const satisfies Record<'light' | 'dark', readonly string[]>;

/** Farbe einer Stufe; ohne Stufe (keine Kilometerzeiten) die mittlere. */
export function paceColor(scheme: 'light' | 'dark', bucket: number | null): string {
  const palette = PACE_COLORS[scheme];
  const mid = Math.floor((RUN_INSIGHTS.paceBuckets - 1) / 2);
  const i = bucket === null ? mid : Math.min(palette.length - 1, Math.max(0, bucket));
  return palette[i] as string;
}
