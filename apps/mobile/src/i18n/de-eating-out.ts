/**
 * Texte „Auswärts essen“ (Reiter „Unterwegs“ beim Eintragen, Gründer-Freigabe 25.10.2026). Ruhige, neutrale Sprache
 * wie im Tagebuch: keine Bewertung des Essens. Werte sind immer Schätzungen („ca.“, Kennzeichen „Schätzwert“). Bei
 * „Kalorienzahlen aus“ keine kcal. Wird in `de.ts` unter `eatingOut` eingebunden.
 */
export const deEatingOut = {
  title: 'Unterwegs gegessen',
  intro:
    'Typische Gerichte aus Restaurant, Imbiss, Kantine, Bäckerei, Café und Fast Food. Die Werte sind Schätzungen für eine übliche Portion – berechnet aus unserem Lebensmittel-Katalog.',
  estimateBadge: 'Schätzwert',
  estimateA11y: 'Schätzwert – typische Portion, kann deutlich abweichen',
  loggedAs:
    'Im Tagebuch steht das Gericht als „Auswärts gegessen“ mit den ca.-Werten – den Namen speichern wir nicht.',
  categoryLabel: 'Wo hast du gegessen?',
  categoryAll: 'Alle',
  searchLabel: 'Gericht suchen',
  searchHint: 'z. B. „Schnitzel“ oder „Cappuccino“',
  favoritesTitle: 'Deine Favoriten',
  recentTitle: 'Zuletzt unterwegs',
  allTitle: 'Gerichte',
  count: (n: number) => (n === 1 ? '1 Gericht' : `${n} Gerichte`),
  kcal: (kcal: number) => `ca. ${kcal.toLocaleString('de-DE')} kcal`,
  macros: (protein: number, carbs: number, fat: number) =>
    `ca. ${protein} g Eiweiß · ${carbs} g Kohlenhydrate · ${fat} g Fett`,
  portionLabel: 'Portion',
  portionWithKcal: (label: string, kcal: number) => `${label} · ca. ${kcal} kcal`,
  pickA11y: (name: string) => `${name} auswählen`,
  add: 'Eintragen',
  addA11y: (name: string, portion: string) => `${name}, ${portion}, eintragen`,
  quickPick: (name: string, portion: string) => `${name} · ${portion}`,
  quickPickA11y: (name: string, portion: string) => `${name}, ${portion}, sofort eintragen`,
  favoriteAdd: 'Als Favorit merken',
  favoriteRemove: 'Aus Favoriten entfernen',
  saved: (name: string) => `Eingetragen: ${name} (Schätzwert).`,
  empty: 'Kein Gericht gefunden. Versuch einen anderen Namen oder trag es schnell selbst ein.',
  noneAvailable:
    'Die Gerichte für unterwegs kommen bald. Bis dahin kannst du „Auswärts gegessen“ über „Schnell“ eintragen.',
  toQuick: 'Selbst schätzen (Schnell)',
  picksLocal:
    'Favoriten und „Zuletzt“ merkt sich nur dieses Gerät (nur die Gerichte, keine Uhrzeit).',
  basis: (basis: string) => `normal = ${basis}`,
};
