import {
  type AccessibilitySettings,
  DEFAULT_ACCESSIBILITY_SETTINGS,
  minTouchTarget,
  parseAccessibilitySettings,
} from '@fitnessapp/core';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { deviceStore } from '@/data/create-backend';
import { readJson, STORAGE_KEYS, writeJson } from '@/data/kv';

/**
 * Barrierefreiheit (docs/PLAN-FIT-IM-ALTER.md 12, Etappe FA5): „Große Ansicht“ (Schrift ×1,25, Tippflächen 56 px,
 * Text 7 : 1, weniger Elemente auf „Heute“) und „Anleitungen vorlesen“. Gespeichert nur auf diesem Gerät; die Regeln
 * (Faktoren, Grenzen) kommen aus packages/core.
 */

interface AccessibilityContextValue {
  readonly settings: AccessibilitySettings;
  readonly loaded: boolean;
  readonly update: (patch: Partial<AccessibilitySettings>) => Promise<void>;
}

const AccessibilityContext = createContext<AccessibilityContextValue>({
  settings: DEFAULT_ACCESSIBILITY_SETTINGS,
  loaded: false,
  update: async () => undefined,
});

/**
 * `initial` (nur Tests/Vorschau): fester Startwert, dann wird nichts vom Gerät gelesen.
 */
export function AccessibilityProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: AccessibilitySettings;
}) {
  const [settings, setSettings] = useState<AccessibilitySettings>(
    initial ?? DEFAULT_ACCESSIBILITY_SETTINGS,
  );
  const [loaded, setLoaded] = useState(initial !== undefined);
  const current = useRef(settings);
  const fixed = initial !== undefined;
  useEffect(() => {
    if (fixed) return;
    let alive = true;
    readJson<unknown>(deviceStore, STORAGE_KEYS.accessibility)
      .catch(() => null)
      .then((raw) => {
        if (!alive) return;
        const parsed = parseAccessibilitySettings(raw);
        current.current = parsed;
        setSettings(parsed);
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [fixed]);
  const update = useCallback(async (patch: Partial<AccessibilitySettings>) => {
    const next = parseAccessibilitySettings({ ...current.current, ...patch });
    current.current = next;
    setSettings(next);
    await writeJson(deviceStore, STORAGE_KEYS.accessibility, next);
  }, []);
  const value = useMemo(() => ({ settings, loaded, update }), [settings, loaded, update]);
  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

/** Einstellungen lesen und ändern (Einstellungen-Bildschirm). */
export function useAccessibility(): AccessibilityContextValue {
  return useContext(AccessibilityContext);
}

/** Ist die große Ansicht an? */
export function useLargeView(): boolean {
  return useContext(AccessibilityContext).settings.largeView;
}

/** Mindestgröße einer Tippfläche (48 bzw. 56 px in der großen Ansicht). */
export function useMinTouch(): number {
  return minTouchTarget(useLargeView());
}
