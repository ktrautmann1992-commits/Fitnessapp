import {
  calorieRing,
  type DashboardTileId,
  latestBodyWeight,
  nextMealOfDay,
  type PlanNotice,
  trainingToday,
  weekTrainingProgress,
} from '@fitnessapp/core';
import { Redirect, useRouter, type Href } from 'expo-router';
import { brandColors, fontSize, spacing } from '@fitnessapp/ui';
import { Fragment, type ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CompetitionTile } from '@/components/competition-tile';
import {
  DashboardTile,
  ShortcutCell,
  ShortcutGrid,
  ShortcutTile,
  TileCell,
  TileRow,
} from '@/components/dashboard';
import { HeroCard, IconButton, ProgressRing, StatValue, useAreaColors } from '@/components/design';
import { DashboardEditor } from '@/components/dashboard-edit';
import { WorkoutsTile } from '@/components/workouts';
import { EnduranceTile } from '@/components/endurance-tile';
import { Screen } from '@/components/screen';
import { MeasurementNotificationOffer } from '@/components/notifications';
import { Body, Button, Heading, LoadingState, Notice } from '@/components/ui';
import { weightGoalOverviewFromRows } from '@/components/weight-goal';
import { displayedSessionNames } from '@/data/competition';
import { sessionDisplay } from '@/data/exercise-swap';
import { logForSession } from '@/data/log-rows';
import { trainingAttention } from '@/data/training-attention';
import { activePlan } from '@/data/training-plan';
import type { UserRows } from '@/data/types';
import { startKind, workoutView } from '@/data/workout-session';
import { t } from '@/i18n';
import { formatDateDe } from '@/lib/format';
import { appFont } from '@/lib/fonts';
import { ringCenterText } from '@/lib/nutrition-day-format';
import { formatKcal, roleLabel, slotLabel } from '@/lib/nutrition-format';
import { dayLabel, longDayLabel } from '@/lib/plan-format';
import { useThemeColors } from '@/lib/theme';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { useAppLayout } from '@/state/use-app-layout';
import { useWorkoutLibrary } from '@/state/use-workouts';
import { healthConsentStatus, HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useFoodLogDay } from '@/state/use-food-log';
import { useNutritionWeek } from '@/state/use-nutrition';
import { Text } from '@/components/text';

