import { sessionTrainingLoad, sportForLog, sportLogDurationS, sportName } from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconChip } from '@/components/design';
import { kcalForLog, useSessionKcalContext, useWatchKcal } from '@/components/session-kcal';
import { sportIcon } from '@/components/sport-picker';
import { Text } from '@/components/text';
import { Body, Card, Heading } from '@/components/ui';
import type { SessionLogRow } from '@/data/types';
import { sportWeekFromRows } from '@/data/sport-entry';
import { t } from '@/i18n';
import { appFont } from '@/lib/fonts';
import { formatKcal } from '@/lib/nutrition-format';
import { useThemeColors } from '@/lib/theme';
import { cardioDurationText, kmText } from '@/lib/history-format';
import { useApp } from '@/state/app-state';

/**
 * „Sportarten diese Woche“ (Sportarten Stufe 2, docs/PLAN-SPORTARTEN.md 5): je Sportart Einheiten, Minuten, km
 * (GPS-Sportarten), kcal und Belastungspunkte; darunter die Trainingsbelastung aller Einheiten der Woche. Summen
 * rechnet sportWeekSummary() in packages/core. Ohne Sportart in der Woche: nichts (keine leere Karte).
 */

const S = t.sports.week;

function minutesText(durationS: number): string {
  const minutes = Math.round(durationS / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function SportWeekCard({ weekOf }: { weekOf: string }) {
  const app = useApp();
  const theme = useThemeColors();
  const kcalContext = useSessionKcalContext();
  const watchKcal = useWatchKcal();
  const rows = app.rows;
  const summary = useMemo(
    () =>
      rows
        ? sportWeekFromRows(
            rows,
            weekOf,
            (logId) => kcalForLog(kcalContext, rows, logId, watchKcal(logId))?.kcal ?? null,
          )
        : null,
    [rows, weekOf, kcalContext, watchKcal],
  );
  if (!summary || summary.sports.length === 0) return null;
  return (
    <Card>
      <View style={styles.section} testID="sport-week">
        <Heading level={2}>{S.title}</Heading>
        {summary.sports.map((total) => {
          const name = sportName(total.sport);
          const minutes = minutesText(total.durationS);
          const parts = [
            S.row(total.sessions, minutes),
            total.distanceM !== null ? `${kmText(total.distanceM)} km` : null,
            total.kcal !== null ? S.kcal(formatKcal(total.kcal)) : null,
            S.load(total.load),
          ].filter((v): v is string => v !== null);
          return (
            <View
              key={total.sport}
              style={styles.row}
              accessible
              accessibilityLabel={`${S.a11y(name, total.sessions, minutes)}, ${parts.slice(1).join(', ')}`}
              testID={`sport-week-${total.sport}`}
            >
              <IconChip area="ausdauer" icon={sportIcon(total.sport)} />
              <View style={styles.text}>
                <Text style={[styles.name, appFont('bold'), { color: theme.text }]}>{name}</Text>
                <Text style={[styles.meta, appFont('regular'), { color: theme.textMuted }]}>
                  {parts.join(' · ')}
                </Text>
              </View>
            </View>
          );
        })}
        <Body testID="sport-week-load">{S.totalLoad(summary.totalLoad)}</Body>
        <Body muted>{S.totalLoadInfo}</Body>
      </View>
    </Card>
  );
}

/** Sportart im Tagebuch-Eintrag (`/log/[id]`): Sportart, Dauer, Distanz (GPS-Sportarten), Belastung. */
export function SportLogInfo({ log }: { log: SessionLogRow }) {
  const sport = sportForLog(log);
  if (!sport) return null;
  const durationS = sportLogDurationS(log);
  const load = sessionTrainingLoad({ durationS, effort: log.session_rpe, sport });
  const duration = durationS !== null ? cardioDurationText(durationS) : null;
  return (
    <Card>
      <View testID="log-sport" style={styles.section}>
        <View style={styles.row}>
          <IconChip area="ausdauer" icon={sportIcon(sport)} />
          <Body>{t.sports.log.sport(sportName(sport))}</Body>
        </View>
        {duration ? <Body accessibilityLabel={duration.a11y}>{duration.text}</Body> : null}
        {log.sport_distance_m !== null && log.sport_distance_m > 0 ? (
          <Body accessibilityLabel={t.logEntry.distanceA11y(kmText(log.sport_distance_m))}>
            {t.logEntry.distance(kmText(log.sport_distance_m))}
          </Body>
        ) : null}
        {load !== null ? (
          <Body muted testID="log-sport-load">
            {t.sports.log.load(load)}
          </Body>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 16 },
  meta: { fontSize: 14 },
});
