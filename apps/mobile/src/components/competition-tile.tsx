import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';

import { DashboardTile } from '@/components/dashboard';
import { Body, Button } from '@/components/ui';
import { type CompetitionTileView, competitionTileView } from '@/data/competition-dashboard';
import { activePlan } from '@/data/training-plan';
import type { UserRows } from '@/data/types';
import { t } from '@/i18n';
import { countdownText, disciplineText, phaseBandText } from '@/lib/competition-format';
import { dayLabel } from '@/lib/plan-format';
import { useApp } from '@/state/app-state';

/**
 * Kachel „Mein Wettkampf“ auf der Übersicht (Gründer-Rückmeldung 20.10.2026: „Man findet den Wettkampfplan nicht“).
 * Mit Wettkampf: Name, Distanz, Countdown, Phase und „Woche X von Y“, Ampel kurz, „Wettkampfplan ansehen“. Ohne
 * Wettkampf: kurzer Text und „Wettkampf planen“. Rechnet nichts selbst (data/competition-dashboard.ts → packages/core).
 * Ladezustand: die Übersicht zeigt die Kachel erst mit geladenen Zeilen; der Fehlerzustand ist ein unlesbarer Wettkampf.
 */
export function CompetitionTile({ rows, today }: { rows: UserRows; today: string }) {
  const router = useRouter();
  const app = useApp();
  const texts = t.dashboard.competition;
  const view = useMemo(
    () =>
      competitionTileView({
        rows,
        versions: app.versions,
        active: activePlan(rows),
        rules: app.safetyRules,
        today,
        offline: app.offline,
      }),
    [app.offline, app.safetyRules, app.versions, rows, today],
  );

  if (view.kind === 'none') {
    return (
      <DashboardTile title={texts.title} testID="overview-competition">
        <Body testID="overview-competition-none">{texts.none}</Body>
        <Button
          label={texts.plan}
          accessibilityLabel={texts.planA11y}
          variant="secondary"
          onPress={() => router.navigate('/wettkampf?neu=1' as Href)}
          testID="overview-competition-plan"
        />
      </DashboardTile>
    );
  }
  if (view.kind === 'unreadable') {
    return (
      <DashboardTile title={texts.title} testID="overview-competition">
        <Body muted testID="overview-competition-error">
          {texts.unreadable}
        </Body>
        <Button
          label={texts.unreadableOpen}
          variant="secondary"
          onPress={() => router.navigate('/wettkampf' as Href)}
        />
      </DashboardTile>
    );
  }
  return (
    <DashboardTile title={texts.title} testID="overview-competition">
      <Body testID="overview-competition-name">
        {`${view.name} · ${disciplineText(view.discipline, view.distanceKm)}`}
      </Body>
      <Body muted>{texts.raceDate(dayLabel(view.raceDate))}</Body>
      <Body testID="overview-competition-countdown">{tileCountdown(view)}</Body>
      {view.week ? (
        <Body testID="overview-competition-week">{phaseBandText(view.week)}</Body>
      ) : null}
      <TileAmpel view={view} />
      <Button
        label={texts.open}
        accessibilityLabel={texts.openA11y(view.name)}
        onPress={() => router.navigate('/wettkampf' as Href)}
        testID="overview-competition-open"
      />
    </DashboardTile>
  );
}

function tileCountdown(view: Extract<CompetitionTileView, { kind: 'competition' }>): string {
  return view.countdown.kind === 'upcoming'
    ? t.dashboard.competition.countdown(view.countdown.daysLeft)
    : countdownText(view.countdown, view.discipline, view.distanceKm);
}

function TileAmpel({ view }: { view: Extract<CompetitionTileView, { kind: 'competition' }> }) {
  const texts = t.dashboard.competition;
  const ampel = view.ampel;
  if (ampel === null) {
    // Nur Countdown gespeichert bzw. Stand offline unbekannt: kein Wettkampfplan aktiv.
    return view.planState === 'basic' ? <Body muted>{texts.noPlan}</Body> : null;
  }
  if (ampel.kind === 'plan_active') {
    return (
      <Body testID="overview-competition-ampel" accessibilityLabel={texts.planActiveA11y}>
        {texts.planActive}
      </Body>
    );
  }
  if (ampel.kind === 'check') {
    return (
      <Body muted testID="overview-competition-ampel">
        {texts.check}
      </Body>
    );
  }
  const s = t.competition.status[ampel.status];
  return (
    <>
      <Body testID="overview-competition-ampel" accessibilityLabel={texts.feasibilityA11y(s.label)}>
        {texts.feasibility(s.symbol, s.label)}
      </Body>
      {view.planState === 'basic' ? <Body muted>{texts.noPlan}</Body> : null}
    </>
  );
}
