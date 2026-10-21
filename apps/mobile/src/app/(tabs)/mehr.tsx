import { areasInMore, type NavArea } from '@fitnessapp/core';
import { cardColors, fontSize, radius, spacing, type AreaId } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, ListGroup, ListRow, SectionLabel, Tile, type IconName } from '@/components/design';
import { Screen } from '@/components/screen';
import { LoadingState } from '@/components/ui';
import { tabLabel } from '@/components/tab-bar';
import { t } from '@/i18n';
import { NAV_AREA_STYLE } from '@/lib/area-style';
import { appFont } from '@/lib/fonts';
import { initialsFromEmail } from '@/lib/initials';
import { useColorSchemeName, useThemeColors } from '@/lib/theme';
import { useAppLayout } from '@/state/use-app-layout';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { Text } from '@/components/text';

/**
 * Reiter „Mehr“ (docs/PLAN-DASHBOARD.md 2.6; Aussehen seit 20.10.2026 wie Entwurf „Mehr neu“): oben „Mein Konto“,
 * dann Kacheln „Training & Sport“ und „Essen“, unten die Liste „Wissen & Einstellungen“. Bereiche, die schon als
 * Knopf in der Menüleiste stehen, erscheinen hier nicht noch einmal (areasInMore, packages/core). Nur Wege in
 * vorhandene Bildschirme – nichts Neues.
 */

/** Bereiche der Menüleiste je Gruppe (in dieser Reihenfolge, nur wenn sie NICHT in der Leiste sind). */
const SPORT_AREAS: readonly NavArea[] = ['wettkampf', 'fortschritt', 'workouts', 'today'];
const FOOD_AREAS: readonly NavArea[] = ['ernaehrung', 'einkaufsliste'];

interface Entry {
  key: string;
  label: string;
  detail: string;
  area: AreaId;
  icon: IconName;
  onPress: () => void;
  testID: string;
}

export default function MoreScreen() {
  const router = useRouter();
  const app = useApp();
  const { layout, available } = useAppLayout();
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
  const texts = t.more;
  const details: Record<string, string> = texts.details;
  const hidden = areasInMore(layout, available);
  const nutrition = app.backend.supportsNutrition;
  const open = (href: string) => () => router.push(href as Href);
  const hiddenOf = (areas: readonly NavArea[]): Entry[] =>
    areas
      .filter((area) => hidden.includes(area))
      .map((area) => ({
        key: area,
        label: tabLabel(area),
        detail: details[area] ?? '',
        area: NAV_AREA_STYLE[area].area,
        icon: NAV_AREA_STYLE[area].icon,
        onPress: () => router.navigate(`/${area}` as Href),
        testID: `more-area-${area}`,
      }));

  const sportAreas = hiddenOf(SPORT_AREAS);
  const sport: Entry[] = [
    // „Wettkampf“ zuerst (Gründer-Rückmeldung 20.10.2026: leicht finden).
    ...sportAreas.filter((e) => e.key === 'wettkampf'),
    // Etappe E4: Ausdauer aufzeichnen (Laufen, Rad, Gehen).
    {
      key: 'endurance',
      label: texts.endurance,
      detail: details.endurance ?? '',
      area: 'ausdauer',
      icon: 'run',
      onPress: open('/ausdauer'),
      testID: 'more-endurance',
    },
    ...sportAreas.filter((e) => e.key !== 'wettkampf'),
    {
      key: 'exercises',
      label: texts.exercises,
      detail: details.exercises ?? '',
      area: 'training',
      icon: 'dumbbell',
      onPress: open('/uebungen'),
      testID: 'more-exercises',
    },
  ];
  const food: Entry[] = [...hiddenOf(FOOD_AREAS)];
  if (nutrition) {
    food.push(
      {
        key: 'recipes',
        label: texts.recipes,
        detail: details.recipes ?? '',
        area: 'ernaehrung',
        icon: 'recipe',
        onPress: open('/rezepte'),
        testID: 'more-recipes',
      },
      {
        key: 'meal-prep',
        label: texts.mealPrep,
        detail: details.mealPrep ?? '',
        area: 'ernaehrung',
        icon: 'box',
        onPress: open('/meal-prep'),
        testID: 'more-meal-prep',
      },
    );
  }

  // Phase 6 SU4: Supplemente (Testmodus und Supabase-Modus, allgemeine Infos auch ohne Einwilligung).
  food.push({
    key: 'supplements',
    label: texts.supplements,
    detail: details.supplements ?? '',
    area: 'ernaehrung',
    icon: 'pill',
    onPress: open('/supplemente'),
    testID: 'more-supplements',
  });

  return (
    <Screen title={texts.title} testID="more">
      <AccountRow email={app.session?.email ?? null} onPress={open('/konto')} />
      <TileGroup title={texts.sections.sport} entries={sport} />
      {food.length > 0 ? <TileGroup title={texts.sections.food} entries={food} /> : null}
      <View style={styles.group}>
        <SectionLabel>{texts.sections.knowledge}</SectionLabel>
        <ListGroup>
          {nutrition ? (
            <ListRow
              icon="book"
              label={texts.guides}
              onPress={open('/ratgeber')}
              testID="more-guides"
            />
          ) : null}
          <ListRow
            icon="bar-menu"
            label={texts.menuBar}
            accessibilityHint={texts.layoutHint}
            onPress={open('/menueleiste')}
            testID="more-menu-bar"
          />
          <ListRow
            icon="settings"
            label={texts.settings}
            onPress={open('/settings')}
            testID="more-settings"
          />
          <ListRow
            icon="info"
            label={texts.licenses}
            onPress={open('/lizenzen')}
            testID="more-licenses"
            last
          />
        </ListGroup>
      </View>
    </Screen>
  );
}

