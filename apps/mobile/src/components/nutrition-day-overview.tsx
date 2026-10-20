import { type CalorieRing, type MacroProgress, type MealCardGroup } from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, IconChip, ProgressRing, useAreaColors } from '@/components/design';
import { Body, Card, MIN_TOUCH } from '@/components/ui';
import { t } from '@/i18n';
import { displayFont } from '@/lib/fonts';
import { macroText, mealCardKcalText, ringCenterText } from '@/lib/nutrition-day-format';
import { formatKcal } from '@/lib/nutrition-format';
import { useThemeColors } from '@/lib/theme';
import { Text } from '@/components/text';

/**
 * Tagesübersicht Ernährung (Gründer-Wunsch 20.10.2026): Karte „Übersicht“ mit Kalorien-Ring, „Gegessen“ links,
 * „Verbrannt“ bzw. „Ziel“ rechts und drei Makro-Balken; darunter je Mahlzeit eine Karte mit kleinem Ring, „317 / 606
 * kcal“, Vorschau und „+“. Eigenes Alpha5-Design (Tokens aus packages/ui, hell und dunkel). Rechnet nichts – alle
 * Werte kommen aus packages/core (`calorieRing`, `macroProgress`, `mealCardTargets`, `mealCardIntake`). Farbe nie
 * allein: jede Zahl steht als Text daneben, Ring und Balken haben eine Ansage in Worten.
 */

/** Ring-Baustein liegt in components/design.tsx (gemeinsam mit Übersicht & Co.); hier weiter importierbar. */
export { ProgressRing };

