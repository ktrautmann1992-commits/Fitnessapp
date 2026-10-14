import { guideForDisplay } from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { GuideBackButton, GuideLibraryGate, useReadableGuides } from '@/components/guides';
import { DemoBanner } from '@/components/nutrition';
import { Screen } from '@/components/screen';
import { Body, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { t } from '@/i18n';
import { useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';
import { useNutritionWeek } from '@/state/use-nutrition';

/**
 * Ratgeber lesen (KONZEPT 6.8, docs/PLAN-PHASE-5.md 19.6, Etappe N5c): offline aus dem gebündelten Bestand, ohne
 * Netz und ohne Echtzeit-KI. Nur Ratgeber aus `readableGuides` (freigegeben bzw. Testmodus-Entwurf, kein roter
 * Befund R21 – Health-Claims). „Kalorienzahlen aus“ (bzw. Schwangerschaft/Stillzeit): Absätze mit kcal oder
 * Makro-Gramm ausgeblendet (`guideForDisplay`), feste Hinweise wie beim Carb-Loading bleiben immer sichtbar.
 */
export default function GuideScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ id: string }>();
  const view = useNutritionWeek();
  const guides = useReadableGuides(view);

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
  if (route !== '/today' || !app.rows) {
    return <Redirect href={route as Href} />;
  }
  const texts = t.nutrition.guides;
  const shell = (title: string, children: ReactNode) => (
    <Screen title={title} testID="guide" footer={<GuideBackButton fallback="/ratgeber" />}>
      {children}
    </Screen>
  );
  if (guides === null || view.library.kind !== 'ready') {
    return shell(texts.title, <GuideLibraryGate view={view} />);
  }
  const guide = guides.find((g) => g.id === String(params.id ?? ''));
  if (guide === undefined) {
    return shell(
      texts.title,
      <Notice tone="info" testID="guide-not-found">
        {texts.notFound}
      </Notice>,
    );
  }
  const display = guideForDisplay(guide, { showNumbers: view.showNumbers });

  return shell(
    display.title ?? texts.title,
    <>
      {view.library.result.demo ? <DemoBanner /> : null}
      {display.isDraft ? (
        <Notice tone="info" testID="guide-draft">
          {texts.draft}
        </Notice>
      ) : null}
      {display.hiddenCount > 0 ? (
        <Notice tone="info" testID="guide-numbers-hidden">
          {texts.hiddenNumbers}
        </Notice>
      ) : null}
      {display.intro ? <Body>{display.intro}</Body> : null}
      <View style={styles.sections} testID="guide-sections">
        {display.sections.map((section, index) => (
          <View key={`${index}-${section.heading ?? ''}`} style={styles.section}>
            {section.heading !== null ? <Heading level={2}>{section.heading}</Heading> : null}
            {section.paragraphs.map((paragraph, i) => (
              <Body key={`${i}-${paragraph}`}>{paragraph}</Body>
            ))}
            {section.hiddenCount > 0 ? (
              <Body muted>{texts.hiddenInSection(section.hiddenCount)}</Body>
            ) : null}
            {section.notice ? (
              <Notice tone="warning" testID="guide-notice">
                {section.notice}
              </Notice>
            ) : null}
          </View>
        ))}
      </View>
      {display.places.length > 0 ? (
        <View style={styles.sections} testID="guide-places">
          <Heading level={2}>{texts.places}</Heading>
          {display.places.map((place, index) => (
            <Card key={`${index}-${place.name ?? ''}`}>
              {place.name !== null ? <Heading level={2}>{place.name}</Heading> : null}
              {place.good.length > 0 ? (
                <>
                  <Body>{texts.good}</Body>
                  {place.good.map((line, i) => (
                    <Body key={`${i}-${line}`}>{`• ${line}`}</Body>
                  ))}
                </>
              ) : null}
              {place.lessOften.length > 0 ? (
                <>
                  <Body>{texts.lessOften}</Body>
                  {place.lessOften.map((line, i) => (
                    <Body key={`${i}-${line}`} muted>{`• ${line}`}</Body>
                  ))}
                </>
              ) : null}
              {place.tip ? <Body muted>{texts.tip(place.tip)}</Body> : null}
              {place.hiddenCount > 0 ? (
                <Body muted>{texts.hiddenInSection(place.hiddenCount)}</Body>
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}
      <Body muted>{texts.disclaimer}</Body>
    </>,
  );
}

const styles = StyleSheet.create({
  sections: { gap: spacing.md },
  section: { gap: spacing.xs },
});
