import { describe, expect, it } from 'vitest';

import { SHOE_MILEAGE } from '../constants';
import type { EnduranceActivity } from '../routes/activities';
import {
  assignShoe,
  currentDefaultShoe,
  defaultShoeOn,
  deleteShoe,
  EMPTY_SHOE_DATA,
  parseShoeData,
  retireShoe,
  saveShoe,
  setDefaultShoe,
  type ShoeData,
  type ShoeDraft,
  shoeDataSchema,
  shoeForActivity,
  shoeHistoryStart,
  shoeLimits,
  shoeMileage,
  shoeSportsFor,
  shoeStatus,
} from './shoes';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function activity(
  n: number,
  day: string,
  km: number | null,
  extra: Partial<EnduranceActivity> = {},
): EnduranceActivity {
  return {
    key: `log:${id(n)}`,
    source: 'log',
    routeId: null,
    logId: id(n),
    name: 'Lauf',
    sport: 'run',
    day,
    startedAt: null,
    durationS: 1800,
    movingS: 1800,
    distanceM: km === null ? null : km * 1000,
    elevationM: null,
    isFavorite: false,
    eBike: false,
    ...extra,
  };
}

function draft(over: Partial<ShoeDraft> = {}): ShoeDraft {
  return {
    id: A,
    sport: 'run',
    name: 'Pegasus 41',
    brand: 'Nike',
    startKm: 0,
    replaceKm: null,
    inUseSince: '2026-09-01',
    makeDefault: true,
    ...over,
  };
}

