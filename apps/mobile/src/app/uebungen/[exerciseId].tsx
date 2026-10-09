import { glossaryEntry } from '@fitnessapp/core';
import { fontSize, fontWeight, spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { glossaryContextFromRows } from '@/data/glossary';
import { EMPTY_LOG_ROWS, logRowsOf, mergeLogRows } from '@/data/log-rows';
import { historyExercises } from '@/data/log-summary';
import { t } from '@/i18n';
import { featureLine } from '@/lib/glossary-format';
import { decodeRouteParam } from '@/lib/route-param';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';

/**
 * Glossar-Detailseite (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 8.1, Etappe G1): Name, andere Namen, Merkmale,
 * Beschreibung, „So geht's“ als nummerierte Schritte, Tipps, häufige Fehler, Sicherheitshinweis, ähnliche Übungen und
 * der eigene Verlauf. Das Anzeigemodell kommt aus packages/core (glossaryEntry); archivierte Übungen sind per
 * Direkt-ID erreichbar. Ist die Übung nach den aktuellen Regeln nicht für den Plan vorgesehen, steht nur ein neutraler
 * Satz da – nie ein Grund (kein Gesundheitsbezug).
 */
export default function GlossaryDetailScreen() {
  const params = useLocalSearchParams<{ exerciseId: string }>();
  const exerciseId = decodeRouteParam(params.exerciseId);
  const router = useRouter();
  const app = useApp();
  const theme = useThemeColors();
  const { ensureLibrary, library, rows, safetyRules } = app;
  useEffect(() => {
    void ensureLibrary();
  }, [ensureLibrary]);
  const lib = library.kind === 'ready' ? library.library : null;
  const entry = useMemo(
    () => glossaryEntry(exerciseId, glossaryContextFromRows(rows, lib, safetyRules)),
    [exerciseId, lib, rows, safetyRules],
  );

  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  const route = resolveEntryRoute({ session: app.session, rows: app.rows, versions: app.versions });
  if (route !== '/today' || !app.rows) {
    return <Redirect href={route as Href} />;
  }
  const back = () => (router.canGoBack() ? router.back() : router.replace('/uebungen' as Href));
  const footer = <Button label={t.glossary.back} variant="secondary" onPress={back} />;

  if (library.kind === 'idle' || library.kind === 'loading') {
    return (
      <Screen title={t.glossary.title} testID="glossary-detail" footer={footer}>
        <LoadingState />
      </Screen>
    );
  }
  if (!lib || !entry) {
    return (
      <Screen title={t.glossary.title} testID="glossary-detail" footer={footer}>
        <Notice tone={lib ? 'info' : 'warning'} testID="glossary-detail-missing">
          {lib ? t.glossary.notFound : t.glossary.libraryMissing}
        </Notice>
      </Screen>
    );
  }

  const hasHistory = historyExercises(
    mergeLogRows(logRowsOf(app.rows), app.olderLogs?.logs ?? EMPTY_LOG_ROWS),
  ).some((e) => e.exerciseId === entry.id);
  const list = (items: readonly string[], testID: string) => (
    <View style={styles.list} testID={testID}>
      {items.map((item, index) => (
        <Body key={`${index}-${item}`}>• {item}</Body>
      ))}
    </View>
  );

  return (
    <Screen title={entry.name} testID="glossary-detail" footer={footer}>
      {entry.isDraft ? (
        <Notice tone="info" testID="glossary-test-content">
          {t.glossary.testContent}
        </Notice>
      ) : entry.notReviewed ? (
        <Notice tone="info" testID="glossary-not-reviewed">
          {t.glossary.notReviewed}
        </Notice>
      ) : null}
      {entry.aliases.length > 0 ? (
        <Body muted>{t.glossary.alsoCalled(entry.aliases.join(', '))}</Body>
      ) : null}
      <Body muted>{t.glossary.englishName(entry.nameEn)}</Body>
      <Text style={[styles.features, { color: theme.text }]} testID="glossary-features">
        {featureLine(entry)}
      </Text>
      <Body muted>
        {entry.feasible.home ? t.glossary.feasibleHome : t.glossary.feasibleGymOnly}
      </Body>
      {entry.archived ? <Notice tone="info">{t.glossary.archived}</Notice> : null}
      {entry.availableForMe === false ? (
        // Neutral, ohne Grund (Plan 8.1).
        <Notice tone="info" testID="glossary-not-available">
          {t.glossary.notAvailable}
        </Notice>
      ) : entry.inMyPlan ? (
        <Body>{t.glossary.inMyPlan}</Body>
      ) : null}

      <Card>
        <Heading level={2}>{t.glossary.descriptionTitle}</Heading>
        <Body testID="glossary-description">{entry.description}</Body>
      </Card>

      <Card>
        <Heading level={2}>{t.glossary.stepsTitle}</Heading>
        <View style={styles.list} testID="glossary-steps">
          {entry.steps.map((step, index) => (
            <View
              key={`${index}-${step}`}
              style={styles.step}
              accessible
              accessibilityLabel={t.glossary.stepA11y(index + 1, entry.steps.length, step)}
            >
              <Text style={[styles.stepNo, { color: theme.text }]}>{index + 1}.</Text>
              <Body style={styles.stepText}>{step}</Body>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Heading level={2}>{t.glossary.tipsTitle}</Heading>
        {list(entry.tips, 'glossary-tips')}
      </Card>

      <Card>
        <Heading level={2}>{t.glossary.mistakesTitle}</Heading>
        {list(entry.mistakes, 'glossary-mistakes')}
      </Card>

      <Notice title={t.glossary.safetyTitle} titleAsHeader testID="glossary-safety">
        <Body>{entry.safetyNote}</Body>
      </Notice>

      {entry.similar.length > 0 ? (
        <View style={styles.list} testID="glossary-similar">
          <Heading level={2}>{t.glossary.similarTitle}</Heading>
          {entry.similar.map((similar) => (
            <Button
              key={similar.id}
              label={similar.name}
              variant="link"
              accessibilityLabel={t.glossary.guideA11y(similar.name)}
              onPress={() => router.push(`/uebungen/${encodeURIComponent(similar.id)}` as Href)}
            />
          ))}
        </View>
      ) : null}

      {hasHistory ? (
        <Button
          label={t.glossary.historyLink}
          variant="secondary"
          accessibilityLabel={t.glossary.historyLinkA11y(entry.name)}
          onPress={() => router.push(`/history/${encodeURIComponent(entry.id)}` as Href)}
          testID="glossary-history"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  features: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, lineHeight: 24 },
  list: { gap: spacing.xs },
  step: { flexDirection: 'row', gap: spacing.sm },
  stepNo: { fontSize: fontSize.md, fontWeight: fontWeight.bold, lineHeight: 24, minWidth: 24 },
  stepText: { flex: 1 },
});
