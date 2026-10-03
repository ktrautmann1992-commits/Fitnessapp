import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js';

import type { Database } from './database.types';
import type { SupabasePublicConfig } from './env';

export type AppSupabaseClient = SupabaseClient<Database>;

/**
 * Erzeugt einen Supabase-Client für App und Website.
 * Die Sitzungs-Speicherung (z. B. SecureStore in der App) wird in Phase 1 mit der Anmeldung ergänzt.
 */
export function createSupabaseClient(
  config: SupabasePublicConfig,
  options?: SupabaseClientOptions<'public'>,
): AppSupabaseClient {
  return createClient<Database>(config.url, config.publishableKey, options);
}
