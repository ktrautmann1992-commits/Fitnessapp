/**
 * Texte für Gewichtstrend, Monatsrückblick und Trainings im Handy-Kalender (docs/PLAN-TREND-RUECKBLICK-KALENDER.md).
 * Neutral, ohne Lob fürs Abnehmen, ohne Serien, ohne Druck. Zahlen formatiert die App (deutsches Komma).
 */

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
] as const;

/** „2026-10“ → „Oktober 2026“. */
export function monthName(month: string): string {
  const [year, m] = month.split('-');
  return `${MONTHS[Number(m) - 1] ?? ''} ${year ?? ''}`.trim();
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const deWeightTrend = {
  title: 'Gewichtstrend',
  intro:
    'Die Linie glättet Tagesschwankungen (Wasser, Salz, Verdauung). Die hellen Punkte sind deine einzelnen Werte. Nur du siehst das.',
  loading: 'Dein Gewichtsverlauf wird geladen …',
  error: 'Der Gewichtsverlauf konnte gerade nicht geladen werden.',
  retry: 'Erneut versuchen',
  offline: 'Ohne Internet zeigen wir nur die Werte auf diesem Gerät.',
  empty: 'Noch kein Gewicht eingetragen. Ab zwei Werten zeigen wir hier eine Linie.',
  single: 'Ein Wert ist da. Ab dem zweiten Wert zeigen wir eine Linie.',
  addWeight: 'Gewicht eintragen',
  noConsent:
    'Für den Gewichtstrend brauchen wir deine Einwilligung in Gesundheitsdaten. Ohne sie speichern wir kein Gewicht.',
  grantConsent: 'Einwilligung ansehen',
  hiddenByNumbers:
    'Ausgeblendet, weil „Kalorienzahlen anzeigen“ aus ist. Du kannst das in den Einstellungen unter Ernährung ändern.',
  hidden: 'Dein Gewichtstrend ist ausgeblendet.',
  show: 'Gewichtstrend einblenden',
  hide: 'Gewichtstrend ausblenden',
  trend: (kg: string, date: string) => `Trend: ${kg} kg (Stand ${date})`,
  rate: {
    down: (kg: string) => `Etwa ${kg} kg pro Woche weniger (Trend der letzten 2 Wochen)`,
    up: (kg: string) => `Etwa ${kg} kg pro Woche mehr (Trend der letzten 2 Wochen)`,
    stable: 'Etwa gleichbleibend (Trend der letzten 2 Wochen)',
  },
  rateTooFew: 'Für ein Tempo brauchen wir mindestens 5 Werte aus den letzten 2 Wochen.',
  stale: 'Dein letzter Wert ist älter als 2 Wochen. Trag gern einen neuen ein.',
  restarted: 'Nach einer längeren Pause ohne Werte beginnt die Linie neu.',
  tooFast:
    'Dein Trend sinkt gerade schneller als etwa 1 % deines Körpergewichts pro Woche. Langsamer ist für Muskeln, Energie und Wohlbefinden besser. Iss im Zweifel etwas mehr und sprich bei Fragen mit deiner Ärztin oder deinem Arzt.',
  tooFastActiveAging:
    'Dein Trend sinkt gerade schneller als etwa 0,5 % deines Körpergewichts pro Woche. Langsamer schützt deine Muskeln. Iss im Zweifel etwas mehr und sprich bei Fragen mit deiner Ärztin oder deinem Arzt.',
  forecast: (month: string) =>
    `Bleibt es bei diesem Tempo, liegt dein Trend etwa im ${month} bei deinem Wunschgewicht. Das ist eine grobe Schätzung, keine Vorgabe – Schwankungen sind normal.`,
  forecastNone: {
    reached: 'Dein Trend liegt bei oder unter deinem Wunschgewicht.',
    direction_mismatch:
      'Gerade sinkt dein Trend nicht – darum zeigen wir keine Schätzung. Schwankungen sind normal.',
    too_slow: 'Dein Trend ist gerade fast gleich – darum zeigen wir keine Schätzung.',
    too_far:
      'Bei diesem Tempo liegt dein Wunschgewicht mehr als ein Jahr entfernt – darum zeigen wir keine Schätzung.',
    pregnancy:
      'In Schwangerschaft und Stillzeit zeigen wir kein Tempo und keine Schätzung – nur deine Werte.',
  },
  cycleHint:
    'Im Lauf des Zyklus schwankt das Gewicht oft um 1–2 kg, meist durch Wasser. Die Linie gleicht das aus.',
  legendDots: 'Punkte: einzelne Werte',
  legendLine: 'Linie: Trend',
  chartA11y: (count: number, from: string, to: string, first: string, last: string) =>
    `Gewichtsverlauf mit ${count} ${plural(count, 'Wert', 'Werten')} vom ${from} bis ${to}. Trend von ${first} kg auf ${last} kg.`,
} as const;

export const deMonthReview = {
  title: 'Monatsrückblick',
  intro: 'Dein Monat in Ruhe betrachtet – privat, nur für dich.',
  offerTitle: (month: string) => `Dein Rückblick auf ${month} ist da`,
  offerText: 'Training, Kilometer und mehr aus dem letzten Monat auf einen Blick.',
  open: 'Rückblick ansehen',
  openAny: 'Monatsrückblick',
  openAnyHint: 'Rückblick auf einen Monat ansehen und als PDF sichern',
  previous: 'Vormonat',
  next: 'Folgemonat',
  previousA11y: 'Vorherigen Monat zeigen',
  nextA11y: 'Nächsten Monat zeigen',
  running: (date: string) => `Der Monat läuft noch – Stand ${date}.`,
  invalidMonth: 'Diesen Monat gibt es nicht. Wir zeigen den aktuellen.',
  tooOld:
    'Ältere Monate liegen nicht vollständig auf diesem Gerät – der Rückblick wäre unvollständig.',
  loading: 'Rückblick wird erstellt …',
  computeFailed: 'Der Rückblick konnte nicht berechnet werden.',
  empty: 'In diesem Monat ist nichts eingetragen. Das ist in Ordnung – jeder Monat zählt neu.',
  trainingTitle: 'Training',
  trainingDone: (done: number, planned: number) =>
    `${done} von ${planned} geplanten ${plural(planned, 'Einheit', 'Einheiten')} gemacht`,
  trainingMissed: (n: number) => `${n} ${plural(n, 'Einheit', 'Einheiten')} ausgelassen`,
  trainingOpen: (n: number) => `${n} ${plural(n, 'Einheit', 'Einheiten')} noch offen`,
  trainingFree: (n: number) => `${n} freie ${plural(n, 'Einheit', 'Einheiten')} zusätzlich`,
  trainingNone: 'Keine Einheiten in diesem Monat.',
  distanceTitle: 'Kilometer',
  km: (km: string) => `${km} km`,
  strengthTitle: 'Kraft: größte Steigerungen',
  strengthNote:
    'Verglichen mit deinem besten Satz vor diesem Monat (geschätzt aus Gewicht und Wiederholungen).',
  set: (kg: string, reps: number) => `${kg} kg × ${reps}`,
  strengthRow: (before: string, best: string) => `vorher ${before} → jetzt ${best}`,
  foodTitle: 'Essen',
  foodEntryDays: (entryDays: number, days: number) =>
    `An ${entryDays} von ${days} ${plural(days, 'Tag', 'Tagen')} etwas eingetragen`,
  foodMeals: (eaten: number, planned: number) =>
    `${eaten} von ${planned} geplanten Mahlzeiten abgehakt`,
  foodUnavailable: 'Das Ernährungstagebuch braucht deine Einwilligung in Gesundheitsdaten.',
  weightTitle: 'Gewicht',
  weightTrend: (startDate: string, start: string, endDate: string, end: string) =>
    `Trend am ${startDate}: ${start} kg, am ${endDate}: ${end} kg`,
  weightTooFew: 'Zu wenige Werte in diesem Monat für einen Trend.',
  weightHidden: 'Gewicht ausgeblendet.',
  pdf: 'Als PDF sichern',
  pdfHint: 'Öffnet eine Druckansicht. Gespeichert wird nur auf deinem Gerät.',
  back: 'Zurück',
  print: {
    title: 'Monatsrückblick als PDF',
    intro:
      'Das PDF bleibt auf deinem Gerät. Nichts wird hochgeladen oder geteilt – du speicherst es selbst.',
    includeHealth: 'Essen und Gewicht ins PDF aufnehmen (Gesundheitsdaten)',
    includeHealthHint:
      'Standard aus. Nur einschalten, wenn du die Datei bewusst so speichern möchtest.',
    healthTitle: 'Gesundheitsdaten im PDF?',
    healthText:
      'Das PDF enthält dann Angaben zu Essen und Gewicht. Speichere oder drucke die Datei nur bewusst und teile sie nicht ungewollt.',
    healthConfirm: 'Aufnehmen',
    future: 'Für diesen Monat gibt es noch keinen Rückblick.',
  },
  // Druck-Texte (Codes aus packages/core/src/export/month-review-print-texts.ts).
  doc: {
    title: (month: string) => `Alpha5 Monatsrückblick ${month}`,
    footer: 'Alpha5 · privat erstellt · ersetzt keine ärztliche Beratung',
    heading: 'Dein Monatsrückblick',
    labelMonth: 'Monat',
    labelPeriod: 'Zeitraum',
    period: (from: string, to: string, running: boolean) =>
      `${from}–${to}${running ? ' (Monat läuft noch)' : ''}`,
    colSport: 'Sportart',
    colKm: 'Kilometer',
    colExercise: 'Übung',
    colBefore: 'Bester Satz vorher',
    colBest: 'Bester Satz im Monat',
    healthHeading: 'Essen und Gewicht',
    healthExcluded: 'Essen und Gewicht sind nicht enthalten (Gesundheitsdaten).',
    noticeTitle: 'Hinweis',
    noticeText:
      'Der Rückblick ist eine Übersicht deiner eigenen Einträge, keine Bewertung. Alpha5 ersetzt keine ärztliche Beratung.',
  },
} as const;

export const deDeviceCalendar = {
  settingsTitle: 'Handy-Kalender',
  settingsLink: 'Trainings im Handy-Kalender',
  settingsText: 'Geplante Einheiten als Termine – aus, bis du es einschaltest.',
  title: 'Trainings im Handy-Kalender',
  intro:
    'Alpha5 trägt deine geplanten Einheiten der nächsten 4 Wochen als Termine in einen eigenen Kalender „Alpha5 Training“ ein – z. B. „Alpha5: Ganzkörper A“. Tauschst oder verschiebst du eine Einheit, ändert sich der Termin mit.',
  privacy:
    'Im Termin steht nur der Name der Einheit, Tag und Uhrzeit – keine Gesundheitsangaben, keine Notizen. Ist dein Kalender mit einem Konto (z. B. Google, iCloud) verbunden, kann er dort mit synchronisiert werden.',
  calendarName: 'Alpha5 Training',
  toggle: 'Trainings in den Handy-Kalender eintragen',
  timeLabel: 'Uhrzeit der Termine',
  timeFromSetup: (time: string) => `Wie deine Trainingszeit (${time} Uhr)`,
  timeOption: (time: string) => `${time} Uhr`,
  permissionTitle: 'Zugriff auf den Kalender',
  permissionText:
    'Damit Alpha5 Termine eintragen kann, fragt dein Handy gleich nach dem Zugriff auf den Kalender. Alpha5 liest keine anderen Termine.',
  permissionContinue: 'Weiter',
  permissionDenied:
    'Ohne Zugriff auf den Kalender können wir keine Termine eintragen. Du kannst ihn in den Einstellungen deines Handys erlauben.',
  syncing: 'Termine werden eingetragen …',
  synced: (count: number) =>
    count === 0
      ? 'Eingeschaltet. Gerade gibt es keine geplanten Einheiten in den nächsten 4 Wochen.'
      : `Eingeschaltet: ${count} ${plural(count, 'Termin', 'Termine')} in „Alpha5 Training“.`,
  removed: 'Ausgeschaltet. Der Kalender „Alpha5 Training“ und seine Termine wurden entfernt.',
  failed:
    'Die Termine konnten gerade nicht eingetragen werden. Bitte versuche es später noch einmal.',
  noPlan: 'Noch kein Trainingsplan – sobald es einen gibt, erscheinen die Termine.',
  web: {
    text: 'Im Browser kann Alpha5 nicht direkt in deinen Kalender schreiben. Du kannst stattdessen eine Kalender-Datei (.ics) mit den Einheiten der nächsten 4 Wochen herunterladen und in deiner Kalender-App öffnen.',
    download: 'Kalender-Datei herunterladen',
    downloaded: (count: number) =>
      `Datei mit ${count} ${plural(count, 'Termin', 'Terminen')} erstellt. Ändert sich dein Plan, lade sie neu herunter.`,
    empty: 'Gerade gibt es keine geplanten Einheiten in den nächsten 4 Wochen.',
  },
  back: 'Zurück',
} as const;
