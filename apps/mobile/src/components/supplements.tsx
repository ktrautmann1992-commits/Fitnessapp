import {
  type CaffeineCard,
  type ClaimBlockText,
  formatGermanNumber,
  SUPPLEMENT_RULES,
  type SupplementCard,
  type SupplementStatus,
} from '@fitnessapp/core';
import { cardColors, fontSize, radius, spacing } from '@fitnessapp/ui';
import { Pressable, StyleSheet, View } from 'react-native';

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

const styles = StyleSheet.create({
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
