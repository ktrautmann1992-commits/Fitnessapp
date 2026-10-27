import {
  CARDIO_LOG_LIMITS,
  type CardioInterval,
  formatDuration,
  formatRowSplit,
  parseRowClock,
  rowIntervalSummary,
  rowPlausibility,
  rowSplitSeconds,
  rowWattsFromSplit,
  parseRowIntervals,
  type RowInputError,
} from '@fitnessapp/core';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Notice, TextField } from '@/components/ui';
import type { DraftCardio, DraftRowInterval } from '@/data/workout-draft';
import { t } from '@/i18n';
import { formatDecimal, parseDecimal } from '@/lib/format';

/**
 * Indoor-Rudern (Sportarten Stufe 1 · Etappe R, docs/PLAN-SPORTARTEN-STUFE-1.md 2.3): Technik-Hinweis, Eingabe von
 * Watt, Schlagzahl und Intervall-Ergebnis, Anzeige im Tagebuch. Rechnen und Prüfen nur in packages/core (rowing/*).
 */

const R = t.rowing;

/** Technik-Hinweis (Beine – Rumpf – Arme, Dämpfer 3–5) an jeder Ruder-Einheit. */
export function RowTechniqueNotice({ testID }: { testID?: string }) {
  return (
    <Notice tone="info" title={R.techniqueTitle} {...(testID ? { testID } : {})}>
      <Body>{R.technique}</Body>
    </Notice>
  );
}

/** Watt-Anzeige zum Split (nur Anzeige, Concept2-Formel). */
function WattsLine({ splitS, testID }: { splitS: number | null; testID?: string }) {
  const watts = rowWattsFromSplit(splitS);
  if (watts === null) return null;
  return (
    <Body muted accessibilityLabel={R.wattsA11y(watts)} {...(testID ? { testID } : {})}>
      {R.watts(watts)}
    </Body>
  );
}

const meters = (text: string) => {
  const value = parseDecimal(text);
  return value !== null && Number.isFinite(value) ? value : null;
};

/**
 * Zusatz-Felder beim Eintragen einer Ruder-Einheit: Watt und Schlagzahl (optional), Intervall-Ergebnis mit Split je
 * Wiederholung, Hinweise „Bitte prüfen“ (rowPlausibility). Fehler kommen aus cardioLogFromInput.
 */
export function RowEntryFields({
  cardio,
  durationS,
  distanceM,
  errors,
  onChange,
}: {
  cardio: DraftCardio;
  durationS: number | null;
  distanceM: number | null;
  errors: Partial<Record<'power' | 'strokeRate' | 'intervals', RowInputError>>;
  onChange: (patch: Partial<DraftCardio>) => void;
}) {
  const intervals = cardio.intervals ?? [];
  const parsed = intervals.map((r) => ({
    distanceM: meters(r.distanceM),
    durationS: parseRowClock(r.time),
  }));
  const complete: CardioInterval[] = parsed.flatMap((r) =>
    r.distanceM !== null && r.durationS !== null && Number.isFinite(r.durationS) && r.durationS > 0
      ? [{ distance_m: Math.round(r.distanceM), duration_s: r.durationS }]
      : [],
  );
  const strokeRate = parseDecimal(cardio.strokeRate ?? '');
  const power = parseDecimal(cardio.powerW ?? '');
  const checks = rowPlausibility({
    durationS,
    distanceM,
    strokeRate: strokeRate !== null && Number.isFinite(strokeRate) ? strokeRate : null,
    avgPowerW: power !== null && Number.isFinite(power) ? power : null,
    intervals: complete,
  }).filter((c) => c !== 'power_range' && c !== 'too_many_intervals');
  const setRow = (index: number, patch: Partial<DraftRowInterval>) =>
    onChange({
      intervals: intervals.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    });
  const totalSplit = rowSplitSeconds(durationS, distanceM);
  return (
    <View style={styles.block} testID="row-entry">
      <WattsLine splitS={totalSplit} testID="row-entry-watts" />
      <View style={styles.pair}>
        <TextField
          label={R.powerLabel}
          hint={R.powerHint}
          value={cardio.powerW ?? ''}
          onChangeText={(powerW) => onChange({ powerW })}
          keyboardType="number-pad"
          maxLength={4}
          style={styles.field}
          error={errors.power ? R.errors[errors.power] : undefined}
          testID="row-entry-power"
        />
        <TextField
          label={R.strokeRateLabel}
          hint={R.strokeRateHint}
          value={cardio.strokeRate ?? ''}
          onChangeText={(value) => onChange({ strokeRate: value })}
          keyboardType="number-pad"
          maxLength={2}
          style={styles.field}
          error={errors.strokeRate ? R.errors[errors.strokeRate] : undefined}
          testID="row-entry-stroke-rate"
        />
      </View>
      <Body style={styles.label}>{R.intervals.title}</Body>
      <Body muted>{R.intervals.intro}</Body>
      {intervals.map((row, index) => {
        const p = parsed[index];
        const split =
          p && p.distanceM !== null && p.durationS !== null
            ? rowSplitSeconds(p.durationS, p.distanceM)
            : null;
        return (
          <View key={index} style={styles.intervalRow} testID={`row-interval-${index}`}>
            <View style={styles.pair}>
              <TextField
                label={R.intervals.distance(index + 1)}
                value={row.distanceM}
                onChangeText={(distanceM) => setRow(index, { distanceM })}
                keyboardType="number-pad"
                maxLength={5}
                style={styles.field}
                testID={`row-interval-distance-${index}`}
              />
              <TextField
                label={R.intervals.time(index + 1)}
                value={row.time}
                onChangeText={(time) => setRow(index, { time })}
                keyboardType="numbers-and-punctuation"
                maxLength={8}
                style={styles.field}
                testID={`row-interval-time-${index}`}
              />
            </View>
            {split !== null ? (
              <Body muted testID={`row-interval-split-${index}`}>
                {R.split(formatRowSplit(split))}
              </Body>
            ) : null}
            <Button
              label={R.intervals.remove(index + 1)}
              variant="secondary"
              compact
              onPress={() => onChange({ intervals: intervals.filter((_, i) => i !== index) })}
              testID={`row-interval-remove-${index}`}
            />
          </View>
        );
      })}
      {errors.intervals ? (
        <Notice tone="warning" testID="row-entry-intervals-error">
          {R.errors[errors.intervals]}
        </Notice>
      ) : null}
      {intervals.length < CARDIO_LOG_LIMITS.intervalsMax ? (
        <Button
          label={R.intervals.add}
          variant="secondary"
          onPress={() =>
            onChange({
              // Neue Zeile übernimmt die Distanz der letzten (meist gleiche Wiederholungen, z. B. 4 × 500 m).
              intervals: [
                ...intervals,
                { distanceM: intervals.at(-1)?.distanceM ?? '500', time: '' },
              ],
            })
          }
          testID="row-interval-add"
        />
      ) : (
        <Body muted>{R.intervals.max}</Body>
      )}
      {complete.length > 0 ? (
        <RowIntervalTable intervals={complete} testID="row-entry-summary" />
      ) : null}
      {checks.map((c) => (
        <Notice key={c} tone="warning" testID={`row-entry-check-${c}`}>
          {R.checks[c]}
        </Notice>
      ))}
    </View>
  );
}

