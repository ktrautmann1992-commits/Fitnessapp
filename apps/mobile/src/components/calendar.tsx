import type { MoveTarget, StoredSession } from '@fitnessapp/core';
import { fontSize, fontWeight, maxContentWidth, radius, spacing } from '@fitnessapp/ui';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { t } from '@/i18n';
import { menuLabel, type SessionName } from '@/lib/calendar-format';
import { dayLabel } from '@/lib/plan-format';
import { useThemeColors } from '@/lib/theme';

import { Body, Button, Heading, MIN_TOUCH } from './ui';

/**
 * Bausteine des Trainingskalenders (docs/PLAN-AUSWERTUNG.md 3, Etappe A1a). Drag-and-drop ohne neue Bibliothek:
 * react-native-gesture-handler (Pan, erst nach langem Druck aktiv = „LongPress + Pan“) und react-native-reanimated
 * (Karte folgt dem Finger). Läuft nativ und im Web-Export. Auf dem Handy-Browser liegt die Geste nur auf dem Griff ⠿
 * (touch-action: none) – sonst ließe sich die Seite über den Karten nicht mehr scrollen (Risiko 4 im Plan).
 * Gleichwertiger Weg ohne Ziehen: „Verschieben …“ (Liste aller Tage mit „erlaubt“ oder Grund) und die
 * Bedienhilfen-Aktionen „Einen Tag früher/später“.
 */

/** Langer Druck, bis eine Einheit aufgenommen wird (Millisekunden) – Bedienung, keine Fachregel. */
export const DRAG_LONG_PRESS_MS = 400;

export function DraggableSession({
  session,
  badges,
  disabled,
  dragging,
  onDragStart,
  onDragMove,
  onDrop,
  onDragEnd,
  onOpenMenu,
  onShift,
}: {
  session: StoredSession;
  badges: readonly string[];
  disabled: boolean;
  /** Diese Karte wird gerade gezogen (Hervorhebung). */
  dragging: boolean;
  /**
   * Rückrufe müssen während des Ziehens STABIL bleiben (useCallback ohne Abhängigkeit vom Zieh-Zustand): Ein neues
   * Gesture-Objekt bei jedem Neuzeichnen würde die laufende Geste abbrechen.
   */
  onDragStart: (session: StoredSession) => void;
  /** Senkrechte Position des Fingers im Fenster (absoluteY). */
  onDragMove: (absoluteY: number) => void;
  onDrop: (session: StoredSession, absoluteY: number) => void;
  onDragEnd: () => void;
  onOpenMenu: () => void;
  onShift: (direction: -1 | 1) => void;
}) {
  const theme = useThemeColors();
  const translateY = useSharedValue(0);
  const lifted = useSharedValue(0);
  const web = Platform.OS === 'web';

  const start = useCallback(() => {
    lifted.set(1);
    if (!web) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }
    onDragStart(session);
  }, [lifted, onDragStart, session, web]);
  const update = useCallback(
    (event: { translationY: number; absoluteY: number }) => {
      translateY.set(event.translationY);
      onDragMove(event.absoluteY);
    },
    [onDragMove, translateY],
  );
  const end = useCallback(
    (event: { absoluteY: number }, success: boolean) => {
      if (success) onDrop(session, event.absoluteY);
    },
    [onDrop, session],
  );
  const finalize = useCallback(() => {
    translateY.set(withTiming(0, { duration: 120 }));
    lifted.set(0);
    onDragEnd();
  }, [lifted, onDragEnd, translateY]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(DRAG_LONG_PRESS_MS)
        .enabled(!disabled)
        // Rückrufe im JS-Thread: sie ändern React-Zustand (Hervorhebung der Tage) – die Karte selbst bewegt Reanimated.
        .runOnJS(true)
        .onStart(start)
        .onUpdate(update)
        .onEnd(end)
        .onFinalize(finalize),
    [disabled, end, finalize, start, update],
  );

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }, { scale: lifted.get() ? 1.02 : 1 }],
    opacity: lifted.get() ? 0.95 : 1,
  }));

  const day = dayLabel(session.scheduled_on);
  const card = (
    <Animated.View
      testID={`calendar-card-${session.scheduled_on}`}
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: dragging ? theme.primary : theme.border,
          borderWidth: dragging ? 2 : 1,
        },
        dragging ? styles.cardLifted : null,
        animated,
      ]}
    >
      <View style={styles.cardRow}>
        {web ? (
          <GestureDetector gesture={gesture} touchAction="none" userSelect="none">
            <View
              accessibilityLabel={t.calendar.handleA11y(session.name_de)}
              testID={`calendar-handle-${session.scheduled_on}`}
              style={[styles.handle, { borderColor: theme.border }]}
            >
              <Text style={[styles.handleText, { color: theme.textMuted }]} aria-hidden>
                {t.calendar.handle}
              </Text>
            </View>
          </GestureDetector>
        ) : null}
        <View style={styles.cardText}>
          <Text
            accessible
            accessibilityLabel={t.calendar.cardA11y(session.name_de, day, badges.join(', '))}
            accessibilityActions={[
              { name: 'earlier', label: t.calendar.earlier },
              { name: 'later', label: t.calendar.later },
            ]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'earlier') onShift(-1);
              if (event.nativeEvent.actionName === 'later') onShift(1);
            }}
            style={[styles.cardTitle, { color: theme.text }]}
          >
            {session.name_de}
          </Text>
          {badges.length > 0 ? (
            <Text style={[styles.cardBadges, { color: theme.textMuted }]}>
              {badges.join(' · ')}
            </Text>
          ) : null}
        </View>
      </View>
      <Button
        label={t.calendar.moveButton}
        accessibilityLabel={t.calendar.moveButtonA11y(session.name_de, day)}
        variant="secondary"
        disabled={disabled}
        onPress={onOpenMenu}
        testID={`calendar-move-${session.scheduled_on}`}
      />
    </Animated.View>
  );
  // Nativ: die ganze Karte nach langem Druck ziehen (Scrollen geht vorher normal weiter).
  return web ? card : <GestureDetector gesture={gesture}>{card}</GestureDetector>;
}

