import {
  activePainEpisodes,
  addDays,
  adviceForNewEpisode,
  BODY_REGIONS,
  type BodyRegion,
  lastActiveDay,
  PAIN_INTENSITIES,
  PAIN_MODE,
  painAdviceReasons,
  type PainEpisode,
  type PainIntensity,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConfirmDialog, Screen } from '@/components/screen';
import { BodyMap } from '@/components/training-modes';
import { Body, Button, Card, ChoiceList, Heading, LoadingState, Notice } from '@/components/ui';
import { TrainingModesError } from '@/data/training-modes';
import { t } from '@/i18n';
import { deModes as M } from '@/i18n/de-training-modes';
import { errorText } from '@/lib/error-text';
import { formatDateDe } from '@/lib/format';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useTrainingModes } from '@/state/use-training-modes';

/**
 * Schmerz-/Verletzungsmodus (docs/PLAN-TRAINING-MODI.md 3): Körperkarte (vorn/hinten, antippbar) mit Liste als
 * Alternative, Stärke, Dauer; laufende Einträge beenden, Verlauf löschen. Gesundheitsdaten – nur mit Einwilligung
 * „Gesundheitsdaten“ (Fassung ≥ 2). Keine Diagnose, kein Freitext. Regeln und Arzt-Hinweis aus packages/core.
 */
