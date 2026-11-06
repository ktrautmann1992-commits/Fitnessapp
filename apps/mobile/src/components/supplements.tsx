import {
  type CaffeineCard,
  type ClaimBlockText,
  clockLabel,
  formatGermanNumber,
  SUPPLEMENT_RULES,
  type SupplementCard,
  type SupplementStatus,
  type TrainingDayTiming,
  type TrainingTimingSlot,
} from '@fitnessapp/core';
import { cardColors, colors, fontSize, radius, spacing } from '@fitnessapp/ui';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { Icon, useAreaColors } from '@/components/design';
import { Text } from '@/components/text';
import { Body } from '@/components/ui';
import { t } from '@/i18n';
import { appFont } from '@/lib/fonts';
import { useColorSchemeName, useThemeColors } from '@/lib/theme';

/**
 * Bausteine des Supplement-Bereichs (docs/PLAN-PHASE-6.md 8.1/8.4): Zeile je Supplement, Status mit Symbol UND Text
 * (Farbe nie als einziges Signal), `ClaimBlock` (Angabe und Pflichthinweis IMMER zusammen). Nur Darstellung – alle
 * Inhalte rechnet packages/core (`supplementOverview`, `supplementDetail`).
 */

const SUPP = t.supplements;
/** Volljährig ab (SUPPLEMENT_RULES.adultFromAge) als Text für die Platzhalter. */
export const ADULT_AGE = formatGermanNumber(SUPPLEMENT_RULES.adultFromAge);

export function statusLabel(status: SupplementStatus): string {
  return status === 'adult_only' ? SUPP.status.adult_only(ADULT_AGE) : SUPP.status[status];
}

export function caffeineStatusLabel(status: CaffeineCard['status']): string {
  return status === 'safety_info_adult_only'
    ? SUPP.caffeineStatus.safety_info_adult_only(ADULT_AGE)
    : SUPP.caffeineStatus[status];
}

/** Menge als Satz (persönlich, Richtwert oder je Portion). */
export function doseLine(
  card: Pick<SupplementCard, 'id' | 'doseText' | 'doseGeneral'>,
): string | null {
  if (card.doseText === null) return null;
  if (card.doseGeneral) return SUPP.doseGeneral(card.doseText);
  if (card.id === 'protein_powder') return SUPP.dosePerServing(card.doseText);
  if (card.id === 'eaa') return SUPP.dosePerServingPlain(card.doseText);
  if (card.id === 'electrolytes') return SUPP.dosePerHourSodium(card.doseText);
  return SUPP.dosePerDay(card.doseText);
}

/** Kleines Kennzeichen mit Symbol und Text. */
export function StatusPill({
  label,
  icon,
  tone,
  testID,
}: {
  label: string;
  icon: string;
  tone: 'good' | 'neutral' | 'warn';
  testID?: string;
}) {
  const theme = useThemeColors();
  const palette = useAreaColors('ernaehrung');
  const border = tone === 'good' ? palette.icon : tone === 'warn' ? theme.warning : theme.border;
  return (
    <View testID={testID} style={[styles.pill, { borderColor: border }]}>
      <Text
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.pillIcon, appFont('bold'), { color: border }]}
      >
        {icon}
      </Text>
      <Text style={[styles.pillText, appFont('semibold'), { color: theme.text }]}>{label}</Text>
    </View>
  );
}

export function statusTone(status: SupplementStatus): 'good' | 'neutral' | 'warn' {
  return status === 'recommended' ? 'good' : status === 'excluded' ? 'warn' : 'neutral';
}

/** Antippbare Zeile in einer Gruppe (mind. 44 px, ganze Zeile ist ein Link). */
export function SupplementRow({
  title,
  lines,
  status,
  onPress,
  last = false,
  testID,
}: {
  title: string;
  lines: readonly (string | null)[];
  status?: { label: string; icon: string; tone: 'good' | 'neutral' | 'warn' } | undefined;
  onPress: () => void;
  last?: boolean;
  testID?: string;
}) {
  const theme = useThemeColors();
  const card = cardColors[useColorSchemeName()];
  const shown = lines.filter((line): line is string => line !== null && line !== '');
  const label = [title, status?.label, ...shown].filter(Boolean).join(', ');
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: 1, borderBottomColor: card.divider },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, appFont('bold'), { color: theme.text }]}>{title}</Text>
        {status ? <StatusPill {...status} /> : null}
        {shown.map((line) => (
          <Text key={line} style={[styles.rowLine, appFont('regular'), { color: theme.textMuted }]}>
            {line}
          </Text>
        ))}
      </View>
      <Icon name="chevron" size={18} color={theme.textMuted} />
    </Pressable>
  );
}

