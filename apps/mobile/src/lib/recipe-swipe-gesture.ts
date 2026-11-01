import type { RecipeSwipeChoice } from '@fitnessapp/core';

/**
 * Bedienung des Kartenstapels „Gerichte entdecken“ (keine Fachlogik): ab welcher Strecke ein Wischen zählt und in
 * welche Richtung. Waagerecht hat Vorrang; „neutral“ nur bei deutlich mehr Bewegung nach oben als zur Seite. Nach
 * unten gibt es keine Entscheidung (die Karte springt zurück).
 */
export const SWIPE_THRESHOLD = 96;

export function swipeChoice(dx: number, dy: number): RecipeSwipeChoice | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? 'like' : 'dislike';
  }
  if (dy <= -SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) return 'neutral';
  return null;
}
