import {
  addDays,
  isoDateSchema,
  mealPlanWeekEditable,
  type RecipeSwipeCard,
  type RecipeSwipeChoice,
  type RecipeSwipeDecision,
  recipeSwipePreferenceKind,
  recipeSwipeUndoPreference,
  startOfIsoWeek,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ConsentBlockedNotice, DemoBanner } from '@/components/nutrition';
import { RecipeSwipeDeck } from '@/components/recipe-swipe-deck';
import { Screen } from '@/components/screen';
import { Body, Button, Card, ErrorState, Heading, LoadingState, Notice } from '@/components/ui';
import { preferenceForRecipe } from '@/data/recipe-preference-rows';
import { recipeSwipeStackForPerson } from '@/data/recipe-swipe';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { formatDateDe } from '@/lib/format';
import { useRecipeSwipeSeen } from '@/lib/recipe-swipe-seen';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useMealPlanActions, useNutritionWeek } from '@/state/use-nutrition';

/**
 * Ernährung → Wochenplan → „Gerichte für nächste Woche wischen“ (Gründer-Wunsch 01.11.2026,
 * docs/PLAN-REZEPT-SWIPE.md): Kartenstapel wie Rezept-Spielkarten. Rechts = mag ich (Herz + Wochenplan), links = mag
 * ich nicht („Nie wieder“, zurückholbar unter „Ausgeblendete Gerichte“), oben = neutral (nur gesehen). Am Ende bzw.
 * mit „Fertig“: „Wochenplan aktualisieren“ legt die gemochten Gerichte in die Woche. Rechnet nichts selbst – Stapel,
 * Wirkung und Grenzen stehen in packages/core (`recipeSwipeStack`, `placeRecipeSwipePicks`).
 */
