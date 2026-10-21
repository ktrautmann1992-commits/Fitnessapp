import {
  createSupplementScreeningAnswersSchema,
  PROTEIN_SELF_CHECK_QUESTION_DE,
  type ProteinSelfCheckAnswer,
  type SupplementFlag,
  supplementScreeningQuestionsFor,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Button, ChoiceList, FieldError, LoadingState, Notice } from '@/components/ui';
import { errorCode } from '@/data/backend';
import { t } from '@/i18n';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useSupplements } from '@/state/use-supplements';

const SUPP = t.supplements;
type ProteinChoice = ProteinSelfCheckAnswer | 'skip';

/**
 * Supplement-Check (docs/PLAN-PHASE-6.md 3.4, 8.1): die Zusatzfragen aus packages/core (Stillzeit nicht bei
 * „männlich“), optional die Eiweiß-Selbsteinschätzung, vorher die Erklärung, wofür die Antworten dienen. Speichern nur
 * mit Einwilligung Fassung 2 (prüft auch der Speicherort). Antworten jederzeit änderbar oder löschbar.
 */
export default function SupplementCheckScreen() {
  const router = useRouter();
  const app = useApp();
  const view = useSupplements();
  // null = noch nichts geändert → gespeicherte Antworten anzeigen (ohne Effekt, direkt beim Rendern abgeleitet).
  const [edited, setAnswers] = useState<Partial<Record<SupplementFlag, boolean>> | null>(null);
  const [editedProtein, setProtein] = useState<ProteinChoice | null>(null);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const screening = view.data.screening;
  const { protein_self_check: storedProtein, ...storedAnswers } = screening?.answers ?? {};
  const answers: Partial<Record<SupplementFlag, boolean>> = edited ?? storedAnswers;
  const protein: ProteinChoice =
    editedProtein ?? (storedProtein as ProteinSelfCheckAnswer | undefined) ?? 'skip';

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
  if (route !== HOME_ROUTE || !app.rows?.profile) {
    return <Redirect href={route as Href} />;
  }
  const close = () => (router.canGoBack() ? router.back() : router.replace('/supplemente' as Href));
  const back = (
    <Button label={SUPP.detail.back} variant="secondary" onPress={close} disabled={saving} />
  );
  if (view.consent !== 'ok' || !view.hasHealthCheck) {
    return (
      <Screen area="ernaehrung" icon="pill" title={SUPP.check.title} footer={back}>
        <Notice testID="supplement-check-unavailable">
          {view.consent === 'ok'
            ? SUPP.check.healthCheckFirst
            : view.consent === 'pending'
              ? SUPP.consent.pending
              : view.consent === 'outdated'
                ? SUPP.consent.outdated
                : SUPP.consent.none}
        </Notice>
      </Screen>
    );
  }
  const sex = app.rows.profile.sex;
  const questions = supplementScreeningQuestionsFor(sex);

  async function save() {
    const candidate = {
      ...Object.fromEntries(questions.map((q) => [q.id, answers[q.id]])),
      ...(protein === 'skip' ? {} : { protein_self_check: protein }),
    };
    const parsed = createSupplementScreeningAnswersSchema(sex).safeParse(candidate);
    if (!parsed.success) {
      setError(SUPP.check.missing);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await view.saveScreening(parsed.data);
      // Zurück zur Übersicht (kein zweiter Bildschirm im Stapel).
      close();
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

  async function remove() {
    setSaving(true);
    setError(undefined);
    try {
      await view.deleteAll();
      setAnswers({});
      setProtein('skip');
      setDeleted(true);
    } catch (caught) {
      setError(errorCode(caught) === 'network' ? SUPP.errors.saveOffline : SUPP.errors.save);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      area="ernaehrung"
      icon="pill"
      title={SUPP.check.title}
      testID="supplement-check"
      footer={
        <View style={{ gap: spacing.sm }}>
          <FieldError message={error} testID="supplement-check-error" />
          <Button
            label={SUPP.check.save}
            onPress={() => void save()}
            loading={saving}
            testID="supplement-check-save"
          />
          {back}
        </View>
      }
    >
      <Body>{SUPP.check.intro}</Body>
      {view.user.kind === 'loading' ? <LoadingState /> : null}
      {view.user.kind === 'offline' ? <Notice tone="warning">{SUPP.errors.offline}</Notice> : null}
      {questions.map((question) => (
        <ChoiceList
          key={question.id}
          label={question.textDe}
          horizontal
          value={answers[question.id] === undefined ? null : answers[question.id] ? 'yes' : 'no'}
          onChange={(value) => setAnswers({ ...answers, [question.id]: value === 'yes' })}
          options={[
            { value: 'yes', label: SUPP.check.yes, testID: `supplement-check-${question.id}-yes` },
            { value: 'no', label: SUPP.check.no, testID: `supplement-check-${question.id}-no` },
          ]}
        />
      ))}
      <ChoiceList<ProteinChoice>
        label={`${SUPP.check.proteinTitle}: ${PROTEIN_SELF_CHECK_QUESTION_DE}`}
        value={protein}
        onChange={setProtein}
        options={[
          {
            value: 'mostly_yes',
            label: SUPP.check.proteinYes,
            testID: 'supplement-check-protein-yes',
          },
          {
            value: 'rather_not',
            label: SUPP.check.proteinNo,
            testID: 'supplement-check-protein-no',
          },
          { value: 'skip', label: SUPP.check.proteinSkip, testID: 'supplement-check-protein-skip' },
        ]}
      />
      {screening !== null || deleted ? (
        <View style={{ gap: spacing.xs }}>
          <Button
            label={SUPP.check.delete}
            variant="danger"
            onPress={() => void remove()}
            disabled={saving || deleted}
            testID="supplement-check-delete"
          />
          {deleted ? <Body muted>{SUPP.check.deleted}</Body> : null}
        </View>
      ) : null}
    </Screen>
  );
}
