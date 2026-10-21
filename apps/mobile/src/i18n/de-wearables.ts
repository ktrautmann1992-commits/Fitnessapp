/**
 * Smartwatch über Health Connect (Phase 8, docs/PLAN-PHASE-8.md 7.2): Einstellungen → „Smartwatch verbinden“,
 * Hinweise im Tagebuch und Puls in der Auswertung. Ohne Werte in Fehlermeldungen (Art. 9).
 */
export const deWearables = {
  settingsTitle: 'Smartwatch',
  settingsText:
    'Einheiten, Puls, Schlaf und Schritte deiner Galaxy Watch (über Health Connect) automatisch ins Tagebuch übernehmen.',
  settingsLink: 'Smartwatch verbinden',
  title: 'Smartwatch verbinden',
  intro:
    'Alpha5 übernimmt Daten deiner Smartwatch aus Health Connect – der Datensammelstelle von Android. Deine Uhr-App (z. B. Samsung Health) schreibt dort hinein, Alpha5 liest nur.',
  whatTitle: 'Was übernommen wird',
  whatList: [
    'Trainingseinheiten (Art, Dauer, Distanz, kcal) – erscheinen im Tagebuch mit Uhr-Symbol',
    'Puls während deiner Einheiten: nur Durchschnitt, Maximum und Minuten je Pulszone',
    'Ruhepuls, Schlafdauer und Schritte je Tag',
  ],
  notTitle: 'Was nicht passiert',
  notList: [
    'Alpha5 schreibt nichts in Health Connect zurück.',
    'Keine Strecken (GPS) der Uhr, keine Pulskurven, keine Schlafphasen.',
    'Kein Abgleich im Hintergrund – nur beim Öffnen der App oder mit „Jetzt abgleichen“.',
    'Keine Weitergabe, kein Teilen; Puls steht nie auf einem geteilten Bild.',
  ],
  onlyAndroidTitle: 'Nur in der Android-App',
  onlyAndroid:
    'Smartwatch verbinden geht nur in der Alpha5-App auf einem Android-Handy (über Health Connect). Im Browser und auf dem iPhone siehst du hier die Daten, die schon übernommen wurden.',
  demoTitle: 'Testmodus: Beispieldaten',
  demoText:
    'Im Testmodus kannst du die Verbindung mit ausgedachten Beispieldaten ausprobieren (eine Woche mit Läufen, Puls, Schlaf und Schritten).',
  demoConnect: 'Beispiel-Uhr verbinden (Testmodus)',
  consentTitle: 'Deine Einwilligung',
  consentText:
    'Smartwatch-Daten sind Gesundheitsdaten. Wir speichern sie nur mit deiner ausdrücklichen Einwilligung – getrennt von deinen übrigen Einwilligungen.',
  consentRead: 'Einwilligungstext lesen',
  consentAccept: 'Zustimmen und verbinden',
  needsHealthConsent:
    'Dafür brauchst du zuerst die Einwilligung „Gesundheitsdaten“ (Einstellungen → Einwilligungen).',
  connect: 'Weiter zu Health Connect',
  connectHint:
    'Im nächsten Fenster wählst du, welche Daten Alpha5 lesen darf. Alles, was du abwählst, wird nicht übernommen.',
  installTitle: 'Health Connect fehlt',
  installText:
    'Auf deinem Handy ist Health Connect nicht installiert oder veraltet. Ab Android 14 ist es eingebaut; bei älteren Versionen installierst du die App „Health Connect“ aus dem Play Store.',
  install: 'Health Connect installieren',
  permissionMissingTitle: 'Zugriff fehlt',
  permissionMissing:
    'In Health Connect sind keine Daten für Alpha5 freigegeben. Öffne die Berechtigungen und erlaube die gewünschten Daten.',
  openPermissions: 'Berechtigungen öffnen',
  statusTitle: 'Verbunden',
  connectedSince: (date: string) => `Verbunden seit ${date}`,
  lastSync: (when: string) => `Letzter Abgleich: ${when}`,
  neverSynced: 'Noch kein Abgleich',
  lastCount: (n: number) =>
    n === 1
      ? '1 Einheit beim letzten Abgleich übernommen'
      : `${n} Einheiten beim letzten Abgleich übernommen`,
  grantedTitle: 'Freigegebene Daten',
  types: {
    exercise: 'Trainingseinheiten',
    distance: 'Distanz',
    calories: 'Verbrauchte kcal',
    heart_rate: 'Puls',
    resting_heart_rate: 'Ruhepuls',
    sleep: 'Schlaf',
    steps: 'Schritte',
  },
  notGranted: 'nicht freigegeben',
  syncNow: 'Jetzt abgleichen',
  syncing: 'Abgleich läuft …',
  syncDone: (created: number, merged: number) =>
    created + merged === 0
      ? 'Abgleich fertig – keine neuen Einheiten.'
      : `Abgleich fertig – ${created} neu${merged > 0 ? `, ${merged} mit eigener Aufzeichnung zusammengeführt` : ''}.`,
  syncSkipped: (n: number) =>
    n === 1
      ? '1 Eintrag wurde nicht übernommen (unplausibel oder zu kurz).'
      : `${n} Einträge wurden nicht übernommen (unplausibel oder zu kurz).`,
  syncQueued: 'Keine Verbindung – der Abgleich wird gesendet, sobald du wieder online bist.',
  syncFailed:
    'Abgleich fehlgeschlagen. Bitte später erneut versuchen – deine Daten gehen nicht verloren.',
  noData:
    'Noch keine Daten von der Uhr. Prüfe in Samsung Health unter Einstellungen → Health Connect, ob Alpha5 Daten bekommt. Neue Einheiten erscheinen dort manchmal erst nach einigen Minuten.',
  pending: (n: number) =>
    n === 1 ? '1 Abgleich wartet auf Verbindung.' : `${n} Abgleiche warten auf Verbindung.`,
  offline: 'Offline – angezeigt wird der zuletzt geladene Stand.',
  dailyTitle: 'Tageswerte der letzten 7 Tage',
  dailyEmpty: 'Noch keine Tageswerte.',
  dailyRow: (day: string, parts: string) => `${day}: ${parts}`,
  steps: (n: string) => `${n} Schritte`,
  sleep: (h: number, m: number) => `${h} h ${String(m).padStart(2, '0')} min Schlaf`,
  restingHr: (bpm: number) => `Ruhepuls ${bpm}/min`,
  disconnect: 'Trennen',
  disconnectTitle: 'Smartwatch trennen?',
  disconnectText:
    'Puls-Zusammenfassungen und Tageswerte (Ruhepuls, Schlaf, Schritte) werden in jedem Fall gelöscht. Was soll mit den übernommenen Einheiten im Tagebuch passieren?',
  disconnectKeep: 'Einheiten behalten',
  disconnectDelete: 'Einheiten löschen',
  disconnectCancel: 'Abbrechen',
  disconnectedKeep: 'Getrennt. Die Einheiten bleiben als normale Einträge im Tagebuch.',
  disconnectedDelete: (n: number) =>
    n === 1
      ? 'Getrennt. 1 übernommene Einheit wurde gelöscht.'
      : `Getrennt. ${n} übernommene Einheiten wurden gelöscht.`,
  disconnectHintHc:
    'Tipp: Den Zugriff in Health Connect selbst nimmst du unter Einstellungen → Sicherheit & Datenschutz → Health Connect → App-Berechtigungen → Alpha5 zurück.',
  revokeTitle: 'Einwilligung Smartwatch-Daten widerrufen?',
  revokeText:
    'Alle Pulswerte und Tageswerte (Ruhepuls, Schlaf, Schritte) und die Verbindung werden sofort gelöscht. Übernommene Einheiten bleiben als normale Einträge ohne Puls im Tagebuch.',
  revokeConfirm: 'Widerrufen und löschen',
  revokeDone:
    'Einwilligung widerrufen. Puls und Tageswerte sind gelöscht; übernommene Einheiten bleiben als normale Einträge.',
  badge: (origin: string) => `⌚ aus ${origin}`,
  historyMarker: '⌚ Smartwatch',
  origins: {
    samsung_health: 'Samsung Health',
    google_fit: 'Google Fit',
    fitbit: 'Fitbit',
    garmin: 'Garmin Connect',
    polar: 'Polar Flow',
    other: 'einer Uhr-App',
  },
  kcal: (n: number) => `${n} kcal (laut Uhr)`,
  duplicateTitle: 'Möglicher Doppel-Eintrag',
  duplicateText:
    'Diese Einheit von der Uhr könnte dieselbe sein wie ein anderer Eintrag am selben Tag. Zusammenführen: Der andere Eintrag bleibt und bekommt Puls und kcal von der Uhr.',
  duplicateOpen: 'Anderen Eintrag ansehen',
  duplicateMerge: 'Zusammenführen',
  duplicateKeep: 'Beide behalten',
  duplicateMerged: 'Zusammengeführt.',
  duplicateKept: 'Beide Einträge bleiben.',
  heartTitle: 'Puls (laut Uhr)',
  heartAvg: 'Ø Puls',
  heartMax: 'Max. Puls',
  heartUnit: (bpm: number) => `${bpm}/min`,
  zonesTitle: 'Zeit je Pulszone',
  zone: (n: number) => `Zone ${n}`,
  zoneNames: ['sehr leicht', 'leicht', 'mittel', 'hart', 'maximal'],
  zoneValue: (min: number) => `${min} min`,
  zonesNote: (hfMax: number) =>
    `Pulszonen sind Schätzwerte (Maximalpuls ${hfMax}/min, geschätzt aus dem Alter). Medikamente wie Betablocker verändern den Puls.`,
  errors: {
    rejected: 'Der Abgleich wurde abgelehnt. Bitte App aktualisieren und erneut versuchen.',
  },
} as const;
