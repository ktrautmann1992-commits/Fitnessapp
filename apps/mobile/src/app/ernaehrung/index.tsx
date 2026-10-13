import {
  addDays,
  isoDateSchema,
  mealsInDayOrder,
  type NutritionNoticeCode,
  type PlannedMealDay,
} from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import {
  CapsExplanation,
  ConsentBlockedNotice,
  DemoBanner,
  EatingHelpNotice,
  EmptySlotRow,
  MacroBars,
  MealRow,
  NutritionNotices,
} from '@/components/nutrition';
import { Screen } from '@/components/screen';
import { Body, Button, Card, ErrorState, Heading, LoadingState, Notice } from '@/components/ui';
import { t } from '@/i18n';
import { todayIso } from '@/lib/format';
import { formatKcal, visibleNotices } from '@/lib/nutrition-format';
import { dayLabel } from '@/lib/plan-format';
import { useApp } from '@/state/app-state';
import { healthConsentStatus, resolveEntryRoute } from '@/state/flow';
import { useNutritionWeek } from '@/state/use-nutrition';

/**
 * Ernährung – Tag (docs/PLAN-PHASE-5.md 8.2 Nr. 2, Etappe N4): Ziel + Makro-Balken (ausblendbar), Mahlzeiten mit
 * Portion, Nährwerten und Rolle, Ergänzungs-Snacks gekennzeichnet, Hinweise (Schutzgrenzen in einfachen Worten),
 * Blättern über die Woche, alle Zustände (8.3). Rechnet nichts selbst – Ziele und Plan kommen aus packages/core.
 * „Rezept tauschen“, Wochenansicht und Einkaufsliste folgen mit Etappe N5.
 */
