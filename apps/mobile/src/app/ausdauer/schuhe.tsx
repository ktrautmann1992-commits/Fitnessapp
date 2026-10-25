import {
  currentDefaultShoe,
  deleteShoe,
  retireShoe,
  saveShoe,
  setDefaultShoe,
  type Shoe,
  type ShoeChangeResult,
  SHOE_MILEAGE,
  SHOE_SPORTS,
  type ShoeSport,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LiveRegion } from '@/components/calendar';
import { ShoeTile } from '@/components/shoes';
import { ConfirmDialog, DateInput, Screen } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  Checkbox,
  ChoiceList,
  Heading,
  LoadingState,
  Notice,
  TextField,
} from '@/components/ui';
import { newId } from '@/data/create-backend';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { berlinTodayIso, datePartsFromIso } from '@/lib/format';
import {
  type ShoeForm,
  type ShoeFormErrors,
  shoeDraftFromForm,
  shoeKmText,
} from '@/lib/shoe-format';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useShoes } from '@/state/use-shoes';

const S = t.shoes;

/**
 * „Meine Schuhe“ (docs/PLAN-PHASE-10.md Abschnitt 21): Schuhe anlegen, bearbeiten, als Standard setzen, ausmustern,
 * löschen; Kacheln mit Kilometern und Hinweis „Bald wechseln“ / „Wechsel empfohlen“. Speichern geht offline (wird
 * nachgereicht). Alle Regeln aus packages/core.
 */
