/**
 * Platzhalter für die aus Supabase generierten Datenbank-Typen.
 *
 * Ab Phase 1 (erste Tabellen) wird diese Datei automatisch per GitHub Action erzeugt
 * (`supabase gen types typescript`) und nicht mehr von Hand bearbeitet.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
