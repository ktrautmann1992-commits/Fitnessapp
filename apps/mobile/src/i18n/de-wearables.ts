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
    'Routen deiner Läufe, Rad- und Geh-Runden (GPS) – daraus rechnet Alpha5 Distanz, Höhenmeter und Kilometerzeiten und zeigt die Karte. Nur für dich sichtbar.',
    'Puls während deiner Einheiten: nur Durchschnitt, Maximum und Minuten je Pulszone',
    'Ruhepuls, Schlafdauer und Schritte je Tag',
  ],
  notTitle: 'Was nicht passiert',
  notList: [
    'Alpha5 schreibt nichts in Health Connect zurück.',
    'Keine Pulskurven, keine Schlafphasen; von Routen nur eine vereinfachte Linie.',
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
    'Im nächsten Fenster wählst du, welche Daten Alpha5 lesen darf. Alles, was du abwählst, wird nicht übernommen. Erlaube auch „Trainingsrouten“ – nur dann stimmt die Distanz genau und du siehst die Karte.',
  reconsentTitle: 'Neue Fassung der Einwilligung',
  reconsentText:
    'Alpha5 liest jetzt auch die Routen (GPS) deiner Läufe, damit Distanz und Karte stimmen. Bitte lies die neue Fassung und stimme zu – bis dahin gleicht Alpha5 nichts ab.',
  reconsentAccept: 'Neuer Fassung zustimmen',
  routeAccessTitle: 'Trainingsrouten',
  routeAccessOn: '✓ Trainingsrouten: für alle Einheiten erlaubt',
  routeAccessOff:
    '– Trainingsrouten: nicht für alle erlaubt. Health Connect fragt dann je Lauf – tippe am Lauf auf „Route freigeben“. Oder erlaube sie hier: Berechtigungen öffnen → Alpha5 → „Trainingsrouten“ → „Immer zulassen“.',
  routeAccessDemo: 'Beispiel-Uhr: zwei Läufe mit Route, der älteste fragt nach der Freigabe.',
  routeConsentNeeded: (n: number) =>
    n === 1
      ? 'Für 1 Lauf fragt Health Connect nach der Route. Öffne ihn und tippe auf „Route freigeben“.'
      : `Für ${n} Läufe fragt Health Connect nach der Route. Öffne sie und tippe auf „Route freigeben“.`,
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
    'Puls-Zusammenfassungen, Tageswerte (Ruhepuls, Schlaf, Schritte) und die Routen der Uhr werden in jedem Fall gelöscht. Was soll mit den übernommenen Einheiten im Tagebuch passieren?',
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
    'Alle Pulswerte, Tageswerte (Ruhepuls, Schlaf, Schritte), die Routen der Uhr und die Verbindung werden sofort gelöscht. Übernommene Einheiten bleiben als normale Einträge ohne Puls im Tagebuch.',
  revokeConfirm: 'Widerrufen und löschen',
  revokeDone:
    'Einwilligung widerrufen. Puls, Tageswerte und Routen der Uhr sind gelöscht; übernommene Einheiten bleiben als normale Einträge.',
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
  route: {
    /** Kennzeichen in der Kopf-Karte des Laufs. */
    heroSource: '⌚ laut Uhr',
    avgHr: 'Ø Puls',
    kcal: 'kcal laut Uhr',
    legendNote: 'Route von der Uhr, nur für dich sichtbar',
    zonesTitle: 'Pulszonen',
    zonePart: (n: number, min: number) => `Zone ${n}: ${min} min`,
    zonesA11y: (parts: string) => `Zeit je Pulszone: ${parts}`,
    missingTitle: 'Strecke laut Uhr (ohne Route)',
    missingText:
      'Die Distanz stammt aus Health Connect und kann von Samsung Health abweichen. Mit der Route rechnet Alpha5 Distanz, Tempo und Höhenmeter selbst und zeigt die Karte.',
    missingHowTo:
      'So geht es: Erlaube in Health Connect für Alpha5 „Trainingsrouten“ (Einstellungen → Smartwatch → Berechtigungen öffnen) – oder gib nur diesen Lauf frei. In Samsung Health muss das Teilen der Routen mit Health Connect an sein.',
    release: 'Route freigeben',
    releasing: 'Route wird gelesen …',
    released: 'Route übernommen – Distanz und Karte kommen jetzt aus der Route.',
    releaseNone:
      'Für diesen Lauf hat die Uhr keine Route gespeichert (z. B. Laufband oder GPS aus).',
    releaseDenied: 'Route nicht freigegeben. Du kannst es jederzeit erneut versuchen.',
    releaseUnusable:
      'Die Route ist zu lückenhaft oder unplausibel – die Distanz bleibt laut Health Connect.',
    releaseOnlyAndroid: 'Route freigeben geht nur in der Android-App mit Health Connect.',
    openRoute: 'Strecke mit Karte ansehen',
  },
  errors: {
    rejected: 'Der Abgleich wurde abgelehnt. Bitte App aktualisieren und erneut versuchen.',
  },
} as const;
