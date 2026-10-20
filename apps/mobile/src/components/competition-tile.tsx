import { fontSize } from '@fitnessapp/ui';
import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Tile } from '@/components/design';
import { Body } from '@/components/ui';
import { type CompetitionTileView, competitionTileView } from '@/data/competition-dashboard';
import { activePlan } from '@/data/training-plan';
import type { UserRows } from '@/data/types';
import { t } from '@/i18n';
import { countdownText, disciplineText, phaseBandText } from '@/lib/competition-format';
import { dayLabel } from '@/lib/plan-format';
import { useApp } from '@/state/app-state';

/**
 * Kachel „Mein Wettkampf“ auf der Übersicht (Gründer-Rückmeldung 20.10.2026: „Man findet den Wettkampfplan nicht“).
 * Mit Wettkampf: Name, Distanz, Countdown, Phase und „Woche X von Y“, Ampel kurz; die ganze Kachel ist der Link
 * „Wettkampfplan ansehen“. Ohne Wettkampf: Link „Wettkampf planen“ mit kurzem Text (Design 20.10.2026). Rechnet nichts selbst (data/competition-dashboard.ts → packages/core).
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

  const open = (href: string) => () => router.navigate(href as Href);
  // Design 20.10.2026: Kachel in Wettkampf-Orange mit großem Pokal-Chip; die ganze Kachel ist ein Link.
  if (view.kind === 'none') {
    return (
      <View testID="overview-competition">
        <Tile
          variant="row"
          area="wettkampf"
          icon="trophy"
          eyebrow={texts.title}
          title={texts.plan}
          role="link"
          accessibilityLabel={texts.planA11y}
          onPress={open('/wettkampf?neu=1')}
          testID="overview-competition-plan"
        >
          <Body muted testID="overview-competition-none" style={styles.small}>
            {texts.none}
          </Body>
        </Tile>
      </View>
    );
  }
  if (view.kind === 'unreadable') {
    return (
      <View testID="overview-competition">
        <Tile
          variant="row"
          area="wettkampf"
          icon="trophy"
          eyebrow={texts.title}
          title={texts.unreadableOpen}
          role="link"
          onPress={open('/wettkampf')}
        >
          <Body muted testID="overview-competition-error" style={styles.small}>
            {texts.unreadable}
          </Body>
        </Tile>
      </View>
    );
  }
  return (
    <View testID="overview-competition">
      <Tile
        variant="row"
        area="wettkampf"
        icon="trophy"
        eyebrow={texts.title}
        title={`${view.name} · ${disciplineText(view.discipline, view.distanceKm)}`}
        titleTestID="overview-competition-name"
        role="link"
        accessibilityLabel={texts.openA11y(view.name)}
        onPress={open('/wettkampf')}
        testID="overview-competition-open"
      >
        <Body muted style={styles.small}>
          {texts.raceDate(dayLabel(view.raceDate))}
        </Body>
        <Body testID="overview-competition-countdown" style={styles.small}>
          {tileCountdown(view)}
        </Body>
        {view.week ? (
          <Body muted testID="overview-competition-week" style={styles.small}>
            {phaseBandText(view.week)}
          </Body>
        ) : null}
        <TileAmpel view={view} />
      </Tile>
    </View>
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
    return view.planState === 'basic' ? (
      <Body muted style={styles.small}>
        {texts.noPlan}
      </Body>
    ) : null;
  }
  if (ampel.kind === 'plan_active') {
    return (
      <Body
        testID="overview-competition-ampel"
        accessibilityLabel={texts.planActiveA11y}
        style={styles.small}
      >
        {texts.planActive}
      </Body>
    );
  }
  if (ampel.kind === 'check') {
    return (
      <Body muted testID="overview-competition-ampel" style={styles.small}>
        {texts.check}
      </Body>
    );
  }
  const s = t.competition.status[ampel.status];
  return (
    <>
      <Body
        testID="overview-competition-ampel"
        accessibilityLabel={texts.feasibilityA11y(s.label)}
        style={styles.small}
      >
        {texts.feasibility(s.symbol, s.label)}
      </Body>
      {view.planState === 'basic' ? (
        <Body muted style={styles.small}>
          {texts.noPlan}
        </Body>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  small: { fontSize: fontSize.sm, lineHeight: 20 },
});
