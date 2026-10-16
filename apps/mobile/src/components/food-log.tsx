import {
  FOOD_LOG_GROUPS,
  FOOD_LOG_PORTION_CHOICES,
  type FoodLogEntry,
  foodLogGroup,
  type PlannedMeal,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog } from '@/components/screen';
import { Body, Button, Card, ChoiceList, Heading, MIN_TOUCH, Notice } from '@/components/ui';
import { entryFromRow } from '@/data/food-log-rows';
import type { FoodLogEntryRow } from '@/data/types';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import {
  entryDetailText,
  groupLabel,
  intakeMacrosText,
  intakeSummaryText,
  portionNumber,
  portionText,
} from '@/lib/food-log-format';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import type { FoodLogActions, FoodLogDayView } from '@/state/use-food-log';

/**
 * Ernährungstagebuch im Tagesverlauf (Etappe E1, docs/PLAN-AUSWERTUNG.md Abschnitt 5): „Gegessen“ an der Plan-Mahlzeit
 * (Portion ½ … 2), Liste der Einträge nach Frühstück/Hauptmahlzeit/Mittag/Abend/Snack, Summe (ohne kcal bei „Zahlen
 * aus“), Ändern/Löschen/Favorit, „Eintragen“. Keine Bewertung, keine Farben fürs Essen (die kommen erst mit A2 und dann
 * nur mit Zahlen).
 */

