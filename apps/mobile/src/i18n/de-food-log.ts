/**
 * Texte des Ernährungstagebuchs (Etappe E1, docs/PLAN-AUSWERTUNG.md Abschnitt 5, 2.3, 2.4). Ruhige, neutrale Sprache:
 * keine Bewertung des Essens, keine Schuld- oder Leistungswörter („geschafft“, „zu viel“, „verdient“, „Cheat“), keine
 * „verbrannten Kalorien“, keine Erinnerungen ans Eintragen. Bei „Kalorienzahlen aus“ keine kcal. Wird in `de.ts` unter
 * `foodLog` eingebunden.
 */
export const deFoodLog = {
  sectionTitle: 'Gegessen',
  add: 'Eintragen',
  addA11y: (day: string) => `Essen für ${day} eintragen`,
  empty: 'Noch nichts eingetragen.',
  emptyHint:
    'Tippe bei einer Mahlzeit auf „Wie geplant gegessen“ oder „Etwas anderes gegessen“ – oder trage frei ein.',
  count: (n: number) => (n === 1 ? '1 Eintrag' : `${n} Einträge`),
  summary: (count: string, kcal: string) => `${count} · ${kcal}`,
  withoutValue: (n: number) =>
    n === 1 ? 'Ein Eintrag ohne Kalorienangabe.' : `${n} Einträge ohne Kalorienangabe.`,
  macrosIncomplete: 'Nicht bei jedem Eintrag sind Eiweiß, Kohlenhydrate und Fett bekannt.',
  macros: (protein: string, carbs: string, fat: string) =>
    `Eiweiß ${protein} · Kohlenhydrate ${carbs} · Fett ${fat}`,
  estimate: 'Laut deinen Einträgen – Schätzwerte.',
  groups: {
    breakfast: 'Frühstück',
    main: 'Hauptmahlzeit',
    lunch: 'Mittag',
    dinner: 'Abend',
    snack: 'Snack',
  },
  manualSlots: {
    breakfast: 'Frühstück',
    lunch: 'Mittag',
    dinner: 'Abend',
    other: 'Snack',
  },
  slotQuestion: 'Mahlzeit',
  dateQuestion: 'Tag',
  today: 'Heute',
  yesterday: 'Gestern',
  earlier: 'Früher',
  later: 'Später',
  portion: (value: string) => (value === '1' ? '1 Portion' : `${value} Portionen`),
  amount: (value: string, unit: string) => `${value} ${unit}`,
  units: { g: 'g', ml: 'ml', piece: 'Stück' },
  kcal: (value: string) => `${value} kcal`,
  fromPlan: 'aus deinem Essensplan',
  planNotStored:
    'Dieser Plan war für diesen Tag nicht gespeichert – „Gegessen“ gibt es hier deshalb nicht. Eintragen geht trotzdem.',
  // „Gegessen“ an der Plan-Mahlzeit (Plan 5 Nr. 1)
  eaten: 'Wie geplant gegessen',
  eatenA11y: (title: string) => `${title}: wie geplant gegessen eintragen`,
  // „Etwas anderes gegessen“ (Gründer-Rückmeldung 14.11.2026): öffnet „Eintragen“ für genau diese Mahlzeit.
  eatenOther: 'Etwas anderes gegessen',
  eatenOtherA11y: (title: string) => `Statt ${title} etwas anderes eintragen`,
  eatenReplaced: (titles: string) => `Etwas anderes gegessen: ${titles}`,
  eatenReplacedMore: 'Noch etwas dazu eintragen',
  eatenReplacedMoreA11y: (title: string) => `Statt ${title}: noch etwas dazu eintragen`,
  eatenDone: (portion: string) => `Gegessen · ${portion}`,
  eatenPortionQuestion: 'Wie viel davon?',
  eatenUndo: 'Nicht gegessen',
  eatenUndoA11y: (title: string) => `${title}: Eintrag entfernen`,
  // Einträge
  edit: 'Ändern',
  editA11y: (title: string) => `${title} ändern`,
  delete: 'Löschen',
  deleteA11y: (title: string) => `${title} löschen`,
  deleteTitle: 'Eintrag löschen?',
  deleteText: 'Der Eintrag wird aus deinem Tagebuch gelöscht.',
  deleted: 'Eintrag gelöscht.',
  favoriteAdd: 'Als Favorit merken',
  favoriteAddA11y: (title: string) => `${title} als Favorit merken`,
  favoriteRemove: 'Favorit entfernen',
  favoriteRemoveA11y: (title: string) => `${title} aus den Favoriten entfernen`,
  favoriteOn: '★ Favorit',
  // Bildschirm „Eintragen“
  screenTitle: 'Eintragen',
  editTitle: 'Eintrag ändern',
  tabs: {
    recent: 'Zuletzt',
    favorites: 'Favoriten',
    search: 'Suche',
    out: 'Unterwegs',
    quick: 'Schnell',
  },
  tabsLabel: 'Wie möchtest du eintragen?',
  recentEmpty:
    'Hier erscheint, was du zuletzt eingetragen hast. Nutze die Suche oder den Schnelleintrag.',
  favoritesEmpty: 'Noch keine Favoriten. Tippe bei einem Eintrag auf „Als Favorit merken“.',
  addThis: 'Eintragen',
  addThisA11y: (title: string) => `${title} eintragen`,
  searchLabel: 'Lebensmittel oder Rezept suchen',
  searchHint: 'Mindestens 2 Buchstaben, z. B. „Käse“, „Brot“ oder „Banane“.',
  searchFoods: 'Lebensmittel',
  // Etappe E4a: nur die eigenen Produkte (nie Produkte aus Open Food Facts in der Katalog-Suche).
  searchOwnProducts: 'Deine Produkte',
  searchRecipes: 'Rezepte',
  searchNone: 'Dazu haben wir nichts gefunden.',
  searchNoneQuick: 'Schnelleintrag stattdessen',
  choose: 'Auswählen',
  chooseA11y: (title: string) => `${title} auswählen`,
  amountLabel: 'Menge',
  amountInvalid: 'Bitte eine Menge eingeben, z. B. 150 g oder 1 Stück.',
  amountRange: 'g und ml: 1–2.000, Stück: ½ bis 20 (in halben Schritten).',
  unitLabel: 'Einheit',
  pieceUnavailable:
    'Für dieses Lebensmittel kennen wir kein Gewicht je Stück – bitte in Gramm eintragen.',
  servingsLabel: 'Portionen',
  quickLabel: 'Was war es?',
  quickKcal: 'Kalorien (kcal, optional)',
  quickKcalInvalid: 'Bitte ganze kcal von 0 bis 3.000 eingeben.',
  quickMacrosTitle: 'Optional: Eiweiß, Kohlenhydrate, Fett (g)',
  quickProtein: 'Eiweiß (g)',
  quickCarbs: 'Kohlenhydrate (g)',
  quickFat: 'Fett (g)',
  quickMacroInvalid: 'Bitte Gramm von 0 bis 750 eingeben (eine Nachkommastelle).',
  quickNoNumbers: 'Ohne Kalorienzahlen zählt der Eintrag nur als „gegessen“.',
  saved: (title: string) => `Eingetragen: ${title}`,
  updated: 'Gespeichert.',
  save: 'Speichern',
  done: 'Fertig',
  // Rückfrage ab einer großen Menge – neutral, ohne Bewertung; ohne Zahlen nie mit kcal (Wächter E1 S3/G2).
  confirmTitle: 'Bitte kurz prüfen',
  confirmCheck: (details: string) => `Stimmen Menge und Einheit: ${details}?`,
  confirmCheckPlain: 'Stimmen Menge und Einheit?',
  confirmYes: 'Ja, eintragen',
  confirmNo: 'Menge ändern',
  tooLarge: 'Diese Menge ist ungewöhnlich groß – bitte prüfen.',
  favoriteUnavailable: 'Gerade nicht im Bestand – nicht eintragbar.',
  notFound: 'Diesen Eintrag gibt es nicht mehr.',
  planItemFixed:
    'Mahlzeiten aus dem Essensplan bleiben an ihrem Tag und Platz – nur die Portion lässt sich ändern.',
  // Zustände
  consentNeeded:
    'Für das Ernährungstagebuch brauchen wir deine Einwilligung in die Verarbeitung von Gesundheitsdaten. Was du einträgst, lässt Rückschlüsse auf dein Essverhalten zu.',
  consentButton: 'Einwilligung erteilen',
  futureDay: 'Eintragen geht ab dem Tag selbst.',
  tooOld: 'Nachtragen geht bis 14 Tage zurück.',
  tooOldEdit: 'Ändern geht bis 14 Tage zurück. Löschen geht weiterhin.',
  numbersHidden: 'Kalorienzahlen sind ausgeblendet – du kannst trotzdem eintragen.',
  unsupported:
    'Das Ernährungstagebuch kommt bald auch für Konten. Bis dahin kannst du es im Testmodus ausprobieren.',
  // „Heute“
  todayLine: (count: string) => `Gegessen heute: ${count}`,
  todayNone: 'Heute noch nichts eingetragen.',
  todayAdd: 'Essen eintragen',
  /** Ernährungs-Warteschlange (Supabase-Modus, N7 Teil 2; Gründer-Frage G3 aus E1). */
  sync: {
    queued: (n: number) =>
      n === 1
        ? '1 Eintrag wird übertragen, sobald du wieder online bist.'
        : `${n} Einträge werden übertragen, sobald du wieder online bist.`,
    sessionOnly:
      'Im Browser bleiben noch nicht übertragene Einträge nur, bis du diesen Tab schließt.',
    rejected: (n: number) =>
      n === 1
        ? '1 Eintrag konnte nicht gespeichert werden (z. B. auf einem anderen Gerät geändert, zu alt oder ohne Einwilligung). Er liegt nur noch auf diesem Gerät.'
        : `${n} Einträge konnten nicht gespeichert werden (z. B. auf einem anderen Gerät geändert, zu alt oder ohne Einwilligung). Sie liegen nur noch auf diesem Gerät.`,
    discard: 'Verwerfen',
    discardTitle: 'Nicht gespeicherte Einträge verwerfen?',
    discardText:
      'Die Einträge werden von diesem Gerät gelöscht. Was schon gespeichert ist, bleibt unverändert.',
    discarded: 'Verworfen.',
  },
  // Freies Eintragen (Gründer-Rückmeldung 14.11.2026): Haushaltsmengen, Korb „Deine Mahlzeit“, Schnellauswahl.
  free: {
    otherNotice: (slot: string) =>
      `Etwas anderes statt des Plans (${slot}): Lebensmittel suchen, Menge wählen, eintragen. Mehrere Lebensmittel? Erst „Zur Mahlzeit“, dann alle auf einmal eintragen.`,
    quickTitle: 'Mit einem Tipp',
    quickFavorites: 'Deine Favoriten',
    quickRecent: 'Zuletzt gegessen',
    quickAddA11y: (title: string) => `${title} eintragen`,
    householdUnits: {
      slice: { one: 'Scheibe', many: 'Scheiben' },
      piece: { one: 'Stück', many: 'Stück' },
      handful: { one: 'Handvoll', many: 'Handvoll' },
      bowl: { one: 'Schale', many: 'Schalen' },
      glass: { one: 'Glas', many: 'Gläser' },
      cup: { one: 'Becher', many: 'Becher' },
      tbsp: { one: 'EL', many: 'EL' },
      tsp: { one: 'TL', many: 'TL' },
      portion: { one: 'Portion', many: 'Portionen' },
    },
    countLabel: 'Wie viel?',
    gramsHint: (grams: string) => `≈ ${grams} g · Richtwert`,
    standInNote: (base: string) =>
      `Noch nicht in unserer Lebensmittel-Liste – wir rechnen mit den Werten von ${base} (Richtwert).`,
    amountRange: 'Anzahl: ½ bis 20 (in halben Schritten), umgerechnet höchstens 2.000 g.',
    addToBasket: 'Zur Mahlzeit',
    addToBasketA11y: (title: string) => `${title} zur Mahlzeit hinzufügen`,
    basketTitle: 'Deine Mahlzeit',
    basketHint: 'Weitere Lebensmittel suchen und dazulegen – dann alle auf einmal eintragen.',
    basketRemove: 'Entfernen',
    basketRemoveA11y: (title: string) => `${title} aus der Mahlzeit entfernen`,
    basketSubmit: (n: number) =>
      n === 1 ? '1 Lebensmittel eintragen' : `Alle ${n} Lebensmittel eintragen`,
    basketSaved: (n: number) =>
      n === 1 ? '1 Lebensmittel eingetragen.' : `${n} Lebensmittel eingetragen.`,
    basketFull: 'Mehr als 15 Lebensmittel gehen nicht auf einmal – bitte erst eintragen.',
    basketInvalid: (title: string) => `${title}: Diese Menge geht nicht – bitte ändern.`,
    basketAdded: (title: string) => `Zur Mahlzeit gelegt: ${title}`,
    favoriteName: 'Name als Favorit',
    favoriteSave: 'Als Favorit speichern',
    favoriteSaved: (name: string) =>
      `Als Favorit gespeichert: ${name}. Du findest ihn oben unter „Deine Favoriten“.`,
    favoriteNameInvalid: 'Bitte einen Namen mit 1 bis 60 Zeichen eingeben.',
    favoriteLimit: 'Du hast schon 100 eigene Gerichte. Lösche zuerst eins.',
    favoriteInvalid: 'Diese Mahlzeit lässt sich nicht als Favorit speichern.',
    newMeal: 'Neue Mahlzeit zusammenstellen',
  },
  errors: {
    outOfRange: 'Eintragen geht nur für heute und bis zu 14 Tage zurück.',
    dayFull: 'An diesem Tag sind schon 40 Einträge – mehr geht nicht.',
    rejected: 'Das ließ sich nicht speichern. Bitte prüfe deine Angaben.',
    favoriteLimit: 'Du hast schon 100 Favoriten. Entferne zuerst einen.',
  },
} as const;
