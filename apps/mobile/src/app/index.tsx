import { Redirect, type Href } from 'expo-router';

import { ErrorState, LoadingState } from '@/components/ui';
import { Screen } from '@/components/screen';
import { t } from '@/i18n';
import { useApp } from '@/state/app-state';

/** Startpunkt: lädt den Stand und springt an die richtige Stelle (Fortsetzen nach Neustart). */
export default function Gate() {
  const { status, entryRoute, reload } = useApp();
  if (status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (status.kind === 'error') {
    return (
      <Screen>
        <ErrorState message={t.errors.loadFailed} onRetry={() => void reload()} />
      </Screen>
    );
  }
  return <Redirect href={entryRoute() as Href} />;
}
