import { describe, expect, it } from 'vitest';

import { ROUTE_MATCH } from '../constants';
import {
  autoMatchRoutes,
  type AutoMatchRow,
  bboxesOverlap,
  discreteFrechetM,
  matchDistanceOk,
  matchRoute,
  rankMatches,
  resampleTrack,
  routeChoices,
} from './match';
import { boundingBox, encodePolyline, type LatLng } from './polyline';
import { offset, START } from './test-helpers';
import { haversineM, trackDistance } from './track';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

/** Linie durch Wegpunkte (Meter nord/ost ab `origin`), alle ~`stepM` Meter ein Punkt. */
function path(
  corners: readonly [number, number][],
  stepM = 10,
  origin: LatLng = START,
  jitter?: (i: number) => [number, number],
): LatLng[] {
  const out: LatLng[] = [];
  for (let k = 1; k < corners.length; k += 1) {
    const [n0, e0] = corners[k - 1] as [number, number];
    const [n1, e1] = corners[k] as [number, number];
    const len = Math.hypot(n1 - n0, e1 - e0);
    const steps = Math.max(1, Math.round(len / stepM));
    for (let s = k === 1 ? 0 : 1; s <= steps; s += 1) {
      const f = s / steps;
      const [jn, je] = jitter ? jitter(out.length) : [0, 0];
      out.push(offset(origin, n0 + (n1 - n0) * f + jn, e0 + (e1 - e0) * f + je));
    }
  }
  return out;
}

/** Rechteck-Runde 1.300 × 1.300 m (5,2 km), Start/Ziel unten links, im Uhrzeigersinn (Norden zuerst). */
const LOOP: [number, number][] = [
  [0, 0],
  [1300, 0],
  [1300, 1300],
  [0, 1300],
  [0, 0],
];

let n = 0;
function row(points: readonly LatLng[], changes: Partial<AutoMatchRow> = {}): AutoMatchRow {
  n += 1;
  return {
    id: `r${String(n).padStart(3, '0')}`,
    user_id: ME,
    sport: 'run',
    distance_m: Math.round(trackDistance(points)),
    polyline: encodePolyline(points),
    bbox: [...(boundingBox(points) ?? [0, 0, 0, 0])],
    is_favorite: false,
    auto_match: true,
    started_at: `2026-10-${String(10 + (n % 15)).padStart(2, '0')}T07:00:00Z`,
    match_rejected_ids: [],
    route_match: null,
    base_route_id: null,
    ...changes,
  };
}

const fav = (points: readonly LatLng[], changes: Partial<AutoMatchRow> = {}) =>
  row(points, { is_favorite: true, ...changes });

/** Deterministisches GPS-Rauschen ±amp Meter. */
const noise =
  (amp: number) =>
  (i: number): [number, number] => [Math.sin(i * 12.9898) * amp, Math.cos(i * 78.233) * amp];

describe('resampleTrack', () => {
  it('gleichmäßige Abstände, Anfang und Ende bleiben, höchstens maxPoints', () => {
    const line = path([
      [0, 0],
      [1000, 0],
    ]);
    const r = resampleTrack(line, 25, 200);
    expect(r).toHaveLength(41);
    expect(haversineM(r[0] as LatLng, line[0] as LatLng)).toBeLessThan(0.01);
    expect(haversineM(r.at(-1) as LatLng, line.at(-1) as LatLng)).toBeLessThan(0.01);
    expect(haversineM(r[1] as LatLng, r[2] as LatLng)).toBeCloseTo(25, 0);
    const long = path([
      [0, 0],
      [20_000, 0],
    ]);
    expect(resampleTrack(long).length).toBeLessThanOrEqual(ROUTE_MATCH.maxPoints);
  });

  it('Grenzfälle: 1 Punkt, 2 gleiche Punkte', () => {
    expect(resampleTrack([START])).toEqual([START]);
    expect(resampleTrack([START, START])).toHaveLength(2);
  });

  it('über die Datumsgrenze (±180°) wird nicht um die Erde interpoliert', () => {
    const a = { lat: -16.5, lng: 179.999 };
    const b = { lat: -16.5, lng: -179.999 };
    const r = resampleTrack([a, b], 25, 200);
    expect(r.length).toBeGreaterThan(2);
    for (const p of r) expect(Math.abs(p.lng)).toBeGreaterThan(179.99);
  });
});

describe('discreteFrechetM', () => {
  it('identische Linie = 0, parallel versetzt = Versatz, leer = Infinity', () => {
    const a = resampleTrack(
      path([
        [0, 0],
        [1000, 0],
      ]),
    );
    expect(discreteFrechetM(a, a)).toBe(0);
    const b = resampleTrack(
      path([
        [0, 40],
        [1000, 40],
      ]),
    );
    expect(discreteFrechetM(a, b)).toBeCloseTo(40, 0);
    expect(discreteFrechetM(a, [])).toBe(Infinity);
  });
});