/**
 * Übersicht – Startseite mit Kacheln (docs/PLAN-DASHBOARD.md 2.4, Gründer-Wahl „Kacheln + Menüleiste“ vom 18.10.2026;
 * Aussehen seit 20.10.2026 wie Entwurf „Übersicht neu“: Kopf mit Datum und Gruß, „Training heute“ als dunkle
 * Hero-Karte, kleine Kacheln zu zweit nebeneinander, docs/DESIGN.md).
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
  const { versions, safetyRules, offline } = app;
  const library = app.library.kind === 'ready' ? app.library.library : null;
  const weightGoal = useMemo(
    () => weightGoalOverviewFromRows(rows, versions, today),
    [rows, versions, today],
  );
  // Was „Heute“ zeigt, geht nicht verloren: dieselbe Auswertung wie „Heute“ (data/training-attention.ts).
  const { planNotice, reasons } = trainingAttention({
    rows,
    versions,
    rules: safetyRules,
    library,
    today,
    offline,
    drafts: app.drafts.length,
    workoutMessage: app.workoutMessage?.kind ?? null,
    planMessage: app.planMessage,
    foreignData: app.foreignData,
    sessionExpired: app.sessionExpired,
    weightGoal,
  });
  const urgent = planNotice.kind === 'stricter' || planNotice.kind === 'ended';
  const { layout } = useAppLayout();
  const [editing, setEditing] = useState(false);
  const others = reasons.filter((r) => r !== 'plan_stricter' && r !== 'plan_ended');

  const visibleTiles = layout.tiles.filter((x) => x.visible).map((x) => x.id);
  // Kleine Kacheln stehen zu zweit nebeneinander (Entwurf), wenn sie in der Reihenfolge der Person aufeinander folgen.
  const small = (id: DashboardTileId) =>
    id === 'workouts' ||
    id === 'endurance' ||
    (id === 'nutrition' && app.backend.supportsNutrition);
  const groups: DashboardTileId[][] = [];
  for (const id of visibleTiles) {
    const last = groups[groups.length - 1];
    if (small(id) && last && last.length === 1 && small(last[0] as DashboardTileId)) {
      last.push(id);
    } else {
      groups.push([id]);
    }
  }
  const tile = (id: DashboardTileId): ReactNode => {
    switch (id) {
      case 'training':
        return <TrainingTile rows={rows} today={today} planNotice={planNotice} />;
      // Gründer-Rückmeldung 20.10.2026: Wettkampfplan leicht finden.
      case 'competition':
        return <CompetitionTile rows={rows} today={today} />;
      case 'workouts':
        return <OverviewWorkoutsTile today={today} />;
      case 'nutrition':
        return <NutritionTile today={today} />;
      case 'body':
        return <BodyTile rows={rows} consent={consent} />;
      case 'progress':
        return <ProgressTile rows={rows} today={today} />;
      // Etappe E4 (Ausdauer): km dieser Woche mit Balken je Tag.
      case 'endurance':
        return <EnduranceTile rows={rows} today={today} />;
      case 'shortcuts':
        return (
          <ShortcutGrid label={t.dashboard.shortcuts.title}>
            {app.backend.supportsNutrition ? (
              <ShortcutCell>
                <ShortcutTile
                  label={t.dashboard.shortcuts.recipes}
                  area="ernaehrung"
                  icon="recipe"
                  onPress={() => router.push('/rezepte' as Href)}
                  testID="overview-recipes"
                />
              </ShortcutCell>
            ) : null}
            <ShortcutCell>
              <ShortcutTile
                label={t.dashboard.shortcuts.exercises}
                area="training"
                icon="dumbbell"
                onPress={() => router.push('/uebungen' as Href)}
                testID="overview-exercises"
              />
            </ShortcutCell>
            {app.backend.supportsNutrition ? (
              <ShortcutCell>
                <ShortcutTile
                  label={t.dashboard.shortcuts.shopping}
                  area="einkaufen"
                  icon="cart"
                  onPress={() => router.navigate('/einkaufsliste' as Href)}
                  testID="overview-shopping"
                />
              </ShortcutCell>
            ) : null}
            <ShortcutCell>
              <ShortcutTile
                label={t.dashboard.shortcuts.calendar}
                area="training"
                icon="calendar"
                onPress={() => router.push('/kalender' as Href)}
                testID="overview-calendar"
              />
            </ShortcutCell>
          </ShortcutGrid>
        );
    }
  };
  return (
    <Screen testID="overview">
      <OverviewHeader today={today} editing={editing} onEdit={() => setEditing(true)} />
      {/* Etappe E: einmaliges Angebot nach der ersten Messung (nur App, nie im Onboarding). */}
      <MeasurementNotificationOffer />
      {urgent ? (
        // Deutlich wie auf „Heute“: strengere Regeln bzw. Plan abgelaufen → neu erstellen.
        <Notice
          tone="danger"
          title={planNotice.kind === 'ended' ? t.plan.endedTitle : t.plan.offerStricterTitle}
          testID="overview-plan-urgent"
        >
          <Body>{planNotice.kind === 'ended' ? t.plan.endedText : t.plan.offerStricterText}</Body>
          <Button
            label={t.dashboard.attention.recreate}
            onPress={() => router.navigate('/today')}
          />
        </Notice>
      ) : null}
      {others.length > 0 ? (
        <Notice tone="info" title={t.dashboard.attention.title} testID="overview-attention">
          <Body>
            {others.includes('plan_offer') && others.length === 1
              ? t.dashboard.attention.planOffer
              : t.dashboard.attention.text}
          </Body>
          <Button
            label={t.dashboard.attention.open}
            variant="secondary"
            onPress={() => router.navigate('/today')}
          />
        </Notice>
      ) : null}
      {/* Etappe E2: Kacheln in der Reihenfolge der Person, ausgeblendete fehlen (Hinweise oben bleiben immer). */}
      {editing ? <DashboardEditor onDone={() => setEditing(false)} /> : null}
      {visibleTiles.length === 0 && !editing ? (
        <Notice tone="info" title={t.dashboard.edit.allHidden} testID="overview-all-hidden">
          <Body>{t.dashboard.edit.allHiddenHint}</Body>
        </Notice>
      ) : null}
      {groups.map((group) =>
        group.length === 2 ? (
          <TileRow key={group.join('+')}>
            {group.map((id) => (
              <TileCell key={id}>{tile(id)}</TileCell>
            ))}
          </TileRow>
        ) : (
          <Fragment key={group[0]}>{tile(group[0] as DashboardTileId)}</Fragment>
        ),
      )}
    </Screen>
  );
}

