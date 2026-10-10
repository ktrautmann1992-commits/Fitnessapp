import { type EquipmentLocation, type ExclusionEntry, exclusionOverview } from '@fitnessapp/core';
import { fontSize, fontWeight, spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog, Screen } from '@/components/screen';
import { SwapFeedback } from '@/components/swap';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { preferencesFromRows } from '@/data/exercise-swap';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { placeText } from '@/lib/swap-format';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';

/**
 * Einstellungen → „Ausgeschlossene Übungen“ (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 8.2, Etappe T2): je Ort Übung, Grund
 * und Ersatz; „Wieder zulassen“ mit Bestätigung (wirkt sofort); archivierte Übungen „nicht mehr verfügbar“ mit
 * „Entfernen“ (Wächter T1-K8); Hinweis ab 10 Ausschlüssen. Die Liste kommt aus packages/core (exclusionOverview).
 */
export default function ExclusionsScreen() {
  const router = useRouter();
  const app = useApp();
  const { ensureLibrary, library, rows } = app;
  const [confirm, setConfirm] = useState<ExclusionEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string>();
  const [message, setMessage] = useState<string>();
  useEffect(() => {
    void ensureLibrary();
  }, [ensureLibrary]);
  const lib = library.kind === 'ready' ? library.library : null;
  const groups = useMemo(
    () =>
      rows
        ? exclusionOverview(preferencesFromRows(rows), {
            library: lib?.exercises ?? null,
            lookup: lib ? (lib.displayExercises ?? lib.exercises) : null,
          })
        : [],
    [lib, rows],
  );

  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  const route = resolveEntryRoute({ session: app.session, rows: app.rows, versions: app.versions });
  if (route !== '/today' || !rows) {
    return <Redirect href={route as Href} />;
  }
  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings' as Href));
  const footer = <Button label={t.exclusions.back} variant="secondary" onPress={back} />;

  if (!app.backend.supportsExercisePreferences) {
    return (
      <Screen title={t.exclusions.title} testID="exclusions" footer={footer}>
        <Notice tone="info">{t.exclusions.notSupported}</Notice>
      </Screen>
    );
  }

  const nameOf = (entry: ExclusionEntry) =>
    entry.name ?? (lib ? t.exclusions.unknownName : entry.exerciseId);

  async function remove(entry: ExclusionEntry) {
    setBusy(true);
    setDialogError(undefined);
    try {
      await app.updateExercisePreferences(
        [{ op: 'remove', exercise_id: entry.exerciseId, location: entry.location }],
        null,
      );
      setMessage(
        entry.available === false ? t.exclusions.removed : t.exclusions.allowed(nameOf(entry)),
      );
      setConfirm(null);
    } catch (caught) {
      setDialogError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const unavailable = confirm?.available === false;

  return (
    <Screen
      title={t.exclusions.title}
      intro={t.exclusions.intro}
      testID="exclusions"
      footer={footer}
    >
      {message ? <SwapFeedback text={message} tone="success" /> : null}
      {library.kind === 'idle' || library.kind === 'loading' ? (
        <LoadingState />
      ) : !lib && groups.length > 0 ? (
        <Notice tone="warning" testID="exclusions-library-missing">
          {t.exclusions.libraryMissing}
        </Notice>
      ) : null}
      {groups.length === 0 ? (
        <Notice tone="info" testID="exclusions-empty">
          {t.exclusions.empty}
        </Notice>
      ) : null}
      {groups.map((group) => (
        <View key={group.location} style={styles.group} testID={`exclusions-${group.location}`}>
          <Heading level={2}>{t.exclusions.groups[group.location]}</Heading>
          {group.manyExclusions ? (
            <Notice tone="info" testID={`exclusions-many-${group.location}`}>
              {t.swap.manyExclusions}
            </Notice>
          ) : null}
          {group.entries.map((entry) => (
            <ExclusionRow
              key={`${entry.location}-${entry.exerciseId}`}
              entry={entry}
              name={nameOf(entry)}
              location={group.location}
              onPress={() => {
                setDialogError(undefined);
                setMessage(undefined);
                setConfirm(entry);
              }}
            />
          ))}
        </View>
      ))}
      <ConfirmDialog
        visible={confirm !== null}
        title={unavailable ? t.exclusions.removeTitle : t.exclusions.allowTitle}
        message={unavailable ? t.exclusions.removeText : t.exclusions.allowText}
        confirmLabel={unavailable ? t.exclusions.remove : t.exclusions.allow}
        confirmVariant="primary"
        onConfirm={() => (confirm ? void remove(confirm) : undefined)}
        onCancel={() => setConfirm(null)}
        loading={busy}
        error={dialogError}
        testID="dialog-exclusion"
      />
    </Screen>
  );
}

function ExclusionRow({
  entry,
  name,
  location,
  onPress,
}: {
  entry: ExclusionEntry;
  name: string;
  location: EquipmentLocation;
  onPress: () => void;
}) {
  const theme = useThemeColors();
  const unavailable = entry.available === false;
  return (
    <Card>
      <View testID="exclusion-row" style={styles.row}>
        {/* Überschrift Ebene 3 unter der Orts-Überschrift (Wächter T2-K7). */}
        <Text
          accessibilityRole="header"
          {...({ 'aria-level': 3 } as object)}
          style={[styles.rowTitle, { color: theme.text }]}
        >
          {name}
        </Text>
        <Body>{t.exclusions.kind[entry.kind]}</Body>
        {unavailable ? (
          <>
            <Body testID="exclusion-unavailable">{t.exclusions.unavailable}</Body>
            <Body muted>{t.exclusions.unavailableHint}</Body>
          </>
        ) : (
          <>
            <Body muted>
              {entry.replacementId === null
                ? t.exclusions.noReplacement
                : t.exclusions.replacement(entry.replacementName ?? entry.replacementId)}
            </Body>
            {entry.replacementAvailable === false ? (
              <Body muted>{t.exclusions.replacementUnavailable}</Body>
            ) : null}
          </>
        )}
        <Button
          label={unavailable ? t.exclusions.remove : t.exclusions.allow}
          variant="secondary"
          accessibilityLabel={
            unavailable
              ? t.exclusions.removeA11y(name, placeText(location))
              : t.exclusions.allowA11y(name, placeText(location))
          }
          onPress={onPress}
          testID={`exclusion-${unavailable ? 'remove' : 'allow'}-${entry.exerciseId}`}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  row: { gap: spacing.xs },
  rowTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, lineHeight: 24 },
});
