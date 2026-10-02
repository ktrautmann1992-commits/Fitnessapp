import { z } from 'zod';

/**
 * Öffentliche Supabase-Konfiguration. Beide Werte dürfen im Browser/in der App landen –
 * der Schutz der Daten erfolgt über Row Level Security in der Datenbank.
 */
export const supabasePublicConfigSchema = z.object({
  url: z.url().refine((value) => value.startsWith('https://'), {
    message: 'Die Supabase-URL muss mit https:// beginnen.',
  }),
  publishableKey: z.string().min(20, 'Der Supabase-Schlüssel ist zu kurz.'),
});

export type SupabasePublicConfig = z.infer<typeof supabasePublicConfigSchema>;

export type SupabaseConfigResult =
  | { status: 'ok'; config: SupabasePublicConfig }
  | { status: 'missing' }
  | { status: 'invalid'; issues: string[] };

/**
 * Prüft die Supabase-Werte aus den Umgebungsvariablen.
 * Fehlen beide Werte, gilt die Datenbank als „noch nicht verbunden“ – das ist in Phase 0 erlaubt
 * und darf die App nicht abstürzen lassen.
 */
export function readSupabasePublicConfig(input: {
  url: string | undefined;
  publishableKey: string | undefined;
}): SupabaseConfigResult {
  const url = input.url?.trim() || undefined;
  const publishableKey = input.publishableKey?.trim() || undefined;
  if (!url && !publishableKey) {
    return { status: 'missing' };
  }
  const parsed = supabasePublicConfigSchema.safeParse({ url, publishableKey });
  if (!parsed.success) {
    return { status: 'invalid', issues: parsed.error.issues.map((issue) => issue.message) };
  }
  return { status: 'ok', config: parsed.data };
}