/** Kopf wie im Entwurf: Datum, Gruß (ohne Namen – die App speichert keinen) und „Übersicht bearbeiten“. */
function OverviewHeader({
  today,
  editing,
  onEdit,
}: {
  today: string;
  editing: boolean;
  onEdit: () => void;
}) {
  const theme = useThemeColors();
  return (
    <View style={styles.header} testID="overview-header">
      <View style={styles.headerText}>
        <Text style={[styles.date, appFont('semibold'), { color: theme.textMuted }]}>
          {longDayLabel(today)}
        </Text>
        <Heading>{greeting(new Date().getHours())}</Heading>
      </View>
      {!editing ? (
        <IconButton
          icon="edit"
          accessibilityLabel={t.dashboard.edit.title}
          onPress={onEdit}
          testID="overview-edit-open"
        />
      ) : null}
    </View>
  );
}

/** Kachel „Training heute“: heutige Einheit mit „Training starten“, Ruhetag mit nächster Einheit, ohne Plan → Training. */
function TrainingTile({
  rows,
  today,
  planNotice,
}: {
  rows: UserRows;
  today: string;
  planNotice: PlanNotice;
}) {
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
  const toTraining = () => router.navigate('/today');
  // Design 20.10.2026: dunkle Hero-Karte mit großem Pillen-Knopf.
  const hero = {
    eyebrow: texts.title,
    eyebrowIcon: 'dumbbell' as const,
    testID: 'overview-training',
  };

  if (result.kind === 'no_plan' || !active) {
    return (
      <HeroCard
        {...hero}
        title={texts.noPlan}
        actionLabel={texts.createPlan}
        actionIcon={null}
        onAction={toTraining}
        actionTestID="overview-training-create"
      />
    );
  }
  if (result.kind === 'rest') {
    return (
      <HeroCard
        {...hero}
        title={texts.rest}
        subtitle={
          result.next
            ? texts.next(dayLabel(result.next.scheduled_on), nameOf(result.next))
            : texts.noUpcoming
        }
        secondaryLabel={texts.open}
        onSecondary={toTraining}
        secondaryTestID="overview-training-open"
      />
    );
  }
  const session = result.session;
  if (result.done) {
    return (
      <HeroCard
        {...hero}
        title={texts.done(nameOf(session))}
        secondaryLabel={texts.open}
        onSecondary={toTraining}
        secondaryTestID="overview-training-open"
      />
    );
  }
  const draft = app.drafts.some((d) => d.key === session.id);
  // Direkt starten nur, wenn „Heute“ es auch erlauben würde (Wächter N6): heute dran, kein strengerer bzw.
  // abgelaufener Plan, Kraft nur mit geprüften Übungen (workoutView) und nicht leer durch Vorlieben.
  const blockedByPlan = planNotice.kind === 'stricter' || planNotice.kind === 'ended';
  let canStart = !draft && !blockedByPlan && startKind(rows, session, today) === 'today';
  let reason: string | null = blockedByPlan ? texts.recreateFirst : null;
  if (canStart && session.kind === 'strength') {
    const ownerUserId = app.session?.userId ?? null;
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
            ownerUserId,
          })
        : null;
    const view =
      lib && rules
        ? workoutView(rows, lib, rules, session.id, today, {
            excludeLogId: logForSession(rows, session.id)?.id ?? null,
            daySwaps: app.daySwaps,
            ownerUserId,
          })
        : null;
    if (display?.shown.emptyByPreference) {
      canStart = false;
      reason = t.swap.emptyStartDisabled;
    } else if (display === null || display.shown.libraryMissing || view === null) {
      canStart = false;
      reason =
        app.library.kind === 'ready' || app.library.kind === 'missing'
          ? t.today.libraryMissingStart
          : null;
    }
  }
  const loadingLibrary =
    session.kind === 'strength' && (app.library.kind === 'idle' || app.library.kind === 'loading');
  const startWorkout = () => router.push(`/workout/${session.id}` as Href);
  const action = draft
    ? { actionLabel: texts.continue, actionTestID: 'overview-training-continue' }
    : canStart
      ? { actionLabel: texts.start, actionTestID: 'overview-training-start' }
      : null;
  return (
    <HeroCard
      {...hero}
      title={texts.today(nameOf(session))}
      {...(action ? { ...action, onAction: startWorkout } : {})}
      note={!action ? reason : null}
      noteTestID="overview-training-no-start"
      secondaryLabel={texts.open}
      onSecondary={toTraining}
      secondaryTestID="overview-training-open"
    >
      {!action && !reason && loadingLibrary ? (
        <ActivityIndicator accessibilityLabel={texts.loading} color={brandColors.weiss} />
      ) : null}
    </HeroCard>
  );
}

