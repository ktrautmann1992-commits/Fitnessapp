/**
 * Zod-Fehler → Meldungen je Feld (für die Anzeige direkt unter dem Eingabefeld).
 * Die Meldungstexte selbst kommen aus den Schemas in packages/core.
 */

interface IssueLike {
  readonly path: readonly PropertyKey[];
  readonly message: string;
  readonly code?: string;
}

/** Schlüssel für Fehler ohne Feldbezug (z. B. „mindestens ein Umfang“). */
export const FORM_ERROR = '_form';

export type FieldErrors = Record<string, string>;

/**
 * Erste Meldung je Feld. Feld = erstes Pfad-Element (bei Listen: „feld.index“, z. B. „items.0“).
 * Fehlt ein Wert ganz (Typfehler, z. B. nichts ausgewählt), passt ein eigener Text oft besser
 * („Bitte wähle …“) – dafür kann je Feld ein deutscher Ersatztext mitgegeben werden (`fallback`).
 * Er ersetzt auch englische Standardmeldungen von Zod.
 */
export function fieldErrorsFromIssues(
  issues: readonly IssueLike[],
  fallback: Readonly<Record<string, string>> = {},
): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const [first, second] = issue.path;
    const key =
      first === undefined
        ? FORM_ERROR
        : typeof second === 'number'
          ? `${String(first)}.${second}`
          : String(first);
    if (errors[key] !== undefined) {
      continue;
    }
    const isTechnical =
      issue.code === 'invalid_type' || /^(Invalid|Expected|expected|Too)/.test(issue.message);
    const rootKey = first === undefined ? FORM_ERROR : String(first);
    errors[key] = isTechnical
      ? (fallback[key] ?? fallback[rootKey] ?? issue.message)
      : issue.message;
  }
  return errors;
}
