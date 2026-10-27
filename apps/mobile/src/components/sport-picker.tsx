import {
  searchSports,
  SPORT_CATALOGUE,
  type SportIcon,
  type SportId,
  sportName,
  sportsByCategory,
} from '@fitnessapp/core';
import { fontSize, spacing } from '@fitnessapp/ui';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconChip, type IconName, MIN_ROW, SectionLabel } from '@/components/design';
import { Text } from '@/components/text';
import { Body, Button, TextField } from '@/components/ui';
import { t } from '@/i18n';
import { appFont } from '@/lib/fonts';
import { PENDING_SPORTS } from '@/lib/sportarten-stufe1';
import { useThemeColors } from '@/lib/theme';

/**
 * Auswahl einer Sportart (Sportarten Stufe 2, docs/PLAN-SPORTARTEN.md): Suche, „Zuletzt genutzt“ und Gruppen
 * (Ballsport, Rückschlag, Klettern …) mit Icon. Suche und Gruppen rechnet packages/core (searchSports,
 * sportsByCategory). Jede Zeile ist eine Radio-Option (≥ 44 px), Icons sind Deko.
 */

const S = t.sports;

/** Icon-Schlüssel aus dem Katalog → Icon der App (gleiche Namen; Fallback „dots“). */
export const SPORT_ICONS: Readonly<Record<SportIcon, IconName>> = {
  mountain: 'mountain',
  ball: 'ball',
  racket: 'racket',
  glove: 'glove',
  snowflake: 'snowflake',
  waves: 'waves',
  music: 'music',
  bike: 'bike',
  stopwatch: 'stopwatch',
  dots: 'dots',
  lotus: 'lotus',
};

export function sportIcon(sport: SportId): IconName {
  return SPORT_ICONS[SPORT_CATALOGUE[sport].icon] ?? 'dots';
}

function SportRow({
  sport,
  selected,
  onPress,
  testID,
}: {
  sport: SportId;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const theme = useThemeColors();
  const name = sportName(sport);
  const gps = SPORT_CATALOGUE[sport].gps;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={S.picker.pickA11y(name, selected)}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: selected ? theme.primary : theme.border,
          borderWidth: selected ? 3 : 1,
          backgroundColor: theme.surface,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <IconChip area="ausdauer" icon={sportIcon(sport)} />
      <Text
        style={[styles.rowLabel, appFont(selected ? 'bold' : 'semibold'), { color: theme.text }]}
      >
        {selected ? `✓ ${name}` : name}
      </Text>
      {gps ? (
        <Text style={[styles.badge, appFont('bold'), { color: theme.textMuted }]}>
          {S.picker.gpsBadge}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function SportPicker({
  value,
  onChange,
  recent,
  onlyGps = false,
  testID = 'sport-picker',
}: {
  value: SportId | null;
  onChange: (sport: SportId) => void;
  /** Zuletzt genutzte Sportarten (neueste zuerst). */
  recent: readonly SportId[];
  onlyGps?: boolean;
  testID?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(value === null);
  const results = useMemo(
    () => searchSports(query, { onlyGps }).filter((id) => !PENDING_SPORTS.has(id)),
    [query, onlyGps],
  );
  const groups = useMemo(() => sportsByCategory(results), [results]);
  const recentShown = recent.filter((id) => !onlyGps || SPORT_CATALOGUE[id].gps);

  if (!open && value !== null) {
    return (
      <View style={styles.section} testID={testID}>
        <View style={styles.chosen}>
          <IconChip area="ausdauer" icon={sportIcon(value)} size={40} />
          <Body testID={`${testID}-chosen`}>{S.picker.chosen(sportName(value))}</Body>
        </View>
        <Button
          label={S.picker.change}
          variant="link"
          onPress={() => setOpen(true)}
          testID={`${testID}-change`}
        />
      </View>
    );
  }

  const pick = (sport: SportId) => {
    onChange(sport);
    setOpen(false);
    setQuery('');
  };
  return (
    <View style={styles.section} testID={testID} accessibilityRole="radiogroup">
      <TextField
        label={S.picker.searchLabel}
        hint={S.picker.searchHint}
        value={query}
        onChangeText={setQuery}
        testID={`${testID}-search`}
      />
      {query.trim() === '' && recentShown.length > 0 ? (
        <View style={styles.group} testID={`${testID}-recent`}>
          <SectionLabel level={3}>{S.picker.recent}</SectionLabel>
          {recentShown.map((sport) => (
            <SportRow
              key={`recent-${sport}`}
              sport={sport}
              selected={value === sport}
              onPress={() => pick(sport)}
              testID={`${testID}-recent-${sport}`}
            />
          ))}
        </View>
      ) : null}
      {results.length === 0 ? <Body muted>{S.picker.noResults}</Body> : null}
      {groups.map((group) => (
        <View key={group.category} style={styles.group}>
          <SectionLabel level={3}>{S.picker.categories[group.category]}</SectionLabel>
          {group.sports.map((sport) => (
            <SportRow
              key={sport}
              sport={sport}
              selected={value === sport}
              onPress={() => pick(sport)}
              testID={`${testID}-${sport}`}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  group: { gap: spacing.xs },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: {
    minHeight: MIN_ROW + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  rowLabel: { flex: 1, fontSize: fontSize.md },
  badge: { fontSize: fontSize.sm },
});
