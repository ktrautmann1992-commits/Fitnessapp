/**
 * Texte der eigenen Gerichte (Etappe E2, docs/PLAN-AUSWERTUNG.md Abschnitt 7, 2.3, 2.4). Ruhige, neutrale Sprache wie
 * das Ernährungstagebuch: keine Bewertung des Essens, keine Schuld- oder Leistungswörter. Bei „Kalorienzahlen aus“
 * keine kcal. Fehlertexte nennen nie den Namen eines Gerichts und keine Werte. Wird in `de.ts` unter `customMeals`
 * eingebunden.
 */
export const deCustomMeals = {
  title: 'Eigene Gerichte',
  intro: 'Gerichte, die du oft isst, einmal anlegen und dann mit einem Tipp eintragen.',
  privacy:
    'Eigene Gerichte gehören zu deinem Ernährungstagebuch und sind nur für dich sichtbar. Widerrufst du die Einwilligung in Gesundheitsdaten, werden sie gelöscht.',
  open: 'Eigene Gerichte',
  manage: 'Eigene Gerichte verwalten',
  createFirst: 'Eigenes Gericht anlegen',
  create: 'Neues Gericht anlegen',
  empty:
    'Noch keine eigenen Gerichte. Lege z. B. „Mein Porridge“ aus Zutaten an oder gib die Werte direkt ein.',
  count: (n: number) => `${n} von 100 Gerichten`,
  limitReached: 'Du hast schon 100 eigene Gerichte. Lösche zuerst eines, um ein neues anzulegen.',
  edit: 'Ändern',
  editA11y: (name: string) => `${name} ändern`,
  delete: 'Löschen',
  deleteA11y: (name: string) => `${name} löschen`,
  deleteTitle: 'Gericht löschen?',
  deleteText:
    'Das Gericht wird gelöscht. Bereits eingetragene Tage behalten ihre Werte und heißen dann „Eigenes Gericht“.',
  deleted: 'Gericht gelöscht.',
  // Detailzeile
  fromItems: (n: number) => (n === 1 ? 'Aus 1 Zutat' : `Aus ${n} Zutaten`),
  makesServings: (n: number) => (n === 1 ? 'ergibt 1 Portion' : `ergibt ${n} Portionen`),
  directMade: 'Werte direkt eingegeben',
  withoutValues: 'ohne Werte',
  perServing: (kcal: string) => `je Portion ${kcal}`,
  // Formular
  newTitle: 'Gericht anlegen',
  editTitle: 'Gericht ändern',
  nameLabel: 'Name',
  nameHint: 'Bis 60 Zeichen, z. B. „Mein Porridge“. Nur für dich sichtbar.',
  nameInvalid: 'Bitte einen Namen mit 1 bis 60 Zeichen eingeben.',
  modeLabel: 'Wie möchtest du es anlegen?',
  modes: { ingredients: 'Aus Zutaten', direct: 'Werte direkt' },
  modeDirectNoNumbers: 'Ohne Werte',
  directKcal: 'Kalorien je Portion (kcal)',
  directMacrosTitle: 'Optional: Eiweiß, Kohlenhydrate, Fett je Portion (g)',
  directNoNumbers:
    'Kalorienzahlen sind ausgeblendet. Das Gericht wird ohne Werte angelegt und zählt beim Eintragen nur als „gegessen“. Aus Zutaten rechnen wir die Werte im Hintergrund.',
  directKeepValues: 'Gespeicherte Werte bleiben erhalten (sie sind nur ausgeblendet).',
  kcalInvalid: 'Bitte ganze kcal von 0 bis 3.000 eingeben.',
  macroInvalid: 'Bitte Gramm von 0 bis 750 eingeben (eine Nachkommastelle).',
  ingredientsTitle: 'Zutaten',
  ingredientsEmpty: 'Noch keine Zutat. Suche ein Lebensmittel und füge es hinzu.',
  ingredientsMax: 'Höchstens 30 Zutaten.',
  searchLabel: 'Lebensmittel suchen',
  searchHint: 'Mindestens 2 Buchstaben, z. B. „Haferflocken“.',
  searchNone: 'Dazu haben wir kein Lebensmittel gefunden.',
  addIngredient: 'Hinzufügen',
  addIngredientA11y: (food: string) => `${food} als Zutat hinzufügen`,
  removeIngredient: 'Entfernen',
  removeIngredientA11y: (food: string) => `${food} entfernen`,
  ingredientMissing: 'Nicht mehr im Bestand',
  servingsLabel: 'Ergibt Portionen',
  servingsInvalid: 'Portionen: 1 bis 20.',
  valuesTitle: 'Werte je Portion',
  valuesHidden:
    'Die Werte rechnen wir im Hintergrund – sichtbar, wenn du die Kalorienzahlen einschaltest.',
  valuesPending: 'Füge Zutaten hinzu, dann erscheinen die Werte.',
  missingFood:
    'Eine Zutat ist nicht mehr im Bestand. Du kannst den Namen ändern; die Werte bleiben wie gespeichert.',
  itemsInvalid: 'Bitte 1 bis 30 Zutaten angeben.',
  tooMuch: 'Die Werte je Portion sind ungewöhnlich groß – bitte Mengen oder Portionen prüfen.',
  save: 'Speichern',
  created: 'Gericht angelegt.',
  updated: 'Gespeichert.',
  cancel: 'Abbrechen',
  notFound: 'Dieses Gericht gibt es nicht mehr.',
  // Rückfrage bei direkten Werten (Plan 7: mehr als 20 % Abweichung) – neutral, ohne Bewertung.
  confirmTitle: 'Bitte kurz prüfen',
  confirmText:
    'Eiweiß, Kohlenhydrate und Fett passen nicht ganz zu den angegebenen Kalorien. Stimmen die Werte?',
  confirmYes: 'Ja, speichern',
  // Eintragen
  pickTitle: 'Eigene Gerichte',
  portionLabel: 'Portion',
  add: 'Eintragen',
  addA11y: (name: string) => `${name} eintragen`,
  saved: (name: string, portion: string) => `Eingetragen: ${name} · ${portion}`,
  showAll: 'Alle eigenen Gerichte',
  // Zustände
  consentNeeded:
    'Für eigene Gerichte brauchen wir deine Einwilligung in die Verarbeitung von Gesundheitsdaten – sie gehören zu deinem Ernährungstagebuch.',
  unsupported:
    'Eigene Gerichte kommen bald auch für Konten. Bis dahin kannst du sie im Testmodus ausprobieren.',
  errors: {
    limit: 'Du hast schon 100 eigene Gerichte. Lösche zuerst eines.',
    rejected: 'Das Gericht ließ sich nicht speichern. Bitte prüfe deine Angaben.',
  },
} as const;
