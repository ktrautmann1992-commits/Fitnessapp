import {
  type CrossDayQuestion,
  type MoveTarget,
  type WeekEntry,
  type WeekOpenSession,
  type WeekStatus,
  type WeekStatusDay,
  addDays,
  firstMoveDay,
  sportName,
  startOfIsoWeek,
} from '@fitnessapp/core';
import { fontSize, maxContentWidth, radius, spacing } from '@fitnessapp/ui';
import { type Href, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LiveRegion } from '@/components/calendar';
import { Icon, IconChip, type IconName, useAreaColors } from '@/components/design';
import { ConfirmDialog } from '@/components/screen';
import { kcalForLog, useSessionKcalContext, useWatchKcal } from '@/components/session-kcal';
import { sportIcon } from '@/components/sport-picker';
import { Text } from '@/components/text';
import { Body, Button, Heading, Notice } from '@/components/ui';
import { legLoadHintsFromRows } from '@/data/sport-entry';
import { activePlan, moveTargetsInRows, validateMoveInRows } from '@/data/training-plan';
import { weekStatusFromRows } from '@/data/week-status';
import { startKind } from '@/data/workout-session';
import { t } from '@/i18n';
import { useMinTouch } from '@/lib/accessibility';
import { blockText, menuLabel, moveErrorText } from '@/lib/calendar-format';
import { appFont } from '@/lib/fonts';
import { todayIso } from '@/lib/format';
import { dayLabel, weekdayName, weekdayShort } from '@/lib/plan-format';
import { useColorSchemeName, useThemeColors } from '@/lib/theme';
import {
  type BadgeTone,
  dayBadge,
  entryStats,
  entryTitle,
  insteadOfTag,
  questionTexts,
  stripDayA11y,
  weekRowMeta,
  weekRowTitle,
} from '@/lib/week-status-format';
import { useApp } from '@/state/app-state';
import { useLogAssignments } from '@/state/use-log-assignments';

/**
 * Training-Übersicht (docs/PLAN-AUSWERTUNG.md „Training-Übersicht“, Gründer-Freigabe 23.10.2026): Wochen-Leiste, Legende,
 * Werkzeugleiste, Tages-Blatt, Frage zu Uhr- bzw. freien Einheiten an anderen Tagen und Zeilen der Woche. Nur
 * Darstellung – Zustände und Zuordnungen rechnet weekStatus() in packages/core, Verschieben/Tauschen prüft
 * moveTargets()/validateMove() (wie der Kalender). Status immer mit Zeichen UND Wort, Tippflächen ≥ 44 px.
 */

const W = t.trainingWeek;

/** Wochen-Status der Woche von `weekOf` mit Antworten und kcal (laut Uhr bzw. geschätzt). */
export function useWeekStatus(weekOf: string): {
  status: WeekStatus | null;
  assignmentsReady: boolean;
  decide: (logId: string, sessionId: string | null) => Promise<void>;
} {
  const app = useApp();
  const { assignments, decide } = useLogAssignments();
  const kcalContext = useSessionKcalContext();
  const watchKcal = useWatchKcal();
  const rows = app.rows;
  const today = todayIso();
  const status = useMemo(
    () =>
      rows
        ? weekStatusFromRows(rows, {
            weekOf,
            today,
            assignments: assignments ?? [],
            kcalOf: (logId) => kcalForLog(kcalContext, rows, logId, watchKcal(logId))?.kcal ?? null,
          })
        : null,
    [rows, weekOf, today, assignments, kcalContext, watchKcal],
  );
  return { status, assignmentsReady: assignments !== null, decide };
}

function iconOf(kind: 'strength' | 'endurance'): IconName {
  return kind === 'endurance' ? 'run' : 'dumbbell';
}

function dayIcon(day: WeekStatusDay): { icon: IconName; area: 'training' | 'ausdauer' | null } {
  const kind = day.entries[0]?.kind ?? day.open[0]?.kind ?? day.doneElsewhere[0]?.kind ?? null;
  if (day.state === 'moved' || kind === null) return { icon: 'moon', area: null };
  // Sportarten Stufe 2: Icon der Sportart.
  const sport = day.entries[0]?.sport ?? null;
  if (sport) return { icon: sportIcon(sport), area: 'ausdauer' };
  return kind === 'endurance'
    ? { icon: 'run', area: 'ausdauer' }
    : { icon: 'dumbbell', area: 'training' };
}

// ---------------------------------------------------------------------------------------------------------
// Wochen-Leiste
// ---------------------------------------------------------------------------------------------------------

