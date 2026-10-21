import {
  addDays,
  CYCLE_BLEEDING_DE,
  CYCLE_ENERGY_DE,
  CYCLE_RULES,
  CYCLE_SYMPTOM_DE,
  daysBetween,
  isAnyBleeding,
  type CycleEntryPayload,
  type CycleSymptom,
} from '@fitnessapp/core';
import { radius, spacing } from '@fitnessapp/ui';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CycleDayCheck } from '@/components/cycle';
import { useAreaColors } from '@/components/design';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { Body, Button, Heading, LoadingState, Notice } from '@/components/ui';
import { deCycle as C } from '@/i18n/de-cycle';
import { cycleErrorText, shortDateDe } from '@/lib/cycle-format';
import { appFont } from '@/lib/fonts';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { useCycle } from '@/state/use-cycle';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;

/** Beschreibung eines Tages für Bildschirmleser (nicht nur Farbe/Zeichen, Plan 9.4). */
function describe(payload: CycleEntryPayload | undefined): string {
  if (!payload) return C.history.noEntry;
  const parts: string[] = [];
  if (payload.bleeding) parts.push(`${C.check.bleeding}: ${CYCLE_BLEEDING_DE[payload.bleeding]}`);
  if (payload.energy) {
    parts.push(`${C.check.energy}: ${CYCLE_ENERGY_DE[payload.energy as 1 | 2 | 3 | 4 | 5]}`);
  }
  for (const [symptom, intensity] of Object.entries(payload.symptoms ?? {})) {
    parts.push(
      `${CYCLE_SYMPTOM_DE[symptom as CycleSymptom]} ${intensity === 'strong' ? 'stark' : 'leicht'}`,
    );
  }
  return parts.join(', ') || C.history.noEntry;
}

/**
 * Verlauf (Plan 9.1 Nr. 3): Monatsansicht der eigenen Einträge (Punkt = Blutung, kleines Zeichen = Energie oder
 * Beschwerden), vergangene Zykluslängen, Nachtragen bis 60 Tage zurück. Keine Vorhersage, keine Phasen-Farben.
 */
