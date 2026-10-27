import type { DisplaySession, Exercise, StoredSession } from '@fitnessapp/core';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { byRole, cleanup, render } from '@/test/render';

import { StrengthSession } from './plan-strength';

vi.mock('react-native-svg', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-native-svg');
  return { ...actual, SvgXml: () => null };
});

// Muskel-Kacheln (gleiche Datei wie die Chips) nutzen den Router – im Baustein-Test nicht nötig.
vi.mock('expo-router', () => ({ useRouter: () => ({ push: () => undefined }) }));

afterEach(cleanup);

/** Kompakte Übungsliste (Entwurf B, 26.10.2026). */

const exercise = (
  orderNo: number,
  id: string,
  name: string,
  extra: Partial<StoredSession['exercises'][number]> = {},
): StoredSession['exercises'][number] => ({
  order_no: orderNo,
  exercise_id: id,
  source_exercise_id: id,
  exercise_name_de: name,
  sets: 3,
  reps_min: 10,
  reps_max: 10,
  duration_s: null,
  rest_s: 90,
  rpe_target: 7.5,
  superset_group: null,
  notes_de: null,
  target_weight_kg: null,
  ...extra,
});

const session = {
  id: 's1',
  status: 'planned',
  original_date: null,
  kind: 'strength',
  name_de: 'Ganzkörper A',
  estimated_minutes: 50,
  warmup_de: '5 Minuten locker einrollen.',
  cooldown_de: 'Locker ausgehen.',
  exercises: [
    exercise(1, 'kniebeuge', 'Kniebeuge'),
    exercise(2, 'bankdruecken', 'Bankdrücken', { target_weight_kg: 40, superset_group: 'A' }),
    exercise(3, 'rudern', 'Rudern', { superset_group: 'A', notes_de: 'Rücken gerade halten.' }),
  ],
} as unknown as StoredSession;

const shown = (overrides: Partial<DisplaySession<StoredSession>> = {}) =>
  ({
    session,
    hidden: [],
    replaced: [],
    libraryMissing: false,
    ...overrides,
  }) as DisplaySession<StoredSession>;

const lib = new Map<string, Exercise>(
  [
    ['kniebeuge', ['quadriceps', 'glutes'], ['lower_back']],
    ['bankdruecken', ['chest'], ['triceps']],
    ['rudern', ['lats'], ['biceps']],
  ].map(([id, primary, secondary]) => [
    id as string,
    {
      id,
      load_type: 'weight',
      primary_muscles: primary,
      secondary_muscles: secondary,
    } as unknown as Exercise,
  ]),
);

function renderList(options: {
  library?: Map<string, Exercise> | null;
  onSwap?: (index: number) => void;
  onStart?: () => void;
  display?: DisplaySession<StoredSession>;
}) {
  return render(
    <StrengthSession
      original={session}
      shown={options.display ?? shown()}
      context={{ library: options.library === undefined ? lib : options.library }}
      heading="Deine Einheit heute"
      today
      targets={undefined}
      onOpenExercise={() => undefined}
      swap={{
        enabled: true,
        later: false,
        onSwap: options.onSwap ?? (() => undefined),
        onUndoDaySwap: () => undefined,
        onViewExclusions: null,
      }}
      swapPaused={false}
      routine={null}
      start={options.onStart ? { label: 'Training starten', onPress: options.onStart } : null}
    />,
  );
}

