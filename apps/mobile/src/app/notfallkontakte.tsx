import {
  LIVE_COMPANION,
  liveDisplayNameSchema,
  type LivePhoneCountry,
  type LiveSettings,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ListGroup, ListRow, SectionLabel } from '@/components/design';
import { useLiveDeviceData } from '@/components/live-companion';
import { ConfirmDialog, Screen } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  Checkbox,
  ChoiceList,
  FieldError,
  LoadingState,
  Notice,
  TextField,
} from '@/components/ui';
import { newId } from '@/data/create-backend';
import { t } from '@/i18n';
import { contactFromDraft, type ContactDraft, emptyContactDraft } from '@/lib/live-contacts';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';

const L = t.live;
const C = L.contacts;

/**
 * Einstellungen → Notfallkontakte & Live-Begleitung (docs/PLAN-PHASE-10.md 21.2 Punkt 1): bis zu 3 Kontakte (Name,
 * Telefonnummer und/oder E-Mail), einer als Standard – NUR auf diesem Gerät (verschlüsselt, nie auf dem Server). Dazu
 * Anzeigename für die Begleit-Seite, eigener Text, Intervall und die „Kein Lebenszeichen“-Erinnerung (nur an die
 * Person selbst). Fester Hinweis „Im Notfall 112“.
 */
