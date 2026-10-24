import { type CalorieRing, type MacroProgress, type MealCardGroup } from '@fitnessapp/core';
import { fontSize, fontWeight, heroColors, radius, spacing } from '@fitnessapp/ui';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HeroSurface, Icon, IconChip, ProgressRing, useAreaColors } from '@/components/design';
import { MIN_TOUCH } from '@/components/ui';
import { t } from '@/i18n';
import { appFont, displayFont } from '@/lib/fonts';
import {
  macroText,
  mealCardKcalText,
  percentText,
  ringCenterText,
} from '@/lib/nutrition-day-format';
import { formatKcal } from '@/lib/nutrition-format';
import { useDeviceSchemeName, useThemeColors } from '@/lib/theme';
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

type MacroKey = 'carbs' | 'protein' | 'fat';

type DayOverviewProps = {
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
};

/**
 * Karte „Übersicht“ als dunkle Hero-Karte in Ernährungsgrün (Gründer-Wunsch 23.10.2026, Vorbild „Training heute“):
 * großer kcal-Ring, Gegessen / Verbrannt bzw. Ziel, darunter drei Makro-Ringe (Kohlenhydrate, Eiweiß, Fett) in eigenen
 * Farben. Jeder Ring füllt sich bis zum Tagesziel; darüber wird er voll und rot, mit „über dem Ziel“ in Worten
 * (Dunkelrot-Plakette). Die Regel (ohne Toleranz) steht in packages/core (`goalFill`, `macroProgress.over`,
 * `calorieRing.state`). Ohne sichtbare Kalorienzahlen (Einstellung, Schwangerschaft) zeigt der Aufrufer die Karte gar
 * nicht – dann auch keine Makros (wie bisher).
 */
export function DayOverviewCard(props: DayOverviewProps) {
  return (
    <HeroSurface area="ernaehrung" tint="corner" testID="nutrition-overview">
      <DayOverviewContent {...props} />
    </HeroSurface>
  );
}

function DayOverviewContent({
  ring,
  future,
  trainingKcal,
  macros,
  plannedKcal,
  macrosIncomplete,
  hint,
}: DayOverviewProps) {
  // Läuft in der Hero-Fläche: useThemeColors/useAreaColors liefern die Dunkel-Palette.
  const theme = useThemeColors();
  const green = useAreaColors('ernaehrung');
  const hero = heroColors[useDeviceSchemeName()];
  const center = ringCenterText(ring, future);
  const over = !future && ring.state === 'over';
  const burned = trainingKcal !== null && trainingKcal > 0 ? trainingKcal : null;
  const names = t.nutrition.macroNames;
  const macroColor: Record<MacroKey, string> = {
    carbs: hero.macroCarbs,
    protein: hero.macroProtein,
    fat: hero.macroFat,
  };
  const macroRows = (['carbs', 'protein', 'fat'] as const)
    .map((key) => ({ key, label: names[key], macro: macros[key] }))
    .filter(
      (row): row is { key: MacroKey; label: string; macro: MacroProgress } => row.macro !== null,
    );
  return (
    <>
      <View style={styles.eyebrowRow}>
        <Icon name="utensils" size={16} color={green.icon} strokeWidth={2.2} />
        <Text
          accessibilityRole="header"
          aria-level={3}
          style={[styles.eyebrow, appFont('bold'), { color: green.icon }]}
        >
          {t.nutritionDay.overviewTitle}
        </Text>
      </View>
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
          <Text style={[styles.sideValue, appFont('extrabold'), { color: theme.text }]}>
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
            color={over ? hero.over : green.strong}
            trackColor={hero.track}
            stroke={12}
            fraction={future ? 0 : over ? 1 : ring.fraction}
          >
            <Text
              style={[
                styles.ringValue,
                displayFont(),
                { color: over ? hero.overText : theme.text },
              ]}
            >
              {center.value}
            </Text>
            <Text style={[styles.ringLabel, { color: over ? hero.overText : theme.textMuted }]}>
              {center.label}
            </Text>
          </ProgressRing>
        </View>
        {burned !== null ? (
          <View
            style={styles.side}
            accessible
            accessibilityLabel={t.nutritionDay.burnedA11y(formatKcal(burned))}
            testID="nutrition-ring-burned"
          >
            <Text style={[styles.sideValue, appFont('extrabold'), { color: theme.text }]}>
              {formatKcal(burned)}
            </Text>
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
            <Text style={[styles.sideValue, appFont('extrabold'), { color: theme.text }]}>
              {formatKcal(ring.targetKcal)}
            </Text>
            <Text style={[styles.sideLabel, { color: theme.textMuted }]}>
              {t.nutritionDay.goal}
            </Text>
          </View>
        )}
      </View>
      {over ? (
        <View style={styles.centerRow}>
          <OverBadge testID="nutrition-ring-over" />
        </View>
      ) : null}
      <View style={styles.lines}>
        <Text
          testID="nutrition-target"
          style={[styles.line, appFont('semibold'), { color: theme.text }]}
        >
          {t.nutrition.target(formatKcal(ring.targetKcal))}
        </Text>
        {plannedKcal !== null ? (
          <Text style={[styles.line, { color: theme.textMuted }]}>
            {t.nutrition.dayTotal(formatKcal(plannedKcal))}
          </Text>
        ) : null}
        {hint ? (
          <Text style={[styles.line, { color: theme.textMuted }]} testID="nutrition-ring-hint">
            {hint}
          </Text>
        ) : null}
      </View>
      {macroRows.length > 0 ? (
        <View style={[styles.macros, { borderTopColor: hero.track }]} testID="nutrition-macros">
          {macroRows.map((row) => (
            <MacroRing
              key={row.key}
              id={row.key}
              label={row.label}
              macro={row.macro}
              color={macroColor[row.key]}
              future={future}
            />
          ))}
        </View>
      ) : null}
      {macrosIncomplete ? (
        <Text style={[styles.note, { color: theme.textMuted }]}>
          {t.nutritionDay.macrosIncomplete}
        </Text>
      ) : null}
      <Text style={[styles.note, { color: theme.textMuted }]}>{t.nutrition.estimate}</Text>
    </>
  );
}

