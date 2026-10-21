import type { StoredSession } from '@fitnessapp/core';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { TestPhaseBadge } from '@/components/test-phase';
import { SectionLabel } from '@/components/design';
import { Body, Button, Card, Checkbox, Notice } from '@/components/ui';
import { adjustmentsForSession, openProposal } from '@/data/live-adjust';
import type { UserRows } from '@/data/types';
import { t } from '@/i18n';
import { sessionAdjustmentLines } from '@/lib/live-adjust-format';
import { useApp } from '@/state/app-state';
import type { FewerDaysChange } from '@fitnessapp/core';

/**
 * Bausteine der Live-Anpassung (Phase 4b, Etappe D, docs/PLAN-PHASE-4B.md 8.1). Nur Darstellung – Regeln, Prüfungen
 * und „Rückgängig erlaubt?“ kommen aus packages/core (über data/live-adjust.ts). Im Supabase-Modus ist alles
 * ausgeblendet (`liveAdjust.available` = false), bis Etappe B/C die Premium-Prüfung auf dem Server bauen.
 */

/** Übungsnamen: Bibliothek (auch archivierte des Plans), sonst der Name aus dem Plan. */
export function useExerciseNames(rows: UserRows | null): ReadonlyMap<string, string> {
  const { library } = useApp();
  return useMemo(() => {
    const names = new Map<string, string>();
    for (const e of rows?.plannedExercises ?? []) names.set(e.exercise_id, e.exercise_name_de);
    if (library.kind === 'ready') {
      for (const e of (library.library.displayExercises ?? library.library.exercises).values()) {
        names.set(e.id, e.name_de);
      }
    }
    return names;
  }, [library, rows]);
}

/** Kennzeichen „angepasst“ unter einer Einheit (Zeichen + Wort, nie nur Farbe) mit Link zur Erklärung. */
export function SessionAdjustedNotice({
  session,
}: {
  session: Pick<StoredSession, 'id' | 'exercises'>;
}) {
  const router = useRouter();
  const app = useApp();
  const names = useExerciseNames(app.rows);
  if (!app.liveAdjust.available || !app.rows) return null;
  const hits = adjustmentsForSession(app.rows, app.liveAdjust.adjustments, session);
  if (hits.length === 0) return null;
  const lines = sessionAdjustmentLines(hits, names);
  return (
    <View testID="adjusted-notice" style={{ gap: 4 }}>
      <Body testID="adjusted-badge">{t.adjust.badge}</Body>
      <Body muted>{t.adjust.sessionAdjusted}</Body>
      {lines.map((line, index) => (
        <Body
          key={`${index}-${line.text}`}
          testID={`adjusted-line-${index}`}
          accessibilityLabel={line.accessibilityLabel}
        >
          {line.text}
        </Body>
      ))}
      <Button
        label={t.adjust.why}
        variant="link"
        accessibilityLabel={t.adjust.badgeA11y}
        onPress={() => router.push('/plan/changes' as Href)}
        testID="adjusted-why"
      />
    </View>
  );
}

/** Offener Vorschlag „Weniger Trainingstage?“ als Karte oben auf „Heute“ (8.1 Punkt 1). */
export function FewerDaysCard({ today }: { today: string }) {
  const router = useRouter();
  const app = useApp();
  if (!app.liveAdjust.available || !app.rows) return null;
  const proposal = openProposal(app.rows, app.liveAdjust.adjustments, today);
  if (!proposal || proposal.rule !== 'fewer_days') return null;
  const done = Number(proposal.explainParams.done ?? 0);
  const planned = Number(proposal.explainParams.planned ?? 0);
  return (
    <Notice tone="info" title={t.adjust.proposalTitle} testID="fewer-days-card">
      <Body>{t.adjust.proposalText(done, planned)}</Body>
      <Button
        label={t.adjust.proposalOpen}
        variant="secondary"
        onPress={() =>
          router.push(`/plan/weniger-tage?id=${encodeURIComponent(proposal.id)}` as Href)
        }
        testID="fewer-days-open"
      />
    </Notice>
  );
}

/** Wochentag des Vorschlags (ISO 1–7); null = unbekannt. */
export function proposedDropWeekday(change: FewerDaysChange | null): number | null {
  return change?.drop_weekday ?? null;
}

/**
 * Einstellungen: Abschnitt „Live-Anpassung“ mit Kennzeichen „Testphase: kostenlos“. Der Schalter „Live-Anpassung
 * einschalten (Testmodus)“ (intern simulatePremium) erscheint NUR im Testmodus (Wächter K2), Standard AN (Testphase
 * „alles offen“, KONZEPT 13); ausschalten = Gratis-Weg testen. Im Supabase-Modus gibt es den Abschnitt erst mit
 * Etappe C.
 */
export function LiveAdjustSettings() {
  const router = useRouter();
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (app.backend.mode !== 'local' || !app.liveAdjust.available) return null;
  async function toggle(value: boolean) {
    setBusy(true);
    setError(undefined);
    try {
      await app.setSimulatePremium(value);
    } catch {
      setError(t.adjust.simulateFailed);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionLabel>{t.adjust.settingsTitle}</SectionLabel>
      <Card>
        <TestPhaseBadge testID="settings-adjust-test-phase" />
        <Body muted>{t.adjust.settingsText}</Body>
        <Checkbox
          label={t.adjust.simulate}
          checked={app.liveAdjust.simulatePremium}
          onChange={(value) => void toggle(value)}
          testID="settings-simulate-premium"
        />
        <Body muted>{t.adjust.simulateHint}</Body>
        <Body muted>{t.adjust.simulateBrowserHint}</Body>
        {busy ? <Body muted>{t.common.loading}</Body> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button
          label={t.adjust.open}
          variant="secondary"
          onPress={() => router.push('/plan/changes' as Href)}
          testID="settings-adjust-changes"
        />
      </Card>
    </>
  );
}
