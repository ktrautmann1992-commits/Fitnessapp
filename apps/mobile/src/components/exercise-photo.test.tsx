import { WORKOUT_PLAYER } from '@fitnessapp/core';
import { act } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadExerciseMedia } from '@/data/exercise-media';
import { cleanup, render } from '@/test/render';

import { ExerciseMotion } from './exercise-motion';
import { StartPositionImage } from './muscle-map';

/**
 * Übungsfotos (docs/UEBUNGSFOTOS.md): Mit Foto zeigen Player und Übungsdetail das Foto (4:3, KI-Hinweis nur groß im
 * Detail); ohne Foto die Illustration. Die Zuordnung ist hier ein Testdouble mit Fotos für Liegestütz und Bankdrücken.
 */
vi.mock('@/data/exercise-photo-registry.generated', () => ({
  EXERCISE_PHOTOS: {
    liegestuetz: { start: { uri: 'liegestuetz-start.webp' }, end: { uri: 'liegestuetz-end.webp' } },
    'bankdruecken-langhantel': {
      start: { uri: 'bank-start.webp' },
      end: { uri: 'bank-end.webp' },
    },
  },
}));

const reduced = vi.hoisted(() => ({ value: false }));
vi.mock('@/lib/reduced-motion', () => ({ useReducedMotion: () => reduced.value }));

beforeAll(loadExerciseMedia);
beforeEach(() => {
  vi.useFakeTimers();
  reduced.value = false;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const box = (view: HTMLElement) => view.querySelector('[data-testid="m"]');
const photoUris = (el: Element | null | undefined) =>
  [...(el?.querySelectorAll('img') ?? [])].map((img) => img.getAttribute('src'));

describe('ExerciseMotion mit Foto', () => {
  it('Foto statt Illustration, 4:3 in der vorgegebenen Höhe, Start ↔ Ende im Sekundentakt', () => {
    const view = render(
      <ExerciseMotion exerciseId="liegestuetz" height={150} surface="#fff" label="x" testID="m" />,
    );
    const el = box(view);
    expect(el?.getAttribute('data-media')).toBe('photo');
    expect(el?.querySelector('svg')).toBeNull();
    expect(photoUris(el)).toEqual(['liegestuetz-start.webp', 'liegestuetz-end.webp']);
    const frame = el?.querySelector<HTMLElement>('[data-testid="exercise-photo"]');
    expect(frame?.style.width).toBe('200px');
    expect(frame?.style.height).toBe('150px');
    expect(el?.getAttribute('data-motion')).toBe('on');
    act(() => vi.advanceTimersByTime(WORKOUT_PLAYER.mediaSwapMs));
    expect(el?.getAttribute('data-frame')).toBe('end');
    // Kein KI-Hinweis im Player.
    expect(view.textContent).not.toContain('KI-Bild');
  });

  it('„Bewegung reduzieren“ oder Vorschau: nur das Startfoto', () => {
    reduced.value = true;
    const view = render(
      <ExerciseMotion exerciseId="liegestuetz" height={56} surface="#fff" label="x" testID="m" />,
    );
    act(() => vi.advanceTimersByTime(WORKOUT_PLAYER.mediaSwapMs * 3));
    expect(box(view)?.getAttribute('data-motion')).toBe('off');
    expect(photoUris(box(view))).toEqual(['liegestuetz-start.webp']);
    cleanup();
    reduced.value = false;
    const thumb = render(
      <ExerciseMotion
        exerciseId="liegestuetz"
        height={56}
        surface="#fff"
        label="x"
        animate={false}
        testID="m"
      />,
    );
    expect(photoUris(box(thumb))).toEqual(['liegestuetz-start.webp']);
  });

  it('Übung ohne Endposition: statisches Startfoto; ohne Foto die Illustration', () => {
    const hold = render(
      <ExerciseMotion
        exerciseId="bankdruecken-langhantel"
        height={120}
        surface="#fff"
        label="x"
        testID="m"
      />,
    );
    expect(box(hold)?.getAttribute('data-motion')).toBe('off');
    expect(photoUris(box(hold))).toEqual(['bank-start.webp']);
    cleanup();
    const svg = render(
      <ExerciseMotion
        exerciseId="kniebeuge-langhantel"
        height={120}
        surface="#fff"
        label="x"
        testID="m"
      />,
    );
    expect(box(svg)?.getAttribute('data-media')).toBe('svg');
    expect(box(svg)?.querySelector('svg')).not.toBeNull();
    expect(photoUris(box(svg))).toEqual([]);
  });
});

describe('Übungsdetail (Ausgangsposition) mit Foto', () => {
  it('zeigt das Foto mit sichtbarem KI-Hinweis und Herkunft', () => {
    const view = render(<StartPositionImage exerciseId="liegestuetz" />);
    const image = view.querySelector('[data-testid="exercise-start-position-image"]');
    expect(image?.getAttribute('data-media')).toBe('photo');
    expect(image?.getAttribute('aria-label')).toMatch(/^Ausgangsposition: /);
    expect(photoUris(image)).toEqual(['liegestuetz-start.webp']);
    expect(view.querySelector('[data-testid="exercise-start-position-ai"]')?.textContent).toBe(
      'KI-Bild',
    );
    expect(view.textContent).toContain('KI-Bild von Alpha5');
    expect(view.textContent).not.toContain('Eigene Illustration');
  });

  it('ohne Foto: Illustration mit Herkunft „Eigene Illustration“, kein KI-Hinweis', () => {
    const view = render(<StartPositionImage exerciseId="kniebeuge-langhantel" />);
    const image = view.querySelector('[data-testid="exercise-start-position-image"]');
    expect(image?.getAttribute('data-media')).toBe('svg');
    expect(image?.querySelector('svg')).not.toBeNull();
    expect(view.textContent).toContain('Eigene Illustration von Alpha5');
    expect(view.querySelector('[data-testid="exercise-start-position-ai"]')).toBeNull();
  });
});
