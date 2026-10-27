import {
  SUPPLEMENT_GROUPS,
  SUPPLEMENT_MANDATORY_SENTENCES_DE,
  supplementOverview,
  type SupplementGroup,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ListGroup, SectionLabel } from '@/components/design';
import { Screen } from '@/components/screen';
import {
  ADULT_AGE,
  caffeineStatusLabel,
  doseLine,
  statusLabel,
  statusTone,
  SupplementRow,
} from '@/components/supplements';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { t } from '@/i18n';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useSupplementLibrary, useSupplements } from '@/state/use-supplements';

const SUPP = t.supplements;

function groupTitle(group: SupplementGroup): string {
  return group === 'adult_only' ? SUPP.groups.adult_only(ADULT_AGE) : SUPP.groups[group];
}

/**
 * Supplemente – Übersicht (docs/PLAN-PHASE-6.md 8.1/8.2, Etappe SU4): Einleitung, Hinweis-Karten zur Einwilligung
 * (keine / alte Fassung → „Einwilligung ergänzt“ / Fassung 2 noch nicht freigegeben), Supplement-Check, Gruppen
 * „Passt zu dir“, „Zur Info“, „Ab 18 Jahren“, „Nicht für dich“, Koffein (Sicherheits-Info) und „Nicht empfohlen“
 * (eingeklappt). Alle Einordnungen kommen aus packages/core. Keine Shops, keine Links nach außen.
 */
