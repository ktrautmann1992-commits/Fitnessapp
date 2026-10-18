import {
  addFoodDislikes,
  type FoodDislikeChoice,
  foodDislikeChoices,
  isoDateSchema,
  mealRatable,
  ratingExclusionLastDay,
  RECIPE_RATING_CHOICES,
  type RecipeRatingChoice,
  recipeRatingFromChoice,
  recipeRatingLimitReached,
} from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';

import { ConsentBlockedNotice, DemoBanner } from '@/components/nutrition';
import { Screen } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  Checkbox,
  ChoiceList,
  ErrorState,
  LoadingState,
  Notice,
} from '@/components/ui';
import { recipeForPerson } from '@/data/nutrition-plan';
import { dislikedFoodsFromRows, ratingsFromRows } from '@/data/rating-rows';
import { t } from '@/i18n';
import { formatDateDe } from '@/lib/format';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useNutritionWeek } from '@/state/use-nutrition';

/** Auswahl „kein Grund“ in der Liste (nur Ansicht). */
const NO_REASON = 'none';
type ReasonChoice = RecipeRatingChoice | typeof NO_REASON;

/**
 * Daumen runter mit optionalem Grund (KONZEPT 6.10, docs/PLAN-PHASE-5.md 19.7 N10) – gratis, ohne KI. Die Regeln stehen
 * in packages/core (`recipeRatingFromChoice`, `foodDislikeChoices`, `addFoodDislikes`).
 *
 * Datenschutz (Art. 9): Der Grund „Unverträglich“ lebt NUR im Zustand dieser Ansicht – nicht in der Adresse, nicht im
 * Gerätespeicher, nicht in Meldungen oder Logs. Gespeichert wird dann „Daumen runter“ ohne Grund; danach folgt der
 * Dialog „Zutaten als ‚mag ich nicht‘ übernehmen?“ mit einzeln wählbaren Zutaten, NICHTS vorausgewählt.
 * Keine Zahlen (kcal) in dieser Ansicht.
 */
