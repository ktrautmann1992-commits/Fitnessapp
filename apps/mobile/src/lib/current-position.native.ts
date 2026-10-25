import * as Location from 'expo-location';

import type { CurrentPosition } from './current-position';

export type { CurrentPosition } from './current-position';

/**
 * iPhone/Android: EIN Standort über expo-location („Beim Verwenden der App“, nie „Immer“) – nur auf Tipp, kein
 * Hintergrund, nichts gespeichert. Ungefähre Genauigkeit reicht (der Startpunkt wird ohnehin auf 50 m gerundet).
 */
export async function currentPosition(): Promise<CurrentPosition> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) return { kind: 'unavailable' };
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { kind: 'denied' };
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { kind: 'ok', point: { lat: pos.coords.latitude, lng: pos.coords.longitude } };
  } catch {
    return { kind: 'unavailable' };
  }
}
