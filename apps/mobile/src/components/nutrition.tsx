import {
  type CalorieCapCode,
  cookDayMeals,
  type EmptySlot,
  type IntoleranceBlockReason,
  type MealPlanNoticeCode,
  nextMealOfDay,
  type NutritionNoticeCode,
  type PlannedMeal,
  weekEnergySummary,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { useRouter, type Href } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  ErrorState,
  Heading,
  LoadingState,
  MIN_TOUCH,
  Notice,
} from '@/components/ui';
import {
  computeNutritionWeek,
  type MealPlanState,
  nutritionWeekStart,
  showEnergyNumbers,
} from '@/data/nutrition-plan';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { todayIso } from '@/lib/format';
import {
  formatGrams,
  formatKcal,
  formatNumberDe,
  noticeText,
  roleLabel,
  slotLabel,
} from '@/lib/nutrition-format';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { type MealPlanActions, type NutritionView, useNutritionWeek } from '@/state/use-nutrition';

/**
 * Bausteine der Ernährungs-Bildschirme (docs/PLAN-PHASE-5.md 8.2–8.4, Etappe N4). Nur Anzeige – Zahlen und Codes
 * kommen fertig aus packages/core. Bei „Kalorienzahlen anzeigen“ = aus zeigen sie keine kcal und keine Makro-Gramm.
 */

/** Hinweis Essstörungen mit Hilfe-Stellen (4.9, Gründer-Entscheidung 3). */
export function EatingHelpNotice() {
  const help = t.nutrition.help;
  return (
    <Notice tone="info" title={help.title} testID="nutrition-help">
      <Body>{help.text}</Body>
      {help.contacts.map((line) => (
        <Body key={line} muted>
          • {line}
        </Body>
      ))}
    </Notice>
  );
}

/**
 * Gespeicherte Unverträglichkeiten ohne gültige Einwilligung (Wächter N4 B1): kein Plan, keine Rezepte – nur dieser
 * Hinweis mit „Einwilligung bestätigen“.
 */
export function ConsentBlockedNotice({ reason }: { reason: IntoleranceBlockReason }) {
  const router = useRouter();
  const app = useApp();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function remove() {
    setBusy(true);
    setError(undefined);
    try {
      await app.deleteStoredIntolerances();
      setConfirming(false);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Notice tone="warning" testID="nutrition-consent-blocked">
      <Body>{t.nutrition.consentBlocked[reason]}</Body>
      <Button
        label={t.nutrition.consentBlockedButton[reason]}
        onPress={() => router.push('/health-consent')}
        testID="nutrition-consent-blocked-button"
      />
      {reason === 'consent_missing' ? (
        <Button
          label={t.nutrition.deleteIntolerances}
          variant="danger"
          onPress={() => {
            setError(undefined);
            setConfirming(true);
          }}
          testID="nutrition-delete-intolerances"
        />
      ) : null}
      <ConfirmDialog
        visible={confirming}
        title={t.nutrition.deleteIntolerancesTitle}
        message={t.nutrition.deleteIntolerancesText}
        confirmLabel={t.nutrition.deleteIntolerancesConfirm}
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(false)}
        loading={busy}
        error={error}
        testID="dialog-delete-intolerances"
      />
    </Notice>
  );
}

/** Kennzeichnung der Beispiel-Rezepte mit Testwerten. */
export function DemoBanner({ onDisable }: { onDisable?: () => void }) {
  return (
    <Notice tone="warning" testID="nutrition-demo-banner">
      <Body>{t.nutrition.demoBanner}</Body>
      {onDisable ? (
        <Button
          label={t.nutrition.demoOff}
          variant="secondary"
          onPress={onDisable}
          testID="nutrition-demo-off"
        />
      ) : null}
    </Notice>
  );
}

/**
 * Zustand des gespeicherten Plans (Etappe N5): „Dein Plan wurde an deine neuen Angaben angepasst.“ (6.6, bis
 * „Verstanden“), Angebot „Plan aktualisieren“ (≥ 5 %), Speichern gescheitert, vergangene Woche nur lesen.
 */
