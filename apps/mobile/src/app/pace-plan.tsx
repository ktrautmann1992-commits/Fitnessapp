import { renderPrintHtml } from '@fitnessapp/ui/print';
import { RACE_PACE_STRATEGIES, type RacePaceStrategy } from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { PrintPreview } from '@/components/print-preview';
import { DEFAULT_RACE_PACE_CHOICE, useRacePace } from '@/components/race-pace';
import { Screen } from '@/components/screen';
import { Body, Button, LoadingState, Notice } from '@/components/ui';
import { plannedCompetition } from '@/data/competition';
import { t } from '@/i18n';
import { PRINT_TARGET, printHtml } from '@/lib/print-output';
import { racePacePrintDocument } from '@/lib/race-pace-format';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';

const P = t.racePace;

/**
 * Pace-Plan als PDF (wie die anderen Druckansichten, docs/PLAN-PDF-EXPORT.md): Vorschau im Browser, „Drucken / als PDF
 * speichern“ über den Druckdialog bzw. expo-print. Nichts wird gespeichert oder hochgeladen. Keine Gesundheitsangaben
 * auf dem Blatt (nur Wettkampf, Zeiten, Verpflegungs-Richtwerte).
 */
export default function PacePlanPrintScreen() {
  const router = useRouter();
  const app = useApp();
  const params = useLocalSearchParams<{
    strategie?: string;
    strecke?: string;
    vorhersage?: string;
  }>();
  const strategy: RacePaceStrategy = (RACE_PACE_STRATEGIES as readonly string[]).includes(
    params.strategie ?? '',
  )
    ? (params.strategie as RacePaceStrategy)
    : 'even';
  const choice = useMemo(
    () => ({
      ...DEFAULT_RACE_PACE_CHOICE,
      strategy,
      routeId: params.strecke ?? null,
      preferPredicted: params.vorhersage === '1',
    }),
    [strategy, params.strecke, params.vorhersage],
  );
  const rows = app.rows;
  const planned = rows ? plannedCompetition(rows) : null;
  const competition = planned?.stored.competition ?? null;
  const pace = useRacePace(
    competition ?? {
      discipline: 'cycling',
      targetTimeS: null,
      reference: null,
      raceDate: '2000-01-01',
    },
    choice,
    rows,
  );
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const doc = useMemo(() => {
    if (!competition || !pace.plan || !pace.target) return null;
    const translated = racePacePrintDocument({
      name: competition.name,
      discipline: competition.discipline,
      distanceKm: competition.distanceKm,
      plan: pace.plan,
      target: pace.target,
      showNumbers: pace.showNumbers,
      courseName: pace.course?.name ?? null,
    });
    return { html: renderPrintHtml(translated), title: translated.title };
  }, [competition, pace]);

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
  if (route !== HOME_ROUTE || !app.rows || !app.session) {
    return <Redirect href={route as Href} />;
  }
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/wettkampf' as Href));

  async function print() {
    if (!doc) return;
    setPrinting(true);
    setMessage(null);
    try {
      const outcome = await printHtml(doc.html);
      if (outcome === 'cancelled') setMessage(t.printView.cancelled);
    } catch {
      setMessage(t.printView.failed);
    } finally {
      setPrinting(false);
    }
  }

  const footer = (
    <View style={{ gap: 8 }}>
      <Button
        label={P.printNow}
        onPress={() => void print()}
        loading={printing}
        disabled={!doc}
        accessibilityHint={
          PRINT_TARGET === 'web' ? t.printView.printHintWeb : t.printView.printHintNative
        }
        testID="pace-print-button"
      />
      <Button label={P.back} variant="secondary" onPress={leave} testID="pace-print-back" />
    </View>
  );

  return (
    <Screen area="wettkampf" icon="trophy" title={P.printTitle} testID="pace-print" footer={footer}>
      {message ? <Notice tone="info">{message}</Notice> : null}
      {!doc ? (
        <Body testID="pace-print-empty">{P.noTarget}</Body>
      ) : (
        <PrintPreview html={doc.html} title={doc.title} label={P.printTitle} />
      )}
    </Screen>
  );
}