function ok(result: ReturnType<typeof saveShoe>): ShoeData {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

describe('Hinweis-Grenzen (600/800 km)', () => {
  it('Standard 800 km, Hinweis ab 600 km', () => {
    expect(shoeLimits({ replace_km: null })).toEqual({ warnKm: 600, replaceKm: 800 });
    expect(shoeStatus(599.9, { replace_km: null })).toBe('ok');
    expect(shoeStatus(600, { replace_km: null })).toBe('soon');
    expect(shoeStatus(799.9, { replace_km: null })).toBe('soon');
    expect(shoeStatus(800, { replace_km: null })).toBe('replace');
    expect(SHOE_MILEAGE.warnShare).toBe(0.75);
  });

  it('eigene Grenze 500 km → Hinweis ab 375 km', () => {
    expect(shoeLimits({ replace_km: 500 })).toEqual({ warnKm: 375, replaceKm: 500 });
    expect(shoeStatus(400, { replace_km: 500 })).toBe('soon');
  });
});

describe('Anlegen, Standard, automatische Zuordnung', () => {
  const data = ok(saveShoe(EMPTY_SHOE_DATA, draft()));

  it('neuer Schuh als Standard ab „In Gebrauch seit“', () => {
    expect(data.shoes).toHaveLength(1);
    expect(data.defaults).toEqual([{ sport: 'run', valid_from: '2026-09-01', shoe_id: A }]);
    expect(defaultShoeOn(data, 'run', '2026-08-31')).toBeNull();
    expect(defaultShoeOn(data, 'run', '2026-09-01')).toBe(A);
    expect(currentDefaultShoe(data, 'run', '2026-10-25')?.id).toBe(A);
    expect(currentDefaultShoe(data, 'walk', '2026-10-25')).toBeNull();
  });

  it('Läufe ab dem Tag bekommen den Schuh automatisch, frühere nicht', () => {
    expect(shoeForActivity(data, activity(1, '2026-09-01', 10))).toMatchObject({
      source: 'default',
      shoe: { id: A },
    });
    expect(shoeForActivity(data, activity(2, '2026-08-31', 10))).toEqual({
      shoe: null,
      source: 'none',
    });
    // Rad bekommt keinen Laufschuh, Gehen nur mit eigenem Standard.
    expect(shoeForActivity(data, activity(3, '2026-09-02', 10, { sport: 'bike' })).shoe).toBeNull();
    expect(shoeForActivity(data, activity(4, '2026-09-02', 10, { sport: 'walk' })).shoe).toBeNull();
    expect(shoeForActivity(data, activity(5, '2026-09-02', 1, { sport: 'swim' })).source).toBe(
      'none',
    );
  });

  it('Kilometer-Summe: Start-km + Läufe, ohne Distanz zählt 0', () => {
    const withStart = ok(saveShoe(EMPTY_SHOE_DATA, draft({ startKm: 400 })));
    const list = shoeMileage(
      withStart,
      [
        activity(1, '2026-09-02', 10.04),
        activity(2, '2026-09-03', null),
        activity(3, '2026-08-01', 50),
      ],
      '2026-10-25',
    );
    expect(list[0]).toMatchObject({
      km: 410,
      appKm: 10,
      activityCount: 2,
      lastUsed: '2026-09-03',
      status: 'ok',
      isDefault: true,
      retired: false,
    });
    expect(list[0]!.share).toBeCloseTo(410 / 800, 5);
  });

  it('Standard wechseln ändert frühere Läufe nicht', () => {
    const two = ok(
      saveShoe(
        data,
        draft({ id: B, name: 'Clifton 9', inUseSince: '2026-10-01', makeDefault: true }),
      ),
    );
    expect(shoeForActivity(two, activity(1, '2026-09-15', 10)).shoe?.id).toBe(A);
    expect(shoeForActivity(two, activity(2, '2026-10-02', 10)).shoe?.id).toBe(B);
    const mileage = shoeMileage(
      two,
      [activity(1, '2026-09-15', 10), activity(2, '2026-10-02', 7)],
      '2026-10-25',
    );
    expect(mileage.find((m) => m.shoe.id === A)).toMatchObject({ km: 10, isDefault: false });
    expect(mileage.find((m) => m.shoe.id === B)).toMatchObject({ km: 7, isDefault: true });
  });

  it('ohne Standard-Haken: kein automatischer Schuh', () => {
    const plain = ok(saveShoe(EMPTY_SHOE_DATA, draft({ makeDefault: false })));
    expect(plain.defaults).toEqual([]);
    expect(shoeForActivity(plain, activity(1, '2026-09-15', 10)).source).toBe('none');
  });
});

describe('Wahl je Lauf', () => {
  const base = ok(
    saveShoe(
      ok(saveShoe(EMPTY_SHOE_DATA, draft())),
      draft({ id: B, name: 'Trail', makeDefault: false }),
    ),
  );
  const run = activity(1, '2026-09-10', 12);

  it('anderer Schuh, „ohne Schuh“, zurück auf automatisch', () => {
    const other = ok(assignShoe(base, run, B));
    expect(shoeForActivity(other, run)).toMatchObject({ source: 'chosen', shoe: { id: B } });
    const none = ok(assignShoe(other, run, null));
    expect(shoeForActivity(none, run)).toEqual({ shoe: null, source: 'chosen' });
    expect(none.assignments).toHaveLength(1);
    const auto = ok(assignShoe(none, run, 'auto'));
    expect(auto.assignments).toEqual([]);
    expect(shoeForActivity(auto, run).source).toBe('default');
  });

  it('Strecke findet die Wahl ihres verknüpften Eintrags (Schlüssel wechselt)', () => {
    const chosen = ok(assignShoe(base, run, B));
    const asRoute = activity(1, '2026-09-10', 12, {
      key: `route:${C}`,
      source: 'route',
      routeId: C,
      logId: id(1),
    });
    expect(shoeForActivity(chosen, asRoute).shoe?.id).toBe(B);
    // Neue Wahl an der Strecke ersetzt die alte am Eintrag.
    const again = ok(assignShoe(chosen, asRoute, A));
    expect(again.assignments).toEqual([{ activity_key: `route:${C}`, shoe_id: A }]);
  });

  it('unbekannter Schuh → not_found', () => {
    expect(assignShoe(base, run, C)).toEqual({ ok: false, error: 'not_found' });
  });

  it('Gehen in Laufschuhen erlaubt, Rad nur Radschuhe', () => {
    expect(shoeSportsFor('walk')).toEqual(['run', 'walk']);
    expect(shoeSportsFor('bike')).toEqual(['bike']);
    expect(shoeSportsFor('swim')).toEqual([]);
  });
});

describe('Ausmustern und Löschen', () => {
  const data = ok(saveShoe(EMPTY_SHOE_DATA, draft()));

  it('ausgemustert: danach nichts mehr automatisch, Standard endet', () => {
    const retired = ok(retireShoe(data, A, '2026-10-10'));
    expect(retired.shoes[0]!.retired_on).toBe('2026-10-10');
    expect(defaultShoeOn(retired, 'run', '2026-10-11')).toBeNull();
    expect(shoeForActivity(retired, activity(1, '2026-10-10', 5)).shoe?.id).toBe(A);
    expect(shoeForActivity(retired, activity(2, '2026-10-11', 5)).shoe).toBeNull();
    const m = shoeMileage(retired, [activity(1, '2026-10-10', 5)], '2026-10-25');
    expect(m[0]).toMatchObject({ retired: true, isDefault: false, km: 5 });
    // Wieder aktivieren.
    const back = ok(retireShoe(retired, A, null));
    expect(back.shoes[0]!.retired_on).toBeNull();
  });

  it('Ausmustern vor „In Gebrauch seit“ → auf den ersten Tag gesetzt', () => {
    expect(ok(retireShoe(data, A, '2026-01-01')).shoes[0]!.retired_on).toBe('2026-09-01');
  });

  it('Löschen: Wahl je Lauf weg, Standard wird „kein Standard“', () => {
    const assigned = ok(assignShoe(data, activity(1, '2026-09-10', 1), A));
    const deleted = ok(deleteShoe(assigned, A));
    expect(deleted).toEqual({
      shoes: [],
      defaults: [{ sport: 'run', valid_from: '2026-09-01', shoe_id: null }],
      assignments: [],
    });
    expect(deleteShoe(deleted, A)).toEqual({ ok: false, error: 'not_found' });
    expect(retireShoe(deleted, A, null)).toEqual({ ok: false, error: 'not_found' });
  });

  it('Sportart geändert: alter Standard gilt nicht mehr', () => {
    const walk = ok(saveShoe(data, draft({ sport: 'walk', makeDefault: false })));
    expect(defaultShoeOn(walk, 'run', '2026-10-01')).toBeNull();
    expect(shoeDataSchema.safeParse(walk).success).toBe(true);
  });
});

describe('Prüfung und Grenzen', () => {
  it('höchstens 30 Schuhe', () => {
    let data: ShoeData = EMPTY_SHOE_DATA;
    for (let i = 1; i <= SHOE_MILEAGE.maxShoes; i += 1) {
      data = ok(saveShoe(data, draft({ id: id(i), name: `Schuh ${i}`, makeDefault: false })));
    }
    expect(saveShoe(data, draft({ id: id(99), makeDefault: false }))).toEqual({
      ok: false,
      error: 'too_many',
    });
  });

  it('Name, Marke, km und Grenze werden geprüft', () => {
    expect(saveShoe(EMPTY_SHOE_DATA, draft({ name: '  ' })).ok).toBe(false);
    expect(saveShoe(EMPTY_SHOE_DATA, draft({ name: 'x'.repeat(41) })).ok).toBe(false);
    expect(saveShoe(EMPTY_SHOE_DATA, draft({ startKm: -1 })).ok).toBe(false);
    expect(saveShoe(EMPTY_SHOE_DATA, draft({ startKm: 5001 })).ok).toBe(false);
    expect(saveShoe(EMPTY_SHOE_DATA, draft({ startKm: 5000 })).ok).toBe(true);
    expect(saveShoe(EMPTY_SHOE_DATA, draft({ replaceKm: 199 })).ok).toBe(false);
    expect(saveShoe(EMPTY_SHOE_DATA, draft({ replaceKm: 2000 })).ok).toBe(true);
    // Leere Marke = keine Marke.
    expect(ok(saveShoe(EMPTY_SHOE_DATA, draft({ brand: ' ' }))).shoes[0]!.brand).toBeNull();
  });

  it('Standard nur mit Schuh derselben Sportart', () => {
    const data = ok(saveShoe(EMPTY_SHOE_DATA, draft({ makeDefault: false })));
    expect(setDefaultShoe(data, 'bike', A, '2026-10-01').ok).toBe(false);
    expect(setDefaultShoe(data, 'run', A, '2026-10-01').ok).toBe(true);
  });

  it('parseShoeData: ungültig → null; Wahl auf unbekannten Schuh ungültig', () => {
    expect(parseShoeData({ shoes: [], defaults: [], assignments: [] })).toEqual(EMPTY_SHOE_DATA);
    expect(parseShoeData({ shoes: 'x' })).toBeNull();
    expect(
      parseShoeData({
        shoes: [],
        defaults: [],
        assignments: [{ activity_key: `log:${A}`, shoe_id: B }],
      }),
    ).toBeNull();
    expect(
      parseShoeData({
        shoes: [],
        defaults: [],
        assignments: [{ activity_key: 'x:1', shoe_id: null }],
      }),
    ).toBeNull();
  });

  it('Beginn der Historie = frühester Tag', () => {
    expect(shoeHistoryStart(EMPTY_SHOE_DATA)).toBeNull();
    const data = ok(
      saveShoe(
        ok(saveShoe(EMPTY_SHOE_DATA, draft())),
        draft({ id: B, inUseSince: '2026-03-01', makeDefault: false }),
      ),
    );
    expect(shoeHistoryStart(data)).toBe('2026-03-01');
  });
});