/** Karte „Übersicht“: großer Ring, Gegessen / Verbrannt bzw. Ziel, Makro-Balken. */
export function DayOverviewCard({
  ring,
  future,
  trainingKcal,
  macros,
  plannedKcal,
  macrosIncomplete,
  hint,
}: {
  ring: Extract<CalorieRing, { kind: 'ring' }>;
  /** Künftiger Tag: nur das Ziel, noch kein „Gegessen“. */
  future: boolean;
  /** Trainingsenergie des Tages (schon im Ziel enthalten); null/0 → rechts steht das Ziel. */
  trainingKcal: number | null;
  macros: { carbs: MacroProgress | null; protein: MacroProgress | null; fat: MacroProgress | null };
  /** Summe des Essensplans (falls vollständig), sonst null. */
  plannedKcal: number | null;
  macrosIncomplete: boolean;
  /** Kurzer Hinweis unter dem Ring (z. B. „Noch nichts eingetragen.“). */
  hint: string | null;
}) {
  const theme = useThemeColors();
  const green = useAreaColors('ernaehrung');
  const center = ringCenterText(ring, future);
  const burned = trainingKcal !== null && trainingKcal > 0 ? trainingKcal : null;
  const names = t.nutrition.macroNames;
  const macroRows = (['carbs', 'protein', 'fat'] as const)
    .map((key) => ({ key, label: names[key], macro: macros[key] }))
    .filter(
      (row): row is { key: typeof row.key; label: string; macro: MacroProgress } =>
        row.macro !== null,
    );
  return (
    <Card>
      <Text
        accessibilityRole="header"
        aria-level={3}
        style={[styles.cardTitle, { color: theme.text }]}
      >
        {t.nutritionDay.overviewTitle}
      </Text>
      <View style={styles.overviewRow}>
        <View
          style={styles.side}
          accessible
          accessibilityLabel={
            future
              ? t.nutritionDay.nothingYet
              : `${t.nutritionDay.eaten}: ${formatKcal(ring.eatenKcal)} kcal`
          }
          testID="nutrition-ring-eaten"
        >
          <Text style={[styles.sideValue, { color: theme.text }]}>
            {future ? '–' : formatKcal(ring.eatenKcal)}
          </Text>
          <Text style={[styles.sideLabel, { color: theme.textMuted }]}>{t.nutritionDay.eaten}</Text>
        </View>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={center.a11y}
          testID="nutrition-ring"
        >
          <ProgressRing
            size={152}
            color={green.strong}
            stroke={12}
            fraction={future ? 0 : ring.fraction}
            overFraction={future ? 0 : ring.overFraction}
          >
            <Text style={[styles.ringValue, displayFont(), { color: theme.text }]}>
              {center.value}
            </Text>
            <Text style={[styles.ringLabel, { color: theme.textMuted }]}>{center.label}</Text>
          </ProgressRing>
        </View>
        {burned !== null ? (
          <View
            style={styles.side}
            accessible
            accessibilityLabel={t.nutritionDay.burnedA11y(formatKcal(burned))}
            testID="nutrition-ring-burned"
          >
            <Text style={[styles.sideValue, { color: theme.text }]}>{formatKcal(burned)}</Text>
            <Text style={[styles.sideLabel, { color: theme.textMuted }]}>
              {t.nutritionDay.burned}
            </Text>
            <Text style={[styles.sideNote, { color: theme.textMuted }]}>
              {t.nutritionDay.burnedNote}
            </Text>
          </View>
        ) : (
          <View
            style={styles.side}
            accessible
            accessibilityLabel={`${t.nutritionDay.dayGoal}: ${formatKcal(ring.targetKcal)} kcal`}
            testID="nutrition-ring-goal"
          >
            <Text style={[styles.sideValue, { color: theme.text }]}>
              {formatKcal(ring.targetKcal)}
            </Text>
            <Text style={[styles.sideLabel, { color: theme.textMuted }]}>
              {t.nutritionDay.goal}
            </Text>
          </View>
        )}
      </View>
      <Body testID="nutrition-target" style={styles.centerText}>
        {t.nutrition.target(formatKcal(ring.targetKcal))}
      </Body>
      {plannedKcal !== null ? (
        <Body muted style={styles.centerText}>
          {t.nutrition.dayTotal(formatKcal(plannedKcal))}
        </Body>
      ) : null}
      {hint ? (
        <Body muted style={styles.centerText} testID="nutrition-ring-hint">
          {hint}
        </Body>
      ) : null}
      {macroRows.length > 0 ? (
        <View style={styles.macros} testID="nutrition-macros">
          {macroRows.map((row) => {
            const text = macroText(row.label, row.macro);
            return (
              <View
                key={row.key}
                style={styles.macro}
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={text.a11y}
                testID={`nutrition-macro-${row.key}`}
              >
                <Text style={[styles.macroLabel, { color: theme.text }]}>{row.label}</Text>
                <View style={[styles.track, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        backgroundColor: green.strong,
                        width: `${Math.round((future ? 0 : row.macro.fraction) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.macroValue, { color: theme.textMuted }]}>{text.value}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
      {macrosIncomplete ? <Body muted>{t.nutritionDay.macrosIncomplete}</Body> : null}
      <Body muted>{t.nutrition.estimate}</Body>
    </Card>
  );
}

/** Karte einer Mahlzeit: kleiner Ring, Titel, „317 / 606 kcal“, Vorschau, „+“; darunter z. B. die Plan-Gerichte. */
export function MealCard({
  group,
  title,
  eatenKcal,
  targetKcal,
  showNumbers,
  preview,
  onAdd,
  addA11y,
  children,
}: {
  group: MealCardGroup;
  title: string;
  eatenKcal: number;
  /** Ziel der Karte; null = kein Ziel (kein Platz im Tag, keine Zahlen oder kein Tagesziel). */
  targetKcal: number | null;
  showNumbers: boolean;
  preview: string;
  /** null = hier nicht eintragbar (künftiger Tag, zu alt, keine Einwilligung). */
  onAdd: (() => void) | null;
  addA11y: string;
  children?: ReactNode;
}) {
  const theme = useThemeColors();
  const green = useAreaColors('ernaehrung');
  const kcal = showNumbers ? mealCardKcalText(title, eatenKcal, targetKcal) : null;
  const fraction =
    showNumbers && targetKcal !== null && targetKcal > 0 ? Math.min(1, eatenKcal / targetKcal) : 0;
  return (
    <View
      style={[styles.mealCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
      testID={`meal-card-${group}`}
    >
      <View style={styles.mealHead}>
        {showNumbers && targetKcal !== null ? (
          // Nur Schmuck: die Zahl daneben trägt die Ansage in Worten (kein Doppel im Bildschirmleser).
          <View aria-hidden importantForAccessibility="no-hide-descendants">
            <ProgressRing size={44} stroke={5} fraction={fraction} color={green.strong} />
          </View>
        ) : (
          <IconChip area="ernaehrung" icon="utensils" size={40} />
        )}
        <View style={styles.mealText}>
          <Text
            accessibilityRole="header"
            aria-level={3}
            style={[styles.mealTitle, { color: theme.text }]}
          >
            {title}
          </Text>
          {kcal ? (
            <Text
              style={[styles.mealKcal, { color: theme.text }]}
              accessibilityLabel={kcal.a11y}
              testID={`meal-card-kcal-${group}`}
            >
              {kcal.value}
            </Text>
          ) : null}
          <Text
            style={[styles.mealPreview, { color: theme.textMuted }]}
            numberOfLines={2}
            testID={`meal-card-preview-${group}`}
          >
            {preview}
          </Text>
        </View>
        {onAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={addA11y}
            onPress={onAdd}
            testID={`meal-card-add-${group}`}
            style={({ pressed }) => [
              styles.add,
              { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Icon name="plus" size={22} strokeWidth={2.6} color={theme.primaryText} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  side: { flex: 1, alignItems: 'center', gap: 2 },
  sideValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  sideLabel: { fontSize: fontSize.sm },
  sideNote: { fontSize: 12, textAlign: 'center' },
  ringValue: { fontSize: fontSize.xl },
  ringLabel: { fontSize: fontSize.sm },
  centerText: { textAlign: 'center' },
  macros: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  macro: { flex: 1, gap: 4 },
  macroLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  macroValue: { fontSize: fontSize.sm },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill },
  mealCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  mealHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mealText: { flex: 1, gap: 2 },
  mealTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  mealKcal: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  mealPreview: { fontSize: fontSize.sm },
  add: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
