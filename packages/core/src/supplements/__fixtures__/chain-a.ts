/**
 * ABSICHTLICH VERBOTEN – Test des Tests (Kette A → B → retail/provider.ts, Wächter SU1 Befund 9): Diese Datei hat nur
 * einen erlaubten direkten Dateipfad-Import; erst über chain-b.ts erreicht sie den Händler-Code. Der transitive
 * Strukturtest muss das finden.
 */
export * from './chain-b';