export default function RecipeSwipeScreen() {
  const router = useRouter();
  const app = useApp();
  const today = useToday();
  const params = useLocalSearchParams<{ woche?: string }>();
  const nextWeek = addDays(startOfIsoWeek(today), 7);
  const requested = isoDateSchema.safeParse(params.woche).success
    ? startOfIsoWeek(params.woche as string)
    : nextWeek;
  const weekStart = mealPlanWeekEditable(requested, today) ? requested : nextWeek;
  const view = useNutritionWeek(weekStart);
  const actions = useMealPlanActions(view.week);
  const seen = useRecipeSwipeSeen(app.session?.userId ?? null, weekStart);

  // Stapel einmal beim Öffnen festhalten – Entscheidungen ändern die Vorlieben, die Karten bleiben stehen.
  const [deck, setDeck] = useState<
    { weekStart: string; cards: RecipeSwipeCard[] } | 'error' | null
  >(null);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<RecipeSwipeDecision[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);
  const [applied, setApplied] = useState(false);

  const ready =
    app.rows !== null &&
    view.week?.kind === 'ready' &&
    view.library.kind === 'ready' &&
    seen.loaded &&
    (deck === null || (deck !== 'error' && deck.weekStart !== weekStart));
  useEffect(() => {
    if (!ready || app.rows === null || view.week?.kind !== 'ready') return;
    if (view.library.kind !== 'ready') return;
    try {
      const stack = recipeSwipeStackForPerson({
        library: view.library.result.library,
        rows: app.rows,
        versions: app.versions,
        week: view.week,
        weekStart,
        allowDrafts: app.backend.mode === 'local',
        seen: seen.seen,
      });
      setDeck({ weekStart, cards: stack.kind === 'ok' ? stack.cards : [] });
    } catch {
      setDeck('error');
    }
    setIndex(0);
    setHistory([]);
    setApplied(false);
    // Nur beim ersten Mal je Woche (ready), nicht nach jeder Entscheidung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, weekStart]);

  const liked = useMemo(
    () => history.filter((d) => d.choice === 'like').map((d) => d.recipeId),
    [history],
  );

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
  const rows = app.rows;
  const texts = t.recipeSwipe;
  const toWeek = () => router.replace(`/ernaehrung/woche?woche=${weekStart}` as Href);
  const footer = (
    <Button
      label={t.nutrition.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : toWeek())}
    />
  );
  const shell = (children: ReactNode) => (
    <Screen
      area="ernaehrung"
      icon="recipe"
      title={texts.title}
      intro={texts.intro}
      testID="recipe-swipe"
      footer={footer}
    >
      {children}
    </Screen>
  );

  if (view.library.kind === 'unsupported') {
    return shell(<Notice tone="info">{t.nutrition.unsupported}</Notice>);
  }
  if (view.library.kind === 'error' || deck === 'error') {
    return shell(
      <ErrorState
        message={t.nutrition.loadFailed}
        onRetry={() => {
          setDeck(null);
          void app.ensureNutritionLibrary();
        }}
      />,
    );
  }
  if (view.setupMissing) {
    return shell(
      <Card>
        <Body>{t.nutrition.setupNeeded}</Body>
        <Button
          label={t.nutrition.setupButton}
          onPress={() => router.push('/onboarding/nutrition_setup?edit=1' as Href)}
        />
      </Card>,
    );
  }
  if (view.week?.kind === 'incomplete') {
    return shell(<Notice tone="info">{t.nutrition.incomplete}</Notice>);
  }
  if (view.week?.kind === 'blocked') {
    return shell(<ConsentBlockedNotice reason={view.week.reason} />);
  }
  if (view.week?.kind === 'error') {
    return shell(<Notice tone="danger">{t.nutrition.computeFailed}</Notice>);
  }
  if (deck === null || deck.weekStart !== weekStart || view.library.kind !== 'ready') {
    return shell(<LoadingState label={t.nutrition.loading} />);
  }

  const cards = deck.cards;
  const front = cards[index];
  const last = history[history.length - 1];
  const lastTitle =
    last === undefined ? '' : (cards.find((c) => c.recipeId === last.recipeId)?.titleDe ?? '');

  async function decide(card: RecipeSwipeCard, choice: RecipeSwipeChoice) {
    const decision: RecipeSwipeDecision = {
      recipeId: card.recipeId,
      choice,
      previous: preferenceForRecipe(rows, card.recipeId),
    };
    setMessage(null);
    setApplied(false);
    setHistory((h) => [...h, decision]);
    setIndex((i) => i + 1);
    const kind = recipeSwipePreferenceKind(choice);
    if (kind === null) {
      seen.mark(card.recipeId, true);
      return;
    }
    try {
      await app.setRecipePreference(card.recipeId, kind);
    } catch (caught) {
      // Nicht gespeichert → Karte zurück, damit nichts Falsches „gemerkt“ aussieht.
      setHistory((h) => h.filter((d) => d !== decision));
      setIndex((i) => Math.max(0, i - 1));
      setMessage({ text: errorText(caught) || texts.failed, tone: 'danger' });
    }
  }

  async function undo() {
    if (last === undefined) return;
    setBusy(true);
    setMessage(null);
    setApplied(false);
    try {
      const restore = recipeSwipeUndoPreference(last);
      if (restore === undefined) seen.mark(last.recipeId, false);
      else await app.setRecipePreference(last.recipeId, restore);
      setHistory((h) => h.slice(0, -1));
      setIndex((i) => Math.max(0, i - 1));
    } catch (caught) {
      setMessage({ text: errorText(caught) || texts.failed, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    setMessage(null);
    if (actions === null) {
      setMessage({ text: texts.noPlan, tone: 'success' });
      setApplied(true);
      return;
    }
    setBusy(true);
    try {
      const outcome = await actions.placeSwipePicks(liked);
      setMessage({
        text: texts.applied(outcome.placed + outcome.alreadyPlanned, outcome.unplaced),
        tone: 'success',
      });
      setApplied(true);
    } catch (caught) {
      setMessage({ text: errorText(caught) || texts.failed, tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  const demo = view.library.result.demo;
  const remaining = Math.max(0, cards.length - index);

  return shell(
    <>
      {demo ? <DemoBanner /> : null}
      <Heading level={2}>
        {texts.forWeek(formatDateDe(weekStart), formatDateDe(addDays(weekStart, 6)))}
      </Heading>
      {message ? (
        <Notice tone={message.tone} testID="recipe-swipe-message">
          {message.text}
        </Notice>
      ) : null}

      {cards.length === 0 ? (
        <Card>
          <Body testID="recipe-swipe-empty">{texts.empty}</Body>
          <Body muted>{texts.emptyHidden}</Body>
          <Button
            label={texts.hiddenLink}
            variant="secondary"
            onPress={() => router.push('/ernaehrung/ausgeblendet' as Href)}
            testID="recipe-swipe-hidden"
          />
          <Button label={texts.toWeek} onPress={toWeek} testID="recipe-swipe-to-week" />
        </Card>
      ) : front !== undefined ? (
        <>
          <View style={styles.status}>
            <Body muted testID="recipe-swipe-remaining">
              {texts.remaining(remaining)}
            </Body>
            <Body testID="recipe-swipe-liked">{texts.liked(liked.length)}</Body>
          </View>
          <RecipeSwipeDeck
            cards={cards}
            index={index}
            showNumbers={view.showNumbers}
            onDecide={(card, choice) => void decide(card, choice)}
            disabled={busy}
          />
          {Platform.OS === 'web' ? <Body muted>{texts.keyboardHint}</Body> : null}
        </>
      ) : (
        <Card>
          <Heading level={2}>{texts.doneTitle}</Heading>
          <Body testID="recipe-swipe-done">{texts.doneText(liked.length)}</Body>
        </Card>
      )}

      {last !== undefined ? (
        <Button
          label={texts.undo}
          accessibilityLabel={texts.undoA11y(lastTitle)}
          variant="secondary"
          icon="swap"
          onPress={() => void undo()}
          disabled={busy}
          testID="recipe-swipe-undo"
        />
      ) : null}
      {liked.length > 0 && !applied ? (
        <Button
          label={front === undefined ? texts.apply : texts.applyEarly}
          accessibilityHint={texts.applyHint}
          onPress={() => void apply()}
          loading={busy}
          testID="recipe-swipe-apply"
        />
      ) : null}
      {applied || (front === undefined && cards.length > 0) ? (
        <Button
          label={texts.toWeek}
          variant={applied ? 'primary' : 'secondary'}
          onPress={toWeek}
          testID="recipe-swipe-to-week"
        />
      ) : null}
      <Body muted>{t.nutrition.disclaimer}</Body>
    </>,
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
});
