import { describe, expect, it } from 'vitest';

import { HIKING_SAFETY, HIKING_TIME, TRACKED_ROUTE_LIMITS, TRAINING_MET } from '../constants';
import { WALK_KINDS } from '../enums';
import { sessionCalories, sessionCaloriesInputForLog } from '../log/session-calories';
import { metForSession } from '../nutrition/energy';
import { summarizeTrack, toTrackedRoutePayload, trackedRouteSchema } from '../routes/schema';
import { line } from '../routes/test-helpers';
import { isHighLegLoadLog, legLoadHints, type LegLoadSportLog } from '../sports/leg-load';
import { mapExerciseType, sportForExerciseType } from '../wearables/exercise-types';
import { summarizeWatchRoute, wearableRoutePayload } from '../wearables/route';
import {
  elevationFromProfile,
  elevationLoss,
  emergencyNumbersFor,
  HIKING_SAFETY_DE,
  hikingElevationOfSegments,
  hikingSafetyNotices,
  type HikingSafetyInput,
  hikingTimeEstimate,
  isHikeKind,
  maxAltitude,
  sacGradeToStore,
  sacGuidance,
  walkKindName,
  walkKindToStore,
} from './index';

/** Sportarten Stufe 1 · Etappe W (docs/PLAN-SPORTARTEN-STUFE-1.md 2.2, 5, 9 W1). */

/** Hin auf 300 Hm, wieder hinunter: 1,2 m/s, 1 Punkt je Sekunde, 0,5 m Höhe je Punkt. */
const upAndDown = (base = 1000) =>
  line({
    speedMps: 1.2,
    count: 1201,
    altitude: (i) => (i <= 600 ? base + i * 0.5 : base + 300 - (i - 600) * 0.5),
  });

describe('Abstieg und höchster Punkt aus der Spur', () => {
  it('Auf und Ab: Abstieg ≈ Anstieg, höchster Punkt geglättet', () => {
    const points = upAndDown();
    const loss = elevationLoss(points, 'walk');
    expect(loss).not.toBeNull();
    expect(Math.abs((loss as number) - 300)).toBeLessThanOrEqual(2);
    expect(maxAltitude(points)).toBeGreaterThanOrEqual(1298);
    expect(maxAltitude(points)).toBeLessThanOrEqual(1300);
  });

  it('nur bergauf → Abstieg 0; Rauschen unter der Schwelle zählt nicht', () => {
    const up = line({ speedMps: 1.2, count: 300, altitude: (i) => 500 + i * 0.5 });
    expect(elevationLoss(up, 'walk')).toBe(0);
    const noise = line({
      speedMps: 1.2,
      count: 300,
      altitude: (i) => 500 + (i % 2 === 0 ? 1 : -1),
    });
    expect(elevationLoss(noise, 'walk')).toBe(0);
  });

  it('ohne Höhen → null; einzelner Punkt mit Höhe → null', () => {
    const flat = line({ speedMps: 1.2, count: 100 });
    expect(elevationLoss(flat, 'walk')).toBeNull();
    expect(maxAltitude(flat)).toBeNull();
    expect(
      maxAltitude(line({ speedMps: 1, count: 5, altitude: (i) => (i === 0 ? 10 : null) })),
    ).toBeNull();
  });

  it('Teilstücke: Abstieg summiert, Maximum über alle; außerhalb der Grenzen → null', () => {
    const a = upAndDown(1000);
    const b = upAndDown(2000);
    const both = hikingElevationOfSegments([a, b], 'walk');
    expect(Math.abs((both.elevationLossM as number) - 600)).toBeLessThanOrEqual(4);
    expect(both.maxAltitudeM).toBeGreaterThanOrEqual(2298);
    const tooHigh = line({ speedMps: 1, count: 10, altitude: () => 9500 });
    expect(hikingElevationOfSegments([tooHigh], 'walk').maxAltitudeM).toBeNull();
    const deep = line({ speedMps: 1, count: 10, altitude: () => -600 });
    expect(hikingElevationOfSegments([deep], 'walk').maxAltitudeM).toBeNull();
  });

  it('aus dem Höhenprofil (ältere Strecken)', () => {
    expect(elevationFromProfile(null)).toBeNull();
    expect(elevationFromProfile([[0, 1000]])).toBeNull();
    expect(
      elevationFromProfile([
        [0, 10000],
        [1000, 13000],
        [2000, 12000],
        [3000, 11000],
      ]),
    ).toEqual({ gainM: 300, lossM: 200, maxM: 1300 });
  });
});