/** „Gegessen“ unter einer Mahlzeit des Essensplans. */
export function PlanMealEaten({
  meal,
  date,
  view,
  actions,
  onMessage,
}: {
  meal: PlannedMeal;
  date: string;
  view: FoodLogDayView;
  actions: FoodLogActions;
  onMessage: (message: { text: string; tone: 'success' | 'danger' } | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!view.supported || !view.consentValid || view.dateStatus !== 'ok') return null;
  const logged = view.planItem(meal.slot);
  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    onMessage(null);
    try {
      await task();
    } catch (error) {
      onMessage({ text: errorText(error), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };
  if (logged === null) {
    return (
      <Button
        label={t.foodLog.eaten}
        accessibilityLabel={t.foodLog.eatenA11y(meal.titleDe)}
        variant="secondary"
        loading={busy}
        onPress={() => void run(() => actions.markEaten(meal, date, 1))}
        testID={`eaten-${meal.slot}`}
      />
    );
  }
  return (
    <View style={styles.eaten} testID={`eaten-done-${meal.slot}`}>
      <Body>{t.foodLog.eatenDone(portionText(logged.portion ?? 1))}</Body>
      <ChoiceList
        groupLabel={`${meal.titleDe}: ${t.foodLog.eatenPortionQuestion}`}
        horizontal
        options={FOOD_LOG_PORTION_CHOICES.map((value) => ({
          value,
          label: portionNumber(value),
        }))}
        value={logged.portion}
        onChange={(portion) => void run(() => actions.markEaten(meal, date, portion))}
      />
      <Button
        label={t.foodLog.eatenUndo}
        accessibilityLabel={t.foodLog.eatenUndoA11y(meal.titleDe)}
        variant="link"
        disabled={busy}
        onPress={() => void run(() => actions.remove(logged.id))}
        testID={`eaten-undo-${meal.slot}`}
      />
    </View>
  );
}

/** Abschnitt „Gegessen“ eines Tages. */
export function FoodLogDaySection({
  date,
  dayText,
  view,
  actions,
  showNumbers,
}: {
  date: string;
  dayText: string;
  view: FoodLogDayView;
  actions: FoodLogActions;
  showNumbers: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);
  const [deleting, setDeleting] = useState<FoodLogEntryRow | null>(null);
  const [busy, setBusy] = useState(false);
  const theme = useThemeColors();
  if (!view.supported) return null;
  const header = <Heading level={2}>{t.foodLog.sectionTitle}</Heading>;
  if (!view.consentValid) {
    return (
      <View style={styles.section} testID="food-log">
        {header}
        <Notice tone="info" testID="food-log-consent">
          <Body>{t.foodLog.consentNeeded}</Body>
          <Button
            label={t.foodLog.consentButton}
            variant="secondary"
            onPress={() => router.push('/health-consent')}
            testID="food-log-consent-button"
          />
        </Notice>
      </View>
    );
  }
  const run = async (task: () => Promise<unknown>, success: string | null) => {
    setBusy(true);
    setMessage(null);
    try {
      await task();
      if (success) setMessage({ text: success, tone: 'success' });
    } catch (error) {
      setMessage({ text: errorText(error), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };
  const editable = view.dateStatus === 'ok';
  const intake = view.intake;
  return (
    <View style={styles.section} testID="food-log">
      {header}
      <NutritionSyncNotice />
      {view.entries.length === 0 ? (
        <Body muted testID="food-log-empty">
          {editable ? `${t.foodLog.empty} ${t.foodLog.emptyHint}` : t.foodLog.empty}
        </Body>
      ) : (
        <Card>
          <Body testID="food-log-summary">{intakeSummaryText(intake)}</Body>
          {intake.kind === 'numbers' && intake.count > intake.withoutValue ? (
            <Body muted>{intakeMacrosText(intake)}</Body>
          ) : null}
          {intake.kind === 'numbers' && intake.withoutValue > 0 ? (
            <Body muted>{t.foodLog.withoutValue(intake.withoutValue)}</Body>
          ) : null}
          {intake.kind === 'numbers' && !intake.macrosComplete ? (
            <Body muted>{t.foodLog.macrosIncomplete}</Body>
          ) : null}
          {intake.kind === 'numbers' ? <Body muted>{t.foodLog.estimate}</Body> : null}
        </Card>
      )}
      {FOOD_LOG_GROUPS.map((group) => {
        const items = view.entries.filter((e) => foodLogGroup(e.slot) === group);
        if (items.length === 0) return null;
        return (
          <View key={group} style={styles.group} testID={`food-log-group-${group}`}>
            <Text
              accessibilityRole="header"
              style={[styles.groupTitle, { color: theme.textMuted }]}
            >
              {groupLabel(group)}
            </Text>
            {items.map((row) => (
              <FoodLogEntryItem
                key={row.id}
                row={row}
                showNumbers={showNumbers}
                title={view.displayTitle(row)}
                favorite={view.isFavorite(entryFromRow(row))}
                editable={editable}
                busy={busy}
                onEdit={() =>
                  router.push(
                    `/ernaehrung/eintragen?tag=${date}&bearbeiten=${encodeURIComponent(row.id)}` as Href,
                  )
                }
                onDelete={() => setDeleting(row)}
                onToggleFavorite={() =>
                  void run(() => actions.toggleFavorite(entryFromRow(row)), null)
                }
              />
            ))}
          </View>
        );
      })}
      {view.dateStatus === 'future' ? (
        <Body muted testID="food-log-future">
          {t.foodLog.futureDay}
        </Body>
      ) : view.dateStatus === 'too_old' ? (
        <Body muted testID="food-log-too-old">
          {t.foodLog.tooOld}
        </Body>
      ) : (
        <Button
          label={t.foodLog.add}
          accessibilityLabel={t.foodLog.addA11y(dayText)}
          onPress={() => router.push(`/ernaehrung/eintragen?tag=${date}` as Href)}
          testID="food-log-add"
        />
      )}
      {!showNumbers ? <Body muted>{t.foodLog.numbersHidden}</Body> : null}
      {message ? (
        <Notice tone={message.tone} testID="food-log-message">
          {message.text}
        </Notice>
      ) : null}
      <ConfirmDialog
        visible={deleting !== null}
        title={t.foodLog.deleteTitle}
        message={t.foodLog.deleteText}
        confirmLabel={t.foodLog.delete}
        loading={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const row = deleting;
          setDeleting(null);
          if (row) void run(() => actions.remove(row.id), t.foodLog.deleted);
        }}
        testID="food-log-delete-dialog"
      />
    </View>
  );
}

/** Ein Eintrag mit Ändern, Löschen und Stern. */
export function FoodLogEntryItem({
  row,
  title,
  showNumbers,
  favorite,
  editable,
  busy,
  onEdit,
  onDelete,
  onToggleFavorite,
}: {
  row: FoodLogEntryRow;
  /** Anzeigetitel (eigenes Gericht: aktueller Name, E2). */
  title: string;
  showNumbers: boolean;
  favorite: boolean;
  editable: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  const theme = useThemeColors();
  const entry: FoodLogEntry = entryFromRow(row);
  return (
    <View
      style={[styles.item, { borderColor: theme.border, backgroundColor: theme.surface }]}
      testID={`food-log-entry-${row.id}`}
    >
      <Text style={[styles.title, { color: theme.text }]}>{favorite ? `${title} ★` : title}</Text>
      <Text style={[styles.detail, { color: theme.textMuted }]}>
        {entryDetailText(entry, showNumbers)}
      </Text>
      <View style={styles.actions}>
        {editable ? (
          <View style={styles.action}>
            <Button
              label={t.foodLog.edit}
              accessibilityLabel={t.foodLog.editA11y(title)}
              variant="secondary"
              disabled={busy}
              onPress={onEdit}
              testID={`food-log-edit-${row.id}`}
            />
          </View>
        ) : null}
        <View style={styles.action}>
          <Button
            label={t.foodLog.delete}
            accessibilityLabel={t.foodLog.deleteA11y(title)}
            variant="secondary"
            disabled={busy}
            onPress={onDelete}
            testID={`food-log-delete-${row.id}`}
          />
        </View>
      </View>
      {/* Plan-Mahlzeiten und eigene Gerichte (E2) haben keinen Stern. */}
      {row.source !== 'plan_item' && row.source !== 'custom_meal' ? (
        <Button
          label={favorite ? t.foodLog.favoriteRemove : t.foodLog.favoriteAdd}
          accessibilityLabel={
            favorite ? t.foodLog.favoriteRemoveA11y(title) : t.foodLog.favoriteAddA11y(title)
          }
          variant="link"
          disabled={busy}
          onPress={onToggleFavorite}
          testID={`food-log-favorite-${row.id}`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  eaten: { gap: spacing.xs },
  group: { gap: spacing.xs },
  groupTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  item: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  detail: { fontSize: fontSize.sm, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
});

/**
 * Ernährungs-Warteschlange (Supabase-Modus, Etappe N7 Teil 2): „wird übertragen“, im Browser nur bis zum Schließen des
 * Tabs, und abgelehnte Fassungen (Gründer-Frage G3 aus E1: lokal behalten mit Hinweis, Verwerfen nur auf Wunsch). Im
 * Testmodus nie sichtbar (alles sofort gespeichert). Ohne Inhalte, nur Anzahlen.
 */
export function NutritionSyncNotice() {
  const app = useApp();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const { queued, rejected, sessionOnly } = app.nutritionSync;
  if (queued === 0 && rejected === 0) return null;
  async function discard() {
    setBusy(true);
    setError(undefined);
    try {
      await app.discardRejectedNutrition();
      setConfirming(false);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.section}>
      {queued > 0 ? (
        <Notice tone="info" testID="nutrition-sync-queued">
          <Body>{t.foodLog.sync.queued(queued)}</Body>
          {sessionOnly ? <Body muted>{t.foodLog.sync.sessionOnly}</Body> : null}
        </Notice>
      ) : null}
      {rejected > 0 ? (
        <Notice tone="warning" testID="nutrition-sync-rejected">
          <Body>{t.foodLog.sync.rejected(rejected)}</Body>
          <Button
            label={t.foodLog.sync.discard}
            variant="secondary"
            onPress={() => {
              setError(undefined);
              setConfirming(true);
            }}
            testID="nutrition-sync-discard"
          />
        </Notice>
      ) : null}
      <ConfirmDialog
        visible={confirming}
        title={t.foodLog.sync.discardTitle}
        message={t.foodLog.sync.discardText}
        confirmLabel={t.foodLog.sync.discard}
        onConfirm={() => void discard()}
        onCancel={() => setConfirming(false)}
        loading={busy}
        error={error}
        testID="dialog-nutrition-sync-discard"
      />
    </View>
  );
}
