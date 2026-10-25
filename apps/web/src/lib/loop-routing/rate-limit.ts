/**
 * Anfrage-Bremse des Rundkurs-Vorschlags (LOOP_ROUTE.rateLimit): je Person ein Fenster (10 min) und ein Tageszähler,
 * dazu ein gemeinsamer Deckel je Minute (schützt das ORS-Kontingent). Gespeichert wird nur ein Prüfwert (SHA-256) der
 * Nutzer-ID mit Zeitstempeln – keine Koordinaten, kein Klartext. Liegt im Arbeitsspeicher der Server-Instanz (Vercel
 * Functions: je Instanz, nach Neustart leer) – das reicht in der Testphase; der harte Deckel ist das Tageskontingent
 * des ORS-Schlüssels. Vor dem Livegang: Zähler in der Datenbank (docs/PLAN-RUNDKURS.md, offene Punkte).
 */
import { createHash } from 'node:crypto';

import { LOOP_ROUTE } from '@fitnessapp/core';

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
/** Höchstens so viele Personen im Speicher (älteste fliegen raus). */
const MAX_KEYS = 10_000;

export type RateDecision = 'ok' | 'user_limit' | 'global_limit';

export interface LoopRateLimiter {
  take(userId: string, now: number): RateDecision;
}

export interface LoopRateLimits {
  readonly perUserWindowMs: number;
  readonly perUserWindow: number;
  readonly perUserDay: number;
  readonly globalPerMinute: number;
}

export function createLoopRateLimiter(
  limits: LoopRateLimits = LOOP_ROUTE.rateLimit,
): LoopRateLimiter {
  const users = new Map<string, number[]>();
  let global: number[] = [];
  return {
    take(userId, now) {
      const key = createHash('sha256').update(userId).digest('base64url');
      const recent = (users.get(key) ?? []).filter((t) => now - t < DAY_MS);
      global = global.filter((t) => now - t < MINUTE_MS);
      const inWindow = recent.filter((t) => now - t < limits.perUserWindowMs).length;
      if (inWindow >= limits.perUserWindow || recent.length >= limits.perUserDay) {
        users.set(key, recent);
        return 'user_limit';
      }
      if (global.length >= limits.globalPerMinute) return 'global_limit';
      recent.push(now);
      global.push(now);
      users.delete(key);
      users.set(key, recent);
      if (users.size > MAX_KEYS) {
        const oldest = users.keys().next().value;
        if (oldest !== undefined) users.delete(oldest);
      }
      return 'ok';
    },
  };
}

/** Eine Bremse je Server-Instanz. */
export const sharedLoopRateLimiter = createLoopRateLimiter();
