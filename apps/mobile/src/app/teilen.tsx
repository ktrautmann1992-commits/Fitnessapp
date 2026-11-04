import { STORY_CARD, type StoryCard } from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { LiveRegion } from '@/components/calendar';
import { Screen } from '@/components/screen';
import { StoryCardView } from '@/components/story-card';
import {
  Body,
  Button,
  Checkbox,
  ChoiceList,
  FieldError,
  LoadingState,
  Notice,
  TextField,
} from '@/components/ui';
import { storyForLog, storyForRoute } from '@/data/story-input';
import { t } from '@/i18n';
import { decodeRouteParam } from '@/lib/route-param';
import { STORY_THEMES, type StoryTheme } from '@/lib/story-layout';
import { shareStory } from '@/lib/story-share';
import { useStoryPrefs } from '@/lib/story-prefs';
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
  const storyPrefs = useStoryPrefs(app.session?.userId ?? null);
  // Bis die Person selbst wählt: gemerktes Standard-Design, Uhrzeit-Schalter und Name.
  const [picked, setPicked] = useState<StoryTheme | null>(null);
  const [showTimePicked, setShowTimePicked] = useState<boolean | null>(null);
  const [name, setName] = useState<string | null>(null);
  const theme = picked ?? storyPrefs.prefs.theme;
  const showTime = showTimePicked ?? storyPrefs.prefs.showTime;
  const ownerName = name ?? storyPrefs.prefs.name;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [live, setLive] = useState({ text: '', version: 0 });

  if (app.status.kind === 'loading' || state.kind === 'loading' || !storyPrefs.loaded) {
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
  const options = { showLine, showDate, showTime, ownerName };
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
      <Screen area="ausdauer" icon="run" title={S.title} footer={back} testID="story">
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
    // Name und Uhrzeit-Schalter für das nächste Mal merken (nur dieses Gerät).
    if (name !== null || showTimePicked !== null)
      storyPrefs.save({ name: ownerName.trim(), showTime });
    try {
      const result = await shareStory(card, view, { title: S.title, download, theme });
      const text = result === 'downloaded' ? S.downloaded : result === 'shared' ? S.shared : '';
      if (text) setLive((c) => ({ text, version: c.version + 1 }));
    } catch (caught) {
      setError((caught as Error).message === 'share_unavailable' ? S.unavailable : S.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen area="ausdauer" icon="run" title={S.title} footer={back} testID="story">
      <LiveRegion text={live.text} version={live.version} />
      <Body muted>{S.intro}</Body>
      <ChoiceList<StoryTheme>
        label={S.themeLabel}
        horizontal
        options={STORY_THEMES.map((value) => ({
          value,
          label: S.themes[value],
          testID: `story-theme-${value}`,
        }))}
        value={theme}
        onChange={setPicked}
      />
      {theme === storyPrefs.prefs.theme ? (
        <Body muted testID="story-theme-default">
          {S.themeIsDefault}
        </Body>
      ) : (
        <Button
          label={S.themeDefault}
          variant="secondary"
          onPress={() => {
            storyPrefs.save({ theme });
            setLive((c) => ({ text: S.themeSaved, version: c.version + 1 }));
          }}
          testID="story-theme-save"
        />
      )}
      <TextField
        label={S.nameLabel}
        hint={S.nameHint}
        value={ownerName}
        onChangeText={setName}
        maxLength={STORY_CARD.maxNameLength}
        autoComplete="off"
        testID="story-name"
      />
      {hasLine ? (
        <Checkbox
          label={S.showLine}
          checked={showLine}
          onChange={setShowLine}
          testID="story-line"
        />
      ) : null}
      <Checkbox label={S.showDate} checked={showDate} onChange={setShowDate} testID="story-date" />
      {showDate ? (
        <Checkbox
          label={S.showTime}
          checked={showTime}
          onChange={setShowTimePicked}
          testID="story-time"
        />
      ) : null}
      <View style={styles.preview}>
        <StoryCardView ref={view} card={card} width={previewWidth} theme={theme} />
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
