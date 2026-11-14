import { WORKOUT_PLAYER } from '@fitnessapp/core';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cleanup, render } from '@/test/render';

import { ExerciseMotion, exerciseMotionTemplates } from './exercise-motion';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const frameOf = (view: HTMLElement) =>
  view.querySelector('[data-testid="m"]')?.getAttribute('data-frame');

describe('ExerciseMotion (Übungsbild als Bewegung, Workout-Player 14.11.2026)', () => {
  it('Vorlagen: Liegestütz mit Start und Ende, Übung ohne Endbild nur Start, unbekannt nichts', () => {
    expect(exerciseMotionTemplates('liegestuetz')?.end).toEqual(expect.stringContaining('<svg'));
    // Bankdrücken mit Langhantel kommt in keinem Workout vor und hat (noch) kein Endbild.
    expect(exerciseMotionTemplates('bankdruecken-langhantel')).toMatchObject({ end: null });
    expect(exerciseMotionTemplates('gibt-es-nicht')).toBeNull();
  });

  it('wechselt im Sekundentakt zwischen Ausgangs- und Endposition (Endlosschleife)', () => {
    const view = render(
      <ExerciseMotion exerciseId="liegestuetz" height={120} surface="#fff" label="x" testID="m" />,
    );
    const el = view.querySelector('[data-testid="m"]');
    expect(el?.getAttribute('data-motion')).toBe('on');
    expect(view.querySelector('[data-testid="m-end"]')).not.toBeNull();
    expect(frameOf(view)).toBe('start');
    act(() => vi.advanceTimersByTime(WORKOUT_PLAYER.mediaSwapMs));
    expect(frameOf(view)).toBe('end');
    act(() => vi.advanceTimersByTime(WORKOUT_PLAYER.mediaSwapMs));
    expect(frameOf(view)).toBe('start');
    act(() => vi.advanceTimersByTime(WORKOUT_PLAYER.mediaSwapMs * 5));
    expect(frameOf(view)).toBe('end');
  });

  it('ohne Endbild oder als Vorschau: statisches Startbild', () => {
    const hold = render(
      <ExerciseMotion
        exerciseId="bankdruecken-langhantel"
        height={120}
        surface="#fff"
        label="x"
        testID="m"
      />,
    );
    act(() => vi.advanceTimersByTime(WORKOUT_PLAYER.mediaSwapMs * 3));
    expect(hold.querySelector('[data-testid="m"]')?.getAttribute('data-motion')).toBe('off');
    expect(frameOf(hold)).toBe('start');
    cleanup();
    const thumb = render(
      <ExerciseMotion
        exerciseId="liegestuetz"
        height={50}
        surface="#fff"
        label="x"
        animate={false}
        testID="m"
      />,
    );
    act(() => vi.advanceTimersByTime(WORKOUT_PLAYER.mediaSwapMs * 3));
    expect(frameOf(thumb)).toBe('start');
    expect(thumb.querySelector('[data-testid="m-end"]')).toBeNull();
  });
});