/** Überschrift + Kacheln zu zweit (auch auf 320 px; Text bricht um). */
function TileGroup({ title, entries }: { title: string; entries: readonly Entry[] }) {
  return (
    <View style={styles.group}>
      <SectionLabel>{title}</SectionLabel>
      <View style={styles.grid}>
        {entries.map((entry) => (
          <View key={entry.key} style={styles.cell}>
            <Tile
              variant="stacked"
              area={entry.area}
              icon={entry.icon}
              title={entry.label}
              subtitle={entry.detail || undefined}
              role="link"
              onPress={entry.onPress}
              testID={entry.testID}
              style={styles.fill}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

/** „Mein Konto“: rundes Symbol mit Initialen (aus der E-Mail), sonst Personen-Symbol; die ganze Zeile ist ein Link. */
function AccountRow({ email, onPress }: { email: string | null; onPress: () => void }) {
  const theme = useThemeColors();
  const card = cardColors[useColorSchemeName()];
  const initials = initialsFromEmail(email);
  const texts = t.more;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${texts.account}, ${texts.accountShort}`}
      onPress={onPress}
      testID="more-account"
      style={({ pressed }) => [
        styles.account,
        { backgroundColor: theme.surface, borderColor: card.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View
        style={[styles.avatar, { backgroundColor: theme.primary }]}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {initials ? (
          <Text style={[styles.initials, appFont('extrabold'), { color: theme.primaryText }]}>
            {initials}
          </Text>
        ) : (
          <Icon name="user" size={24} color={theme.primaryText} />
        )}
      </View>
      <View style={styles.accountText}>
        <Text style={[styles.accountTitle, appFont('bold'), { color: theme.text }]}>
          {texts.account}
        </Text>
        <Text style={[styles.accountHint, appFont('regular'), { color: theme.textMuted }]}>
          {texts.accountShort}
        </Text>
      </View>
      <Icon name="chevron" color={theme.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexBasis: '46%', flexGrow: 1, minWidth: 0 },
  fill: { flexGrow: 1 },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    minHeight: 76,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 18 },
  accountText: { flex: 1, minWidth: 0, gap: 2 },
  accountTitle: { fontSize: 17 },
  accountHint: { fontSize: fontSize.xs, lineHeight: 18 },
});