/** Kachel „Workouts“ (Workout-Bibliothek, docs/PLAN-WORKOUTS.md): Bestand und heute erledigte Workouts. */
function OverviewWorkoutsTile({ today }: { today: string }) {
  const router = useRouter();
  const app = useApp();
  const library = useWorkoutLibrary();
  if (library.kind !== 'ready') {
    return (
      <DashboardTile title={t.workouts.tile.title} testID="tile-workouts">
        {library.kind === 'loading' ? (
          <LoadingState />
        ) : (
          <Button label={t.common.retry} variant="secondary" onPress={library.retry} />
        )}
      </DashboardTile>
    );
  }
  return (
    <WorkoutsTile
      workouts={library.workouts}
      logs={app.rows?.sessionLogs ?? []}
      today={today}
      onOpen={() => router.navigate('/workouts' as Href)}
    />
  );
}

/**
 * Kachel „Ernährung heute“ (kleine Kachel, ganz antippbar → Ernährung): mit „Kalorienzahlen anzeigen“ und Ernährungs-
 * tagebuch der Kalorien-Ring (packages/core calorieRing) mit „übrig“, sonst die nächste Mahlzeit; nie erfundene Zahlen.
 */
function NutritionTile({ today }: { today: string }) {
  const router = useRouter();
  const app = useApp();
  const view = useNutritionWeek();
  const foodLog = useFoodLogDay(today, view.showNumbers);
  const ringColors = useAreaColors('ernaehrung');
  const theme = useThemeColors();
  const texts = t.dashboard.nutrition;
  if (!app.backend.supportsNutrition) return null;
  if (view.setupMissing) {
    return (
      <DashboardTile
        title={texts.title}
        area="ernaehrung"
        icon="utensils"
        testID="overview-nutrition"
        accessibilityLabel={`${texts.title}: ${texts.setup}`}
        onPress={() => router.push('/onboarding/nutrition_setup?edit=1' as Href)}
      >
        <Body style={styles.small}>{texts.setupNeeded}</Body>
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
  const targetKcal = targets && view.showNumbers ? targets.targetKcal : null;
  const intake = foodLog.consentValid && foodLog.intake.kind === 'numbers' ? foodLog.intake : null;
  const ring =
    targetKcal !== null && intake !== null
      ? calorieRing({ targetKcal, eatenKcal: intake.kcal })
      : null;
  const center = ring?.kind === 'ring' ? ringCenterText(ring, false) : null;
  return (
    <DashboardTile
      title={texts.title}
      area="ernaehrung"
      icon="utensils"
      testID="overview-nutrition"
      pressTestID="overview-nutrition-open"
      accessibilityLabel={center ? `${texts.title}: ${center.a11y}` : texts.open}
      onPress={() => router.navigate('/ernaehrung' as Href)}
    >
      {loading ? <LoadingState label={texts.loading} /> : null}
      {view.library.kind === 'error' || week?.kind === 'error' ? (
        <Body muted style={styles.small}>
          {texts.failed}
        </Body>
      ) : null}
      {week?.kind === 'incomplete' ? (
        <Body muted style={styles.small}>
          {t.nutrition.incomplete}
        </Body>
      ) : null}
      {week?.kind === 'blocked' ? (
        <Body muted style={styles.small}>
          {texts.blocked}
        </Body>
      ) : null}
      {ring?.kind === 'ring' && center ? (
        <View
          style={styles.ringRow}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={center.a11y}
          testID="overview-nutrition-ring"
        >
          <ProgressRing
            size={64}
            stroke={7}
            fraction={ring.fraction}
            overFraction={ring.overFraction}
            color={ringColors.strong}
          >
            <Text style={[styles.ringPercent, appFont('extrabold'), { color: theme.text }]}>
              {`${ring.percent} %`}
            </Text>
          </ProgressRing>
          <StatValue value={center.value} label={`kcal ${center.label}`} />
        </View>
      ) : null}
      {targetKcal !== null ? (
        <Body muted testID="overview-nutrition-target" style={styles.small}>
          {texts.target(formatKcal(targetKcal))}
        </Body>
      ) : null}
      {!ring && next ? (
        <Body testID="overview-nutrition-next" style={styles.small}>
          {texts.next(
            roleLabel(next.role)
              ? `${slotLabel(next.slot)} (${roleLabel(next.role)})`
              : slotLabel(next.slot),
            next.titleDe,
          )}
        </Body>
      ) : !ring && day ? (
        <Body muted style={styles.small}>
          {texts.allDone}
        </Body>
      ) : !ring && week?.kind === 'ready' ? (
        <Body muted style={styles.small}>
          {texts.noPlan}
        </Body>
      ) : null}
      {foodLog.consentValid ? (
        <Body muted testID="overview-food-log" style={styles.small}>
          {texts.entries(foodLog.intake.count)}
        </Body>
      ) : null}
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
      <DashboardTile title={texts.title} area="fortschritt" icon="scale" testID="overview-body">
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
    <DashboardTile title={texts.title} area="fortschritt" icon="scale" testID="overview-body">
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

/** Kachel „Fortschritt“ (breit, ganz antippbar): diese Woche erledigt / geplant / offen (packages/core). */
function ProgressTile({ rows, today }: { rows: UserRows; today: string }) {
  const router = useRouter();
  const texts = t.dashboard.progress;
  const active = activePlan(rows);
  const week = active ? weekTrainingProgress(active.sessions, today) : null;
  const summary = week ? texts.week(week.completed, week.planned) : texts.noPlan;
  return (
    <DashboardTile
      title={texts.title}
      area="fortschritt"
      icon="trend"
      testID="overview-progress"
      pressTestID="overview-progress-open"
      accessibilityLabel={`${texts.title}: ${summary}`}
      onPress={() => router.navigate('/fortschritt' as Href)}
    >
      {week && week.planned > 0 ? (
        <View
          style={styles.stats}
          accessible
          accessibilityLabel={summary}
          testID="overview-progress-week"
        >
          <View style={styles.stat}>
            <StatValue value={String(week.completed)} label={texts.statDone} />
          </View>
          <View style={styles.stat}>
            <StatValue value={String(week.planned)} label={texts.statPlanned} />
          </View>
          <View style={styles.stat}>
            <StatValue value={String(week.open)} label={texts.statOpen} />
          </View>
        </View>
      ) : (
        <Body muted testID="overview-progress-week" style={styles.small}>
          {summary}
        </Body>
      )}
    </DashboardTile>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  date: { fontSize: fontSize.sm },
  small: { fontSize: fontSize.sm, lineHeight: 20 },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  ringPercent: { fontSize: fontSize.xs },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, minWidth: 0 },
});
