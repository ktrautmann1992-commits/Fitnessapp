import {
  latestBodyWeight,
  nextMealOfDay,
  trainingToday,
  weekTrainingProgress,
  weightGoalCard,
} from '@fitnessapp/core';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { DashboardTile, ShortcutCell, ShortcutGrid, ShortcutTile } from '@/components/dashboard';
import { Screen } from '@/components/screen';
import { Body, Button, LoadingState, Notice } from '@/components/ui';
import { weightGoalOverviewFromRows } from '@/components/weight-goal';
import { displayedSessionNames } from '@/data/competition';
import { sessionDisplay } from '@/data/exercise-swap';
import { activePlan } from '@/data/training-plan';
import type { UserRows } from '@/data/types';
import { startKind } from '@/data/workout-session';
import { t } from '@/i18n';
import { formatDateDe } from '@/lib/format';
import { formatKcal, roleLabel, slotLabel } from '@/lib/nutrition-format';
import { dayLabel } from '@/lib/plan-format';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { healthConsentStatus, HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useFoodLogDay } from '@/state/use-food-log';
import { useNutritionWeek } from '@/state/use-nutrition';

/**
 * Übersicht – Startseite mit Kacheln (docs/PLAN-DASHBOARD.md 2.4, Gründer-Wahl „Kacheln + Menüleiste“ vom 18.10.2026).
 * Jede Kachel führt in den vorhandenen Bereich; „Heute“ bleibt als Reiter „Training“ vollständig erhalten. Rechnet
 * nichts selbst (packages/core: trainingToday, weekTrainingProgress, latestBodyWeight). Kein Wunschgewicht, kein
 * Fortschritt zum Ziel (docs/PLAN-ZIELE.md F13); Gewicht nur mit gültiger Einwilligung; kcal nur mit „Zahlen an“.
 */
export default function OverviewScreen() {
  const app = useApp();
  const today = useToday();
  const { ensureLibrary } = app;
  useEffect(() => {
    void ensureLibrary();
  }, [ensureLibrary]);

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
  return <Overview rows={app.rows} today={today} />;
}

function greeting(hour: number): string {
  if (hour < 11) return t.dashboard.greeting.morning;
  if (hour >= 18) return t.dashboard.greeting.evening;
  return t.dashboard.greeting.day;
}

function Overview({ rows, today }: { rows: UserRows; today: string }) {
  const router = useRouter();
  const app = useApp();
  const consent = healthConsentStatus(rows, app.versions);
  const { versions } = app;
  const weightGoalNeedsAttention = useMemo(
    () => weightGoalCard(weightGoalOverviewFromRows(rows, versions, today)) !== null,
    [rows, versions, today],
  );
  // Was „Heute“ zeigt, geht nicht verloren: Wartet dort etwas, weist die Übersicht darauf hin.
  const attention =
    app.drafts.length > 0 ||
    app.foreignData ||
    app.sessionExpired ||
    app.planMessage !== null ||
    app.workoutMessage !== null ||
    consent === 'outdated' ||
    weightGoalNeedsAttention;

  return (
    <Screen title={t.dashboard.title} testID="overview">
      <Body muted>{greeting(new Date().getHours())}</Body>
      {attention ? (
        <Notice tone="info" title={t.dashboard.attention.title} testID="overview-attention">
          <Body>{t.dashboard.attention.text}</Body>
          <Button
            label={t.dashboard.attention.open}
            variant="secondary"
            onPress={() => router.navigate('/today')}
          />
        </Notice>
      ) : null}
      <TrainingTile rows={rows} today={today} />
      <NutritionTile today={today} />
      <BodyTile rows={rows} consent={consent} />
      <ProgressTile rows={rows} today={today} />
      <ShortcutGrid label={t.dashboard.shortcuts.title}>
        {app.backend.supportsNutrition ? (
          <ShortcutCell>
            <ShortcutTile
              label={t.dashboard.shortcuts.recipes}
              onPress={() => router.push('/rezepte' as Href)}
              testID="overview-recipes"
            />
          </ShortcutCell>
        ) : null}
        <ShortcutCell>
          <ShortcutTile
            label={t.dashboard.shortcuts.exercises}
            onPress={() => router.push('/uebungen' as Href)}
            testID="overview-exercises"
          />
        </ShortcutCell>
        {app.backend.supportsNutrition ? (
          <ShortcutCell>
            <ShortcutTile
              label={t.dashboard.shortcuts.shopping}
              onPress={() => router.push('/einkaufsliste' as Href)}
              testID="overview-shopping"
            />
          </ShortcutCell>
        ) : null}
        <ShortcutCell>
          <ShortcutTile
            label={t.dashboard.shortcuts.calendar}
            onPress={() => router.push('/kalender' as Href)}
            testID="overview-calendar"
          />
        </ShortcutCell>
      </ShortcutGrid>
    </Screen>
  );
}

