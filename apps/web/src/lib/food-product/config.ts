/**
 * Einstellungen der Produktabfrage (Etappe E4a, docs/PLAN-E4.md 3.2; docs/SETUP.md Teil „Produktabfrage“) aus den
 * Umgebungsvariablen des Vercel-Projekts „Web“. Gründe nennen nur Variablennamen, nie Werte.
 *
 * Open Food Facts verlangt einen User-Agent mit Kontaktadresse (Plan 1.2): `Alpha5/<Version> (<OFF_CONTACT_EMAIL>)`.
 * Fehlt die Adresse (oder ist sie ungültig), fragt der Server NIE bei OFF an – die Route antwortet `not_configured`.
 * Zusätzlich muss das Feature-Flag `food_product_lookup` in der Datenbank an sein (Standard aus; Workflow beta-grant).
 */
import { OPEN_FOOD_FACTS } from '@fitnessapp/core';

type Env = Readonly<Record<string, string | undefined>>;

/** Version im User-Agent (sync: apps/web/package.json „version“, handler.test.ts). */
export const APP_VERSION = '0.1.0';

export interface FoodProductConfig {
  readonly supabaseUrl: string;
  /** Öffentlicher Schlüssel – nur, um das Login-Token bei Supabase prüfen zu lassen. */
  readonly supabasePublishableKey: string;
  /** Geheimer Schlüssel (service_role) – nur für food_product_lookup/upsert/backoff. Nie im Browser. */
  readonly supabaseServiceKey: string;
  /** Fertiger User-Agent für OFF (enthält nur App, Version und die Funktions-Kontaktadresse). */
  readonly userAgent: string;
}

export type FoodProductConfigResult =
  | { readonly status: 'ok'; readonly config: FoodProductConfig }
  | { readonly status: 'disabled'; readonly reasons: readonly string[] };

const clean = (value: string | undefined) => value?.trim() ?? '';
const EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}$/;

export function readFoodProductConfig(env: Env): FoodProductConfigResult {
  const supabaseUrl = clean(env.SUPABASE_URL) || clean(env.NEXT_PUBLIC_SUPABASE_URL);
  const supabasePublishableKey = clean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const supabaseServiceKey = clean(env.SUPABASE_SERVICE_ROLE_KEY) || clean(env.SUPABASE_SECRET_KEY);
  const contact = clean(env.OFF_CONTACT_EMAIL);
  const reasons: string[] = [];
  if (!/^https:\/\/[^\s/]+/.test(supabaseUrl)) {
    reasons.push('SUPABASE_URL bzw. NEXT_PUBLIC_SUPABASE_URL fehlt (https://…).');
  }
  if (!supabasePublishableKey) reasons.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY fehlt.');
  if (!supabaseServiceKey) reasons.push('SUPABASE_SERVICE_ROLE_KEY fehlt.');
  if (!EMAIL.test(contact)) reasons.push('OFF_CONTACT_EMAIL fehlt bzw. ist keine E-Mail-Adresse.');
  if (reasons.length > 0) return { status: 'disabled', reasons };
  return {
    status: 'ok',
    config: {
      supabaseUrl: supabaseUrl.replace(/\/+$/, ''),
      supabasePublishableKey,
      supabaseServiceKey,
      userAgent: `${OPEN_FOOD_FACTS.userAgentApp}/${APP_VERSION} (${contact})`,
    },
  };
}
