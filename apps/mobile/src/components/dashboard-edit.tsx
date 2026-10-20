import {
  type AppLayout,
  defaultLayout,
  type DashboardTileId,
  moveTile,
  sameLayout,
  setTileVisible,
  tilePosition,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { LiveAnnouncement } from '@/components/live-announcement';
import { Body, Button, Card, Checkbox, Heading, Notice } from '@/components/ui';
import { t } from '@/i18n';
import { useAppLayout } from '@/state/use-app-layout';

/** Titel einer Kachel (wie auf der Übersicht). */
export function tileTitle(id: DashboardTileId): string {
  return t.dashboard.edit.tiles[id];
}

/**
 * „Übersicht bearbeiten“ (Etappe E2, docs/PLAN-EINKAUFEN-AUSDAUER.md 4): je Kachel „… anzeigen“ und „Nach oben“/„Nach
 * unten“ (barrierefrei, Ansage der neuen Stelle per Live-Region), „Auf Standard zurücksetzen“, „Menüleiste anpassen“,
 * „Fertig“. Jede Änderung wird sofort gespeichert (offline möglich). Regeln aus packages/core/src/layout.ts.
 */
export function DashboardEditor({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const { layout, available, save } = useAppLayout();
  const [announce, setAnnounce] = useState('');
  const [error, setError] = useState<string | null>(null);
  const texts = t.dashboard.edit;

  async function apply(next: AppLayout, message: string) {
    setError(null);
    try {
      await save(next);
      setAnnounce(message);
    } catch {
      setError(texts.saveFailed);
    }
  }

  const count = layout.tiles.length;
  return (
    <Card>
      <View style={{ gap: spacing.sm }} testID="overview-edit">
        <Heading level={2}>{texts.title}</Heading>
        <Body muted>{texts.intro}</Body>
        <LiveAnnouncement text={announce} testID="overview-edit-live" />
        {error ? (
          <Notice tone="danger" testID="overview-edit-error">
            {error}
          </Notice>
        ) : null}
        {layout.tiles.map((tile, index) => {
          const title = tileTitle(tile.id);
          return (
            <View
              key={tile.id}
              style={{ gap: spacing.xs, paddingVertical: spacing.xs }}
              testID={`overview-edit-tile-${tile.id}`}
            >
              <Checkbox
                label={texts.show(title)}
                checked={tile.visible}
                onChange={(visible) =>
                  void apply(
                    setTileVisible(layout, tile.id, visible),
                    visible ? texts.shown(title) : texts.hidden(title),
                  )
                }
                testID={`overview-edit-show-${tile.id}`}
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label={texts.up}
                    accessibilityLabel={texts.upA11y(title)}
                    variant="secondary"
                    disabled={index === 0}
                    onPress={() => {
                      const next = moveTile(layout, tile.id, 'up');
                      const pos = tilePosition(next, tile.id);
                      void apply(next, texts.moved(title, pos.index, pos.count));
                    }}
                    testID={`overview-edit-up-${tile.id}`}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label={texts.down}
                    accessibilityLabel={texts.downA11y(title)}
                    variant="secondary"
                    disabled={index === count - 1}
                    onPress={() => {
                      const next = moveTile(layout, tile.id, 'down');
                      const pos = tilePosition(next, tile.id);
                      void apply(next, texts.moved(title, pos.index, pos.count));
                    }}
                    testID={`overview-edit-down-${tile.id}`}
                  />
                </View>
              </View>
            </View>
          );
        })}
        <Button
          label={texts.menuBar}
          variant="secondary"
          onPress={() => router.push('/menueleiste' as Href)}
          testID="overview-edit-menu-bar"
        />
        {!sameLayout(layout, defaultLayout(available)) ? (
          <Button
            label={texts.reset}
            variant="secondary"
            onPress={() => void apply(defaultLayout(available), texts.resetDone)}
            testID="overview-edit-reset"
          />
        ) : null}
        <Button label={texts.done} onPress={onDone} testID="overview-edit-done" />
      </View>
    </Card>
  );
}
