import {
  type MonthReview,
  monthOf,
  monthReviewOffer,
  monthSchema,
  shiftMonth,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import type { WeightTrendVisibility } from '@/data/review';
import { t } from '@/i18n';
import { monthName } from '@/i18n/de-review';
import { formatDateDe, formatDecimal, formatKg } from '@/lib/format';
import { decodeRouteParam } from '@/lib/route-param';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useMonthReview, useMonthReviewOpened } from '@/state/use-month-review';

/**
 * Monatsrückblick (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 3): Training gemacht/geplant, Kilometer je Sportart,
 * größte Kraft-Steigerungen, Essen als Anzahlen, Gewichtstrend (nur mit Einwilligung und nicht ausgeblendet).
 * Neutral, ohne Serien. „Als PDF sichern“ öffnet die Druckansicht (Gesundheitsdaten dort nur per Schalter).
 * Rechnet nichts selbst (`monthReview()` aus packages/core).
 */
export default function MonthReviewScreen() {
  const params = useLocalSearchParams<{ monat?: string }>();
  const router = useRouter();
  const app = useApp();
  const today = useToday();
  const current = monthOf(today);
  const raw = params.monat === undefined ? null : decodeRouteParam(params.monat);
  const parsed = raw === null ? null : monthSchema.safeParse(raw);
  const invalid = parsed !== null && (!parsed.success || parsed.data > current);
  // Ohne Angabe: in der ersten Woche der Vormonat, sonst der laufende Monat.
  const month =
    parsed?.success && !invalid ? parsed.data : (monthReviewOffer(today, null) ?? current);
  const state = useMonthReview(month);
  const [, markOpened] = useMonthReviewOpened();
  useEffect(() => {
    if (month < current) markOpened(month);
  }, [month, current, markOpened]);

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
  if (route !== HOME_ROUTE || !app.rows) return <Redirect href={route as Href} />;

  const texts = t.monthReview;
  const since = app.backend.logHistoryStart();
  // Supabase: das Tagebuch liegt erst ab `since` vollständig auf dem Gerät.
  const earliest =
    since === null ? null : since.endsWith('-01') ? monthOf(since) : shiftMonth(monthOf(since), 1);
  const tooOld = earliest !== null && month < earliest;
  const previous =
    earliest !== null && shiftMonth(month, -1) < earliest ? null : shiftMonth(month, -1);
  const next = month >= current ? null : shiftMonth(month, 1);
  const go = (m: string) => router.replace(`/monatsrueckblick?monat=${m}` as Href);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/fortschritt' as Href));

  const shell = (children: ReactNode) => (
    <Screen
      area="fortschritt"
      icon="calendar"
      title={texts.title}
      intro={texts.intro}
      testID="month-review"
      footer={<Button label={texts.back} variant="secondary" onPress={back} />}
    >
      {invalid ? <Notice tone="warning">{texts.invalidMonth}</Notice> : null}
      <View style={styles.header}>
        <Heading level={2}>{monthName(month)}</Heading>
      </View>
      <View style={styles.pager}>
        <View style={styles.pagerButton}>
          <Button
            label={texts.previous}
            accessibilityLabel={texts.previousA11y}
            variant="secondary"
            disabled={previous === null}
            onPress={() => previous && go(previous)}
            testID="month-review-prev"
          />
        </View>
        <View style={styles.pagerButton}>
          <Button
            label={texts.next}
            accessibilityLabel={texts.nextA11y}
            variant="secondary"
            disabled={next === null}
            onPress={() => next && go(next)}
            testID="month-review-next"
          />
        </View>
      </View>
      {children}
    </Screen>
  );

  if (tooOld) return shell(<Notice tone="info">{texts.tooOld}</Notice>);
  if (state.kind === 'loading') return shell(<LoadingState label={texts.loading} />);
  if (state.kind === 'error') {
    return shell(
      <Notice tone="danger" testID="month-review-error">
        {texts.computeFailed}
      </Notice>,
    );
  }
  const review = state.review;
  return shell(
    <>
      {review.timing === 'current' ? (
        <Body muted testID="month-review-running">
          {texts.running(formatDateDe(today))}
        </Body>
      ) : null}
      {review.empty ? (
        <Notice tone="info" testID="month-review-empty">
          {texts.empty}
        </Notice>
      ) : null}
      <ReviewSections review={review} weight={state.weight} />
      <Button
        label={texts.pdf}
        accessibilityHint={texts.pdfHint}
        onPress={() => router.push(`/monatsrueckblick/drucken?monat=${month}` as Href)}
        testID="month-review-pdf"
      />
    </>,
  );
}

