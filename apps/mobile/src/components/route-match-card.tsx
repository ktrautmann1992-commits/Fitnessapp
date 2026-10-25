import {
  attemptCompareText,
  attemptPaceText,
  distanceText,
  formatCompareDuration,
  rankMatches,
  routeChoices,
  routeMatchInfo,
  TRACKED_ROUTE_LIMITS,
  type TrackedRouteRow,
} from '@fitnessapp/core';
import { areaColors, fontSize, radius, spacing } from '@fitnessapp/ui';
import { type ReactNode, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, SectionLabel } from '@/components/design';
import { LastTimeCard, OverlaySketch, shortDayDe, ToggleRow } from '@/components/my-routes';
import { Text } from '@/components/text';
import { Body, Button, Card, FieldError, TextField } from '@/components/ui';
import { routePoints } from '@/data/endurance-rows';
import { t } from '@/i18n';
import { appFont } from '@/lib/fonts';
import { useColorSchemeName, useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';

const R = t.endurance.routes;
const E = t.endurance;

type Message = { text: string; undo?: { favoriteId: string; restore: 'auto' | 'confirmed' } };

/**
 * Lauf-Detail (Mockup 4): Zuordnung zu „Meinen Strecken“. Vorschlag (automatisch erkannt) mit Ja / Nein / Andere
 * Strecke wählen, nach „Ja“ bzw. bei bestätigter Zuordnung „Gehört zu …“ und die dunkle Karte „Zum letzten Mal“,
 * nach „Nein“ ein Hinweis mit Rückgängig. Ohne Zuordnung: „Als neue Strecke merken“. Schreiben über das Backend
 * (set_route_match, update_tracked_route, set_route_auto_match); Regeln in packages/core.
 */
export function RouteMatchSection({
  route,
  routes,
  onChanged,
  onOpenRoute,
  onAnnounce,
}: {
  route: TrackedRouteRow;
  routes: readonly TrackedRouteRow[];
  onChanged: () => Promise<void>;
  onOpenRoute: (favoriteId: string) => void;
  onAnnounce: (text: string) => void;
}) {
  const app = useApp();
  const theme = useThemeColors();
  const scheme = useColorSchemeName();
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [remembering, setRemembering] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [error, setError] = useState<string>();
  const info = routeMatchInfo(route, routes);
  const choices = useMemo(() => routeChoices(route, routes), [route, routes]);
  const routePts = useMemo(() => routePoints(route.polyline), [route.polyline]);

  async function run(action: () => Promise<Message | null>) {
    setBusy(true);
    setError(undefined);
    try {
      const next = await action();
      await onChanged();
      setMessage(next);
      setPicking(false);
      if (next) onAnnounce(next.text);
    } catch {
      setError(R.failed);
    } finally {
      setBusy(false);
    }
  }

  const confirm = (favorite: TrackedRouteRow) =>
    void run(async () => {
      await app.backend.setRouteMatch(route.id, favorite.id, 'confirmed');
      return { text: R.confirmed(favorite.name) };
    });
  const reject = (favorite: TrackedRouteRow, restore: 'auto' | 'confirmed') =>
    void run(async () => {
      await app.backend.setRouteMatch(route.id, favorite.id, 'rejected');
      return { text: R.rejected, undo: { favoriteId: favorite.id, restore } };
    });
  const undo = (u: NonNullable<Message['undo']>) =>
    void run(async () => {
      await app.backend.setRouteMatch(route.id, u.favoriteId, 'clear');
      await app.backend.setRouteMatch(route.id, u.favoriteId, u.restore);
      return { text: R.undone };
    });

  const sport = route.sport;
  const picker = picking ? (
    <View style={styles.gap} testID="route-match-picker">
      <SectionLabel level={3}>{R.otherTitle}</SectionLabel>
      {choices.filter((c) => c.id !== info?.favorite.id).length === 0 ? (
        <Body muted>{R.otherEmpty}</Body>
      ) : (
        choices
          .filter((c) => c.id !== info?.favorite.id)
          .map((c) => (
            <Button
              key={c.id}
              variant="secondary"
              label={R.otherPick(c.name, distanceText(c.distance_m))}
              onPress={() => confirm(c)}
              disabled={busy}
              testID={`route-match-pick-${c.id}`}
            />
          ))
      )}
      {info && info.entry.matchKind !== 'favorite' ? (
        <Button
          variant="secondary"
          label={R.no}
          onPress={() =>
            reject(info.favorite, info.entry.matchKind === 'auto' ? 'auto' : 'confirmed')
          }
          disabled={busy}
          testID="route-match-picker-no"
        />
      ) : null}
      <Button variant="link" label={R.otherCancel} onPress={() => setPicking(false)} />
    </View>
  ) : null;

  const toast = message ? (
    <View
      style={[styles.toast, { backgroundColor: theme.text }]}
      testID="route-match-message"
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.toastText, { color: theme.background }]}>{message.text}</Text>
      {message.undo ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => undo(message.undo!)}
          disabled={busy}
          testID="route-match-undo"
          style={styles.toastButton}
        >
          <Text style={[styles.small, appFont('bold'), { color: theme.background }]}>{R.undo}</Text>
        </Pressable>
      ) : null}
    </View>
  ) : null;

  // Die Strecke selbst ist eine „Meine Strecke“ → nur der Weg zur Strecken-Seite.
  if (route.is_favorite) {
    return (
      <View style={styles.gap}>
        <Button
          variant="secondary"
          icon="trend"
          label={R.openRoute.replace(' →', '')}
          accessibilityLabel={R.openRouteA11y(route.name)}
          onPress={() => onOpenRoute(route.id)}
          testID="route-open-my-route"
        />
        {toast}
      </View>
    );
  }

  if (info && info.entry.matchKind === 'auto') {
    const fav = info.favorite;
    const frechet = rankMatches(route, [fav], { includeManualOnly: true })[0]?.frechetM ?? null;
    const nthText =
      sport === 'bike'
        ? R.nthBike(info.nth)
        : sport === 'walk'
          ? R.nthWalk(info.nth)
          : R.nth(info.nth);
    const prevDay = info.previous ? shortDayDe(info.previous.started_at, false) : null;
    const cmp =
      info.entry.code === 'faster' && prevDay
        ? R.fasterThan(formatCompareDuration(info.entry.diffS), prevDay)
        : info.entry.code === 'slower' && prevDay
          ? R.slowerThan(formatCompareDuration(info.entry.diffS), prevDay)
          : info.entry.code === 'same' && prevDay
            ? R.sameThan(prevDay)
            : info.entry.code === 'not_comparable'
              ? R.notComparable
              : R.firstOther;
    const paceLine = info.previous ? attemptPaceText(sport, info.previous, route) : null;
    return (
      <View style={styles.gap}>
        <SuggestionFrame>
          <View style={styles.eyebrow}>
            <Icon name="swap" size={16} color={areaColors[scheme].ausdauer.icon} />
            <Text
              style={[
                styles.eyebrowText,
                appFont('bold'),
                { color: areaColors[scheme].ausdauer.icon },
              ]}
            >
              {R.detected.toUpperCase()}
            </Text>
          </View>
          <Text
            accessibilityRole="header"
            style={[styles.title, appFont('extrabold'), { color: theme.text }]}
            testID="route-match-title"
          >
            {R.sameAs(fav.name)}
          </Text>
          <OverlaySketch today={routePts} saved={routePoints(fav.polyline)} name={fav.name} />
          <Text
            style={[styles.body, appFont('bold'), { color: theme.text }]}
            testID="route-match-summary"
          >
            {`${nthText} · ${cmp}`}
          </Text>
          <Body muted>
            {`${paceLine ? `${paceLine} · ` : ''}${frechet !== null ? R.fits(frechet) : R.fitsManual}`}
          </Body>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                label={R.yes}
                onPress={() => confirm(fav)}
                loading={busy}
                testID="route-match-yes"
              />
            </View>
            <View style={styles.flex}>
              <Button
                label={R.no}
                variant="secondary"
                onPress={() => reject(fav, 'auto')}
                disabled={busy}
                testID="route-match-no"
              />
            </View>
          </View>
          <Button
            variant="link"
            label={R.other}
            onPress={() => setPicking((p) => !p)}
            expanded={picking}
            testID="route-match-other"
          />
          {picker}
          <FieldError message={error} />
        </SuggestionFrame>
        {toast}
      </View>
    );
  }

  if (info) {
    const fav = info.favorite;
    return (
      <View style={styles.gap}>
        <View
          style={[styles.belongs, { backgroundColor: areaColors[scheme].ernaehrung.surface }]}
          testID="route-match-belongs"
        >
          <Icon name="check" size={18} color={areaColors[scheme].ernaehrung.icon} />
          <Text style={[styles.belongsText, appFont('bold'), { color: theme.text }]}>
            {R.belongsTo(fav.name)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={R.changeA11y(fav.name)}
            onPress={() => setPicking((p) => !p)}
            testID="route-match-change"
            style={styles.changeButton}
          >
            <Text style={[styles.body, appFont('bold'), { color: theme.primary }]}>{R.change}</Text>
          </Pressable>
        </View>
        {picker}
        {info.previous ? (
          <LastTimeCard
            title={R.lastTime(shortDayDe(info.previous.started_at, false))}
            headline={attemptCompareText(info.entry)}
            sport={sport}
            previous={info.previous}
            current={route}
          >
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={R.openRouteA11y(fav.name)}
              onPress={() => onOpenRoute(fav.id)}
              testID="route-open-my-route"
            >
              <Text
                style={[styles.body, appFont('bold'), { color: areaColors.dark.ausdauer.icon }]}
              >
                {R.openRoute}
              </Text>
            </Pressable>
          </LastTimeCard>
        ) : (
          <Card>
            <Body testID="route-compare">{attemptCompareText(info.entry)}</Body>
            <Button
              variant="link"
              label={R.openRoute}
              accessibilityLabel={R.openRouteA11y(fav.name)}
              onPress={() => onOpenRoute(fav.id)}
              testID="route-open-my-route"
            />
          </Card>
        )}
        <FieldError message={error} />
        {toast}
      </View>
    );
  }

  // Ohne Zuordnung.
  return (
    <View style={styles.gap}>
      {remembering ? (
        <RememberRoute
          route={route}
          onDone={async (text) => {
            setRemembering(false);
            if (text) {
              await onChanged();
              setMessage({ text });
              onAnnounce(text);
            }
          }}
        />
      ) : (
        <Card>
          <View style={styles.gap} testID="route-match-none">
            <Body>{R.none}</Body>
            <Button
              variant="secondary"
              icon="plus"
              label={R.remember}
              onPress={() => setRemembering(true)}
              testID="route-remember"
            />
            {choices.length > 0 ? (
              <Button
                variant="link"
                label={R.other}
                onPress={() => setPicking((p) => !p)}
                expanded={picking}
                testID="route-match-other"
              />
            ) : null}
            {picker}
            <FieldError message={error} />
          </View>
        </Card>
      )}
      {toast}
    </View>
  );
}

