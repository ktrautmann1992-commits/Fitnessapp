import { describe, expect, it } from 'vitest';

import { stepTitle } from './competition-format';

/** Restpunkte (Hyrox, 27.10.2026): Reise-Modus im Timer – Stations-Schritt als Zirkel-Übung. */
describe('Timer-Schritt im Reise-Modus', () => {
  const station = {
    part: 'main' as const,
    kind: 'station' as const,
    seconds: 120,
    effort: 7,
    station: 'wall_balls' as const,
  };

  it('ohne Reise-Modus wie bisher die Station; mit Reise-Modus die Zirkel-Übung', () => {
    expect(stepTitle(station)).toContain('Wall Balls');
    expect(stepTitle(station, null, 'Kniebeuge mit Körpergewicht')).toBe(
      'Hauptteil: 2 min Zirkel: Kniebeuge mit Körpergewicht',
    );
    expect(stepTitle(station, null, null)).toBe('Hauptteil: 2 min Zirkel: locker weiterlaufen');
  });

  it('Lauf-Schritte bleiben unverändert', () => {
    const run = { part: 'main' as const, kind: 'work' as const, seconds: 300, effort: 7 };
    expect(stepTitle(run, null, null)).toBe(stepTitle(run));
  });
});