export function WeekStrip({
  days,
  onSelect,
  testID = 'plan-week',
}: {
  days: readonly WeekStatusDay[];
  onSelect: (date: string) => void;
  testID?: string;
}) {
  return (
    <View
      style={styles.strip}
      testID={testID}
      accessibilityLabel={W.stripA11y}
      accessibilityRole="list"
    >
      {days.map((day) => (
        <StripCell key={day.date} day={day} onPress={() => onSelect(day.date)} />
      ))}
    </View>
  );
}

function StripCell({ day, onPress }: { day: WeekStatusDay; onPress: () => void }) {
  const theme = useThemeColors();
  const training = useAreaColors('training');
  const tag = insteadOfTag(day);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={stripDayA11y(day)}
      accessibilityState={{ selected: day.isToday }}
      onPress={onPress}
      testID={`plan-week-day-${day.date}`}
      style={({ pressed }) => [
        styles.cell,
        {
          backgroundColor: day.isToday ? training.surface : theme.surface,
          borderColor: day.isToday ? theme.primary : theme.cardBorder,
          borderWidth: day.isToday ? 2 : 1,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.cellDay,
          appFont('bold'),
          { color: day.isToday ? training.icon : theme.textMuted },
        ]}
      >
        {weekdayShort(day.date)}
      </Text>
      <Text style={[styles.cellDate, appFont('extrabold'), { color: theme.text }]}>
        {String(Number(day.date.slice(8, 10)))}
      </Text>
      <StateDot day={day} />
      {tag ? (
        <View style={[styles.cellTag, { backgroundColor: theme.success }]}>
          <Text style={[styles.cellTagText, appFont('bold'), { color: theme.surface }]}>{tag}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Kreis je Zustand (Deko – der Zustand steht im Namen der Zelle). */
function StateDot({ day }: { day: WeekStatusDay }) {
  const theme = useThemeColors();
  const kind = day.open[0]?.kind ?? 'strength';
  const area = useAreaColors(kind === 'endurance' ? 'ausdauer' : 'training');
  if (day.state === 'done') {
    return (
      <View style={[styles.dot, { backgroundColor: theme.success }]} aria-hidden>
        <Icon name="check" size={16} color={theme.surface} strokeWidth={3} />
      </View>
    );
  }
  if (day.state === 'planned') {
    return (
      <View style={[styles.dot, styles.dotPlanned, { borderColor: area.strong }]} aria-hidden>
        <Icon name={iconOf(kind)} size={14} color={area.icon} />
      </View>
    );
  }
  if (day.state === 'missed') {
    return (
      <View style={[styles.dot, { backgroundColor: theme.cardBorder }]} aria-hidden>
        <Text style={[styles.dotGlyph, appFont('bold'), { color: theme.textMuted }]}>!</Text>
      </View>
    );
  }
  return (
    <View style={styles.dot} aria-hidden>
      <Text style={[styles.dotGlyph, appFont('bold'), { color: theme.textMuted }]}>
        {day.state === 'moved' ? (day.doneElsewhere[0]?.shift === 'late' ? '↷' : '↶') : '–'}
      </Text>
    </View>
  );
}

export function StripLegend() {
  const theme = useThemeColors();
  const training = useAreaColors('training');
  const item = (key: string, dot: React.ReactNode, label: string) => (
    <View key={key} style={styles.legendItem}>
      {dot}
      <Text style={[styles.legendText, appFont('regular'), { color: theme.textMuted }]}>
        {label}
      </Text>
    </View>
  );
  return (
    <View style={styles.legend} testID="plan-week-legend">
      {item(
        'done',
        <View style={[styles.legendDot, { backgroundColor: theme.success }]} />,
        W.legend.done,
      )}
      {item(
        'planned',
        <View
          style={[
            styles.legendDot,
            styles.legendRing,
            styles.dotPlanned,
            { borderColor: training.strong },
          ]}
        />,
        W.legend.planned,
      )}
      {item(
        'missed',
        <View style={[styles.legendDot, { backgroundColor: theme.cardBorder }]} />,
        W.legend.missed,
      )}
      {item(
        'today',
        <View style={[styles.legendDot, styles.legendRing, { borderColor: theme.primary }]} />,
        W.legend.today,
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Werkzeugleiste
// ---------------------------------------------------------------------------------------------------------

export function TrainingToolbar({
  items,
}: {
  items: readonly {
    key: string;
    icon: IconName;
    label: string;
    onPress: () => void;
    role?: 'link' | 'button';
    accessibilityLabel?: string;
    testID: string;
  }[];
}) {
  const theme = useThemeColors();
  const training = useAreaColors('training');
  const minTouch = useMinTouch();
  return (
    <View style={styles.toolbar} accessibilityLabel={W.toolbar.label}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole={item.role ?? 'link'}
          accessibilityLabel={item.accessibilityLabel ?? item.label}
          onPress={item.onPress}
          testID={item.testID}
          style={({ pressed }) => [
            styles.tool,
            {
              minHeight: Math.max(64, minTouch),
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Icon name={item.icon} size={22} color={training.icon} />
          <Text numberOfLines={1} style={[styles.toolText, appFont('bold'), { color: theme.text }]}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Kennzeichen
// ---------------------------------------------------------------------------------------------------------

export function StatusBadge({
  text,
  tone,
  testID,
}: {
  text: string;
  tone: BadgeTone;
  testID?: string;
}) {
  const theme = useThemeColors();
  const scheme = useColorSchemeName();
  const training = useAreaColors('training');
  const ausdauer = useAreaColors('ausdauer');
  const ernaehrung = useAreaColors('ernaehrung');
  const colors: Record<BadgeTone, { bg: string; fg: string }> = {
    success: { bg: ernaehrung.surface, fg: ernaehrung.icon },
    primary: { bg: training.surface, fg: training.icon },
    warning: { bg: ausdauer.surface, fg: ausdauer.icon },
    danger: { bg: scheme === 'dark' ? '#3A1518' : '#FDECEC', fg: theme.danger },
    muted: { bg: theme.background, fg: theme.textMuted },
  };
  const c = colors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]} testID={testID}>
      <Text style={[styles.badgeText, appFont('bold'), { color: c.fg }]}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Zeile der Woche
// ---------------------------------------------------------------------------------------------------------

export function WeekDayRow({
  day,
  pending,
  onPress,
}: {
  day: WeekStatusDay;
  pending: ReadonlySet<string>;
  onPress: () => void;
}) {
  const theme = useThemeColors();
  const { icon, area } = dayIcon(day);
  const badge = dayBadge(day);
  const quiet = day.state === 'rest' || day.state === 'moved' || day.state === 'skipped';
  const title = weekRowTitle(day);
  const meta = weekRowMeta(day, { pending });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${dayLabel(day.date)}: ${title.split(' · ').slice(1).join(' · ')}${meta ? `, ${meta}` : ''}, ${badge.text}`}
      onPress={onPress}
      testID={`week-day-${day.date}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: quiet ? theme.background : theme.surface,
          borderColor: day.isToday ? theme.primary : theme.cardBorder,
          borderWidth: day.isToday ? 2 : 1,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {area ? (
        <IconChip area={area} icon={icon} size={40} />
      ) : (
        <View style={[styles.restChip, { backgroundColor: theme.cardBorder }]} aria-hidden>
          <Icon name={icon} size={20} color={theme.textMuted} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text
          style={[
            styles.rowTitle,
            appFont('bold'),
            { color: quiet ? theme.textMuted : theme.text },
          ]}
        >
          {title}
        </Text>
        {meta ? (
          <Text style={[styles.rowMeta, appFont('regular'), { color: theme.textMuted }]}>
            {meta}
          </Text>
        ) : null}
      </View>
      <StatusBadge text={badge.text} tone={badge.tone} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Frage: Uhr- bzw. freie Einheit an einem anderen Tag
// ---------------------------------------------------------------------------------------------------------

export function CrossDayDialog({
  question,
  onAnswer,
  busy,
}: {
  question: CrossDayQuestion | null;
  onAnswer: (sessionId: string | null) => void;
  busy: boolean;
}) {
  const theme = useThemeColors();
  const texts = question ? questionTexts(question) : null;
  return (
    <Modal
      visible={question !== null}
      transparent
      animationType="fade"
      onRequestClose={() => undefined}
    >
      {question && texts ? (
        <View style={styles.backdropCenter}>
          <View
            accessibilityViewIsModal
            aria-modal
            role="dialog"
            aria-labelledby="cross-day-title"
            testID="cross-day-dialog"
            style={[
              styles.dialog,
              { backgroundColor: theme.surface, borderColor: theme.cardBorder },
            ]}
          >
            <IconChip
              area={question.kind === 'endurance' ? 'ausdauer' : 'training'}
              icon={question.fromWatch ? 'watch' : iconOf(question.kind)}
              size={52}
            />
            <View nativeID="cross-day-title">
              <Heading level={2}>{texts.title}</Heading>
            </View>
            <Body muted testID="cross-day-meta">
              {texts.meta}
            </Body>
            <Body testID="cross-day-text">{texts.text}</Body>
            <Button
              label={texts.yes}
              onPress={() => onAnswer(question.sessionId)}
              loading={busy}
              testID="cross-day-yes"
            />
            <Button
              label={texts.no}
              variant="secondary"
              onPress={() => onAnswer(null)}
              disabled={busy}
              testID="cross-day-no"
            />
            <Text style={[styles.dialogNote, appFont('regular'), { color: theme.textMuted }]}>
              {W.question.note}
            </Text>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Tages-Blatt
// ---------------------------------------------------------------------------------------------------------

export type SheetMessage = { tone: 'success' | 'danger' | 'info'; text: string };

/**
 * Tages-Blatt (Entwurf s3): alles zu einem Tag an einer Stelle – Starten, auf einen anderen Tag legen (Tag-Chips,
 * dieselbe Prüfung wie der Kalender), eintragen, Übungen, auslassen; erledigte Einträge ansehen und die Zuordnung
 * ändern; Ruhetag: Einheit hierher legen bzw. freie Einheit eintragen.
 */
export function DaySheet({
  date,
  status,
  onClose,
  onSelectDate,
  onShowExercises,
  onMessage,
  decide,
}: {
  date: string | null;
  status: WeekStatus | null;
  onClose: () => void;
  onSelectDate: (date: string) => void;
  onShowExercises: (date: string) => void;
  onMessage: (message: SheetMessage) => void;
  decide: (logId: string, sessionId: string | null) => Promise<void>;
}) {
  const theme = useThemeColors();
  const [skipFor, setSkipFor] = useState<{ id: string; noFreeDay: boolean } | null>(null);
  const [skipBusy, setSkipBusy] = useState(false);
  const app = useApp();
  const day = date && status ? (status.days.find((d) => d.date === date) ?? null) : null;

  async function confirmSkip() {
    if (!skipFor) return;
    setSkipBusy(true);
    try {
      await app.skipSession(skipFor.id);
      onMessage({
        tone: 'success',
        text: skipFor.noFreeDay ? t.plan.skippedResult : W.sheet.skippedResult,
      });
    } catch (caught) {
      onMessage({ tone: 'danger', text: moveErrorText(caught) });
    } finally {
      setSkipBusy(false);
      setSkipFor(null);
      onClose();
    }
  }

  return (
    <>
      <Modal
        visible={day !== null && skipFor === null}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.backdropBottom}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel={W.sheet.close}
            onPress={onClose}
          />
          {day ? (
            <View
              accessibilityViewIsModal
              aria-modal
              role="dialog"
              aria-label={dayLabel(day.date)}
              testID="day-sheet"
              style={[
                styles.sheet,
                { backgroundColor: theme.surface, borderColor: theme.cardBorder },
              ]}
            >
              <View style={[styles.grabber, { backgroundColor: theme.border }]} aria-hidden />
              <ScrollView
                contentContainerStyle={styles.sheetContent}
                keyboardShouldPersistTaps="handled"
              >
                <SheetBody
                  // Neuer Tag = frischer Zustand (aufgeklappte Zuordnung, Hinweise).
                  key={day.date}
                  day={day}
                  status={status}
                  onClose={onClose}
                  onSelectDate={onSelectDate}
                  onShowExercises={onShowExercises}
                  onMessage={onMessage}
                  onSkip={(id, noFreeDay) => setSkipFor({ id, noFreeDay })}
                  decide={decide}
                />
                <Button
                  label={W.sheet.close}
                  variant="link"
                  onPress={onClose}
                  testID="day-sheet-close"
                />
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>
      <ConfirmDialog
        visible={skipFor !== null}
        title={skipFor?.noFreeDay ? t.plan.skipTitle : W.sheet.skipTitle}
        message={skipFor?.noFreeDay ? t.plan.skipText : W.sheet.skipText}
        confirmLabel={skipFor?.noFreeDay ? t.plan.skipConfirm : W.sheet.skipConfirm}
        onConfirm={() => void confirmSkip()}
        onCancel={() => setSkipFor(null)}
        loading={skipBusy}
      />
    </>
  );
}

function SheetBody({
  day,
  status,
  onClose,
  onSelectDate,
  onShowExercises,
  onMessage,
  onSkip,
  decide,
}: {
  day: WeekStatusDay;
  status: WeekStatus | null;
  onClose: () => void;
  onSelectDate: (date: string) => void;
  onShowExercises: (date: string) => void;
  onMessage: (message: SheetMessage) => void;
  onSkip: (sessionId: string, noFreeDay: boolean) => void;
  decide: (logId: string, sessionId: string | null) => Promise<void>;
}) {
  const router = useRouter();
  const app = useApp();
  const today = todayIso();
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState({ text: '', version: 0 });
  const announce = (text: string) => setLive((v) => ({ text, version: v.version + 1 }));
  const rows = app.rows;
  if (!rows) return null;
  const go = (href: string) => {
    onClose();
    router.push(href as Href);
  };
  const nameOf = (id: string) => rows.plannedSessions.find((s) => s.id === id)?.name_de ?? null;

  async function move(sessionId: string, target: string) {
    setBusy(true);
    try {
      const outcome = await app.moveSessionTo(sessionId, target);
      if (outcome.kind === 'moved') {
        onMessage({ tone: 'success', text: t.plan.moved(weekdayName(target)) });
      } else if (outcome.kind === 'swapped') {
        onMessage({
          tone: 'success',
          text: t.calendar.swapped(
            dayLabel(outcome.to),
            nameOf(outcome.otherSessionId) ?? '',
            dayLabel(outcome.from),
          ),
        });
      } else {
        onMessage({ tone: 'danger', text: t.calendar.notMoved(blockText(outcome, nameOf)) });
      }
    } catch (caught) {
      onMessage({ tone: 'danger', text: moveErrorText(caught) });
    } finally {
      setBusy(false);
      onClose();
    }
  }

  async function assign(logId: string, sessionId: string | null) {
    setBusy(true);
    try {
      await decide(logId, sessionId);
      announce(W.sheet.assignmentSaved);
    } catch (caught) {
      onMessage({ tone: 'danger', text: moveErrorText(caught) });
    } finally {
      setBusy(false);
    }
  }

  const weekOpen = status ? status.days.flatMap((d) => d.open) : [];
  const nothingOpen = day.open.length === 0;
  const showFree = nothingOpen && day.date <= today;

  return (
    <View style={styles.sheetBody}>
      <LiveRegion text={live.text} version={live.version} />
      {day.entries.map((entry, index) => (
        <EntryBlock
          key={entry.logId ?? `done-${index}`}
          day={day}
          entry={entry}
          busy={busy}
          onView={entry.logId ? () => go(`/log/${entry.logId}`) : null}
          onAssign={(sessionId) => entry.logId && void assign(entry.logId, sessionId)}
        />
      ))}
      {day.open.map((open) => (
        <OpenBlock
          key={open.sessionId}
          day={day}
          open={open}
          busy={busy}
          entriesOnDay={(date) =>
            (status?.days.find((d) => d.date === date)?.entries.length ?? 0) > 0
          }
          onStart={(id) => go(`/workout/${id}`)}
          onMove={(target) => void move(open.sessionId, target)}
          onBlocked={(text) => announce(text)}
          onLog={(date) => go(`/nachtragen?date=${date}`)}
          onExercises={() => {
            onClose();
            onShowExercises(day.date);
          }}
          onSkip={(noFreeDay) => onSkip(open.sessionId, noFreeDay)}
        />
      ))}
      {day.doneElsewhere.map((moved) => (
        <View key={moved.sessionId} style={styles.block} testID="day-sheet-done-elsewhere">
          <SheetHeader
            icon={iconOf(moved.kind)}
            area={moved.kind === 'endurance' ? 'ausdauer' : 'training'}
            title={W.sheet.title(weekdayShort(day.date), moved.name_de)}
            meta={moved.shift === 'early' ? W.badge.early : W.badge.late}
          />
          <Body>
            {moved.shift === 'early'
              ? W.sheet.doneElsewhereEarly(moved.name_de, dayLabel(moved.doneOn))
              : W.sheet.doneElsewhereLate(moved.name_de, dayLabel(moved.doneOn))}
          </Body>
          <Button
            label={W.sheet.showDay(weekdayName(moved.doneOn))}
            variant="secondary"
            onPress={() => onSelectDate(moved.doneOn)}
            testID="day-sheet-goto"
          />
        </View>
      ))}
      {nothingOpen && day.entries.length === 0 && day.doneElsewhere.length === 0 ? (
        <SheetHeader
          icon="moon"
          area={null}
          title={W.sheet.restTitle(weekdayShort(day.date))}
          meta={dayLabel(day.date)}
        />
      ) : null}
      {day.skipped.map((s) => (
        <Body key={s.sessionId} muted>
          {W.sheet.skippedNote(s.name_de)}
        </Body>
      ))}
      {day.dropped.map((s) => (
        <Body key={s.sessionId} muted>
          {W.sheet.droppedNote(s.name_de)}
        </Body>
      ))}
      {nothingOpen && day.entries.length === 0 ? (
        <BringHere
          date={day.date}
          candidates={weekOpen}
          busy={busy}
          onMove={(id) => void move(id, day.date)}
        />
      ) : null}
      {showFree ? (
        <Button
          label={W.sheet.freeUnit}
          variant="secondary"
          icon="plus"
          onPress={() => go(`/nachtragen?date=${day.date}`)}
          testID="day-sheet-free"
        />
      ) : null}
      <Button
        label={W.sheet.dayView}
        accessibilityLabel={W.sheet.dayViewA11y(dayLabel(day.date))}
        variant="secondary"
        onPress={() => go(`/tag/${day.date}`)}
        testID="day-sheet-day"
      />
    </View>
  );
}

function SheetHeader({
  icon,
  area,
  title,
  meta,
}: {
  icon: IconName;
  area: 'training' | 'ausdauer' | null;
  title: string;
  meta: string;
}) {
  const theme = useThemeColors();
  return (
    <View style={styles.sheetHeader}>
      {area ? (
        <IconChip area={area} icon={icon} size={52} />
      ) : (
        <View style={[styles.restChipLarge, { backgroundColor: theme.cardBorder }]} aria-hidden>
          <Icon name={icon} size={26} color={theme.textMuted} />
        </View>
      )}
      <View style={styles.sheetHeaderText}>
        <Text
          accessibilityRole="header"
          aria-level={2}
          style={[styles.sheetTitle, appFont('extrabold'), { color: theme.text }]}
          testID="day-sheet-title"
        >
          {title}
        </Text>
        <Text style={[styles.sheetMeta, appFont('regular'), { color: theme.textMuted }]}>
          {meta}
        </Text>
      </View>
    </View>
  );
}

function EntryBlock({
  day,
  entry,
  busy,
  onView,
  onAssign,
}: {
  day: WeekStatusDay;
  entry: WeekEntry;
  busy: boolean;
  onView: (() => void) | null;
  onAssign: (sessionId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const stats = entryStats(entry);
  const tags: string[] = [entry.partial ? W.badge.partial : W.badge.done];
  if (entry.fromWatch) tags.push(W.sheet.fromWatch);
  const counts = entry.fulfils
    ? entry.fulfils.shift === 'same'
      ? W.sheet.countsForSameDay(entry.fulfils.name_de)
      : W.sheet.countsFor(weekdayShort(entry.fulfils.plannedOn), entry.fulfils.name_de)
    : entry.free
      ? W.sheet.extraUnit
      : null;
  const canUnassign = entry.fulfils !== null && entry.fulfils.mode !== 'linked';
  const canChange = entry.changeable && (canUnassign || entry.alternatives.length > 0);
  return (
    <View style={styles.block} testID="day-sheet-entry">
      <SheetHeader
        icon={entry.sport ? sportIcon(entry.sport) : iconOf(entry.kind)}
        area={entry.sport || entry.kind === 'endurance' ? 'ausdauer' : 'training'}
        title={W.sheet.title(weekdayShort(day.date), entryTitle(entry))}
        meta={[...tags, ...stats].join(' · ')}
      />
      {counts ? <Body testID="day-sheet-counts">{counts}</Body> : null}
      {onView ? (
        <Button
          label={W.sheet.view}
          variant="secondary"
          icon="eye"
          onPress={onView}
          testID="day-sheet-view"
        />
      ) : null}
      {canChange ? (
        <>
          <Button
            label={W.sheet.changeAssignment}
            variant="link"
            expanded={open}
            onPress={() => setOpen((v) => !v)}
            testID="day-sheet-change"
          />
          {open ? (
            <View style={styles.block}>
              {canUnassign && entry.fulfils ? (
                <Button
                  label={W.sheet.unassign(entry.fulfils.name_de)}
                  variant="secondary"
                  disabled={busy}
                  onPress={() => onAssign(null)}
                  testID="day-sheet-unassign"
                />
              ) : null}
              {entry.alternatives.map((alt) => (
                <Button
                  key={alt.sessionId}
                  label={W.sheet.assignTo(alt.name_de, weekdayShort(alt.date))}
                  variant="secondary"
                  disabled={busy}
                  onPress={() => onAssign(alt.sessionId)}
                  testID={`day-sheet-assign-${alt.date}`}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function OpenBlock({
  day,
  open,
  busy,
  entriesOnDay,
  onStart,
  onMove,
  onBlocked,
  onLog,
  onExercises,
  onSkip,
}: {
  day: WeekStatusDay;
  open: WeekOpenSession;
  busy: boolean;
  entriesOnDay: (date: string) => boolean;
  onStart: (sessionId: string) => void;
  onMove: (date: string) => void;
  onBlocked: (text: string) => void;
  onLog: (date: string) => void;
  onExercises: () => void;
  onSkip: (noFreeDay: boolean) => void;
}) {
  const app = useApp();
  const theme = useThemeColors();
  const today = todayIso();
  const rows = app.rows;
  const [info, setInfo] = useState<string | null>(null);
  if (!rows) return null;
  const session = activePlan(rows)?.sessions.find((s) => s.id === open.sessionId) ?? null;
  const exerciseCount = rows.plannedExercises.filter((e) => e.session_id === open.sessionId).length;
  const nameOf = (id: string) => rows.plannedSessions.find((s) => s.id === id)?.name_de ?? null;
  const start = session ? startKind(rows, session, today) : null;
  const hasDraft = app.drafts.some((d) => d.key === open.sessionId);
  const libraryReady = app.library.kind === 'ready';
  const weekOver = addDays(startOfIsoWeek(open.movedFrom ?? day.date), 6) < today;
  const movable = session !== null && session.status === 'planned' && !weekOver;
  const targets: MoveTarget[] = movable ? moveTargetsInRows(rows, open.sessionId, today) : [];
  // Wie das frühere „Einheit verschieben“: kein freier Tag (ohne Tausch) → Text „kein Tag mehr frei“.
  const noFreeDay = firstMoveDay(targets) === null;
  // Sportarten Stufe 2: sanfter Hinweis nach Sport mit hoher Beinbelastung am Vortag (nur Vorschlag).
  const legHint = legLoadHintsFromRows(rows, today).find((h) => h.sessionId === open.sessionId);
  const meta = [
    open.missed ? W.sheet.missedMeta : W.sheet.planned,
    open.estimatedMinutes ? W.hero.minutes(open.estimatedMinutes) : null,
    open.kind === 'strength' && exerciseCount > 0 ? W.hero.exercises(exerciseCount) : null,
    open.movedFrom ? W.a11y.movedFrom(weekdayShort(open.movedFrom)) : null,
    open.isDeload ? W.a11y.deload : null,
  ].filter((v): v is string => v !== null);

  return (
    <View style={styles.block} testID="day-sheet-open">
      <SheetHeader
        icon={iconOf(open.kind)}
        area={open.kind === 'endurance' ? 'ausdauer' : 'training'}
        title={W.sheet.title(weekdayShort(day.date), open.name_de)}
        meta={meta.join(' · ')}
      />
      {open.missed && movable ? (
        <Notice tone="info" testID="plan-missed">
          {t.plan.missed}
        </Notice>
      ) : null}
      {legHint ? (
        <Notice tone="info" testID="day-sheet-leg-hint">
          {`${t.sports.legHint[legHint.reason](sportName(legHint.sport), weekdayShort(legHint.sportDate))} ${t.sports.legHint.note}`}
        </Notice>
      ) : null}
      {hasDraft ? (
        <Button
          label={t.workout.draftContinue}
          icon="play"
          onPress={() => onStart(open.sessionId)}
          testID="day-sheet-start"
        />
      ) : start ? (
        open.kind === 'strength' && !libraryReady ? (
          <Body muted>{W.sheet.libraryMissing}</Body>
        ) : (
          <>
            <Button
              label={open.kind === 'endurance' ? W.sheet.startEndurance : W.sheet.start}
              icon="play"
              onPress={() => onStart(open.sessionId)}
              testID="day-sheet-start"
            />
            {start === 'catch_up' ? (
              <Body muted testID="day-sheet-start-hint">
                {day.date > today
                  ? W.sheet.startEarlyHint(weekdayName(day.date))
                  : W.sheet.startLateHint}
              </Body>
            ) : null}
          </>
        )
      ) : null}
      {movable && targets.length > 0 ? (
        <View style={styles.block}>
          <Text style={[styles.sectionTitle, appFont('bold'), { color: theme.text }]}>
            {W.sheet.moveTitle}
          </Text>
          <View style={styles.chips} testID="day-sheet-move">
            {targets.map((target) => (
              <DayChip
                key={target.date}
                target={target}
                done={entriesOnDay(target.date)}
                label={
                  target.reason === 'current'
                    ? W.sheet.chipA11yCurrent(dayLabel(target.date))
                    : menuLabel(target, nameOf)
                }
                disabled={busy}
                onPress={() => {
                  if (target.allowed) onMove(target.date);
                  else {
                    const text = menuLabel(target, nameOf);
                    setInfo(text);
                    onBlocked(text);
                  }
                }}
              />
            ))}
          </View>
          {info ? (
            <Body muted testID="day-sheet-move-info">
              {info}
            </Body>
          ) : null}
        </View>
      ) : null}
      {!hasDraft && day.date <= today ? (
        <Button
          label={W.sheet.logDone}
          variant="secondary"
          icon="check"
          onPress={() => onLog(day.date)}
          testID="day-sheet-log"
        />
      ) : null}
      <Button
        label={W.sheet.exercises}
        variant="secondary"
        icon="eye"
        onPress={onExercises}
        testID="day-sheet-exercises"
      />
      {movable ? (
        <Button
          label={W.sheet.skip}
          variant="link"
          onPress={() => onSkip(noFreeDay)}
          testID="day-sheet-skip"
        />
      ) : null}
    </View>
  );
}

function DayChip({
  target,
  done,
  label,
  disabled,
  onPress,
}: {
  target: MoveTarget;
  done: boolean;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useThemeColors();
  const minTouch = useMinTouch();
  const current = target.reason === 'current';
  const sub = target.allowed
    ? target.kind === 'swap'
      ? W.sheet.chipSwap
      : W.sheet.chipFree
    : current
      ? W.sheet.chipCurrent
      : done
        ? W.sheet.chipDone
        : W.sheet.chipBlocked;
  const active = target.allowed;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !active || disabled }}
      aria-disabled={!active || disabled}
      disabled={disabled}
      onPress={onPress}
      testID={`day-sheet-chip-${target.date}`}
      style={({ pressed }) => [
        styles.chip,
        {
          minHeight: Math.max(52, minTouch),
          backgroundColor: active ? theme.surface : theme.background,
          borderColor: current ? theme.primary : active ? theme.border : theme.cardBorder,
          borderWidth: current ? 2 : 1,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.chipDay,
          appFont('bold'),
          { color: active || current ? theme.text : theme.textMuted },
        ]}
      >
        {weekdayShort(target.date)}
      </Text>
      <Text
        numberOfLines={1}
        style={[
          styles.chipSub,
          appFont('semibold'),
          { color: active ? theme.link : theme.textMuted },
        ]}
      >
        {sub}
      </Text>
    </Pressable>
  );
}

function BringHere({
  date,
  candidates,
  busy,
  onMove,
}: {
  date: string;
  candidates: readonly WeekOpenSession[];
  busy: boolean;
  onMove: (sessionId: string) => void;
}) {
  const app = useApp();
  const theme = useThemeColors();
  const rows = app.rows;
  const today = todayIso();
  if (!rows || date < today) return null;
  const movable = candidates.filter((c) => validateMoveInRows(rows, c.sessionId, date, today).ok);
  const scheduledOn = (id: string) =>
    rows.plannedSessions.find((s) => s.id === id)?.scheduled_on ?? date;
  return (
    <View style={styles.block} testID="day-sheet-bring">
      <Text style={[styles.sectionTitle, appFont('bold'), { color: theme.text }]}>
        {W.sheet.bringHere}
      </Text>
      {movable.length === 0 ? <Body muted>{W.sheet.bringHereNone}</Body> : null}
      {movable.map((c) => (
        <Button
          key={c.sessionId}
          label={W.sheet.bringHereButton(c.name_de, weekdayShort(scheduledOn(c.sessionId)))}
          variant="secondary"
          disabled={busy}
          onPress={() => onMove(c.sessionId)}
          testID={`day-sheet-bring-${c.sessionId}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: 6 },
  cell: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    paddingTop: 8,
    paddingBottom: 6,
    alignItems: 'center',
    gap: 4,
    minHeight: 96,
  },
  cellDay: { fontSize: 12, lineHeight: 16 },
  cellDate: { fontSize: 17, lineHeight: 22 },
  cellTag: {
    borderRadius: radius.pill,
    paddingHorizontal: 3,
    paddingVertical: 1,
    marginHorizontal: -6,
  },
  cellTagText: { fontSize: 10, lineHeight: 14 },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPlanned: { borderWidth: 2, borderStyle: 'dashed' },
  dotGlyph: { fontSize: 15, lineHeight: 20 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 7 },
  legendRing: { borderWidth: 2, backgroundColor: 'transparent' },
  legendText: { fontSize: fontSize.sm, lineHeight: 20 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tool: {
    flexGrow: 1,
    flexBasis: 70,
    minWidth: 70,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  toolText: { fontSize: 13, lineHeight: 18 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  badgeText: { fontSize: 13, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 64,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 16, lineHeight: 22 },
  rowMeta: { fontSize: 13, lineHeight: 18 },
  restChip: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restChipLarge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdropCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  backdropBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  dialog: {
    width: '100%',
    maxWidth: maxContentWidth,
    borderWidth: 1,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.md,
  },
  dialogNote: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  sheet: {
    width: '100%',
    maxWidth: maxContentWidth,
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  grabber: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 10 },
  sheetContent: { padding: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  sheetBody: { gap: spacing.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sheetHeaderText: { flex: 1, minWidth: 0, gap: 2 },
  sheetTitle: { fontSize: 20, lineHeight: 26 },
  sheetMeta: { fontSize: 14, lineHeight: 20 },
  block: { gap: spacing.sm },
  sectionTitle: { fontSize: 16, lineHeight: 22 },
  chips: { flexDirection: 'row', gap: 6 },
  chip: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  chipDay: { fontSize: 14, lineHeight: 18 },
  chipSub: { fontSize: 11, lineHeight: 15 },
});
