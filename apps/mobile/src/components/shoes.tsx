import { assignShoe, type ShoeMileage, shoeForActivity, shoeSportsFor } from '@fitnessapp/core';
import { fontSize, radius, spacing } from '@fitnessapp/ui';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AreaProgress } from '@/components/design';
import { ConfirmDialog } from '@/components/screen';
import { Text } from '@/components/text';
import { Badge, Body, Button, Card, ChoiceList, Heading } from '@/components/ui';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { appFont } from '@/lib/fonts';
import { shoeChipText, shoeKmText, shoeStatusText } from '@/lib/shoe-format';
import { useMinTouch } from '@/lib/accessibility';
import { useThemeColors } from '@/lib/theme';
import { useShoes } from '@/state/use-shoes';

const S = t.shoes;

/**
 * Schuh-Kilometerzähler in der App (docs/PLAN-PHASE-10.md Abschnitt 22): Kachel je Schuh mit Fortschrittsbalken,
 * Übersicht „Meine Schuhe“ im Bereich Ausdauer und der Chip „Schuh: … (… km)“ an einem Lauf. Eigene Datei, damit die
 * Seiten nur je eine Zeile brauchen. Alle Regeln aus packages/core (shoes/shoes.ts).
 */

/** Kachel eines Schuhs: Name, Marke, km, Balken bis zur Wechsel-Grenze, Hinweis in Wort und Zeichen. */
export function ShoeTile({
  item,
  children,
  testID,
}: {
  item: ShoeMileage;
  children?: React.ReactNode;
  testID?: string;
}) {
  const status = shoeStatusText(item.status);
  const km = shoeKmText(item.km);
  const limit = shoeKmText(item.replaceKm);
  return (
    <Card>
      <View style={styles.tile} testID={testID}>
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <Text style={[styles.name, appFont('semibold')]}>{item.shoe.name}</Text>
            <Body muted>
              {[item.shoe.brand, S.sports[item.shoe.sport]].filter(Boolean).join(' · ')}
            </Body>
          </View>
          <Text style={[styles.km, appFont('bold')]}>{S.km(km)}</Text>
        </View>
        <AreaProgress
          area="ausdauer"
          current={Math.min(item.km, item.replaceKm)}
          total={item.replaceKm}
          accessibilityLabel={S.progressA11y(item.shoe.name, km, limit, status)}
          testID={testID ? `${testID}-progress` : undefined}
        />
        <View style={styles.metaRow}>
          <Body testID={testID ? `${testID}-status` : undefined}>{status}</Body>
          <Body muted>{S.kmOf(km, limit)}</Body>
        </View>
        <View style={styles.badges}>
          {item.isDefault ? <Badge label={S.defaultBadge} /> : null}
          {item.retired ? <Badge label={S.retiredBadge} /> : null}
          <Body muted>
            {[
              S.runs(item.activityCount),
              item.shoe.start_km > 0 ? S.startKmNote(shoeKmText(item.shoe.start_km)) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Body>
        </View>
        {children}
      </View>
    </Card>
  );
}

/** Abschnitt „Meine Schuhe“ im Bereich Ausdauer: aktive Schuhe als Kacheln, Knopf zur Verwaltung. */
export function ShoeOverview() {
  const router = useRouter();
  const { state, mileage } = useShoes();
  if (state.kind === 'unavailable') return null;
  const active = mileage.filter((m) => !m.retired);
  return (
    <View style={styles.section} testID="shoe-overview">
      <Heading level={2}>{S.title}</Heading>
      {state.kind === 'ready' && state.result.offline ? (
        <Body muted testID="shoe-offline">
          {S.offline}
        </Body>
      ) : null}
      {state.kind === 'ready' && active.length === 0 ? (
        <Body muted testID="shoe-empty">
          {S.empty}
        </Body>
      ) : null}
      {active.map((item) => (
        <ShoeTile key={item.shoe.id} item={item} testID={`shoe-tile-${item.shoe.id}`} />
      ))}
      <Button
        label={active.length === 0 ? S.add : S.open}
        accessibilityLabel={active.length === 0 ? S.add : S.openA11y}
        variant="secondary"
        onPress={() => router.push('/ausdauer/schuhe' as Href)}
        testID="shoe-open"
      />
    </View>
  );
}

type ChipChoice = string;
const AUTO = 'auto';
const NONE = 'none';

/**
 * Chip am Lauf: „Schuh: Pegasus 41 (412 km)“ bzw. „Schuh: keiner“; Tippen öffnet die Auswahl (automatisch, ein Schuh
 * der passenden Sportart, ohne Schuh). Nur bei Laufen, Gehen und Rad.
 */
export function ShoeChip({
  routeId = null,
  logId = null,
}: {
  /** Strecke (Detailseite einer Strecke) bzw. Tagebuch-Eintrag – die Aktivität sucht der Chip selbst. */
  routeId?: string | null;
  logId?: string | null;
}) {
  const router = useRouter();
  const theme = useThemeColors();
  const minTouch = useMinTouch();
  const { state, data, mileage, save, activities } = useShoes();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<ChipChoice>(AUTO);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const activity =
    activities.find(
      (a) => (routeId !== null && a.routeId === routeId) || (logId !== null && a.logId === logId),
    ) ?? null;
  const sports = activity ? shoeSportsFor(activity.sport) : [];
  if (state.kind === 'unavailable' || activity === null || sports.length === 0 || data === null) {
    return null;
  }
  const full = activity;
  const current = shoeForActivity(data, full);
  const km = current.shoe ? (mileage.find((m) => m.shoe.id === current.shoe?.id)?.km ?? 0) : 0;
  const text = shoeChipText(current.shoe?.name ?? null, km);
  const candidates = data.shoes.filter(
    (s) =>
      (sports as readonly string[]).includes(s.sport) &&
      (s.retired_on === null || s.retired_on >= activity.day || s.id === current.shoe?.id),
  );
  const automaticName = (() => {
    const fake = { ...full, key: '__auto__', logId: null, routeId: null };
    return shoeForActivity({ ...data, assignments: [] }, fake).shoe?.name ?? null;
  })();

  function openPicker() {
    setChoice(current.source === 'chosen' ? (current.shoe ? current.shoe.id : NONE) : AUTO);
    setError(undefined);
    setOpen(true);
  }

  async function apply() {
    if (!data) return;
    const result = assignShoe(
      data,
      full,
      choice === AUTO ? 'auto' : choice === NONE ? null : choice,
    );
    if (!result.ok) {
      setError(errorText(new Error(result.error)));
      return;
    }
    setBusy(true);
    try {
      await save(result.data);
      setOpen(false);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={S.chip.a11y(text)}
        onPress={openPicker}
        testID="shoe-chip"
        style={[
          styles.chip,
          { minHeight: minTouch, borderColor: theme.border, backgroundColor: theme.surface },
        ]}
      >
        <Text style={[styles.chipText, appFont('semibold'), { color: theme.text }]}>{text}</Text>
        {current.source === 'default' ? (
          <Text style={[styles.chipNote, { color: theme.textMuted }]}>{S.chip.auto}</Text>
        ) : null}
      </Pressable>
      <ConfirmDialog
        visible={open}
        title={S.chip.title}
        message={candidates.length === 0 ? S.chip.noShoes : S.chip.text}
        confirmLabel={S.chip.save}
        confirmVariant="primary"
        loading={busy}
        error={error}
        onConfirm={() => void apply()}
        onCancel={() => setOpen(false)}
        testID="shoe-chip-dialog"
      >
        <ChoiceList<ChipChoice>
          groupLabel={S.chip.title}
          options={[
            { value: AUTO, label: S.chip.automatic(automaticName) },
            ...candidates.map((s) => ({
              value: s.id,
              label: `${s.name}${s.brand ? ` (${s.brand})` : ''}`,
            })),
            { value: NONE, label: S.chip.without },
          ]}
          value={choice}
          onChange={setChoice}
        />
        <Button
          label={S.chip.manage}
          variant="link"
          onPress={() => {
            setOpen(false);
            router.push('/ausdauer/schuhe' as Href);
          }}
          testID="shoe-chip-manage"
        />
      </ConfirmDialog>
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  tile: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.lg },
  km: { fontSize: fontSize.xl },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badges: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  chipText: { fontSize: fontSize.md, flexShrink: 1 },
  chipNote: { fontSize: fontSize.sm },
});
