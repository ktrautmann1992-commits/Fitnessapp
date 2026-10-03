import { readSupabasePublicConfig } from '@fitnessapp/db';

/**
 * Supabase-Konfiguration der App. EXPO_PUBLIC_-Variablen werden beim Build eingesetzt
 * (lokal aus .env, auf Vercel aus den Environment Variables, bei EAS aus den Expo-Umgebungsvariablen).
 * Fehlen sie, läuft die App im Testmodus (siehe src/data/create-backend.ts).
 */
export const supabaseConfig = readSupabasePublicConfig({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
