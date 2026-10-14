import {
  mealRatable,
  ratingExclusionLastDay,
  recipeRatingFromChoice,
  recipeRatingLimitReached,
} from '@fitnessapp/core';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Card, Heading, Notice } from '@/components/ui';
import { ratingForRecipe, ratingsFromRows } from '@/data/rating-rows';
import { t } from '@/i18n';
import { formatDateDe } from '@/lib/format';
import { useApp } from '@/state/app-state';

/**
 * „Wie war’s?“ in der Rezeptansicht einer geplanten Mahlzeit (KONZEPT 6.10, Etappe N10): nur „nach dem Essen“ (Tag ≤
 * heute). Daumen hoch speichert sofort; Daumen runter öffnet die Auswahl des Grunds (`/rezept/bewerten`). Die eigene
 * Bewertung ist sichtbar und lässt sich zurücknehmen – sonst wird sie nirgends angezeigt. Keine Zahlen (kcal) hier.
 */
export function RatingCard({
  recipeId,
  title,
  date,
  slot,
  today,
}: {
  recipeId: string;
  title: string;
  date: string;
  slot: string;
  today: string;
}) {
  const app = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);
  const texts = t.nutrition.rating;
  if (!app.rows) return null;
  const current = ratingForRecipe(app.rows, recipeId);

  if (!mealRatable(date, today)) {
    return (
      <Card>
        <Heading level={2}>{texts.heading}</Heading>
        <Body muted testID="rating-not-yet">
          {texts.notYet}
        </Body>
      </Card>
    );
  }

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ text: success, tone: 'success' });
    } catch {
      setMessage({ text: texts.saveFailed, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  const rateUp = () => {
    // Obergrenze: verständliche Meldung statt „noch einmal versuchen“ (Wächter N10 H4).
    if (app.rows !== null && recipeRatingLimitReached(ratingsFromRows(app.rows), recipeId)) {
      setMessage({ text: texts.limit, tone: 'danger' });
      return Promise.resolve();
    }
    return run(
      () =>
        app.saveRecipeRating(
          recipeId,
          recipeRatingFromChoice({ recipeId, value: 'up', choice: null, ratedOn: today }).rating,
        ),
      texts.savedUp,
    );
  };
  const undo = () => run(() => app.saveRecipeRating(recipeId, null), texts.undone);

  return (
    <Card>
      <Heading level={2}>{texts.heading}</Heading>
      <Body muted>{texts.intro}</Body>
      {current !== null ? (
        <Body testID="rating-current">
          {current.value === 'up'
            ? texts.current.up
            : texts.current.down(formatDateDe(ratingExclusionLastDay(current.ratedOn)))}
        </Body>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button
            label={texts.up}
            accessibilityLabel={texts.upA11y(title)}
            variant={current?.value === 'up' ? 'primary' : 'secondary'}
            loading={busy}
            disabled={current?.value === 'up'}
            onPress={() => void rateUp()}
            testID="rating-up"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={texts.down}
            accessibilityLabel={texts.downA11y(title)}
            variant={current?.value === 'down' ? 'primary' : 'secondary'}
            disabled={busy}
            onPress={() =>
              router.push(
                `/rezept/bewerten?id=${encodeURIComponent(recipeId)}&tag=${date}&platz=${encodeURIComponent(
                  slot,
                )}` as Href,
              )
            }
            testID="rating-down"
          />
        </View>
      </View>
      {current !== null ? (
        <Button
          label={texts.undo}
          variant="secondary"
          disabled={busy}
          onPress={() => void undo()}
          testID="rating-undo"
        />
      ) : null}
      {message ? (
        <Notice tone={message.tone} testID="rating-message">
          {message.text}
        </Notice>
      ) : null}
    </Card>
  );
}
