import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * „Bewegung reduzieren“ des Geräts (iOS/Android) bzw. `prefers-reduced-motion` im Browser (react-native-web liest die
 * Media-Query). true = keine Animationen, z. B. Übungsbild im Workout-Player bleibt das Startbild.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduced(value);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value: boolean) =>
      setReduced(value),
    );
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduced;
}
