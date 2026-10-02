import {
  createSupabaseClient,
  readSupabasePublicConfig,
  type AppSupabaseClient,
} from '@fitnessapp/db';

/** Öffentliche Supabase-Konfiguration aus den Vercel-Umgebungsvariablen. */
export const supabaseConfig = readSupabasePublicConfig({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

/** Liefert einen Supabase-Client oder `null`, solange Supabase noch nicht verbunden ist. */
export function getSupabase(): AppSupabaseClient | null {
  if (supabaseConfig.status !== 'ok') {
    return null;
  }
  // Sitzungs-Cookies (Server-Komponenten) kommen mit der Anmeldung in Phase 1.
  return createSupabaseClient(supabaseConfig.config, { auth: { persistSession: false } });
}
