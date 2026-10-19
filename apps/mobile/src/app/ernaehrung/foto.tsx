import {
  addPhotoItem,
  changePhotoItem,
  defaultFoodLogSlot,
  FOOD_LOG_MANUAL_SLOTS,
  foodLogDateStatus,
  hasValidConsent,
  isoDateSchema,
  isValidPhotoAmount,
  matchPhotoItems,
  PHOTO_LOW_CONFIDENCE,
  photoEntries,
  photoItemKcal,
  sanitizeFoodNote,
  searchFoodLogCatalog,
  AI_FOOD_PHOTO,
  type Food,
  type FoodLogManualSlot,
  type FoodLookup,
  type FoodPhotoResponse,
  type PhotoSuggestionItem,
} from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { NutritionGate, nutritionReady } from '@/components/nutrition';
import { Screen } from '@/components/screen';
import { TestPhaseBadge } from '@/components/test-phase';
import {
  Body,
  Button,
  Card,
  ChoiceList,
  Heading,
  LoadingState,
  Notice,
  TextField,
} from '@/components/ui';
import { BackendError, type FoodPhotoStatus } from '@/data/backend';
import { newId } from '@/data/create-backend';
import { consentRecordsFromRows } from '@/data/mapping';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { examplePhoto } from '@/lib/example-photo';
import { foodLogDayText, manualSlotLabel } from '@/lib/food-log-format';
import { PHOTO_PICK_SUPPORTED, pickPhoto } from '@/lib/photo-pick';
import { useOnline } from '@/lib/use-online';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useFoodLogActions, useFoodLogDay } from '@/state/use-food-log';
import { useNutritionWeek } from '@/state/use-nutrition';

type Message = { text: string; tone: 'success' | 'danger' | 'warning' | 'info' };

type StatusState =
  | { kind: 'loading' }
  | { kind: 'error'; text: string; offline: boolean }
  | { kind: 'ready'; value: FoodPhotoStatus };

type Phase =
  | { kind: 'idle' }
  | { kind: 'analyzing' }
  | { kind: 'result'; items: PhotoSuggestionItem[]; mock: boolean }
  | { kind: 'saved'; count: number };

const SEARCH_HITS = 5;

/**
 * Ernährung → Eintragen → „Per Foto“ (Etappe E3, docs/PLAN-AUSWERTUNG.md Abschnitt 9, KONZEPT 6.4). Premium mit KI:
 * Foto (und kurze Info) → Vorschlag mit Bestandteilen aus dem Katalog → prüfen/ändern → erst „Eintragen“ schreibt ins
 * Tagebuch (Herkunft `photo`). Abbrechen speichert nichts. Das Foto wird nie gespeichert (A-G18). Alle Regeln und
 * Werte kommen aus packages/core (`matchPhotoItems`, `changePhotoItem`, `photoEntries`); Premium, Einwilligung und Limit
 * prüft der Server (Testmodus: dieselbe Kette mit der Attrappe auf dem Gerät).
 */
