import {
  APP_LAYOUT,
  type AppLayout,
  defaultLayout,
  FIXED_FIRST_TAB,
  FIXED_LAST_TAB,
  moveTab,
  type NavArea,
  NAV_AREAS,
  sameLayout,
  setTabShown,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { LiveAnnouncement } from '@/components/live-announcement';
import { Screen } from '@/components/screen';
import { tabLabel } from '@/components/tab-bar';
import { Body, Button, Card, Checkbox, LoadingState, Notice } from '@/components/ui';
import { t } from '@/i18n';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useAppLayout } from '@/state/use-app-layout';

/**
 * „Menüleiste anpassen“ (Etappe E2, docs/PLAN-EINKAUFEN-AUSDAUER.md 4; aus „Mehr“ und „Übersicht → Bearbeiten“):
 * je Bereich „… in der Menüleiste“ und „Nach links“/„Nach rechts“ (Ansage der neuen Stelle). Regeln aus
 * packages/core/src/layout.ts mit verständlichem Grund: „Übersicht“ links und „Mehr“ rechts fest, 3–6 Knöpfe.
 * Bereiche ohne Knopf zeigt „Mehr“. Jede Änderung wird sofort gespeichert (offline möglich).
 */
export default function MenuBarScreen() {
  const router = useRouter();
  const app = useApp();
  const { layout, available, save } = useAppLayout();
  const [announce, setAnnounce] = useState('');
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'danger' } | null>(null);
  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  const route = resolveEntryRoute({
    session: app.session,
    rows: app.rows,
    versions: app.versions,
    nutritionSetupAvailable: app.backend.supportsNutrition,
  });
  if (route !== HOME_ROUTE || !app.rows) {
    return <Redirect href={route as Href} />;
  }
  const texts = t.menuBar;

  async function apply(next: AppLayout, text: string) {
    setMessage(null);
    try {
      await save(next);
      setAnnounce(text);
    } catch {
      setMessage({ text: texts.saveFailed, tone: 'danger' });
    }
  }

  function toggle(area: NavArea, shown: boolean) {
    const result = setTabShown(layout, area, shown, available);
    if (!result.ok) {
      const reason =
        result.reason === 'max'
          ? texts.reasons.max(APP_LAYOUT.tabsMax)
          : result.reason === 'min'
            ? texts.reasons.min(APP_LAYOUT.tabsMin)
            : texts.reasons[result.reason];
      setMessage({ text: reason, tone: 'info' });
      setAnnounce(reason);
      return;
    }
    const label = tabLabel(area);
    void apply(result.layout, shown ? texts.added(label) : texts.removed(label));
  }

  function move(area: NavArea, direction: 'up' | 'down') {
    const next = moveTab(layout, area, direction);
    const index = next.tabs.indexOf(area) + 1;
    void apply(next, texts.moved(tabLabel(area), index, next.tabs.length));
  }

  // Erst die Knöpfe in ihrer Reihenfolge, dann die übrigen Bereiche (Standard-Reihenfolge).
  const areas: NavArea[] = [
    ...layout.tabs,
    ...NAV_AREAS.filter((a) => available.includes(a) && !layout.tabs.includes(a)),
  ];
  const back = () => (router.canGoBack() ? router.back() : router.replace('/mehr' as Href));
  return (
    <Screen
      area="training"
      icon="bar-menu"
      title={texts.title}
      testID="menu-bar"
      footer={
        <Button label={texts.back} variant="secondary" onPress={back} testID="menu-bar-done" />
      }
    >
      <Body muted>{texts.intro(APP_LAYOUT.tabsMin, APP_LAYOUT.tabsMax)}</Body>
      <LiveAnnouncement text={announce} testID="menu-bar-live" />
      <Body testID="menu-bar-preview">
        {`${texts.preview} ${layout.tabs.map((a) => tabLabel(a)).join(' · ')}`}
      </Body>
      {message ? (
        <Notice tone={message.tone} testID="menu-bar-message">
          {message.text}
        </Notice>
      ) : null}
      <Card>
        {areas.map((area) => {
          const label = tabLabel(area);
          const fixed = area === FIXED_FIRST_TAB || area === FIXED_LAST_TAB;
          const index = layout.tabs.indexOf(area);
          const inBar = index >= 0;
          return (
            <View
              key={area}
              style={{ gap: spacing.xs, paddingVertical: spacing.xs }}
              testID={`menu-bar-area-${area}`}
            >
              {fixed ? (
                <Body>{`${label} – ${texts.fixed}`}</Body>
              ) : (
                <Checkbox
                  label={texts.inBar(label)}
                  checked={inBar}
                  onChange={(shown) => toggle(area, shown)}
                  testID={`menu-bar-show-${area}`}
                />
              )}
              {inBar && !fixed ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={texts.up}
                      accessibilityLabel={texts.upA11y(label)}
                      variant="secondary"
                      disabled={index <= 1}
                      onPress={() => move(area, 'up')}
                      testID={`menu-bar-up-${area}`}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={texts.down}
                      accessibilityLabel={texts.downA11y(label)}
                      variant="secondary"
                      disabled={index >= layout.tabs.length - 2}
                      onPress={() => move(area, 'down')}
                      testID={`menu-bar-down-${area}`}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>
      {!sameLayout(
        { tiles: layout.tiles, tabs: layout.tabs },
        { tiles: layout.tiles, tabs: defaultLayout(available).tabs },
      ) ? (
        <Button
          label={texts.reset}
          variant="secondary"
          onPress={() =>
            void apply({ ...layout, tabs: defaultLayout(available).tabs }, texts.resetDone)
          }
          testID="menu-bar-reset"
        />
      ) : null}
    </Screen>
  );
}
