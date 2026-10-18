import type { NutritionDayTargets } from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, Heading } from '@/components/ui';
import { t } from '@/i18n';
import {
  competitionDayA11y,
  competitionDayLabel,
  competitionDayLines,
  raceFuelingLines,
  raceTimelineRows,
} from '@/lib/competition-nutrition-format';

/**
 * Wettkampf-Ernährung am Tag (Phase 10, Etappe W1, docs/PLAN-PHASE-10.md Abschnitt 10): Art des Tages (Carb-Loading,
 * Vorabend, Renntag, Nach dem Rennen, Wettkampfwoche), am Renntag die Zeitleiste mit Gel-/Trinkplan (offline – alles
 * kommt aus den Tageszielen der Engine), Hinweis auf ärztliche Abklärung und Link zum Ratgeber, wenn es ihn gibt.
 * „Kalorienzahlen anzeigen“ aus → keine Gramm. Nichts wird hier gerechnet.
 */
export function CompetitionNutritionCard({
  day,
  showNumbers,
  onOpenGuide,
}: {
  day: NutritionDayTargets;
  showNumbers: boolean;
  /** null = kein lesbarer Ratgeber „Wettkampf-Ernährung“ (dann kein Link). */
  onOpenGuide: (() => void) | null;
}) {
  const c = day.competition;
  if (c === undefined) return null;
  const texts = t.competitionNutrition;
  const lines = competitionDayLines(day, showNumbers);
  const fueling = c.fueling;
  return (
    <Card>
      <View style={styles.gap} testID="competition-nutrition">
        <View accessible accessibilityLabel={competitionDayA11y(c)}>
          <Heading level={2}>{competitionDayLabel(c)}</Heading>
        </View>
        {lines.map((line) => (
          <Body key={line}>{line}</Body>
        ))}
        {fueling !== undefined ? (
          <View
            style={styles.gap}
            testID="competition-timeline"
            accessibilityLabel={texts.timelineA11y}
          >
            <Heading level={2}>{texts.timelineTitle}</Heading>
            {raceTimelineRows(fueling, showNumbers).map((row) => (
              <View key={row.key} style={styles.row}>
                <Body>{`• ${row.title}`}</Body>
                {row.detail !== null ? <Body muted>{row.detail}</Body> : null}
              </View>
            ))}
            {raceFuelingLines(fueling, showNumbers).map((line) => (
              <Body key={line} muted>
                {line}
              </Body>
            ))}
          </View>
        ) : null}
        {c.kind !== 'normal' ? <Body muted>{texts.medical}</Body> : null}
        {onOpenGuide !== null && c.kind !== 'normal' ? (
          <Button
            label={texts.guide}
            accessibilityLabel={texts.guideA11y}
            variant="secondary"
            onPress={onOpenGuide}
            testID="competition-nutrition-guide"
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  row: { gap: spacing.xs },
});