describe('matchDistanceOk / bboxesOverlap', () => {
  it('Distanz ±10 % gilt, ±11 % nicht', () => {
    expect(matchDistanceOk(5500, 5000)).toBe(true);
    expect(matchDistanceOk(4500, 5000)).toBe(true);
    expect(matchDistanceOk(5550, 5000)).toBe(false);
    expect(matchDistanceOk(4450, 5000)).toBe(false);
    expect(matchDistanceOk(0, 5000)).toBe(false);
    expect(matchDistanceOk(100, 0)).toBe(false);
  });

  it('Rahmen weit auseinander überlappen nicht; ungültige Rahmen sind kein Ausschluss', () => {
    const a = [50.9, 6.9, 50.95, 6.95];
    expect(bboxesOverlap(a, [48.1, 11.5, 48.2, 11.6])).toBe(false);
    expect(bboxesOverlap(a, [50.951, 6.951, 51, 7])).toBe(true);
    expect(bboxesOverlap(a, [])).toBe(true);
  });
});

describe('matchRoute', () => {
  const loop = path(LOOP);
  const favorite = fav(loop);

  it('dieselbe Runde mit GPS-Rauschen (±8 m) passt', () => {
    // distance_m kommt in echt aus der geglätteten Bewegung (Rauschen verlängert die Linie nicht).
    const today = row(path(LOOP, 10, START, noise(8)), { distance_m: favorite.distance_m });
    const m = matchRoute(today, [favorite]);
    expect(m?.favoriteId).toBe(favorite.id);
    expect(m?.frechetM).toBeLessThanOrEqual(20);
  });

  it('identische Linie: Abstand 0', () => {
    expect(matchRoute(row(loop), [favorite])).toEqual({ favoriteId: favorite.id, frechetM: 0 });
  });

  it('parallel versetzt 55 m passt, 65 m nicht (Grenze frechetMaxM = 60)', () => {
    const shifted = (m: number) => loop.map((p) => offset(p, 0, m));
    expect(matchRoute(row(shifted(55)), [favorite])?.favoriteId).toBe(favorite.id);
    expect(matchRoute(row(shifted(65)), [favorite])).toBeNull();
  });

  it('Abzweigung 300 m (andere Ecke, gleiche Länge) passt nicht', () => {
    const detour = path([
      [0, 0],
      [1300, 0],
      [1300, 1000],
      [1000, 1300],
      [300, 1300],
      [0, 1300],
      [0, 0],
    ]);
    expect(matchDistanceOk(trackDistance(detour), favorite.distance_m)).toBe(true);
    expect(matchRoute(row(detour), [favorite])).toBeNull();
  });

  it('Start 140 m daneben passt, 160 m nicht (Uhr startet GPS verspätet)', () => {
    const late = (m: number) =>
      path([
        [m, 0],
        [1300, 0],
        [1300, 1300],
        [0, 1300],
        [0, 0],
      ]);
    expect(matchRoute(row(late(140)), [favorite])?.favoriteId).toBe(favorite.id);
    expect(matchRoute(row(late(160)), [favorite])).toBeNull();
  });

  it('andersherum gelaufen = eigene Strecke (Gründer-Entscheidung 2)', () => {
    expect(matchRoute(row([...loop].reverse()), [favorite])).toBeNull();
    // Auch eine schmale Runde (Hinweg und Rückweg 50 m auseinander), wo die Linie selbst noch nah genug wäre.
    const narrow = path([
      [0, 0],
      [2500, 0],
      [2500, 50],
      [0, 50],
      [0, 0],
    ]);
    const nf = fav(narrow);
    expect(matchRoute(row(narrow), [nf])?.favoriteId).toBe(nf.id);
    expect(matchRoute(row([...narrow].reverse()), [nf])).toBeNull();
  });

  it('hin und zurück auf demselben Weg bleibt gleich (beide Richtungen gleich gut)', () => {
    const outBack = path([
      [0, 0],
      [5000, 0],
      [0, 0],
    ]);
    const of = fav(outBack);
    const today = row(
      path(
        [
          [0, 0],
          [5000, 0],
          [0, 0],
        ],
        10,
        START,
        noise(6),
      ),
      {
        distance_m: of.distance_m,
      },
    );
    expect(matchRoute(today, [of])?.favoriteId).toBe(of.id);
  });

  it('Rundkurs mit anderem Startpunkt passt (noch) nicht (Gründer-Entscheidung 3)', () => {
    const otherStart = path([
      [1300, 0],
      [1300, 1300],
      [0, 1300],
      [0, 0],
      [1300, 0],
    ]);
    expect(matchRoute(row(otherStart), [favorite])).toBeNull();
  });

  it('Achter-Strecke: gleiche Reihenfolge passt, andere Reihenfolge der Schleifen nicht', () => {
    const eight: [number, number][] = [
      [0, 0],
      [600, 600],
      [1200, 0],
      [600, -600],
      [0, 0],
      [-600, 600],
      [-1200, 0],
      [-600, -600],
      [0, 0],
    ];
    const ef = fav(path(eight));
    expect(
      matchRoute(row(path(eight, 10, START, noise(5)), { distance_m: ef.distance_m }), [ef])
        ?.favoriteId,
    ).toBe(ef.id);
    const swapped: [number, number][] = [
      [0, 0],
      [-600, 600],
      [-1200, 0],
      [-600, -600],
      [0, 0],
      [600, 600],
      [1200, 0],
      [600, -600],
      [0, 0],
    ];
    expect(matchRoute(row(path(swapped)), [ef])).toBeNull();
  });

  it('Distanz +11 % (abgebrochen/verlängert) und kurzer abgebrochener Lauf passen nicht', () => {
    const aborted = path([
      [0, 0],
      [1300, 0],
      [1300, 500],
    ]);
    expect(matchRoute(row(aborted), [favorite])).toBeNull();
    expect(
      matchRoute(row(loop, { distance_m: Math.round(favorite.distance_m * 1.11) }), [favorite]),
    ).toBeNull();
    expect(
      matchRoute(row(loop, { distance_m: Math.round(favorite.distance_m * 1.09) }), [favorite]),
    ).not.toBeNull();
  });

  it('andere Sportart, andere Person, kein Favorit, abgelehnt, automatisch aus → kein Treffer', () => {
    const today = row(loop);
    expect(matchRoute({ ...today, sport: 'bike' }, [favorite])).toBeNull();
    expect(matchRoute(today, [{ ...favorite, user_id: OTHER }])).toBeNull();
    expect(matchRoute(today, [{ ...favorite, is_favorite: false }])).toBeNull();
    expect(matchRoute({ ...today, match_rejected_ids: [favorite.id] }, [favorite])).toBeNull();
    expect(matchRoute(today, [{ ...favorite, auto_match: false }])).toBeNull();
    // „Andere Strecke wählen“ darf auch Strecken ohne automatische Zuordnung zeigen.
    expect(
      matchRoute(today, [{ ...favorite, auto_match: false }], { includeManualOnly: true })
        ?.favoriteId,
    ).toBe(favorite.id);
    // Die Strecke selbst passt nie zu sich.
    expect(matchRoute(favorite, [favorite])).toBeNull();
  });

  it('ohne bzw. mit kaputter Linie: kein Treffer, kein Fehler', () => {
    expect(matchRoute(row(loop, { polyline: '' }), [favorite])).toBeNull();
    expect(matchRoute(row(loop), [{ ...favorite, polyline: '~' }])).toBeNull();
    expect(matchRoute(row([START, offset(START, 10, 0)]), [favorite])).toBeNull();
  });

  it('nur 2 Punkte: gerade Strecke passt zu gerader Strecke', () => {
    const a = [START, offset(START, 3000, 0)];
    const f = fav(
      path([
        [0, 0],
        [3000, 0],
      ]),
    );
    expect(matchRoute(row(a), [f])?.favoriteId).toBe(f.id);
  });

  it('5.000 Punkte: schnell (höchstens 200 Punkte je Linie)', () => {
    const dense = path(LOOP, 1.04, START, noise(3));
    expect(dense.length).toBeGreaterThan(4900);
    const t0 = performance.now();
    expect(
      matchRoute(row(dense, { distance_m: favorite.distance_m }), [favorite])?.favoriteId,
    ).toBe(favorite.id);
    expect(performance.now() - t0).toBeLessThan(2000);
  });

  it('zwei Kandidaten: der nähere gewinnt; Gleichstand → älteste Strecke, dann id', () => {
    const near = fav(
      loop.map((p) => offset(p, 0, 5)),
      { started_at: '2026-09-01T07:00:00Z' },
    );
    const far = fav(
      loop.map((p) => offset(p, 0, 40)),
      { started_at: '2026-08-01T07:00:00Z' },
    );
    const today = row(loop);
    expect(rankMatches(today, [far, near]).map((m) => m.favoriteId)).toEqual([near.id, far.id]);
    const twinA = fav(loop, { id: 'b-twin', started_at: '2026-09-01T07:00:00Z' });
    const twinB = fav(loop, { id: 'a-twin', started_at: '2026-09-01T07:00:00Z' });
    const older = fav(loop, { id: 'z-old', started_at: '2026-01-01T07:00:00Z' });
    expect(matchRoute(today, [twinA, twinB])?.favoriteId).toBe('a-twin');
    expect(matchRoute(today, [twinA, twinB, older])?.favoriteId).toBe('z-old');
  });

  it('Strecke weit weg (anderer Ort, gleiche Form) passt nicht', () => {
    const munich = path(LOOP, 10, { lat: 48.137, lng: 11.575 });
    expect(matchRoute(row(munich), [favorite])).toBeNull();
  });

  it('Datumsgrenze ±180°: gleiche Strecke über den Sprung passt', () => {
    const fiji = { lat: -16.6, lng: 179.995 };
    const crossing = path(
      [
        [0, 0],
        [0, 1500],
        [600, 1500],
        [600, 0],
        [0, 0],
      ],
      10,
      fiji,
    ).map((p) => ({
      lat: p.lat,
      lng: p.lng > 180 ? p.lng - 360 : p.lng,
    }));
    expect(crossing.some((p) => p.lng < 0) && crossing.some((p) => p.lng > 0)).toBe(true);
    const f = fav(crossing);
    const shifted = crossing.map((p) => {
      const q = offset(p, 5, 0);
      return { lat: q.lat, lng: q.lng > 180 ? q.lng - 360 : q.lng };
    });
    expect(matchRoute(row(shifted, { distance_m: f.distance_m }), [f])?.favoriteId).toBe(f.id);
  });

  it('Rad: 1 Fahrt vs. 30 Fahrten – jede passt zur gemerkten Fahrt', () => {
    const ride = path(
      [
        [0, 0],
        [8000, 0],
        [8000, 4000],
        [0, 0],
      ],
      20,
    );
    const bf = fav(ride, { sport: 'bike' });
    const rides = Array.from({ length: 30 }, (_, i) =>
      row(
        path(
          [
            [0, 0],
            [8000, 0],
            [8000, 4000],
            [0, 0],
          ],
          20,
          START,
          noise(4 + (i % 5)),
        ),
        {
          sport: 'bike',
          distance_m: bf.distance_m,
        },
      ),
    );
    for (const r of rides) expect(matchRoute(r, [bf])?.favoriteId).toBe(bf.id);
  });
});