export default function RecipeRatingScreen() {
  const router = useRouter();
  const app = useApp();
  const params = useLocalSearchParams<{ id?: string; tag?: string; platz?: string }>();
  const date = isoDateSchema.safeParse(params.tag).success ? (params.tag as string) : null;
  const slot = typeof params.platz === 'string' && params.platz.length > 0 ? params.platz : null;
  const today = useToday();
  const view = useNutritionWeek(date ?? today);
  const [choice, setChoice] = useState<ReasonChoice>(NO_REASON);
  const [phase, setPhase] = useState<
    | { kind: 'reason' }
    | { kind: 'dislikes'; choices: readonly FoodDislikeChoice[] }
    | { kind: 'done'; message: string }
  >({ kind: 'reason' });
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const texts = t.nutrition.rating;
  const recipeHref =
    `/rezept/${encodeURIComponent(params.id ?? '')}?tag=${date ?? ''}&platz=${encodeURIComponent(
      slot ?? '',
    )}` as Href;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(recipeHref));
  const footer = <Button label={texts.back} variant="secondary" onPress={goBack} />;
  const shell = (children: ReactNode, title: string = texts.title) => (
    <Screen title={title} testID="rating" footer={footer}>
      {children}
    </Screen>
  );

  // Nach dem Speichern: unabhängig davon, ob die Mahlzeit nach einer Abneigung noch im Plan steht.
  if (phase.kind === 'done') {
    return shell(
      <>
        <Notice tone="success" testID="rating-done">
          {phase.message}
        </Notice>
        <Body muted>{texts.planStays}</Body>
        <Button
          label={texts.toPlan}
          onPress={() => router.dismissTo(`/ernaehrung?tag=${date ?? today}` as Href)}
          testID="rating-to-plan"
        />
      </>,
    );
  }

  if (phase.kind === 'dislikes') {
    const dislikeTexts = texts.dislikes;
    async function apply() {
      const update = addFoodDislikes(dislikedFoodsFromRows(rows), selected);
      if (!update.ok) {
        setError(update.reason === 'limit' ? dislikeTexts.limit : dislikeTexts.failed);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await app.saveFoodDislikes(update.dislikes);
        setPhase({ kind: 'done', message: dislikeTexts.applied(selected.length) });
      } catch {
        setError(dislikeTexts.failed);
      } finally {
        setBusy(false);
      }
    }
    return shell(
      <>
        <Body>{dislikeTexts.intro}</Body>
        {phase.choices.length === 0 ? (
          <Notice tone="info" testID="rating-dislikes-none">
            {dislikeTexts.none}
          </Notice>
        ) : (
          <Card>
            {phase.choices.map((c) => (
              <Checkbox
                key={c.foodId}
                label={c.nameDe}
                checked={selected.includes(c.foodId)}
                onChange={(value) =>
                  setSelected((prev) =>
                    value ? [...prev, c.foodId] : prev.filter((id) => id !== c.foodId),
                  )
                }
                testID={`rating-dislike-${c.foodId}`}
              />
            ))}
          </Card>
        )}
        <Notice tone="warning" testID="rating-dislikes-health-hint">
          {dislikeTexts.healthHint}
        </Notice>
        <Button
          label={dislikeTexts.profileButton}
          variant="secondary"
          disabled={busy}
          onPress={() => router.push('/onboarding/nutrition?edit=1' as Href)}
          testID="rating-dislikes-profile"
        />
        {error ? (
          <Notice tone="danger" testID="rating-error">
            {error}
          </Notice>
        ) : null}
        {phase.choices.length > 0 ? (
          <Button
            label={dislikeTexts.apply}
            loading={busy}
            disabled={selected.length === 0}
            onPress={() => void apply()}
            testID="rating-dislikes-apply"
          />
        ) : null}
        <Button
          label={dislikeTexts.skip}
          variant="secondary"
          disabled={busy}
          onPress={() => setPhase({ kind: 'done', message: dislikeTexts.skipped })}
          testID="rating-dislikes-skip"
        />
      </>,
      dislikeTexts.title,
    );
  }

  if (view.library.kind === 'unsupported') {
    return shell(<Notice tone="info">{t.nutrition.unsupported}</Notice>);
  }
  if (view.library.kind === 'error') {
    return shell(
      <ErrorState
        message={t.nutrition.loadFailed}
        onRetry={() => void app.ensureNutritionLibrary()}
      />,
    );
  }
  if (view.library.kind !== 'ready' || view.week === null) {
    return shell(<LoadingState label={t.nutrition.loading} />);
  }
  if (view.week.kind === 'blocked') {
    return shell(<ConsentBlockedNotice reason={view.week.reason} />);
  }
  if (view.week.kind !== 'ready') {
    return shell(
      <Notice tone="info">
        {view.week.kind === 'incomplete' ? t.nutrition.incomplete : t.nutrition.computeFailed}
      </Notice>,
    );
  }
  const { library, demo } = view.library.result;
  const found =
    date === null || slot === null
      ? null
      : recipeForPerson({
          recipeId: String(params.id ?? ''),
          library,
          rows,
          versions: app.versions,
          week: view.week,
          allowDrafts: app.backend.mode === 'local',
          from: { date, slot },
        });
  if (found === null || found.kind === 'not_found' || found.kind === 'not_for_you') {
    return shell(<Notice tone="info">{t.nutrition.recipe.notFound}</Notice>);
  }
  if (found.kind === 'blocked') {
    return shell(<ConsentBlockedNotice reason={found.reason} />);
  }
  const meal = found.plannedMeal;
  if (meal === null || date === null) {
    return shell(<Notice tone="info">{t.nutrition.recipe.notFound}</Notice>);
  }
  if (!mealRatable(date, today)) {
    return shell(
      <Notice tone="info" testID="rating-not-yet">
        {texts.notYet}
      </Notice>,
    );
  }
  const recipe = found.variant.recipe;
  const reasonChoice = choice === NO_REASON ? null : choice;

  async function save() {
    // Regel aus packages/core: „Unverträglich“ → Grund null + Dialog; nichts davon wird gespeichert.
    const decision = recipeRatingFromChoice({
      recipeId: recipe.id,
      value: 'down',
      choice: reasonChoice,
      ratedOn: today,
    });
    // Obergrenze: verständliche Meldung statt „noch einmal versuchen“ (Wächter N10 H4); nichts wird aufgeräumt (G3).
    if (recipeRatingLimitReached(ratingsFromRows(rows), recipe.id)) {
      setError(texts.limit);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await app.saveRecipeRating(recipe.id, decision.rating);
      if (decision.offerFoodDislikes) {
        setSelected([]);
        setPhase({
          kind: 'dislikes',
          choices: foodDislikeChoices(
            meal?.ingredients ?? [],
            library.foods,
            dislikedFoodsFromRows(rows),
          ),
        });
      } else {
        setPhase({ kind: 'done', message: texts.saved });
      }
    } catch {
      setError(texts.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  const options: { value: ReasonChoice; label: string }[] = [
    { value: NO_REASON, label: texts.noReason },
    ...RECIPE_RATING_CHOICES.map((value) => ({ value, label: texts.reasons[value] })),
  ];

  return shell(
    <>
      {demo ? <DemoBanner /> : null}
      <Body testID="rating-recipe">{recipe.title_de}</Body>
      <Body muted>{texts.effect(formatDateDe(ratingExclusionLastDay(today)))}</Body>
      <ChoiceList
        label={texts.reasonHeading}
        options={options}
        value={choice}
        onChange={(value) => setChoice(value)}
      />
      {reasonChoice !== null ? (
        <Body muted testID="rating-reason-effect">
          {texts.reasonEffects[reasonChoice]}
        </Body>
      ) : null}
      <Body muted>{texts.planStays}</Body>
      {error ? (
        <Notice tone="danger" testID="rating-error">
          {error}
        </Notice>
      ) : null}
      <Button label={texts.save} loading={busy} onPress={() => void save()} testID="rating-save" />
    </>,
  );
}
