import { type ContentMeta, type ContentStatus, isDryRunContent } from '@fitnessapp/core';

/**
 * Zählt ein vorhandener Eintrag als „schon da“ (Zelle wird übersprungen)? Zurückgezogene nicht, und Probelauf-Inhalte
 * (ohne KI, nie freigebbar) auch nicht – sonst bekäme ein Lebensmittel nach einem versehentlich gemergten Probelauf nie
 * einen echten Eintrag (Wächter N11 S3; gilt für Austausch-Tabelle und Packungsgrößen).
 */
export function countsAsPresent(entry: {
  readonly id: string;
  readonly status: ContentStatus;
  readonly meta: ContentMeta;
}): boolean {
  return entry.status !== 'archived' && !isDryRunContent(entry);
}
