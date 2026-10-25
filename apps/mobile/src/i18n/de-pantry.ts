/**
 * Texte „Vorratsschrank“ (Gründer-Freigabe 25.10.2026). Wird in `de.ts` unter `pantry` eingebunden.
 */
export const dePantry = {
  title: 'Vorratsschrank',
  open: 'Vorratsschrank',
  openHint: 'Was du zu Hause hast – die Einkaufsliste rechnet es ab.',
  intro:
    'Trag ein, was du zu Hause hast. Die Einkaufsliste lässt es weg oder zieht die Menge ab, und „Was habe ich da?“ schlägt Rezepte mit deinem Vorrat zuerst vor.',
  privacy:
    'Dein Vorrat kann zeigen, was du isst – wir behandeln ihn wie Gesundheitsdaten: nur mit deiner Einwilligung, nur für dich, im Datenexport enthalten und beim Widerruf gelöscht.',
  consentNeeded:
    'Für den Vorratsschrank brauchen wir deine Einwilligung zu Gesundheitsdaten (dein Vorrat kann zeigen, was du isst).',
  consentButton: 'Einwilligung erteilen',
  empty: 'Dein Vorrat ist noch leer. Such unten ein Lebensmittel oder scanne einen Strichcode.',
  count: (n: number) => (n === 1 ? '1 Lebensmittel im Vorrat' : `${n} Lebensmittel im Vorrat`),
  addTitle: 'Hinzufügen',
  searchLabel: 'Lebensmittel suchen',
  searchHint: 'z. B. „Haferflocken“ oder „Olivenöl“',
  searchShort: 'Mindestens 2 Buchstaben.',
  searchNone: 'Kein Lebensmittel mit diesem Namen in unserem Katalog.',
  addA11y: (name: string) => `${name} zum Vorrat hinzufügen`,
  alreadyIn: 'im Vorrat',
  added: (name: string) => `${name} ist jetzt im Vorrat.`,
  removed: (name: string) => `${name} aus dem Vorrat entfernt.`,
  have: 'da',
  haveA11y: 'vorhanden, ohne Menge',
  low: 'fast leer',
  lowToggle: 'Fast leer',
  lowA11y: (name: string) => `${name}: fast leer`,
  amountLabel: 'Menge',
  amountNone: 'Ohne Menge',
  amountEdit: 'Menge',
  amountA11y: (name: string) => `Menge von ${name} ändern`,
  less: 'Weniger',
  more: 'Mehr',
  packSize: 'Packungsgröße',
  done: 'Schließen',
  remove: 'Entfernen',
  removeA11y: (name: string) => `${name} aus dem Vorrat entfernen`,
  clearAll: 'Vorrat leeren',
  clearTitle: 'Ganzen Vorrat leeren?',
  clearText: 'Alle Einträge im Vorratsschrank werden gelöscht.',
  clearConfirm: 'Leeren',
  cleared: 'Dein Vorrat ist leer.',
  unknownGroup: 'Nicht mehr im Katalog',
  stockNote: 'Öl, Essig, Gewürze: einfach „da“ oder „fast leer“.',
  toRecipes: 'Rezepte mit meinem Vorrat',
  scanTitle: 'Strichcode scannen',
  scanHint: 'Scanne eine Packung – wir ordnen sie einem Lebensmittel aus unserem Katalog zu.',
  scanChoose: 'Welches Lebensmittel ist es?',
  scanNone:
    'Dieses Produkt konnten wir keinem Lebensmittel zuordnen. Such es bitte oben über den Namen.',
  scanFound: (name: string) => `Erkannt: ${name}`,
  scanAdd: (name: string) => `${name} zum Vorrat hinzufügen`,
  offline: 'Ohne Verbindung funktioniert das Scannen nur mit bereits gelernten Strichcodes.',
  errors: {
    limit: 'Dein Vorrat ist voll (höchstens 300 Lebensmittel). Entferne zuerst etwas.',
  },
  // Einkaufsliste
  shopping: {
    inPantryTitle: 'Schon im Vorrat',
    inPantryShow: (n: number) => `Anzeigen (${n})`,
    inPantryHide: 'Ausblenden',
    inPantryHint: 'Laut deinem Vorratsschrank hast du das schon da – es zählt nicht zum Einkauf.',
    checkAmount: 'Menge prüfen',
    covered: 'reicht laut Vorrat',
    partial: 'Rest – einen Teil hast du im Vorrat',
    low: 'Vorrat fast leer',
    update: 'Vorrat nach Einkauf aktualisieren',
    updateHint:
      'Abgehakte haltbare Produkte (z. B. Nudeln, Konserven, Öl, Tiefkühl) kommen mit der gekauften Menge in deinen Vorrat. Frisches bleibt draußen.',
    updated: (added: number, updated: number, fresh: number) =>
      [
        added + updated === 0
          ? 'Keine haltbaren Produkte abgehakt.'
          : `${added + updated} ${added + updated === 1 ? 'Produkt' : 'Produkte'} im Vorrat aktualisiert.`,
        fresh > 0 ? `${fresh} frische ${fresh === 1 ? 'bleibt' : 'bleiben'} draußen.` : null,
      ]
        .filter(Boolean)
        .join(' '),
    full: 'Nicht alles passte in den Vorrat (höchstens 300 Lebensmittel).',
    link: 'Vorratsschrank öffnen',
  },
  // Kühlschrank-Suche
  fridge: {
    usePantry: 'Meinen Vorrat mitzählen',
    usePantryHint: (n: number) =>
      n === 1
        ? '1 Lebensmittel aus deinem Vorrat zählt als vorhanden.'
        : `${n} Lebensmittel aus deinem Vorrat zählen als vorhanden.`,
    fromPantry: (list: string) => `Aus deinem Vorratsschrank: ${list}`,
    pantryOnly: 'Passt zu deinem Vorrat',
    pantryOnlyHint:
      'Noch nichts ausgewählt – diese Rezepte nutzen, was in deinem Vorratsschrank steht.',
  },
};
