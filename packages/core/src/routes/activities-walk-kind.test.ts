import { describe, expect, it } from 'vitest';

import { enduranceStoryCard } from '../share/story-card';
import { enduranceActivities, type EnduranceRouteInput } from './activities';

/**
 * Sportarten Stufe 1 · Wandern (Restpunkt 27.10.2026): Aktivitätenliste und Story-Bild zeigen „Wanderung“ bzw.
 * „Bergwanderung“ statt „Gehen“. Die Sportart bleibt `walk` (Summen unverändert), Spaziergang ohne Feld.
 */
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const walkRoute = (n: number, extra: Partial<EnduranceRouteInput> = {}): EnduranceRouteInput => ({
  id: uuid(n),
  name: `Tour ${n}`,
  sport: 'walk',
  started_at: '2026-10-25T08:00:00Z',
  duration_s: 9_000,
  moving_s: 8_400,
  distance_m: 12_000,
  elevation_gain_m: 650,
  session_log_id: null,
  ...extra,
});

describe('Aktivitäten: Art der Geh-Einheit', () => {
  it('Strecke mit Wanderung/Bergwanderung → walkKind; Spaziergang und andere Sportarten ohne Feld', () => {
    const list = enduranceActivities(
      [
        walkRoute(1, { walk_kind: 'hike' }),
        walkRoute(2, { walk_kind: 'mountain_hike', started_at: '2026-10-24T08:00:00Z' }),
        walkRoute(3, { walk_kind: null, started_at: '2026-10-23T08:00:00Z' }),
        walkRoute(4, { sport: 'run', walk_kind: 'hike', started_at: '2026-10-22T08:00:00Z' }),
      ],
      [],
    );
    expect(list.map((a) => a.walkKind ?? null)).toEqual(['hike', 'mountain_hike', null, null]);
    expect(list.every((a) => !('walkKind' in a) || a.sport === 'walk')).toBe(true);
  });

  it('verknüpfter Eintrag ist führend; Eintrag ohne GPS mit Art', () => {
    const list = enduranceActivities(
      [walkRoute(1, { walk_kind: 'hike', session_log_id: uuid(9) })],
      [
        {
          id: uuid(9),
          name_de: 'Bergwanderung',
          performed_on: '2026-10-25',
          started_at: null,
          modality: 'walk',
          duration_s: 9_000,
          distance_m: 12_000,
          elevation_m: 650,
          walk_kind: 'mountain_hike',
        },
        {
          id: uuid(10),
          name_de: 'Wanderung',
          performed_on: '2026-10-20',
          started_at: null,
          modality: 'walk',
          duration_s: 3_600,
          distance_m: 5_000,
          elevation_m: null,
          walk_kind: 'hike',
        },
        {
          id: uuid(11),
          name_de: 'Spaziergang',
          performed_on: '2026-10-19',
          started_at: null,
          modality: 'walk',
          duration_s: 1_800,
          distance_m: 2_000,
          elevation_m: null,
        },
      ],
    );
    expect(list.map((a) => [a.key, a.walkKind ?? null])).toEqual([
      [`route:${uuid(1)}`, 'mountain_hike'],
      [`log:${uuid(10)}`, 'hike'],
      [`log:${uuid(11)}`, null],
    ]);
  });
});

describe('Story-Bild: Art der Geh-Einheit', () => {
  const base = {
    sport: 'walk' as const,
    startedAt: '2026-10-25T08:00:00Z',
    day: '2026-10-25',
    durationS: 9_000,
    movingS: 8_400,
    distanceM: 12_000,
    elevationM: 650,
    points: null,
  };
  const on = { showLine: true, showDate: true };

  it('Wanderung/Bergwanderung im Bild, Spaziergang ohne Feld; nie bei anderer Sportart', () => {
    expect(enduranceStoryCard({ ...base, walkKind: 'hike' }, on).walkKind).toBe('hike');
    expect(enduranceStoryCard({ ...base, walkKind: 'mountain_hike' }, on).walkKind).toBe(
      'mountain_hike',
    );
    expect('walkKind' in enduranceStoryCard({ ...base, walkKind: 'walk' }, on)).toBe(false);
    expect('walkKind' in enduranceStoryCard({ ...base, walkKind: null }, on)).toBe(false);
    expect('walkKind' in enduranceStoryCard({ ...base, sport: 'run', walkKind: 'hike' }, on)).toBe(
      false,
    );
  });

  it('keine Gesundheitsdaten: nur Felder der Positivliste (Art ist kein Gesundheitsdatum)', () => {
    const card = enduranceStoryCard({ ...base, walkKind: 'mountain_hike' }, on);
    expect(Object.keys(card).sort()).toEqual(
      ['date', 'eBike', 'kind', 'line', 'lineState', 'sport', 'stats', 'walkKind'].sort(),
    );
  });
});
