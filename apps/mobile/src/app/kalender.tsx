import {
  addDays,
  entryDateBlock,
  isBackfilledLog,
  type MoveTarget,
  SESSION_LOG_LIMITS,
  startOfIsoWeek,
  type StoredSession,
  weekOverview,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CalendarDay, DraggableSession, LiveRegion, MoveMenu } from '@/components/calendar';
import { Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { activePlan, moveTargetsInRows, validateMoveInRows } from '@/data/training-plan';
import { t } from '@/i18n';
import {
  blockText,
  dropLabel,
  moveErrorText,
  nutritionHintNeeded,
  outcomeText,
} from '@/lib/calendar-format';
import { todayIso } from '@/lib/format';
import { weekRangeText } from '@/lib/history-format';
import { dayLabel, weekdayShort } from '@/lib/plan-format';
import { PLAN_CHANGE_DROPPED, useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';

interface Feedback {
  tone: 'success' | 'danger' | 'warning';
  text: string;
  /** „Rückgängig“: Einheit zurück auf ihren vorherigen Tag (verschieben bzw. zurücktauschen). */
  undo: { sessionId: string; from: string } | null;
  /** Hinweis „Dein Essensplan passt evtl. nicht mehr“ (PLAN-AUSWERTUNG 3). */
  nutrition: boolean;
}

/**
 * Trainingskalender (docs/PLAN-AUSWERTUNG.md 3, Etappe A1a): Woche Mo–So untereinander. Einheiten per langem Druck
 * aufnehmen und auf einen anderen Tag ziehen (freier Tag = verschieben, belegter Tag = tauschen, A-G4) oder über
 * „Verschieben …“ einen Tag wählen. Erlaubt/Grund rechnet ausschließlich packages/core (moveTargets/validateMove); die
 * Datenbank prüft erneut (Trigger bzw. swap_planned_sessions). Verschieben geht offline über die bestehende
 * Warteschlange (Pläne ohne Gesundheitsbezug), Tauschen braucht Verbindung.
 */
export default function CalendarScreen() {
  const router = useRouter();
  const app = useApp();
  const today = todayIso();
  const [week, setWeek] = useState(() => startOfIsoWeek(today));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [drag, setDrag] = useState<{
    sessionId: string;
    from: string;
    hover: string | null;
  } | null>(null);
  /** Zeilen der Tage und ihre Lage im Fenster (gemessen beim Aufnehmen; Scrollen ist beim Ziehen aus). */
  const dayViews = useRef(new Map<string, View>());
  const boxes = useRef(new Map<string, { y: number; height: number }>());
  /** Ansage: nativ über AccessibilityInfo, im Browser über die Live-Region (role=status, S3). */
  const [live, setLive] = useState({ text: '', version: 0 });
  const announce = useCallback((text: string) => {
    if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(text);
    setLive((current) => ({ text, version: current.version + 1 }));
  }, []);
  // Bildschirm verlassen → „Rückgängig“ verschwindet (wie beim Übungstausch).
  useFocusEffect(useCallback(() => () => setFeedback(null), []));

  const rows = app.rows;
  const active = useMemo(() => (rows ? activePlan(rows) : null), [rows]);
  const names = useMemo(
    () => new Map((rows?.plannedSessions ?? []).map((s) => [s.id, s.name_de] as const)),
    [rows],
  );
  const nameOf = useCallback((id: string) => names.get(id) ?? null, [names]);
  const dragTargets = useMemo(
    () => (rows && drag ? moveTargetsInRows(rows, drag.sessionId, today) : []),
    [rows, drag, today],
  );
  const menuTargets = useMemo(
    () => (rows && menuFor ? moveTargetsInRows(rows, menuFor, today) : []),
    [rows, menuFor, today],
  );

  /** Tag unter dem Finger (absoluteY im Fenster). */
  const dateAt = useCallback((absoluteY: number): string | null => {
    for (const [date, box] of boxes.current) {
      if (absoluteY >= box.y && absoluteY < box.y + box.height) return date;
    }
    return null;
  }, []);
  const measureDays = useCallback(() => {
    boxes.current.clear();
    for (const [date, view] of dayViews.current) {
      view.measureInWindow((_x, y, _width, height) => boxes.current.set(date, { y, height }));
    }
  }, []);

  // H3: Rückrufe lesen den neuesten Stand über eine Ref – so bleiben sie (und damit die Geste) stabil, auch wenn sich
  // `rows` während des Ziehens ändert (Hintergrund-Sync, Folgeblock, Neuladen).
  const latest = useRef({ rows, today, nameOf, app });
  useLayoutEffect(() => {
    latest.current = { rows, today, nameOf, app };
  });

  const perform = useCallback(
    async (sessionId: string, targetDate: string, isUndo: boolean) => {
      const { rows: current, today: day, nameOf: name, app: state } = latest.current;
      if (!current) return;
      setBusy(true);
      setFeedback(null);
      try {
        const outcome = await state.moveSessionTo(sessionId, targetDate);
        if (outcome.kind === 'blocked') {
          const text = t.calendar.notMoved(blockText({ reason: outcome.reason }, name));
          setFeedback({ tone: 'warning', text, undo: null, nutrition: false });
          announce(text);
          return;
        }
        const text = isUndo ? t.calendar.undone : outcomeText(outcome, name);
        setFeedback({
          tone: 'success',
          text,
          undo: isUndo ? null : { sessionId, from: outcome.from },
          nutrition: nutritionHintNeeded({
            supportsNutrition: state.backend.supportsNutrition,
            nutritionSetUp: current.nutritionSetup !== null,
            days: [outcome.from, outcome.to],
            today: day,
          }),
        });
        announce(text);
      } catch (caught) {
        // Der Plan ist schon neu geladen (moveSessionTo) – die Einheit steht wieder, wo sie wirklich liegt.
        const text = moveErrorText(caught);
        setFeedback({ tone: 'danger', text, undo: null, nutrition: false });
        announce(text);
      } finally {
        setBusy(false);
      }
    },
    [announce],
  );

  /** Gesperrter Tag (Ablegen, Bedienhilfen): Grund nennen, nichts senden. */
  const refuse = useCallback(
    (blocked: Parameters<typeof blockText>[0]) => {
      const text = t.calendar.notMoved(blockText(blocked, latest.current.nameOf));
      setFeedback({ tone: 'warning', text, undo: null, nutrition: false });
      announce(text);
    },
    [announce],
  );

  // Zieh-Rückrufe: stabil während des Ziehens (nur funktionale Zustands-Updates und die Ref), siehe DraggableSession.
  const startDrag = useCallback(
    (session: StoredSession) => {
      // Rückmeldung bleibt stehen, bis abgelegt wird – nichts darf beim Aufnehmen springen.
      measureDays();
      setDrag({ sessionId: session.id, from: session.scheduled_on, hover: session.scheduled_on });
      announce(t.calendar.dragging(session.name_de));
    },
    [announce, measureDays],
  );
  const moveDrag = useCallback(
    (absoluteY: number) => {
      const hover = dateAt(absoluteY);
      setDrag((current) => (current && current.hover !== hover ? { ...current, hover } : current));
    },
    [dateAt],
  );
  const endDrag = useCallback(() => setDrag(null), []);
  /** Ablegen: gesperrter Tag → Grund nennen; erlaubter Tag → verschieben bzw. tauschen. */
  const dropDrag = useCallback(
    (session: StoredSession, absoluteY: number) => {
      const { rows: current, today: day } = latest.current;
      if (!current) return;
      const date = dateAt(absoluteY);
      if (date === null || date === session.scheduled_on) return;
      const target = moveTargetsInRows(current, session.id, day).find((d) => d.date === date);
      if (!target) return;
      if (!target.allowed) {
        refuse(target);
        return;
      }
      void perform(session.id, date, false);
    },
    [dateAt, perform, refuse],
  );

  /** Bedienhilfen: „Einen Tag früher/später“ – genau ein Tag, sonst Grund. */
  const shift = (session: StoredSession, direction: -1 | 1) => {
    if (!rows || busy) return;
    const date = addDays(session.scheduled_on, direction);
    const check = validateMoveInRows(rows, session.id, date, today);
    if (!check.ok) {
      refuse(check);
      return;
    }
    void perform(session.id, date, false);
  };

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
  if (route !== '/today' || !rows) {
    return <Redirect href={route as Href} />;
  }

  const back = (
    <Button
      label={t.calendar.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
    />
  );

  if (!active) {
    return (
      <Screen title={t.calendar.title} testID="calendar" footer={back}>
        <LiveRegion text={live.text} version={live.version} />
        {feedback ? (
          <Notice tone={feedback.tone} testID="calendar-message" silent>
            <Body>{feedback.text}</Body>
          </Notice>
        ) : null}
        <Card>
          <Heading level={2}>{t.calendar.noPlanTitle}</Heading>
          <Body>{t.calendar.noPlanText}</Body>
          <Button
            label={t.calendar.noPlanButton}
            onPress={() => router.replace('/today')}
            testID="calendar-no-plan"
          />
        </Card>
      </Screen>
    );
  }

  const currentWeek = startOfIsoWeek(today);
  // Etappe A1b: zurückblättern bis zur Woche, in der das Nachtragen endet (heute − 14 Tage).
  const firstWeek = startOfIsoWeek(addDays(today, -SESSION_LOG_LIMITS.backdateDays));
  const lastDate = active.sessions.reduce(
    (last, s) => (s.scheduled_on > last ? s.scheduled_on : last),
    today,
  );
  const lastWeek = startOfIsoWeek(lastDate);
  const shownWeek = week < firstWeek ? firstWeek : week > lastWeek ? lastWeek : week;
  const days = weekOverview(active.sessions, today, shownWeek);
  /** Einträge je Tag (Etappe A1b: freie und nachgetragene Einheiten erscheinen im Kalender). */
  const logsOn = (date: string) => rows.sessionLogs.filter((l) => l.performed_on === date);
  const empty = days.every(
    (d) => d.session === null && d.skipped.length === 0 && logsOn(d.date).length === 0,
  );
  const deloadWeek = days.some((d) => d.session?.is_deload === true);
  const undoAllowed =
    feedback?.undo != null &&
    validateMoveInRows(rows, feedback.undo.sessionId, feedback.undo.from, today).ok;
  const menuSession = menuFor ? (active.sessions.find((s) => s.id === menuFor) ?? null) : null;

  const badgesOf = (session: StoredSession, isToday: boolean): string[] =>
    [
      isToday ? t.calendar.badges.today : null,
      session.status === 'completed' ? t.calendar.badges.completed : null,
      session.is_deload ? t.calendar.badges.deload : null,
      session.original_date && session.original_date !== session.scheduled_on
        ? t.calendar.badges.movedFrom(weekdayShort(session.original_date))
        : null,
      rows.sessionLogs.some(
        (l) =>
          l.planned_session_id === session.id &&
          l.performed_on === session.scheduled_on &&
          isBackfilledLog(l),
      )
        ? t.backfill.calendarBackfilled
        : null,
    ].filter((value): value is string => value !== null);

  return (
    <GestureHandlerRootView style={styles.root}>
      <Screen
        title={t.calendar.title}
        testID="calendar"
        footer={back}
        scrollEnabled={drag === null}
      >
        {app.offline ? <Notice tone="warning">{t.plan.offline}</Notice> : null}
        {app.planMessage === PLAN_CHANGE_DROPPED ? (
          <Notice tone="warning" testID="calendar-dropped">
            <Body>{t.plan.droppedChange}</Body>
            <Button label={t.common.close} variant="link" onPress={app.clearPlanMessage} />
          </Notice>
        ) : null}
        <Body muted>{Platform.OS === 'web' ? t.calendar.introWeb : t.calendar.intro}</Body>

        <View style={styles.header}>
          <Heading level={2}>
            {shownWeek === currentWeek ? t.calendar.current : t.week.title}
          </Heading>
          <Body testID="calendar-range">{weekRangeText(shownWeek, addDays(shownWeek, 6))}</Body>
        </View>
        <View style={styles.pager}>
          <View style={styles.pagerButton}>
            <Button
              label={t.week.previous}
              variant="secondary"
              accessibilityLabel={t.week.previousA11y}
              disabled={shownWeek <= firstWeek || drag !== null}
              onPress={() => setWeek(addDays(shownWeek, -7))}
              testID="calendar-prev"
            />
          </View>
          <View style={styles.pagerButton}>
            <Button
              label={t.week.next}
              variant="secondary"
              accessibilityLabel={t.week.nextA11y}
              disabled={shownWeek >= lastWeek || drag !== null}
              onPress={() => setWeek(addDays(shownWeek, 7))}
              testID="calendar-next"
            />
          </View>
        </View>

        <LiveRegion text={live.text} version={live.version} />
        {feedback ? (
          <Notice tone={feedback.tone} testID="calendar-message" silent>
            <Body>{feedback.text}</Body>
            {undoAllowed && feedback.undo ? (
              <Button
                label={t.calendar.undo}
                variant="secondary"
                loading={busy}
                onPress={() => {
                  const undo = feedback.undo;
                  if (undo) void perform(undo.sessionId, undo.from, true);
                }}
                testID="calendar-undo"
              />
            ) : null}
            {feedback.nutrition ? (
              <>
                <Body testID="calendar-nutrition-hint">{t.calendar.nutritionHint}</Body>
                <Button
                  label={t.calendar.nutritionButton}
                  variant="link"
                  onPress={() => router.push('/ernaehrung' as Href)}
                />
              </>
            ) : null}
          </Notice>
        ) : null}

        {deloadWeek ? <Notice tone="info">{t.calendar.deloadNote}</Notice> : null}
        {empty ? <Body muted>{t.calendar.empty}</Body> : null}

        <View style={styles.days}>
          {days.map((day) => {
            const session = day.session;
            const target: MoveTarget | null = drag
              ? (dragTargets.find((d) => d.date === day.date) ?? null)
              : null;
            // Vergangene Wochen (A1b): nur ansehen und nachtragen, nichts verschieben.
            const movable =
              session !== null &&
              session.status === 'planned' &&
              !session.is_deload &&
              shownWeek >= currentWeek;
            // Einträge des Tages, außer dem der hier gezeigten Einheit (die trägt schon „✓ erledigt“).
            const dayLogs = logsOn(day.date).filter(
              (l) => session === null || l.planned_session_id !== session.id,
            );
            const entryBlock = entryDateBlock(day.date, today);
            return (
              <CalendarDay
                key={day.date}
                date={day.date}
                isToday={day.isToday}
                target={target}
                hovered={drag !== null && drag.hover === day.date && drag.from !== day.date}
                dropText={target && target.reason !== 'current' ? dropLabel(target, nameOf) : null}
                lifted={drag?.from === day.date}
                viewRef={(view) => {
                  if (view) dayViews.current.set(day.date, view);
                  else dayViews.current.delete(day.date);
                }}
              >
                {session && movable ? (
                  <DraggableSession
                    session={session}
                    badges={badgesOf(session, false)}
                    disabled={busy}
                    dragging={drag?.sessionId === session.id}
                    onDragStart={startDrag}
                    onDragMove={moveDrag}
                    onDrop={dropDrag}
                    onDragEnd={endDrag}
                    onOpenMenu={() => {
                      setFeedback(null);
                      setMenuFor(session.id);
                    }}
                    onShift={(direction) => shift(session, direction)}
                  />
                ) : session ? (
                  <Body testID={`calendar-fixed-${day.date}`}>
                    {[session.name_de, ...badgesOf(session, false)].join(' · ')}
                  </Body>
                ) : day.skipped.length > 0 ? (
                  <Body muted>
                    {`${day.skipped[0]?.name_de ?? ''} – ${t.calendar.badges.skipped}`}
                  </Body>
                ) : dayLogs.length === 0 ? (
                  <Body muted>{t.calendar.rest}</Body>
                ) : null}
                {dayLogs.map((l) => {
                  const extra = [
                    l.is_free === true ? t.backfill.calendarFree : null,
                    isBackfilledLog(l) ? t.backfill.calendarBackfilled : null,
                  ]
                    .filter((value): value is string => value !== null)
                    .join(', ');
                  return (
                    <Button
                      key={l.id}
                      label={`✓ ${l.name_de}${extra ? ` · ${extra}` : ''}`}
                      variant="link"
                      accessibilityLabel={t.backfill.calendarLogA11y(l.name_de, extra)}
                      onPress={() => router.push(`/log/${l.id}` as Href)}
                      disabled={drag !== null}
                      testID={`calendar-log-${day.date}`}
                    />
                  );
                })}
                {entryBlock === null ? (
                  <Button
                    label={t.backfill.add}
                    variant="secondary"
                    accessibilityLabel={t.backfill.addA11y(dayLabel(day.date))}
                    disabled={drag !== null || busy}
                    onPress={() => router.push(`/nachtragen?date=${day.date}` as Href)}
                    testID={`calendar-add-${day.date}`}
                  />
                ) : entryBlock === 'too_old' ? (
                  <Body muted testID={`calendar-add-blocked-${day.date}`}>
                    {t.backfill.calendarTooOld}
                  </Body>
                ) : null}
              </CalendarDay>
            );
          })}
        </View>
      </Screen>
      <MoveMenu
        visible={menuSession !== null}
        title={menuSession ? t.calendar.menuTitle(menuSession.name_de) : ''}
        targets={menuTargets}
        nameOf={nameOf}
        onPick={(date) => {
          const id = menuFor;
          setMenuFor(null);
          if (id) void perform(id, date, false);
        }}
        onClose={() => setMenuFor(null)}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { gap: spacing.xs },
  pager: { flexDirection: 'row', gap: spacing.sm },
  pagerButton: { flex: 1 },
  days: { gap: spacing.sm },
});
