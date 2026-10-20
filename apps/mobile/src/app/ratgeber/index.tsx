import { guideForDisplay, isPublishedWithoutExpertReview } from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GuideBackButton, GuideLibraryGate, useReadableGuides } from '@/components/guides';
import { DemoBanner } from '@/components/nutrition';
import { Screen } from '@/components/screen';
import { Body, LoadingState, MIN_TOUCH } from '@/components/ui';
import { t } from '@/i18n';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useNutritionWeek } from '@/state/use-nutrition';
import { Text } from '@/components/text';

/**
 * Ratgeber-Übersicht (KONZEPT 6.8, docs/PLAN-PHASE-5.md 19.6, Etappe N5c): gratis, offline aus dem gebündelten
 * Bestand, nur freigegebene Ratgeber ohne roten Befund (Testmodus: auch Entwürfe, gekennzeichnet). Freigegeben ohne
 * Fachprüfung (Testphase) → Kennzeichen „Testphase – noch nicht fachlich geprüft“.
 */
export default function GuideListScreen() {
  const router = useRouter();
  const app = useApp();
  const view = useNutritionWeek();
  const guides = useReadableGuides(view);
  const theme = useThemeColors();

  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  const route = resolveEntryRoute({
    session: app.session,
    rows: app.rows,
    versions: app.versions,
    nutritionSetupAvailable: app.backend.supportsNutrition,
  });
  if (route !== HOME_ROUTE || !app.rows) {
    return <Redirect href={route as Href} />;
  }
  const texts = t.nutrition.guides;
  const shell = (children: ReactNode) => (
    <Screen
      title={texts.title}
      testID="guide-list"
      footer={<GuideBackButton fallback="/ernaehrung" />}
    >
      {children}
    </Screen>
  );
  if (guides === null || view.library.kind !== 'ready') {
    return shell(<GuideLibraryGate view={view} />);
  }

  return shell(
    <>
      {view.library.result.demo ? <DemoBanner /> : null}
      <Body muted>{texts.intro}</Body>
      {guides.length === 0 ? (
        <Body muted testID="guide-list-empty">
          {texts.none}
        </Body>
      ) : (
        <View style={styles.list}>
          {guides.map((guide) => {
            // Titel mit Zahlen bei „Zahlen aus“ ausgeblendet (Wächter N5c K1).
            const title =
              guideForDisplay(guide, { showNumbers: view.showNumbers }).title ?? texts.title;
            return (
              <Pressable
                key={guide.id}
                accessibilityRole="button"
                accessibilityLabel={texts.openA11y(title)}
                onPress={() => router.push(`/ratgeber/${encodeURIComponent(guide.id)}` as Href)}
                testID={`guide-open-${guide.id}`}
                style={({ pressed }) => [
                  styles.card,
                  {
                    borderColor: theme.border,
                    backgroundColor: pressed ? theme.background : theme.surface,
                  },
                ]}
              >
                <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                {guide.status === 'draft' ? (
                  <Text style={[styles.detail, { color: theme.textMuted }]}>{texts.draft}</Text>
                ) : isPublishedWithoutExpertReview(guide) ? (
                  // Testphase (Gründer-Entscheidung 19.10.2026, Wächter N1): freigegeben ohne Fachprüfung.
                  <Text
                    style={[styles.detail, { color: theme.textMuted }]}
                    testID={`guide-testphase-${guide.id}`}
                  >
                    {texts.testphase}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </>,
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  detail: { fontSize: fontSize.sm, lineHeight: 20 },
});