/** Zugelassene Angabe mit Pflichthinweis – immer beides zusammen (Plan 3.8 Nr. 5, B2.1). */
export function ClaimBlock({ claim, testID }: { claim: ClaimBlockText; testID?: string }) {
  const theme = useThemeColors();
  const palette = useAreaColors('ernaehrung');
  return (
    <View testID={testID} style={[styles.claim, { borderLeftColor: palette.icon }]}>
      <Body>{claim.claimDe}</Body>
      <Text style={[styles.claimInfo, appFont('regular'), { color: theme.textMuted }]}>
        {claim.requiredInfoDe}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// „Nahrungsergänzungsmittel anzeigen“ (06.11.2026): Karte mit großem Schalter (role switch)
// ---------------------------------------------------------------------------------------------------------

const TRACK_W = 52;
const TRACK_H = 32;
const THUMB = 26;
const THUMB_TRAVEL = TRACK_W - THUMB - 6;

/** Großer, animierter Schalter: Spur 52×32, an = Markenblau, Daumen gleitet (Farbe nie als einziges Signal: An/Aus). */
export function BigSwitch({ value }: { value: boolean }) {
  const theme = useThemeColors();
  const [anim] = useState(() => new Animated.Value(value ? 1 : 0));
  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [anim, value]);
  const background = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.border, colors.light.primary],
  });
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, THUMB_TRAVEL] });
  return (
    <Animated.View style={[styles.track, { backgroundColor: background }]}>
      <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]}>
        <Text
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.thumbMark,
            appFont('bold'),
            { color: value ? colors.light.primary : theme.textMuted },
          ]}
        >
          {value ? '✓' : ''}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

