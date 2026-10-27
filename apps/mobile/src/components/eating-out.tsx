import {
  defaultEatingOutPortion,
  EATING_OUT_CATEGORIES,
  EATING_OUT_CATEGORY_LABELS_DE,
  eatingOutCatalog,
  eatingOutPortionValues,
  type EatingOutCategory,
  type EatingOutDishView,
  entryFromEatingOut,
  type FoodLogBuild,
  type FoodLogTarget,
  type FoodLookup,
} from '@fitnessapp/core';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Body, Button, Card, ChoiceList, Heading, Notice, TextField } from '@/components/ui';
import { t } from '@/i18n';
import { useEatingOutPicks } from '@/lib/eating-out-picks';

type OkView = Extract<EatingOutDishView, { kind: 'ok' }>;

/**
 * Reiter „Unterwegs“ beim Eintragen (Auswärts essen, Gründer-Freigabe 25.10.2026): Kategorie, Suche, Gericht mit
 * Portion (klein/normal/groß, halbe Pizza …) → Schnelleintrag „Auswärts gegessen“ mit ca.-Werten. Alle Werte rechnet
 * packages/core (`eatingOutCatalog`, `entryFromEatingOut`) aus dem Lebensmittel-Katalog; hier nur Anzeige. Immer mit
 * „Schätzwert“, im Testmodus Entwürfe zusätzlich mit „Entwurf“. „Zuletzt“/Favoriten nur auf dem Gerät (IDs).
 */
