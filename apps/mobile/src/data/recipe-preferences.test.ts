/**
 * Rezept-Favoriten in der App (Gründer-Freigabe 25.10.2026, KONZEPT 6.10a): Speichern offline (Gerätespeicher bzw.
 * normale Warteschlange), „Nie wieder“ wirkt im Essensplan, in der Rezeptsuche und in der Kühlschrank-Suche,
 * Obergrenze mit verständlicher Meldung, Gerätespeicher nicht vertrauenswürdig, Export. Die Regeln selbst testet
 * packages/core (recipe-preferences.test).
 */
import {
  type MealPlanWeek,
  RECIPE_PREFERENCE_RULES,
  selectNutritionContent,
  validateContent,
} from '@fitnessapp/core';
import { demoNutritionContent } from '@fitnessapp/core/demo-nutrition';
import type { AppSupabaseClient } from '@fitnessapp/db';
import { describe, expect, it } from 'vitest';

import { planPersonRows, seededBackend, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import { BackendError } from './backend';
import { localDataExport } from './data-export';
import { prepareFridgeSearch } from './fridge-search';
import { STORAGE_KEYS } from './kv';
import { upgradeStoredRows } from './legacy-rows';
import { isValidOp } from './local-rules';
import { computeNutritionWeek, type NutritionWeekResult } from './nutrition-plan';
import {
  checkRecipePreference,
  preferenceForRecipe,
  recipePreferencesFromRows,
} from './recipe-preference-rows';
import { recipeSearchForPerson } from './recipe-search';
import { executeWriteOp } from './supabase-backend';
import { enqueue, queueKey } from './sync-queue';
import type { RecipePreferenceRow, UserRows } from './types';
import { applyWriteOps, isDirectOp, isSensitiveOp, type WriteOp } from './write-ops';

const LIBRARY = (() => {
  const demo = demoNutritionContent();
  return selectNutritionContent(validateContent(demo.files, { nutritionCatalog: demo.catalog }), {
    allowDrafts: true,
  });
})();
const WEEK = '2026-09-28'; // TODAY = Samstag 03.10.2026 → laufende Woche
const NEXT_WEEK = '2026-10-05';

function rows(): UserRows {
  const base = planPersonRows({ consent: 'valid', goal: 'fat_loss' });
  return {
    ...base,
    profile: base.profile ? { ...base.profile, sex: 'female' } : null,
    nutritionPrefs: {
      user_id: USER_ID,
      diet_type: 'omnivore',
      eats_pork: true,
      meals_per_day: 4,
      cooking_mode: 'daily',
      mealprep_days: null,
    },
    nutritionSetup: {
      user_id: USER_ID,
      activity_level: 'light',
      training_time: 'evening',
      mealprep_slots: 'lunch',
      show_energy_numbers: true,
    },
    bodyMetrics: [
      {
        id: 'bm-1',
        user_id: USER_ID,
        measured_on: '2026-09-20',
        height_cm: 170,
        weight_kg: 70,
        body_fat_pct: null,
        resting_heart_rate_bpm: null,
      },
    ],
  };
}

type Ready = Extract<NutritionWeekResult, { kind: 'ready' }> & { plan: MealPlanWeek };

function week(data: UserRows, weekStart = WEEK): Ready {
  const result = computeNutritionWeek({
    rows: data,
    versions: VERSIONS,
    today: TODAY,
    weekStart,
    library: LIBRARY,
    allowDrafts: true,
  });
  if (result.kind !== 'ready' || result.plan === null) throw new Error('Plan erwartet');
  return result as Ready;
}

function mostUsed(plan: MealPlanWeek): string {
  const counts = new Map<string, number>();
  plan.days.forEach((d) =>
    d.meals.forEach((m) => counts.set(m.recipeId, (counts.get(m.recipeId) ?? 0) + 1)),
  );
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? '';
}

const row = (recipeId: string, kind: 'favorite' | 'hidden'): RecipePreferenceRow => ({
  user_id: USER_ID,
  recipe_id: recipeId,
  kind,
  set_on: TODAY,
});

describe('Rezept-Favoriten im Testmodus (Gerätespeicher, offline)', () => {
  it('Herz setzen, durch „Nie wieder“ ersetzen, zurücknehmen – gespeichert, im Export, ohne Netz', async () => {
    const data = rows();
    const id = mostUsed(week(data, NEXT_WEEK).plan);
    const { backend, store } = seededBackend(data);
    let next = await backend.setRecipePreference(id, 'favorite', data);
    expect(preferenceForRecipe(next, id)).toBe('favorite');
    next = await backend.setRecipePreference(id, 'hidden', next);
    expect(next.recipePreferences).toEqual([row(id, 'hidden')]);
    const stored = JSON.parse(store.dump()[STORAGE_KEYS.localDb] ?? '{}') as { rows: UserRows };
    expect(stored.rows.recipePreferences).toEqual([row(id, 'hidden')]);
    const exported = localDataExport(next, USER_ID, '2026-10-03T12:00:00.000Z');
    expect(exported.data.recipe_preferences).toEqual([row(id, 'hidden')]);
    next = await backend.setRecipePreference(id, null, next);
    expect(next.recipePreferences).toEqual([]);
  });

  it('„Nie wieder“: kommende Woche ohne das Rezept, laufende Woche bleibt (K7) – nur „Plan aktualisieren“-Hinweis für kommende', () => {
    const data = rows();
    const id = mostUsed(week(data, NEXT_WEEK).plan);
    const hidden = { ...data, recipePreferences: [row(id, 'hidden')] };
    const next = week(hidden, NEXT_WEEK);
    expect(next.plan.days.some((d) => d.meals.some((m) => m.recipeId === id))).toBe(false);
    // Herz: dasselbe Rezept nie seltener als ohne.
    const count = (plan: MealPlanWeek) =>
      plan.days.reduce((n, d) => n + d.meals.filter((m) => m.recipeId === id).length, 0);
    const fav = week({ ...data, recipePreferences: [row(id, 'favorite')] }, NEXT_WEEK);
    expect(count(fav.plan)).toBeGreaterThanOrEqual(count(week(data, NEXT_WEEK).plan));
  });

  it('Rezeptsuche: ausgeblendet weg (mit Anzahl), Herz markiert, „Nur Lieblingsgerichte“', () => {
    const data = rows();
    const ready = week(data);
    const search = (r: UserRows, favoritesOnly = false) => {
      const result = recipeSearchForPerson({
        library: LIBRARY,
        rows: r,
        versions: VERSIONS,
        week: ready,
        allowDrafts: true,
        query: { favoritesOnly },
      });
      if (result.kind !== 'ok') throw new Error('Suche erwartet');
      return result;
    };
    const all = search(data);
    const [a, b] = all.cards;
    if (a === undefined || b === undefined) throw new Error('Rezepte erwartet');
    const prefs = { ...data, recipePreferences: [row(a.id, 'hidden'), row(b.id, 'favorite')] };
    const result = search(prefs);
    expect(result.cards.some((c) => c.id === a.id)).toBe(false);
    expect(result.hiddenCount).toBe(1);
    expect(result.favoriteCount).toBe(1);
    expect(result.cards.find((c) => c.id === b.id)?.favorite).toBe(true);
    expect(search(prefs, true).cards.map((c) => c.id)).toEqual([b.id]);
    expect(search(data, true).cards).toEqual([]);
    // Kühlschrank-Suche: ausgeblendete Rezepte auch dort nicht.
    const fridge = prepareFridgeSearch({
      library: LIBRARY,
      rows: prefs,
      versions: VERSIONS,
      week: ready,
      allowDrafts: true,
    });
    if (fridge.kind !== 'ok') throw new Error('Kühlschrank-Suche erwartet');
    expect(fridge.variants.some((v) => v.recipe.id === a.id)).toBe(false);
  });

  it('Obergrenze: verständlicher Fehler, Ändern einer vorhandenen Vorliebe geht', async () => {
    const data = rows();
    const full: RecipePreferenceRow[] = Array.from(
      { length: RECIPE_PREFERENCE_RULES.maxEntries },
      (_, i) => row(`rezept-${String(i).padStart(4, '0')}`, 'favorite'),
    );
    const at = { ...data, recipePreferences: full };
    expect(
      checkRecipePreference(
        at,
        { recipeId: 'neues-rezept', kind: 'favorite' },
        {
          userId: USER_ID,
          today: TODAY,
        },
      ),
    ).toEqual({ ok: false, reason: 'limit' });
    expect(
      checkRecipePreference(
        at,
        { recipeId: 'rezept-0001', kind: 'hidden' },
        {
          userId: USER_ID,
          today: TODAY,
        },
      ).ok,
    ).toBe(true);
    const { backend } = seededBackend(at);
    await expect(backend.setRecipePreference('neues-rezept', 'favorite', at)).rejects.toEqual(
      new BackendError('recipe_preference_limit'),
    );
    expect(
      checkRecipePreference(
        data,
        { recipeId: 'x', kind: 'favorite' },
        { userId: USER_ID, today: TODAY },
      ),
    ).toEqual({ ok: false, reason: 'invalid' });
  });

  it('Gerätespeicher ist nicht vertrauenswürdig: nur gültige eigene Zeilen, je Rezept eine; ältere Stände leer', () => {
    const data = rows();
    const upgraded = upgradeStoredRows({
      ...data,
      recipePreferences: [
        row('banane-pur', 'hidden'),
        row('banane-pur', 'favorite'),
        { ...row('overnight-oats', 'favorite'), user_id: 'fremd' },
        { ...row('paprika-sticks', 'favorite'), kind: 'like' },
        { ...row('reis-bowl', 'favorite'), note: 'x' },
      ],
    } as unknown as UserRows);
    expect(upgraded.recipePreferences).toEqual([row('banane-pur', 'hidden')]);
    const older: Partial<UserRows> = { ...data };
    delete older.recipePreferences;
    expect(upgradeStoredRows(older as unknown as UserRows).recipePreferences).toEqual([]);
    expect(recipePreferencesFromRows(upgraded)).toEqual([
      { recipeId: 'banane-pur', kind: 'hidden', setOn: TODAY },
    ]);
  });
});

describe('Rezept-Favoriten im Supabase-Modus (Warteschlange, PostgREST)', () => {
  it('kein Gesundheitsdatum: darf in die Warteschlange, letzter Stand je Rezept gewinnt', () => {
    const set: WriteOp = {
      kind: 'set_recipe_preference',
      recipeId: 'banane-pur',
      row: row('banane-pur', 'favorite'),
    };
    const unset: WriteOp = { kind: 'set_recipe_preference', recipeId: 'banane-pur', row: null };
    expect(isSensitiveOp(set)).toBe(false);
    expect(isDirectOp(set)).toBe(false);
    expect(queueKey(set)).toBe('recipe_preference:banane-pur');
    const queued = enqueue(enqueue([], [set]), [unset]);
    expect(queued).toEqual([{ key: 'recipe_preference:banane-pur', op: unset }]);
    const data = rows();
    const ctx = { now: '2026-10-03T10:00:00.000Z', newId: () => 'id', flagsFor: () => [] };
    const applied = applyWriteOps(data, [set], ctx);
    expect(applied.recipePreferences).toEqual([row('banane-pur', 'favorite')]);
    expect(applyWriteOps(applied, [unset], ctx).recipePreferences).toEqual([]);
  });

  it('Prüfregeln wie die Tabelle: eigene Zeile, gültige Art, Datum höchstens morgen', () => {
    const data = rows();
    const profile = data.profile;
    if (profile === null) throw new Error('Profil erwartet');
    const ok = (r: RecipePreferenceRow | null, recipeId = 'banane-pur') =>
      isValidOp({ kind: 'set_recipe_preference', recipeId, row: r }, { today: TODAY, profile });
    expect(ok(row('banane-pur', 'hidden'))).toBe(true);
    expect(ok(null)).toBe(true);
    expect(ok(null, 'x')).toBe(false);
    expect(ok({ ...row('banane-pur', 'hidden'), user_id: 'fremd' })).toBe(false);
    expect(ok(row('overnight-oats', 'hidden'))).toBe(false);
    expect(ok({ ...row('banane-pur', 'hidden'), set_on: '2026-10-05' })).toBe(false);
  });

  it('PostgREST: Upsert mit Konflikt-Schlüssel user_id,recipe_id bzw. Löschen der eigenen Zeile', async () => {
    const calls: { table: string; chain: string[]; args: unknown[][] }[] = [];
    const builder = (call: (typeof calls)[number]): unknown =>
      new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === 'then') {
              return (resolve: (v: unknown) => void) => resolve({ data: null, error: null });
            }
            return (...args: unknown[]) => {
              call.chain.push(prop);
              call.args.push(args);
              return builder(call);
            };
          },
        },
      );
    const client = {
      from: (table: string) => {
        const call = { table, chain: [] as string[], args: [] as unknown[][] };
        calls.push(call);
        return builder(call);
      },
    } as unknown as AppSupabaseClient;
    await executeWriteOp(client, USER_ID, {
      kind: 'set_recipe_preference',
      recipeId: 'banane-pur',
      row: row('banane-pur', 'favorite'),
    });
    await executeWriteOp(client, USER_ID, {
      kind: 'set_recipe_preference',
      recipeId: 'banane-pur',
      row: null,
    });
    expect(calls[0]).toMatchObject({ table: 'recipe_preferences', chain: ['upsert'] });
    expect(calls[0]?.args[0]?.[1]).toEqual({ onConflict: 'user_id,recipe_id' });
    expect(calls[1]).toMatchObject({ table: 'recipe_preferences', chain: ['delete', 'eq', 'eq'] });
    expect(calls[1]?.args.slice(1)).toEqual([
      ['user_id', USER_ID],
      ['recipe_id', 'banane-pur'],
    ]);
  });
});
