import { hasRecentlyFinishedSession, wallClockInTimeZone } from '@fitnessapp/core';
import { type Href, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { MealRow } from '@/components/nutrition';
import { Body, Button, Card, Heading } from '@/components/ui';
import { postWorkoutMealFromWeek } from '@/data/post-workout-meal';
import { t } from '@/i18n';
import { extraLine, postWorkoutNowLines } from '@/lib/training-timeline-format';
import { useMinuteClock } from '@/lib/use-minute-clock';
import { useApp } from '@/state/app-state';
import { type NutritionView, useNutritionWeek } from '@/state/use-nutrition';

/**
 * Karte „Nach dem Training: Das solltest du jetzt essen“ (Gründer-Wunsch 06.11.2026, docs/PLAN-NAEHRSTOFF-TIMING.md
 * 6a): die Mahlzeit „nach dem Training“ aus dem (an das Training angepassten) Essensplan mit Eiweiß/Kohlenhydraten dieses
 * Platzes. Rechnet nichts – OB und WELCHE Mahlzeit entscheidet packages/core (`postWorkoutMealNow`).
 */
const T = t.trainingMeals.postNow;

/**
 * Für Bildschirme ohne eigene Ernährungs-Ansicht (Heute, Ende eines Trainings): rechnet den Essensplan nur, wenn ein
 * erledigter Eintrag vor höchstens 3 Stunden endete (`hasRecentlyFinishedSession`).
 */
export function PostWorkoutMealGate({ showNutritionLink = true }: { showNutritionLink?: boolean }) {
  const app = useApp();
  const nowMs = useMinuteClock();
  const rows = app.rows;
  if (!app.backend.supportsNutrition || rows === null || rows.nutritionSetup === null) return null;
  if (!hasRecentlyFinishedSession(rows.sessionLogs, nowMs)) return null;
  return <OwnWeekCard showNutritionLink={showNutritionLink} />;
}

function OwnWeekCard({ showNutritionLink }: { showNutritionLink: boolean }) {
  const view = useNutritionWeek();
  return <PostWorkoutMealCard view={view} showNutritionLink={showNutritionLink} />;
}

/** Mit vorhandener Ernährungs-Ansicht (Reiter Ernährung, heutiger Tag). */
export function PostWorkoutMealCard({
  view,
  showNutritionLink = false,
}: {
  view: NutritionView;
  showNutritionLink?: boolean;
}) {
  const app = useApp();
  const router = useRouter();
  const nowMs = useMinuteClock();
  const rows = app.rows;
  if (rows === null || view.library.kind !== 'ready') return null;
  const wall = wallClockInTimeZone(nowMs);
  if (wall.date !== view.today) return null;
  const result = postWorkoutMealFromWeek({
    week: view.week,
    rows,
    versions: app.versions,
    today: view.today,
    nowMinutes: wall.minutes,
    showNumbers: view.showNumbers,
  });
  if (result === null) return null;
  const { now, plannedMeal } = result;
  const lines = postWorkoutNowLines(now);
  const extra = extraLine(now);
  const foods = view.library.result.library.foods;
  return (
    <Card>
      <View style={styles.gap} testID="post-workout-meal">
        <Heading level={2}>{T.title}</Heading>
        <Body muted testID="post-workout-meal-when">
          {lines.when}
        </Body>
        <Body>{lines.intro}</Body>
        {plannedMeal !== null ? (
          <View testID="post-workout-meal-dish">
            <MealRow
              meal={plannedMeal}
              showNumbers={view.showNumbers}
              foodName={(id) => foods.get(id)?.name_de ?? id}
              onOpen={() =>
                router.push(
                  `/rezept/${encodeURIComponent(plannedMeal.recipeId)}?tag=${now.date}&platz=${plannedMeal.slot}` as Href,
                )
              }
            />
          </View>
        ) : null}
        {extra !== null ? <Body testID="post-workout-meal-extra">{extra}</Body> : null}
        <Body testID="post-workout-meal-targets" accessibilityLabel={lines.targetsA11y}>
          {lines.targets}
        </Body>
        {showNutritionLink ? (
          <Button
            label={T.openNutrition}
            variant="secondary"
            onPress={() => router.push('/ernaehrung' as Href)}
            testID="post-workout-meal-open"
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 8 },
});
