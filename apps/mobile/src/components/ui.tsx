import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import type { ReactNode, Ref } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { t } from '@/i18n';
import { useThemeColors } from '@/lib/theme';

/**
 * Grundbausteine der Oberfläche. Farben, Abstände und Schrift kommen ausschließlich aus den Design-Tokens
 * (@fitnessapp/ui, Quelle packages/ui/theme.css). Alle Tippflächen sind mindestens 48 px hoch.
 */

export const MIN_TOUCH = 48;

// ---------------------------------------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------------------------------------
export function Heading({ children, level = 1 }: { children: ReactNode; level?: 1 | 2 }) {
  const theme = useThemeColors();
  return (
    <Text
      accessibilityRole="header"
      style={[level === 1 ? styles.h1 : styles.h2, { color: theme.text }]}
    >
      {children}
    </Text>
  );
}

export function Body({
  children,
  muted = false,
  style,
}: {
  children: ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useThemeColors();
  return (
    <Text style={[styles.body, { color: muted ? theme.textMuted : theme.text }, style]}>
      {children}
    </Text>
  );
}

export function FieldError({ message, testID }: { message?: string | undefined; testID?: string }) {
  const theme = useThemeColors();
  if (!message) {
    return null;
  }
  return (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID={testID}
      style={[styles.error, { color: theme.danger }]}
    >
      {message}
    </Text>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Knöpfe
// ---------------------------------------------------------------------------------------------------------
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link';

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}) {
  const theme = useThemeColors();
  const inactive = disabled || loading;
  const container: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: theme.primary }
      : variant === 'danger'
        ? { backgroundColor: theme.surface, borderColor: theme.danger, borderWidth: 2 }
        : variant === 'secondary'
          ? { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }
          : { backgroundColor: 'transparent' };
  const textColor =
    variant === 'primary' ? theme.primaryText : variant === 'danger' ? theme.danger : theme.text;
  return (
    <Pressable
      accessibilityRole={variant === 'link' ? 'link' : 'button'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        variant === 'link' && styles.linkButton,
        container,
        { opacity: inactive ? 0.6 : pressed ? 0.8 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text
          style={[
            variant === 'link' ? styles.linkText : styles.buttonText,
            { color: variant === 'link' ? theme.link : textColor },
            variant === 'link' && { textDecorationLine: 'underline' },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Eingabefelder
// ---------------------------------------------------------------------------------------------------------
export function TextField({
  label,
  value,
  onChangeText,
  error,
  hint,
  placeholder,
  keyboardType,
  maxLength,
  autoComplete,
  testID,
  style,
  onSubmitEditing,
  inputRef,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string | undefined;
  hint?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  autoComplete?: 'email' | 'one-time-code' | 'off';
  testID?: string;
  style?: StyleProp<ViewStyle>;
  onSubmitEditing?: () => void;
  inputRef?: Ref<TextInput>;
  multiline?: boolean;
}) {
  const theme = useThemeColors();
  return (
    <View style={[styles.field, style]}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      {hint ? <Text style={[styles.hint, { color: theme.textMuted }]}>{hint}</Text> : null}
      <TextInput
        ref={inputRef}
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ disabled: false }}
        aria-invalid={error ? true : undefined}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
        onSubmitEditing={onSubmitEditing}
        testID={testID}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : theme.border,
          },
        ]}
      />
      <FieldError message={error} />
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Auswahl (einfach und mehrfach)
// ---------------------------------------------------------------------------------------------------------
export interface Choice<T extends string | number> {
  value: T;
  label: string;
  description?: string | undefined;
}

export function ChoiceList<T extends string | number>({
  label,
  groupLabel,
  options,
  value,
  onChange,
  error,
  horizontal = false,
}: {
  label?: string;
  /** Nur für Screenreader (wenn die Frage schon als Text darüber steht). */
  groupLabel?: string;
  options: readonly Choice<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  error?: string | undefined;
  horizontal?: boolean;
}) {
  const theme = useThemeColors();
  return (
    <View
      style={styles.field}
      accessibilityRole="radiogroup"
      accessibilityLabel={groupLabel ?? label}
    >
      {label ? <Text style={[styles.label, { color: theme.text }]}>{label}</Text> : null}
      <View style={horizontal ? styles.chipRow : styles.choiceColumn}>
        {options.map((option) => (
          <OptionButton
            key={String(option.value)}
            role="radio"
            label={option.label}
            description={option.description}
            selected={value === option.value}
            onPress={() => onChange(option.value)}
            compact={horizontal}
          />
        ))}
      </View>
      <FieldError message={error} />
    </View>
  );
}

export function OptionButton({
  role,
  label,
  description,
  selected,
  onPress,
  compact = false,
  filled = false,
  accessibilityLabel,
  disabled = false,
}: {
  role: 'radio' | 'checkbox';
  label: string;
  description?: string | undefined;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
  /** Ausgewählt = gefüllt in der Hauptfarbe (zusätzlich zum Häkchen), z. B. Gewichte zum Antippen. */
  filled?: boolean;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  const theme = useThemeColors();
  const solid = filled && selected;
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        compact ? styles.chip : styles.option,
        {
          // Ausgewählt: kräftiger Rahmen in der Hauptfarbe; Text bleibt in Textfarbe (Kontrast, WCAG AA).
          backgroundColor: solid ? theme.primary : theme.surface,
          borderColor: selected ? theme.primary : theme.border,
          borderWidth: selected ? 3 : 1,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {!compact ? (
        <View
          style={[
            role === 'radio' ? styles.radioDot : styles.checkBox,
            { borderColor: selected ? theme.primary : theme.textMuted },
          ]}
        >
          {selected ? (
            <View
              style={[
                role === 'radio' ? styles.radioDotInner : styles.checkBoxInner,
                { backgroundColor: theme.primary },
              ]}
            />
          ) : null}
        </View>
      ) : null}
      <View style={compact ? undefined : styles.optionTextWrap}>
        <Text
          style={[
            compact ? styles.chipText : styles.optionLabel,
            { color: solid ? theme.primaryText : theme.text },
            selected && { fontWeight: fontWeight.bold },
          ]}
        >
          {compact && selected ? `✓ ${label}` : label}
        </Text>
        {description ? (
          <Text
            style={[
              styles.optionDescription,
              { color: solid ? theme.primaryText : theme.textMuted },
              compact && styles.chipDescription,
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  error,
  testID,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string | undefined;
  testID?: string;
}) {
  const theme = useThemeColors();
  return (
    <View style={styles.field}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked }}
        aria-checked={checked}
        onPress={() => onChange(!checked)}
        testID={testID}
        style={styles.checkboxRow}
      >
        <View
          style={[
            styles.checkBox,
            styles.checkBoxLarge,
            {
              borderColor: error ? theme.danger : checked ? theme.primary : theme.textMuted,
              backgroundColor: checked ? theme.primary : theme.surface,
            },
          ]}
        >
          {checked ? <Text style={[styles.checkMark, { color: theme.primaryText }]}>✓</Text> : null}
        </View>
        <Text style={[styles.checkboxLabel, { color: theme.text }]}>{label}</Text>
      </Pressable>
      <FieldError message={error} />
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Hinweise, Karten, Zustände
// ---------------------------------------------------------------------------------------------------------
export function Notice({
  tone = 'info',
  title,
  children,
  testID,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  children?: ReactNode;
  testID?: string;
}) {
  const theme = useThemeColors();
  const accent =
    tone === 'warning'
      ? theme.warning
      : tone === 'danger'
        ? theme.danger
        : tone === 'success'
          ? theme.success
          : theme.primary;
  return (
    <View
      testID={testID}
      accessibilityRole={tone === 'danger' || tone === 'warning' ? 'alert' : undefined}
      style={[
        styles.notice,
        { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: accent },
      ]}
    >
      {title ? <Text style={[styles.noticeTitle, { color: theme.text }]}>{title}</Text> : null}
      {typeof children === 'string' ? <Body>{children}</Body> : children}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useThemeColors();
  return (
    <View
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}
    >
      {children}
    </View>
  );
}

export function LoadingState({ label = t.common.loading }: { label?: string }) {
  const theme = useThemeColors();
  return (
    <View style={styles.centered} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Body muted>{label}</Body>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.centered}>
      <Notice tone="danger">{message}</Notice>
      <Button label={t.common.retry} onPress={onRetry} />
    </View>
  );
}

export function ProgressBar({ current, total }: { current: number; total: number }) {
  const theme = useThemeColors();
  const label = t.common.progress(current, total);
  return (
    <View
      style={styles.progress}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: total, now: current, text: label }}
    >
      <Text style={[styles.progressText, { color: theme.textMuted }]}>{label}</Text>
      <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: theme.primary, width: `${Math.round((current / total) * 100)}%` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, lineHeight: 34 },
  h2: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, lineHeight: 26 },
  body: { fontSize: fontSize.md, lineHeight: 24 },
  error: { fontSize: fontSize.sm, lineHeight: 20, fontWeight: fontWeight.semibold },
  button: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButton: { paddingHorizontal: spacing.sm, minHeight: 44 },
  buttonText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center' },
  linkText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'center' },
  field: { gap: spacing.xs },
  label: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  hint: { fontSize: fontSize.sm, lineHeight: 20 },
  input: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
  },
  choiceColumn: { gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  optionTextWrap: { flex: 1, gap: 2 },
  optionLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  optionDescription: { fontSize: fontSize.sm, lineHeight: 20 },
  chip: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'center' },
  chipDescription: { textAlign: 'center' },
  radioDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotInner: { width: 10, height: 10, borderRadius: 5 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxInner: { width: 10, height: 10, borderRadius: 2 },
  checkBoxLarge: { width: 28, height: 28 },
  checkMark: { fontSize: fontSize.md, fontWeight: fontWeight.bold, lineHeight: 20 },
  checkboxRow: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  checkboxLabel: { flex: 1, fontSize: fontSize.md, lineHeight: 22 },
  notice: {
    borderWidth: 1,
    borderLeftWidth: 6,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  noticeTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  centered: { flex: 1, justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  progress: { gap: spacing.xs },
  progressText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  progressTrack: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: radius.pill },
});
