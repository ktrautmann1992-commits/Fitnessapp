import { useCallback, useEffect, useState } from 'react';

import { deviceStore } from '@/data/create-backend';
import { readWeatherSetting, writeWeatherSetting } from '@/data/route-weather';
import { useApp } from '@/state/app-state';

/**
 * Einstellung „Wetter zu Läufen“ (25.10.2026) je Konto auf diesem Gerät: null = noch nicht gefragt (einmaliger
 * Hinweis auf der Seite eines Laufs), true/false = Antwort bzw. Schalter in den Einstellungen. Alle offenen Ansichten
 * folgen einer Änderung.
 */
const listeners = new Set<() => void>();

export function useRouteWeatherSetting(): {
  readonly loaded: boolean;
  readonly enabled: boolean | null;
  readonly set: (enabled: boolean) => Promise<void>;
} {
  const app = useApp();
  const userId = app.session?.userId ?? null;
  const [state, setState] = useState<{ loaded: boolean; enabled: boolean | null }>({
    loaded: false,
    enabled: null,
  });
  const load = useCallback(() => {
    if (!userId) return;
    void readWeatherSetting(deviceStore, userId).then((enabled) =>
      setState({ loaded: true, enabled }),
    );
  }, [userId]);
  useEffect(() => {
    load();
    listeners.add(load);
    return () => {
      listeners.delete(load);
    };
  }, [load]);
  const set = useCallback(
    async (enabled: boolean) => {
      if (!userId) return;
      setState({ loaded: true, enabled });
      await writeWeatherSetting(deviceStore, userId, enabled).catch(() => undefined);
      for (const l of listeners) l();
    },
    [userId],
  );
  return { ...state, set };
}