export default function NutritionDayScreen() {
  const router = useRouter();
  const app = useApp();
  const params = useLocalSearchParams<{ tag?: string }>();
  const today = todayIso();
  const [selected, setSelected] = useState(() =>
    isoDateSchema.safeParse(params.tag).success ? (params.tag as string) : today,
  );
  const view = useNutritionWeek(selected);

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
  const rows = app.rows;
  const consent = healthConsentStatus(rows, app.versions);
  const footer = (
    <Button
      label={t.nutrition.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
    />
  );
  const shell = (children: ReactNode) => (
    <Screen title={t.nutrition.title} testID="nutrition-day" footer={footer}>
      {children}
    </Screen>
  );

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
  if (view.setupMissing) {
    return shell(
      <Card>
        <Body>{t.nutrition.setupNeeded}</Body>
        <Button
          label={t.nutrition.setupButton}
          onPress={() => router.push('/onboarding/nutrition_setup?edit=1' as Href)}
          testID="nutrition-setup"
        />
      </Card>,
    );
  }
  if (view.library.kind !== 'ready' || view.week === null) {
    return shell(<LoadingState label={t.nutrition.loading} />);
  }
  if (view.week.kind === 'incomplete') {
    return shell(<Notice tone="info">{t.nutrition.incomplete}</Notice>);
  }
  if (view.week.kind === 'blocked') {
    return shell(<ConsentBlockedNotice reason={view.week.reason} />);
  }
  if (view.week.kind === 'error') {
    return shell(<Notice tone="danger">{t.nutrition.computeFailed}</Notice>);
  }

  const { targets, plan } = view.week;
  const { demo, demoAvailable } = view.library.result;
  const dayTargets = targets.days.find((d) => d.date === selected) ?? targets.days[0];
  if (!dayTargets) return shell(<Notice tone="danger">{t.nutrition.computeFailed}</Notice>);
  const day: PlannedMealDay | null = plan?.days.find((d) => d.date === dayTargets.date) ?? null;
  const first = targets.weekStart;
  const last = addDays(first, 6);
  const foods = view.library.result.library.foods;
  const foodName = (id: string) => foods.get(id)?.name_de ?? id;
  const notices = visibleNotices(dayTargets.notices, view.showNumbers);
  const numbers = view.showNumbers && dayTargets.targetKcal !== null;
  const status = day?.status ?? (dayTargets.mode === 'no_targets' ? 'no_targets' : null);

  return shell(
    <>
      {demo ? <DemoBanner onDisable={() => void app.setNutritionDemo(false)} /> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button
            label={t.nutrition.previousDay}
            variant="secondary"
            disabled={dayTargets.date <= first}
            onPress={() => setSelected(addDays(dayTargets.date, -1))}
            testID="nutrition-prev"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={t.nutrition.nextDay}
            variant="secondary"
            disabled={dayTargets.date >= last}
            onPress={() => setSelected(addDays(dayTargets.date, 1))}
            testID="nutrition-next"
          />
        </View>
      </View>
      <View style={{ gap: 4 }} testID="nutrition-day-header">
        <Heading level={2}>
          {dayTargets.date === today
            ? `${t.nutrition.today}, ${dayLabel(dayTargets.date)}`
            : dayLabel(dayTargets.date)}
        </Heading>
        {status ? <Body muted>{t.nutrition.dayStatus[status]}</Body> : null}
      </View>

      {numbers && dayTargets.targetKcal !== null ? (
        <Card>
          <Body testID="nutrition-target">
            {t.nutrition.target(formatKcal(dayTargets.targetKcal))}
          </Body>
          {day && day.status === 'complete' ? (
            <Body muted>{t.nutrition.dayTotal(formatKcal(day.totals.kcal))}</Body>
          ) : null}
          {dayTargets.proteinG !== null &&
          dayTargets.carbsG !== null &&
          dayTargets.fatG !== null ? (
            <MacroBars
              planned={{
                protein: day?.totals.protein_g ?? 0,
                carbs: day?.totals.carbs_g ?? 0,
                fat: day?.totals.fat_g ?? 0,
              }}
              target={{
                protein: dayTargets.proteinG,
                carbs: dayTargets.carbsG,
                fat: dayTargets.fatG,
              }}
            />
          ) : null}
          <Body muted>{t.nutrition.estimate}</Body>
        </Card>
      ) : !view.showNumbers ? (
        <Body muted testID="nutrition-numbers-hidden">
          {t.nutrition.numbersHidden}
        </Body>
      ) : null}

      <NutritionNotices
        notices={notices}
        planNotices={[...(day?.notices ?? []), ...(plan?.notices ?? [])]}
        showNumbers={view.showNumbers}
      />
      <NoticeActions notices={notices} consentValid={consent === 'valid'} />
      {view.showNumbers ? <CapsExplanation caps={dayTargets.appliedCaps} /> : null}

      <Heading level={2}>{t.nutrition.mealsTitle}</Heading>
      {plan === null ? (
        <Card>
          <Body>{demoAvailable ? t.nutrition.noRecipesTestMode : t.nutrition.noRecipes}</Body>
          {demoAvailable && app.backend.mode === 'local' ? (
            <Button
              label={t.nutrition.demoUse}
              variant="secondary"
              onPress={() => void app.setNutritionDemo(true)}
              testID="nutrition-demo-use"
            />
          ) : null}
        </Card>
      ) : day === null || (day.meals.length === 0 && day.emptySlots.length === 0) ? (
        <Body muted>{t.nutrition.noMeals}</Body>
      ) : (
        <View style={{ gap: 8 }} testID="nutrition-meals">
          {mealsInDayOrder(day).map((meal) => (
            <MealRow
              key={meal.slot}
              meal={meal}
              showNumbers={view.showNumbers && day.status !== 'no_targets'}
              foodName={foodName}
              onOpen={() =>
                router.push(
                  `/rezept/${encodeURIComponent(meal.recipeId)}?tag=${day.date}&platz=${meal.slot}` as Href,
                )
              }
            />
          ))}
          {day.emptySlots.map((empty) => (
            <EmptySlotRow key={empty.slot} empty={empty} />
          ))}
        </View>
      )}

      <EatingHelpNotice />
      <Body muted>{t.nutrition.hfiCoeliac}</Body>
      <Body muted>{t.nutrition.disclaimer}</Body>
      <Button
        label={t.nutrition.changeSettings}
        variant="secondary"
        onPress={() => router.push('/settings')}
        testID="nutrition-settings"
      />
    </>,
  );
}

/** Knöpfe zu den Hinweisen (Einwilligung, Gesundheits-Check, Gewicht) – 4.9, 8.3. */
function NoticeActions({
  notices,
  consentValid,
}: {
  notices: readonly NutritionNoticeCode[];
  consentValid: boolean;
}) {
  const router = useRouter();
  const has = (code: NutritionNoticeCode) => notices.includes(code);
  const actions = t.nutrition.actions;
  return (
    <View style={{ gap: 8 }}>
      {has('no_health_data_consent') || (!consentValid && has('body_data_missing')) ? (
        <Button
          label={actions.grantConsent}
          variant="secondary"
          onPress={() => router.push('/health-consent')}
          testID="nutrition-action-consent"
        />
      ) : null}
      {consentValid && has('health_check_missing') ? (
        <Button
          label={actions.healthCheck}
          variant="secondary"
          onPress={() => router.push('/onboarding/health_screening?edit=1' as Href)}
          testID="nutrition-action-check"
        />
      ) : null}
      {consentValid && has('pregnancy_check_update') ? (
        <Button
          label={actions.healthCheckUpdate}
          variant="secondary"
          onPress={() => router.push('/onboarding/health_screening?edit=1' as Href)}
          testID="nutrition-action-check-update"
        />
      ) : null}
      {consentValid && (has('weight_outdated') || has('body_data_missing')) ? (
        <Button
          label={actions.updateWeight}
          variant="secondary"
          onPress={() => router.push('/onboarding/body_metrics?edit=1' as Href)}
          testID="nutrition-action-weight"
        />
      ) : null}
    </View>
  );
}