/** Kachel „Training heute“: heutige Einheit mit „Training starten“, Ruhetag mit nächster Einheit, ohne Plan → Training. */
function TrainingTile({ rows, today }: { rows: UserRows; today: string }) {
  const router = useRouter();
  const app = useApp();
  const texts = t.dashboard.training;
  const active = activePlan(rows);
  const rules = app.safetyRules;
  const lib = app.library.kind === 'ready' ? app.library.library : null;
  const result = trainingToday(active?.sessions ?? null, today);
  // Angezeigte (sichere) Namen wie in „Heute“ (Wächter WP4 M2).
  const names = displayedSessionNames(rows, active, rules);
  const nameOf = (session: { id: string; name_de: string }) =>
    names.get(session.id) ?? session.name_de;
  const toTraining = (
    <Button
      label={texts.open}
      variant="secondary"
      onPress={() => router.navigate('/today')}
      testID="overview-training-open"
    />
  );

  if (result.kind === 'no_plan' || !active) {
    return (
      <DashboardTile title={texts.title} testID="overview-training">
        <Body>{texts.noPlan}</Body>
        <Button
          label={texts.createPlan}
          onPress={() => router.navigate('/today')}
          testID="overview-training-create"
        />
      </DashboardTile>
    );
  }
  if (result.kind === 'rest') {
    return (
      <DashboardTile title={texts.title} testID="overview-training">
        <Body>{texts.rest}</Body>
        <Body muted>
          {result.next
            ? texts.next(dayLabel(result.next.scheduled_on), nameOf(result.next))
            : texts.noUpcoming}
        </Body>
        {toTraining}
      </DashboardTile>
    );
  }
  const session = result.session;
  if (result.done) {
    return (
      <DashboardTile title={texts.title} testID="overview-training">
        <Body>{texts.done(nameOf(session))}</Body>
        {toTraining}
      </DashboardTile>
    );
  }
  const draft = app.drafts.some((d) => d.key === session.id);
  // Direkt starten nur, wenn „Heute“ es auch erlauben würde (Kraft: geprüfte Übungen, nicht leer durch Vorlieben).
  let canStart = !draft && startKind(rows, session, today) === 'today';
  if (canStart && session.kind === 'strength') {
    const display =
      lib && rules
        ? sessionDisplay({
            rows,
            active,
            library: lib,
            rules,
            session,
            today,
            daySwaps: app.daySwaps,
            ownerUserId: app.session?.userId ?? null,
          })
        : null;
    canStart =
      display !== null && !display.shown.emptyByPreference && !display.shown.libraryMissing;
  }
  return (
    <DashboardTile title={texts.title} testID="overview-training">
      <Body>{texts.today(nameOf(session))}</Body>
      {draft ? (
        <Button
          label={texts.continue}
          onPress={() => router.push(`/workout/${session.id}` as Href)}
          testID="overview-training-continue"
        />
      ) : canStart ? (
        <Button
          label={texts.start}
          onPress={() => router.push(`/workout/${session.id}` as Href)}
          testID="overview-training-start"
        />
      ) : session.kind === 'strength' && app.library.kind !== 'ready' && lib === null ? (
        <LoadingState label={texts.loading} />
      ) : null}
      {toTraining}
    </DashboardTile>
  );
}

