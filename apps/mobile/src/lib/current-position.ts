import type { LatLng } from '@fitnessapp/core';

/**
 * Einmaliger Standort für den Rundkurs-Vorschlag (nur auf Tipp „Meinen Standort verwenden“; nichts läuft im
 * Hintergrund, nichts wird gespeichert). Browser: navigator.geolocation; iPhone/Android: current-position.native.ts.
 */
export type CurrentPosition =
  | { readonly kind: 'ok'; readonly point: LatLng }
  | { readonly kind: 'denied' }
  | { readonly kind: 'unavailable' };

export function currentPosition(): Promise<CurrentPosition> {
  return new Promise((resolve) => {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo) {
      resolve({ kind: 'unavailable' });
      return;
    }
    geo.getCurrentPosition(
      (pos) =>
        resolve({ kind: 'ok', point: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
      (error) =>
        resolve({ kind: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 120_000 },
    );
  });
}