export default function FoodPhotoScreen() {
  const router = useRouter();
  const app = useApp();
  const params = useLocalSearchParams<{ tag?: string; platz?: string }>();
  const today = useToday();
  const online = useOnline();
  const tag = isoDateSchema.safeParse(params.tag);
  const date = tag.success && foodLogDateStatus(tag.data, today) === 'ok' ? tag.data : today;
  const [slot, setSlot] = useState<FoodLogManualSlot>(() => {
    const wanted = (FOOD_LOG_MANUAL_SLOTS as readonly string[]).find((s) => s === params.platz);
    const now = new Date();
    return (
      (wanted as FoodLogManualSlot | undefined) ??
      defaultFoodLogSlot(now.getHours() * 60 + now.getMinutes())
    );
  });
  const view = useNutritionWeek(date);
  const foodLog = useFoodLogDay(date, view.showNumbers);
  const actions = useFoodLogActions();
  const [status, setStatus] = useState<StatusState>({ kind: 'loading' });
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const { backend } = app;

  // Lädt den Stand (ohne „Laden“ zu setzen – das tun Start-Zustand bzw. „Erneut versuchen“).
  const loadStatus = useCallback(async () => {
    try {
      setStatus({ kind: 'ready', value: await backend.foodPhotoStatus() });
    } catch (error) {
      setStatus({
        kind: 'error',
        text: errorText(error),
        offline: error instanceof BackendError && error.code === 'network',
      });
    }
  }, [backend]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Stand erst NACH dem Laden setzen (asynchron)
    void loadStatus();
  }, [loadStatus]);

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
  const rows = app.rows;
  // Zurück in den Reiter „Ernährung“ (keine zweite Reiter-Instanz, Wächter M1).
  const toDay = () => router.dismissTo(`/ernaehrung?tag=${date}` as Href);
  // „Per Hand eintragen“ = zurück zu „Eintragen“ (von dort kommt man hierher), sonst dorthin ersetzen.
  const back = () =>
    router.canGoBack()
      ? router.back()
      : router.replace(`/ernaehrung/eintragen?tag=${date}` as Href);
  const manual = back;
  const shell = (children: ReactNode) => (
    <Screen
      title={t.foodPhoto.title}
      testID="food-photo"
      footer={
        <Button
          label={t.foodLog.done}
          variant="secondary"
          onPress={back}
          testID="food-photo-done"
        />
      }
    >
      <TestPhaseBadge testID="food-photo-test-phase" />
      {children}
    </Screen>
  );
  const manualButton = (
    <Button
      label={t.foodPhoto.manual}
      variant="secondary"
      onPress={manual}
      testID="food-photo-manual"
    />
  );
  const stateNotice = (text: string, tone: Message['tone'] = 'info', extra?: ReactNode) =>
    shell(
      <>
        <Notice tone={tone} testID="food-photo-state">
          {text}
        </Notice>
        {extra}
        {manualButton}
      </>,
    );

  if (!app.backend.supportsNutrition)
    return shell(<Notice tone="info">{t.foodLog.unsupported}</Notice>);
  if (!nutritionReady(view) || view.library.kind !== 'ready')
    return shell(<NutritionGate view={view} />);
  if (!foodLog.consentValid) {
    return shell(
      <Notice tone="info" testID="food-log-consent">
        <Body>{t.foodLog.consentNeeded}</Body>
        <Button
          label={t.foodLog.consentButton}
          variant="secondary"
          onPress={() => router.push('/health-consent')}
        />
      </Notice>,
    );
  }
  const foods = view.library.result.library.foods;
  const showNumbers = view.showNumbers;

  // --- Gespeichert ------------------------------------------------------------------------------------------
  if (phase.kind === 'saved') {
    return shell(
      <>
        <Notice tone="success" testID="food-photo-message">
          {t.foodPhoto.saved(phase.count)}
        </Notice>
        <Button label={t.foodPhoto.toDay} onPress={toDay} testID="food-photo-to-day" />
        <Button
          label={t.foodPhoto.again}
          variant="secondary"
          onPress={() => {
            setPhase({ kind: 'idle' });
            setNote('');
            setMessage(null);
            setStatus({ kind: 'loading' });
            void loadStatus();
          }}
          testID="food-photo-again"
        />
      </>,
    );
  }

  // --- Vorschlag prüfen und eintragen -----------------------------------------------------------------------
  if (phase.kind === 'result') {
    const items = phase.items;
    const update = (next: PhotoSuggestionItem[] | null) => {
      if (next) setPhase({ ...phase, items: next });
    };
    async function submit() {
      const built = photoEntries(items, foods, { date, slot }, rows.foodLogEntries, newId);
      if (!built.ok) {
        setMessage({
          text:
            built.reason === 'choose'
              ? t.foodPhoto.submitChooseFirst
              : built.reason === 'empty'
                ? t.foodPhoto.empty
                : built.reason === 'day_full'
                  ? t.foodPhoto.dayFull
                  : t.foodPhoto.amountInvalid,
          tone: 'warning',
        });
        return;
      }
      setBusy(true);
      setMessage(null);
      try {
        await actions.save(built.entries);
        setPhase({ kind: 'saved', count: built.entries.length });
      } catch (error) {
        setMessage({ text: errorText(error), tone: 'danger' });
      } finally {
        setBusy(false);
      }
    }
    return shell(
      <>
        <Notice tone="warning" title={t.foodPhoto.estimate} testID="food-photo-estimate">
          {t.foodPhoto.estimateText}
        </Notice>
        {phase.mock ? (
          <Body muted testID="food-photo-mock">
            {t.foodPhoto.mockBadge}
          </Body>
        ) : null}
        <Body testID="food-photo-date">{foodLogDayText(date, today)}</Body>
        <ChoiceList
          label={t.foodLog.slotQuestion}
          horizontal
          options={FOOD_LOG_MANUAL_SLOTS.map((value) => ({ value, label: manualSlotLabel(value) }))}
          value={slot}
          onChange={setSlot}
        />
        {items.length === 0 ? <Body muted>{t.foodPhoto.empty}</Body> : null}
        {items.map((item, index) => (
          <PhotoItemCard
            key={item.key}
            index={index}
            item={item}
            foods={foods}
            showNumbers={showNumbers}
            onChange={(change) => update(changePhotoItem(items, item.key, change, foods))}
          />
        ))}
        {items.length < AI_FOOD_PHOTO.maxItems ? (
          <FoodSearch
            label={t.foodPhoto.add}
            foods={foods}
            testID="food-photo-add"
            onPick={(food) => update(addPhotoItem(items, food, t.foodPhoto.addAmount))}
          />
        ) : (
          <Body muted>{t.foodPhoto.maxItems}</Body>
        )}
        {message ? (
          <Notice tone={message.tone} testID="food-photo-message">
            {message.text}
          </Notice>
        ) : null}
        <Button
          label={t.foodPhoto.submit}
          onPress={() => void submit()}
          loading={busy}
          disabled={busy || items.length === 0}
          testID="food-photo-submit"
        />
        <Button
          label={t.foodPhoto.cancel}
          variant="secondary"
          disabled={busy}
          onPress={() => {
            setPhase({ kind: 'idle' });
            setMessage({ text: t.foodPhoto.cancelled, tone: 'info' });
          }}
          testID="food-photo-cancel"
        />
      </>,
    );
  }

  // --- Zustände vor dem Foto ---------------------------------------------------------------------------------
  if (!online) return stateNotice(t.foodPhoto.offline, 'warning');
  if (status.kind === 'loading') return shell(<LoadingState />);
  if (status.kind === 'error') {
    return stateNotice(
      status.offline ? t.foodPhoto.offline : `${t.foodPhoto.loadFailed} ${status.text}`,
      'warning',
      <Button
        label={t.foodPhoto.retry}
        variant="secondary"
        onPress={() => {
          setStatus({ kind: 'loading' });
          void loadStatus();
        }}
      />,
    );
  }
  const photoStatus = status.value;
  if (photoStatus.availability === 'not_configured') return stateNotice(t.foodPhoto.notConfigured);
  if (photoStatus.availability === 'flag_off') return stateNotice(t.foodPhoto.flagOff);
  if (photoStatus.availability === 'no_entitlement') return stateNotice(t.foodPhoto.noPremium);

  const records = consentRecordsFromRows(rows.consents);
  if (!hasValidConsent(records, 'ai_food_photo', app.versions.ai_food_photo)) {
    return shell(
      <>
        <Notice tone="info" title={t.foodPhoto.consentTitle} testID="food-photo-consent">
          {t.foodPhoto.consentText}
        </Notice>
        <Button
          label={t.foodPhoto.consentRead}
          variant="link"
          onPress={() => router.push('/consent/ai_food_photo' as Href)}
          testID="food-photo-consent-read"
        />
        {message ? (
          <Notice tone={message.tone} testID="food-photo-message">
            {message.text}
          </Notice>
        ) : null}
        <Button
          label={t.foodPhoto.consentAccept}
          loading={busy}
          onPress={() => {
            setBusy(true);
            setMessage(null);
            app
              .grantConsents(['ai_food_photo'])
              .catch((error: unknown) => setMessage({ text: errorText(error), tone: 'danger' }))
              .finally(() => setBusy(false));
          }}
          testID="food-photo-consent-accept"
        />
        {manualButton}
      </>,
    );
  }

  const limit = photoStatus.limit;
  if (limit?.blocked && limit.availableFrom) {
    return stateNotice(
      limit.blocked === 'month'
        ? t.foodPhoto.limitMonth(limit.availableFrom)
        : t.foodPhoto.limitDay,
      'info',
    );
  }

  const noteCheck = sanitizeFoodNote(note);
  const noteLength = [...note.normalize('NFC')].length;

  async function analyze(bytes: Uint8Array) {
    setPhase({ kind: 'analyzing' });
    setMessage(null);
    let response: FoodPhotoResponse;
    try {
      response = await backend.analyzeFoodPhoto({
        image: bytes,
        note: note.trim() === '' ? null : note,
      });
    } catch (error) {
      setPhase({ kind: 'idle' });
      setMessage({
        text:
          error instanceof BackendError && error.code === 'network'
            ? t.foodPhoto.offline
            : errorText(error),
        tone: 'danger',
      });
      return;
    }
    if (response.code === 'ok') {
      setPhase({
        kind: 'result',
        items: matchPhotoItems(response.items, foods),
        mock: response.mock,
      });
      return;
    }
    setPhase({ kind: 'idle' });
    if (response.code === 'limit') {
      setMessage({
        text:
          response.scope === 'month'
            ? t.foodPhoto.limitMonth(response.available_from)
            : t.foodPhoto.limitDay,
        tone: 'info',
      });
    } else {
      setMessage({
        text: t.foodPhoto.errors[response.code],
        tone: response.code === 'no_food' ? 'info' : 'warning',
      });
    }
    // Kontingent neu laden (z. B. nach einem gezählten Foto ohne Essen) – ohne die Meldung zu verlieren.
    try {
      setStatus({ kind: 'ready', value: await backend.foodPhotoStatus() });
    } catch {
      // Anzeige bleibt beim letzten Stand.
    }
  }

  async function pick() {
    setMessage(null);
    const result = await pickPhoto();
    if (result.kind === 'ok') {
      await analyze(result.bytes);
    } else if (result.kind === 'unreadable') {
      setMessage({ text: t.foodPhoto.pickUnreadable, tone: 'warning' });
    } else if (result.kind === 'unsupported') {
      setMessage({ text: t.foodPhoto.nativeUnsupported, tone: 'info' });
    }
  }

  return shell(
    <>
      <Body>{t.foodPhoto.intro}</Body>
      {photoStatus.mock ? (
        <Body muted testID="food-photo-mock">
          {t.foodPhoto.mockBadge}
        </Body>
      ) : null}
      {limit ? (
        <Body testID="food-photo-remaining">
          {`${t.foodPhoto.remainingMonth(limit.remainingMonth)} · ${t.foodPhoto.remainingToday(limit.remainingToday)}`}
        </Body>
      ) : null}
      {limit?.remainingMonth === 1 ? <Body muted>{t.foodPhoto.lastOfMonth}</Body> : null}
      <Body testID="food-photo-date">{foodLogDayText(date, today)}</Body>
      <ChoiceList
        label={t.foodLog.slotQuestion}
        horizontal
        options={FOOD_LOG_MANUAL_SLOTS.map((value) => ({ value, label: manualSlotLabel(value) }))}
        value={slot}
        onChange={setSlot}
      />
      <TextField
        label={t.foodPhoto.noteLabel}
        hint={`${t.foodPhoto.noteHint} ${t.foodPhoto.noteCount(noteLength)}`}
        value={note}
        onChangeText={setNote}
        error={noteCheck.ok ? undefined : t.foodPhoto.noteTooLong}
        testID="food-photo-note"
      />
      {message ? (
        <Notice tone={message.tone} testID="food-photo-message">
          {message.text}
        </Notice>
      ) : null}
      {phase.kind === 'analyzing' ? (
        <LoadingState label={t.foodPhoto.analyzing} />
      ) : (
        <>
          {PHOTO_PICK_SUPPORTED ? (
            <Button
              label={t.foodPhoto.pick}
              disabled={!noteCheck.ok}
              onPress={() => void pick()}
              testID="food-photo-pick"
            />
          ) : (
            <Body muted>{t.foodPhoto.nativeUnsupported}</Body>
          )}
          {app.backend.mode === 'local' ? (
            <Button
              label={t.foodPhoto.pickExample}
              variant="secondary"
              disabled={!noteCheck.ok}
              onPress={() => void analyze(examplePhoto())}
              testID="food-photo-example"
            />
          ) : null}
        </>
      )}
      {manualButton}
    </>,
  );
}