export default function ShoesScreen() {
  const router = useRouter();
  const app = useApp();
  const { state, data, mileage, save, deleteAll, reload } = useShoes();
  const [editing, setEditing] = useState<{ id: string; form: ShoeForm } | null>(null);
  const [errors, setErrors] = useState<ShoeFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'warning'; text: string } | null>(
    null,
  );
  const [live, setLive] = useState({ text: '', version: 0 });
  const [confirmDelete, setConfirmDelete] = useState<Shoe | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const today = berlinTodayIso();

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
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/ausdauer' as Href));
  const back = (
    <Button label={t.racePace.back} variant="secondary" onPress={leave} testID="shoes-back" />
  );

  function announce(text: string, tone: 'success' | 'warning' = 'success') {
    setMessage({ tone, text });
    setLive((c) => ({ text, version: c.version + 1 }));
  }

  async function apply(result: ShoeChangeResult, success: string): Promise<boolean> {
    if (!result.ok) {
      announce(result.error === 'too_many' ? S.form.tooMany : t.errors.generic, 'warning');
      return false;
    }
    setBusy(true);
    try {
      const outcome = await save(result.data);
      announce(outcome === 'queued' ? S.actions.queued : success);
      return true;
    } catch (error) {
      announce(errorText(error), 'warning');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function startNew(sport: ShoeSport = 'run') {
    setErrors({});
    setMessage(null);
    setEditing({
      id: newId(),
      form: {
        name: '',
        brand: '',
        sport,
        startKm: '',
        replaceKm: '',
        since: datePartsFromIso(today),
        makeDefault: data ? currentDefaultShoe(data, sport, today) === null : true,
      },
    });
  }

  function startEdit(shoe: Shoe) {
    setErrors({});
    setMessage(null);
    setEditing({
      id: shoe.id,
      form: {
        name: shoe.name,
        brand: shoe.brand ?? '',
        sport: shoe.sport,
        startKm: shoe.start_km > 0 ? String(shoe.start_km) : '',
        replaceKm: shoe.replace_km === null ? '' : String(shoe.replace_km),
        since: datePartsFromIso(shoe.in_use_since),
        makeDefault: data ? currentDefaultShoe(data, shoe.sport, today)?.id === shoe.id : false,
      },
    });
  }

  async function submit() {
    if (!editing || !data) return;
    const parsed = shoeDraftFromForm(editing.form, editing.id, today);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    const wasDefault = currentDefaultShoe(data, parsed.draft.sport, today)?.id === editing.id;
    // Bestehender Standard bleibt Standard; „nicht mehr Standard“ setzt ab heute keinen Standard.
    let result = saveShoe(data, {
      ...parsed.draft,
      makeDefault: parsed.draft.makeDefault && !wasDefault,
    });
    if (result.ok && wasDefault && !parsed.draft.makeDefault) {
      result = setDefaultShoe(result.data, parsed.draft.sport, null, today);
    }
    if (await apply(result, S.actions.saved)) setEditing(null);
  }

  const form = editing?.form ?? null;
  const update = (patch: Partial<ShoeForm>) => {
    // Fehler eines geänderten Felds verschwinden sofort (neu geprüft wird beim Speichern).
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as keyof ShoeFormErrors];
      return next;
    });
    setEditing((current) =>
      current ? { ...current, form: { ...current.form, ...patch } } : current,
    );
  };

  // Standard-Schuh einer Sportart ausgemustert, aber andere aktive Schuhe da → Hinweis „neuen Standard wählen“.
  const missingDefault =
    data !== null &&
    SHOE_SPORTS.some(
      (sport) =>
        data.defaults.some((d) => d.sport === sport) &&
        currentDefaultShoe(data, sport, today) === null &&
        data.shoes.some((s) => s.sport === sport && s.retired_on === null),
    );

  return (
    <Screen area="ausdauer" icon="run" title={S.title} footer={back} testID="shoes">
      <LiveRegion text={live.text} version={live.version} />
      <Body>{S.intro}</Body>
      <Body muted testID="shoes-rule">
        {S.rule}
      </Body>
      {message ? (
        <Notice tone={message.tone} testID="shoes-message">
          {message.text}
        </Notice>
      ) : null}
      {state.kind === 'ready' && state.result.offline ? (
        <Notice tone="info" testID="shoes-offline">
          {S.offline}
        </Notice>
      ) : null}
      {state.kind === 'loading' ? <LoadingState /> : null}
      {state.kind === 'error' ? (
        <Notice tone="warning" title={S.loadFailed}>
          <Button label={S.retry} variant="secondary" onPress={() => void reload()} />
        </Notice>
      ) : null}
      {missingDefault ? (
        <Notice tone="info" testID="shoes-missing-default">
          {S.actions.newDefaultHint}
        </Notice>
      ) : null}

      {form && editing ? (
        <Card>
          <View style={styles.section} testID="shoe-form">
            <Heading level={2}>
              {data?.shoes.some((s) => s.id === editing.id) ? S.form.titleEdit : S.form.titleNew}
            </Heading>
            <TextField
              label={S.form.name}
              hint={S.form.nameHint}
              value={form.name}
              onChangeText={(name) => update({ name })}
              maxLength={SHOE_MILEAGE.nameMaxLength}
              error={errors.name}
              testID="shoe-form-name"
            />
            <TextField
              label={S.form.brand}
              value={form.brand}
              onChangeText={(brand) => update({ brand })}
              maxLength={SHOE_MILEAGE.brandMaxLength}
              error={errors.brand}
              testID="shoe-form-brand"
            />
            <ChoiceList<ShoeSport>
              label={S.form.sport}
              options={SHOE_SPORTS.map((value) => ({ value, label: S.sports[value] }))}
              value={form.sport}
              onChange={(sport) => update({ sport })}
            />
            <TextField
              label={S.form.startKm}
              hint={S.form.startKmHint}
              value={form.startKm}
              onChangeText={(startKm) => update({ startKm })}
              keyboardType="number-pad"
              maxLength={5}
              error={errors.startKm}
              testID="shoe-form-start-km"
            />
            <TextField
              label={S.form.replaceKm}
              hint={S.form.replaceKmHint(
                shoeKmText(SHOE_MILEAGE.replaceKm * SHOE_MILEAGE.warnShare),
              )}
              placeholder={String(SHOE_MILEAGE.replaceKm)}
              value={form.replaceKm}
              onChangeText={(replaceKm) => update({ replaceKm })}
              keyboardType="number-pad"
              maxLength={5}
              error={errors.replaceKm}
              testID="shoe-form-replace-km"
            />
            <DateInput
              label={S.form.since}
              value={form.since}
              onChange={(since) => update({ since })}
              error={errors.since}
            />
            <Checkbox
              label={S.form.makeDefault}
              checked={form.makeDefault}
              onChange={(makeDefault) => update({ makeDefault })}
              testID="shoe-form-default"
            />
            <Button
              label={S.form.save}
              onPress={() => void submit()}
              loading={busy}
              testID="shoe-form-save"
            />
            <Button
              label={S.form.cancel}
              variant="secondary"
              onPress={() => setEditing(null)}
              testID="shoe-form-cancel"
            />
          </View>
        </Card>
      ) : null}

      {state.kind === 'ready' && mileage.length === 0 && !form ? (
        <Body testID="shoes-empty">{S.empty}</Body>
      ) : null}
      {!form
        ? mileage.map((item) => (
            <ShoeTile key={item.shoe.id} item={item} testID={`shoe-${item.shoe.id}`}>
              <View style={styles.actions}>
                <Button
                  label={S.edit}
                  variant="secondary"
                  onPress={() => startEdit(item.shoe)}
                  testID={`shoe-${item.shoe.id}-edit`}
                />
                {!item.isDefault && !item.retired && data ? (
                  <Button
                    label={S.actions.makeDefault}
                    accessibilityLabel={S.actions.makeDefaultA11y(item.shoe.name)}
                    variant="secondary"
                    onPress={() =>
                      void apply(
                        setDefaultShoe(data, item.shoe.sport, item.shoe.id, today),
                        S.actions.defaultDone(item.shoe.name),
                      )
                    }
                    testID={`shoe-${item.shoe.id}-default`}
                  />
                ) : null}
                {data ? (
                  <Button
                    label={item.retired ? S.actions.unretire : S.actions.retire}
                    accessibilityLabel={
                      item.retired ? S.actions.unretire : S.actions.retireA11y(item.shoe.name)
                    }
                    variant="secondary"
                    onPress={() =>
                      void apply(
                        retireShoe(data, item.shoe.id, item.retired ? null : today),
                        item.retired ? S.actions.saved : S.actions.retiredDone(item.shoe.name),
                      )
                    }
                    testID={`shoe-${item.shoe.id}-retire`}
                  />
                ) : null}
                <Button
                  label={S.actions.delete}
                  variant="link"
                  onPress={() => setConfirmDelete(item.shoe)}
                  testID={`shoe-${item.shoe.id}-delete`}
                />
              </View>
            </ShoeTile>
          ))
        : null}

      {!form && state.kind === 'ready' ? (
        <Button label={S.add} onPress={() => startNew()} testID="shoes-add" />
      ) : null}
      {!form && (data?.shoes.length ?? 0) > 0 ? (
        <Button
          label={S.deleteAll}
          variant="danger"
          onPress={() => setConfirmDeleteAll(true)}
          testID="shoes-delete-all"
        />
      ) : null}

      <ConfirmDialog
        visible={confirmDelete !== null}
        title={S.actions.deleteTitle}
        message={S.actions.deleteText}
        confirmLabel={S.actions.deleteYes}
        loading={busy}
        onConfirm={() => {
          const shoe = confirmDelete;
          if (!shoe || !data) return;
          void apply(deleteShoe(data, shoe.id), S.actions.saved).then(() => setConfirmDelete(null));
        }}
        onCancel={() => setConfirmDelete(null)}
        testID="shoe-delete-dialog"
      />
      <ConfirmDialog
        visible={confirmDeleteAll}
        title={S.deleteAllTitle}
        message={S.deleteAllText}
        confirmLabel={S.deleteAllYes}
        loading={busy}
        onConfirm={() => {
          setBusy(true);
          deleteAll()
            .then(() => {
              setConfirmDeleteAll(false);
              announce(S.deletedAll);
            })
            .catch((error: unknown) => announce(errorText(error), 'warning'))
            .finally(() => setBusy(false));
        }}
        onCancel={() => setConfirmDeleteAll(false)}
        testID="shoes-delete-all-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
