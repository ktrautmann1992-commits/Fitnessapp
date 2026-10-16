/**
 * Etappe E3 – Gericht per Foto im Testmodus (docs/PLAN-AUSWERTUNG.md Abschnitt 9): dieselbe Kette wie der Server mit
 * der Attrappe – Einwilligung ai_food_photo UND health_data, Tages-/Monatslimit (Europe/Berlin), fehlgeschlagen zählt
 * nicht, ai_usage nur Metadaten, Eintragen mit Herkunft photo (Werte aus dem Katalog), Widerruf, Export, Konto löschen,
 * und die Supabase-Seite (Route, Freischaltung) mit Ersatz-fetch.
 */
import {
  matchPhotoItems,
  photoEntries,
  type FoodPhotoResponse,
  type PhotoResultItem,
  zeroNutrients,
} from '@fitnessapp/core';
import type { AppSupabaseClient } from '@fitnessapp/db';
import { describe, expect, it, vi } from 'vitest';

import { consent, NOW, planPersonRows, seededBackend, TODAY, USER_ID } from '../test/fixtures';
import { examplePhoto } from '../lib/example-photo';
import { createRemoteFoodPhoto, readWebUrl } from './food-photo-remote';
import type { UserRows } from './types';

const reis = {
  id: 'reis',
  version: 1,
  status: 'draft',
  name_de: 'Reis parboiled',
  aliases_de: [],
  units: {},
  nutrients_per_100g: { ...zeroNutrients(), kcal: 349, protein_g: 7.3, carbs_g: 76, fat_g: 0.8 },
} as never;
const foods = new Map([['reis', reis]]) as never;

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function rows(photo = true, health = true): UserRows {
  const base = planPersonRows({ consent: health ? 'valid' : 'none' });
  return {
    ...base,
    consents: [
      ...base.consents,
      ...(photo
        ? [{ ...consent('terms'), consent_type: 'ai_food_photo' as const, id: 'c-photo' }]
        : []),
    ],
  };
}

function stored(store: { dump: () => Record<string, string> }) {
  return JSON.parse(store.dump()['fitnessapp.local.v1'] ?? '{}') as {
    aiUsage?: Record<string, unknown>[];
  };
}