export function EatingOutTab({
  foods,
  allowDrafts,
  showNumbers,
  busy,
  userId,
  target,
  onSubmit,
  onQuick,
}: {
  foods: FoodLookup;
  allowDrafts: boolean;
  showNumbers: boolean;
  busy: boolean;
  userId: string | null;
  target: () => FoodLogTarget;
  onSubmit: (build: FoodLogBuild, name: string) => void;
  onQuick: () => void;
}) {
  const texts = t.eatingOut;
  const [category, setCategory] = useState<EatingOutCategory | 'all'>('all');
  const [text, setText] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [portion, setPortion] = useState<string | null>(null);
  const { picks, remember, toggleFavorite } = useEatingOutPicks(userId);

  const all = useMemo(() => eatingOutCatalog({ foods, allowDrafts }), [foods, allowDrafts]);
  const shown = useMemo(
    () =>
      eatingOutCatalog({
        foods,
        allowDrafts,
        category: category === 'all' ? null : category,
        text: text.trim().length > 0 ? text : null,
      }),
    [allowDrafts, category, foods, text],
  );
  const available = new Map(all.map((view) => [view.dish.id, view]));

  function log(view: OkView, portionId: string) {
    const build = entryFromEatingOut(view.dish, portionId, foods, target(), {
      showNumbers,
      allowDrafts,
    });
    if (build.ok) remember({ dishId: view.dish.id, portionId });
    onSubmit(build, view.dish.name_de);
  }

  const portionLabel = (view: OkView, portionId: string) =>
    view.portions.find((p) => p.id === portionId)?.label ?? portionId;

  if (all.length === 0) {
    return (
      <Notice tone="info" testID="eating-out-none">
        <Body>{texts.noneAvailable}</Body>
        <Button
          label={texts.toQuick}
          variant="secondary"
          onPress={onQuick}
          testID="eating-out-to-quick"
        />
      </Notice>
    );
  }

  const favorites = picks.favorites
    .map((id) => available.get(id))
    .filter((v): v is OkView => v !== undefined);
  const recent = picks.recent
    .map((pick) => ({ pick, view: available.get(pick.dishId) }))
    .filter((r): r is { pick: (typeof picks.recent)[number]; view: OkView } => r.view !== undefined)
    .filter((r) => r.view.portions.some((p) => p.id === r.pick.portionId));

  return (
    <View style={styles.column} testID="eating-out">
      <Body muted>{texts.intro}</Body>

      {recent.length > 0 ? (
        <View style={styles.column} testID="eating-out-recent">
          <Heading level={2}>{texts.recentTitle}</Heading>
          {recent.map(({ pick, view }) => {
            const label = portionLabel(view, pick.portionId);
            const values = eatingOutPortionValues(view.dish, pick.portionId, foods, allowDrafts);
            return (
              <Button
                key={`recent-${view.dish.id}`}
                label={
                  showNumbers && values !== null
                    ? `${texts.quickPick(view.dish.name_de, label)} · ${texts.kcal(values.kcal)}`
                    : texts.quickPick(view.dish.name_de, label)
                }
                accessibilityLabel={texts.quickPickA11y(view.dish.name_de, label)}
                variant="secondary"
                disabled={busy}
                onPress={() => log(view, pick.portionId)}
                testID={`eating-out-recent-${view.dish.id}`}
              />
            );
          })}
        </View>
      ) : null}

      {favorites.length > 0 ? (
        <View style={styles.column} testID="eating-out-favorites">
          <Heading level={2}>{texts.favoritesTitle}</Heading>
          {favorites.map((view) => {
            const id = defaultEatingOutPortion(view.dish.portion);
            const label = portionLabel(view, id);
            return (
              <Button
                key={`fav-${view.dish.id}`}
                label={texts.quickPick(view.dish.name_de, label)}
                accessibilityLabel={texts.pickA11y(view.dish.name_de)}
                variant="secondary"
                disabled={busy}
                onPress={() => {
                  setOpenId(view.dish.id);
                  setPortion(id);
                }}
                testID={`eating-out-fav-${view.dish.id}`}
              />
            );
          })}
        </View>
      ) : null}

      <ChoiceList
        label={texts.categoryLabel}
        horizontal
        options={[
          { value: 'all' as const, label: texts.categoryAll, testID: 'eating-out-cat-all' },
          ...EATING_OUT_CATEGORIES.map((c) => ({
            value: c,
            label: EATING_OUT_CATEGORY_LABELS_DE[c],
            testID: `eating-out-cat-${c}`,
          })),
        ]}
        value={category}
        onChange={(value) => {
          setCategory(value);
          setOpenId(null);
        }}
      />
      <TextField
        label={texts.searchLabel}
        hint={texts.searchHint}
        value={text}
        onChangeText={(value) => {
          setText(value);
          setOpenId(null);
        }}
        maxLength={40}
        testID="eating-out-search"
      />
      <Body muted testID="eating-out-count">
        {texts.count(shown.length)}
      </Body>
      {shown.length === 0 ? (
        <Notice tone="info" testID="eating-out-empty">
          <Body>{texts.empty}</Body>
          <Button label={texts.toQuick} variant="secondary" onPress={onQuick} />
        </Notice>
      ) : null}
      {shown.map((view) => {
        const open = openId === view.dish.id;
        const chosen =
          open && portion !== null && view.portions.some((p) => p.id === portion)
            ? portion
            : defaultEatingOutPortion(view.dish.portion);
        const values = eatingOutPortionValues(view.dish, chosen, foods, allowDrafts);
        const favorite = picks.favorites.includes(view.dish.id);
        return (
          <Card key={view.dish.id}>
            <View style={styles.column} testID={`eating-out-dish-${view.dish.id}`}>
              <Button
                label={view.dish.name_de}
                variant={open ? 'primary' : 'secondary'}
                accessibilityLabel={texts.pickA11y(view.dish.name_de)}
                onPress={() => {
                  setOpenId(open ? null : view.dish.id);
                  setPortion(defaultEatingOutPortion(view.dish.portion));
                }}
                testID={`eating-out-open-${view.dish.id}`}
              />
              <View style={styles.badges}>
                <Badge label={texts.estimateBadge} testID={`eating-out-estimate-${view.dish.id}`} />
                <Body muted>
                  {[
                    EATING_OUT_CATEGORY_LABELS_DE[view.dish.category],
                    texts.basis(view.dish.basis_de),
                    showNumbers ? texts.kcal(view.normal.kcal) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Body>
              </View>
              {open ? (
                <View style={styles.column} testID={`eating-out-form-${view.dish.id}`}>
                  <ChoiceList
                    label={texts.portionLabel}
                    horizontal
                    options={view.portions.map((p) => {
                      const v = eatingOutPortionValues(view.dish, p.id, foods, allowDrafts);
                      return {
                        value: p.id,
                        label:
                          showNumbers && v !== null
                            ? texts.portionWithKcal(p.label, v.kcal)
                            : p.label,
                        testID: `eating-out-portion-${p.id}`,
                      };
                    })}
                    value={chosen}
                    onChange={setPortion}
                  />
                  {showNumbers && values !== null ? (
                    <Body muted testID="eating-out-values">
                      {texts.macros(values.protein_g, values.carbs_g, values.fat_g)}
                    </Body>
                  ) : null}
                  <Button
                    label={texts.add}
                    accessibilityLabel={texts.addA11y(
                      view.dish.name_de,
                      portionLabel(view, chosen),
                    )}
                    loading={busy}
                    onPress={() => log(view, chosen)}
                    testID="eating-out-add"
                  />
                  <Button
                    label={favorite ? texts.favoriteRemove : texts.favoriteAdd}
                    variant="secondary"
                    onPress={() => toggleFavorite(view.dish.id)}
                    testID="eating-out-favorite"
                  />
                </View>
              ) : null}
            </View>
          </Card>
        );
      })}
      <Body muted>{texts.loggedAs}</Body>
      <Body muted>{texts.picksLocal}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
});