const byTestId = (view: HTMLElement, id: string) =>
  view.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('StrengthSession (kompakte Liste)', () => {
  it('Kopf: Minuten, Übungen, Sätze, Hauptmuskeln der Einheit, Unterstützend, Start', () => {
    const onStart = vi.fn();
    const view = renderList({ onStart });
    expect(byTestId(view, 'plan-session-facts')?.getAttribute('aria-label')).toBe(
      'ca. 50 Minuten, 3 Übungen, 9 Sätze',
    );
    const muscles = byTestId(view, 'plan-session-muscles')?.textContent ?? '';
    expect(muscles).toContain('Trainiert heute – Hauptmuskeln');
    expect(muscles).toContain('Brust');
    expect(muscles).toContain('Oberer Rücken');
    expect(byTestId(view, 'plan-session-supporting')?.textContent).toBe(
      'Unterstützend: Unterer Rücken, Bizeps, Trizeps',
    );
    byTestId(view, 'plan-session-start')?.click();
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('Zeilen: Name als Link mit ganzer Ansage, eine Zeile Zahlen, Gewicht bzw. Marker, keine „Tauschen“-Knöpfe', () => {
    const onSwap = vi.fn();
    const view = renderList({ onSwap });
    const rows = view.querySelectorAll('[data-testid="plan-exercise"]');
    expect(rows).toHaveLength(3);
    const links = view.querySelectorAll<HTMLElement>('[data-testid="plan-exercise-link"]');
    expect([...links].map((l) => l.textContent)).toEqual(['Kniebeuge', 'Bankdrücken', 'Rudern']);
    expect(links[0]?.getAttribute('role')).toBe('link');
    expect(links[0]?.getAttribute('aria-label')).toBe(
      '1. Kniebeuge, 3 Sätze à 10 Wiederholungen, Pause 90 Sekunden, 2–3 Wiederholungen in Reserve, ' +
        'Gewicht selbst finden, Hauptmuskeln: Gesäß, Oberschenkel vorne, unterstützend: Unterer Rücken',
    );
    expect(byTestId(view, 'plan-exercise-dose-0')?.textContent).toBe(
      '3 × 10 · 1:30 Pause · 2⁠–⁠3 in Reserve',
    );
    expect(byTestId(view, 'plan-exercise-find-weight-0')?.textContent).toBe(
      'Gewicht selbst finden',
    );
    expect(byTestId(view, 'plan-exercise-weight-1')?.textContent).toBe('40 kg');
    // Tauschen nur als Icon-Knopf mit Namen, keine Text-Knöpfe „Tauschen“.
    expect(byRole(view, 'button').some((b) => b.textContent === 'Tauschen')).toBe(false);
    const swap = byTestId(view, 'plan-swap-2');
    expect(swap?.getAttribute('aria-label')).toBe('Rudern tauschen');
    swap?.click();
    expect(onSwap).toHaveBeenCalledWith(2);
    // Notiz bleibt sichtbar.
    expect(byTestId(view, 'plan-exercise-note-2')?.textContent).toBe('Rücken gerade halten.');
  });

  it('Supersatz bleibt erkennbar (Kennzeile und Ansage)', () => {
    const view = renderList({});
    expect(byTestId(view, 'plan-superset-0')).toBeNull();
    expect(byTestId(view, 'plan-superset-1')?.textContent).toBe('Supersatz A');
    expect(byTestId(view, 'plan-superset-2')?.textContent).toBe('Supersatz A');
    const links = view.querySelectorAll<HTMLElement>('[data-testid="plan-exercise-link"]');
    expect(links[1]?.getAttribute('aria-label')).toContain('2. Bankdrücken, Supersatz A, ');
  });

  it('„Startgewicht finden“ nur EINMAL oben, aufklappbar', () => {
    const view = renderList({});
    expect(view.querySelectorAll('[data-testid="plan-start-weight-hint"]')).toHaveLength(1);
    expect(byTestId(view, 'plan-start-weight-text')).toBeNull();
    const toggle = byTestId(view, 'plan-start-weight-toggle');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    act(() => toggle?.click());
    expect(byTestId(view, 'plan-start-weight-text')?.textContent).toContain(
      'Wähle ein Gewicht, mit dem du alle Wiederholungen sauber schaffst',
    );
  });

  it('kein Hinweis „Startgewicht finden“, wenn jede Übung ein Gewicht hat', () => {
    const weighted = {
      ...session,
      exercises: session.exercises.map((e) => ({ ...e, target_weight_kg: 20 })),
    } as StoredSession;
    const view = renderList({ display: shown({ session: weighted }) });
    expect(byTestId(view, 'plan-start-weight-hint')).toBeNull();
  });

  it('Aufwärmen und Cool-down als aufklappbare Zeilen', () => {
    const view = renderList({});
    expect(byTestId(view, 'plan-warmup-text')).toBeNull();
    act(() => byTestId(view, 'plan-warmup-toggle')?.click());
    expect(byTestId(view, 'plan-warmup-text')?.textContent).toBe('5 Minuten locker einrollen.');
    expect(byTestId(view, 'plan-cooldown-toggle')).not.toBeNull();
  });

  it('ohne Bibliothek: Zeilen ohne Muskel-Chips, kein Absturz', () => {
    const view = renderList({ library: null });
    expect(view.querySelectorAll('[data-testid="plan-exercise"]')).toHaveLength(3);
    expect(view.querySelector('[data-testid^="muscle-chip-"]')).toBeNull();
    expect(byTestId(view, 'plan-session-muscles')).toBeNull();
    expect(byTestId(view, 'plan-session-supporting')).toBeNull();
  });

  it('Bibliothek fehlt laut Anzeige: Hinweis statt Liste', () => {
    const view = renderList({ display: shown({ libraryMissing: true }) });
    expect(byTestId(view, 'plan-library-missing')).not.toBeNull();
    expect(view.querySelector('[data-testid="plan-exercise"]')).toBeNull();
  });
});
