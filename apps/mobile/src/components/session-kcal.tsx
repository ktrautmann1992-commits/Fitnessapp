import {
  BODY_METRIC_LIMITS,
  latestBodyWeight,
  sessionCalories,
  type SessionCalories,
  type SessionCaloriesInput,
  sessionCaloriesInputForLog,
  sessionCaloriesVisibility,
  type SessionCaloriesVisibility,
} from '@fitnessapp/core';
import { fontSize, spacing } from '@fitnessapp/ui';
import { type Href, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { StatValue } from '@/components/design';
import { Body, Button } from '@/components/ui';
import { wearableFor } from '@/components/wearables';
import { showEnergyNumbers } from '@/data/nutrition-plan';
import type { UserRows } from '@/data/types';
import { healthScreeningForPlan } from '@/data/training-plan';
import { t } from '@/i18n';
import { formatKcal } from '@/lib/nutrition-format';
import { useApp } from '@/state/app-state';
import { healthConsentStatus } from '@/state/flow';
import { useWearables } from '@/state/use-wearables';

/**
 * kcal je Einheit (docs/KONZEPT.md Abschnitt 5): Rechnung in packages/core (`sessionCalories`), hier nur Eingaben
 * sammeln und anzeigen. „ca. 320 kcal“ mit dem Zusatz „laut Uhr“ bzw. „geschätzt aus Dauer, Intensität und Gewicht“.
 * Ohne Einwilligung Gesundheitsdaten bzw. ohne Gewicht: nur ein Hinweis, keine Zahl. Bei „Kalorienzahlen anzeigen“ aus
 * oder Schwangerschaft: gar nichts. Nie auf dem Story-Bild (STORY_CARD_FIELDS ist eine Positivliste), nie loggen.
 */

const K = t.sessionKcal;

export interface SessionKcalContext {
  readonly visibility: SessionCaloriesVisibility;
  /** Letztes Gewicht – nur bei `show` (gültige Einwilligung), sonst null. */
  readonly weightKg: number | null;
}

/** Sichtbarkeit und Gewicht aus den Angaben der Person (ohne Uhr). */
export function useSessionKcalContext(): SessionKcalContext {
  const app = useApp();
  const rows = app.rows;
  if (!rows) return { visibility: 'hidden', weightKg: null };
  const pregnancy =
    healthScreeningForPlan(rows, app.versions)?.flags.includes('pregnancy') === true;
  const visibility = sessionCaloriesVisibility({
    showEnergyNumbers: showEnergyNumbers(rows),
    pregnancy,
    healthConsent: healthConsentStatus(rows, app.versions),
  });
  if (visibility !== 'show') return { visibility, weightKg: null };
  const latest = latestBodyWeight(rows.bodyMetrics)?.weightKg ?? null;
  const { min, max } = BODY_METRIC_LIMITS.weightKg;
  const weightKg = latest !== null && latest >= min && latest <= max ? latest : null;
  return { visibility, weightKg };
}

/** kcal der Uhr je Tagebuch-Eintrag (Health Connect, `wearable_sessions.kcal`); null = keine Messung. */
export function useWatchKcal(): (logId: string | null) => number | null {
  const { state } = useWearables();
  const rows = state.kind === 'ready' ? state.result.rows : null;
  return useCallback(
    (logId: string | null) => (logId ? (wearableFor(rows, logId)?.kcal ?? null) : null),
    [rows],
  );
}

/** Rechnung mit Gewicht aus dem Kontext; ungültige Eingaben → null (nie abstürzen, nichts loggen). */
export function kcalFor(
  context: SessionKcalContext,
  input: Omit<SessionCaloriesInput, 'bodyWeightKg'>,
): SessionCalories | null {
  if (context.visibility !== 'show') return null;
  try {
    return sessionCalories({ ...input, bodyWeightKg: context.weightKg });
  } catch {
    return null;
  }
}

/** kcal eines Tagebuch-Eintrags aus den Zeilen (Eintrag, Ausdauer, geplante Einheit); null = Eintrag unbekannt. */
export function kcalForLog(
  context: SessionKcalContext,
  rows: Pick<UserRows, 'sessionLogs' | 'cardioLogs' | 'plannedSessions'>,
  logId: string,
  measuredKcal: number | null,
): SessionCalories | null {
  const log = rows.sessionLogs.find((l) => l.id === logId);
  if (!log) return null;
  const cardio = rows.cardioLogs.find((c) => c.session_log_id === logId) ?? null;
  const planned = log.planned_session_id
    ? (rows.plannedSessions.find((p) => p.id === log.planned_session_id) ?? null)
    : null;
  return kcalFor(context, {
    ...sessionCaloriesInputForLog({ log, cardio, planned }),
    measuredKcal,
  });
}

function useHintTarget(visibility: SessionCaloriesVisibility): () => void {
  const router = useRouter();
  return () =>
    router.push(
      (visibility === 'needs_consent'
        ? '/health-consent'
        : '/onboarding/body_metrics?edit=1&zurueck=heute') as Href,
    );
}

/** Hinweis statt Zahl (keine Einwilligung bzw. kein Gewicht) mit Weg zur Eingabe. */
function KcalHint({ visibility }: { visibility: SessionCaloriesVisibility }) {
  const open = useHintTarget(visibility);
  const consent = visibility === 'needs_consent';
  return (
    <View style={styles.block} testID="session-kcal-hint">
      <Body muted>{consent ? K.needsConsent : K.needsWeight}</Body>
      <Button
        label={consent ? K.grantConsent : K.enterWeight}
        variant="link"
        onPress={open}
        testID="session-kcal-hint-open"
      />
    </View>
  );
}

/** Zeile „ca. 320 kcal“ + kleiner Zusatz; Hinweis ohne Gewicht/Einwilligung; sonst nichts. */
export function SessionKcalLine({
  context,
  result,
}: {
  context: SessionKcalContext;
  result: SessionCalories | null;
}) {
  if (context.visibility === 'hidden') return null;
  if (context.visibility === 'needs_consent') return <KcalHint visibility="needs_consent" />;
  if (result === null) return null;
  if (result.kcal === null) {
    return result.reason === 'no_weight' ? <KcalHint visibility="show" /> : null;
  }
  const value = formatKcal(result.kcal);
  const watch = result.source === 'watch';
  return (
    <View
      style={styles.block}
      testID="session-kcal"
      accessible
      accessibilityLabel={K.a11y(value, watch)}
    >
      <Body testID="session-kcal-value">{K.value(value)}</Body>
      <Body muted style={styles.note} testID="session-kcal-source">
        {watch ? K.watch : K.estimate}
      </Body>
    </View>
  );
}

/**
 * Großer Wert für das Zahlen-Raster einer Strecke (`/ausdauer/[id]`): „ca. 320“ / „kcal geschätzt“ bzw.
 * „kcal laut Uhr“. Ohne Gewicht/Einwilligung „–“ mit Hinweis darunter. Bringt seine eigene Zelle mit, damit die Seite
 * nur eine Zeile einfügen muss.
 */
export function SessionKcalStat({
  input,
  logId,
}: {
  input: Omit<SessionCaloriesInput, 'bodyWeightKg' | 'measuredKcal'>;
  logId: string | null;
}) {
  const context = useSessionKcalContext();
  const watchKcal = useWatchKcal();
  if (context.visibility === 'hidden') return null;
  const result = kcalFor(context, { ...input, measuredKcal: watchKcal(logId) });
  if (context.visibility === 'show' && (result === null || result.reason === 'no_duration')) {
    return null;
  }
  const value = result?.kcal != null ? formatKcal(result.kcal) : null;
  return (
    <View style={styles.cell} testID="session-kcal-stat">
      <StatValue
        size="lg"
        label={
          value === null
            ? K.statLabel
            : result?.source === 'watch'
              ? K.statLabelWatch
              : K.statLabelEstimate
        }
        value={value === null ? K.noValue : K.valueShort(value)}
        accessibilityLabel={value === null ? undefined : K.a11y(value, result?.source === 'watch')}
        valueTestID="session-kcal-value"
      />
      {value === null ? <KcalHint visibility={context.visibility} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 2 },
  note: { fontSize: fontSize.sm },
  cell: { width: '50%', paddingRight: spacing.sm },
});
