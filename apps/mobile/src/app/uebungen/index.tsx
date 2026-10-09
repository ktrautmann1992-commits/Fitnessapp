import {
  GLOSSARY_EQUIPMENT_FILTERS,
  GLOSSARY_GROUP_IDS,
  GLOSSARY_LIMITS,
  type GlossaryEquipmentFilter,
  type GlossaryGroup,
  searchExercises,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import {
  Body,
  Button,
  ChoiceList,
  LoadingState,
  MIN_TOUCH,
  Notice,
  OptionButton,
  TextField,
} from '@/components/ui';
import { glossaryContextFromRows } from '@/data/glossary';
import { t } from '@/i18n';
import { listLine } from '@/lib/glossary-format';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';

type EquipmentChoice = GlossaryEquipmentFilter | 'all';
const DIFFICULTIES = [
  { value: 1, key: 'easy' },
  { value: 2, key: 'medium' },
  { value: 3, key: 'hard' },
] as const;

/**
 * Übungs-Glossar (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 8.1, Etappe G1): Suche (Umlaute egal) und Filter nach
 * Bereich, Ausrüstung und Schwierigkeit; Trefferzahl als Live-Region. Suche, Filter und Rangfolge kommen aus
 * packages/core (searchExercises); Inhalte aus der Bibliothek bzw. offline aus dem Zwischenspeicher.
 */
export default function GlossaryScreen() {
  const router = useRouter();
  const app = useApp();
  const theme = useThemeColors();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<GlossaryGroup[]>([]);
  const [equipment, setEquipment] = useState<EquipmentChoice>('all');
  const [difficulty, setDifficulty] = useState<number[]>([]);

  const { ensureLibrary, library, rows } = app;
  useEffect(() => {
    void ensureLibrary();
  }, [ensureLibrary]);
  const lib = library.kind === 'ready' ? library.library : null;
  const context = useMemo(() => glossaryContextFromRows(rows, lib, null), [lib, rows]);
  const hits = useMemo(
    () =>
      searchExercises(
        lib,
        { query, groups, equipment: equipment === 'all' ? null : equipment, difficulty },
        context.homeProfile ? { homeProfile: context.homeProfile } : {},
      ),
    [context.homeProfile, difficulty, equipment, groups, lib, query],
  );

  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  const route = resolveEntryRoute({ session: app.session, rows: app.rows, versions: app.versions });
  if (route !== '/today' || !app.rows) {
    return <Redirect href={route as Href} />;
  }

  const toggle = <T,>(list: readonly T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  const filtered = groups.length > 0 || equipment !== 'all' || difficulty.length > 0;
  const resetFilters = () => {
    setGroups([]);
    setEquipment('all');
    setDifficulty([]);
  };

  return (
    <Screen
      title={t.glossary.title}
      intro={t.glossary.intro}
      testID="glossary"
      footer={
        <Button
          label={t.glossary.back}
          variant="secondary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
      }
    >
      <TextField
        label={t.glossary.searchLabel}
        hint={t.glossary.searchHint}
        placeholder={t.glossary.searchPlaceholder}
        value={query}
        onChangeText={setQuery}
        maxLength={GLOSSARY_LIMITS.queryMaxChars}
        testID="glossary-search"
      />
      {query.length > 0 ? (
        <Button
          label={t.glossary.clearSearch}
          variant="link"
          onPress={() => setQuery('')}
          testID="glossary-search-clear"
        />
      ) : null}

      <View style={styles.filter}>
        <Text style={[styles.filterLabel, { color: theme.text }]}>{t.glossary.filterGroup}</Text>
        <View style={styles.chips}>
          {GLOSSARY_GROUP_IDS.map((group) => (
            <OptionButton
              key={group}
              role="checkbox"
              compact
              label={t.glossary.groups[group]}
              accessibilityLabel={`${t.glossary.filterGroup}: ${t.glossary.groups[group]}`}
              selected={groups.includes(group)}
              onPress={() => setGroups((list) => toggle(list, group))}
            />
          ))}
        </View>
      </View>
      <ChoiceList<EquipmentChoice>
        label={t.glossary.filterEquipment}
        horizontal
        options={[
          { value: 'all', label: t.glossary.filterAll },
          ...GLOSSARY_EQUIPMENT_FILTERS.map((value) => ({
            value,
            label: t.glossary.equipmentFilters[value],
          })),
        ]}
        value={equipment}
        onChange={setEquipment}
      />
      <View style={styles.filter}>
        <Text style={[styles.filterLabel, { color: theme.text }]}>
          {t.glossary.filterDifficulty}
        </Text>
        <View style={styles.chips}>
          {DIFFICULTIES.map(({ value, key }) => (
            <OptionButton
              key={value}
              role="checkbox"
              compact
              label={t.glossary.difficulty[key]}
              accessibilityLabel={`${t.glossary.filterDifficulty}: ${t.glossary.difficulty[key]}`}
              selected={difficulty.includes(value)}
              onPress={() => setDifficulty((list) => toggle(list, value))}
            />
          ))}
        </View>
      </View>
      {filtered ? (
        <Button
          label={t.glossary.resetFilters}
          variant="link"
          onPress={resetFilters}
          testID="glossary-reset"
        />
      ) : null}

      {library.kind === 'idle' || library.kind === 'loading' ? (
        <LoadingState />
      ) : !lib ? (
        <Notice tone="warning" testID="glossary-library-missing">
          {t.glossary.libraryMissing}
        </Notice>
      ) : (
        <>
          {/* Trefferzahl als Live-Region: Bildschirmleser sagen jede Änderung an. */}
          <Text
            accessibilityLiveRegion="polite"
            aria-live="polite"
            style={[styles.count, { color: theme.text }]}
            testID="glossary-count"
          >
            {t.glossary.count(hits.length)}
          </Text>
          {hits.length === 0 ? (
            <Notice tone="info" testID="glossary-empty">
              <Body>{t.glossary.noResults}</Body>
              {filtered ? (
                <Button label={t.glossary.resetFilters} variant="link" onPress={resetFilters} />
              ) : null}
            </Notice>
          ) : (
            <View style={styles.list}>
              {hits.map(({ exercise }) => {
                const draft = exercise.status === 'draft';
                const line = listLine(exercise);
                return (
                  <Pressable
                    key={exercise.id}
                    accessibilityRole="link"
                    accessibilityLabel={[
                      exercise.name_de,
                      line,
                      draft ? t.glossary.testContent : null,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    accessibilityHint={t.glossary.openGuideHint}
                    onPress={() =>
                      router.push(`/uebungen/${encodeURIComponent(exercise.id)}` as Href)
                    }
                    testID="glossary-item"
                    style={({ pressed }) => [
                      styles.item,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.itemName, { color: theme.link }]}>{exercise.name_de}</Text>
                    <Text style={[styles.itemLine, { color: theme.textMuted }]}>{line}</Text>
                    {draft ? (
                      <Text style={[styles.itemLine, { color: theme.textMuted }]}>
                        {t.glossary.testContent}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filter: { gap: spacing.xs },
  filterLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  count: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  list: { gap: spacing.xs },
  item: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  itemName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, lineHeight: 24 },
  itemLine: { fontSize: fontSize.sm, lineHeight: 20 },
});
