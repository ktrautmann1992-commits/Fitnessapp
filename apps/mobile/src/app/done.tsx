import { planInfoNotices } from '@fitnessapp/core';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { activePlan } from '@/data/training-plan';
import { t } from '@/i18n';
import { createPlanErrorText } from '@/lib/error-text';
import { planTitleText } from '@/lib/plan-title';
import { summaryLines } from '@/lib/summary';
import { useApp } from '@/state/app-state';
import { healthConsentStatus } from '@/state/flow';

type PlanState = { kind: 'creating' } | { kind: 'ready' } | { kind: 'error'; message: string };

/**
 * Bildschirm E: Fertig – Zusammenfassung und Plan (docs/PLAN-PHASE-3.md 10.1): „Dein Plan wird erstellt …“ →
 * „Dein Plan ist fertig“ mit Vorlage, Güte und „Zum Plan“. Der Plan wird hier genau einmal erzeugt.
 */
export default function DoneScreen() {
  const router = useRouter();
  const app = useApp();
  const [state, setState] = useState<PlanState>({ kind: 'creating' });
  const started = useRef(false);
  const ready = app.status.kind === 'ready' && app.rows?.profile != null;
  const hasPlan = app.rows ? activePlan(app.rows) !== null : false;
  const { createPlan } = app;

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    if (hasPlan) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Zustand nach dem Laden, kein Folge-Render-Zyklus
      setState({ kind: 'ready' });
      return;
    }
    void createPlan().then((outcome) =>
      setState(
        outcome.ok
          ? { kind: 'ready' }
          : { kind: 'error', message: createPlanErrorText(outcome.code) },
      ),
    );
  }, [createPlan, hasPlan, ready]);

  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (!app.session || !app.rows?.profile) {
    return <Redirect href="/" />;
  }
  const lines = summaryLines(app.answers, healthConsentStatus(app.rows, app.versions) === 'valid');
  const plan = activePlan(app.rows)?.plan ?? null;

  async function retry() {
    setState({ kind: 'creating' });
    const outcome = await app.createPlan();
    setState(
      outcome.ok
        ? { kind: 'ready' }
        : { kind: 'error', message: createPlanErrorText(outcome.code) },
    );
  }

  return (
    <Screen
      title={t.done.title}
      testID="done"
      footer={
        <Button
          label={state.kind === 'ready' ? t.done.toPlan : t.common.toStart}
          onPress={() => router.replace('/today')}
          disabled={state.kind === 'creating'}
        />
      }
    >
      {state.kind === 'creating' ? (
        <LoadingState label={t.done.creating} />
      ) : state.kind === 'error' ? (
        <Notice tone="danger" testID="done-plan-error">
          <Body>{state.message}</Body>
          <Button label={t.common.retry} variant="secondary" onPress={() => void retry()} />
        </Notice>
      ) : plan ? (
        <Notice tone="success" title={t.done.ready} testID="done-plan">
          <Body>{planTitleText(plan)}</Body>
          <Body>{t.plan.quality[plan.match_quality]}</Body>
        </Notice>
      ) : null}
      {state.kind === 'ready' && plan
        ? planInfoNotices(plan, app.library.kind === 'ready' ? app.library.library : null).map(
            (notice) => (
              <Notice
                key={notice}
                title={t.plan.infoNotices[notice].title}
                testID={`done-info-${notice}`}
              >
                <Body>{t.plan.infoNotices[notice].text}</Body>
              </Notice>
            ),
          )
        : null}
      <Heading level={2}>{t.done.summary}</Heading>
      <Card>
        {lines.map((line) => (
          <View key={line.label} style={{ gap: 2 }}>
            <Body muted>{line.label}</Body>
            <Body>{line.value}</Body>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