/** Kachel „Ernährung heute“: nächste Mahlzeit, Einträge; kcal nur mit „Kalorienzahlen anzeigen“. */
function NutritionTile({ today }: { today: string }) {
  const router = useRouter();
  const app = useApp();
  const view = useNutritionWeek();
  const foodLog = useFoodLogDay(today, view.showNumbers);
  const texts = t.dashboard.nutrition;
  if (!app.backend.supportsNutrition) return null;
  const open = (
    <Button
      label={texts.open}
      variant="secondary"
      onPress={() => router.navigate('/ernaehrung' as Href)}
      testID="overview-nutrition-open"
    />
  );
  if (view.setupMissing) {
    return (
      <DashboardTile title={texts.title} testID="overview-nutrition">
        <Body>{texts.setupNeeded}</Body>
        <Button
          label={texts.setup}
          onPress={() => router.push('/onboarding/nutrition_setup?edit=1' as Href)}
        />
      </DashboardTile>
    );
  }
  const week = view.week;
  const clock = new Date();
  const nowMinutes = clock.getHours() * 60 + clock.getMinutes();
  const day =
    week?.kind === 'ready' ? (week.plan?.days.find((d) => d.date === today) ?? null) : null;
  const targets = week?.kind === 'ready' ? week.targets.days.find((d) => d.date === today) : null;
  const next = day ? nextMealOfDay(day, Math.min(Math.max(nowMinutes, 0), 24 * 60)) : null;
  const loading =
    view.library.kind === 'loading' ||
    view.library.kind === 'idle' ||
    (view.library.kind === 'ready' && week === null);
  return (
    <DashboardTile title={texts.title} testID="overview-nutrition">
      {loading ? <LoadingState label={texts.loading} /> : null}
      {view.library.kind === 'error' || week?.kind === 'error' ? (
        <Body muted>{texts.failed}</Body>
      ) : null}
      {week?.kind === 'incomplete' ? <Body muted>{t.nutrition.incomplete}</Body> : null}
      {week?.kind === 'blocked' ? <Body muted>{texts.blocked}</Body> : null}
      {targets && view.showNumbers && targets.targetKcal !== null ? (
        <Body testID="overview-nutrition-target">
          {texts.target(formatKcal(targets.targetKcal))}
        </Body>
      ) : null}
      {next ? (
        <Body testID="overview-nutrition-next">
          {texts.next(
            roleLabel(next.role)
              ? `${slotLabel(next.slot)} (${roleLabel(next.role)})`
              : slotLabel(next.slot),
            next.titleDe,
          )}
        </Body>
      ) : day ? (
        <Body muted>{texts.allDone}</Body>
      ) : week?.kind === 'ready' ? (
        <Body muted>{texts.noPlan}</Body>
      ) : null}
      {foodLog.consentValid ? (
        <>
          <Body muted testID="overview-food-log">
            {texts.entries(foodLog.intake.count)}
          </Body>
          <Button
            label={texts.log}
            variant="secondary"
            onPress={() => router.push(`/ernaehrung/eintragen?tag=${today}` as Href)}
            testID="overview-food-log-add"
          />
        </>
      ) : null}
      {open}
    </DashboardTile>
  );
}

/** Kachel „Körperdaten“: letztes Gewicht nur mit gültiger Einwilligung – nie Wunschgewicht oder Prognose (F13). */
function BodyTile({
  rows,
  consent,
}: {
  rows: UserRows;
  consent: ReturnType<typeof healthConsentStatus>;
}) {
  const router = useRouter();
  const texts = t.dashboard.body;
  if (consent !== 'valid') {
    return (
      <DashboardTile title={texts.title} testID="overview-body">
        <Body muted testID="overview-body-no-consent">
          {consent === 'outdated' ? texts.outdated : texts.noConsent}
        </Body>
        <Button
          label={texts.grant}
          variant="secondary"
          onPress={() => router.push('/health-consent')}
        />
      </DashboardTile>
    );
  }
  const latest = latestBodyWeight(rows.bodyMetrics);
  return (
    <DashboardTile title={texts.title} testID="overview-body">
      {latest ? (
        <Body
          testID="overview-body-weight"
          accessibilityLabel={texts.weightA11y(latest.weightKg, formatDateDe(latest.measuredOn))}
        >
          {texts.weight(latest.weightKg, formatDateDe(latest.measuredOn))}
        </Body>
      ) : (
        <Body muted>{texts.none}</Body>
      )}
      <Button
        label={texts.enter}
        variant="secondary"
        onPress={() => router.push('/onboarding/body_metrics?edit=1&zurueck=uebersicht' as Href)}
        testID="overview-body-enter"
      />
    </DashboardTile>
  );
}

/** Kachel „Fortschritt“: Wochenzahlen (erledigt von geplant), Weg zum Fortschritt-Reiter. */
function ProgressTile({ rows, today }: { rows: UserRows; today: string }) {
  const router = useRouter();
  const texts = t.dashboard.progress;
  const active = activePlan(rows);
  const week = active ? weekTrainingProgress(active.sessions, today) : null;
  return (
    <DashboardTile title={texts.title} testID="overview-progress">
      <Body testID="overview-progress-week">
        {week ? texts.week(week.completed, week.planned) : texts.noPlan}
      </Body>
      <Button
        label={texts.open}
        variant="secondary"
        onPress={() => router.navigate('/fortschritt' as Href)}
        testID="overview-progress-open"
      />
    </DashboardTile>
  );
}