/** Dunkelrote Plakette „über dem Ziel“ (weiße Schrift 8,3 : 1) – die Farbe steht nie allein. */
export function OverBadge({ testID }: { testID?: string }) {
  const hero = heroColors[useDeviceSchemeName()];
  return (
    <View style={[styles.badge, { backgroundColor: hero.overBadge }]} testID={testID}>
      <Text style={[styles.badgeText, appFont('bold'), { color: hero.text }]} numberOfLines={1}>
        {t.nutritionDay.overGoal}
      </Text>
    </View>
  );
}

/** Ein Makro-Ring: Anteil in der Mitte, Name in der Makro-Farbe, „120 / 420 g“; über dem Ziel voll und rot. */
function MacroRing({
  id,
  label,
  macro,
  color,
  future,
}: {
  id: MacroKey;
  label: string;
  macro: MacroProgress;
  color: string;
  future: boolean;
}) {
  const theme = useThemeColors();
  const hero = heroColors[useDeviceSchemeName()];
  const text = macroText(label, macro);
  const over = !future && macro.over;
  return (
    <View
      style={styles.macro}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={text.a11y}
      testID={`nutrition-macro-${id}`}
    >
      <ProgressRing
        size={76}
        stroke={8}
        color={over ? hero.over : color}
        trackColor={hero.track}
        fraction={future ? 0 : over ? 1 : macro.fraction}
      >
        <Text
          style={[
            styles.macroPercent,
            appFont('extrabold'),
            { color: over ? hero.overText : theme.text },
          ]}
          numberOfLines={1}
        >
          {percentText(future ? 0 : macro.percent)}
        </Text>
      </ProgressRing>
      <Text style={[styles.macroLabel, appFont('bold'), { color }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[
          styles.macroValue,
          appFont(over ? 'bold' : 'regular'),
          { color: over ? hero.overText : theme.textMuted },
        ]}
        testID={`nutrition-macro-${id}-value`}
      >
        {text.value}
      </Text>
      {over ? <OverBadge testID={`nutrition-macro-${id}-over`} /> : null}
    </View>
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
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { fontSize: fontSize.xs, letterSpacing: 0.6, textTransform: 'uppercase' },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  side: { flex: 1, alignItems: 'center', gap: 2 },
  sideValue: { fontSize: fontSize.lg },
  sideLabel: { fontSize: fontSize.sm },
  sideNote: { fontSize: 12, textAlign: 'center' },
  ringValue: { fontSize: fontSize.xl },
  ringLabel: { fontSize: fontSize.sm },
  centerRow: { alignItems: 'center' },
  lines: { gap: 4, alignItems: 'center' },
  line: { fontSize: fontSize.md, lineHeight: 22, textAlign: 'center' },
  note: { fontSize: fontSize.sm, lineHeight: 20 },
  macros: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  macro: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6 },
  macroPercent: { fontSize: 15 },
  macroLabel: { fontSize: fontSize.xs, textAlign: 'center' },
  macroValue: { fontSize: fontSize.xs, textAlign: 'center' },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, lineHeight: 15 },
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
