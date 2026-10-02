import {
  createSupabaseClient,
  readSupabasePublicConfig,
  type AppSupabaseClient,
} from '@fitnessapp/db';

/**
 * Supabase-Konfiguration der App. EXPO_PUBLIC_-Variablen werden beim Build eingesetzt
 * (lokal aus .env, auf Vercel aus den Environment Variables, bei EAS aus den Expo-Umgebungsvariablen).
 */
export const supabaseConfig = readSupabasePublicConfig({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

let client: AppSupabaseClient | null = null;

/** Liefert den Supabase-Client oder `null`, solange Supabase noch nicht verbunden ist. */
export function getSupabase(): AppSupabaseClient | null {
  if (supabaseConfig.status !== 'ok') {
    return null;
  }
  // Sitzungen werden erst mit der Anmeldung (Phase 1) sicher gespeichert.
  client ??= createSupabaseClient(supabaseConfig.config, { auth: { persistSession: false } });
  return client;
}