/** Intervall-Ergebnis als Liste: je Wiederholung Distanz, Zeit, Split; schnellste markiert; Durchschnitt. */
export function RowIntervalTable({
  intervals,
  testID,
}: {
  intervals: readonly CardioInterval[];
  testID?: string;
}) {
  const summary = rowIntervalSummary(intervals);
  return (
    <View style={styles.block} {...(testID ? { testID } : {})}>
      {summary.rows.map((r) => (
        <Body key={r.no} style={r.no === summary.bestNo ? styles.label : undefined}>
          {R.intervals.row(
            r.no,
            formatDecimal(r.distanceM),
            formatDuration(r.durationS),
            r.splitS === null ? null : formatRowSplit(r.splitS),
          )}
          {r.no === summary.bestNo && summary.rows.length > 1 ? ` (${R.intervals.best})` : ''}
        </Body>
      ))}
      {summary.averageSplitS !== null ? (
        <Body muted>{R.intervals.average(formatRowSplit(summary.averageSplitS))}</Body>
      ) : null}
      <Body muted>
        {R.intervals.total(
          formatDecimal(summary.totalDistanceM),
          formatDuration(summary.totalDurationS),
        )}
      </Body>
    </View>
  );
}

/** Tagebuch: Watt, Schlagzahl und Intervall-Ergebnis eines Ruder-Eintrags (nur, was eingetragen ist). */
export function RowLogInfo({
  cardio,
}: {
  cardio: {
    readonly duration_s: number;
    readonly distance_m: number | null;
    readonly avg_power_w?: number | null;
    readonly stroke_rate?: number | null;
    /** Gespeichert als jsonb – erst geprüft (parseRowIntervals). */
    readonly intervals?: unknown;
  };
}) {
  const split = rowSplitSeconds(cardio.duration_s, cardio.distance_m);
  const intervals = parseRowIntervals(cardio.intervals);
  return (
    <View style={styles.block} testID="log-row">
      <WattsLine splitS={split} />
      {cardio.avg_power_w != null ? <Body>{R.powerValue(cardio.avg_power_w)}</Body> : null}
      {cardio.stroke_rate != null ? <Body>{R.strokeRateValue(cardio.stroke_rate)}</Body> : null}
      {intervals ? (
        <>
          <Body style={styles.label}>{R.intervals.resultTitle}</Body>
          <RowIntervalTable intervals={intervals} testID="log-row-intervals" />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: { flex: 1, minWidth: 140 },
  label: { fontWeight: '700' },
  intervalRow: { gap: 6 },
});
