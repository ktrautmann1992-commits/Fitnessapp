/**
 * Texte „Rundkurs-Vorschlag“ (Gründer-Freigabe 25.10.2026, docs/PLAN-RUNDKURS.md). Du-Form, kurz, ohne Fachwörter.
 */

const km = (m: number) => `${(m / 1000).toFixed(1).replace('.', ',')} km`;
const LETTERS = ['A', 'B', 'C', 'D'];

export const deLoop = {
  title: 'Rundkurs-Vorschlag',
  entry: 'Rundkurs vorschlagen',
  entryHint: 'Wir schlagen dir 2–3 Runden ab deinem Standort vor – auf echten Wegen.',
  intro:
    'Wähle Distanz und Untergrund. Wir schlagen dir 2–3 Runden vor, die dort enden, wo du startest.',
  distance: 'Distanz',
  distanceOption: (n: number) => `${n} km`,
  distanceA11y: (n: number) => `${n} Kilometer`,
  surface: 'Untergrund',
  surfaces: {
    paved: 'Asphalt',
    unpaved: 'Wald- und Feldwege',
    any: 'Egal',
  },
  start: 'Start',
  useLocation: 'Meinen Standort verwenden',
  locating: 'Standort wird bestimmt …',
  pickOnMap: 'Oder tippe auf der Karte auf deinen Startpunkt.',
  demoStart: 'Beispiel-Start Köln (Testmodus)',
  startSet: 'Startpunkt gesetzt',
  startMissing: 'Wähle zuerst einen Startpunkt.',
  locationDenied:
    'Ohne Standort-Freigabe geht es nicht automatisch. Tippe stattdessen auf der Karte auf deinen Startpunkt.',
  locationUnavailable:
    'Dein Standort ist gerade nicht verfügbar. Tippe stattdessen auf der Karte auf deinen Startpunkt.',
  suggest: 'Runden vorschlagen',
  more: 'Andere Runden',
  searching: 'Wir suchen passende Runden …',
  results: 'Vorschläge',
  loopName: (i: number) => `Runde ${LETTERS[i] ?? String(i + 1)}`,
  defaultSaveName: (n: number) => `Rundkurs ${n} km`,
  distanceValue: (m: number) => km(m),
  ascent: (m: number) => `↑ ${m} Hm`,
  ascentA11y: (m: number) => `${m} Höhenmeter bergauf`,
  ascentUnknown: 'Höhenmeter unbekannt',
  surfaceShare: (paved: number, unpaved: number) =>
    `${Math.round(paved * 100)}\u00a0% Asphalt · ${Math.round(unpaved * 100)}\u00a0% Wald-/Feldweg`,
  longer: 'etwas länger als gewünscht',
  shorter: 'etwas kürzer als gewünscht',
  overlapHint: 'teils gleicher Weg hin und zurück',
  select: (name: string) => `${name} auswählen`,
  selected: 'Ausgewählt',
  run: 'Diese Runde laufen',
  runHint: 'Die Aufzeichnung startet mit der Runde als Linie auf der Karte.',
  save: 'Als Meine Strecke merken',
  saveName: 'Name der Runde',
  saveConfirm: 'Merken',
  saveCancel: 'Abbrechen',
  saved: 'Gemerkt. Läufst du die Runde und speicherst sie, ist sie in „Meine Strecken“.',
  savedTitle: 'Gemerkte Strecken',
  savedEmpty: 'Noch keine Runde oder Strecke gemerkt.',
  savedDelete: 'Entfernen',
  savedDeleteA11y: (name: string) => `${name} entfernen`,
  savedRun: 'Laufen',
  savedRunA11y: (name: string) => `${name} laufen`,
  savedDeviceOnly: 'Gemerkte Runden und Strecken bleiben nur auf diesem Gerät.',
  // Zustände
  empty:
    'Hier haben wir keine passende Runde gefunden. Probier eine andere Distanz, einen anderen Untergrund oder einen anderen Startpunkt.',
  notConfigured: 'Rundkurs-Vorschläge sind gerade nicht verfügbar.',
  rateLimited: 'Gerade kamen zu viele Anfragen. Bitte versuch es in ein paar Minuten noch einmal.',
  unavailable: 'Der Routing-Dienst antwortet gerade nicht. Bitte versuch es gleich noch einmal.',
  offline: 'Keine Verbindung. Rundkurs-Vorschläge brauchen Internet.',
  failed: 'Das hat nicht geklappt. Bitte versuch es noch einmal.',
  retry: 'Noch einmal versuchen',
  // Karte
  mapA11y: 'Karte mit den vorgeschlagenen Runden und dem Startpunkt',
  mapFailed: 'Die Karte lädt gerade nicht – hier eine Skizze der Runden.',
  sketchA11y: (n: number) => `Skizze mit ${n} vorgeschlagenen Runden`,
  attribution:
    '© OpenStreetMap-Mitwirkende · Kartenstil OpenFreeMap · Routing: openrouteservice.org',
  privacy:
    'Für den Vorschlag geht nur dein ungefährer Startpunkt (auf ca. 50 m gerundet) mit Distanz und Untergrund an unseren Server und den Routing-Dienst openrouteservice (Heidelberg). Gespeichert wird davon nichts.',
  mockHint: 'Testmodus: ausgedachte Runden (keine echten Wege).',
  // Beim Laufen
  guideTitle: (name: string) => `Leitlinie: ${name}`,
  guideRemaining: (m: number) => `Noch ca. ${km(m)} bis zum Start`,
  guideDone: 'Runde geschafft – du bist wieder am Start.',
  guideA11y: 'Karte mit der Runde, die du läufst',
  // Sportarten Stufe 1 · Wandern (27.10.2026): GPX-Datei als gemerkte Strecke
  gpx: {
    title: 'GPX-Datei einlesen',
    intro:
      'Hast du eine Tour als GPX-Datei (z. B. aus einem Wanderportal oder von deiner Uhr)? Wir lesen sie nur auf diesem Gerät und merken sie dir – mit Höhenmetern und Gehzeit.',
    open: 'GPX-Datei öffnen',
    demo: 'Beispiel-Tour laden (Testmodus)',
    reading: 'Datei wird gelesen …',
    nameLabel: 'Name der Strecke',
    sportLabel: 'Wofür ist die Strecke?',
    sports: {
      hike: 'Wandern',
      mountain_hike: 'Bergwandern',
      walk: 'Gehen',
      run: 'Laufen',
      bike: 'Rad',
    },
    summary: 'Das steht in der Datei',
    distance: 'Strecke',
    ascent: 'Anstieg',
    descent: 'Abstieg',
    highest: 'Höchster Punkt',
    noElevation: 'Die Datei enthält keine Höhen.',
    skipped: (n: number) =>
      n === 1
        ? '1 ungültiger Punkt wurde übersprungen.'
        : `${n} ungültige Punkte wurden übersprungen.`,
    save: 'Strecke merken',
    cancel: 'Abbrechen',
    saved: 'Gemerkt. Du findest die Strecke unten bei „Gemerkte Strecken“.',
    privacy:
      'Die Datei bleibt auf deinem Gerät – sie wird nicht hochgeladen. Zeiten aus der Datei übernehmen wir nicht.',
    unsupported: 'Dateien öffnen geht auf diesem Gerät nicht.',
    errors: {
      cancelled: 'Keine Datei gewählt.',
      unreadable: 'Die Datei ließ sich nicht lesen.',
      too_large: 'Die Datei ist zu groß (höchstens 8 MB bzw. 100.000 Punkte).',
      not_gpx: 'Das ist keine GPX-Datei. Bitte eine Datei mit der Endung .gpx wählen.',
      no_points: 'In der Datei ist keine Strecke (keine Spur- oder Routenpunkte).',
      invalid_points: 'Die Strecke in der Datei ist beschädigt (ungültige Punkte).',
      too_short: 'Die Strecke ist kürzer als 100 m.',
      too_long: 'Die Strecke ist länger als 300 km.',
    },
    badge: 'GPX',
    descentValue: (m: number) => `↓ ${m} Hm`,
    timeValue: (text: string) => `Gehzeit ${text}`,
  },
  savedRunBy: {
    run: 'Laufen',
    bike: 'Fahren',
    walk: 'Gehen',
    hike: 'Wandern',
    mountain_hike: 'Bergwandern',
  },
  savedRunByA11y: (name: string, verb: string) => `${name}: ${verb} und aufzeichnen`,
} as const;
