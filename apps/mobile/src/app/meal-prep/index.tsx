import {
  addDays,
  defaultMealPrepWeekStart,
  isoDateSchema,
  mealPlanWeekEditable,
  startOfIsoWeek,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DemoBanner, NutritionGate, nutritionReady } from '@/components/nutrition';
import { Screen } from '@/components/screen';
import { Body, Button, Heading, LoadingState, MIN_TOUCH, Notice } from '@/components/ui';
import { mealPrepOffers } from '@/data/nutrition-plan';
import { t } from '@/i18n';
import { formatDateDe } from '@/lib/format';
import { useThemeColors } from '@/lib/theme';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';
import { useNutritionWeek } from '@/state/use-nutrition';

/**
 * Meal-Prep-Wochenpläne (docs/PLAN-PHASE-5.md 19.6, KONZEPT 6.7, Etappe N5b): Liste in fester Reihenfolge; ein Plan,
 * der für die Person nicht passt, ist ausgegraut mit „Passt nicht zu deinen Angaben“ – OHNE Grund und ohne
 * Rezeptnamen (kein Rückschluss auf Unverträglichkeit oder Schwangerschaft). Laufende bzw. nächste Woche (ab Samstag
 * die nächste). Keine kcal. Testmodus: alle Pläne offen (Gratis/Premium mit Phase 7).
 */
export default function MealPrepListScreen() {
  const router = useRouter();
  const app = useApp();
  const params = useLocalSearchParams<{ woche?: string }>();
  const today = useToday();
  const currentWeek = startOfIsoWeek(today);
  const [choice, setChoice] = useState<string | null>(() =>
    isoDateSchema.safeParse(params.woche).success ? startOfIsoWeek(params.woche as string) : null,
  );
  const fallback = defaultMealPrepWeekStart(today);
  const weekStart = choice !== null && mealPlanWeekEditable(choice, today) ? choice : fallback;
  const view = useNutritionWeek(weekStart);

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
  if (route !== '/today' || !app.rows) {
    return <Redirect href={route as Href} />;
  }
  const texts = t.nutrition.mealPrep;
  const footer = (
    <Button
      label={t.nutrition.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/ernaehrung' as Href))}
    />
  );
  const shell = (children: ReactNode) => (
    <Screen title={texts.title} testID="meal-prep-list" footer={footer}>
      {children}
    </Screen>
  );
  if (!nutritionReady(view) || view.week?.kind !== 'ready' || view.library.kind !== 'ready') {
    return shell(<NutritionGate view={view} />);
  }
  const { library, demo } = view.library.result;
  const offers = mealPrepOffers(view.week, library.mealPrepPlans);
  const nextWeek = addDays(currentWeek, 7);

  return shell(
    <>
      {demo ? <DemoBanner /> : null}
      <Body muted>{texts.intro}</Body>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label={t.nutrition.week.thisWeek}
            variant={weekStart === currentWeek ? 'primary' : 'secondary'}
            onPress={() => setChoice(currentWeek)}
            testID="meal-prep-week-current"
          />
        </View>
        <View style={styles.flex}>
          <Button
            label={t.nutrition.week.nextWeek}
            variant={weekStart === nextWeek ? 'primary' : 'secondary'}
            onPress={() => setChoice(nextWeek)}
            testID="meal-prep-week-next"
          />
        </View>
      </View>
      <Heading level={2}>
        {texts.weekFor(formatDateDe(weekStart), formatDateDe(addDays(weekStart, 6)))}
      </Heading>
      {view.week.plan === null ? (
        <Notice tone="info">{t.nutrition.shopping.noPlan}</Notice>
      ) : library.mealPrepPlans.length === 0 ? (
        <Body muted testID="meal-prep-none">
          {texts.none}
        </Body>
      ) : (
        <>
          {offers.every((o) => !o.offered) ? (
            <Notice tone="info" testID="meal-prep-none-fits">
              {texts.noneFits}
            </Notice>
          ) : null}
          <View style={styles.list} testID="meal-prep-plans">
            {offers.map((offer) => (
              <PlanCard
                key={offer.plan.id}
                title={offer.plan.title_de}
                description={offer.offered ? offer.plan.description_de : null}
                offered={offer.offered}
                chosen={offer.chosen}
                testID={`meal-prep-plan-${offer.plan.id}`}
                onOpen={() =>
                  router.push(
                    `/meal-prep/${encodeURIComponent(offer.plan.id)}?woche=${weekStart}` as Href,
                  )
                }
              />
            ))}
          </View>
        </>
      )}
      <Body muted>{texts.safetyNote}</Body>
    </>,
  );
}

function PlanCard({
  title,
  description,
  offered,
  chosen,
  onOpen,
  testID,
}: {
  title: string;
  description: string | null;
  offered: boolean;
  chosen: boolean;
  onOpen: () => void;
  testID: string;
}) {
  const theme = useThemeColors();
  const texts = t.nutrition.mealPrep;
  if (!offered) {
    // Ausgegraut, nicht antippbar, ohne Grund (19.6 Nr. 2).
    return (
      <View
        style={[styles.card, styles.greyed, { borderColor: theme.border }]}
        testID={testID}
        accessibilityState={{ disabled: true }}
      >
        <Text style={[styles.title, { color: theme.textMuted }]}>{title}</Text>
        <Text style={[styles.detail, { color: theme.textMuted }]} testID={`${testID}-not-offered`}>
          {texts.notOffered}
        </Text>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texts.planA11y(title)}
      onPress={onOpen}
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: chosen ? theme.primary : theme.border,
          borderWidth: chosen ? 3 : 1,
          backgroundColor: pressed ? theme.background : theme.surface,
        },
      ]}
    >
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {description ? (
        <Text style={[styles.detail, { color: theme.textMuted }]}>{description}</Text>
      ) : null}
      {chosen ? (
        <Text style={[styles.chosen, { color: theme.text }]} testID={`${testID}-chosen`}>
          {`✓ ${texts.chosen}`}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  list: { gap: spacing.sm },
  card: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  greyed: { opacity: 0.6 },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  detail: { fontSize: fontSize.sm, lineHeight: 20 },
  chosen: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
