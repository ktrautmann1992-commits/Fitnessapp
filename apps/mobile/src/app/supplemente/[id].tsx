import { supplementDetail, type UserSupplementStatus } from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import {
  caffeineStatusLabel,
  ClaimBlock,
  doseLine,
  statusLabel,
  statusTone,
  StatusPill,
} from '@/components/supplements';
import { Body, Button, Card, FieldError, Heading, LoadingState, Notice } from '@/components/ui';
import { errorCode } from '@/data/backend';
import { t } from '@/i18n';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useSupplementLibrary, useSupplements } from '@/state/use-supplements';

const SUPP = t.supplements;

/**
 * Supplement im Detail (docs/PLAN-PHASE-6.md 8.1): Name, Studienlage als Wort (ohne Zweck), Einordnung mit Symbol und
 * Text, zugelassene Angabe NUR mit Pflichthinweis (`ClaimBlock`), Menge und Zeitpunkt (nur wenn der Core sie liefert),
 * Hinweise, Pflichtsätze, Quellen (eingeklappt), „Nehme ich“ / „Nicht für mich“. Kein Bereich „Wo kaufen“ – Shop-Links
 * kommen erst mit SU5 und bleiben bis zur Rechtsprüfung aus.
 */
export default function SupplementDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const app = useApp();
  const library = useSupplementLibrary();
  const view = useSupplements();
  const [showSources, setShowSources] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

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
  if (route !== HOME_ROUTE || !app.rows) {
    return <Redirect href={route as Href} />;
  }
  const back = (
    <Button
      label={SUPP.detail.back}
      variant="secondary"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/supplemente' as Href))}
      testID="supplement-detail-back"
    />
  );
  if (library.kind !== 'ready' || view.recommendations === null) {
    return (
      <Screen area="ernaehrung" icon="pill" footer={back}>
        {library.kind === 'error' ? (
          <Notice tone="danger">{SUPP.loadFailed}</Notice>
        ) : library.kind === 'loading' ? (
          <LoadingState label={SUPP.loading} />
        ) : (
          <Notice>{view.rulesFailed ? SUPP.rulesFailed : SUPP.incomplete}</Notice>
        )}
      </Screen>
    );
  }
  const detail = supplementDetail(
    params.id ?? '',
    view.recommendations,
    library.entries,
    view.data,
    view.weightKg,
  );
  if (!detail) {
    return (
      <Screen area="ernaehrung" icon="pill" footer={back} testID="supplement-detail-missing">
        <Notice tone="warning">{SUPP.detail.notFound}</Notice>
      </Screen>
    );
  }
  const ratedId =
    detail.kind === 'rated' ? (detail.id as Parameters<typeof view.setChoice>[0]) : null;

  async function choose(status: UserSupplementStatus | null) {
    if (ratedId === null) return;
    setSaving(true);
    setError(undefined);
    try {
      await view.setChoice(ratedId, status);
    } catch (caught) {
      const code = errorCode(caught);
      setError(
        code === 'network' || code === 'online_only'
          ? SUPP.errors.saveOffline
          : code === 'consent_required'
            ? SUPP.consent.none
            : SUPP.errors.save,
      );
    } finally {
      setSaving(false);
    }
  }

  const personalReady = view.consent === 'ok' && view.user.kind === 'ready';
  const hasScreening = view.data.screening !== null;
  const dose =
    detail.doseText === null
      ? null
      : doseLine({
          id: detail.id as never,
          doseText: detail.doseText,
          doseGeneral: detail.doseGeneral,
        });

  return (
    <Screen
      area="ernaehrung"
      icon="pill"
      title={detail.nameDe}
      testID="supplement-detail"
      footer={
        <View style={{ gap: spacing.sm }}>
          <FieldError message={error} testID="supplement-detail-error" />
          {back}
        </View>
      }
    >
      {detail.status ? (
        <StatusPill
          label={statusLabel(detail.status)}
          icon={SUPP.statusIcon[detail.status]}
          tone={statusTone(detail.status)}
          testID="supplement-detail-status"
        />
      ) : detail.caffeineStatus ? (
        <StatusPill
          label={caffeineStatusLabel(detail.caffeineStatus)}
          icon={detail.caffeineStatus === 'safety_info_excluded' ? '!' : 'i'}
          tone={detail.caffeineStatus === 'safety_info_excluded' ? 'warn' : 'neutral'}
          testID="supplement-detail-status"
        />
      ) : null}
      {!detail.expertReviewed ? (
        <Notice testID="supplement-testphase">{SUPP.testPhase}</Notice>
      ) : null}
      {detail.evidence ? (
        <Body muted testID="supplement-detail-evidence">
          {SUPP.evidence[detail.evidence]}
        </Body>
      ) : null}
      <Body>{detail.summaryDe}</Body>

      {detail.kind === 'not_recommended' && detail.reasonDe ? (
        <Card>
          <Heading level={2}>{SUPP.detail.reason}</Heading>
          <Body testID="supplement-detail-reason">{detail.reasonDe}</Body>
        </Card>
      ) : null}

      {detail.kind === 'rated' ? (
        <Card>
          <Heading level={2}>{SUPP.detail.timing}</Heading>
          {dose !== null ? (
            <>
              <Body testID="supplement-detail-dose">{dose}</Body>
              {detail.timing ? (
                <Body testID="supplement-detail-timing">{SUPP.timing[detail.timing]}</Body>
              ) : null}
            </>
          ) : (
            <Body muted testID="supplement-detail-no-dose">
              {SUPP.detail.noDose}
            </Body>
          )}
        </Card>
      ) : null}

      {detail.howToDe ? (
        <Card>
          <Heading level={2}>{SUPP.detail.howTo}</Heading>
          <Body testID="supplement-detail-howto">{detail.howToDe}</Body>
        </Card>
      ) : null}

      {detail.claims.length > 0 ? (
        <Card>
          <Heading level={2}>{SUPP.detail.claim}</Heading>
          {detail.claims.map((claim) => (
            <ClaimBlock key={claim.id} claim={claim} testID={`supplement-claim-${claim.id}`} />
          ))}
        </Card>
      ) : null}

      {detail.notices.length > 0 ? (
        <Notice
          tone={
            detail.status === 'excluded' || detail.caffeineStatus === 'safety_info_excluded'
              ? 'warning'
              : 'info'
          }
          title={SUPP.detail.notices}
          titleAsHeader
          testID="supplement-detail-notices"
        >
          {detail.notices.map((notice) => (
            <Body key={notice}>{notice}</Body>
          ))}
        </Notice>
      ) : null}

      <Notice title={SUPP.detail.mandatory} titleAsHeader testID="supplement-detail-mandatory">
        {detail.mandatory.map((sentence) => (
          <Body key={sentence}>{sentence}</Body>
        ))}
        <Body>{SUPP.disclaimer}</Body>
      </Notice>

      {detail.kind === 'rated' && personalReady ? (
        <Card>
          <Heading level={2}>{SUPP.mine.title}</Heading>
          {detail.choice === 'taking' ? (
            <Body testID="supplement-choice">{SUPP.detail.chosenTaking}</Body>
          ) : detail.choice === 'not_for_me' ? (
            <Body testID="supplement-choice">{SUPP.detail.chosenDeclined}</Body>
          ) : null}
          {detail.choiceOutdated ? (
            <Notice tone="warning" testID="supplement-choice-outdated">
              {SUPP.detail.choiceOutdated}
            </Notice>
          ) : null}
          {!hasScreening ? (
            <Body muted>{SUPP.detail.choiceNeedsCheck}</Body>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {detail.canChoose && detail.choice !== 'taking' ? (
                <Button
                  label={SUPP.detail.take}
                  onPress={() => void choose('taking')}
                  loading={saving}
                  testID="supplement-take"
                />
              ) : null}
              {detail.canDecline && detail.choice !== 'not_for_me' ? (
                <Button
                  label={SUPP.detail.decline}
                  variant="secondary"
                  onPress={() => void choose('not_for_me')}
                  disabled={saving}
                  testID="supplement-decline"
                />
              ) : null}
              {detail.choice !== null ? (
                <Button
                  label={SUPP.detail.remove}
                  variant="link"
                  onPress={() => void choose(null)}
                  disabled={saving}
                  testID="supplement-remove-choice"
                />
              ) : null}
            </View>
          )}
        </Card>
      ) : null}

      {detail.sources.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Button
            label={showSources ? SUPP.detail.hideSources : SUPP.detail.showSources}
            variant="secondary"
            expanded={showSources}
            onPress={() => setShowSources((value) => !value)}
            testID="supplement-sources-toggle"
          />
          {showSources ? (
            <Card>
              <Heading level={2}>{SUPP.detail.sources}</Heading>
              {detail.sources.map((source) => (
                <Body key={`${source.title}-${source.year}`} muted>
                  {[
                    `${source.authors} (${source.year}): ${source.title}. ${source.journal}.`,
                    source.doi ? `DOI ${source.doi}` : null,
                    source.pmid ? `PMID ${source.pmid}` : null,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </Body>
              ))}
            </Card>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
