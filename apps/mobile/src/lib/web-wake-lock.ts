export interface WakeLockSentinelLike {
  readonly released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

export interface WebWakeLockEnv {
  readonly wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
  readonly document: {
    readonly visibilityState: string;
    addEventListener(type: 'visibilitychange', listener: () => void): void;
    removeEventListener(type: 'visibilitychange', listener: () => void): void;
  };
  readonly setInterval: (fn: () => void, ms: number) => unknown;
  readonly clearInterval: (id: unknown) => void;
}

/** Erneut versuchen, falls der Browser die Sperre ablehnt oder selbst freigibt (Akku-Sparmodus, Tab-Wechsel). */
export const WEB_WAKE_LOCK_RETRY_MS = 5000;

/**
 * Browser (Workout-Player 14.11.2026): Bildschirm-Sperre direkt über die Wake-Lock-Schnittstelle. Anders als
 * expo-keep-awake im Web wird die Sperre neu angefordert, sobald der Browser sie freigibt (Tab verdeckt, Akku-Sparmodus)
 * und die Seite wieder sichtbar ist – Countdown, Übung und Pause bleiben so durchgehend hell. Ohne Wake-Lock-
 * Schnittstelle (ältere Browser) passiert nichts. Gibt die Aufräum-Funktion zurück.
 */
export function holdWebWakeLock(env: WebWakeLockEnv): () => void {
  let sentinel: WakeLockSentinelLike | null = null;
  let pending = false;
  let cancelled = false;
  const acquire = () => {
    if (cancelled || pending || !env.wakeLock || env.document.visibilityState !== 'visible') return;
    if (sentinel && !sentinel.released) return;
    pending = true;
    env.wakeLock.request('screen').then(
      (lock) => {
        pending = false;
        if (cancelled) {
          lock.release().catch(() => undefined);
          return;
        }
        sentinel = lock;
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null;
          acquire();
        });
      },
      () => {
        pending = false;
      },
    );
  };
  acquire();
  env.document.addEventListener('visibilitychange', acquire);
  const timer = env.setInterval(acquire, WEB_WAKE_LOCK_RETRY_MS);
  return () => {
    cancelled = true;
    env.clearInterval(timer);
    env.document.removeEventListener('visibilitychange', acquire);
    const held = sentinel;
    sentinel = null;
    if (held && !held.released) held.release().catch(() => undefined);
  };
}