export default function SupplementsScreen() {
  const router = useRouter();
  const app = useApp();
  const library = useSupplementLibrary();
  const view = useSupplements();
  const [showC, setShowC] = useState(false);
  const [testNote, setTestNote] = useState(false);

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
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/ernaehrung' as Href))}
      testID="supplements-back"
    />
  );
  const open = (id: string) => router.push(`/supplemente/${encodeURIComponent(id)}` as Href);

  const header = (
    <>
      <Body>{SUPP.intro}</Body>
      <Notice title={SUPP.disclaimerTitle} testID="supplements-disclaimer">
        <Body>{SUPP.disclaimer}</Body>
        {SUPPLEMENT_MANDATORY_SENTENCES_DE.map((sentence) => (
          <Body key={sentence}>{sentence}</Body>
        ))}
      </Notice>
    </>
  );

  if (library.kind !== 'ready') {
    return (
      <Screen area="ernaehrung" icon="pill" title={SUPP.title} footer={back} testID="supplements">
        {header}
        {library.kind === 'error' ? (
          <View style={{ gap: spacing.sm }}>
            <Notice tone="danger" testID="supplements-load-error">
              {SUPP.loadFailed}
            </Notice>
            <Button label={t.common.retry} onPress={library.retry} />
          </View>
        ) : (
          <LoadingState label={SUPP.loading} />
        )}
      </Screen>
    );
  }

  const recs = view.recommendations;
  const overview = recs ? supplementOverview(recs, library.entries, view.data) : null;
  const personalEnabled = view.consent === 'ok';

  return (
    <Screen area="ernaehrung" icon="pill" title={SUPP.title} footer={back} testID="supplements">
      {header}
      {library.cached ? <Notice testID="supplements-cached">{SUPP.cached}</Notice> : null}

      {/* Einwilligung (Plan 8.1, 11.1) */}
      {view.consent === 'outdated' ? (
        <Notice
          tone="warning"
          title={SUPP.consent.outdatedTitle}
          titleAsHeader
          testID="supplements-reconsent"
        >
          <Body>{SUPP.consent.outdated}</Body>
          <Button
            label={SUPP.consent.reconsent}
            onPress={() => router.push('/health-consent')}
            testID="supplements-reconsent-open"
          />
        </Notice>
      ) : view.consent === 'none' ? (
        <Notice title={SUPP.consent.noneTitle} testID="supplements-consent-none">
          <Body>{SUPP.consent.none}</Body>
          <Button
            label={SUPP.consent.grant}
            variant="secondary"
            onPress={() => router.push('/health-consent')}
            testID="supplements-consent-open"
          />
        </Notice>
      ) : view.consent === 'pending' ? (
        <Notice testID="supplements-consent-pending">{SUPP.consent.pending}</Notice>
      ) : null}

      {/* Nutzerdaten und Supplement-Check */}
      {personalEnabled && view.user.kind === 'loading' ? <LoadingState /> : null}
      {personalEnabled && view.user.kind === 'offline' ? (
        <Notice tone="warning" testID="supplements-offline">
          {SUPP.errors.offline}
        </Notice>
      ) : null}
      {personalEnabled && view.user.kind === 'error' ? (
        <Notice tone="warning" testID="supplements-user-error">
          <Body>{SUPP.errors.userData}</Body>
          <Button label={t.common.retry} variant="secondary" onPress={view.reloadUser} />
        </Notice>
      ) : null}
      {personalEnabled && view.user.kind === 'ready' && !view.hasHealthCheck ? (
        <Notice testID="supplements-health-check-first">
          <Body>{SUPP.check.healthCheckFirst}</Body>
          <Button
            label={SUPP.check.healthCheckOpen}
            variant="secondary"
            onPress={() => router.push('/onboarding/health_screening?edit=1' as Href)}
          />
        </Notice>
      ) : null}
      {personalEnabled && view.user.kind === 'ready' && view.hasHealthCheck ? (
        view.data.screening === null ? (
          <Card>
            <Heading level={2}>{SUPP.check.cardTitle}</Heading>
            <Body>{SUPP.check.cardText}</Body>
            <Button
              label={SUPP.check.start}
              onPress={() => router.push('/supplemente/check' as Href)}
              testID="supplements-check-start"
            />
          </Card>
        ) : (
          <Button
            label={SUPP.check.redo}
            variant="secondary"
            onPress={() => router.push('/supplemente/check' as Href)}
            testID="supplements-check-redo"
          />
        )
      ) : null}
      {app.backend.simulateOldHealthConsent && view.consent === 'ok' ? (
        <View style={{ gap: spacing.xs }}>
          <Button
            label={SUPP.testTools.oldConsent}
            variant="link"
            onPress={() => {
              void app.backend.simulateOldHealthConsent?.().then(async () => {
                await app.reload();
                setTestNote(true);
              });
            }}
            testID="supplements-test-old-consent"
          />
          {testNote ? <Body muted>{SUPP.testTools.oldConsentDone}</Body> : null}
        </View>
      ) : null}

      {recs === null ? (
        <Notice testID="supplements-incomplete">
          {view.rulesFailed ? SUPP.rulesFailed : SUPP.incomplete}
        </Notice>
      ) : null}
      {overview?.empty ? <Notice testID="supplements-empty">{SUPP.empty}</Notice> : null}
      {overview && !overview.personalized && !overview.empty ? (
        <Body muted testID="supplements-general">
          {SUPP.general}
        </Body>
      ) : null}
      {overview?.pageNotices.map((notice) => (
        <Notice key={notice} tone="warning" testID="supplements-page-notice">
          {notice}
        </Notice>
      ))}

      {overview && (overview.taking.length > 0 || overview.takingOutdated.length > 0) ? (
        <Card>
          <Heading level={2}>{SUPP.mine.title}</Heading>
          <View testID="supplements-mine">
            {overview.taking.map((id) => (
              <Body key={id}>
                {library.entries.find((entry) => entry.id === id)?.name_de ?? id}
              </Body>
            ))}
          </View>
          {overview.takingOutdated.length > 0 ? (
            <Notice tone="warning" testID="supplements-mine-outdated">
              <Body>{SUPP.mine.outdated}</Body>
              {overview.takingOutdated.map((id) => (
                <Body key={id}>
                  {library.entries.find((entry) => entry.id === id)?.name_de ?? id}
                </Body>
              ))}
            </Notice>
          ) : null}
        </Card>
      ) : null}

      {overview
        ? SUPPLEMENT_GROUPS.filter((group) => overview.groups[group].length > 0).map((group) => (
            <View key={group} style={{ gap: spacing.sm }} testID={`supplements-group-${group}`}>
              <SectionLabel>{groupTitle(group)}</SectionLabel>
              <Body muted>{SUPP.groupHints[group]}</Body>
              <ListGroup>
                {overview.groups[group].map((card, index, all) => (
                  <SupplementRow
                    key={card.id}
                    title={card.nameDe}
                    status={{
                      label: statusLabel(card.status),
                      icon: SUPP.statusIcon[card.status],
                      tone: statusTone(card.status),
                    }}
                    lines={[
                      card.evidence ? SUPP.evidence[card.evidence] : null,
                      doseLine(card),
                      card.timing ? SUPP.timing[card.timing] : null,
                      card.choice === 'taking'
                        ? SUPP.taking
                        : card.choice === 'not_for_me'
                          ? SUPP.declined
                          : null,
                    ]}
                    onPress={() => open(card.id)}
                    last={index === all.length - 1}
                    testID={`supplement-${card.id}`}
                  />
                ))}
              </ListGroup>
            </View>
          ))
        : null}

      {overview?.caffeine ? (
        <View style={{ gap: spacing.sm }} testID="supplements-group-caffeine">
          <SectionLabel>{SUPP.groups.caffeine}</SectionLabel>
          <Body muted>{SUPP.groupHints.caffeine}</Body>
          <ListGroup>
            <SupplementRow
              title={overview.caffeine.nameDe}
              status={{
                label: caffeineStatusLabel(overview.caffeine.status),
                icon: overview.caffeine.status === 'safety_info_excluded' ? '!' : 'i',
                tone: overview.caffeine.status === 'safety_info_excluded' ? 'warn' : 'neutral',
              }}
              lines={[]}
              onPress={() => open('caffeine')}
              last
              testID="supplement-caffeine"
            />
          </ListGroup>
        </View>
      ) : null}

      {overview && overview.notRecommended.length > 0 ? (
        <View style={{ gap: spacing.sm }} testID="supplements-group-not-recommended">
          <SectionLabel>{SUPP.groups.notRecommended}</SectionLabel>
          <Body muted>{SUPP.groupHints.notRecommended}</Body>
          <Button
            label={showC ? SUPP.hideNotRecommended : SUPP.showNotRecommended}
            variant="secondary"
            expanded={showC}
            onPress={() => setShowC((value) => !value)}
            testID="supplements-toggle-not-recommended"
          />
          {showC ? (
            <ListGroup>
              {overview.notRecommended.map((card, index, all) => (
                <SupplementRow
                  key={card.id}
                  title={card.nameDe}
                  lines={[SUPP.evidence.c]}
                  onPress={() => open(card.id)}
                  last={index === all.length - 1}
                  testID={`supplement-${card.id}`}
                />
              ))}
            </ListGroup>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
