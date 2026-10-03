import { de, type Strings } from './de';

/**
 * Aktive Sprache. Derzeit nur Deutsch (Standard für de-DE, de-AT, de-CH).
 * Für Englisch: `en.ts` mit `export const en: Strings = { … }` anlegen und hier per Gerätesprache wählen.
 */
const translations = { de } satisfies Record<string, Strings>;

export const t: Strings = translations.de;
export type { Strings };