describe('routeChoices', () => {
  it('nur eigene Favoriten derselben Sportart und ±10 %; passende Linie zuerst, dann nach Name', () => {
    const loop = path(LOOP);
    const a = { ...fav(loop.map((p) => offset(p, 0, 400))), name: 'Andere Runde' };
    const b = { ...fav(loop), name: 'Zuhause-Runde' };
    const c = { ...fav(loop, { sport: 'bike' }), name: 'Rad' };
    const d = {
      ...fav(
        path([
          [0, 0],
          [9000, 0],
        ]),
      ),
      name: 'Lang',
    };
    const today = row(loop);
    expect(routeChoices(today, [a, b, c, d]).map((x) => x.name)).toEqual([
      'Zuhause-Runde',
      'Andere Runde',
    ]);
  });
});

describe('autoMatchRoutes', () => {
  it('nur offene eigene Läufe, neueste zuerst; zugeordnete, abgelehnte und Favoriten bleiben', () => {
    const loop = path(LOOP);
    const f = fav(loop, { started_at: '2026-09-01T07:00:00Z' });
    const open1 = row(loop, { started_at: '2026-10-20T07:00:00Z' });
    const open2 = row(loop, { started_at: '2026-10-22T07:00:00Z' });
    const done = row(loop, { route_match: 'confirmed', base_route_id: f.id });
    const rejected = row(loop, { route_match: 'rejected', match_rejected_ids: [f.id] });
    const foreign = row(loop, { user_id: OTHER });
    const elsewhere = row(path(LOOP, 10, { lat: 48.137, lng: 11.575 }));
    const result = autoMatchRoutes(ME, [f, open1, open2, done, rejected, foreign, elsewhere]);
    expect(result.map((r) => r.routeId)).toEqual([open2.id, open1.id]);
    expect(result.every((r) => r.favoriteId === f.id)).toBe(true);
  });

  it('ohne Favoriten bzw. mit ausgeschalteter Zuordnung: nichts', () => {
    const loop = path(LOOP);
    expect(autoMatchRoutes(ME, [row(loop), row(loop)])).toEqual([]);
    expect(autoMatchRoutes(ME, [fav(loop, { auto_match: false }), row(loop)])).toEqual([]);
  });

  it(`höchstens ${ROUTE_MATCH.maxAutoPerPass} je Durchgang`, () => {
    const loop = path(LOOP);
    const many = Array.from({ length: ROUTE_MATCH.maxAutoPerPass + 5 }, () => row(loop));
    expect(autoMatchRoutes(ME, [fav(loop), ...many])).toHaveLength(ROUTE_MATCH.maxAutoPerPass);
  });
});