/** Ein Bestandteil des Vorschlags: Lebensmittel (bzw. „Bitte auswählen“), Menge, Entfernen. */
function PhotoItemCard({
  index,
  item,
  foods,
  showNumbers,
  onChange,
}: {
  index: number;
  item: PhotoSuggestionItem;
  foods: FoodLookup;
  showNumbers: boolean;
  onChange: (change: { amountG: number } | { foodId: string } | { remove: true }) => void;
}) {
  const [amount, setAmount] = useState(String(item.amountG));
  const parsed = /^\d{1,4}$/.test(amount.trim()) ? Number(amount.trim()) : NaN;
  const amountOk = isValidPhotoAmount(parsed);
  const food = item.foodId === null ? null : (foods.get(item.foodId) ?? null);
  const name = food?.name_de ?? t.foodPhoto.choose;
  const kcal = showNumbers ? photoItemKcal(item, foods) : null;
  return (
    <Card>
      <View style={{ gap: 6 }} testID={`food-photo-item-${index}`}>
        <Heading level={2}>{name}</Heading>
        {food === null ? <Body muted>{t.foodPhoto.chooseHint(item.label)}</Body> : null}
        {item.confidence < PHOTO_LOW_CONFIDENCE && food !== null ? (
          <Body muted>{t.foodPhoto.unsure}</Body>
        ) : null}
        {food === null ? (
          <FoodSearch
            label={t.foodPhoto.searchLabel}
            foods={foods}
            testID={`food-photo-choose-${index}`}
            initial={item.label}
            onPick={(picked) => onChange({ foodId: picked.id })}
          />
        ) : null}
        <TextField
          label={t.foodPhoto.amountLabel}
          value={amount}
          keyboardType="number-pad"
          onChangeText={(text) => {
            const clean = text.replace(/[^\d]/g, '').slice(0, 4);
            setAmount(clean);
            const value = Number(clean);
            if (isValidPhotoAmount(value)) onChange({ amountG: value });
          }}
          error={amountOk ? undefined : t.foodPhoto.amountInvalid}
          testID={`food-photo-amount-${index}`}
        />
        {kcal !== null ? <Body muted>{t.foodPhoto.kcal(kcal)}</Body> : null}
        <Button
          label={t.foodPhoto.remove}
          variant="secondary"
          accessibilityLabel={t.foodPhoto.removeA11y(name)}
          onPress={() => onChange({ remove: true })}
          testID={`food-photo-remove-${index}`}
        />
      </View>
    </Card>
  );
}

/** Suche im Katalog (Lebensmittel) für „Bitte auswählen“ und „Bestandteil hinzufügen“. */
function FoodSearch({
  label,
  foods,
  testID,
  initial = '',
  onPick,
}: {
  label: string;
  foods: FoodLookup;
  testID: string;
  initial?: string;
  onPick: (food: Food) => void;
}) {
  const [query, setQuery] = useState(initial);
  const hits = searchFoodLogCatalog({ foods, recipes: [] }, query).foods.slice(0, SEARCH_HITS);
  return (
    <View style={{ gap: 4 }}>
      <TextField label={label} value={query} onChangeText={setQuery} testID={`${testID}-search`} />
      {query.trim().length >= 2 && hits.length === 0 ? (
        <Body muted>{t.foodPhoto.searchNone}</Body>
      ) : null}
      {hits.map((food, i) => (
        <Button
          key={food.id}
          label={food.name_de}
          variant="secondary"
          onPress={() => {
            onPick(food);
            setQuery('');
          }}
          testID={`${testID}-option-${i}`}
        />
      ))}
    </View>
  );
}