export default function CycleHistoryScreen() {
  const app = useApp();
  const view = useCycle();
  const theme = useThemeColors();
  const area = useAreaColors('zyklus');
  const [month, setMonth] = useState(() => view.today.slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ date: string; payload: CycleEntryPayload } | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>();

  if (app.status.kind === 'loading' || view.load.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (!app.session) return <Redirect href="/" />;

  const byDate = new Map(view.entries.map((e) => [e.date, e.payload]));
  const first = `${month}-01`;
  const [year, monthNo] = month.split('-').map(Number) as [number, number];
  const daysInMonth = new Date(Date.UTC(year, monthNo, 0)).getUTCDate();
  const offset = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i)),
  ];
  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(year, monthNo - 1 + delta, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const earliest = addDays(view.today, -CYCLE_RULES.backfillDays);
  const canEdit =
    view.state === 'active' && selected !== null && selected <= view.today && selected >= earliest;
  const editPayload =
    selected === null
      ? null
      : draft?.date === selected
        ? draft.payload
        : (byDate.get(selected) ?? null);

  async function save(patch: Partial<CycleEntryPayload>) {
    if (selected === null) return;
    const payload = { ...(editPayload ?? {}), ...patch };
    setDraft({ date: selected, payload });
    setMessage(undefined);
    try {
      await view.saveEntry(selected, payload);
    } catch (error) {
      setMessage({ tone: 'danger', text: cycleErrorText(error) });
    }
  }

  async function remove() {
    if (selected === null || !view.cycle) return;
    try {
      await view.cycle.deleteEntry(selected);
      setDraft(null);
      await view.reload();
      setMessage({ tone: 'success', text: C.history.deleted });
    } catch (error) {
      setMessage({ tone: 'danger', text: cycleErrorText(error) });
    }
  }

  const cycles = (view.derived?.cycles ?? []).filter((c) => c.length !== null).reverse();

  return (
    <Screen title={C.history.title} area="zyklus" icon="calendar" testID="cycle-history">
      <Body muted>{C.history.noPrediction}</Body>
      {view.entries.length === 0 ? (
        <Notice testID="cycle-history-empty">{C.history.empty}</Notice>
      ) : null}
      <View style={styles.monthNav}>
        <Button label={C.history.previousMonth} variant="link" onPress={() => shiftMonth(-1)} />
        <Heading level={2}>{`${MONTHS[monthNo - 1]} ${year}`}</Heading>
        <Button
          label={C.history.nextMonth}
          variant="link"
          onPress={() => shiftMonth(1)}
          disabled={month >= view.today.slice(0, 7)}
        />
      </View>
      <View style={styles.grid} accessibilityRole="list">
        {WEEKDAYS.map((day) => (
          <Text key={day} style={[styles.weekday, appFont('semibold'), { color: theme.textMuted }]}>
            {day}
          </Text>
        ))}
        {cells.map((date, index) => {
          if (date === null) return <View key={`leer-${index}`} style={styles.cell} />;
          const payload = byDate.get(date);
          const bleeding = isAnyBleeding(payload?.bleeding);
          const strongBleeding = payload?.bleeding === 'medium' || payload?.bleeding === 'heavy';
          const marker =
            payload && !bleeding && (payload.energy || Object.keys(payload.symptoms ?? {}).length)
              ? '·'
              : '';
          const future = date > view.today;
          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityLabel={C.history.dayA11y(shortDateDe(date), describe(payload))}
              accessibilityState={{ selected: selected === date, disabled: future }}
              disabled={future}
              onPress={() => setSelected(date)}
              testID={`cycle-day-${date}`}
              style={[
                styles.cell,
                {
                  borderColor: selected === date ? theme.primary : 'transparent',
                  opacity: future ? 0.4 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.dayNo,
                  appFont(date === view.today ? 'bold' : 'regular'),
                  { color: theme.text },
                ]}
              >
                {String(Number(date.slice(8)))}
              </Text>
              {bleeding ? (
                <View
                  style={[
                    strongBleeding ? styles.dotLarge : styles.dotSmall,
                    { backgroundColor: area.strong },
                  ]}
                />
              ) : (
                <Text style={[styles.marker, { color: theme.textMuted }]}>{marker}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
      <Body muted>{C.history.legendBleeding}</Body>
      {selected !== null ? (
        <View style={styles.stack} testID="cycle-history-edit">
          <Heading level={2}>{C.check.titleFor(shortDateDe(selected))}</Heading>
          {canEdit ? (
            <CycleDayCheck
              payload={editPayload}
              sleepTracking={view.settings?.sleepTracking ?? false}
              onChange={(patch) => void save(patch)}
            />
          ) : (
            <>
              <Body>{describe(byDate.get(selected))}</Body>
              {view.state === 'active' ? <Body muted>{C.history.backfillHint}</Body> : null}
            </>
          )}
          {byDate.has(selected) ? (
            <Button
              label={C.history.deleteEntry}
              variant="danger"
              onPress={() => void remove()}
              testID="cycle-delete-entry"
            />
          ) : null}
        </View>
      ) : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <Heading level={2}>{C.history.cycles}</Heading>
      {cycles.length === 0 ? (
        <Body muted>{C.history.noCycles}</Body>
      ) : (
        cycles
          .slice(0, 12)
          .map((c) => (
            <Body key={c.start}>
              {`${shortDateDe(c.start)}: ${C.history.cycleLength(c.length ?? daysBetween(c.start, view.today))}${
                c.complete ? '' : ` (${C.history.incomplete})`
              }`}
            </Body>
          ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 13 },
  cell: {
    width: `${100 / 7}%`,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: radius.sm,
  },
  dayNo: { fontSize: 15 },
  dotSmall: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  dotLarge: { width: 10, height: 10, borderRadius: 5, marginTop: 2 },
  marker: { fontSize: 14, lineHeight: 12 },
});