describe('Aufzeichnung → save_tracked_route (nur Gehen bekommt die neuen Felder)', () => {
  const details = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Hausberg',
    difficulty: null,
    isFavorite: false,
    note: null,
    baseRouteId: null,
    sessionLogId: null,
    source: 'recorded' as const,
  };

  it('Bergwanderung: walk_kind, SAC, Abstieg, höchster Punkt; Schema gültig', () => {
    const summary = summarizeTrack(upAndDown(), 'walk');
    expect(summary.elevationLossM).not.toBeNull();
    const payload = toTrackedRoutePayload(summary, {
      ...details,
      walkKind: 'mountain_hike',
      sacGrade: 2,
    });
    expect(payload).not.toBeNull();
    expect(payload?.walk_kind).toBe('mountain_hike');
    expect(payload?.sac_grade).toBe(2);
    expect(payload?.elevation_loss_m).toBe(summary.elevationLossM);
    expect(payload?.max_altitude_m).toBe(summary.maxAltitudeM);
    expect(trackedRouteSchema.safeParse(payload).success).toBe(true);
  });

  it('Gehen: kein walk_kind, keine SAC-Stufe (auch wenn gewählt); T4+ wird nicht gespeichert', () => {
    const summary = summarizeTrack(upAndDown(), 'walk');
    const walk = toTrackedRoutePayload(summary, { ...details, walkKind: 'walk', sacGrade: 2 });
    expect(walk && 'walk_kind' in walk).toBe(false);
    expect(walk && 'sac_grade' in walk).toBe(false);
    const t4 = toTrackedRoutePayload(summary, { ...details, walkKind: 'hike', sacGrade: 4 });
    expect(t4?.walk_kind).toBe('hike');
    expect(t4 && 'sac_grade' in t4).toBe(false);
  });

  it('Lauf und Rad bleiben ohne neue Felder (byte-gleich wie vorher)', () => {
    for (const sport of ['run', 'bike'] as const) {
      const summary = summarizeTrack(
        line({ speedMps: sport === 'run' ? 3 : 6, count: 600, altitude: (i) => 100 + (i % 200) }),
        sport,
      );
      const payload = toTrackedRoutePayload(summary, { ...details, walkKind: 'hike', sacGrade: 1 });
      expect(payload).not.toBeNull();
      for (const key of ['walk_kind', 'sac_grade', 'elevation_loss_m', 'max_altitude_m']) {
        expect(payload && key in payload, `${sport} ${key}`).toBe(false);
      }
    }
  });
});

describe('Gehzeit-Schätzung (DIN 33466 / DAV)', () => {
  it('größerer Wert + halber kleinerer, gerundet auf 5 min', () => {
    // 12 km → 180 min; 900 Hm auf → 180 min, 900 Hm ab → 108 min; vertikal 288 → 288 + 90 = 378 → 380.
    expect(hikingTimeEstimate({ distanceM: 12_000, gainM: 900, lossM: 900 })).toEqual({
      minutes: 380,
      horizontalMin: 180,
      verticalMin: 288,
      withoutElevation: false,
    });
    // Flach 8 km → 120 min.
    expect(hikingTimeEstimate({ distanceM: 8000, gainM: 0, lossM: 0 })?.minutes).toBe(120);
  });

  it('ohne Höhen nur horizontal; Steilaufstieg: vertikal führt', () => {
    expect(hikingTimeEstimate({ distanceM: 4000, gainM: null, lossM: null })).toMatchObject({
      minutes: 60,
      withoutElevation: true,
    });
    // 2 km, 1000 Hm auf: vertikal 200, horizontal 30 → 215.
    expect(hikingTimeEstimate({ distanceM: 2000, gainM: 1000, lossM: 0 })?.minutes).toBe(215);
  });

  it('zu kurz, ungültig, negativ → null bzw. ignoriert; mindestens ein Rundungsschritt', () => {
    expect(
      hikingTimeEstimate({ distanceM: HIKING_TIME.minDistanceM - 1, gainM: 0, lossM: 0 }),
    ).toBeNull();
    expect(hikingTimeEstimate({ distanceM: Number.NaN, gainM: 0, lossM: 0 })).toBeNull();
    expect(hikingTimeEstimate({ distanceM: 500, gainM: -50, lossM: null })?.minutes).toBe(
      HIKING_TIME.roundToMin * 2,
    );
    expect(
      hikingTimeEstimate({ distanceM: 500, gainM: 0, lossM: 0 })?.minutes,
    ).toBeGreaterThanOrEqual(HIKING_TIME.roundToMin);
  });
});

