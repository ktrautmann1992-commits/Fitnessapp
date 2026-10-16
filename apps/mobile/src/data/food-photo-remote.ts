import {
  DEFAULT_PHOTO_LIMITS,
  detectPhotoType,
  foodPhotoResponseSchema,
  photoLimitState,
  type AiUsageRecord,
  type FoodPhotoResponse,
} from '@fitnessapp/core';
import type { AppSupabaseClient } from '@fitnessapp/db';
import { z } from 'zod';

import { BackendError, type Backend, type FoodPhotoStatus } from './backend';

/**
 * Gericht per Foto im SUPABASE-MODUS (Etappe E3): Freischaltung (`ai_food_photo_access`), Kontingent aus den eigenen
 * ai_usage-Zeilen (RLS, nur Zeitpunkt und Status) und die Auswertung über die Route POST /api/ernaehrung/foto in
 * apps/web (Login-Token als Bearer; Premium, Einwilligung und Limit prüft der Server). Das Foto geht nur in dieser
 * Anfrage über die Leitung und wird nirgends gespeichert. Fehler ohne Inhalte.
 */

/** Adresse von apps/web (EXPO_PUBLIC_WEB_URL, nur https). null = Funktion nicht verfügbar. */
export function readWebUrl(value: string | undefined): string | null {
  const url = value?.trim() ?? '';
  return /^https:\/\/[^\s/?#]+(?:\/[^\s?#]*)?$/.test(url) ? url.replace(/\/+$/, '') : null;
}

const accessSchema = z.object({
  active: z.boolean(),
  reason: z.enum(['ok', 'flag_off', 'no_entitlement']),
});
const usageRowSchema = z.object({
  created_at: z.string(),
  status: z.enum(['reserved', 'succeeded', 'failed']),
});

const NETWORK = /failed to fetch|fetch failed|network request failed|networkerror|load failed/i;

export function createRemoteFoodPhoto(options: {
  client: AppSupabaseClient;
  webUrl: string | null;
  now: () => string;
  fetchFn?: typeof fetch;
}): Pick<Backend, 'foodPhotoStatus' | 'analyzeFoodPhoto'> {
  const { client, webUrl } = options;
  const fetchFn = options.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function accessToken(): Promise<string> {
    const { data, error } = await client.auth.getSession();
    const token = data.session?.access_token;
    if (error || !token) throw new BackendError('not_signed_in');
    return token;
  }

  const toError = (error: unknown): BackendError =>
    error instanceof BackendError
      ? error
      : new BackendError(
          error instanceof TypeError || NETWORK.test((error as Error | undefined)?.message ?? '')
            ? 'network'
            : 'unknown',
          { sensitive: true },
        );

  return {
    async foodPhotoStatus(): Promise<FoodPhotoStatus> {
      if (webUrl === null) return { availability: 'not_configured', limit: null, mock: false };
      try {
        await accessToken();
        const access = await client.rpc('ai_food_photo_access');
        if (access.error) throw toError(access.error);
        const parsed = accessSchema.safeParse(access.data);
        if (!parsed.success) throw new BackendError('unknown');
        if (!parsed.data.active) {
          return {
            availability: parsed.data.reason === 'flag_off' ? 'flag_off' : 'no_entitlement',
            limit: null,
            mock: false,
          };
        }
        // Kalendermonat Europe/Berlin liegt sicher in den letzten 32 Tagen.
        const since = new Date(Date.parse(options.now()) - 32 * 86_400_000).toISOString();
        const usage = await client
          .from('ai_usage')
          .select('created_at, status')
          .eq('feature', 'food_photo')
          .gte('created_at', since);
        if (usage.error) throw toError(usage.error);
        const rows: AiUsageRecord[] = [];
        for (const row of usage.data ?? []) {
          const r = usageRowSchema.safeParse(row);
          if (r.success) rows.push(r.data);
        }
        return {
          availability: 'available',
          limit: photoLimitState(rows, DEFAULT_PHOTO_LIMITS, options.now()),
          mock: false,
        };
      } catch (error) {
        throw toError(error);
      }
    },

    async analyzeFoodPhoto({ image, note }): Promise<FoodPhotoResponse> {
      if (webUrl === null) return { code: 'not_configured' };
      const token = await accessToken();
      const form = new FormData();
      const type = detectPhotoType(image) ?? 'application/octet-stream';
      form.append('image', new Blob([image as BlobPart], { type }), 'foto');
      if (note !== null && note.trim() !== '') form.append('note', note);
      let response: Response;
      try {
        response = await fetchFn(`${webUrl}/api/ernaehrung/foto`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
      } catch (error) {
        throw toError(error instanceof Error ? error : new TypeError('fetch failed'));
      }
      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new BackendError(response.status >= 500 ? 'temporary' : 'unknown', {
          sensitive: true,
        });
      }
      const parsed = foodPhotoResponseSchema.safeParse(json);
      if (!parsed.success) throw new BackendError('unknown', { sensitive: true });
      return parsed.data;
    },
  };
}
