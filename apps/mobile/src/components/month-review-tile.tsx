import { monthReviewOffer } from '@fitnessapp/core';
import { useRouter, type Href } from 'expo-router';

import { DashboardTile } from '@/components/dashboard';
import { Body, Button } from '@/components/ui';
import { t } from '@/i18n';
import { monthName } from '@/i18n/de-review';
import { useToday } from '@/lib/use-today';
import { useMonthReviewOpened } from '@/state/use-month-review';

/**
 * Monatsrückblick im Reiter „Fortschritt“ (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 3.1): vom 1. bis 7. eines Monats
 * ein ruhiges Angebot für den Vormonat (bis es geöffnet wurde), sonst nur der Weg zum Rückblick. Keine
 * Benachrichtigung, kein Druck. Eigene Komponente (wenig Überschneidung mit anderen Zweigen im Reiter).
 */
export function MonthReviewTile() {
  const router = useRouter();
  const today = useToday();
  const [opened] = useMonthReviewOpened();
  const texts = t.monthReview;
  const offer = opened === undefined ? null : monthReviewOffer(today, opened);
  const open = (month: string | null) =>
    router.push((month ? `/monatsrueckblick?monat=${month}` : '/monatsrueckblick') as Href);
  if (offer !== null) {
    return (
      <DashboardTile
        title={texts.offerTitle(monthName(offer))}
        area="fortschritt"
        icon="calendar"
        testID="month-review-offer"
      >
        <Body>{texts.offerText}</Body>
        <Button label={texts.open} onPress={() => open(offer)} testID="month-review-offer-open" />
      </DashboardTile>
    );
  }
  return (
    <Button
      label={texts.openAny}
      accessibilityHint={texts.openAnyHint}
      variant="secondary"
      onPress={() => open(null)}
      testID="progress-month-review"
    />
  );
}
