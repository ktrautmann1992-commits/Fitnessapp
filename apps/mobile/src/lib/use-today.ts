import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { msUntilNextLocalDay, todayIso } from './format';

/**
 * Heutiges Datum, das sich um Mitternacht und beim Zurückkehren in die App aktualisiert (Wächter N5a K5): Bleibt die
 * App über Nacht offen, wechseln Tag und Woche (Ernährung, Einkaufsliste) ohne Neuladen – sonst würde z. B. die
 * vergangene Woche weiter gespeichert und abgelehnt.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => todayIso());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => setToday(todayIso());
    const schedule = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, msUntilNextLocalDay(new Date()));
    };
    schedule();
    // App wieder im Vordergrund (Zeitgeber laufen im Hintergrund nicht zuverlässig).
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
        schedule();
      }
    });
    return () => {
      if (timer !== null) clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return today;
}