describe('walk_kind und SAC-Skala', () => {
  it('Namen wie der Server, null = Gehen', () => {
    expect(walkKindName(null)).toBe('Spaziergang');
    expect(walkKindName('hike')).toBe('Wanderung');
    expect(walkKindName('mountain_hike')).toBe('Bergwanderung');
    expect(WALK_KINDS.filter(isHikeKind)).toEqual(['hike', 'mountain_hike']);
  });

  it('nur beim Gehen gespeichert; Gehen → null', () => {
    expect(walkKindToStore('walk', 'hike')).toBe('hike');
    expect(walkKindToStore('walk', 'walk')).toBeNull();
    expect(walkKindToStore('run', 'hike')).toBeNull();
  });

  it('T1–T3 begleitet, T4+ nur Hinweis (nie gespeichert)', () => {
    expect([1, 2, 3].map(sacGuidance)).toEqual(['accompanied', 'accompanied', 'accompanied']);
    expect([4, 5, 6].map(sacGuidance)).toEqual(['outside_app', 'outside_app', 'outside_app']);
    expect(sacGradeToStore('hike', 3)).toBe(3);
    expect(sacGradeToStore('hike', 4)).toBeNull();
    expect(sacGradeToStore('walk', 1)).toBeNull();
    expect(sacGradeToStore('mountain_hike', 0)).toBeNull();
    expect(sacGradeToStore('mountain_hike', 2.5)).toBeNull();
    expect(sacGradeToStore('mountain_hike', null)).toBeNull();
  });
});

describe('Bergwander-Hinweise (nie blockierend)', () => {
  const base: HikingSafetyInput = {
    phase: 'before',
    walkKind: 'mountain_hike',
    maxAltitudeM: null,
    elevationLossM: null,
    sacGrade: null,
    painRegions: [],
    medicalClearance: false,
    pregnancy: false,
  };

  it('vor dem Start Bergwandern: Wetter, Umkehrzeit, Höhe, Abstieg, Live-Begleitung, Notruf, Akku, Trinken', () => {
    expect(hikingSafetyNotices(base)).toEqual([
      'weather',
      'turnaround',
      'altitude',
      'descent',
      'live_companion',
      'emergency',
      'battery',
      'drink',
    ]);
  });

  it('Gehen → keine Karte; Wandern vor dem Start ohne Bergkarte', () => {
    expect(hikingSafetyNotices({ ...base, walkKind: 'walk' })).toEqual([]);
    expect(hikingSafetyNotices({ ...base, walkKind: null })).toEqual([]);
    expect(hikingSafetyNotices({ ...base, walkKind: 'hike' })).toEqual([]);
  });

  it('Auswertung: Höhe erst ab 2.500 m, Abstieg ab 600 Hm', () => {
    const after = { ...base, phase: 'after' as const };
    expect(hikingSafetyNotices({ ...after, maxAltitudeM: 2499, elevationLossM: 599 })).toEqual([]);
    expect(
      hikingSafetyNotices({
        ...after,
        walkKind: 'hike',
        maxAltitudeM: HIKING_SAFETY.altitudeHintM,
        elevationLossM: HIKING_SAFETY.descentHintM,
      }),
    ).toEqual(['altitude', 'descent']);
  });

  it('Arzt-Hinweis und Schwangerschaft: „über 2.500 m vorher ärztlich besprechen“, keine Sperre', () => {
    for (const flags of [{ medicalClearance: true }, { pregnancy: true }]) {
      expect(hikingSafetyNotices({ ...base, ...flags })[0]).toBe('doctor');
      expect(
        hikingSafetyNotices({ ...base, ...flags, phase: 'after', maxAltitudeM: 2600 }),
      ).toEqual(['doctor', 'altitude']);
      expect(
        hikingSafetyNotices({ ...base, ...flags, phase: 'after', maxAltitudeM: 1800 }),
      ).toEqual([]);
    }
    expect(HIKING_SAFETY_DE.notices.doctor).toContain('2.500 m');
  });

  it('Schon-Modus Knie/Sprunggelenk: Zusatz-Hinweis; andere Regionen nicht', () => {
    for (const region of ['knee', 'ankle'] as const) {
      expect(
        hikingSafetyNotices({ ...base, phase: 'after', walkKind: 'hike', painRegions: [region] }),
      ).toEqual(['pain_joints']);
    }
    expect(
      hikingSafetyNotices({ ...base, phase: 'after', walkKind: 'hike', painRegions: ['shoulder'] }),
    ).toEqual([]);
  });

  it('T4+ → Hinweis „außerhalb dessen, was die App begleitet“ zuerst', () => {
    expect(hikingSafetyNotices({ ...base, sacGrade: 4 })[0]).toBe('sac_outside');
    expect(hikingSafetyNotices({ ...base, sacGrade: 3 })).not.toContain('sac_outside');
    expect(HIKING_SAFETY_DE.notices.sac_outside).toContain(
      'außerhalb dessen, was die App begleitet',
    );
  });

  it('Notrufnummern je Land, eigenes Land zuerst', () => {
    const at = emergencyNumbersFor('de-AT');
    expect(at.map((c) => c.country)).toEqual(['AT', 'DE', 'CH', 'IT']);
    expect(at[0]?.numbers.map((n) => n.number)).toEqual(['140', '112']);
    const ch = emergencyNumbersFor('de-CH');
    expect(ch[0]?.numbers.map((n) => n.number)).toEqual(['1414', '144', '112']);
    expect(emergencyNumbersFor(null).map((c) => c.country)).toEqual(['DE', 'AT', 'CH', 'IT']);
    const it_ = emergencyNumbersFor('de-DE').find((c) => c.country === 'IT');
    expect(it_?.numbers.map((n) => n.number)).toEqual(['118', '112']);
  });

  it('Texte ohne Heilversprechen', () => {
    const all = JSON.stringify(HIKING_SAFETY_DE);
    expect(all).not.toMatch(/heilt|garantiert|verhindert sicher/i);
  });
});

