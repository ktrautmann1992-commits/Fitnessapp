import {
  buildLiveShareText,
  buildSosText,
  clampPlannedMinutes,
  type LiveContact,
  type LiveDeviceData,
  liveDisplayNameSchema,
  type LiveSport,
  noSignOfLifeDue,
  sosLinks,
} from '@fitnessapp/core';
import { cardColors, spacing } from '@fitnessapp/ui';
import { type Href, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/design';
import { ConfirmDialog } from '@/components/screen';
import { Text } from '@/components/text';
import { Body, Button, Checkbox, ChoiceList, FieldError, Notice, TextField } from '@/components/ui';
import type { Backend } from '@/data/backend';
import {
  defaultContact,
  EMPTY_LIVE_DEVICE_DATA,
  LiveError,
  liveFor,
  readLiveDeviceData,
  writeLiveDeviceData,
} from '@/data/live-companion';
import { t } from '@/i18n';
import { appFont } from '@/lib/fonts';
import {
  askReminderPermission,
  liveCompanion,
  type LiveCompanionState,
  startLiveCompanion,
  useLiveCompanion,
} from '@/lib/live-companion';
import { recordingSession, useRecordingSession } from '@/lib/recording-session';
import { shareText } from '@/lib/share-text';
import { useColorSchemeName, useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';

const L = t.live;
const DURATIONS = [30, 45, 60, 90, 120, 180, 240] as const;
const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

/** Kontakte + Einstellungen dieses Geräts (verschlüsselt, nie auf dem Server). */
export function useLiveDeviceData(backend: Backend): {
  data: LiveDeviceData;
  loaded: boolean;
  save: (next: LiveDeviceData) => Promise<void>;
} {
  const [data, setData] = useState<LiveDeviceData>(EMPTY_LIVE_DEVICE_DATA);
  const [loaded, setLoaded] = useState(false);
  const store = liveFor(backend)?.contactsStore ?? null;
  useEffect(() => {
    let alive = true;
    if (!store) return;
    void readLiveDeviceData(store).then((value) => {
      if (!alive) return;
      setData(value);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [store]);
  const save = useCallback(
    async (next: LiveDeviceData) => {
      if (!store) throw new LiveError('unknown');
      await writeLiveDeviceData(store, next);
      setData(next);
    },
    [store],
  );
  return { data, loaded: loaded || !store, save };
}

/** Link/App öffnen (SMS, WhatsApp, Telefon, E-Mail) – senden bzw. anrufen tippt die Person dort selbst. */
async function openUrl(url: string, fallback?: string | null): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    if (!fallback) return false;
    try {
      await Linking.openURL(fallback);
      return true;
    } catch {
      return false;
    }
  }
}

/** Blatt von unten (wie das Mehr-Menü, slim.tsx) – Hintergrund antippen schließt. */
function Sheet({
  visible,
  onClose,
  title,
  children,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  testID: string;
}) {
  const theme = useThemeColors();
  const card = cardColors[useColorSchemeName()];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={L.sos.close}
          onPress={onClose}
          testID={`${testID}-backdrop`}
        />
        <View
          style={[styles.sheet, { backgroundColor: theme.surface, borderColor: card.border }]}
          accessibilityViewIsModal
          testID={testID}
        >
          <View style={[styles.grabber, { backgroundColor: card.divider }]} />
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <Text
              accessibilityRole="header"
              style={[styles.sheetTitle, appFont('extrabold'), { color: theme.text }]}
            >
              {title}
            </Text>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Namen der gewählten Kontakte („Anna und Ben“). */
function contactNames(contacts: readonly LiveContact[], ids: readonly string[]): string {
  const names = contacts.filter((c) => ids.includes(c.id)).map((c) => c.name);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} und ${names.at(-1)}`;
}

/** Letzter Punkt der laufenden Aufzeichnung (für SOS). */
function lastRecordingPoint(): { lat: number; lng: number; t: number } | null {
  const segments = recordingSession.get()?.state.segments ?? [];
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const point = segments[i]?.points.at(-1);
    if (point) return { lat: point.lat, lng: point.lng, t: point.t };
  }
  return null;
}

/**
 * Live-Begleitung und SOS im Lauf-Zustand der Aufzeichnung: ohne Begleitung der Knopf „Live-Begleitung starten“,
 * mit Begleitung das Banner „Live-Begleitung aktiv“ mit „Angekommen“ und „Beenden“ (je EIN Tipp). SOS ist immer da.
 */
export function LiveCompanionPanel({ sport }: { sport: LiveSport }) {
  const app = useApp();
  const live = useLiveCompanion();
  const device = useLiveDeviceData(app.backend);
  const [startOpen, setStartOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const now = useMinuteClock();

  if (!liveFor(app.backend)) return null;
  const open = live && (live.status === 'active' || live.status === 'paused');
  const due =
    open &&
    noSignOfLifeDue({
      startedAt: live.handle.startedAt,
      plannedMinutes: live.plannedMinutes,
      graceMin: live.noSignOfLifeMin,
      acknowledgedAt: live.ackAt,
      now,
    });

  async function close(status: 'arrived' | 'ended') {
    setBusy(true);
    await liveCompanion.setStatus(status).catch(() => undefined);
    setBusy(false);
    setNotice(status === 'arrived' ? L.closed.arrived : L.closed.ended);
  }

  async function newLink() {
    setBusy(true);
    try {
      await liveCompanion.rotate();
      setNotice(L.banner.newLinkDone);
    } catch {
      setNotice(L.sheet.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.panel} testID="live-panel">
      {due ? (
        <Notice tone="warning" title={L.reminder.title} titleAsHeader testID="live-reminder">
          {L.reminder.body}
        </Notice>
      ) : null}
      {due ? (
        <View style={styles.row}>
          <View style={styles.grow}>
            <Button
              label={L.reminder.ok}
              variant="secondary"
              onPress={() => liveCompanion.acknowledge(Date.now())}
              testID="live-reminder-ok"
            />
          </View>
          <View style={styles.grow}>
            <Button label={L.reminder.sos} variant="danger" onPress={() => setSosOpen(true)} />
          </View>
        </View>
      ) : null}
      {open ? (
        <LiveBanner
          live={live}
          contacts={device.data.contacts}
          busy={busy}
          onArrived={() => void close('arrived')}
          onEnd={() => void close('ended')}
          onShare={() => void shareLink(live)}
          onNewLink={() => void newLink()}
        />
      ) : (
        <Button
          label={L.sheet.open}
          icon="map"
          variant="secondary"
          onPress={() => {
            setNotice(undefined);
            setStartOpen(true);
          }}
          testID="live-start-open"
        />
      )}
      {notice ? (
        <Notice tone="success" testID="live-notice">
          {notice}
        </Notice>
      ) : null}
      <Button
        label={L.sos.button}
        icon="alert"
        variant="danger"
        onPress={() => setSosOpen(true)}
        accessibilityLabel={L.sos.title}
        testID="live-sos-open"
      />
      <LiveStartSheet
        visible={startOpen}
        onClose={() => setStartOpen(false)}
        sport={sport}
        device={device}
      />
      <SosSheet
        visible={sosOpen}
        onClose={() => setSosOpen(false)}
        contacts={device.data.contacts}
        liveUrl={open ? live.url : null}
      />
    </View>
  );
}

/** Uhr, die etwa alle 15 s weiterläuft (für die Erinnerung „Kein Lebenszeichen“). */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

async function shareLink(live: LiveCompanionState, message?: string | null): Promise<void> {
  const text = buildLiveShareText({
    sport: live.sport,
    url: live.url,
    plannedEnd: live.handle.plannedEndAt,
    message: message ?? null,
  });
  await shareText(text, L.sheet.shareTitle).catch(() => undefined);
}

/** Banner „Live-Begleitung aktiv · Sichtbar für Anna“ – immer sichtbar, als Live-Region angesagt. */
function LiveBanner({
  live,
  contacts,
  busy,
  onArrived,
  onEnd,
  onShare,
  onNewLink,
}: {
  live: LiveCompanionState;
  contacts: readonly LiveContact[];
  busy: boolean;
  onArrived: () => void;
  onEnd: () => void;
  onShare: () => void;
  onNewLink: () => void;
}) {
  const theme = useThemeColors();
  const names = contactNames(contacts, live.contactIds);
  const status = live.status === 'paused' ? L.banner.paused : L.banner.active;
  const who = names ? L.banner.sharedWith(names) : L.banner.sharedLink;
  return (
    <View
      style={[styles.banner, { borderColor: theme.primary, backgroundColor: theme.surface }]}
      testID="live-banner"
    >
      <View style={styles.bannerHead}>
        <Icon name="map" size={20} color={theme.primary} />
        <Text
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          accessibilityLabel={L.banner.a11y(status, who)}
          style={[styles.bannerTitle, appFont('extrabold'), { color: theme.text }]}
          testID="live-banner-status"
        >
          {status}
        </Text>
      </View>
      <Body muted>{who}</Body>
      {live.mode === 'demo' ? <Body muted>{L.sheet.demo}</Body> : null}
      {live.offline ? (
        <Notice tone="warning" testID="live-offline">
          {L.banner.offline}
        </Notice>
      ) : null}
      <View style={styles.row}>
        <View style={styles.grow}>
          <Button
            label={L.banner.arrived}
            icon="check"
            onPress={onArrived}
            disabled={busy}
            testID="live-arrived"
          />
        </View>
        <View style={styles.grow}>
          <Button
            label={L.banner.end}
            icon="stop"
            variant="secondary"
            onPress={onEnd}
            disabled={busy}
            testID="live-end"
          />
        </View>
      </View>
      <View style={styles.row}>
        <Button
          label={L.banner.shareAgain}
          icon="share"
          variant="link"
          onPress={onShare}
          testID="live-share-again"
        />
        {live.mode === 'remote' ? (
          <Button
            label={L.banner.newLink}
            variant="link"
            onPress={onNewLink}
            disabled={busy}
            testID="live-new-link"
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * Blatt „Live-Begleitung“: Kontakte antippen (nur Abkürzung fürs Teilen/SOS), Name, geplante Dauer, „Starten und
 * Link teilen“ → System-Teilen-Dialog. Danach Abkürzungen „SMS/WhatsApp/E-Mail an …“.
 */
function LiveStartSheet({
  visible,
  onClose,
  sport,
  device,
}: {
  visible: boolean;
  onClose: () => void;
  sport: LiveSport;
  device: ReturnType<typeof useLiveDeviceData>;
}) {
  const app = useApp();
  const router = useRouter();
  const live = useLiveCompanion();
  const { data } = device;
  const [selected, setSelected] = useState<string[] | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<number>(60);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [askReplace, setAskReplace] = useState(false);
  const [copied, setCopied] = useState(false);

  const fallback = defaultContact(data.contacts);
  const chosen = selected ?? (fallback ? [fallback.id] : []);
  const displayName = name ?? data.settings.displayName ?? '';
  const started = live && (live.status === 'active' || live.status === 'paused') ? live : null;

  async function start(replace: boolean) {
    const parsedName = liveDisplayNameSchema.safeParse(displayName);
    if (!parsedName.success) {
      setError(L.sheet.nameRequired);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      // Name merken (nur dieses Gerät), damit er beim nächsten Mal vorausgefüllt ist.
      if (parsedName.data !== data.settings.displayName) {
        await device
          .save({ ...data, settings: { ...data.settings, displayName: parsedName.data } })
          .catch(() => undefined);
      }
      // Erinnerung nur an die Person selbst: Erlaubnis erst nach diesem ausdrücklichen Tipp abfragen.
      if (data.settings.noSignOfLifeMin !== null) await askReminderPermission();
      const state = await startLiveCompanion({
        backend: app.backend,
        sport,
        displayName: parsedName.data,
        contactIds: chosen,
        plannedMinutes: clampPlannedMinutes(minutes),
        intervalS: data.settings.intervalS,
        noSignOfLifeMin: data.settings.noSignOfLifeMin,
        replace,
      });
      setAskReplace(false);
      await shareLink(state, data.settings.message);
    } catch (caught) {
      if (caught instanceof LiveError && caught.code === 'active' && !replace) {
        setAskReplace(true);
      } else if (caught instanceof LiveError && caught.code === 'not_signed_in') {
        setError(L.sheet.notSignedIn);
      } else {
        setError(L.sheet.failed);
      }
    } finally {
      setBusy(false);
    }
  }

  const shareTextFor = (state: LiveCompanionState) =>
    buildLiveShareText({
      sport: state.sport,
      url: state.url,
      plannedEnd: state.handle.plannedEndAt,
      message: data.settings.message,
    });

  return (
    <Sheet visible={visible} onClose={onClose} title={L.sheet.title} testID="live-start-sheet">
      {started ? (
        <>
          <Notice tone="success" testID="live-started">
            {L.banner.active}
          </Notice>
          {started.mode === 'demo' ? <Body muted>{L.sheet.demo}</Body> : null}
          <Body muted testID="live-link">
            {started.url}
          </Body>
          <Button
            label={L.sheet.share}
            icon="share"
            onPress={() => void shareLink(started, data.settings.message)}
            testID="live-share"
          />
          {Platform.OS === 'web' ? (
            <Button
              label={copied ? L.sheet.copied : L.sheet.copy}
              variant="secondary"
              onPress={() => {
                void navigator.clipboard
                  ?.writeText(shareTextFor(started))
                  .then(() => setCopied(true))
                  .catch(() => undefined);
              }}
              testID="live-copy"
            />
          ) : null}
          {data.contacts
            .filter((c) => started.contactIds.includes(c.id))
            .map((contact) => {
              const links = sosLinks({ contact, text: shareTextFor(started), platform });
              return (
                <View key={contact.id} style={styles.contactLinks}>
                  {links.sms ? (
                    <Button
                      label={L.sheet.smsTo(contact.name)}
                      variant="secondary"
                      onPress={() => void openUrl(links.sms as string)}
                    />
                  ) : null}
                  {links.whatsapp ? (
                    <Button
                      label={L.sheet.whatsappTo(contact.name)}
                      variant="secondary"
                      onPress={() =>
                        void openUrl(
                          platform === 'web'
                            ? (links.whatsappWeb as string)
                            : (links.whatsapp as string),
                          links.whatsappWeb,
                        )
                      }
                    />
                  ) : null}
                  {links.email ? (
                    <Button
                      label={L.sheet.emailTo(contact.name)}
                      variant="secondary"
                      onPress={() => void openUrl(links.email as string)}
                    />
                  ) : null}
                </View>
              );
            })}
          <Button
            label={L.sos.close}
            variant="secondary"
            onPress={onClose}
            testID="live-sheet-close"
          />
        </>
      ) : (
        <>
          <Body>{L.sheet.intro}</Body>
          <Text style={[styles.label, appFont('bold')]}>{L.sheet.contacts}</Text>
          {data.contacts.length === 0 ? <Body muted>{L.sheet.noContacts}</Body> : null}
          {data.contacts.map((contact) => (
            <Checkbox
              key={contact.id}
              label={contact.name}
              checked={chosen.includes(contact.id)}
              onChange={(on) =>
                setSelected(on ? [...chosen, contact.id] : chosen.filter((id) => id !== contact.id))
              }
              testID={`live-contact-${contact.id}`}
            />
          ))}
          <Button
            label={L.sheet.manageContacts}
            variant="link"
            onPress={() => {
              onClose();
              router.push('/notfallkontakte' as Href);
            }}
            testID="live-manage-contacts"
          />
          <TextField
            label={L.sheet.displayName}
            hint={L.contacts.displayNameHint}
            value={displayName}
            onChangeText={setName}
            maxLength={30}
            testID="live-display-name"
          />
          <ChoiceList<number>
            label={L.sheet.duration}
            options={DURATIONS.map((value) => ({ value, label: L.sheet.durations(value) }))}
            value={minutes}
            onChange={setMinutes}
            horizontal
          />
          <Notice tone="info">{L.sheet.battery}</Notice>
          {app.backend.mode === 'local' ? <Body muted>{L.sheet.demo}</Body> : null}
          <FieldError message={error} testID="live-start-error" />
          <Button
            label={L.sheet.start}
            icon="share"
            loading={busy}
            onPress={() => void start(false)}
            testID="live-start"
          />
          <Button label={L.sheet.cancel} variant="secondary" onPress={onClose} />
          <Body muted>{L.contacts.privacy}</Body>
        </>
      )}
      <ConfirmDialog
        visible={askReplace}
        title={L.sheet.replaceTitle}
        message={L.sheet.replaceText}
        confirmLabel={L.sheet.replaceYes}
        confirmVariant="primary"
        loading={busy}
        onConfirm={() => void start(true)}
        onCancel={() => setAskReplace(false)}
        testID="live-replace-dialog"
      />
    </Sheet>
  );
}

/**
 * SOS-Blatt: öffnet NUR SMS/WhatsApp/Telefon/E-Mail des Systems mit vorbereitetem Text und letztem Standort – senden
 * bzw. anrufen tippt die Person selbst. Kein automatischer Alarm. Geht auch ohne Live-Begleitung und ohne Server.
 */
export function SosSheet({
  visible,
  onClose,
  contacts,
  liveUrl,
}: {
  visible: boolean;
  onClose: () => void;
  contacts: readonly LiveContact[];
  liveUrl: string | null;
}) {
  const recording = useRecordingSession();
  const [error, setError] = useState<string>();
  // Punkt erst beim Öffnen lesen (neuester Stand).
  const point = visible && recording ? lastRecordingPoint() : null;
  const text = buildSosText({ position: point, liveUrl });
  const run = async (url: string | null, fallback?: string | null) => {
    if (!url) return;
    setError((await openUrl(url, fallback)) ? undefined : L.sos.failed);
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={L.sos.title} testID="live-sos-sheet">
      <Body>{L.sos.intro}</Body>
      {point ? null : <Body muted>{L.sos.noPosition}</Body>}
      <Button
        label={L.sos.emergency}
        variant="danger"
        icon="alert"
        onPress={() => void run(sosLinks({ contact: null, text, platform }).emergency)}
        testID="live-sos-112"
      />
      {contacts.length === 0 ? <Body muted>{L.sos.noContacts}</Body> : null}
      {contacts.map((contact) => {
        const links = sosLinks({ contact, text, platform });
        return (
          <View key={contact.id} style={styles.contactLinks} testID={`live-sos-${contact.id}`}>
            {links.sms ? (
              <Button
                label={L.sos.sms(contact.name)}
                onPress={() => void run(links.sms)}
                testID={`live-sos-sms-${contact.id}`}
              />
            ) : null}
            {links.whatsapp ? (
              <Button
                label={L.sos.whatsapp(contact.name)}
                variant="secondary"
                onPress={() =>
                  void run(
                    platform === 'web' ? links.whatsappWeb : links.whatsapp,
                    links.whatsappWeb,
                  )
                }
              />
            ) : null}
            {links.call ? (
              <Button
                label={L.sos.call(contact.name)}
                variant="secondary"
                onPress={() => void run(links.call)}
              />
            ) : null}
            {links.email ? (
              <Button
                label={L.sos.email(contact.name)}
                variant="secondary"
                onPress={() => void run(links.email)}
              />
            ) : null}
          </View>
        );
      })}
      <FieldError message={error} />
      <Notice tone="info">{`${L.emergencyHint} ${L.notEmergencyService}`}</Notice>
      <Button label={L.sos.close} variant="secondary" onPress={onClose} testID="live-sos-close" />
    </Sheet>
  );
}

/** Speichern-Schritt: Begleitung läuft noch → „Angekommen“ (ein Tipp) oder „Beenden“. */
export function LiveSaveCard() {
  const live = useLiveCompanion();
  const [busy, setBusy] = useState(false);
  if (!live || (live.status !== 'active' && live.status !== 'paused')) return null;
  const close = async (status: 'arrived' | 'ended') => {
    setBusy(true);
    await liveCompanion.setStatus(status).catch(() => undefined);
    setBusy(false);
  };
  return (
    <View style={styles.panel} testID="live-save-card">
      <Notice tone="info" title={L.save.title} titleAsHeader>
        {L.save.text}
      </Notice>
      <View style={styles.row}>
        <View style={styles.grow}>
          <Button
            label={L.banner.arrived}
            icon="check"
            onPress={() => void close('arrived')}
            disabled={busy}
            testID="live-save-arrived"
          />
        </View>
        <View style={styles.grow}>
          <Button
            label={L.banner.end}
            variant="secondary"
            onPress={() => void close('ended')}
            disabled={busy}
            testID="live-save-end"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  grow: { flexGrow: 1, flexBasis: 140 },
  banner: { borderWidth: 2, borderRadius: 16, padding: spacing.md, gap: spacing.sm },
  bannerHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerTitle: { fontSize: 18, lineHeight: 24 },
  contactLinks: { gap: spacing.xs },
  label: { fontSize: 16, lineHeight: 22 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  modalRoot: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    maxWidth: 640,
    maxHeight: '90%',
    alignSelf: 'center',
    width: '100%',
  },
  sheetContent: { gap: spacing.sm, paddingBottom: spacing.lg },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: 8 },
  sheetTitle: { fontSize: 22, lineHeight: 28 },
});
