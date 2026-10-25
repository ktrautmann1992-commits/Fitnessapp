import { createSessionProtectedStore } from '@/data/protected-store';

import { createLoopStore, type LoopStore } from './loop-store.types';

export * from './loop-store.types';

/** Browser: gemerkte Runden nur in sessionStorage (enden mit dem Tab), nie localStorage. */
const DATA_KEY = 'fitnessapp.saved-loops.v1';

function browserSessionStorage() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export const loopStore: LoopStore = createLoopStore(
  createSessionProtectedStore(browserSessionStorage(), DATA_KEY, { strict: true }),
);
