import { AI_FOOD_PHOTO } from '@fitnessapp/core';

/**
 * Texte „Gericht per Foto“ (Etappe E3, docs/PLAN-AUSWERTUNG.md Abschnitt 9, 2.4, 2.7). Ruhige Sprache, keine
 * Bewertung des Essens; deutlich „Schätzung – bitte prüfen“. Fehlertexte nennen nie Inhalte (keine Info, keine
 * Bestandteile). Bei „Kalorienzahlen aus“ keine kcal. Wird in `de.ts` unter `foodPhoto` eingebunden.
 */
const P = AI_FOOD_PHOTO;
const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];
/** „1. November“ aus JJJJ-MM-TT. */
const dayMonth = (date: string) =>
  `${Number(date.slice(8, 10))}. ${MONTHS[Number(date.slice(5, 7)) - 1] ?? ''}`;

export const deFoodPhoto = {
  open: 'Per Foto',
  openHint: 'Premium: Foto deines Essens auswerten lassen – als Vorschlag zum Prüfen.',
  title: 'Gericht per Foto',
  intro:
    'Fotografiere dein Essen. Wir schätzen die Bestandteile und Mengen – du prüfst und änderst alles, bevor etwas eingetragen wird.',
  mockBadge: 'Testversion: Es antwortet eine Attrappe mit festen Beispielen, keine echte KI.',
  remainingMonth: (n: number) =>
    n === 1 ? 'Noch 1 Foto in diesem Monat' : `Noch ${n} Fotos in diesem Monat`,
  remainingToday: (n: number) => (n === 1 ? 'heute noch 1' : `heute noch ${n}`),
  lastOfMonth: 'Das ist dein letztes Foto in diesem Monat.',
  noteLabel: 'Kurze Info (optional)',
  noteHint: `Zum Beispiel „mit Sahnesoße, halbe Portion“. Höchstens ${P.noteMaxChars} Zeichen.`,
  noteCount: (n: number) => `${n} von ${P.noteMaxChars} Zeichen`,
  noteTooLong: `Die Info ist zu lang – höchstens ${P.noteMaxChars} Zeichen.`,
  pick: 'Foto aufnehmen oder wählen',
  pickExample: 'Beispielfoto verwenden (Testmodus)',
  nativeUnsupported:
    'In dieser Testversion geht die Fotoauswahl nur in der Web-Version im Browser. In der App kommt sie mit dem nächsten Build.',
  cameraDenied:
    'Wir konnten nicht auf Kamera oder Fotos zugreifen. Erlaube den Zugriff in den Einstellungen – oder trag es per Hand ein.',
  pickUnreadable: 'Dieses Bild können wir nicht lesen. Bitte nimm ein JPEG-, PNG- oder WebP-Foto.',
  analyzing: 'Foto wird ausgewertet …',
  estimate: 'Schätzung – bitte prüfen',
  estimateText:
    'Bestandteile und Mengen sind geschätzt. Die Nährwerte kommen aus unserem Lebensmittel-Katalog. Ändere, lösche oder ergänze, bevor du einträgst.',
  choose: 'Bitte auswählen',
  chooseHint: (label: string) => `Erkannt: „${label}“ – bitte das passende Lebensmittel wählen.`,
  unsure: 'unsicher – bitte prüfen',
  amountLabel: 'Menge in g',
  amountInvalid: `Bitte eine ganze Zahl von ${P.amountG.min} bis ${P.amountG.max.toLocaleString('de-DE')} g eingeben.`,
  remove: 'Entfernen',
  removeA11y: (name: string) => `${name} entfernen`,
  searchLabel: 'Lebensmittel suchen',
  searchNone: 'Nichts gefunden.',
  add: 'Bestandteil hinzufügen',
  addAmount: 100,
  maxItems: `Höchstens ${P.maxItems} Bestandteile.`,
  empty: 'Keine Bestandteile mehr übrig. Füge einen hinzu oder brich ab.',
  kcal: (n: number) => `${n.toLocaleString('de-DE')} kcal`,
  submit: 'Eintragen',
  submitChooseFirst: 'Bitte zuerst bei allen Bestandteilen ein Lebensmittel auswählen.',
  cancel: 'Abbrechen',
  cancelled: 'Abgebrochen – es wurde nichts gespeichert.',
  saved: (n: number) => (n === 1 ? '1 Bestandteil eingetragen.' : `${n} Bestandteile eingetragen.`),
  toDay: 'Zum Tagesverlauf',
  again: 'Noch ein Foto',
  manual: 'Per Hand eintragen',
  dayFull: 'An diesem Tag ist kein Platz mehr für so viele Einträge (höchstens 40).',
  // Zustände
  offline: 'Fotos brauchen Internet – trag es per Hand ein oder später.',
  notConfigured:
    'Per Foto ist in dieser Version noch nicht verfügbar. Eintragen per Hand geht wie immer.',
  flagOff: 'Per Foto ist gerade abgeschaltet. Eintragen per Hand geht wie immer.',
  noPremium:
    'Per Foto gehört zu Premium, weil dafür eine KI läuft. Bis zum Start von Premium können es nur freigeschaltete Testkonten nutzen. Eintragen per Hand bleibt immer gratis.',
  consentTitle: 'Einwilligung nötig',
  consentText:
    'Derzeit Testversion: Es antwortet ein Testprogramm mit festen Beispielen – dein Foto geht an keinen KI-Anbieter. Das Foto wird nicht gespeichert, das Ergebnis ist eine Schätzung. Bevor eine echte KI eingeschaltet wird, fragen wir dich erneut.',
  consentRead: 'Einwilligungstext lesen',
  consentAccept: 'Zustimmen und fortfahren',
  limitMonth: (date: string) =>
    `Dein Kontingent für Fotos ist diesen Monat aufgebraucht, ab ${dayMonth(date)} wieder verfügbar. Eintragen per Hand geht weiter.`,
  limitDay:
    'Für heute sind keine Fotos mehr möglich, ab morgen wieder. Eintragen per Hand geht weiter.',
  loadFailed: 'Das hat gerade nicht geklappt.',
  retry: 'Erneut versuchen',
  errors: {
    unauthorized: 'Bitte melde dich erneut an.',
    forbidden_origin: 'Die Anfrage wurde abgelehnt. Bitte lade die Seite neu.',
    not_configured: 'Per Foto ist in dieser Version noch nicht verfügbar.',
    invalid_request: 'Das Foto konnte nicht gesendet werden. Bitte versuch es noch einmal.',
    note_too_long: `Die Info ist zu lang – höchstens ${P.noteMaxChars} Zeichen.`,
    image_type: 'Bitte nimm ein JPEG-, PNG- oder WebP-Foto.',
    image_too_big: 'Das Foto ist zu groß. Bitte versuch es mit einem anderen.',
    image_too_large_px: 'Das Foto ist zu groß. Bitte versuch es mit einem anderen.',
    image_broken: 'Dieses Foto können wir nicht lesen. Bitte versuch es mit einem anderen.',
    flag_off: 'Per Foto ist gerade abgeschaltet. Eintragen per Hand geht wie immer.',
    no_entitlement: 'Per Foto gehört zu Premium. Eintragen per Hand bleibt immer gratis.',
    no_consent: 'Für Per Foto fehlt die Einwilligung.',
    timeout:
      'Die Auswertung hat zu lange gedauert. Das zählt nicht gegen dein Kontingent – versuch es gleich noch einmal.',
    provider_failed:
      'Die Auswertung ist gerade nicht erreichbar. Das zählt nicht gegen dein Kontingent – versuch es später noch einmal.',
    invalid_answer:
      'Die Auswertung hat keine brauchbare Antwort geliefert. Das zählt nicht gegen dein Kontingent – versuch es noch einmal oder trag es per Hand ein.',
    failed: 'Das hat gerade nicht geklappt. Bitte versuch es später noch einmal.',
    no_food:
      'Wir erkennen auf dem Foto kein Essen. Versuch es mit einem anderen Foto oder trag es per Hand ein.',
  },
  settingsNote:
    'Erteilen kannst du sie beim ersten Foto unter Ernährung → Eintragen → Per Foto. Widerruf: Danach werten wir keine Fotos mehr aus; Einträge im Tagebuch bleiben.',
  revokeTitle: 'Einwilligung „Gerichte per Foto“ widerrufen?',
  revokeText:
    'Danach werten wir keine Fotos mehr aus. Was du schon eingetragen hast, bleibt in deinem Ernährungstagebuch.',
  revokeConfirm: 'Widerrufen',
  revokeDone: 'Einwilligung „Gerichte per Foto“ widerrufen.',
};