function SuggestionFrame({ children }: { children: ReactNode }) {
  const theme = useThemeColors();
  const palette = areaColors[useColorSchemeName()].ausdauer;
  return (
    <View
      style={[styles.frame, { borderColor: palette.strong, backgroundColor: theme.surface }]}
      testID="route-match-suggestion"
    >
      {children}
    </View>
  );
}

/** „Als Meine Strecke merken“: Name, Vorschläge, Schalter „automatisch zuordnen“, Hinweis „privat“. */
export function RememberRoute({
  route,
  onDone,
}: {
  route: TrackedRouteRow;
  onDone: (message: string | null) => Promise<void>;
}) {
  const app = useApp();
  const theme = useThemeColors();
  const [name, setName] = useState(route.name);
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const sport = route.e_bike ? E.eBike.sport : E.sports[route.sport];

  async function save() {
    const trimmed = name.trim();
    if (trimmed === '') {
      setError(E.save.nameHint);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await app.backend.updateTrackedRoute({
        id: route.id,
        name: trimmed,
        difficulty: route.difficulty,
        is_favorite: true,
        note: route.note,
      });
      if (!auto) await app.backend.setRouteAutoMatch(route.id, false);
      await onDone(R.remembered(trimmed));
    } catch {
      setError(R.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View style={styles.gap} testID="route-remember-form">
        <SectionLabel>{R.rememberTitle}</SectionLabel>
        <Body muted>
          {R.rememberIntro(shortDayDe(route.started_at), distanceText(route.distance_m), sport)}
        </Body>
        <TextField
          label={R.name}
          value={name}
          onChangeText={setName}
          maxLength={TRACKED_ROUTE_LIMITS.nameMaxLength}
          testID="route-remember-name"
        />
        <View style={styles.chips} accessibilityLabel={R.nameSuggestions}>
          {R.suggestions.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="button"
              onPress={() => setName(s)}
              style={[styles.chip, { borderColor: theme.border }]}
            >
              <Text style={[styles.small, { color: theme.text }]}>{s}</Text>
            </Pressable>
          ))}
        </View>
        <ToggleRow
          label={R.autoAssign}
          value={auto}
          onChange={setAuto}
          testID="route-remember-auto"
        />
        <Body muted>{R.privacy}</Body>
        <FieldError message={error} />
        <Button
          label={R.rememberSave}
          onPress={() => void save()}
          loading={busy}
          testID="route-remember-save"
        />
        <Button variant="link" label={R.rememberCancel} onPress={() => void onDone(null)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  frame: { borderWidth: 2, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrowText: { fontSize: fontSize.xs, letterSpacing: 0.8 },
  title: { fontSize: fontSize.lg, lineHeight: 26 },
  body: { fontSize: fontSize.md },
  small: { fontSize: fontSize.sm },
  belongs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  belongsText: { flex: 1, fontSize: fontSize.md },
  changeButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toastText: { flex: 1, fontSize: fontSize.sm },
  toastButton: { minHeight: 44, justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    minHeight: 36,
    justifyContent: 'center',
  },
});
