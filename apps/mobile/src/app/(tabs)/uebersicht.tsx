import {
  calorieRing,
  evaluationMealPlanUsable,
  mealCardEntrySlot,
  mealCardGroup,
  type DashboardTileId,
  goalFill,
  latestBodyWeight,
  nextMealOfDay,
  type PlanNotice,
  trainingToday,
  weekTrainingProgress,
} from '@fitnessapp/core';
import { Redirect, useRouter, type Href } from 'expo-router';
import { brandColors, cardColors, fontSize, heroColors, radius, spacing } from '@fitnessapp/ui';
import { Fragment, type ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { CompetitionTile } from '@/components/competition-tile';
import {
  DashboardTile,
  ShortcutCell,
  ShortcutGrid,
  ShortcutTile,
  TileCell,
  TileRow,
} from '@/components/dashboard';
import {
  HeroCard,
  Icon,
  IconButton,
  ProgressRing,
  StatValue,
  TileTone,
  useAreaColors,
} from '@/components/design';
import { DashboardEditor } from '@/components/dashboard-edit';
import { WorkoutsTile } from '@/components/workouts';
import { EnduranceTile } from '@/components/endurance-tile';
import { Screen } from '@/components/screen';
import { StepsTile } from '@/components/steps';
import { RecoveryTile } from '@/components/recovery';
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
import { deModes } from '@/i18n/de-training-modes';
import { useTrainingModes } from '@/state/use-training-modes';
import { formatDateDe } from '@/lib/format';
import { appFont } from '@/lib/fonts';
import { percentText, ringCenterText } from '@/lib/nutrition-day-format';
import { formatKcal, roleLabel, slotLabel } from '@/lib/nutrition-format';
import { dayLabel, longDayLabel } from '@/lib/plan-format';
import { useColorSchemeName, useDeviceSchemeName, useThemeColors } from '@/lib/theme';
import { useWeekStatus, WeekStrip } from '@/components/training-week';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { useAppLayout } from '@/state/use-app-layout';
import { useWorkoutLibrary } from '@/state/use-workouts';
import { healthConsentStatus, HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useFoodLogActions, useFoodLogDay } from '@/state/use-food-log';
import { PlanMealEaten } from '@/components/food-log';
import { NoticeStack } from '@/components/slim';
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
  // „App verschlanken“ (26.10.2026): „Ernährung heute“ ist eine breite Karte („Als Nächstes“ + Abhaken).
  const small = (id: DashboardTileId) => id === 'workouts' || id === 'endurance' || id === 'steps';
  const groups: DashboardTileId[][] = [];
  for (const id of visibleTiles) {
    const last = groups[groups.length - 1];
    if (small(id) && last && last.length === 1 && small(last[0] as DashboardTileId)) {
      last.push(id);
    } else {
      groups.push([id]);
    }
  }
  // Gründer-Wunsch 23.10.2026 („Kacheln farbig wie Training heute“): Bereichs-Kacheln dunkel mit Farbschein;
  // Körperdaten, Fortschritt und Schnellzugriffe bleiben helle Karten mit farbigem Chip (nicht alles schwarz).
  const tile = (id: DashboardTileId): ReactNode => {
    const content = tileContent(id);
    return id === 'body' || id === 'progress' || id === 'shortcuts' ? (
      content
    ) : (
      <TileTone tone="hero">{content}</TileTone>
    );
  };
  const tileContent = (id: DashboardTileId): ReactNode => {
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
      // Schritte mit Tagesziel als Ring (Gründer-Wunsch 22.10.2026, docs/PLAN-PHASE-8.md 13.4).
      case 'steps':
        return <StepsTile today={today} />;
      // „Erholung“ aus Schlaf, Ruhepuls und HRV der Uhr (Gründer-Freigabe 25.10.2026) – eigene Zeile (Mini-Verlauf).
      case 'recovery':
        return <RecoveryTile today={today} />;
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
      {/* Hinweis-Zeile („App verschlanken“, 26.10.2026): höchstens ein Hinweis offen, Rest hinter „+N“. */}
      <NoticeStack
        testID="overview-notices"
        items={[
          urgent
            ? {
                id: 'plan-urgent',
                level: 'blocking',
                // Deutlich wie im Training: strengere Regeln bzw. Plan abgelaufen → neu erstellen.
                node: (
                  <Notice
                    tone="danger"
                    title={
                      planNotice.kind === 'ended' ? t.plan.endedTitle : t.plan.offerStricterTitle
                    }
                    testID="overview-plan-urgent"
                  >
                    <Body>
                      {planNotice.kind === 'ended' ? t.plan.endedText : t.plan.offerStricterText}
                    </Body>
                    <Button
                      label={t.dashboard.attention.recreate}
                      onPress={() => router.navigate('/today')}
                    />
                  </Notice>
                ),
              }
            : null,
          others.length > 0
            ? {
                id: 'attention',
                level: 'action',
                node: (
                  <Notice
                    tone="info"
                    title={t.dashboard.attention.title}
                    testID="overview-attention"
                  >
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
                ),
              }
            : null,
          app.backend.mode === 'local' || library?.containsDrafts
            ? {
                id: 'test-content',
                level: 'info',
                node: (
                  <Notice tone="info" testID="overview-test-content">
                    {t.plan.testContent}
                  </Notice>
                ),
              }
            : null,
        ]}
      />
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
      {/* Entwurf 1-heute: „Kacheln anpassen“ unten (zusätzlich zum Stift oben). */}
      {!editing ? (
        <Button
          label={t.dashboard.edit.title}
          variant="link"
          onPress={() => setEditing(true)}
          testID="overview-edit-bottom"
        />
      ) : null}
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
  // Trainings-Modi (docs/PLAN-TRAINING-MODI.md 6): gleiche Anzeige wie „Heute“.
  const trainingModes = useTrainingModes().state;
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
    area: 'training' as const,
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
            modes: trainingModes,
          })
        : null;
    const view =
      lib && rules
        ? workoutView(rows, lib, rules, session.id, today, {
            excludeLogId: logForSession(rows, session.id)?.id ?? null,
            daySwaps: app.daySwaps,
            ownerUserId,
            modes: trainingModes,
          })
        : null;
    if (display?.shown.emptyByPreference) {
      canStart = false;
      reason = t.swap.emptyStartDisabled;
    } else if (display?.shown.emptyByMode) {
      canStart = false;
      reason = deModes.notices.pain_session_empty;
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
  const foodLogActions = useFoodLogActions();
  const [eatenMessage, setEatenMessage] = useState<{
    text: string;
    tone: 'success' | 'danger';
  } | null>(null);
  const ringColors = useAreaColors('ernaehrung');
  const theme = useThemeColors();
  const hero = heroColors[useDeviceSchemeName()];
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
  const over = ring?.kind === 'ring' && ring.state === 'over';
  // Makro-Ringe (Gründer-Wunsch 23.10.2026): gleiche Regel wie in der Tagesübersicht (core `goalFill`).
  const macroRings =
    ring?.kind === 'ring' && targets && intake
      ? (
          [
            ['carbs', intake.carbs_g, targets.carbsG, hero.macroCarbs],
            ['protein', intake.protein_g, targets.proteinG, hero.macroProtein],
            ['fat', intake.fat_g, targets.fatG, hero.macroFat],
          ] as const
        ).flatMap(([key, eaten, goal, color]) => {
          const fill = goalFill(eaten, goal);
          return fill ? [{ key, fill, color }] : [];
        })
      : [];
  // „Als Nächstes“ mit einem Tipp abhaken (Entwurf 1-heute) – nur an einem gespeicherten Plan (Regel in core).
  const planState = week?.kind === 'ready' ? week.planState : null;
  const eatenAllowed = evaluationMealPlanUsable({
    planStored: planState?.action === 'stored',
    weekEditable: planState?.editable === true,
    date: today,
    today,
  });
  const canLog = foodLog.supported && foodLog.consentValid && foodLog.dateStatus === 'ok';
  return (
    <DashboardTile
      title={texts.title}
      area="ernaehrung"
      icon="utensils"
      testID="overview-nutrition"
      tint="corner"
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
            fraction={over ? 1 : ring.fraction}
            color={over ? hero.over : ringColors.strong}
            trackColor={hero.track}
          >
            <Text
              style={[
                styles.ringPercent,
                appFont('extrabold'),
                { color: over ? hero.overText : theme.text },
              ]}
            >
              {percentText(ring.percent)}
            </Text>
          </ProgressRing>
          <StatValue value={center.value} label={`kcal ${center.label}`} />
        </View>
      ) : null}
      {macroRings.length > 0 ? (
        <View style={styles.macroRow} testID="overview-nutrition-macros">
          {macroRings.map(({ key, fill, color }) => {
            const name = t.nutrition.macroNames[key];
            const a11y = (fill.over ? t.nutritionDay.macroA11yOver : t.nutritionDay.macroA11y)(
              name,
              formatKcal(fill.eaten),
              formatKcal(fill.goal),
            );
            return (
              <View
                key={key}
                style={styles.macroCell}
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={a11y}
                testID={`overview-nutrition-macro-${key}`}
              >
                <ProgressRing
                  size={34}
                  stroke={4}
                  fraction={fill.fraction}
                  color={fill.over ? hero.over : color}
                  trackColor={hero.track}
                />
                <Text
                  style={[
                    styles.macroShort,
                    appFont('bold'),
                    { color: fill.over ? hero.overText : color },
                  ]}
                >
                  {fill.over ? `${texts.macroShort[key]} ↑` : texts.macroShort[key]}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
      {targetKcal !== null ? (
        <Body muted testID="overview-nutrition-target" style={styles.small}>
          {texts.target(formatKcal(targetKcal))}
        </Body>
      ) : null}
      {next ? (
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
      <View style={styles.actions}>
        {next && eatenAllowed ? (
          <View style={styles.action}>
            <PlanMealEaten
              meal={next}
              date={today}
              view={foodLog}
              actions={foodLogActions}
              onMessage={setEatenMessage}
            />
          </View>
        ) : null}
        {canLog ? (
          <View style={styles.action}>
            <Button
              label={texts.log}
              icon="plus"
              variant="secondary"
              onPress={() =>
                router.push(
                  (next
                    ? `/ernaehrung/eintragen?tag=${today}&platz=${mealCardEntrySlot(mealCardGroup(next.slot))}`
                    : `/ernaehrung/eintragen?tag=${today}`) as Href,
                )
              }
              testID="overview-nutrition-log"
            />
          </View>
        ) : null}
      </View>
      {eatenMessage ? (
        <Notice tone={eatenMessage.tone} testID="overview-nutrition-message">
          {eatenMessage.text}
        </Notice>
      ) : null}
      <Button
        label={texts.open}
        variant="link"
        accessibilityLabel={center ? `${texts.open}: ${center.a11y}` : texts.open}
        onPress={() => router.navigate('/ernaehrung' as Href)}
        testID="overview-nutrition-open"
      />
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

/**
 * Kachel „Deine Woche“ (bis 26.10.2026 „Fortschritt“; Entwurf 1-heute): Kopf „Deine Woche · 0 von 3 erledigt ›“
 * (Link zu Mehr › Fortschritt) und der Wochenstreifen wie im Training – Tippen auf einen Tag öffnet ihn im Training.
 * Zahlen aus packages/core (weekTrainingProgress, Wochen-Status).
 */
function ProgressTile({ rows, today }: { rows: UserRows; today: string }) {
  const router = useRouter();
  const theme = useThemeColors();
  const texts = t.dashboard.progress;
  const active = activePlan(rows);
  const week = active ? weekTrainingProgress(active.sessions, today) : null;
  const status = useWeekStatus(today);
  const summary = week ? texts.week(week.completed, week.planned) : texts.noPlan;
  const card = cardColors[useColorSchemeName()];
  return (
    <View
      style={[styles.weekCard, { backgroundColor: theme.surface, borderColor: card.border }]}
      testID="overview-progress"
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${t.dashboard.edit.tiles.progress}: ${summary}`}
        onPress={() => router.navigate('/fortschritt' as Href)}
        testID="overview-progress-open"
        style={({ pressed }) => [styles.weekHead, { opacity: pressed ? 0.75 : 1 }]}
      >
        <Text
          accessibilityRole="header"
          aria-level={2}
          style={[styles.weekTitle, appFont('bold'), { color: theme.text }]}
        >
          {t.dashboard.edit.tiles.progress}
        </Text>
        <Text
          style={[styles.weekCount, appFont('semibold'), { color: theme.textMuted }]}
          accessibilityLabel={summary}
          testID="overview-progress-week"
        >
          {week && week.planned > 0 ? texts.short(week.completed, week.planned) : summary}
        </Text>
        <Icon name="chevron" size={18} color={theme.textMuted} />
      </Pressable>
      {active && status.status ? (
        <WeekStrip
          days={status.status.days}
          testID="overview-week"
          onSelect={(date) => router.navigate(`/today?tag=${date}` as Href)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  date: { fontSize: fontSize.sm },
  small: { fontSize: fontSize.sm, lineHeight: 20 },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  ringPercent: { fontSize: fontSize.xs },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  macroCell: { alignItems: 'center', gap: 4, flex: 1, minWidth: 0 },
  macroShort: { fontSize: 12, lineHeight: 16 },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, minWidth: 0 },
  weekCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  weekHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  weekTitle: { flex: 1, fontSize: 19, lineHeight: 25 },
  weekCount: { fontSize: fontSize.sm, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1, flexBasis: 140 },
});