export function MealPlanStateNotices({
  state,
  actions,
  saveFailed,
  onRetry,
}: {
  state: MealPlanState | null;
  actions: MealPlanActions | null;
  saveFailed: boolean;
  /** „Erneut versuchen“ nach gescheitertem automatischem Speichern (Wächter N5a K7). */
  onRetry?: () => void;
}) {
  const texts = t.nutrition.plan;
  const [busy, setBusy] = useState<'dismiss' | 'update' | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);
  if (state === null) return null;
  async function run(kind: 'dismiss' | 'update', action: () => Promise<void>, done?: string) {
    setBusy(kind);
    setMessage(null);
    try {
      await action();
      if (done) setMessage({ text: done, tone: 'success' });
    } catch {
      setMessage({ text: texts.actionFailed, tone: 'danger' });
    } finally {
      setBusy(null);
    }
  }
  return (
    <View style={styles.list}>
      {state.autoAdjusted ? (
        <Notice tone="info" testID="nutrition-plan-adjusted">
          <Body>{texts.autoAdjusted}</Body>
          <Body muted>{texts.autoAdjustedPast}</Body>
          {actions ? (
            <Button
              label={texts.autoAdjustedOk}
              variant="secondary"
              loading={busy === 'dismiss'}
              onPress={() => void run('dismiss', actions.dismissAdjusted)}
              testID="nutrition-plan-adjusted-ok"
            />
          ) : null}
        </Notice>
      ) : null}
      {state.recipesChanged ? (
        <Notice tone="info" testID="nutrition-plan-rebuilt">
          <Body>{t.nutrition.rebuilt.text}</Body>
          {actions ? (
            <Button
              label={t.nutrition.rebuilt.ok}
              variant="secondary"
              loading={busy === 'dismiss'}
              onPress={() => void run('dismiss', actions.dismissAdjusted)}
              testID="nutrition-plan-rebuilt-ok"
            />
          ) : null}
        </Notice>
      ) : null}
      {state.updateSuggested && actions ? (
        <Notice tone="info" testID="nutrition-plan-update">
          <Body>{texts.updateSuggested}</Body>
          <Button
            label={texts.update}
            loading={busy === 'update'}
            onPress={() => void run('update', actions.refresh, texts.updated)}
            testID="nutrition-plan-update-button"
          />
        </Notice>
      ) : null}
      {!state.editable ? (
        <Body muted testID="nutrition-plan-readonly">
          {texts.readOnlyWeek}
        </Body>
      ) : null}
      {saveFailed ? (
        <Notice tone="warning" testID="nutrition-plan-save-failed">
          <Body>{texts.saveFailed}</Body>
          {onRetry ? (
            <Button
              label={t.nutrition.retrySave}
              variant="secondary"
              onPress={onRetry}
              testID="nutrition-plan-save-retry"
            />
          ) : null}
        </Notice>
      ) : null}
      {message ? (
        <Notice tone={message.tone} testID="nutrition-plan-message">
          {message.text}
        </Notice>
      ) : null}
    </View>
  );
}

/** Feste Hinweise der Engine (Modus, Sonderfälle, Timing). */
export function NutritionNotices({
  notices,
  planNotices = [],
  showNumbers,
}: {
  notices: readonly NutritionNoticeCode[];
  planNotices?: readonly MealPlanNoticeCode[];
  showNumbers: boolean;
}) {
  if (notices.length === 0 && planNotices.length === 0) return null;
  return (
    <View style={styles.list} testID="nutrition-notices">
      {notices.map((code) => (
        <Notice
          key={code}
          tone={WARNING_NOTICES.has(code) ? 'warning' : 'info'}
          testID={`nutrition-notice-${code}`}
        >
          <Body>{noticeText(code, showNumbers)}</Body>
        </Notice>
      ))}
      {planNotices.map((code) => (
        <Notice
          key={code}
          tone={code === 'day_below_floor' || code.startsWith('drafts') ? 'warning' : 'info'}
          testID={`nutrition-plan-notice-${code}`}
        >
          <Body>{t.nutrition.planNotices[code]}</Body>
        </Notice>
      ))}
    </View>
  );
}

