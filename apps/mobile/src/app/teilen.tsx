import type { StoryCard } from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { LiveRegion } from '@/components/calendar';
import { Screen } from '@/components/screen';
import { StoryCardView } from '@/components/story-card';
import { Body, Button, Checkbox, FieldError, LoadingState, Notice } from '@/components/ui';
import { storyForLog, storyForRoute } from '@/data/story-input';
import { t } from '@/i18n';
import { decodeRouteParam } from '@/lib/route-param';
import { shareStory } from '@/lib/story-share';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useTrackedRoutes } from '@/state/use-tracked-routes';

const S = t.endurance.story;

/**
 * „Als Bild teilen“ (Etappe E6, CLAUDE.md Teilen-Ausnahme): Story-Bild 9:16 einer EINZELNEN Lauf- oder Trainings-
 * einheit – Vorschau mit Schaltern „Strecke zeigen“/„Datum zeigen“, erzeugt nur auf dem Gerät (App: Aufnahme der
 * Ansicht + System-Teilen-Dialog; Browser: Canvas + Web Share API bzw. Download). Inhalt nur aus der Positivliste
 * (packages/core/share/story-card.ts): keine Gesundheitsdaten, keine Uhrzeit, Anfang/Ende der Strecke abgeschnitten.
 */
export default function ShareStoryScreen() {
  const params = useLocalSearchParams<{ route?: string; log?: string }>();
  const routeId = decodeRouteParam(params.route);
  const logId = decodeRouteParam(params.log);
  const router = useRouter();
  const app = useApp();
  const { state } = useTrackedRoutes();
  const { width } = useWindowDimensions();
  const view = useRef<View>(null);
  const [showLine, setShowLine] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [live, setLive] = useState({ text: '', version: 0 });

  if (app.status.kind === 'loading' || state.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  const entry = resolveEntryRoute({
    session: app.session,
    rows: app.rows,
    versions: app.versions,
    nutritionSetupAvailable: app.backend.supportsNutrition,
  });
  if (entry !== HOME_ROUTE || !app.rows) {
    return <Redirect href={entry as Href} />;
  }
  const routes = state.kind === 'ready' ? state.result.routes : [];
  const pending = state.kind === 'ready' ? state.result.pending : [];
  const options = { showLine, showDate };
  const card: StoryCard | null = routeId
    ? storyForRoute(routeId, routes, pending, options)
    : logId
      ? storyForLog(logId, app.rows, routes, options)
      : null;
  const back = (
    <Button
      label={t.common.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/ausdauer' as Href))}
    />
  );
  if (!card) {
    return (
      <Screen title={S.title} footer={back} testID="story">
        <Notice tone="warning" testID="story-not-found">
          {S.notFound}
        </Notice>
      </Screen>
    );
  }
  const previewWidth = Math.min(320, Math.max(200, width - 2 * spacing.lg));
  const hasLine = card.kind === 'endurance' && card.lineState !== 'none';

  async function share(download: boolean) {
    if (!card) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await shareStory(card, view, { title: S.title, download });
      const text = result === 'downloaded' ? S.downloaded : result === 'shared' ? S.shared : '';
      if (text) setLive((c) => ({ text, version: c.version + 1 }));
    } catch (caught) {
      setError((caught as Error).message === 'share_unavailable' ? S.unavailable : S.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={S.title} footer={back} testID="story">
      <LiveRegion text={live.text} version={live.version} />
      <Body muted>{S.intro}</Body>
      {hasLine ? (
        <Checkbox
          label={S.showLine}
          checked={showLine}
          onChange={setShowLine}
          testID="story-line"
        />
      ) : null}
      <Checkbox label={S.showDate} checked={showDate} onChange={setShowDate} testID="story-date" />
      <View style={styles.preview}>
        <StoryCardView ref={view} card={card} width={previewWidth} />
      </View>
      {card.kind === 'endurance' && card.lineState === 'too_short' ? (
        <Body muted testID="story-too-short">
          {S.lineTooShort}
        </Body>
      ) : null}
      <FieldError message={error} testID="story-error" />
      <Button
        label={S.share}
        loading={busy}
        onPress={() => void share(false)}
        testID="story-share"
      />
      {Platform.OS === 'web' ? (
        <Button
          label={S.download}
          variant="secondary"
          disabled={busy}
          onPress={() => void share(true)}
          testID="story-download"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center' },
});