describe('Per Foto im Testmodus (Attrappe)', () => {
  it('Status: verfügbar, Attrappe, 30 im Monat / 8 heute', async () => {
    const { backend } = seededBackend(rows());
    const s = await backend.foodPhotoStatus();
    expect(s).toMatchObject({ availability: 'available', mock: true });
    expect(s.limit).toMatchObject({ remainingMonth: 30, remainingToday: 8, blocked: null });
  });

  it('ohne Foto- bzw. Gesundheits-Einwilligung → no_consent, nichts gespeichert', async () => {
    for (const r of [rows(false, true), rows(true, false)]) {
      const { backend, store } = seededBackend(r);
      expect(await backend.analyzeFoodPhoto({ image: examplePhoto(), note: null })).toEqual({
        code: 'no_consent',
      });
      expect(stored(store).aiUsage ?? []).toEqual([]);
    }
  });

  it('Beispielantwort → Vorschlag; ai_usage nur Metadaten (keine Info, kein Bild, keine Antwort)', async () => {
    const { backend, store } = seededBackend(rows());
    const r = await backend.analyzeFoodPhoto({
      image: examplePhoto(),
      note: 'halbe Portion, Essanfall',
    });
    expect(r).toMatchObject({ code: 'ok', remaining_month: 29, remaining_today: 7, mock: true });
    const usage = stored(store).aiUsage ?? [];
    expect(usage).toHaveLength(1);
    expect(Object.keys(usage[0] ?? {}).sort()).toEqual([
      'cost_eur',
      'created_at',
      'feature',
      'finished_at',
      'id',
      'input_tokens',
      'model',
      'output_tokens',
      'status',
      'user_id',
    ]);
    expect(usage[0]).toMatchObject({
      status: 'succeeded',
      model: 'attrappe',
      cost_eur: 0,
      user_id: USER_ID,
    });
    const dump = JSON.stringify(store.dump());
    expect(dump).not.toContain('Essanfall');
    expect(dump).not.toContain('Hähnchenbrust gegrillt');
    expect((await backend.foodPhotoStatus()).limit?.remainingMonth).toBe(29);
  });

  it('kaputte Antwort und Zeitlimit zählen nicht gegen das Limit', async () => {
    const { backend } = seededBackend(rows());
    expect(await backend.analyzeFoodPhoto({ image: examplePhoto(), note: 'test:kaputt' })).toEqual({
      code: 'invalid_answer',
    });
    expect(
      await backend.analyzeFoodPhoto({ image: examplePhoto(), note: 'test:zeitlimit' }),
    ).toEqual({
      code: 'timeout',
    });
    expect((await backend.foodPhotoStatus()).limit).toMatchObject({ dayUsed: 0, attemptsToday: 2 });
  });

  it('Tageslimit: 8. Foto geht, 9. nicht (ab morgen)', async () => {
    const { backend } = seededBackend(rows());
    for (let i = 0; i < 8; i += 1) {
      expect((await backend.analyzeFoodPhoto({ image: examplePhoto(), note: null })).code).toBe(
        'ok',
      );
    }
    expect(await backend.analyzeFoodPhoto({ image: examplePhoto(), note: null })).toEqual({
      code: 'limit',
      scope: 'day',
      available_from: '2026-10-04',
    });
  });

  it('ungültige Info und kein Bild werden vor der Reservierung abgelehnt', async () => {
    const { backend, store } = seededBackend(rows());
    expect(
      await backend.analyzeFoodPhoto({ image: examplePhoto(), note: 'x'.repeat(121) }),
    ).toEqual({
      code: 'note_too_long',
    });
    expect(
      await backend.analyzeFoodPhoto({ image: new Uint8Array([1, 2, 3]), note: null }),
    ).toEqual({
      code: 'image_type',
    });
    expect(stored(store).aiUsage ?? []).toEqual([]);
  });

  it('Eintragen mit Herkunft photo, Werte aus dem Katalog; Widerruf ai_food_photo stoppt nur neue Fotos', async () => {
    const { backend } = seededBackend(rows());
    const items: PhotoResultItem[] = [
      { label_de: 'Reis', food_id: 'reis', amount_g: 180, confidence: 0.9 },
    ];
    const built = photoEntries(
      matchPhotoItems(items, foods),
      foods,
      { date: TODAY, slot: 'lunch' },
      [],
      () => ID(1),
    );
    if (!built.ok) throw new Error(built.reason);
    let next = await backend.saveFoodLogEntries(built.entries, rows());
    expect(next.foodLogEntries[0]).toMatchObject({
      source: 'photo',
      unit: 'g',
      amount: 180,
      kcal: 628,
    });
    await backend.revokeConsent('ai_food_photo');
    next = (await backend.loadRows()).rows;
    expect(next.foodLogEntries).toHaveLength(1);
    expect(await backend.analyzeFoodPhoto({ image: examplePhoto(), note: null })).toEqual({
      code: 'no_consent',
    });
  });

  it('Export enthält ai_usage (Metadaten) und eine leere Beta-Freischaltung; Konto löschen entfernt alles', async () => {
    const { backend, store } = seededBackend(rows());
    await backend.analyzeFoodPhoto({ image: examplePhoto(), note: null });
    const file = await backend.exportMyData();
    expect(file.data.ai_usage).toHaveLength(1);
    expect(file.data.beta_entitlements).toEqual([]);
    await backend.deleteAccount();
    expect(stored(store).aiUsage).toBeUndefined();
  });
});

