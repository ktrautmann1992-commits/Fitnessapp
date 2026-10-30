import { describe, expect, it } from 'vitest';

import { WEARABLE_BACKGROUND_SYNC, WEARABLE_SYNC } from '../constants';
import {
  backgroundAccessOffer,
  backgroundRunDecision,
  backgroundSyncPlan,
  type BackgroundSyncInput,
} from './background';
import { WEARABLE_DATA_TYPES } from './schema';

const ready: BackgroundSyncInput = {
  driverKind: 'native',
  signedIn: true,
  consentsValid: true,
  connection: { status: 'connected', granted_types: ['steps'] },
  backgroundAccess: true,
};

const now = '2026-10-30T12:00:00.000Z';

describe('WEARABLE_BACKGROUND_SYNC', () => {
  it('Mindestabstand = WorkManager-Untergrenze 15 min = Sperre im Vordergrund', () => {
    expect(WEARABLE_BACKGROUND_SYNC.minimumIntervalMin).toBe(15);
    expect(WEARABLE_BACKGROUND_SYNC.minimumIntervalMin).toBe(WEARABLE_SYNC.autoMinIntervalMin);
  });
});

describe('backgroundSyncPlan', () => {
  it('alles erfüllt (nur Schritte vom Handy) → anmelden mit 15 min', () => {
    expect(backgroundSyncPlan(ready)).toEqual({ kind: 'register', minimumIntervalMinutes: 15 });
  });

  it('Uhr mit allen Datentypen → ebenfalls anmelden', () => {
    expect(
      backgroundSyncPlan({
        ...ready,
        connection: { status: 'connected', granted_types: [...WEARABLE_DATA_TYPES] },
      }).kind,
    ).toBe('register');
  });

  it('Browser/iPhone ohne Health Connect → abmelden (unsupported)', () => {
    expect(backgroundSyncPlan({ ...ready, driverKind: 'none' })).toEqual({
      kind: 'unregister',
      reason: 'unsupported',
    });
  });

  it('Beispiel-Uhr (Testmodus) → nie eine echte Aufgabe', () => {
    expect(backgroundSyncPlan({ ...ready, driverKind: 'demo' })).toEqual({
      kind: 'unregister',
      reason: 'unsupported',
    });
  });

  it('abgemeldet → abmelden', () => {
    expect(backgroundSyncPlan({ ...ready, signedIn: false })).toEqual({
      kind: 'unregister',
      reason: 'signed_out',
    });
  });

  it('Einwilligung widerrufen → abmelden, auch wenn das Recht noch erteilt ist', () => {
    expect(backgroundSyncPlan({ ...ready, consentsValid: false })).toEqual({
      kind: 'unregister',
      reason: 'consent',
    });
  });

  it('getrennt bzw. „Zugriff fehlt“ → abmelden', () => {
    expect(backgroundSyncPlan({ ...ready, connection: null }).kind).toBe('unregister');
    expect(
      backgroundSyncPlan({
        ...ready,
        connection: { status: 'permission_missing', granted_types: [] },
      }),
    ).toEqual({ kind: 'unregister', reason: 'not_connected' });
  });

  it('verbunden ohne Schritte → abmelden (no_steps)', () => {
    expect(
      backgroundSyncPlan({
        ...ready,
        connection: { status: 'connected', granted_types: ['exercise', 'heart_rate'] },
      }),
    ).toEqual({ kind: 'unregister', reason: 'no_steps' });
  });

  it('ohne Hintergrund-Recht → abmelden, Vordergrund-Lesen bleibt (no_background_access)', () => {
    expect(backgroundSyncPlan({ ...ready, backgroundAccess: false })).toEqual({
      kind: 'unregister',
      reason: 'no_background_access',
    });
  });

  it('Prüfreihenfolge: Plattform vor Sitzung vor Einwilligung', () => {
    expect(
      backgroundSyncPlan({
        driverKind: 'none',
        signedIn: false,
        consentsValid: false,
        connection: null,
        backgroundAccess: false,
      }),
    ).toEqual({ kind: 'unregister', reason: 'unsupported' });
    expect(
      backgroundSyncPlan({ ...ready, signedIn: false, consentsValid: false, connection: null }),
    ).toEqual({ kind: 'unregister', reason: 'signed_out' });
  });
});

describe('backgroundAccessOffer', () => {
  it('Recht fehlt → anbieten; erteilt → aktiv', () => {
    expect(backgroundAccessOffer({ ...ready, backgroundAccess: false })).toBe('offer');
    expect(backgroundAccessOffer(ready)).toBe('active');
  });

  it('Beispiel-Uhr zeigt die Karte wie die App (ohne echte Aufgabe)', () => {
    expect(backgroundAccessOffer({ ...ready, driverKind: 'demo', backgroundAccess: false })).toBe(
      'offer',
    );
  });

  it('ohne Health Connect, Sitzung, Einwilligung, Verbindung oder Schritte → ausgeblendet', () => {
    expect(backgroundAccessOffer({ ...ready, driverKind: 'none' })).toBe('hidden');
    expect(backgroundAccessOffer({ ...ready, signedIn: false })).toBe('hidden');
    expect(backgroundAccessOffer({ ...ready, consentsValid: false })).toBe('hidden');
    expect(backgroundAccessOffer({ ...ready, connection: null })).toBe('hidden');
    expect(
      backgroundAccessOffer({
        ...ready,
        connection: { status: 'connected', granted_types: ['sleep'] },
      }),
    ).toBe('hidden');
  });
});

describe('backgroundRunDecision', () => {
  it('noch nie abgeglichen → lesen', () => {
    expect(backgroundRunDecision({ ...ready, lastAttemptAt: null, now })).toEqual({
      kind: 'run',
    });
  });

  it('letzter Versuch (Vordergrund oder Hintergrund) vor genau 15 min → lesen', () => {
    expect(
      backgroundRunDecision({ ...ready, lastAttemptAt: '2026-10-30T11:45:00.000Z', now }),
    ).toEqual({ kind: 'run' });
  });

  it('letzter Versuch vor 14 min → überspringen, Aufgabe bleibt', () => {
    expect(
      backgroundRunDecision({ ...ready, lastAttemptAt: '2026-10-30T11:46:00.000Z', now }),
    ).toEqual({ kind: 'skip' });
  });

  it('Uhr zurückgestellt (Versuch in der Zukunft) → lesen', () => {
    expect(
      backgroundRunDecision({ ...ready, lastAttemptAt: '2026-10-30T13:00:00.000Z', now }),
    ).toEqual({ kind: 'run' });
  });

  it('Voraussetzung inzwischen weg → stoppen statt lesen (auch wenn lange nicht abgeglichen)', () => {
    expect(
      backgroundRunDecision({ ...ready, consentsValid: false, lastAttemptAt: null, now }),
    ).toEqual({ kind: 'stop', reason: 'consent' });
    expect(
      backgroundRunDecision({ ...ready, backgroundAccess: false, lastAttemptAt: null, now }),
    ).toEqual({ kind: 'stop', reason: 'no_background_access' });
    expect(backgroundRunDecision({ ...ready, signedIn: false, lastAttemptAt: null, now })).toEqual({
      kind: 'stop',
      reason: 'signed_out',
    });
  });
});
