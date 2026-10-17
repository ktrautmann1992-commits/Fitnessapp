/**
 * Körper der Route POST /api/ernaehrung/produkt lesen (Etappe E4a) – erst NACH Herkunft, Konfiguration und Login
 * (handler.ts). Gestreamt mit hartem Byte-Limit (256 Byte, FOOD_PRODUCT_LOOKUP_LIMITS.maxBodyBytes); mehr → null.
 */
import { FOOD_PRODUCT_LOOKUP_LIMITS } from '@fitnessapp/core';

import { readBodyLimited } from '../food-photo/form';

export async function readFoodProductBody(
  request: Request,
  limit: number = FOOD_PRODUCT_LOOKUP_LIMITS.maxBodyBytes,
): Promise<string | null> {
  const body = await readBodyLimited(request, limit);
  if (body === null || body.byteLength === 0) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch {
    return null;
  }
}