/** Karte „Nahrungsergänzungsmittel anzeigen“ – ganze Karte ist der Schalter (mind. 44 px). */
export function SupplementVisibilityCard({
  value,
  onChange,
  testID = 'supplements-visibility',
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
}) {
  const theme = useThemeColors();
  const card = cardColors[useColorSchemeName()];
  const palette = useAreaColors('ernaehrung');
  const V = SUPP.visibility;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={V.title}
      accessibilityHint={V.subtitle}
      accessibilityState={{ checked: value }}
      aria-checked={value}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        styles.visCard,
        {
          backgroundColor: theme.surface,
          borderColor: value ? colors.light.primary : card.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.visTop}>
        <View style={[styles.visIcon, { backgroundColor: palette.surface }]}>
          <Icon name="pill" size={22} color={palette.icon} />
        </View>
        <Text
          testID={`${testID}-state`}
          style={[
            styles.visState,
            appFont('semibold'),
            { color: value ? theme.link : theme.textMuted },
          ]}
        >
          {value ? V.on : V.off}
        </Text>
        <BigSwitch value={value} />
      </View>
      <View style={styles.visBody}>
        <Text style={[styles.visTitle, appFont('bold'), { color: theme.text }]}>{V.title}</Text>
        <Text style={[styles.visSub, appFont('regular'), { color: theme.textMuted }]}>
          {V.subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------------------
// „Supplemente heute“ – Zeitpunkte rund um die Einheit (06.11.2026)
// ---------------------------------------------------------------------------------------------------------

/** Karte auf „Heute“: nur an Trainingstagen und nur mit mindestens einer Zeile (rechnet packages/core). */
export function SupplementTimingCard({
  timing,
  startText,
  names,
  onMore,
}: {
  timing: TrainingDayTiming;
  /** Beginn der Einheit als Text („18:30 Uhr“), `null` = unbekannt. */
  startText: string | null;
  /** Name je Supplement-ID (aus den Inhalten). */
  names: Readonly<Record<string, string>>;
  onMore: () => void;
}) {
  const theme = useThemeColors();
  const card = cardColors[useColorSchemeName()];
  const palette = useAreaColors('ernaehrung');
  const T = SUPP.timingCard;
  const groups: { slot: TrainingTimingSlot; lines: TrainingDayTiming['lines'] }[] = [];
  for (const line of timing.lines) {
    const last = groups[groups.length - 1];
    if (last && last.slot === line.slot) last.lines = [...last.lines, line];
    else groups.push({ slot: line.slot, lines: [line] });
  }
  return (
    <View
      testID="supplement-timing-card"
      style={[styles.timingCard, { backgroundColor: theme.surface, borderColor: card.border }]}
    >
      <View style={styles.timingHead}>
        <View style={[styles.visIcon, { backgroundColor: palette.surface }]}>
          <Icon name="pill" size={20} color={palette.icon} />
        </View>
        <View style={styles.visText}>
          <Text
            accessibilityRole="header"
            style={[styles.visTitle, appFont('bold'), { color: theme.text }]}
          >
            {T.title}
          </Text>
          <Text style={[styles.visSub, appFont('regular'), { color: theme.textMuted }]}>
            {T.subtitle(startText)}
          </Text>
        </View>
      </View>
      {groups.map((group) => (
        <View
          key={group.slot}
          style={styles.timingGroup}
          testID={`supplement-timing-${group.slot}`}
        >
          <Text style={[styles.timingSlot, appFont('bold'), { color: palette.icon }]}>
            {T.slots[group.slot].toUpperCase()}
          </Text>
          {group.lines.map((line) => (
            <View
              key={line.id}
              style={styles.timingLine}
              testID={`supplement-timing-line-${line.id}`}
            >
              <Text style={[styles.timingName, appFont('semibold'), { color: theme.text }]}>
                {line.id === 'caffeine' ? T.caffeine : (names[line.id] ?? line.id)}
              </Text>
              <Text style={[styles.rowLine, appFont('regular'), { color: theme.textMuted }]}>
                {line.textDe}
              </Text>
            </View>
          ))}
        </View>
      ))}
      <Text style={[styles.timingHint, appFont('regular'), { color: theme.textMuted }]}>
        {T.hint}
      </Text>
      <Pressable
        accessibilityRole="link"
        onPress={onMore}
        testID="supplement-timing-more"
        style={({ pressed }) => [styles.timingMore, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text style={[styles.timingMoreText, appFont('semibold'), { color: theme.link }]}>
          {T.more}
        </Text>
        <Icon name="chevron" size={16} color={theme.link} />
      </Pressable>
    </View>
  );
}

/** „18:30 Uhr“ aus Minuten (für die Unterzeile der Karte). */
export function startLabel(minutes: number | null): string | null {
  return minutes === null ? null : `${clockLabel(minutes)} Uhr`;
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    padding: 3,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  thumbMark: { fontSize: 14, lineHeight: 16 },
  visCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    minHeight: 64,
  },
  visIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  visText: { flex: 1, minWidth: 0, gap: 2 },
  visBody: { gap: 2 },
  visTitle: { fontSize: fontSize.md },
  visSub: { fontSize: fontSize.sm, lineHeight: 20 },
  visState: { fontSize: fontSize.sm, flex: 1, textAlign: 'right' },
  timingCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  timingHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  timingGroup: { gap: 6 },
  timingSlot: { fontSize: fontSize.xs, letterSpacing: 0.8 },
  timingLine: { gap: 2 },
  timingName: { fontSize: fontSize.md },
  timingHint: { fontSize: fontSize.xs, lineHeight: 18 },
  timingMore: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  timingMoreText: { fontSize: fontSize.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  pillIcon: { fontSize: fontSize.sm },
  pillText: { fontSize: fontSize.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  rowText: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { fontSize: fontSize.md },
  rowLine: { fontSize: fontSize.sm, lineHeight: 20 },
  claim: { borderLeftWidth: 3, paddingLeft: spacing.sm, gap: 4 },
  claimInfo: { fontSize: fontSize.sm, lineHeight: 20 },
});
