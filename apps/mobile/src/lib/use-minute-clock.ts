import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Jetzt (Millisekunden), einmal pro Minute und beim Zurückkehren in die App aktualisiert – z. B. damit die Karte „Nach
 * dem Training“ nach Ablauf des Fensters von selbst verschwindet.
 */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  return now;
}
