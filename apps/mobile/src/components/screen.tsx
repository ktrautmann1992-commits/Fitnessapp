import { fontSize, fontWeight, maxContentWidth, radius, spacing } from '@fitnessapp/ui';
import { useRef, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';

import { Body, Button, FieldError, Heading, ProgressBar } from './ui';

/**
 * Bildschirm-Rahmen: Inhalt scrollt, Knöpfe (footer) bleiben unten sichtbar.
 * Maximale Inhaltsbreite für Tablet/Desktop aus den Design-Tokens.
 */
export function Screen({
  title,
  intro,
  progress,
  children,
  footer,
  testID,
}: {
  title?: string;
  intro?: string;
  progress?: { current: number; total: number } | undefined;
  children?: ReactNode;
  footer?: ReactNode;
  testID?: string;
}) {
  const theme = useThemeColors();
  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      testID={testID}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          style={styles.flex}
        >
          <View style={styles.content}>
            {progress ? <ProgressBar current={progress.current} total={progress.total} /> : null}
            {title ? <Heading>{title}</Heading> : null}
            {intro ? <Body muted>{intro}</Body> : null}
            {children}
          </View>
        </ScrollView>
        {footer ? (
          <View
            style={[
              styles.footer,
              { borderTopColor: theme.border, backgroundColor: theme.background },
            ]}
          >
            <View style={styles.footerInner}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Zurück / Weiter (Weiter ist der Hauptknopf). */
export function StepFooter({
  onBack,
  onNext,
  nextLabel = t.common.next,
  loading = false,
  error,
  extra,
}: {
  onBack?: (() => void) | undefined;
  onNext: () => void;
  nextLabel?: string;
  loading?: boolean;
  error?: string | undefined;
  extra?: ReactNode;
}) {
  return (
    <View style={styles.footerContent}>
      <FieldError message={error} />
      <View style={styles.footerRow}>
        {onBack ? (
          <View style={styles.backWrap}>
            <Button label={t.common.back} variant="secondary" onPress={onBack} disabled={loading} />
          </View>
        ) : null}
        <View style={styles.flex}>
          <Button label={nextLabel} onPress={onNext} loading={loading} />
        </View>
      </View>
      {extra}
    </View>
  );
}

/** Hinweisleiste oben: Testmodus bzw. wartende Änderungen. */
export function TopBanner() {
  const theme = useThemeColors();
  const { backend, invalidConfig, pendingChanges } = useApp();
  const messages: string[] = [];
  if (backend.mode === 'local') {
    messages.push(invalidConfig ? t.banner.invalidConfig : t.banner.testMode);
  }
  if (pendingChanges > 0) {
    messages.push(t.banner.pendingSync(pendingChanges));
  }
  if (messages.length === 0) {
    return null;
  }
  return (
    <View
      accessibilityRole="summary"
      testID="top-banner"
      style={[styles.banner, { backgroundColor: theme.surface, borderBottomColor: theme.warning }]}
    >
      {messages.map((message) => (
        <Text key={message} style={[styles.bannerText, { color: theme.text }]}>
          {message}
        </Text>
      ))}
    </View>
  );
}

/** Bestätigungsdialog (funktioniert auch im Browser – Alert.alert tut das dort nicht). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  loading = false,
  error,
  confirmVariant = 'danger',
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** Nicht zerstörende Bestätigung (z. B. „Neu erstellen“) als Hauptknopf. */
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string | undefined;
}) {
  const theme = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View
          accessibilityRole="alert"
          accessibilityViewIsModal
          style={[styles.dialog, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Heading level={2}>{title}</Heading>
          <Body>{message}</Body>
          <FieldError message={error} />
          <Button
            label={confirmLabel}
            variant={confirmVariant}
            onPress={onConfirm}
            loading={loading}
          />
          <Button
            label={t.common.cancel}
            variant="secondary"
            onPress={onCancel}
            disabled={loading}
          />
        </View>
      </View>
    </Modal>
  );
}

/** Geburts- bzw. Zieldatum als drei Felder TT · MM · JJJJ (kein nativer Datumswähler nötig). */
export function DateInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: { day: string; month: string; year: string };
  onChange: (value: { day: string; month: string; year: string }) => void;
  error?: string | undefined;
}) {
  const theme = useThemeColors();
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const inputStyle = [
    styles.dateInput,
    {
      color: theme.text,
      backgroundColor: theme.surface,
      borderColor: error ? theme.danger : theme.border,
    },
  ];
  const digits = (text: string) => text.replace(/\D/g, '');
  return (
    <View style={styles.dateField} accessibilityLabel={label}>
      <Text style={[styles.dateLabel, { color: theme.text }]}>{label}</Text>
      <View style={styles.dateRow}>
        <View style={styles.datePart}>
          <Text style={[styles.datePartLabel, { color: theme.textMuted }]}>{t.age.day}</Text>
          <TextInput
            accessibilityLabel={`${label}: ${t.age.day}`}
            value={value.day}
            onChangeText={(text) => {
              const day = digits(text).slice(0, 2);
              onChange({ ...value, day });
              if (day.length === 2) {
                monthRef.current?.focus();
              }
            }}
            placeholder={t.age.dayPlaceholder}
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
            maxLength={2}
            style={inputStyle}
          />
        </View>
        <Text style={[styles.dateDot, { color: theme.textMuted }]}>.</Text>
        <View style={styles.datePart}>
          <Text style={[styles.datePartLabel, { color: theme.textMuted }]}>{t.age.month}</Text>
          <TextInput
            ref={monthRef}
            accessibilityLabel={`${label}: ${t.age.month}`}
            value={value.month}
            onChangeText={(text) => {
              const month = digits(text).slice(0, 2);
              onChange({ ...value, month });
              if (month.length === 2) {
                yearRef.current?.focus();
              }
            }}
            placeholder={t.age.monthPlaceholder}
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
            maxLength={2}
            style={inputStyle}
          />
        </View>
        <Text style={[styles.dateDot, { color: theme.textMuted }]}>.</Text>
        <View style={[styles.datePart, styles.dateYear]}>
          <Text style={[styles.datePartLabel, { color: theme.textMuted }]}>{t.age.year}</Text>
          <TextInput
            ref={yearRef}
            accessibilityLabel={`${label}: ${t.age.year}`}
            value={value.year}
            onChangeText={(text) => onChange({ ...value, year: digits(text).slice(0, 4) })}
            placeholder={t.age.yearPlaceholder}
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
            maxLength={4}
            style={inputStyle}
          />
        </View>
      </View>
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.xl },
  content: { width: '100%', maxWidth: maxContentWidth, gap: spacing.md },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  footerInner: { width: '100%', maxWidth: maxContentWidth },
  footerContent: { gap: spacing.sm },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  backWrap: { minWidth: 120 },
  banner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 3,
    alignItems: 'center',
  },
  bannerText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: 'center' },
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
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  dateField: { gap: spacing.xs },
  dateLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  datePart: { width: 72, gap: 2 },
  dateYear: { width: 104 },
  datePartLabel: { fontSize: fontSize.sm },
  dateDot: { fontSize: fontSize.xl, paddingBottom: spacing.sm },
  dateInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.lg,
    textAlign: 'center',
  },
});
