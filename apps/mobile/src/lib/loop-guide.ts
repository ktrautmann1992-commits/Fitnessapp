import type { LatLng } from '@fitnessapp/core';

/**
 * Leitlinie für „Diese Runde laufen“ (Rundkurs-Vorschlag, docs/PLAN-RUNDKURS.md): Die gewählte Runde liegt nur im
 * Arbeitsspeicher, bis die Aufzeichnung sie anzeigt (Parameter `guide=<id>` in /ausdauer/aufzeichnen). Nichts wird
 * gespeichert oder gesendet; nach einem Neustart der App fehlt die Linie (die Aufzeichnung läuft weiter).
 */
export interface LoopGuide {
  readonly id: string;
  readonly name: string;
  readonly points: readonly LatLng[];
  readonly distanceM: number;
}

let current: LoopGuide | null = null;

export function setLoopGuide(guide: LoopGuide): void {
  current = guide;
}

/** Leitlinie zu dieser id (sonst null – z. B. alter Link oder normale Aufzeichnung). */
export function loopGuideFor(id: string | null | undefined): LoopGuide | null {
  return id && current && current.id === id ? current : null;
}

export function clearLoopGuide(): void {
  current = null;
}
