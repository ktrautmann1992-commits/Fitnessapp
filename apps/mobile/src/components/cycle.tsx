import {
  CYCLE_BLEEDING_DE,
  CYCLE_BLEEDING_LEVELS,
  CYCLE_DAY_HINT_DE,
  CYCLE_ENERGY_DE,
  CYCLE_HEAVY_HELP_DE,
  CYCLE_INTENSITY_DE,
  CYCLE_LAST_PERIOD_ANSWERS,
  CYCLE_LAST_PERIOD_DE,
  CYCLE_MDR_SENTENCE,
  CYCLE_NUTRITION_HINT_DE,
  CYCLE_PREGNANCY_DE,
  CYCLE_PURPOSE,
  CYCLE_SLEEP_DE,
  CYCLE_STATIC_GUIDE_DE,
  CYCLE_STATUS_DE,
  CYCLE_STATUSES,
  CYCLE_SYMPTOM_DE,
  CYCLE_SYMPTOMS,
  CYCLE_URGENT_DE,
  CYCLE_WARNING_DE,
  cycleLongGapQuestionDe,
  lighterSessionVariant,
  LIGHTER_OFFER_DE,
  type CycleBleeding,
  type CycleDayHint,
  type CycleDismissibleCode,
  type CycleEntryPayload,
  type CycleLastPeriodAnswer,
  type CycleNutritionHint,
  type CycleStatus,
  type CycleSymptom,
  type CycleSymptomIntensity,
  type CycleWarningCode,
  type StoredSession,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, Checkbox, ChoiceList, Heading, Notice, OptionButton } from './ui';
import { Text } from '@/components/text';
import { deCycle as C } from '@/i18n/de-cycle';
import { appFont } from '@/lib/fonts';
import { useThemeColors } from '@/lib/theme';

/**
 * Bausteine der Zyklus-Bildschirme (Plan 9.1–9.4). Nur Darstellung – Regeln rechnet packages/core. Knöpfe ≥ 44 pt,
 * Bedeutung immer als Text (nicht nur Farbe/Zeichen), Energie-Skala mit Worten. Nie console.*.
 */

const SCALE = [1, 2, 3, 4, 5] as const;

/** Pflichtsatz MDR und Zweckbestimmung (Plan 3.6). */
export function CycleMdrNotice() {
  return (
    <Notice testID="cycle-mdr">
      <Body>{CYCLE_MDR_SENTENCE}</Body>
      <Body muted>{CYCLE_PURPOSE}</Body>
    </Notice>
  );
}

/** W7: fester Satz unter dem Tages-Check und im Pausen-Bildschirm. */
export function CycleUrgentNotice() {
  return (
    <Notice tone="info" testID="cycle-urgent">
      <Body>{CYCLE_URGENT_DE.body}</Body>
      <Body>{CYCLE_URGENT_DE.mental}</Body>
    </Notice>
  );
}

/** Einrichten bzw. Status ändern (Status, einmalige Frage „Letzte Periode“ bei natürlichem Zyklus, Schlaf). */
export function CycleSetupForm({
  initialStatus,
  initialSleep,
  askLastPeriod,
  onSave,
  busy,
  error,
}: {
  initialStatus: CycleStatus | null;
  initialSleep: boolean;
  askLastPeriod: boolean;
  onSave: (value: {
    status: CycleStatus;
    lastPeriodAtStart: CycleLastPeriodAnswer | null;
    sleepTracking: boolean;
  }) => void;
  busy: boolean;
  error?: string | undefined;
}) {
  const [status, setStatus] = useState<CycleStatus | null>(initialStatus);
  const [lastPeriod, setLastPeriod] = useState<CycleLastPeriodAnswer | null>(null);
  const [sleep, setSleep] = useState(initialSleep);
  const [missing, setMissing] = useState(false);
  return (
    <View style={styles.stack} testID="cycle-setup">
      <ChoiceList
        label={C.setup.statusLabel}
        options={CYCLE_STATUSES.map((value) => ({
          value,
          label: CYCLE_STATUS_DE[value],
          testID: `cycle-status-${value}`,
        }))}
        value={status}
        onChange={(value) => {
          setStatus(value);
          setMissing(false);
        }}
        error={missing ? C.setup.statusRequired : undefined}
      />
      {askLastPeriod && status === 'natural' ? (
        <ChoiceList
          label={C.setup.lastPeriodLabel}
          options={CYCLE_LAST_PERIOD_ANSWERS.map((value) => ({
            value,
            label: CYCLE_LAST_PERIOD_DE[value],
            testID: `cycle-last-period-${value}`,
          }))}
          value={lastPeriod}
          onChange={setLastPeriod}
        />
      ) : null}
      <Checkbox
        label={`${C.setup.sleepLabel} – ${C.setup.sleepHint}`}
        checked={sleep}
        onChange={setSleep}
        testID="cycle-sleep-toggle"
      />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button
        label={C.setup.save}
        loading={busy}
        testID="cycle-setup-save"
        onPress={() => {
          if (status === null) {
            setMissing(true);
            return;
          }
          onSave({
            status,
            lastPeriodAtStart: askLastPeriod && status === 'natural' ? lastPeriod : null,
            sleepTracking: sleep,
          });
        }}
      />
    </View>
  );
}

