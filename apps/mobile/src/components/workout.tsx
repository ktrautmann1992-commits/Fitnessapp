import {
  type ReserveChoice,
  RESERVE_CHOICES,
  reserveFromRpe,
  rpeFromReserve,
  SESSION_RPE_LIMITS,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { useThemeColors } from '@/lib/theme';

import { MIN_TOUCH } from './ui';

/**
 * Bausteine des Trainingsmodus (docs/PLAN-PHASE-4.md 6.1, 6.2, 6.4): große −/+-Knöpfe mit Ansage, Haken
 * „Satz geschafft“, Auswahl „Wiederholungen in Reserve“ und der Schieberegler 0–10. Nur Anzeige – Werte und Regeln
 * kommen aus packages/core.
 */

/** Größere Tippflächen im Studio (≥ 56 dp, Haken noch größer). */
const BIG_TOUCH = 56;

export function Stepper({
  label,
  valueText,
  valueA11y,
  onDecrease,
  onIncrease,
  testID,
}: {
  /** „Gewicht“ bzw. „Wiederholungen“. */
  label: string;
  /** Große Anzeige, z. B. „22,5 kg“. */
  valueText: string;
  /** Für den Bildschirmleser, z. B. „22,5 Kilogramm“. */
  valueA11y: string;
  onDecrease: () => void;
  onIncrease: () => void;
  testID?: string;
}) {
  const theme = useThemeColors();
  const button = (sign: '−' | '+', action: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.workout.stepperLabel(label, valueA11y, action)}
      onPress={onPress}
      testID={testID ? `${testID}-${sign === '+' ? 'plus' : 'minus'}` : undefined}
      style={({ pressed }) => [
        styles.stepButton,
        { borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.stepSign, { color: theme.text }]}>{sign}</Text>
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      <Text style={[styles.stepLabel, { color: theme.textMuted }]}>{label}</Text>
      <View style={styles.stepRow}>
        {button('−', t.workout.decrease, onDecrease)}
        <Text
          style={[styles.stepValue, { color: theme.text }]}
          accessibilityLabel={`${label}: ${valueA11y}`}
          testID={testID ? `${testID}-value` : undefined}
        >
          {valueText}
        </Text>
        {button('+', t.workout.increase, onIncrease)}
      </View>
    </View>
  );
}

/** Großer Haken „Satz geschafft“ – Status nie nur über Farbe (Text + Symbol). */
export function SetDoneButton({
  setNo,
  done,
  onPress,
  testID,
}: {
  setNo: number;
  done: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const theme = useThemeColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={t.workout.setDoneA11y(setNo)}
      accessibilityState={{ checked: done }}
      aria-checked={done}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.doneButton,
        {
          backgroundColor: done ? theme.primary : theme.surface,
          borderColor: done ? theme.primary : theme.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[styles.doneText, { color: done ? theme.primaryText : theme.text }]}>
        {done ? `✓ ${t.workout.setDone}` : `○ ${t.workout.setOpen}`}
      </Text>
    </Pressable>
  );
}

/** „Wie viele Wiederholungen wären noch gegangen?“ – 0 / 1 / 2 / 3 / 4 / 5+ (optional, nochmal tippen = leer). */
export function ReserveChoices({
  rpe,
  onChange,
  setNo,
}: {
  rpe: number | null;
  onChange: (rpe: number | null) => void;
  setNo: number;
}) {
  const theme = useThemeColors();
  const selected = reserveFromRpe(rpe);
  return (
    <View
      style={styles.reserve}
      accessibilityRole="radiogroup"
      accessibilityLabel={`${t.workout.setLabel(setNo)}: ${t.workout.reserveQuestion}`}
    >
      <Text style={[styles.reserveLabel, { color: theme.textMuted }]}>
        {t.workout.reserveQuestion}
      </Text>
      <View style={styles.chips}>
        {RESERVE_CHOICES.map((value: ReserveChoice) => {
          const active = selected === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={t.workout.reserveA11y(value)}
              accessibilityState={{ checked: active }}
              aria-checked={active}
              onPress={() => onChange(active ? null : rpeFromReserve(value))}
              style={[
                styles.chip,
                {
                  borderColor: active ? theme.primary : theme.border,
                  borderWidth: active ? 3 : 1,
                  backgroundColor: theme.surface,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: theme.text },
                  active && { fontWeight: fontWeight.bold },
                ]}
              >
                {active ? `✓ ${t.workout.reserveOption(value)}` : t.workout.reserveOption(value)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Belastungsempfinden 0–10 als eigenes Bauteil (6.4): `accessibilityRole="adjustable"` mit Erhöhen/Verringern,
 * im Browser Pfeiltasten; jede Stufe mit Wort. Antippen einer Stufe wählt sie direkt.
 */
export function EffortSlider({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  testID?: string;
}) {
  const theme = useThemeColors();
  const { min, max } = SESSION_RPE_LIMITS;
  const words = t.workout.effortWords;
  const text =
    value === null ? t.workout.effortUnset : t.workout.effortValue(value, words[value] ?? '');
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  const step = (delta: number) => set((value ?? (delta > 0 ? min - 1 : max + 1)) + delta);
  const webKeys =
    Platform.OS === 'web'
      ? {
          onKeyDown: (event: { key: string; preventDefault: () => void }) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
              event.preventDefault();
              step(1);
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
              event.preventDefault();
              step(-1);
            }
          },
        }
      : {};
  return (
    <View style={styles.slider}>
      <Text style={[styles.sliderLabel, { color: theme.text }]}>{label}</Text>
      <View
        accessible
        focusable
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, ...(value !== null ? { now: value } : {}), text }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') step(1);
          if (event.nativeEvent.actionName === 'decrement') step(-1);
        }}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value ?? undefined}
        aria-valuetext={text}
        role="slider"
        tabIndex={0}
        testID={testID}
        style={styles.sliderTrack}
        {...webKeys}
      >
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((level) => {
          const active = value !== null && level <= value;
          const current = value === level;
          return (
            <Pressable
              key={level}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              aria-hidden
              testID={testID ? `${testID}-${level}` : undefined}
              onPress={() => set(level)}
              style={[
                styles.sliderStep,
                {
                  backgroundColor: active ? theme.primary : theme.surface,
                  borderColor: current ? theme.text : theme.border,
                  borderWidth: current ? 2 : 1,
                },
              ]}
            >
              <Text
                style={[styles.sliderNumber, { color: active ? theme.primaryText : theme.text }]}
              >
                {level}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.sliderValue, { color: theme.text }]} accessibilityLiveRegion="polite">
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flex: 1, gap: 2, minWidth: 150 },
  stepLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepButton: {
    width: BIG_TOUCH,
    height: BIG_TOUCH,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSign: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  stepValue: {
    flex: 1,
    minWidth: 64,
    textAlign: 'center',
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  doneButton: {
    minHeight: BIG_TOUCH + 8,
    borderWidth: 2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  doneText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  reserve: { gap: spacing.xs },
  reserveLabel: { fontSize: fontSize.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  chipText: { fontSize: fontSize.md },
  slider: { gap: spacing.xs },
  sliderLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  sliderTrack: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  sliderStep: {
    minWidth: MIN_TOUCH - 8,
    minHeight: MIN_TOUCH,
    flexGrow: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderNumber: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  sliderValue: { fontSize: fontSize.md },
});
