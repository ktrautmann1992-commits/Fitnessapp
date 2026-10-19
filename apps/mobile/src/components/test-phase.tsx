import { useEffect, useState } from 'react';

import { t } from '@/i18n';
import { useApp } from '@/state/app-state';

import { Badge } from './ui';

/**
 * Kennzeichen „Testphase: kostenlos“ (Testphase „alles offen“, Gründer 19.10.2026, KONZEPT 13) an Funktionen, die
 * später zu Premium gehören – statt eines Premium-/Abo-Hinweises, nie mit Kauf- oder Preis-Hinweis. Erscheint NUR,
 * wenn die Testphase für dieses Konto wirklich läuft (Wächter N3): Supabase-Modus fragt `premium_open_active()` beim
 * Server, Testmodus ist ohne Server immer offen. Bis zur Antwort, bei Fehler oder offline: nichts.
 */
export function TestPhaseBadge({ testID }: { testID?: string }) {
  const { backend } = useApp();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    backend
      .testPhaseOpen()
      .then((value) => {
        if (alive) setOpen(value);
      })
      .catch(() => {
        if (alive) setOpen(false);
      });
    return () => {
      alive = false;
    };
  }, [backend]);
  return open ? <Badge label={t.common.testPhaseFree} {...(testID ? { testID } : {})} /> : null;
}
