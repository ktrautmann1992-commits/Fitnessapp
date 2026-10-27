import {
  elevationProfileSchema,
  GPX_IMPORT,
  type GpxImportSummary,
  type LoopRoute,
  loopRouteSchema,
  loopSurfaceSharesSchema,
  TRACKED_ROUTE_LIMITS,
  TRACKED_ROUTE_SPORTS,
  type TrackedRouteSport,
  WALK_KINDS,
  type WalkKind,
} from '@fitnessapp/core';
import { z } from 'zod';

import type { ProtectedStore } from '@/data/protected-store';

/**
 * Gemerkte Runden aus dem Rundkurs-Vorschlag (docs/PLAN-RUNDKURS.md): bleiben NUR auf diesem Gerät – App
 * verschlüsselt (eigener Schlüssel, loop-store.native.ts), Browser nur sessionStorage (loop-store.ts). Nie auf dem
 * Server, nie geteilt. Je Konto getrennt (fremdes Konto auf demselben Gerät sieht nichts). Höchstens `MAX_SAVED_LOOPS`.
 * Wird eine gemerkte Runde gelaufen und gespeichert, ist sie danach eine „Meine Strecke“ (Favorit) wie jede andere.
 * Sportarten Stufe 1 (Wandern, 27.10.2026): auch eingelesene GPX-Dateien (`source: 'gpx'`) mit Sportart, Art der
 * Geh-Einheit, Abstieg, höchstem Punkt und Höhenprofil – alle Zusatzfelder optional, ältere Einträge bleiben gültig.
 */
export const MAX_SAVED_LOOPS = 20;
export const LOOP_NAME_MAX = 60;

export const savedLoopSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{1,60}$/),
  name: z.string().trim().min(1).max(LOOP_NAME_MAX),
  polyline: loopRouteSchema.shape.polyline,
  // GPX-Touren dürfen länger sein als vorgeschlagene Runden (GPX_IMPORT.maxDistanceM ≥ Rundkurs-Grenze).
  distance_m: z.number().int().min(1).max(GPX_IMPORT.maxDistanceM),
  ascent_m: loopRouteSchema.shape.ascent_m,
  surface: loopSurfaceSharesSchema.nullable(),
  saved_at: z.iso.datetime({ offset: true }),
  /** Herkunft: fehlt = Rundkurs-Vorschlag, `gpx` = eingelesene Datei. */
  source: z.literal('gpx').optional(),
  /** Sportart zum Nachgehen/-laufen (fehlt = Laufen) und Art der Geh-Einheit (nur beim Gehen). */
  sport: z.enum(TRACKED_ROUTE_SPORTS).optional(),
  walk_kind: z.enum(WALK_KINDS).nullable().optional(),
  descent_m: z
    .number()
    .int()
    .min(TRACKED_ROUTE_LIMITS.elevationLossM.min)
    .max(TRACKED_ROUTE_LIMITS.elevationLossM.max)
    .nullable()
    .optional(),
  max_altitude_m: z
    .number()
    .int()
    .min(TRACKED_ROUTE_LIMITS.maxAltitudeM.min)
    .max(TRACKED_ROUTE_LIMITS.maxAltitudeM.max)
    .nullable()
    .optional(),
  profile: elevationProfileSchema.nullable().optional(),
});
export type SavedLoop = z.infer<typeof savedLoopSchema>;

const fileSchema = z.strictObject({
  v: z.literal(1),
  user_id: z.string().min(1).max(64),
  loops: z.array(savedLoopSchema).max(MAX_SAVED_LOOPS),
});

export interface LoopStore {
  list(userId: string): Promise<SavedLoop[]>;
  /** Neu vorne; gleiche Linie ersetzt die alte; ältere über dem Limit fallen weg. */
  save(userId: string, loop: SavedLoop): Promise<SavedLoop[]>;
  remove(userId: string, id: string): Promise<SavedLoop[]>;
}

export function createLoopStore(store: ProtectedStore): LoopStore {
  const read = async (userId: string): Promise<SavedLoop[]> => {
    try {
      const text = await store.read();
      if (!text) return [];
      const parsed = fileSchema.safeParse(JSON.parse(text));
      return parsed.success && parsed.data.user_id === userId ? parsed.data.loops : [];
    } catch {
      return [];
    }
  };
  const write = async (userId: string, loops: SavedLoop[]) => {
    await store.write(JSON.stringify({ v: 1, user_id: userId, loops }));
    return loops;
  };
  return {
    list: read,
    async save(userId, loop) {
      const valid = savedLoopSchema.parse(loop);
      const others = (await read(userId)).filter(
        (l) => l.id !== valid.id && l.polyline !== valid.polyline,
      );
      return write(userId, [valid, ...others].slice(0, MAX_SAVED_LOOPS));
    },
    async remove(userId, id) {
      return write(
        userId,
        (await read(userId)).filter((l) => l.id !== id),
      );
    },
  };
}

/** Vorgeschlagene Runde → gemerkte Runde. */
export function toSavedLoop(route: LoopRoute, name: string, id: string, now: string): SavedLoop {
  return {
    id,
    name: name.trim().slice(0, LOOP_NAME_MAX) || 'Rundkurs',
    polyline: route.polyline,
    distance_m: route.distance_m,
    ascent_m: route.ascent_m,
    surface: route.surface,
    saved_at: now,
  };
}

/** Anstieg passend zur Grenze der gemerkten Runden (größer = unbekannt). */
function ascentForStore(m: number | null): number | null {
  const max = loopRouteSchema.shape.ascent_m.unwrap().maxValue ?? Number.POSITIVE_INFINITY;
  return m !== null && m <= max ? m : null;
}

/** Eingelesene GPX-Datei → gemerkte Strecke (Name aus der Eingabe, sonst aus der Datei). */
export function toSavedGpxRoute(
  summary: GpxImportSummary,
  input: {
    readonly name: string;
    readonly sport: TrackedRouteSport;
    readonly walkKind: WalkKind | null;
    readonly id: string;
    readonly now: string;
  },
): SavedLoop {
  return {
    id: input.id,
    name: input.name.trim().slice(0, LOOP_NAME_MAX).trim() || 'GPX-Strecke',
    polyline: summary.polyline,
    distance_m: summary.distanceM,
    ascent_m: ascentForStore(summary.ascentM),
    surface: null,
    saved_at: input.now,
    source: 'gpx',
    sport: input.sport,
    walk_kind: input.sport === 'walk' ? input.walkKind : null,
    descent_m: summary.descentM,
    max_altitude_m: summary.maxAltitudeM,
    profile: summary.elevationProfile.length >= 2 ? summary.elevationProfile : null,
  };
}