export default function EmergencyContactsScreen() {
  const app = useApp();
  const router = useRouter();
  const device = useLiveDeviceData(app.backend);
  const [draft, setDraft] = useState<ContactDraft | null>(null);
  const [fieldError, setFieldError] = useState<{ field: string; text: string } | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'warning'; text: string } | null>(
    null,
  );
  const [nameText, setNameText] = useState<string | null>(null);
  const [messageText, setMessageText] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string>();

  if (app.status.kind === 'loading' || !device.loaded) {
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

  const { data } = device;
  const contacts = data.contacts;
  const full = contacts.length >= LIVE_COMPANION.maxContacts;

  async function persist(next: typeof data, text: string) {
    try {
      await device.save(next);
      setMessage({ tone: 'success', text });
      return true;
    } catch {
      setMessage({ tone: 'warning', text: C.saveFailed });
      return false;
    }
  }

  async function saveDraft() {
    if (!draft) return;
    const result = contactFromDraft(draft, draft.id ?? newId());
    if (!result.ok) {
      setFieldError({
        field: result.field,
        text:
          result.field === 'name'
            ? C.nameMissing
            : result.field === 'email'
              ? C.emailInvalid
              : draft.phone.trim() === '' && draft.email.trim() === ''
                ? C.needOne
                : C.phoneInvalid,
      });
      return;
    }
    const contact = result.contact;
    const others = contacts
      .filter((c) => c.id !== contact.id)
      .map((c) => (contact.isDefault ? { ...c, isDefault: false } : c));
    const list = draft.id
      ? contacts.map((c) =>
          c.id === contact.id ? contact : (others.find((o) => o.id === c.id) ?? c),
        )
      : [...others, contact];
    // Genau ein Standard, wenn es Kontakte gibt.
    const withDefault = list.some((c) => c.isDefault)
      ? list
      : list.map((c, i) => (i === 0 ? { ...c, isDefault: true } : c));
    if (await persist({ ...data, contacts: withDefault }, C.saved)) {
      setDraft(null);
      setFieldError(null);
    }
  }

  async function remove(id: string) {
    const rest = contacts.filter((c) => c.id !== id);
    const list = rest.some((c) => c.isDefault)
      ? rest
      : rest.map((c, i) => (i === 0 ? { ...c, isDefault: true } : c));
    await persist({ ...data, contacts: list }, C.saved);
    setRemoveId(null);
  }

  async function saveSettings(change: Partial<LiveSettings>) {
    setSettingsError(undefined);
    await persist({ ...data, settings: { ...data.settings, ...change } }, C.saved);
  }

  async function saveTexts() {
    const nameValue = (nameText ?? data.settings.displayName ?? '').trim();
    const parsedName = nameValue === '' ? null : liveDisplayNameSchema.safeParse(nameValue);
    if (parsedName && !parsedName.success) {
      setSettingsError(L.sheet.nameRequired);
      return;
    }
    const msg = (messageText ?? data.settings.message ?? '').trim();
    await saveSettings({
      displayName: parsedName ? parsedName.data : null,
      message: msg === '' ? null : msg.slice(0, LIVE_COMPANION.messageMax),
    });
  }

  const removing = contacts.find((c) => c.id === removeId) ?? null;
  const fieldErr = (field: string) => (fieldError?.field === field ? fieldError.text : undefined);

  return (
    <Screen
      area="ausdauer"
      icon="user"
      title={C.title}
      testID="emergency-contacts"
      footer={
        <Button
          label={t.common.back}
          variant="secondary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings' as Href))}
        />
      }
    >
      <Body>{C.intro}</Body>
      <Notice
        tone="info"
        testID="emergency-hint"
      >{`${L.emergencyHint} ${L.notEmergencyService}`}</Notice>
      {message ? (
        <Notice tone={message.tone} testID="emergency-message">
          {message.text}
        </Notice>
      ) : null}

      <SectionLabel>{C.title}</SectionLabel>
      {contacts.length === 0 ? <Body muted>{C.empty}</Body> : null}
      {contacts.length > 0 ? (
        <ListGroup testID="emergency-list">
          {contacts.map((contact, index) => (
            <ListRow
              key={contact.id}
              icon="user"
              label={contact.isDefault ? `${contact.name} · ${C.defaultBadge}` : contact.name}
              description={[contact.phone, contact.email].filter(Boolean).join(' · ')}
              trailing={
                <View style={styles.rowActions}>
                  <Button
                    label={C.edit}
                    variant="link"
                    onPress={() => {
                      setFieldError(null);
                      setDraft({
                        id: contact.id,
                        name: contact.name,
                        phone: contact.phone ?? '',
                        email: contact.email ?? '',
                        country: 'DE',
                        isDefault: contact.isDefault,
                      });
                    }}
                    testID={`emergency-edit-${index}`}
                  />
                  <Button
                    label={C.remove}
                    variant="link"
                    onPress={() => setRemoveId(contact.id)}
                    testID={`emergency-remove-${index}`}
                  />
                </View>
              }
              last={index === contacts.length - 1}
              testID={`emergency-contact-${index}`}
            />
          ))}
        </ListGroup>
      ) : null}

      {draft ? (
        <Card>
          <TextField
            label={C.name}
            value={draft.name}
            onChangeText={(name) => setDraft({ ...draft, name })}
            maxLength={LIVE_COMPANION.contactNameMax}
            error={fieldErr('name')}
            testID="emergency-name"
          />
          <TextField
            label={C.phone}
            hint={C.phoneHint}
            value={draft.phone}
            onChangeText={(phone) => setDraft({ ...draft, phone })}
            keyboardType="phone-pad"
            maxLength={24}
            error={fieldErr('phone')}
            testID="emergency-phone"
          />
          <ChoiceList<LivePhoneCountry>
            label={C.country}
            options={(['DE', 'AT', 'CH'] as const).map((value) => ({
              value,
              label: C.countries[value],
            }))}
            value={draft.country}
            onChange={(country) => setDraft({ ...draft, country })}
            horizontal
          />
          <TextField
            label={C.email}
            value={draft.email}
            onChangeText={(email) => setDraft({ ...draft, email })}
            keyboardType="email-address"
            maxLength={254}
            error={fieldErr('email')}
            autoComplete="email"
            testID="emergency-email"
          />
          <Checkbox
            label={C.isDefault}
            checked={draft.isDefault}
            onChange={(isDefault) => setDraft({ ...draft, isDefault })}
            testID="emergency-default"
          />
          <Button label={C.save} onPress={() => void saveDraft()} testID="emergency-save" />
          <Button
            label={C.cancel}
            variant="secondary"
            onPress={() => {
              setDraft(null);
              setFieldError(null);
            }}
          />
        </Card>
      ) : full ? (
        <Body muted testID="emergency-full">
          {C.max(LIVE_COMPANION.maxContacts)}
        </Body>
      ) : (
        <Button
          label={C.add}
          icon="plus"
          variant="secondary"
          onPress={() => {
            setFieldError(null);
            setDraft(emptyContactDraft(contacts.length === 0));
          }}
          testID="emergency-add"
        />
      )}

      <SectionLabel>{C.settingsTitle}</SectionLabel>
      <Card>
        <TextField
          label={C.displayName}
          hint={C.displayNameHint}
          value={nameText ?? data.settings.displayName ?? ''}
          onChangeText={setNameText}
          maxLength={LIVE_COMPANION.displayNameMax}
          testID="emergency-display-name"
        />
        <TextField
          label={C.message}
          hint={C.messageHint}
          value={messageText ?? data.settings.message ?? ''}
          onChangeText={setMessageText}
          maxLength={LIVE_COMPANION.messageMax}
          multiline
          testID="emergency-message-text"
        />
        <FieldError message={settingsError} />
        <Button
          label={C.save}
          variant="secondary"
          onPress={() => void saveTexts()}
          testID="emergency-save-texts"
        />
      </Card>
      <ChoiceList<number>
        label={C.interval}
        options={LIVE_COMPANION.pushIntervalChoicesS.map((value) => ({
          value,
          label: C.intervals(value),
        }))}
        value={data.settings.intervalS}
        onChange={(intervalS) =>
          void saveSettings({ intervalS: intervalS as LiveSettings['intervalS'] })
        }
        horizontal
      />
      <Body muted>{C.intervalHint}</Body>
      <ChoiceList<number>
        label={C.reminder}
        options={[
          { value: 0, label: C.reminderOff },
          ...LIVE_COMPANION.noSignOfLifeChoicesMin.map((value) => ({
            value,
            label: C.reminderAfter(value),
          })),
        ]}
        value={data.settings.noSignOfLifeMin ?? 0}
        onChange={(value) =>
          void saveSettings({
            noSignOfLifeMin: value === 0 ? null : (value as LiveSettings['noSignOfLifeMin']),
          })
        }
        horizontal
      />
      <Body muted>{C.reminderHint}</Body>
      <Body muted>{C.privacy}</Body>

      <ConfirmDialog
        visible={removing !== null}
        title={C.remove}
        message={removing ? C.removeConfirm(removing.name) : ''}
        confirmLabel={C.remove}
        onConfirm={() => removing && void remove(removing.id)}
        onCancel={() => setRemoveId(null)}
        testID="emergency-remove-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowActions: { flexDirection: 'row', gap: spacing.xs },
});
