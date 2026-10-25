import { loopRemainingM } from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoopMap } from '@/components/loop-map';
import { Body, Card, Heading } from '@/components/ui';
import { t } from '@/i18n';
import { loopGuideFor } from '@/lib/loop-guide';
import { LOOP_COLORS } from '@/lib/loop-map-html';

const L = t.loop;

/**
 * Leitlinie beim Laufen einer vorgeschlagenen Runde („Diese Runde laufen“, docs/PLAN-RUNDKURS.md): Karte mit der Runde
 * und dem Startpunkt sowie „Noch ca. X km bis zum Start“. Ohne passende Leitlinie (normale Aufzeichnung) nichts.
 */
export function LoopGuideCard({
  guideId,
  distanceM,
}: {
  guideId: string | null | undefined;
  distanceM: number;
}) {
  const guide = loopGuideFor(guideId);
  const lines = useMemo(
    () => (guide ? [{ points: guide.points, color: LOOP_COLORS[0] as string }] : []),
    [guide],
  );
  if (!guide) return null;
  const remaining = loopRemainingM(guide.distanceM, distanceM);
  return (
    <Card>
      <View style={styles.section} testID="record-loop-guide">
        <Heading level={2}>{L.guideTitle(guide.name)}</Heading>
        <LoopMap
          lines={lines}
          selected={0}
          start={guide.points[0] ?? null}
          label={L.guideA11y}
          testID="record-loop-map"
        />
        <Body testID="record-loop-remaining">
          {remaining > 0 ? L.guideRemaining(remaining) : L.guideDone}
        </Body>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});
