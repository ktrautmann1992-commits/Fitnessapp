import {
  gpxFileName,
  isHikeKind,
  ROUTE_DIFFICULTIES,
  type RouteDifficulty,
  toGpx,
  TRACKED_ROUTE_LIMITS,
  type TrackedRouteRow,
  type WalkKind,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { LiveRegion } from '@/components/calendar';
import { BikeTypeChoice, useBikeChoice } from '@/components/e-bike';
import { SacGradeChoice, type SacPick, WalkKindChoice } from '@/components/hiking';
import { RouteInsights } from '@/components/route-insights';
import { ConfirmDialog, Screen } from '@/components/screen';
import {
  Button,
  Card,
  Checkbox,
  ChoiceList,
  FieldError,
  LoadingState,
  Notice,
  TextField,
} from '@/components/ui';
import { routePoints } from '@/data/endurance-rows';
import { routeById, routeFacts } from '@/data/route-view';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { decodeRouteParam } from '@/lib/route-param';
import { saveTextFile } from '@/lib/save-file';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { forgetTrackedRoutes, useTrackedRoutes } from '@/state/use-tracked-routes';

const E = t.endurance;
const D = E.detail;
const NO_POINTS: { lat: number; lng: number }[] = [];

/**
 * Auswertung je Lauf (Etappe E4, `/ausdauer/[id]`, anschaulich seit 22.10.2026): die Darstellung selbst (Kopf-Karte,
 * Tempo-Farben, Bestwerte, Kilometer-Balken, Diagramme, Pulszonen, Wetter …) steckt seit 28.10.2026 in
 * `components/route-insights.tsx` und erscheint genauso im Tagebuch-Eintrag `/log/[id]`. Hier zusätzlich die
 * Aktionen der Strecke: Bearbeiten, GPX-Datei, „Als Bild teilen“, „Erneut laufen“, „Im Tagebuch ansehen“, Löschen.
 */
export default function RouteDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = decodeRouteParam(params.id);
  const router = useRouter();
  const app = useApp();
  const { state, reload } = useTrackedRoutes();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string | null>(null);
  const [live, setLive] = useState({ text: '', version: 0 });
  const announce = (text: string) => {
    setMessage(text);
    setLive((c) => ({ text, version: c.version + 1 }));
  };

  const result = state.kind === 'ready' ? state.result : null;
  const ref = routeById(result, id ?? null);

  if (app.status.kind === 'loading' || state.kind === 'loading') {
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
  // Zurück im Stapel (keine zweite „Ausdauer“-Seite übereinander); direkt geöffnet → ersetzen.
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/ausdauer' as Href));
  const back = <Button label={D.back} variant="secondary" onPress={leave} testID="route-back" />;
  if (!ref || !result) {
    return (
      <Screen area="ausdauer" icon="run" title={D.title} footer={back} testID="route-detail">
        <Notice tone="warning" testID="route-not-found">
          {D.notFound}
        </Notice>
      </Screen>
    );
  }
  const { saved, pending } = ref;
  const facts = routeFacts(app.rows, ref);
  const { info, note, day, eBike, walkKind } = facts;
  const points = facts.polyline ? routePoints(facts.polyline) : NO_POINTS;

  async function remove() {
    if (!id) return;
    setBusy(true);
    setError(undefined);
    try {
      if (pending) await app.backend.discardPendingRoute(id);
      else await app.backend.deleteTrackedRoute(id);
      forgetTrackedRoutes();
      await reload();
      setConfirmDelete(false);
      leave();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function exportGpx() {
    try {
      const gpx = toGpx({
        name: info.name,
        sport: info.sport,
        startedAt: info.started_at,
        note,
        points,
      });
      const outcome = await saveTextFile(gpxFileName(day), gpx, 'application/gpx+xml');
      if (outcome === 'saved') announce(D.gpxSaved);
    } catch {
      announce(D.gpxFailed);
    }
  }

  return (
    <Screen area="ausdauer" icon="run" title={info.name} footer={back} testID="route-detail">
      <LiveRegion text={live.text} version={live.version} />
      {message ? (
        <Notice tone="success" testID="route-message">
          {message}
        </Notice>
      ) : null}
      {/* Volle Auswertung (geteilt mit dem Tagebuch-Eintrag /log/[id], components/route-insights.tsx). */}
      <RouteInsights
        route={ref}
        result={result}
        onRoutesChanged={async () => {
          forgetTrackedRoutes();
          await reload();
        }}
        onAnnounce={(text) => setLive((c) => ({ text, version: c.version + 1 }))}
      />

      {saved && editing ? (
        <EditRoute
          route={saved}
          eBike={eBike}
          walkKind={walkKind}
          onDone={async (text) => {
            setEditing(false);
            forgetTrackedRoutes();
            await reload();
            if (text) announce(text);
          }}
        />
      ) : null}

      <View style={styles.actions}>
        <Button
          label={D.share}
          onPress={() => router.push(`/teilen?route=${info.id}` as Href)}
          testID="route-share"
        />
        <Button
          label={D.gpx}
          variant="secondary"
          onPress={() => void exportGpx()}
          testID="route-gpx"
        />
        {saved && !editing ? (
          <Button
            label={D.edit}
            variant="secondary"
            onPress={() => setEditing(true)}
            testID="route-edit"
          />
        ) : null}
        {saved?.is_favorite && (Platform.OS !== 'web' || app.backend.mode === 'local') ? (
          <Button
            label={D.again}
            variant="secondary"
            onPress={() =>
              router.push(
                `/ausdauer/aufzeichnen?sport=${saved.sport}&base=${saved.id}${
                  isHikeKind(saved.walk_kind) ? `&walk=${saved.walk_kind}` : ''
                }${Platform.OS === 'web' ? '&demo=1' : ''}` as Href,
              )
            }
            testID="route-again"
          />
        ) : null}
        {info.session_log_id ? (
          <Button
            label={D.openLog}
            variant="secondary"
            onPress={() => router.push(`/log/${info.session_log_id}` as Href)}
            testID="route-open-log"
          />
        ) : null}
      </View>
      {/* Löschen abgesetzt am Ende (mit Rückfrage). */}
      <View style={styles.danger}>
        <Button
          label={D.delete}
          variant="danger"
          onPress={() => setConfirmDelete(true)}
          testID="route-delete"
        />
      </View>
      <FieldError message={error} />
      <ConfirmDialog
        visible={confirmDelete}
        title={D.delete}
        message={D.deleteConfirm}
        confirmLabel={D.deleteYes}
        loading={busy}
        error={error}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
        testID="route-delete-dialog"
      />
    </Screen>
  );
}

function EditRoute({
  route,
  eBike: initialEBike,
  walkKind: initialWalkKind,
  onDone,
}: {
  route: TrackedRouteRow;
  /** Aktuelle E-Bike-Angabe (verknüpfter Eintrag bzw. Strecke). */
  eBike: boolean;
  /** Aktuelle Art der Geh-Einheit (nur beim Gehen; verknüpfter Eintrag bzw. Strecke). */
  walkKind: WalkKind | null;
  onDone: (message: string | null) => Promise<void>;
}) {
  const app = useApp();
  const bikeChoice = useBikeChoice(app.session?.userId ?? null);
  const [eBike, setEBike] = useState(initialEBike);
  const [walkKind, setWalkKind] = useState<WalkKind>(initialWalkKind ?? 'walk');
  const initialSac = (route.sac_grade ?? null) as SacPick;
  const [sacPick, setSacPick] = useState<SacPick>(initialSac);
  const [name, setName] = useState(route.name);
  const [favorite, setFavorite] = useState(route.is_favorite);
  const [difficulty, setDifficulty] = useState<RouteDifficulty | 'none'>(
    route.difficulty ?? 'none',
  );
  const [note, setNote] = useState(route.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      await app.backend.updateTrackedRoute({
        id: route.id,
        name: name.trim(),
        difficulty: difficulty === 'none' ? null : difficulty,
        is_favorite: favorite,
        note: note.trim() === '' ? null : note.trim(),
        // Nur beim Rad senden (sonst fehlt das Feld = unverändert).
        ...(route.sport === 'bike' ? { e_bike: eBike } : {}),
        // Wandern (Etappe W): Art und SAC-Stufe nur beim Gehen; Gehen → null, T4+ wird nicht gespeichert.
        ...(route.sport === 'walk'
          ? {
              walk_kind: isHikeKind(walkKind) ? walkKind : null,
              sac_grade: isHikeKind(walkKind) && sacPick !== null && sacPick <= 3 ? sacPick : null,
            }
          : {}),
      });
      if (
        (route.sport === 'bike' && eBike !== initialEBike) ||
        (route.sport === 'walk' && walkKind !== (initialWalkKind ?? 'walk'))
      ) {
        if (route.sport === 'bike') bikeChoice.remember(eBike);
        // Der verknüpfte Eintrag folgt (Revision + 1) → Tagebuch neu laden.
        await app.reload().catch(() => undefined);
      }
      await onDone(D.updated);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View style={styles.actions} testID="route-edit-form">
        <TextField
          label={E.save.name}
          hint={E.save.nameHint}
          value={name}
          onChangeText={setName}
          maxLength={TRACKED_ROUTE_LIMITS.nameMaxLength}
          testID="route-edit-name"
        />
        {route.sport === 'bike' ? (
          <BikeTypeChoice eBike={eBike} onChange={setEBike} testID="route-edit-bike-type" />
        ) : null}
        {route.sport === 'walk' ? (
          <View style={styles.actions} testID="route-edit-walk-kind">
            <WalkKindChoice walkKind={walkKind} onChange={setWalkKind} />
            {isHikeKind(walkKind) ? (
              <SacGradeChoice value={sacPick} onChange={setSacPick} testID="route-edit-sac" />
            ) : null}
          </View>
        ) : null}
        <Checkbox label={E.save.favorite} checked={favorite} onChange={setFavorite} />
        <ChoiceList<RouteDifficulty | 'none'>
          label={E.save.difficulty}
          options={[
            { value: 'none', label: E.save.noDifficulty },
            ...ROUTE_DIFFICULTIES.map((value) => ({ value, label: E.save.difficulties[value] })),
          ]}
          value={difficulty}
          onChange={setDifficulty}
          horizontal
        />
        <TextField
          label={E.save.note}
          hint={E.save.noteHint}
          value={note}
          onChangeText={setNote}
          maxLength={TRACKED_ROUTE_LIMITS.noteMaxChars}
          multiline
        />
        <FieldError message={error} />
        <Button
          label={D.editSave}
          loading={busy}
          onPress={() => void save()}
          testID="route-edit-save"
        />
        <Button label={D.editCancel} variant="secondary" onPress={() => void onDone(null)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  danger: { marginTop: spacing.md },
});