describe('Per Foto im Supabase-Modus (Ersatz-fetch, kein echtes Netz)', () => {
  const session = { access_token: 'eyJ.token.x' };
  const client = (access: unknown, usage: unknown[] = []) =>
    ({
      auth: { getSession: () => Promise.resolve({ data: { session }, error: null }) },
      rpc: vi.fn(() => Promise.resolve({ data: access, error: null })),
      from: () => ({
        select: () => ({
          eq: () => ({ gte: () => Promise.resolve({ data: usage, error: null }) }),
        }),
      }),
    }) as unknown as AppSupabaseClient;

  it('readWebUrl: nur https', () => {
    expect(readWebUrl('https://web.example/')).toBe('https://web.example');
    expect(readWebUrl('http://web.example')).toBeNull();
    expect(readWebUrl(undefined)).toBeNull();
    expect(readWebUrl('javascript:alert(1)')).toBeNull();
  });

  it('ohne Adresse der Website: nicht verfügbar, kein Aufruf', async () => {
    const c = client({ active: true, reason: 'ok' });
    const remote = createRemoteFoodPhoto({ client: c, webUrl: null, now: () => NOW });
    expect(await remote.foodPhotoStatus()).toEqual({
      availability: 'not_configured',
      limit: null,
      mock: false,
    });
    expect(c.rpc).not.toHaveBeenCalled();
  });

  it('Freischaltung aus der Datenbank, Kontingent aus ai_usage', async () => {
    const off = createRemoteFoodPhoto({
      client: client({ active: false, reason: 'no_entitlement' }),
      webUrl: 'https://web.example',
      now: () => NOW,
    });
    expect((await off.foodPhotoStatus()).availability).toBe('no_entitlement');
    const on = createRemoteFoodPhoto({
      client: client({ active: true, reason: 'ok' }, [
        { created_at: NOW, status: 'succeeded' },
        { created_at: NOW, status: 'failed' },
      ]),
      webUrl: 'https://web.example',
      now: () => NOW,
    });
    expect((await on.foodPhotoStatus()).limit).toMatchObject({ monthUsed: 1, remainingMonth: 29 });
  });

  it('Auswertung: Bearer-Token, Formular mit Bild und Info; Antwort per Zod geprüft', async () => {
    const answer: FoodPhotoResponse = {
      code: 'no_food',
      remaining_month: 3,
      remaining_today: 2,
      mock: false,
    };
    const fetchFn = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://web.example/api/ernaehrung/foto');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer eyJ.token.x');
      const form = init?.body as FormData;
      expect([...form.keys()].sort()).toEqual(['image', 'note']);
      return Promise.resolve(Response.json(answer));
    });
    const remote = createRemoteFoodPhoto({
      client: client({ active: true, reason: 'ok' }),
      webUrl: 'https://web.example',
      now: () => NOW,
      fetchFn,
    });
    expect(await remote.analyzeFoodPhoto({ image: examplePhoto(), note: 'halbe Portion' })).toEqual(
      answer,
    );
    // Unerwartete Antwort (z. B. kcal der KI) → Fehler, nichts übernommen.
    const bad = createRemoteFoodPhoto({
      client: client({ active: true, reason: 'ok' }),
      webUrl: 'https://web.example',
      now: () => NOW,
      fetchFn: () =>
        Promise.resolve(
          Response.json({
            code: 'ok',
            items: [{ label_de: 'x', food_id: null, amount_g: 1, confidence: 1, kcal: 9 }],
            remaining_month: 1,
            remaining_today: 1,
            mock: false,
          }),
        ),
    });
    await expect(bad.analyzeFoodPhoto({ image: examplePhoto(), note: null })).rejects.toMatchObject(
      {
        code: 'unknown',
      },
    );
    const offline = createRemoteFoodPhoto({
      client: client({ active: true, reason: 'ok' }),
      webUrl: 'https://web.example',
      now: () => NOW,
      fetchFn: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    await expect(
      offline.analyzeFoodPhoto({ image: examplePhoto(), note: null }),
    ).rejects.toMatchObject({
      code: 'network',
    });
  });
});