function ReviewSections({
  review,
  weight,
}: {
  review: MonthReview;
  weight: WeightTrendVisibility;
}) {
  const texts = t.monthReview;
  const tr = review.training;
  return (
    <>
      <Heading level={2}>{texts.trainingTitle}</Heading>
      <Card>
        <View style={styles.lines} testID="month-review-training">
          {tr.planned === 0 && tr.free === 0 ? <Body>{texts.trainingNone}</Body> : null}
          {tr.planned > 0 ? <Body>{texts.trainingDone(tr.done, tr.planned)}</Body> : null}
          {tr.missed > 0 ? <Body muted>{texts.trainingMissed(tr.missed)}</Body> : null}
          {tr.open > 0 ? <Body muted>{texts.trainingOpen(tr.open)}</Body> : null}
          {tr.free > 0 ? <Body>{texts.trainingFree(tr.free)}</Body> : null}
        </View>
      </Card>

      {review.distances.length > 0 ? (
        <>
          <Heading level={2}>{texts.distanceTitle}</Heading>
          <Card>
            <View style={styles.lines} testID="month-review-distances">
              {review.distances.map((d) => (
                <Body key={d.modality}>
                  {`${t.print.modalities[d.modality]}: ${texts.km(formatDecimal(d.km))}`}
                </Body>
              ))}
            </View>
          </Card>
        </>
      ) : null}

      {review.strength.length > 0 ? (
        <>
          <Heading level={2}>{texts.strengthTitle}</Heading>
          <Card>
            <View style={styles.lines} testID="month-review-strength">
              {review.strength.map((s) => (
                <View key={s.exerciseId}>
                  <Body>{s.exerciseName}</Body>
                  <Body muted>
                    {texts.strengthRow(
                      texts.set(formatKg(s.before.weightKg), s.before.reps),
                      texts.set(formatKg(s.best.weightKg), s.best.reps),
                    )}
                  </Body>
                </View>
              ))}
              <Body muted>{texts.strengthNote}</Body>
            </View>
          </Card>
        </>
      ) : null}

      <Heading level={2}>{texts.foodTitle}</Heading>
      <Card>
        <View style={styles.lines} testID="month-review-food">
          {review.food.kind === 'unavailable' ? (
            <Body muted>{texts.foodUnavailable}</Body>
          ) : (
            <>
              <Body>{texts.foodEntryDays(review.food.entryDays, review.food.days)}</Body>
              {review.food.meals !== null ? (
                <Body>{texts.foodMeals(review.food.meals.eaten, review.food.meals.planned)}</Body>
              ) : null}
            </>
          )}
        </View>
      </Card>

      {weight === 'visible' ? (
        <>
          <Heading level={2}>{texts.weightTitle}</Heading>
          <Card>
            <View style={styles.lines} testID="month-review-weight">
              {review.weight.kind === 'trend' ? (
                <Body>
                  {texts.weightTrend(
                    formatDateDe(review.weight.startDate),
                    formatDecimal(Math.round(review.weight.startKg * 10) / 10),
                    formatDateDe(review.weight.endDate),
                    formatDecimal(Math.round(review.weight.endKg * 10) / 10),
                  )}
                </Body>
              ) : (
                <Body muted>{texts.weightTooFew}</Body>
              )}
            </View>
          </Card>
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  pager: { flexDirection: 'row', gap: spacing.sm },
  pagerButton: { flex: 1 },
  lines: { gap: spacing.xs },
});
