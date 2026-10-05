import {
  brandColors,
  fontSize,
  fontWeight,
  maxContentWidth,
  radius,
  spacing,
} from '@fitnessapp/ui';
import { useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Alpha5Mark, BrandGlow, CheckBadge, SoonBadge } from '@/components/brand';
import { TopBanner } from '@/components/screen';
import { Button } from '@/components/ui';
import { t } from '@/i18n';
import { displayFont } from '@/lib/fonts';
import { useApp } from '@/state/app-state';

/**
 * Willkommensseite – bewusst immer dunkel wie der Hero der Landingpage und der Startbildschirm
 * (Logo auf Schwarz mit blauem Schein). Die Nutzenpunkte sind eine reine Liste, nichts davon ist antippbar;
 * der einzige Weg in die App sind die Knöpfe unten.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { backend } = useApp();
  // Kleine Bildschirme (z. B. iPhone SE): Logo und Überschrift etwas kleiner, damit mehr Liste sichtbar ist.
  const compact = useWindowDimensions().height < 700;
  return (
    <View style={styles.page} testID="welcome">
      <BrandGlow />
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.flex}>
        <TopBanner onDark />
        <ScrollView contentContainerStyle={styles.scroll} style={styles.flex}>
          <View style={styles.content}>
            <View style={styles.hero}>
              <Alpha5Mark width={compact ? 88 : 112} label={t.welcome.logoLabel} />
              <Text style={styles.eyebrow}>{t.welcome.eyebrow}</Text>
              <Text
                accessibilityRole="header"
                aria-level={1}
                style={[styles.title, compact && styles.titleCompact, displayFont()]}
              >
                {t.welcome.title}
              </Text>
              <Text style={styles.intro}>{t.welcome.intro}</Text>
            </View>

            <View role="list" aria-label={t.welcome.benefitsLabel} style={styles.list}>
              {t.welcome.benefits.map((benefit) => (
                <View key={benefit.title} role="listitem" style={styles.item}>
                  <CheckBadge />
                  <View style={styles.itemText}>
                    <Text style={styles.itemTitle}>{benefit.title}</Text>
                    <Text style={styles.itemBody}>{benefit.text}</Text>
                  </View>
                </View>
              ))}
              <View
                role="listitem"
                accessible
                accessibilityLabel={`${t.welcome.soon.label}. ${t.welcome.soon.text}`}
                style={styles.item}
              >
                <SoonBadge />
                <View style={styles.itemText}>
                  <View style={styles.soonRow}>
                    <Text style={[styles.itemTitle, styles.soonTitle]}>{t.welcome.soon.title}</Text>
                    <Text style={styles.badge}>{t.welcome.soon.badge}</Text>
                  </View>
                  <Text style={styles.itemBody}>{t.welcome.soon.text}</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerInner}>
            <Button
              label={t.welcome.start}
              accessibilityHint={t.welcome.startHint}
              onPress={() => router.push('/age')}
            />
            {backend.mode === 'supabase' ? (
              <Button
                label={t.welcome.haveAccount}
                variant="onDark"
                onPress={() => router.push('/account?login=1')}
              />
            ) : null}
            <Text style={styles.note}>{t.welcome.minAgeNote}</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: brandColors.schwarz, overflow: 'hidden' },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  content: { width: '100%', maxWidth: maxContentWidth, gap: spacing.xl },
  hero: { gap: spacing.sm + 4 },
  eyebrow: {
    marginTop: spacing.sm,
    color: brandColors.himmel,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: brandColors.weiss,
    // Im Browser schmal geschnitten (Archivo, Breite 75) – in der App Archivo Bold in normaler Breite.
    fontSize: Platform.OS === 'web' ? 44 : 34,
    lineHeight: Platform.OS === 'web' ? 46 : 40,
    letterSpacing: -0.4,
  },
  titleCompact: {
    fontSize: Platform.OS === 'web' ? 36 : 28,
    lineHeight: Platform.OS === 'web' ? 38 : 34,
  },
  intro: { color: brandColors.grauDunkel, fontSize: 17, lineHeight: 26 },
  list: { gap: spacing.md + 4 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  itemText: { flex: 1, gap: 2 },
  itemTitle: {
    color: brandColors.weiss,
    fontSize: fontSize.md + 1,
    fontWeight: fontWeight.bold,
    lineHeight: 24,
  },
  itemBody: { color: brandColors.grauDunkel, fontSize: fontSize.sm + 1, lineHeight: 22 },
  soonRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  soonTitle: { flexShrink: 1 },
  badge: {
    color: brandColors.himmel,
    borderColor: brandColors.graphitHell,
    backgroundColor: brandColors.graphit,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    overflow: 'hidden',
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: brandColors.graphitHell,
    // Markenschwarz mit 92 % Deckkraft (Hex mit Alpha: EB ≈ 0,92).
    backgroundColor: `${brandColors.schwarz}EB`,
  },
  footerInner: { width: '100%', maxWidth: maxContentWidth, gap: spacing.sm + 4 },
  note: {
    color: brandColors.grauDunkel,
    fontSize: fontSize.sm - 1,
    textAlign: 'center',
  },
});