/**
 * Live-Region für Ansagen im Browser (Wächter A1a S3): `role="status"`, `aria-live="polite"` – sie steht IMMER im
 * Bildschirm, nur der Text wechselt (neuer Schlüssel = gleiche Meldung wird erneut vorgelesen). Nativ sagt
 * AccessibilityInfo.announceForAccessibility an; die Region ist dort ausgeblendet.
 */
export function LiveRegion({ text, version }: { text: string; version: number }) {
  if (Platform.OS !== 'web') return null;
  return (
    <View role="status" aria-live="polite" testID="calendar-live" style={styles.visuallyHidden}>
      <Text key={version}>{text}</Text>
    </View>
  );
}

/** Ein Tag im Kalender; beim Ziehen hervorgehoben (erlaubt) bzw. abgeblendet mit Grund (gesperrt). */
export function CalendarDay({
  date,
  isToday,
  target,
  hovered,
  dropText,
  lifted,
  viewRef,
  onOpenDay,
  children,
}: {
  date: string;
  isToday: boolean;
  /** Tippen auf den Tag öffnet „Dein Tag“ (Etappe A2); undefined = gesperrt (z. B. während des Ziehens). */
  onOpenDay?: (() => void) | undefined;
  /** Nur während des Ziehens: erlaubt/Grund dieses Tages. */
  target: MoveTarget | null;
  hovered: boolean;
  dropText: string | null;
  /** Dieser Tag enthält die gezogene Karte (liegt beim Ziehen über den anderen). */
  lifted: boolean;
  /** Zugriff auf die Zeile, um beim Aufnehmen ihre Lage im Fenster zu messen. */
  viewRef: (view: View | null) => void;
  children: ReactNode;
}) {
  const theme = useThemeColors();
  const allowed = target?.allowed === true;
  const blocked = target !== null && !target.allowed && target.reason !== 'current';
  // Feste Rahmenbreite und Hinweis als Überlagerung: Beim Ziehen verschiebt sich NICHTS (sonst läge der Finger
  // plötzlich über einem anderen Tag).
  const borderColor = hovered
    ? allowed
      ? theme.success
      : theme.danger
    : allowed
      ? theme.success
      : isToday
        ? theme.primary
        : theme.border;
  return (
    <View
      testID={`calendar-day-${date}`}
      ref={viewRef}
      style={[
        styles.day,
        {
          backgroundColor: theme.background,
          borderColor,
          borderStyle: allowed && !hovered ? 'dashed' : 'solid',
        },
        lifted ? styles.dayLifted : null,
      ]}
    >
      <Pressable
        onPress={onOpenDay}
        disabled={onOpenDay === undefined}
        accessibilityRole="link"
        accessibilityLabel={t.day.openA11y(dayLabel(date))}
        hitSlop={8}
        style={styles.dayLabelPress}
        testID={`calendar-open-day-${date}`}
      >
        <Text style={[styles.dayLabel, { color: theme.text }]}>
          {dayLabel(date)}
          {isToday ? ` · ${t.calendar.badges.today}` : ''}
          <Text style={[styles.dayLabelLink, { color: theme.link }]}>{` · ${t.day.open} ›`}</Text>
        </Text>
      </Pressable>
      {children}
      {dropText ? (
        <View
          pointerEvents="none"
          style={[
            styles.overlay,
            {
              backgroundColor: `${theme.surface}${hovered ? 'FF' : 'F2'}`,
              borderColor: allowed ? theme.success : blocked ? theme.danger : theme.border,
              borderWidth: hovered ? 3 : 0,
            },
          ]}
        >
          <Text
            testID={`calendar-drop-${date}`}
            numberOfLines={4}
            style={[
              styles.dropText,
              { color: allowed ? theme.success : blocked ? theme.danger : theme.textMuted },
            ]}
          >
            {allowed ? '✓ ' : blocked ? '✕ ' : ''}
            {dropText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** „Verschieben …“: alle Tage der Woche mit „hierhin verschieben“, „tauschen mit …“ oder dem Grund der Sperre. */
export function MoveMenu({
  visible,
  title,
  targets,
  nameOf,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  targets: readonly MoveTarget[];
  nameOf: SessionName;
  onPick: (date: string) => void;
  onClose: () => void;
}) {
  const theme = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          testID="calendar-menu"
          style={[styles.dialog, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <ScrollView contentContainerStyle={styles.dialogContent}>
            <Heading level={2}>{title}</Heading>
            <Body muted>{t.calendar.menuIntro}</Body>
            {targets.map((target) => {
              const label = menuLabel(target, nameOf);
              return (
                <Pressable
                  key={target.date}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ disabled: !target.allowed }}
                  aria-disabled={!target.allowed}
                  disabled={!target.allowed}
                  onPress={() => onPick(target.date)}
                  testID={`calendar-menu-${target.date}`}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      borderColor: target.allowed ? theme.success : theme.border,
                      backgroundColor: theme.background,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: target.allowed ? theme.text : theme.textMuted },
                      target.allowed ? { fontWeight: fontWeight.semibold } : null,
                    ]}
                  >
                    {target.allowed ? '✓ ' : '✕ '}
                    {label}
                  </Text>
                </Pressable>
              );
            })}
            <Button label={t.common.cancel} variant="secondary" onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  day: {
    borderRadius: radius.md,
    borderWidth: 2,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.md,
    padding: spacing.sm,
    justifyContent: 'center',
  },
  dayLifted: { zIndex: 10, elevation: 10 },
  visuallyHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0.01,
  },
  dayLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  dayLabelPress: { minHeight: MIN_TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
  dayLabelLink: { fontWeight: fontWeight.semibold, textDecorationLine: 'underline' },
  dropText: { fontSize: fontSize.sm, lineHeight: 20, fontWeight: fontWeight.semibold },
  card: {
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  cardLifted: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, lineHeight: 22 },
  cardBadges: { fontSize: fontSize.sm, lineHeight: 20 },
  handle: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleText: { fontSize: fontSize.xl },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: maxContentWidth,
    maxHeight: '92%',
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  dialogContent: { padding: spacing.lg, gap: spacing.sm },
  option: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  optionText: { fontSize: fontSize.md, lineHeight: 22 },
});
