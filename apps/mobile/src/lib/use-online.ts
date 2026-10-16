import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Hat das Gerät Verbindung? Browser: `navigator.onLine` und die Ereignisse online/offline (Etappe E3: „Fotos brauchen
 * Internet“). In der App ohne zusätzliches Paket immer true – ein fehlendes Netz meldet dort der Aufruf selbst
 * (Fehler `network`).
 */
export function useOnline(): boolean {
  const browser = Platform.OS === 'web' && typeof window !== 'undefined';
  const [online, setOnline] = useState(() => (browser ? window.navigator.onLine !== false : true));
  useEffect(() => {
    if (!browser) return undefined;
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, [browser]);
  return online;
}
