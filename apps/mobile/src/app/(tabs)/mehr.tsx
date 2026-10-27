import { areasInMore, cycleModuleOffered, type NavArea } from '@fitnessapp/core';
import { cardColors, fontSize, radius, spacing, type AreaId } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useCycleVisible } from '@/components/cycle-entry';
import { Icon, ListGroup, ListRow, SectionLabel, Tile, type IconName } from '@/components/design';
import { Screen } from '@/components/screen';
import { LoadingState } from '@/components/ui';
import { tabLabel } from '@/components/tab-bar';
import { t } from '@/i18n';
import { deCycle } from '@/i18n/de-cycle';
import { NAV_AREA_STYLE } from '@/lib/area-style';
import { appFont } from '@/lib/fonts';
import { initialsFromEmail } from '@/lib/initials';
import { useColorSchemeName, useThemeColors } from '@/lib/theme';
import { useAppLayout } from '@/state/use-app-layout';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { Text } from '@/components/text';

/**
 * Reiter „Mehr“ („App verschlanken“, Gründer-Freigabe 26.10.2026, Entwurf 5-mehr-fortschritt): oben „Mein Konto“,
 * dann bunte Kacheln nach Themen – „Dein Fortschritt“ (Fortschritt, Kalender), „Sport“ (Wettkampf, Ausdauer,
 * Calisthenics), „Essen & Wissen“ (Rezepte, Supplemente, Ratgeber, Zyklus) – und unten drei Zeilen: Einstellungen,
 * Menüleiste & Kacheln anpassen, Lizenzen. Bereiche, die als Knopf in der Menüleiste stehen, erscheinen hier nicht
 * noch einmal (areasInMore, packages/core); „Workouts“ steht im Training (Umschalter) und hier nur, wenn „Training“
 * keinen Knopf hat. Nur Wege in vorhandene Bildschirme – nichts Neues.
 */

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
  const cycleVisible = useCycleVisible();
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
  const slim = t.slim.more;
  const details: Record<string, string> = texts.details;
  const hidden = areasInMore(layout, available).filter(
    // Workouts gehören zum Training (Umschalter) – nur ohne Knopf „Training“ hier.
    (area) => area !== 'workouts' || !layout.tabs.includes('today'),
  );
  const nutrition = app.backend.supportsNutrition;
  const open = (href: string) => () => router.push(href as Href);
  const area = (key: NavArea, detail?: string): Entry[] =>
    hidden.includes(key)
      ? [
          {
            key,
            label: tabLabel(key),
            detail: detail ?? details[key] ?? '',
            area: NAV_AREA_STYLE[key].area,
            icon: NAV_AREA_STYLE[key].icon,
            onPress: () => router.navigate(`/${key}` as Href),
            testID: `more-area-${key}`,
          },
        ]
      : [];

  const progress: Entry[] = [
    ...area('fortschritt', slim.progressDetail),
    {
      key: 'calendar',
      label: slim.calendar,
      detail: slim.calendarDetail,
      area: 'fortschritt',
      icon: 'calendar',
      onPress: open('/kalender'),
      testID: 'more-calendar',
    },
  ];
  const sport: Entry[] = [
    // „Wettkampf“ zuerst (Gründer-Rückmeldung 20.10.2026: leicht finden).
    ...area('wettkampf'),
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
    // Hat die Person einen Hauptbereich aus der Leiste genommen, steht er hier.
    ...area('today'),
    ...area('workouts'),
    // Calisthenics (docs/PLAN-CALISTHENICS-SCHLINGE.md 2.5): Stufenleitern mit aktueller Stufe und nächstem Ziel.
    {
      key: 'skill-paths',
      label: t.calisthenics.skills.entry,
      detail: t.calisthenics.skills.entryDetail,
      area: 'training',
      icon: 'trend',
      onPress: open('/skill-pfade'),
      testID: 'more-skill-paths',
    },
  ];
  const food: Entry[] = [...area('ernaehrung'), ...area('einkaufsliste')];
  if (nutrition) {
    food.push({
      key: 'recipes',
      label: texts.recipes,
      detail: details.recipes ?? '',
      area: 'ernaehrung',
      icon: 'recipe',
      onPress: open('/rezepte'),
      testID: 'more-recipes',
    });
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
  if (nutrition) {
    food.push({
      key: 'guides',
      label: texts.guides,
      detail: slim.guidesDetail,
      area: 'training',
      icon: 'book',
      onPress: open('/ratgeber'),
      testID: 'more-guides',
    });
  }
  // Phase 9: Zyklus-Modul (nur wenn angeboten oder schon eingeschaltet).
  if (cycleVisible) {
    food.push({
      key: 'cycle',
      label: deCycle.moreLabel,
      // Nicht (mehr) angeboten, aber Daten da (z. B. nach Wechsel auf „männlich“) → „Daten verwalten …“.
      detail: cycleModuleOffered(app.answers.sex ?? null)
        ? slim.cycleDetail
        : deCycle.moreDescriptionManage,
      area: 'fortschritt',
      icon: 'heart',
      onPress: open('/zyklus'),
      testID: 'more-cycle',
    });
  }

  return (
    <Screen title={texts.title} testID="more">
      <AccountRow email={app.session?.email ?? null} onPress={open('/konto')} />
      <TileGroup title={slim.progressSection} entries={progress} />
      <TileGroup title={slim.sportSection} entries={sport} />
      <TileGroup title={slim.foodSection} entries={food} />
      <View style={styles.group}>
        <SectionLabel>{slim.settingsSection}</SectionLabel>
        <ListGroup>
          <ListRow
            icon="settings"
            label={texts.settings}
            onPress={open('/settings')}
            testID="more-settings"
          />
          <ListRow
            icon="bar-menu"
            label={texts.menuBar}
            accessibilityHint={texts.layoutHint}
            onPress={open('/menueleiste')}
            testID="more-menu-bar"
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