describe('kcal: MET Wandern/Bergwandern, Uhr-Wert vorrangig', () => {
  it('metForSession nach Art (nur bei Gehen)', () => {
    const walk = {
      kind: 'endurance' as const,
      enduranceModality: 'walk' as const,
      effortTarget: null,
    };
    expect(metForSession(walk)).toBe(TRAINING_MET.endurance.walk.fallback);
    expect(metForSession({ ...walk, walkKind: 'hike' })).toBe(TRAINING_MET.hike.fallback);
    expect(metForSession({ ...walk, walkKind: 'mountain_hike' })).toBe(
      TRAINING_MET.mountainHike.fallback,
    );
    expect(metForSession({ ...walk, enduranceModality: 'run', walkKind: 'hike' })).toBe(
      TRAINING_MET.endurance.run.fallback,
    );
  });

  it('Schätzung sehr leicht/schwer, Uhr geht vor; kein Höhenmeter-Zuschlag', () => {
    const input = {
      kind: 'endurance' as const,
      enduranceModality: 'walk' as const,
      effortTarget: null,
      durationS: 3 * 3600,
      measuredKcal: null,
      walkKind: 'mountain_hike' as const,
    };
    const light = sessionCalories({ ...input, bodyWeightKg: 40 });
    const heavy = sessionCalories({ ...input, bodyWeightKg: 200 });
    expect(light.kcal).toBe(Math.round((7.8 * 40 * 3) / 5) * 5);
    expect(heavy.kcal).toBe(Math.round((7.8 * 200 * 3) / 5) * 5);
    expect(sessionCalories({ ...input, bodyWeightKg: 70, measuredKcal: 1234 })).toMatchObject({
      source: 'watch',
      kcal: 1235,
    });
  });

  it('Tagebuch-Eintrag: walk_kind des Ausdauer-Teils', () => {
    const log = {
      log: { kind: 'endurance' as const, started_at: null, finished_at: null },
      cardio: { modality: 'walk' as const, duration_s: 7200, walk_kind: 'hike' as const },
      planned: null,
    };
    expect(sessionCaloriesInputForLog(log).walkKind).toBe('hike');
    expect(
      'walkKind' in
        sessionCaloriesInputForLog({ ...log, cardio: { ...log.cardio, walk_kind: null } }),
    ).toBe(false);
  });
});

