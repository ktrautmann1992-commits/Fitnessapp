import type { RecipePreferenceKind } from '@fitnessapp/core';
import { fontSize, radius, spacing } from '@fitnessapp/ui';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, MIN_ROW, useAreaColors } from '@/components/design';
import { Text } from '@/components/text';
import { Body, Button, Card, Heading, Notice } from '@/components/ui';
import { preferenceForRecipe } from '@/data/recipe-preference-rows';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { appFont } from '@/lib/fonts';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';

/**
 * Rezept-Favoriten (Gründer-Freigabe 25.10.2026, KONZEPT 6.10a): Herz „Lieblingsgericht“ und „Nie wieder“ – in der
 * Rezeptansicht (`RecipePreferenceCard`), in Rezeptlisten (`FavoriteToggle`) und an Mahlzeiten des Plans
 * (`MealPreferenceMenu`, „⋯“). Nur Darstellung und Speichern; die Regeln (Sperre, Bonus, Obergrenze) stehen in
 * packages/core. Privat, kein Teilen, keine Zählung anderer Personen. Tippflächen ≥ 44 px, Zustand für Bildschirmleser.
 */

type Message = { text: string; tone: 'success' | 'danger' | 'info' };

/** Speichern mit Ladezustand und verständlicher Meldung (Obergrenze, Fehler). */
function useSetPreference(recipeId: string) {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const current = app.rows ? preferenceForRecipe(app.rows, recipeId) : null;
  async function set(kind: RecipePreferenceKind | null, success: string, extra?: Message) {
    setBusy(true);
    setMessage(null);
    try {
      await app.setRecipePreference(recipeId, kind);
      setMessage(extra ?? { text: success, tone: 'success' });
    } catch (caught) {
      const text = errorText(caught);
      setMessage({ text: text || t.nutrition.favorites.failed, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }
  return { current, busy, message, set, setMessage };
}

/**
 * Kleiner Herz-Knopf (44 × 44) für Listen: gefüllt = Lieblingsgericht. Bei „Nie wieder“ nicht angezeigt (solche
 * Rezepte stehen in keiner Liste). Bildschirmleser: Schalter mit Zustand.
 */
export function FavoriteToggle({
  recipeId,
  title,
  testID,
}: {
  recipeId: string;
  title: string;
  testID?: string;
}) {
  const theme = useThemeColors();
  const green = useAreaColors('ernaehrung');
  const { current, busy, set } = useSetPreference(recipeId);
  const texts = t.nutrition.favorites;
  if (current === 'hidden') return null;
  const on = current === 'favorite';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={on ? texts.unfavoriteA11y(title) : texts.favoriteA11y(title)}
      accessibilityState={{ checked: on, disabled: busy }}
      aria-checked={on}
      disabled={busy}
      hitSlop={4}
      onPress={() =>
        void set(on ? null : 'favorite', on ? texts.removedFavorite : texts.savedFavorite)
      }
      style={({ pressed }) => [
        styles.heart,
        {
          backgroundColor: on ? green.surface : theme.surface,
          borderColor: on ? green.icon : theme.border,
          opacity: busy ? 0.6 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Icon name={on ? 'heart-filled' : 'heart'} size={20} color={on ? green.icon : theme.text} />
    </Pressable>
  );
}

/**
 * Karte „Dein Geschmack“ in der Rezeptansicht: Herz setzen/entfernen, „Nie wieder vorschlagen“ bzw. „Wieder zulassen“.
 * Ergänzt „Wie war’s?“ (Daumen = Eindruck einer Mahlzeit, 8 Wochen) um eine dauerhafte Entscheidung.
 */
export function RecipePreferenceCard({
  recipeId,
  title,
  inPlan,
}: {
  recipeId: string;
  title: string;
  /** Aus dem Essensplan geöffnet: Hinweis, dass die laufende Woche bleibt (K7) und „Tauschen“ hilft. */
  inPlan: boolean;
}) {
  const { current, busy, message, set } = useSetPreference(recipeId);
  const texts = t.nutrition.favorites;
  const on = current === 'favorite';
  return (
    <Card>
      <Heading level={2}>{texts.heading}</Heading>
      <Body muted>{texts.intro}</Body>
      {current === 'hidden' ? (
        <>
          <Notice tone="info" icon="info" testID="recipe-preference-hidden">
            {texts.hiddenState}
          </Notice>
          <Button
            label={texts.unhide}
            accessibilityLabel={texts.unhideA11y(title)}
            variant="secondary"
            loading={busy}
            onPress={() => void set(null, texts.allowed(title))}
            testID="recipe-preference-unhide"
          />
        </>
      ) : (
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button
              label={texts.favorite}
              icon={on ? 'heart-filled' : 'heart'}
              accessibilityLabel={on ? texts.unfavoriteA11y(title) : texts.favoriteA11y(title)}
              variant={on ? 'primary' : 'secondary'}
              disabled={busy}
              onPress={() =>
                void set(on ? null : 'favorite', on ? texts.removedFavorite : texts.savedFavorite)
              }
              testID="recipe-preference-favorite"
            />
          </View>
          <View style={styles.flex}>
            <Button
              label={texts.hide}
              icon="eye-off"
              accessibilityLabel={texts.hideA11y(title)}
              variant="secondary"
              disabled={busy}
              onPress={() =>
                void set(
                  'hidden',
                  texts.savedHidden(title),
                  inPlan
                    ? { text: `${texts.savedHidden(title)} ${texts.hiddenInPlan}`, tone: 'success' }
                    : undefined,
                )
              }
              testID="recipe-preference-hide"
            />
          </View>
        </View>
      )}
      {message ? (
        <Notice tone={message.tone} testID="recipe-preference-message">
          {message.text}
        </Notice>
      ) : null}
    </Card>
  );
}

/**
 * „⋯“ an einer Mahlzeit des Plans (oben rechts auf der Karte): klappt darunter zwei Aktionen auf (Lieblingsgericht,
 * Nie wieder). Die Mahlzeit dieser Woche bleibt stehen (K7) – „Tauschen“ ersetzt sie; ab der nächsten Planung wirkt
 * „Nie wieder“. `children` ist die Mahlzeit (`MealRow` mit `reserveTrailing`).
 */
export function MealPreferenceMenu({
  recipeId,
  title,
  testID,
  children,
}: {
  recipeId: string;
  title: string;
  testID: string;
  children: ReactNode;
}) {
  const theme = useThemeColors();
  const [open, setOpen] = useState(false);
  const { current, busy, message, set } = useSetPreference(recipeId);
  const texts = t.nutrition.favorites;
  const on = current === 'favorite';
  return (
    <View style={styles.menu}>
      <View>
        {children}
        <Pressable
          testID={`${testID}-more`}
          accessibilityRole="button"
          accessibilityLabel={texts.menuA11y(title)}
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          onPress={() => setOpen((v) => !v)}
          style={({ pressed }) => [
            styles.more,
            {
              borderColor: theme.border,
              backgroundColor: theme.surface,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Icon name="dots" size={18} color={theme.textMuted} />
        </Pressable>
      </View>
      {open ? (
        <View style={styles.actions} testID={`${testID}-actions`}>
          <View style={styles.flex}>
            <Button
              label={texts.favorite}
              icon={on ? 'heart-filled' : 'heart'}
              accessibilityLabel={on ? texts.unfavoriteA11y(title) : texts.favoriteA11y(title)}
              variant={on ? 'primary' : 'secondary'}
              disabled={busy || current === 'hidden'}
              onPress={() =>
                void set(on ? null : 'favorite', on ? texts.removedFavorite : texts.savedFavorite)
              }
              testID={`${testID}-favorite`}
            />
          </View>
          <View style={styles.flex}>
            {current === 'hidden' ? (
              <Button
                label={texts.unhide}
                accessibilityLabel={texts.unhideA11y(title)}
                variant="secondary"
                disabled={busy}
                onPress={() => void set(null, texts.allowed(title))}
                testID={`${testID}-unhide`}
              />
            ) : (
              <Button
                label={texts.hide}
                icon="eye-off"
                accessibilityLabel={texts.hideA11y(title)}
                variant="secondary"
                disabled={busy}
                onPress={() =>
                  void set('hidden', texts.savedHidden(title), {
                    text: `${texts.savedHidden(title)} ${texts.hiddenInPlan}`,
                    tone: 'success',
                  })
                }
                testID={`${testID}-hide`}
              />
            )}
          </View>
        </View>
      ) : null}
      {message ? (
        <Notice tone={message.tone} testID={`${testID}-message`}>
          {message.text}
        </Notice>
      ) : null}
    </View>
  );
}

/** Kleines Kennzeichen „Lieblingsgericht“ (Herz + Wort) für Karten und Mahlzeiten – nie nur Farbe. */
export function FavoriteMark({ testID }: { testID?: string }) {
  const theme = useThemeColors();
  const green = useAreaColors('ernaehrung');
  return (
    <View style={[styles.mark, { backgroundColor: green.surface }]} testID={testID}>
      <Icon name="heart-filled" size={12} color={green.icon} />
      <Text style={[styles.markText, appFont('semibold'), { color: theme.text }]}>
        {t.nutrition.favorites.favoriteMark}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Untereinander in voller Breite: „Lieblingsgericht“ passt ab 320 px nicht in eine halbe Zeile.
  flex: { width: '100%' },
  actions: { gap: spacing.sm },
  heart: {
    width: MIN_ROW,
    height: MIN_ROW,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: { gap: spacing.xs },
  mark: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  markText: { fontSize: fontSize.xs, lineHeight: 16 },
  // Oben rechts auf der Mahlzeit-Karte; 44 × 44 Tippfläche.
  more: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: MIN_ROW,
    height: MIN_ROW,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