export default function PainModeScreen() {
  const router = useRouter();
  const app = useApp();
  const modes = useTrainingModes();
  const [region, setRegion] = useState<BodyRegion | null>(null);
  const [intensity, setIntensity] = useState<PainIntensity | null>(null);
  const [duration, setDuration] = useState<3 | 7 | 14 | null>(null);
  const [errors, setErrors] = useState<{ region?: string; intensity?: string; duration?: string }>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
  const back = () => (router.canGoBack() ? router.back() : router.replace('/today' as Href));
  const today = modes.today;
  const state = modes.state;
  const episodes = state?.pain ?? [];
  const active = activePainEpisodes(episodes, today);
  const advice = painAdviceReasons(episodes, today);
  const past = episodes
    .filter((e) => !active.includes(e) && lastActiveDay(e) !== null)
    .sort((a, b) => b.started_on.localeCompare(a.started_on));
  const preview =
    region && intensity && duration
      ? adviceForNewEpisode(
          episodes,
          { region, intensity, duration_days: duration, started_on: today },
          today,
        )
      : [];

  function failText(error: unknown): string {
    if (error instanceof TrainingModesError) {
      if (error.code === 'consent_missing') return M.pain.consentBody;
      if (error.code === 'network') return t.plan.offline;
    }
    return errorText(error);
  }

  async function start() {
    const next: typeof errors = {};
    if (!region) next.region = M.pain.regionRequired;
    if (!intensity) next.intensity = M.pain.intensityRequired;
    if (!duration) next.duration = M.pain.durationRequired;
    setErrors(next);
    if (!region || !intensity || !duration) return;
    setBusy(true);
    setMessage(null);
    try {
      await modes.addPain({ region, intensity, duration_days: duration, started_on: today });
      setMessage({
        tone: 'success',
        text: M.pain.saved(M.regions[region], formatDateDe(addDays(today, duration - 1))),
      });
      setRegion(null);
      setIntensity(null);
      setDuration(null);
    } catch (error) {
      setMessage({ tone: 'danger', text: failText(error) });
    } finally {
      setBusy(false);
    }
  }

  async function end(episode: PainEpisode) {
    setBusy(true);
    setMessage(null);
    try {
      await modes.endPain(episode.id);
      setMessage({ tone: 'success', text: M.pain.ended });
    } catch (error) {
      setMessage({ tone: 'danger', text: failText(error) });
    } finally {
      setBusy(false);
    }
  }

  async function deleteAll() {
    setBusy(true);
    try {
      await modes.deleteAllPain();
      setConfirmDelete(false);
      setMessage({ tone: 'success', text: M.pain.deleted });
    } catch (error) {
      setConfirmDelete(false);
      setMessage({ tone: 'danger', text: failText(error) });
    } finally {
      setBusy(false);
    }
  }

  const footer = <Button label={t.common.back} variant="secondary" onPress={back} />;

  return (
    <Screen
      area="training"
      icon="alert"
      title={M.pain.title}
      intro={M.pain.intro}
      testID="pain-mode"
      footer={footer}
    >
      <Notice tone="info" testID="pain-disclaimer">
        <Body>{M.pain.disclaimer}</Body>
        <Body>{M.pain.stopRule}</Body>
      </Notice>

      {modes.load.kind === 'loading' ? <LoadingState /> : null}
      {modes.load.kind === 'ready' && modes.load.offline ? (
        <Notice tone="warning">{t.plan.offline}</Notice>
      ) : null}

      {advice.length > 0 ? (
        <Notice tone="warning" title={M.pain.adviceTitle} testID="pain-advice">
          {advice.map((reason) => (
            <Body key={reason}>{M.pain.advice[reason]}</Body>
          ))}
          <Body>{M.pain.adviceBody}</Body>
          <Body>{M.pain.adviceEmergency}</Body>
        </Notice>
      ) : null}

      {message ? (
        <Notice tone={message.tone === 'success' ? 'success' : 'danger'} testID="pain-message">
          {message.text}
        </Notice>
      ) : null}

      {active.length > 0 ? (
        <Card>
          <Heading level={2}>{M.pain.activeTitle}</Heading>
          {active.map((e) => (
            <View key={e.id} style={styles.row} testID="pain-active">
              <Body>
                {M.pain.activeLine(
                  M.regions[e.region],
                  M.intensities[e.intensity],
                  formatDateDe(lastActiveDay(e) as string),
                )}
              </Body>
              <Button
                label={M.pain.end}
                variant="secondary"
                accessibilityLabel={M.pain.endA11y(M.regions[e.region])}
                onPress={() => void end(e)}
                disabled={busy}
                testID={`pain-end-${e.region}`}
              />
            </View>
          ))}
          <Body muted>{M.pain.replaceHint}</Body>
        </Card>
      ) : null}

      {!modes.painConsent ? (
        <Notice tone="info" title={M.pain.consentTitle} testID="pain-consent">
          <Body>{modes.painConsentPending ? M.pain.consentPending : M.pain.consentBody}</Body>
          {modes.painConsentPending ? null : (
            <Button
              label={M.pain.consentButton}
              variant="secondary"
              onPress={() => router.push('/health-consent' as Href)}
              testID="pain-consent-open"
            />
          )}
        </Notice>
      ) : (
        <Card>
          <Heading level={2}>{M.pain.mapTitle}</Heading>
          <BodyMap value={region} onChange={(r) => setRegion(r)} />
          <ChoiceList<BodyRegion>
            label={M.pain.listLabel}
            options={BODY_REGIONS.map((r) => ({
              value: r,
              label: M.regions[r],
              testID: `pain-region-${r}`,
            }))}
            value={region}
            onChange={setRegion}
            error={errors.region}
            horizontal
          />
          <ChoiceList<PainIntensity>
            label={M.pain.intensityLabel}
            options={PAIN_INTENSITIES.map((i) => ({
              value: i,
              label: M.intensities[i],
              description: M.intensityHints[i],
              testID: `pain-intensity-${i}`,
            }))}
            value={intensity}
            onChange={setIntensity}
            error={errors.intensity}
          />
          <ChoiceList<3 | 7 | 14>
            label={M.pain.durationLabel}
            options={PAIN_MODE.durationsDays.map((d) => ({
              value: d,
              label: M.pain.days(d),
              testID: `pain-duration-${d}`,
            }))}
            value={duration}
            onChange={setDuration}
            error={errors.duration}
            horizontal
          />
          {preview.length > 0 ? (
            <Notice tone="warning" title={M.pain.adviceTitle} testID="pain-preview-advice">
              {preview.map((reason) => (
                <Body key={reason}>{M.pain.advice[reason]}</Body>
              ))}
              <Body>{M.pain.previewAdvice}</Body>
            </Notice>
          ) : null}
          <Button
            label={M.pain.start}
            onPress={() => void start()}
            loading={busy}
            testID="pain-start"
          />
          <Body muted>{M.pain.privacy}</Body>
        </Card>
      )}

      <Card>
        <Heading level={2}>{M.pain.historyTitle}</Heading>
        {past.length === 0 ? (
          <Body muted testID="pain-history-empty">
            {M.pain.historyEmpty}
          </Body>
        ) : (
          past.map((e) => (
            <Body key={e.id} testID="pain-history-item">
              {M.pain.historyLine(
                M.regions[e.region],
                M.intensities[e.intensity],
                formatDateDe(e.started_on),
                formatDateDe(lastActiveDay(e) as string),
              )}
            </Body>
          ))
        )}
        <Body muted>{M.pain.historyNote}</Body>
        {episodes.length > 0 ? (
          <Button
            label={M.pain.deleteAll}
            variant="danger"
            onPress={() => setConfirmDelete(true)}
            disabled={busy}
            testID="pain-delete-all"
          />
        ) : null}
      </Card>

      <ConfirmDialog
        visible={confirmDelete}
        title={M.pain.deleteAllTitle}
        message={M.pain.deleteAllBody}
        confirmLabel={M.pain.deleteAll}
        onConfirm={() => void deleteAll()}
        onCancel={() => setConfirmDelete(false)}
        loading={busy}
        testID="pain-delete-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs },
});