describe('Bein-Hinweis am Folgetag (LEG_LOAD_HINT, Stufe 2) für Wanderungen', () => {
  const hike = (extra: Partial<LegLoadSportLog>): LegLoadSportLog => ({
    id: 'h1',
    performed_on: '2026-10-26',
    sport: null,
    durationS: 60 * 60,
    effort: null,
    walkKind: 'hike',
    elevationLossM: null,
    ...extra,
  });

  it('ab 120 min oder 600 Hm Abstieg – nicht beim Spaziergang', () => {
    expect(isHighLegLoadLog(hike({ durationS: 119 * 60 }))).toBe(false);
    expect(isHighLegLoadLog(hike({ durationS: 120 * 60 }))).toBe(true);
    expect(isHighLegLoadLog(hike({ elevationLossM: 599 }))).toBe(false);
    expect(isHighLegLoadLog(hike({ elevationLossM: 600 }))).toBe(true);
    expect(isHighLegLoadLog(hike({ walkKind: 'mountain_hike', elevationLossM: 800 }))).toBe(true);
    expect(isHighLegLoadLog(hike({ walkKind: 'walk', durationS: 300 * 60 }))).toBe(false);
    expect(isHighLegLoadLog(hike({ walkKind: null, durationS: 300 * 60 }))).toBe(false);
    expect(isHighLegLoadLog(hike({ durationS: null }))).toBe(false);
  });

  it('Hinweis an der harten Einheit am Folgetag mit Quelle „hike“', () => {
    const hints = legLoadHints({
      today: '2026-10-27',
      logs: [hike({ durationS: 150 * 60 })],
      sessions: [
        {
          id: 's1',
          scheduled_on: '2026-10-27',
          status: 'planned',
          kind: 'strength',
          focus: 'lower',
          endurance_modality: null,
          effort_target: null,
        },
      ],
    });
    expect(hints).toEqual([
      {
        sessionId: 's1',
        sessionDate: '2026-10-27',
        reason: 'strength_legs',
        sport: 'hike',
        sportDate: '2026-10-26',
        sportLogId: 'h1',
      },
    ]);
  });
});

describe('Uhr: Health Connect 37/63 → Gehen mit walk_kind', () => {
  it('37 Wandern → Wanderung, 63 Schneeschuhwandern → Bergwanderung, 79 Gehen unverändert', () => {
    expect(mapExerciseType(37)).toEqual({ group: 'walk', nameDe: 'Wanderung', walkKind: 'hike' });
    expect(mapExerciseType(63)).toEqual({
      group: 'walk',
      nameDe: 'Bergwanderung',
      walkKind: 'mountain_hike',
    });
    expect(mapExerciseType(79)).toEqual({ group: 'walk', nameDe: 'Spaziergang' });
    expect(sportForExerciseType(37)).toBeNull();
    expect(sportForExerciseType(63)).toBeNull();
  });

  it('Uhr-Route beim Gehen mit Abstieg/höchstem Punkt; Lauf ohne', () => {
    const points = upAndDown().map((p) => ({
      time: new Date(p.t).toISOString(),
      latitude: p.lat,
      longitude: p.lng,
      altitudeM: p.altitudeM ?? null,
      accuracyM: 4,
    }));
    const window = { startedAt: points[0]!.time, finishedAt: points.at(-1)!.time };
    const walk = summarizeWatchRoute(points, 'walk', window);
    expect(walk.kind).toBe('ok');
    if (walk.kind !== 'ok') return;
    const payload = wearableRoutePayload('x1', walk.summary);
    expect(payload?.elevation_loss_m).toBeGreaterThan(290);
    expect(payload?.max_altitude_m).toBeGreaterThanOrEqual(1298);
    expect((payload?.max_altitude_m ?? 0) <= TRACKED_ROUTE_LIMITS.maxAltitudeM.max).toBe(true);
    const run = summarizeWatchRoute(
      points.map((p, i) => ({
        ...p,
        time: new Date(Date.parse(window.startedAt) + i * 400).toISOString(),
      })),
      'run',
      {
        startedAt: window.startedAt,
        finishedAt: new Date(Date.parse(window.startedAt) + 1200 * 400).toISOString(),
      },
    );
    if (run.kind === 'ok') {
      const runPayload = wearableRoutePayload('x2', run.summary);
      expect(runPayload && 'elevation_loss_m' in runPayload).toBe(false);
    }
  });
});
