/**
 * Texte „Gerichte entdecken“ – Wochenauswahl per Wischen (Gründer-Wunsch 01.11.2026, docs/PLAN-REZEPT-SWIPE.md).
 * Ruhige Sprache, keine Bewertung des Essens. Wird in `de.ts` unter `recipeSwipe` eingebunden.
 */
export const deRecipeSwipe = {
  title: 'Gerichte entdecken',
  intro:
    'Wisch nach rechts, was dir schmeckt, nach links, was du nicht magst, nach oben, wenn es dir egal ist. Was du magst, planen wir in deine Woche ein – passend zu deinen Zielen.',
  open: 'Gerichte für nächste Woche wischen',
  openHint: 'Öffnet einen Kartenstapel mit Rezepten, die zu dir passen.',
  forWeek: (from: string, to: string) => `Für die Woche ${from} bis ${to}`,
  like: 'Mag ich',
  dislike: 'Mag ich nicht',
  neutral: 'Neutral',
  likeA11y: (title: string) => `${title}: mag ich – für die Woche merken`,
  dislikeA11y: (title: string) => `${title}: mag ich nicht – nicht mehr vorschlagen`,
  neutralA11y: (title: string) => `${title}: neutral – überspringen`,
  undo: 'Rückgängig',
  undoA11y: (title: string) => `Letzte Karte zurückholen: ${title}`,
  stampLike: 'MAG ICH',
  stampDislike: 'NÖ',
  stampNeutral: 'NEUTRAL',
  cardA11y: (title: string, details: string, position: number, total: number) =>
    `Rezeptkarte ${position} von ${total}: ${title}. ${details}`,
  cardHint:
    'Wischen: rechts mag ich, links mag ich nicht, oben neutral. Oder die Knöpfe darunter nutzen.',
  keyboardHint:
    'Tastatur: Pfeil rechts = mag ich, Pfeil links = mag ich nicht, Pfeil hoch = neutral.',
  nutrients: (kcal: string, protein: string, carbs: string, fat: string) =>
    `${kcal} kcal · ${protein} g Eiweiß · ${carbs} g KH · ${fat} g Fett`,
  nutrientsA11y: (kcal: string, protein: string, carbs: string, fat: string) =>
    `Je Portion ${kcal} Kilokalorien, ${protein} Gramm Eiweiß, ${carbs} Gramm Kohlenhydrate, ${fat} Gramm Fett.`,
  perServing: 'je Portion',
  minutes: (n: number) => `${n} Min.`,
  mealTypes: { breakfast: 'Frühstück', main: 'Hauptgericht', snack: 'Snack' },
  remaining: (n: number) => (n === 1 ? 'Noch 1 Karte' : `Noch ${n} Karten`),
  liked: (n: number) => (n === 1 ? '1 gemerkt' : `${n} gemerkt`),
  empty:
    'Gerade gibt es keine neuen Gerichte für dich – du hast alle passenden Rezepte dieser Woche schon gesehen.',
  emptyHidden: 'Gerichte, die du nicht magst, holst du unter „Ausgeblendete Gerichte“ zurück.',
  hiddenLink: 'Ausgeblendete Gerichte',
  doneTitle: 'Stapel geschafft',
  doneText: (liked: number) =>
    liked === 0
      ? 'Du hast nichts gemerkt. Dein Wochenplan bleibt, wie er ist.'
      : liked === 1
        ? '1 Gericht gemerkt. Es bekommt ein Herz und kommt in deinen Wochenplan, wo es passt.'
        : `${liked} Gerichte gemerkt. Sie bekommen ein Herz und kommen in deinen Wochenplan, wo sie passen.`,
  apply: 'Wochenplan aktualisieren',
  applyHint: 'Legt die gemerkten Gerichte in die Woche – Ziele und Kalorien-Schutzgrenzen bleiben.',
  applyEarly: 'Fertig – Wochenplan aktualisieren',
  applied: (placed: number, unplaced: number) => {
    const first =
      placed === 0
        ? 'Kein Gericht neu eingeplant.'
        : placed === 1
          ? '1 Gericht eingeplant.'
          : `${placed} Gerichte eingeplant.`;
    const second =
      unplaced === 0
        ? ''
        : unplaced === 1
          ? ' 1 Gericht passte diese Woche nicht in deinen Plan (Ziele oder Schutzgrenzen) – es bleibt als Lieblingsgericht gemerkt.'
          : ` ${unplaced} Gerichte passten diese Woche nicht in deinen Plan (Ziele oder Schutzgrenzen) – sie bleiben als Lieblingsgerichte gemerkt.`;
    return `${first}${second}`;
  },
  noPlan:
    'Für diese Woche gibt es noch keinen änderbaren Essensplan. Deine Herzen sind gespeichert und wirken, sobald der Plan erstellt wird.',
  toWeek: 'Zum Wochenplan',
  failed: 'Das hat nicht geklappt. Bitte versuch es noch einmal.',
  limit:
    'Du hast sehr viele Gerichte markiert. Entferne zuerst einige unter „Ausgeblendete Gerichte“.',
} as const;