/**
 * Tages-Check (Plan 9.1 Nr. 2): vier Zeilen mit großen Knöpfen, Speichern sofort beim Tippen. Erneutes Tippen auf
 * die gewählte Stufe nimmt die Angabe zurück.
 */
export function CycleDayCheck({
  payload,
  sleepTracking,
  onChange,
  disabled = false,
}: {
  payload: CycleEntryPayload | null;
  sleepTracking: boolean;
  onChange: (patch: Partial<CycleEntryPayload>) => void;
  disabled?: boolean;
}) {
  const theme = useThemeColors();
  const symptoms = payload?.symptoms ?? {};
  const toggleSymptom = (symptom: CycleSymptom, intensity: CycleSymptomIntensity) => {
    const next = { ...symptoms };
    if (next[symptom] === intensity) delete next[symptom];
    else next[symptom] = intensity;
    onChange({ symptoms: next });
  };
  return (
    <View style={styles.stack} testID="cycle-day-check">
      <View>
        <ChoiceList<CycleBleeding>
          label={C.check.bleeding}
          horizontal
          options={CYCLE_BLEEDING_LEVELS.map((value) => ({
            value,
            label: CYCLE_BLEEDING_DE[value],
            testID: `cycle-bleeding-${value}`,
            disabled,
          }))}
          value={payload?.bleeding ?? null}
          onChange={(value) => onChange({ bleeding: payload?.bleeding === value ? null : value })}
        />
        <Body muted>{CYCLE_HEAVY_HELP_DE}</Body>
      </View>
      <ChoiceList<number>
        label={C.check.energy}
        horizontal
        options={SCALE.map((value) => ({
          value,
          label: `${value} · ${CYCLE_ENERGY_DE[value]}`,
          accessibilityLabel: `${C.check.energy} ${value}: ${CYCLE_ENERGY_DE[value]}`,
          testID: `cycle-energy-${value}`,
          disabled,
        }))}
        value={payload?.energy ?? null}
        onChange={(value) => onChange({ energy: payload?.energy === value ? null : value })}
      />
      <View accessibilityRole="list" accessibilityLabel={C.check.symptoms}>
        <Text style={[styles.label, appFont('semibold'), { color: theme.text }]}>
          {C.check.symptoms}
        </Text>
        {CYCLE_SYMPTOMS.map((symptom) => (
          <View key={symptom} style={styles.symptomRow}>
            <Text style={[styles.symptomLabel, appFont('regular'), { color: theme.text }]}>
              {CYCLE_SYMPTOM_DE[symptom]}
            </Text>
            <View style={styles.symptomButtons}>
              {(['mild', 'strong'] as const).map((intensity) => (
                <OptionButton
                  key={intensity}
                  role="checkbox"
                  compact
                  label={CYCLE_INTENSITY_DE[intensity]}
                  accessibilityLabel={C.check.symptomA11y(
                    CYCLE_SYMPTOM_DE[symptom],
                    CYCLE_INTENSITY_DE[intensity],
                  )}
                  selected={symptoms[symptom] === intensity}
                  onPress={() => toggleSymptom(symptom, intensity)}
                  disabled={disabled}
                  testID={`cycle-symptom-${symptom}-${intensity}`}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
      {sleepTracking ? (
        <ChoiceList<number>
          label={C.check.sleep}
          horizontal
          options={SCALE.map((value) => ({
            value,
            label: `${value} · ${CYCLE_SLEEP_DE[value]}`,
            testID: `cycle-sleep-${value}`,
            disabled,
          }))}
          value={payload?.sleep ?? null}
          onChange={(value) => onChange({ sleep: payload?.sleep === value ? null : value })}
        />
      ) : null}
    </View>
  );
}

/** Warnkarte mit „Mehr dazu“ (eingeklappt) und „Ausblenden“ (30 Tage). */
export function CycleWarningCard({
  code,
  onDismiss,
  onGoal,
}: {
  code: CycleWarningCode;
  onDismiss: () => void;
  onGoal?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const text = CYCLE_WARNING_DE[code];
  return (
    <Notice tone="warning" title={text.title} titleAsHeader testID={`cycle-warning-${code}`}>
      <Body>{text.body}</Body>
      {open ? <Body muted>{C.hints.source}</Body> : null}
      <View style={styles.row}>
        <Button
          label={open ? C.hints.less : C.hints.more}
          variant="link"
          expanded={open}
          onPress={() => setOpen(!open)}
        />
        {onGoal ? <Button label={C.hints.goalLink} variant="link" onPress={onGoal} /> : null}
        <Button
          label={C.hints.dismiss}
          variant="link"
          onPress={onDismiss}
          testID={`cycle-dismiss-${code}`}
        />
      </View>
    </Notice>
  );
}

/** Statischer Ratgeber, wenn das Flag cycle_warnings aus ist (Plan 3.4, S1). */
export function CycleStaticGuide() {
  return (
    <Card>
      <View style={styles.stack} testID="cycle-static-guide">
        <Heading level={2}>{CYCLE_STATIC_GUIDE_DE.title}</Heading>
        <Body>{CYCLE_STATIC_GUIDE_DE.intro}</Body>
        {CYCLE_STATIC_GUIDE_DE.items.map((item) => (
          <Body key={item}>{`• ${item}`}</Body>
        ))}
        <Body muted>{C.hints.source}</Body>
      </View>
    </Card>
  );
}

/** Hinweise des Tages (Ernährung ohne Zahlen, Häufung, Renntag). */
export function CycleHints({
  nutrition,
  day,
  onDismiss,
}: {
  nutrition: readonly CycleNutritionHint[];
  day: readonly CycleDayHint[];
  onDismiss: (code: CycleDismissibleCode) => void;
}) {
  if (nutrition.length === 0 && day.length === 0) return null;
  return (
    <View style={styles.stack} testID="cycle-hints">
      {nutrition.map((hint) => (
        <Notice key={hint} testID={`cycle-hint-${hint}`}>
          <Body>{CYCLE_NUTRITION_HINT_DE[hint]}</Body>
          {hint === 'iron' || hint === 'iron_plant' ? (
            <Button label={C.hints.dismiss} variant="link" onPress={() => onDismiss('iron')} />
          ) : null}
        </Notice>
      ))}
      {day.map((hint) => (
        <Notice key={hint} testID={`cycle-hint-${hint}`}>
          <Body>{CYCLE_DAY_HINT_DE[hint]}</Body>
          {hint === 'lighter_often' ? (
            <Button
              label={C.hints.dismiss}
              variant="link"
              onPress={() => onDismiss('lighter_often')}
            />
          ) : null}
        </Notice>
      ))}
    </View>
  );
}

/** Rückfrage nach 45 Tagen ohne Blutung (Plan 3.2). */
export function CycleLongGapQuestion({
  days,
  onYes,
  onNo,
}: {
  days: number;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <Notice testID="cycle-long-gap">
      <Body>{cycleLongGapQuestionDe(days)}</Body>
      <View style={styles.row}>
        <Button label={C.hints.longGapYes} variant="secondary" onPress={onYes} />
        <Button label={C.hints.longGapNo} variant="link" onPress={onNo} />
      </View>
    </Notice>
  );
}

/**
 * Angebot „Heute leichter?“ (Plan 3.3, ZY3): Vorschau der leichteren heutigen Einheit aus packages/core. Der Knopf
 * zum Übernehmen (für alle, mit `day_variant`) kommt gemeinsam mit Phase 8b in ZY5 – hier nur Vorschau.
 */
export function LighterOfferCard({ session }: { session: StoredSession }) {
  const lighter = lighterSessionVariant(session);
  return (
    <Card>
      <View style={styles.stack} testID="cycle-lighter-offer">
        <Heading level={2}>{LIGHTER_OFFER_DE.highlighted}</Heading>
        <Body>{C.offer.preview}</Body>
        {session.kind === 'strength' ? (
          <>
            <Body muted>{LIGHTER_OFFER_DE.strength}</Body>
            {lighter.exercises.map((exercise, index) => (
              <Body key={`${exercise.exercise_id}-${index}`}>
                {`• ${C.offer.strengthLine(
                  exercise.exercise_name_de,
                  exercise.sets,
                  session.exercises[index]?.sets ?? exercise.sets,
                )}`}
              </Body>
            ))}
          </>
        ) : (
          <Body>{`• ${C.offer.enduranceLine(lighter.estimated_minutes, session.estimated_minutes)}`}</Body>
        )}
        <Body muted>{LIGHTER_OFFER_DE.noProgress}</Body>
        <Body muted>{C.offer.later}</Body>
      </View>
    </Card>
  );
}

/** Pausen-Bildschirm Schwangerschaft (Plan 3.2): feste Sätze und Direktweg in den Gesundheits-Check. */
export function CyclePregnancyPause({
  onHealthCheck,
  onChangeStatus,
}: {
  onHealthCheck: () => void;
  onChangeStatus?: (() => void) | undefined;
}) {
  return (
    <View style={styles.stack} testID="cycle-pregnancy">
      <Notice title={CYCLE_PREGNANCY_DE.title} titleAsHeader>
        <Body>{CYCLE_PREGNANCY_DE.body}</Body>
        <Body>{CYCLE_PREGNANCY_DE.healthCheck}</Body>
      </Notice>
      <CycleUrgentNotice />
      <Button label={C.pregnancy.healthCheck} variant="secondary" onPress={onHealthCheck} />
      {onChangeStatus ? (
        <Button label={C.pregnancy.changeStatus} variant="link" onPress={onChangeStatus} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  label: { fontSize: 16, marginBottom: spacing.xs },
  symptomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 44,
  },
  symptomLabel: { flexGrow: 1, flexBasis: 160, fontSize: 16 },
  symptomButtons: { flexDirection: 'row', gap: spacing.sm },
});
