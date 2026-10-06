/**
 * „Übersetztes Dokument“ (docs/PLAN-PDF-EXPORT.md §6, Wächter B11): packages/core liefert Codes und Daten, die App
 * übersetzt sie (i18n) in fertige Texte, packages/ui rendert daraus HTML. Hier stehen NUR fertige Texte – keine
 * Fachlogik, keine Codes.
 */

export type TranslatedOrientation = 'portrait' | 'landscape';

/** Art einer Tabellenspalte: Beschriftung (Zeilenkopf), Wert oder leeres Mitschreib-Feld. */
export type TranslatedColumnRole = 'label' | 'value' | 'log';

export interface TranslatedTable {
  readonly type: 'table';
  readonly caption: string;
  /** Titel zugleich als Überschrift dieser Ebene (sonst Absatz). */
  readonly captionLevel?: 2 | 3;
  readonly columns: readonly { readonly header: string; readonly role: TranslatedColumnRole }[];
  /** Zeilenkopf und Zellen jeweils als Zeilen untereinander (leer = Feld zum Ausfüllen). */
  readonly rows: readonly {
    readonly header: readonly string[];
    readonly cells: readonly (readonly string[])[];
  }[];
}

export type TranslatedBlock =
  | { readonly type: 'heading'; readonly level: 1 | 2 | 3; readonly text: string }
  | { readonly type: 'paragraph'; readonly text: string; readonly muted?: boolean }
  | {
      readonly type: 'keyValue';
      readonly items: readonly { readonly label: string; readonly value: string }[];
    }
  | TranslatedTable
  | { readonly type: 'notice'; readonly title: string; readonly text: string }
  | { readonly type: 'pageBreak'; readonly orientation: TranslatedOrientation };

export interface TranslatedDocument {
  /** Sprache des Dokuments (BCP 47, z. B. „de“ oder „de-AT“). */
  readonly lang: string;
  /** Titel ohne Namen (B7) – erscheint im Browser-Tab und als Vorschlag für den Dateinamen. */
  readonly title: string;
  /** Fußzeile jeder Seite. */
  readonly footer: string;
  /** Text-Alternative für das Logo (Screenreader). */
  readonly logoLabel: string;
  /** Erste Seite hochkant; jeder `pageBreak` beginnt eine neue Seite. */
  readonly blocks: readonly TranslatedBlock[];
}
