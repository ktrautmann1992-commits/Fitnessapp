/**
 * Texte „Trinken“ (25.10.2026): Richtwert, kein Heilversprechen, keine Wertung „zu wenig/zu viel“.
 */

const ml = (n: number) => `${n.toLocaleString('de-DE')} ml`;
const liters = (n: number) =>
  `${(n / 1000).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} l`;

export const deHydration = {
  title: 'Trinken',
  today: (total: number) => `Heute ${liters(total)}`,
  ofGoal: (total: number, goal: number) => `${liters(total)} von ${liters(goal)}`,
  ringA11y: (total: number, goal: number | null) =>
    goal === null
      ? `Heute getrunken: ${ml(total)}`
      : `Heute getrunken: ${ml(total)} von etwa ${ml(goal)} Richtwert`,
  add: (amount: number) => `+${amount} ml`,
  addA11y: (amount: number) => `${amount} Milliliter eintragen`,
  undo: 'Letzten Eintrag zurücknehmen',
  undone: 'Letzter Eintrag entfernt.',
  added: (amount: number) => `${ml(amount)} eingetragen.`,
  queued: 'Gespeichert – wird übertragen, sobald du Verbindung hast.',
  goalHint: (base: number, training: number, heat: number) =>
    [
      `Richtwert ${ml(base)} für Getränke (ca. 35 ml je kg Körpergewicht laut D-A-CH-Referenzwerten, ein Teil kommt aus dem Essen)`,
      training > 0 ? `+ ${ml(training)} fürs Training heute` : null,
      heat > 0 ? `+ ${ml(heat)} wegen Wärme` : null,
    ]
      .filter(Boolean)
      .join(' ') + '.',
  noGoalMedical:
    'Wegen deiner Angaben zu Herz bzw. Niere geben wir kein Trinkziel vor – die richtige Menge stimmst du bitte ärztlich ab. Notieren kannst du trotzdem.',
  noGoalWeight: 'Ohne Körpergewicht kein Richtwert – notieren kannst du trotzdem.',
  disclaimer: 'Richtwert, kein medizinischer Rat. Durst ist ein guter Wegweiser.',
  history: 'Letzte 7 Tage',
  historyA11y: (text: string) => `Getrunken je Tag: ${text}`,
  loadFailed: 'Laden hat nicht geklappt.',
  retry: 'Erneut laden',
  offline: 'Offline – angezeigt wird der zuletzt geladene Stand.',
  failed: 'Das hat nicht geklappt. Bitte erneut versuchen.',
  limit: 'An diesem Tag sind schon sehr viele Einträge gespeichert.',
} as const;
