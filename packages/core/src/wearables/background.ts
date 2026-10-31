import { WEARABLE_BACKGROUND_SYNC } from '../constants';
import type { WearableConnectionStatus } from '../enums';
import type { WearableDataType } from './schema';
import { shouldAutoSync } from './sync';

/**
 * Abgleich im Hintergrund (Gründer-Freigabe 30.10.2026, docs/PLAN-PHASE-8.md 13.6): Wann die App die
 * Hintergrund-Aufgabe anmeldet, wann eine Ausführung wirklich liest und wann die Smartwatch-Seite das Recht
 * „Im Hintergrund lesen“ anbietet. Rein – die App liefert nur die Zustände (Plattform, Sitzung, Einwilligungen,
 * Verbindung, Health-Connect-Recht). Ohne das Hintergrund-Recht bleibt alles beim Lesen im Vordergrund.
 */

export interface BackgroundSyncInput {
  /** Herkunft der Daten: `native` = Health Connect in der Android-App, `demo` = Beispiel-Uhr, `none` = keine. */
  readonly driverKind: 'native' | 'demo' | 'none';
  readonly signedIn: boolean;
  /** Einwilligungen `wearable_data` UND `health_data` gültig (wie der Server prüft). */
  readonly consentsValid: boolean;
  /** Verbindung laut Server (null = nicht verbunden). */
  readonly connection: {
    readonly status: WearableConnectionStatus;
    readonly granted_types: readonly WearableDataType[];
  } | null;
  /** Health Connect: Recht „Daten im Hintergrund lesen“ (READ_HEALTH_DATA_IN_BACKGROUND) erteilt. */
  readonly backgroundAccess: boolean;
}

/** Warum (noch) kein Hintergrund-Abgleich – Reihenfolge = Prüfreihenfolge. */
export type BackgroundSyncBlocker =
  'unsupported' | 'signed_out' | 'consent' | 'not_connected' | 'no_steps' | 'no_background_access';

export type BackgroundSyncPlan =
  | { readonly kind: 'register'; readonly minimumIntervalMinutes: number }
  | { readonly kind: 'unregister'; readonly reason: BackgroundSyncBlocker };

/** Gemeinsame Prüfung ohne das Hintergrund-Recht (für Plan und Angebot). */
function blockerBeforeAccess(input: BackgroundSyncInput): BackgroundSyncBlocker | null {
  if (input.driverKind === 'none') return 'unsupported';
  if (!input.signedIn) return 'signed_out';
  if (!input.consentsValid) return 'consent';
  if (input.connection === null || input.connection.status !== 'connected') return 'not_connected';
  if (!input.connection.granted_types.includes('steps')) return 'no_steps';
  return null;
}

/**
 * Aufgabe anmelden oder abmelden. Angemeldet wird NUR in der Android-App mit echtem Health Connect (die Beispiel-Uhr
 * im Testmodus und der Browser haben keine Hintergrund-Aufgabe), mit Sitzung, gültigen Einwilligungen, verbundenen
 * Schritten und erteiltem Hintergrund-Recht. Alles andere → abmelden (Widerruf, Abmelden, Trennen, Recht entzogen).
 */
export function backgroundSyncPlan(input: BackgroundSyncInput): BackgroundSyncPlan {
  const blocker = blockerBeforeAccess(input);
  if (blocker) return { kind: 'unregister', reason: blocker };
  if (input.driverKind !== 'native') return { kind: 'unregister', reason: 'unsupported' };
  if (!input.backgroundAccess) return { kind: 'unregister', reason: 'no_background_access' };
  return {
    kind: 'register',
    minimumIntervalMinutes: WEARABLE_BACKGROUND_SYNC.minimumIntervalMin,
  };
}

/**
 * Smartwatch-Seite: Karte „Im Hintergrund aktualisieren“. `hidden` = nicht verbunden bzw. ohne Einwilligung oder
 * Health Connect; `offer` = erklären und das Recht anfragen; `active` = Recht erteilt (läuft). Im Testmodus zeigt die
 * Beispiel-Uhr die Karte ebenso (ohne echte Aufgabe).
 */
export type BackgroundAccessOffer = 'hidden' | 'offer' | 'active';

export function backgroundAccessOffer(input: BackgroundSyncInput): BackgroundAccessOffer {
  if (blockerBeforeAccess(input)) return 'hidden';
  return input.backgroundAccess ? 'active' : 'offer';
}

export type BackgroundRunDecision =
  | { readonly kind: 'run' }
  /** Vordergrund bzw. letzter Lauf liegt keine 15 min zurück – nichts tun, Aufgabe bleibt. */
  | { readonly kind: 'skip' }
  /** Voraussetzung fehlt inzwischen (z. B. Widerruf auf einem anderen Gerät) – Aufgabe abmelden, nichts lesen. */
  | { readonly kind: 'stop'; readonly reason: BackgroundSyncBlocker };

/**
 * Eine Ausführung der Aufgabe (vom Betriebssystem gestartet): erst alle Voraussetzungen erneut prüfen (sie können sich
 * seit dem Anmelden geändert haben), dann die gemeinsame Sperre „höchstens alle 15 min“ mit dem Vordergrund
 * (`lastAttemptAt` = letzter Abgleich-Versuch, egal ob Vordergrund oder Hintergrund).
 */
export function backgroundRunDecision(
  input: BackgroundSyncInput & { readonly lastAttemptAt: string | null; readonly now: string },
): BackgroundRunDecision {
  const plan = backgroundSyncPlan(input);
  if (plan.kind === 'unregister') return { kind: 'stop', reason: plan.reason };
  return shouldAutoSync(input.lastAttemptAt, input.now) ? { kind: 'run' } : { kind: 'skip' };
}
