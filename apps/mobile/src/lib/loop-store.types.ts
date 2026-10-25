import { type LoopRoute, loopRouteSchema, loopSurfaceSharesSchema } from '@fitnessapp/core';
import { z } from 'zod';

import type { ProtectedStore } from '@/data/protected-store';

/**
 * Gemerkte Runden aus dem Rundkurs-Vorschlag (docs/PLAN-RUNDKURS.md): bleiben NUR auf diesem Gerät – App
 * verschlüsselt (eigener Schlüssel, loop-store.native.ts), Browser nur sessionStorage (loop-store.ts). Nie auf dem
 * Server, nie geteilt. Je Konto getrennt (fremdes Konto auf demselben Gerät sieht nichts). Höchstens `MAX_SAVED_LOOPS`.
 * Wird eine gemerkte Runde gelaufen und gespeichert, ist sie danach eine „Meine Strecke“ (Favorit) wie jede andere.
 */
export const MAX_SAVED_LOOPS = 20;
export const LOOP_NAME_MAX = 60;

export const savedLoopSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{1,60}$/),
  name: z.string().trim().min(1).max(LOOP_NAME_MAX),
  polyline: loopRouteSchema.shape.polyline,
  distance_m: loopRouteSchema.shape.distance_m,
  ascent_m: loopRouteSchema.shape.ascent_m,
  surface: loopSurfaceSharesSchema.nullable(),
  saved_at: z.iso.datetime({ offset: true }),
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
