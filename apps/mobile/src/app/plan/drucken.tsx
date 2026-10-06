import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { PrintPreview } from '@/components/print-preview';
import { ConfirmDialog, Screen } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  Checkbox,
  ChoiceList,
  ErrorState,
  Heading,
  LoadingState,
  Notice,
  TextField,
} from '@/components/ui';
import { activePlan } from '@/data/training-plan';
import { t } from '@/i18n';
import { todayIso } from '@/lib/format';
import { PRINT_TARGET, printHtml } from '@/lib/print-output';
import {
  buildPlanPrint,
  DEFAULT_PRINT_FORM,
  logColumnChoices,
  planPrintErrorText,
  type PrintFormState,
} from '@/lib/print-plan';
import { useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';

/**
 * Plan als PDF (docs/PLAN-PDF-EXPORT.md §3, §4, P3/P4): Hinweis bei Gesundheitsbezug, Einstellungen, Vorschau
 * (Web) und „Drucken / als PDF sichern“ – im Browser über den Druckdialog, auf iPhone/Android über expo-print.
 * Nichts wird gespeichert oder hochgeladen; Name nur im Speicher dieser Ansicht.
 */
/** Wartezeit nach dem letzten Tastendruck im Namensfeld, bevor das Dokument neu gebaut wird. */
const NAME_DEBOUNCE_MS = 300;

export default function PrintPlanScreen() {
  const router = useRouter();
  const app = useApp();
  const today = todayIso();
  const [form, setForm] = useState<PrintFormState>(DEFAULT_PRINT_FORM);
  // Dokument-Stand: Namenseingabe entprellt (Wächter K3), andere Einstellungen sofort.
  const [debouncedName, setDebouncedName] = useState(DEFAULT_PRINT_FORM.name);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedName(form.name), NAME_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [form.name]);
  const docForm = useMemo(() => ({ ...form, name: debouncedName }), [form, debouncedName]);
  const pending = form.name !== debouncedName;
  const [acknowledged, setAcknowledged] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string }>();

  const { ensureLibrary, library } = app;
  useEffect(() => {
    void ensureLibrary();
  }, [ensureLibrary]);

  const rows = app.rows;
  const active = useMemo(() => (rows ? activePlan(rows) : null), [rows]);
  const lib = library.kind === 'ready' ? library.library : null;
  const rules = app.safetyRules;
  const needsHint = active?.plan.uses_health_data === true && !acknowledged;

  // Das Dokument entsteht erst NACH dem Hinweis (§4) – und nur im Speicher.
  const result = useMemo(
    () =>
      rows && active && lib && rules && !needsHint
        ? buildPlanPrint({
            rows,
            active,
            library: lib,
            rules,
            today,
            form: docForm,
            target: PRINT_TARGET,
          })
        : null,
    [active, docForm, lib, needsHint, rows, rules, today],
  );

  const ready = result?.ok === true;
  useEffect(() => {
    if (ready) AccessibilityInfo.announceForAccessibility(t.printView.title);
  }, [ready]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/today'));

  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  const route = resolveEntryRoute({ session: app.session, rows: app.rows, versions: app.versions });
  if (route !== '/today' || !rows) {
    return <Redirect href={route as Href} />;
  }

  const footer = <Button label={t.printView.back} variant="secondary" onPress={back} />;

  if (!active) {
    return (
      <Screen title={t.printView.title} testID="print-view" footer={footer}>
        <Card>
          <Heading level={2}>{t.printView.noPlanTitle}</Heading>
          <Body muted>{t.printView.noPlanText}</Body>
        </Card>
      </Screen>
    );
  }

  if (needsHint) {
    return (
      <Screen title={t.printView.title} testID="print-view" footer={footer}>
        <ConfirmDialog
          visible
          title={t.printView.healthTitle}
          message={t.printView.healthText}
          confirmLabel={t.printView.healthConfirm}
          confirmVariant="primary"
          onConfirm={() => setAcknowledged(true)}
          onCancel={back}
        />
      </Screen>
    );
  }

  if (library.kind === 'missing') {
    return (
      <Screen title={t.printView.title} testID="print-view" footer={footer}>
        <ErrorState message={t.printView.libraryMissing} onRetry={() => void ensureLibrary()} />
      </Screen>
    );
  }

  // Ohne wirksame Sicherheitsregeln (z. B. Angaben unvollständig) kein Dokument – nie mit lockereren Regeln drucken.
  if (!rules) {
    return (
      <Screen title={t.printView.title} testID="print-view" footer={footer}>
        <Notice tone="danger" testID="print-error">
          {t.printView.rulesMissing}
        </Notice>
      </Screen>
    );
  }

  if (!result) {
    return (
      <Screen title={t.printView.title} testID="print-view" footer={footer}>
        <LoadingState label={t.printView.loading} />
      </Screen>
    );
  }

  async function print() {
    if (!result?.ok) return;
    setPrinting(true);
    setMessage(undefined);
    try {
      const outcome = await printHtml(result.html);
      if (outcome === 'cancelled') setMessage({ tone: 'info', text: t.printView.cancelled });
    } catch {
      // Keine Details ins Log (Plan-Inhalte können Gesundheitsbezug haben).
      setMessage({ tone: 'danger', text: t.printView.failed });
    } finally {
      setPrinting(false);
    }
  }

  const nameError = !result.ok && result.error === 'invalid_options' ? result.nameError : null;
  const blockingError = !result.ok && nameError === null ? planPrintErrorText(result) : null;

  // Hauptknopf unten fest sichtbar (wie „Weiter“ im Onboarding), darunter „Zurück zum Plan“.
  const printFooter = (
    <View style={{ gap: 8 }}>
      <Button
        label={t.printView.printButton}
        onPress={() => void print()}
        loading={printing}
        disabled={!result.ok || pending}
        accessibilityHint={
          PRINT_TARGET === 'web' ? t.printView.printHintWeb : t.printView.printHintNative
        }
        testID="print-button"
      />
      {footer}
    </View>
  );

  return (
    <Screen
      title={t.printView.title}
      intro={t.printView.intro}
      testID="print-view"
      footer={printFooter}
    >
      <Card>
        <Heading level={2}>{t.printView.optionsTitle}</Heading>
        <Checkbox
          label={t.printView.includeName}
          checked={form.includeName}
          onChange={(includeName) => setForm((f) => ({ ...f, includeName }))}
        />
        {form.includeName ? (
          <TextField
            label={t.printView.nameLabel}
            hint={t.printView.nameHint}
            value={form.name}
            onChangeText={(name) => setForm((f) => ({ ...f, name }))}
            autoComplete="off"
            error={nameError ?? undefined}
            testID="print-name"
          />
        ) : null}
        <ChoiceList
          label={t.printView.columnsLabel}
          options={logColumnChoices(PRINT_TARGET)}
          value={form.logColumns}
          onChange={(logColumns) => setForm((f) => ({ ...f, logColumns }))}
        />
      </Card>

      {blockingError ? (
        <Notice tone="danger" testID="print-error">
          {blockingError}
        </Notice>
      ) : null}
      {message ? (
        <Notice tone={message.tone} testID="print-message">
          {message.text}
        </Notice>
      ) : null}

      <View style={{ gap: 8 }}>
        <Body muted>
          {PRINT_TARGET === 'web' ? t.printView.printHintWeb : t.printView.printHintNative}
        </Body>
        {printing ? <LoadingState label={t.printView.printing} /> : null}
      </View>

      {result.ok && PRINT_TARGET === 'web' ? (
        <>
          <Heading level={2}>{t.printView.previewTitle}</Heading>
          <PrintPreview html={result.html} title={result.title} />
        </>
      ) : null}
    </Screen>
  );
}
