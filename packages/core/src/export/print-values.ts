import { z } from 'zod';

/**
 * Gemeinsame Bausteine der Druck-Schemas (docs/PLAN-PDF-EXPORT.md §6, B7): freie Inhalte ohne Steuer- und
 * Formatzeichen, begrenzte Länge. Eigene Datei, damit Trainings- und Ernährungs-Codes sie ohne Zirkelbezug nutzen.
 */
export const printDataValueSchema = z
  .string()
  .max(600)
  .regex(/^[^\p{Cc}\p{Cf}]*$/u, 'Keine Steuer- oder Formatzeichen.');

/** Inhalt für den Druck säubern: Zeilenumbrüche zu Leerzeichen, Steuer-/Formatzeichen weg, höchstens 600 Zeichen. */
export function cleanPrintContent(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .slice(0, 600);
}
