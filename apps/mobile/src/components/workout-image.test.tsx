import { afterEach, describe, expect, it, vi } from 'vitest';

import { cleanup, render } from '@/test/render';

import { WorkoutBanner, WorkoutThumb } from './workouts';

/**
 * Workout-Bilder (Barbell Burn, docs/PLAN-BARBELL-BURN.md): Kachel in der Liste und Banner in der Ansicht – ohne Bild
 * bleibt das Stoppuhr-Symbol bzw. es erscheint nichts. Die require()-Liste ist hier durch Test-Daten ersetzt.
 */
vi.mock('@/data/workout-media-registry', () => ({
  WORKOUT_MEDIA: {
    'mit-bild': {
      alt_de: 'Foto: Gruppe mit Langhantel',
      ai_notice_de: 'KI-Bild, Higgsfield',
      thumbnail: { uri: 'thumb.webp' },
      banner: { uri: 'banner.webp' },
    },
  },
}));

afterEach(cleanup);

describe('WorkoutThumb', () => {
  it('mit Bild: Kachel mit Bild, für Bildschirmleser verborgen (Titel trägt die Ansage)', () => {
    const view = render(<WorkoutThumb workoutId="mit-bild" testID="t" />);
    const thumb = view.querySelector('[data-testid="t"]');
    expect(thumb).not.toBeNull();
    expect(thumb?.getAttribute('aria-hidden')).toBe('true');
    expect(view.querySelector('img')?.getAttribute('src')).toBe('thumb.webp');
  });

  it('ohne Bild: bisheriges Symbol, keine Kachel', () => {
    const view = render(<WorkoutThumb workoutId="ohne-bild" testID="t" />);
    expect(view.querySelector('[data-testid="t"]')).toBeNull();
    expect(view.querySelector('img')).toBeNull();
  });
});

describe('WorkoutBanner', () => {
  it('mit Bild: Banner mit Alt-Text und sichtbarem KI-Hinweis', () => {
    const view = render(<WorkoutBanner workoutId="mit-bild" />);
    expect(view.querySelector('[data-testid="workout-banner"]')).not.toBeNull();
    expect(view.querySelector('[data-testid="workout-banner-ai"]')?.textContent).toBe(
      'KI-Bild, Higgsfield',
    );
    expect(view.querySelector('img')?.getAttribute('alt')).toBe('Foto: Gruppe mit Langhantel');
  });

  it('ohne Bild: nichts (kein leerer Rahmen)', () => {
    const view = render(<WorkoutBanner workoutId="ohne-bild" />);
    expect(view.querySelector('[data-testid="workout-banner"]')).toBeNull();
  });
});