const WARNING_NOTICES = new Set<NutritionNoticeCode>([
  'pregnancy_no_targets',
  'underweight',
  'severe_underweight',
  'medical_consult',
  'health_check_missing',
  'protein_kidney_notice',
]);

/** Greifende Schutzgrenzen in einfachen Worten („Wir planen nicht unter deinem Grundumsatz.“). */
export function CapsExplanation({ caps }: { caps: readonly CalorieCapCode[] }) {
  if (caps.length === 0) return null;
  return (
    <View style={styles.list} testID="nutrition-caps">
      <Heading level={2}>{t.nutrition.capsTitle}</Heading>
      {caps.map((cap) => (
        <Body key={cap} muted>
          • {t.nutrition.caps[cap]}
        </Body>
      ))}
    </View>
  );
}

/** Makro-Balken (Eiweiß, Kohlenhydrate, Fett) – mit Bildschirmleser-Beschriftung (8.4). */
export function MacroBars({
  planned,
  target,
}: {
  planned: { protein: number; carbs: number; fat: number };
  target: { protein: number; carbs: number; fat: number };
}) {
  const theme = useThemeColors();
  const names = t.nutrition.macroNames;
  const rows = (['protein', 'carbs', 'fat'] as const).map((key) => ({
    key,
    label: names[key],
    planned: planned[key],
    target: target[key],
  }));
  return (
    <View style={styles.list} testID="nutrition-macros">
      {rows.map((row) => {
        const share = row.target > 0 ? Math.min(1, row.planned / row.target) : 0;
        const plannedText = formatGrams(row.planned);
        const targetText = formatGrams(row.target);
        return (
          <View
            key={row.key}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t.nutrition.macroA11y(row.label, plannedText, targetText)}
            style={styles.macro}
          >
            <Text style={[styles.macroText, { color: theme.text }]}>
              {t.nutrition.macroLine(row.label, plannedText, targetText)}
            </Text>
            <View style={[styles.track, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.fill,
                  { backgroundColor: theme.primary, width: `${Math.round(share * 100)}%` },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Eine Mahlzeit des Tages (Platz, Rolle, Rezept, Portion, Hinweise). */
export function MealRow({
  meal,
  showNumbers,
  foodName,
  onOpen,
}: {
  meal: PlannedMeal;
  showNumbers: boolean;
  foodName: (foodId: string) => string;
  onOpen: () => void;
}) {
  const theme = useThemeColors();
  const role = roleLabel(meal.role);
  const portion = formatNumberDe(meal.factor);
  const extra: string[] = [];
  if (meal.isFill) extra.push(t.nutrition.fill);
  if (meal.prepKind === 'cook') extra.push(t.nutrition.prep.cook);
  if (meal.prepKind === 'leftover') {
    extra.push(
      meal.storage === null
        ? t.nutrition.prep.leftover
        : `${t.nutrition.prep.leftover}, ${t.nutrition.storage[meal.storage]}`,
    );
  }
  for (const s of meal.substitutions)
    extra.push(t.nutrition.substitution(foodName(s.substituteFoodId)));
  for (const o of meal.omittedOptional) extra.push(t.nutrition.omitted(foodName(o.foodId)));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.nutrition.openRecipe(meal.titleDe)}
      onPress={onOpen}
      testID={`meal-${meal.slot}`}
      style={({ pressed }) => [
        styles.meal,
        { borderColor: theme.border, backgroundColor: pressed ? theme.background : theme.surface },
      ]}
    >
      <Text style={[styles.slot, { color: theme.textMuted }]}>
        {role ? `${slotLabel(meal.slot)} · ${role}` : slotLabel(meal.slot)}
      </Text>
      <Text style={[styles.title, { color: theme.text }]}>{meal.titleDe}</Text>
      <Text style={[styles.detail, { color: theme.textMuted }]}>
        {showNumbers
          ? t.nutrition.portionKcal(portion, formatKcal(meal.nutrients.kcal))
          : t.nutrition.portion(portion)}
      </Text>
      {extra.map((line) => (
        <Text key={line} style={[styles.detail, { color: theme.textMuted }]}>
          {line}
        </Text>
      ))}
    </Pressable>
  );
}

/** Leerer Platz mit Grund (welcher Filter es verhindert, 6.3). */
export function EmptySlotRow({ empty }: { empty: EmptySlot }) {
  const reasons = empty.reasons.map((r) => t.nutrition.emptyReasons[r]);
  return (
    <Card>
      <Body muted>
        {reasons.length > 0
          ? t.nutrition.emptySlot(slotLabel(empty.slot), reasons.join(', '))
          : t.nutrition.emptySlotNoReason(slotLabel(empty.slot))}
      </Body>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  macro: { gap: spacing.xs },
  macroText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill },
  meal: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  slot: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  detail: { fontSize: fontSize.sm, lineHeight: 20 },
});

/**
 * Karte „Essen heute“ auf „Heute“ (8.2 Nr. 1): Tagesziel (oder ohne Zahlen), nächste Mahlzeit mit Rolle, Kochtag,
 * Hinweis bei `below_floor`, Link „Ernährung“. Nur mit Ernährung (Testmodus; Supabase ab N7).
 */
export function NutritionTodayCard({ nowMinutes }: { nowMinutes: number }) {
  const router = useRouter();
  const app = useApp();
  const view = useNutritionWeek();
  const texts = t.nutrition.todayCard;
  if (!app.backend.supportsNutrition) return null;
  const open = (
    <Button
      label={texts.open}
      accessibilityLabel={texts.openA11y}
      variant="secondary"
      onPress={() => router.push('/ernaehrung' as Href)}
      testID="today-nutrition"
    />
  );
  if (view.setupMissing) {
    return (
      <Card>
        <Heading level={2}>{texts.title}</Heading>
        <Body>{t.nutrition.setupNeeded}</Body>
        <Button
          label={t.nutrition.setupButton}
          onPress={() => router.push('/onboarding/nutrition_setup?edit=1' as Href)}
          testID="today-nutrition-setup"
        />
      </Card>
    );
  }
  const week = view.week;
  const today = todayIso();
  const targets = week?.kind === 'ready' ? week.targets.days.find((d) => d.date === today) : null;
  const day =
    week?.kind === 'ready' ? (week.plan?.days.find((d) => d.date === today) ?? null) : null;
  const next = day ? nextMealOfDay(day, Math.min(Math.max(nowMinutes, 0), 24 * 60)) : null;
  const cooking = day ? cookDayMeals(day) : [];
  return (
    <Card>
      <View testID="today-nutrition-card" style={styles.list}>
        <Heading level={2}>{texts.title}</Heading>
        {view.library.kind === 'loading' || (view.library.kind === 'ready' && week === null) ? (
          <Body muted>{t.nutrition.loading}</Body>
        ) : null}
        {week?.kind === 'incomplete' ? <Body muted>{t.nutrition.incomplete}</Body> : null}
        {week?.kind === 'blocked' ? <ConsentBlockedNotice reason={week.reason} /> : null}
        {view.library.kind === 'ready' && view.library.result.demo && week?.kind === 'ready' ? (
          <Body muted testID="today-nutrition-demo">
            {t.nutrition.todayCard.demo}
          </Body>
        ) : null}
        {week?.kind === 'error' ? <Body muted>{t.nutrition.computeFailed}</Body> : null}
        {view.library.kind === 'error' ? <Body muted>{t.nutrition.loadFailed}</Body> : null}
        {targets && view.showNumbers && targets.targetKcal !== null ? (
          <Body testID="today-nutrition-target">
            {t.nutrition.target(formatKcal(targets.targetKcal))}
          </Body>
        ) : null}
        {targets && targets.mode === 'no_targets' ? (
          <Body muted>{t.nutrition.dayStatus.no_targets}</Body>
        ) : null}
        {day?.status === 'below_floor' ? (
          <Notice tone="warning" testID="today-nutrition-below-floor">
            {texts.belowFloor}
          </Notice>
        ) : null}
        {next ? (
          <Body testID="today-nutrition-next">
            {texts.next(
              roleLabel(next.role)
                ? `${slotLabel(next.slot)} (${roleLabel(next.role)})`
                : slotLabel(next.slot),
              next.titleDe,
            )}
          </Body>
        ) : day ? (
          <Body muted>{texts.allDone}</Body>
        ) : null}
        {cooking.length > 0 ? (
          <Body testID="today-nutrition-cook">
            {texts.cookDay(cooking.map((m) => m.titleDe).join(', '))}
          </Body>
        ) : null}
        {week?.kind === 'ready' && week.plan === null ? (
          <Body muted>{t.nutrition.noRecipes}</Body>
        ) : null}
        {open}
      </View>
    </Card>
  );
}

function rangeText(range: { min: number; max: number }): string {
  return range.min === range.max
    ? formatKcal(range.min)
    : `${formatKcal(range.min)}–${formatKcal(range.max)}`;
}

/**
 * „Fertig“-Bildschirm (8.1): kurze Ernährungs-Zusammenfassung „Trainingstag ca. … kcal, Ruhetag ca. … kcal“ bzw.
 * ohne Zahlen. Zahlen unverändert aus `nutritionTargetsForWeek` (weekEnergySummary rundet nicht neu).
 */
export function NutritionDoneSummary() {
  const app = useApp();
  const rows = app.rows;
  if (!app.backend.supportsNutrition || !rows || rows.nutritionSetup === null) return null;
  const today = todayIso();
  const week = computeNutritionWeek({
    rows,
    versions: app.versions,
    today,
    weekStart: nutritionWeekStart(today),
    library: null,
    allowDrafts: app.backend.mode === 'local',
  });
  if (week.kind !== 'ready') return null;
  const texts = t.nutrition.done;
  const summary = weekEnergySummary(week.targets);
  const lines: string[] = [];
  if (!showEnergyNumbers(rows)) {
    lines.push(texts.withoutNumbers);
  } else {
    if (summary.trainingDay) lines.push(texts.trainingDay(rangeText(summary.trainingDay)));
    if (summary.restDay) lines.push(texts.restDay(rangeText(summary.restDay)));
    if (lines.length === 0) lines.push(texts.noTargets);
  }
  return (
    <Card>
      <View testID="done-nutrition" style={styles.list}>
        <Heading level={2}>{texts.title}</Heading>
        {lines.map((line) => (
          <Body key={line}>{line}</Body>
        ))}
        <Body muted>{t.nutrition.estimate}</Body>
      </View>
    </Card>
  );
}

/**
 * Gemeinsame Zustände der Ernährungs-Bildschirme (8.3, Etappe N5b): Supabase-Modus (noch nicht), Laden, Ladefehler mit
 * „Erneut versuchen“, Einrichtung fehlt, Angaben unvollständig, Einwilligung blockiert, Rechenfehler. Nur anzeigen,
 * wenn `nutritionReady(view)` false ist.
 */
export function NutritionGate({ view }: { view: NutritionView }): ReactNode {
  const app = useApp();
  const router = useRouter();
  if (view.library.kind === 'unsupported') {
    return <Notice tone="info">{t.nutrition.unsupported}</Notice>;
  }
  if (view.library.kind === 'error') {
    return (
      <ErrorState
        message={t.nutrition.loadFailed}
        onRetry={() => void app.ensureNutritionLibrary()}
      />
    );
  }
  if (view.setupMissing) {
    return (
      <Card>
        <Body>{t.nutrition.setupNeeded}</Body>
        <Button
          label={t.nutrition.setupButton}
          onPress={() => router.push('/onboarding/nutrition_setup?edit=1' as Href)}
          testID="nutrition-setup"
        />
      </Card>
    );
  }
  if (view.library.kind !== 'ready' || view.week === null) {
    return <LoadingState label={t.nutrition.loading} />;
  }
  if (view.week.kind === 'incomplete') {
    return <Notice tone="info">{t.nutrition.incomplete}</Notice>;
  }
  if (view.week.kind === 'blocked') {
    return <ConsentBlockedNotice reason={view.week.reason} />;
  }
  return <Notice tone="danger">{t.nutrition.computeFailed}</Notice>;
}

/** true = Bestand geladen und Woche berechnet (dann kein Gate). */
export function nutritionReady(view: NutritionView): boolean {
  return (
    view.library.kind === 'ready' &&
    !view.setupMissing &&
    view.week !== null &&
    view.week.kind === 'ready'
  );
}
