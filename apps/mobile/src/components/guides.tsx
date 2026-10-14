import { readableGuides, type Guide } from '@fitnessapp/core';
import { useMemo } from 'react';
import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';

import { Button, ErrorState, LoadingState, Notice } from '@/components/ui';
import { t } from '@/i18n';
import { useApp } from '@/state/app-state';
import type { NutritionView } from '@/state/use-nutrition';

/**
 * Gemeinsames der Ratgeber-Bildschirme (6.8, Etappe N5c): Die Ratgeber kommen aus dem mit der App gebündelten Bestand
 * (offline) und laufen durch `readableGuides` (nur freigegeben – im Testmodus auch Entwürfe –, ohne roten Befund
 * aus R21). Ratgeber sind nicht personenbezogen; nur „Kalorienzahlen aus“ wirkt (über `view.showNumbers`).
 */
export function useReadableGuides(view: NutritionView): Guide[] | null {
  const app = useApp();
  const allowDrafts = app.backend.mode === 'local';
  const library = view.library.kind === 'ready' ? view.library.result.library : null;
  return useMemo(
    () => (library === null ? null : readableGuides(library.guides, { allowDrafts })),
    [allowDrafts, library],
  );
}

/** Lade-, Fehler- und „nicht unterstützt“-Zustand des Bestands (nur anzeigen, solange er nicht bereit ist). */
export function GuideLibraryGate({ view }: { view: NutritionView }): ReactNode {
  const app = useApp();
  if (view.library.kind === 'unsupported') {
    return <Notice tone="info">{t.nutrition.unsupported}</Notice>;
  }
  if (view.library.kind === 'error') {
    return (
      <ErrorState
        message={t.nutrition.loadFailed}
        onRetry={() => void app.ensureNutritionLibrary()}
      />
    );
  }
  return <LoadingState label={t.nutrition.loading} />;
}

export function GuideBackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <Button
      label={t.nutrition.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as Href))}
    />
  );
}
