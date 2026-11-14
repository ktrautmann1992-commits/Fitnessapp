import { describe, expect, it } from 'vitest';

import {
  holdWebWakeLock,
  WEB_WAKE_LOCK_RETRY_MS,
  type WakeLockSentinelLike,
  type WebWakeLockEnv,
} from './web-wake-lock';

/** Nachbau von navigator.wakeLock und document (Sichtbarkeit) mit manueller Uhr. */
function fakeEnv(options: { reject?: boolean; noApi?: boolean } = {}) {
  let visibility = 'visible';
  const visListeners = new Set<() => void>();
  const intervals = new Map<number, () => void>();
  let nextId = 1;
  const locks: (WakeLockSentinelLike & { fireRelease(): void })[] = [];
  let requests = 0;
  const env: WebWakeLockEnv = {
    wakeLock: options.noApi
      ? undefined
      : {
          request: () => {
            requests += 1;
            if (options.reject) return Promise.reject(new Error('NotAllowedError'));
            const listeners: (() => void)[] = [];
            const lock = {
              released: false,
              release() {
                if (!lock.released) {
                  lock.released = true;
                  listeners.forEach((l) => l());
                }
                return Promise.resolve();
              },
              addEventListener(_type: 'release', l: () => void) {
                listeners.push(l);
              },
              fireRelease() {
                lock.released = true;
                listeners.forEach((l) => l());
              },
            };
            locks.push(lock);
            return Promise.resolve(lock);
          },
        },
    document: {
      get visibilityState() {
        return visibility;
      },
      addEventListener: (_t, l) => visListeners.add(l),
      removeEventListener: (_t, l) => visListeners.delete(l),
    },
    setInterval: (fn) => {
      const id = nextId++;
      intervals.set(id, fn);
      return id;
    },
    clearInterval: (id) => intervals.delete(id as number),
  };
  return {
    env,
    locks,
    get requests() {
      return requests;
    },
    get intervals() {
      return intervals.size;
    },
    get listeners() {
      return visListeners.size;
    },
    setVisible(v: boolean) {
      visibility = v ? 'visible' : 'hidden';
      visListeners.forEach((l) => l());
    },
    tick() {
      intervals.forEach((fn) => fn());
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('holdWebWakeLock (Bildschirm bleibt im Browser an)', () => {
  it('fordert die Sperre sofort an und gibt sie beim Ende frei', async () => {
    const f = fakeEnv();
    const stop = holdWebWakeLock(f.env);
    await flush();
    expect(f.requests).toBe(1);
    expect(f.locks[0]!.released).toBe(false);
    stop();
    expect(f.locks[0]!.released).toBe(true);
    expect(f.intervals).toBe(0);
    expect(f.listeners).toBe(0);
  });

  it('Tab verdeckt → Browser gibt frei → beim Zurückkehren neu angefordert', async () => {
    const f = fakeEnv();
    const stop = holdWebWakeLock(f.env);
    await flush();
    f.setVisible(false);
    f.locks[0]!.fireRelease(); // macht der Browser beim Verdecken
    await flush();
    expect(f.requests).toBe(1); // verdeckt: keine Anfrage
    f.setVisible(true);
    await flush();
    expect(f.requests).toBe(2);
    expect(f.locks[1]!.released).toBe(false);
    stop();
  });

  it('vom System freigegeben (Akku-Sparmodus) bei sichtbarer Seite → sofort neu', async () => {
    const f = fakeEnv();
    const stop = holdWebWakeLock(f.env);
    await flush();
    f.locks[0]!.fireRelease();
    await flush();
    expect(f.requests).toBe(2);
    stop();
  });

  it('abgelehnt → später erneut versucht; keine doppelte Sperre, solange eine hält', async () => {
    expect(WEB_WAKE_LOCK_RETRY_MS).toBeGreaterThan(0);
    const rejecting = fakeEnv({ reject: true });
    const stopA = holdWebWakeLock(rejecting.env);
    await flush();
    rejecting.tick();
    await flush();
    expect(rejecting.requests).toBe(2);
    stopA();
    const f = fakeEnv();
    const stopB = holdWebWakeLock(f.env);
    await flush();
    f.tick();
    f.tick();
    await flush();
    expect(f.requests).toBe(1);
    stopB();
  });

  it('ohne Wake-Lock-Schnittstelle: kein Fehler, nichts passiert', () => {
    const f = fakeEnv({ noApi: true });
    const stop = holdWebWakeLock(f.env);
    f.tick();
    expect(() => stop()).not.toThrow();
  });

  it('Sperre kommt erst nach dem Ende an → sofort wieder freigegeben', async () => {
    const f = fakeEnv();
    const stop = holdWebWakeLock(f.env);
    stop();
    await flush();
    expect(f.locks[0]!.released).toBe(true);
  });
});
