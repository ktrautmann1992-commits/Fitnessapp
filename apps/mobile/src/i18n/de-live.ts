import { LIVE_EMERGENCY_HINT, type LiveSport } from '@fitnessapp/core';

/**
 * Texte der Live-Begleitung / Notfallkontakte (CLAUDE.md Ausnahme 25.10.2026, docs/PLAN-PHASE-10.md 21). Sicherheit,
 * keine Community: nur auf eigenen Tipp, nur während der Aufzeichnung, Kontakte nur auf dem Gerät, keine
 * Gesundheitsdaten. Wird in `de.ts` unter `live` eingebunden.
 */

const SPORTS: Record<LiveSport, string> = {
  run: 'Laufen',
  bike: 'Rad',
  walk: 'Gehen',
};

export const deLive = {
  sports: SPORTS,
  emergencyHint: LIVE_EMERGENCY_HINT,
  notEmergencyService: 'Die Live-Begleitung ist kein Notruf-Ersatz.',

  contacts: {
    title: 'Notfallkontakte',
    settingsLink: 'Notfallkontakte & Live-Begleitung',
    settingsText:
      'Bis zu 3 Kontakte, nur auf diesem Handy. Für Live-Begleitung und SOS beim Aufzeichnen.',
    intro:
      'Notfallkontakte bleiben nur auf diesem Handy (verschlüsselt) – sie werden nie an unseren Server geschickt und bekommen von uns keine Nachricht. Beim Handywechsel bitte neu eintragen.',
    empty: 'Noch keine Notfallkontakte.',
    add: 'Kontakt hinzufügen',
    edit: 'Bearbeiten',
    remove: 'Entfernen',
    removeConfirm: (name: string) => `${name} aus den Notfallkontakten entfernen?`,
    max: (n: number) => `Höchstens ${n} Notfallkontakte.`,
    name: 'Name',
    phone: 'Telefonnummer',
    phoneHint: 'z. B. 0171 1234567 oder +43 664 1234567',
    email: 'E-Mail (freiwillig)',
    needOne: 'Bitte Telefonnummer oder E-Mail-Adresse eingeben.',
    nameMissing: 'Bitte einen Namen eingeben.',
    phoneInvalid: 'Bitte eine gültige Telefonnummer eingeben.',
    emailInvalid: 'Bitte eine gültige E-Mail-Adresse eingeben.',
    country: 'Land für Nummern mit 0 am Anfang',
    countries: { DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz' },
    isDefault: 'Standard-Kontakt (vorausgewählt)',
    defaultBadge: 'Standard',
    save: 'Speichern',
    cancel: 'Abbrechen',
    saved: 'Gespeichert – nur auf diesem Handy.',
    saveFailed: 'Speichern hat nicht geklappt. Bitte noch einmal versuchen.',
    settingsTitle: 'Live-Begleitung',
    displayName: 'Dein Name für die Begleit-Seite',
    displayNameHint: 'Sehen nur Personen mit deinem Link. Höchstens 30 Zeichen.',
    message: 'Text vor dem Link (freiwillig)',
    messageHint: 'Leer = „Ich bin laufen. Hier siehst du live, wo ich gerade bin …“',
    interval: 'Position senden alle',
    intervals: (s: number) => `${s} s`,
    intervalHint:
      'Nur bei Bewegung (ab 20 m) bzw. spätestens jede Minute. Kürzer braucht etwas mehr Akku.',
    reminder: '„Kein Lebenszeichen“-Erinnerung',
    reminderOff: 'Aus',
    reminderAfter: (m: number) => `${m} min nach Plan`,
    reminderHint:
      'Eine Erinnerung NUR an dich auf diesem Handy, wenn du länger als geplant unterwegs bist. Deine Kontakte bekommen dabei keine Nachricht.',
    privacy:
      'Bei der Live-Begleitung sehen deine Kontakte nur deinen Namen, die Sportart, die Startzeit und deine letzte Position – keine Strecke, keinen Puls, keine anderen Gesundheitsdaten. Nach „Angekommen“ wird die Position sofort gelöscht.',
  },

  sheet: {
    open: 'Live-Begleitung starten',
    title: 'Live-Begleitung',
    intro:
      'Vertrauenspersonen sehen über einen geheimen Link, wo du gerade bist – nur während dieser Aufzeichnung, höchstens 12 Stunden. Du kannst sie jederzeit beenden.',
    contacts: 'Mit wem teilen?',
    noContacts: 'Keine Notfallkontakte – du kannst den Link trotzdem selbst teilen.',
    manageContacts: 'Notfallkontakte verwalten',
    displayName: 'Dein Name auf der Begleit-Seite',
    duration: 'Geplante Dauer',
    durations: (min: number) =>
      min < 60 ? `${min} min` : `${String(min / 60).replace('.', ',')} h`,
    share: 'Link teilen',
    start: 'Starten und Link teilen',
    battery:
      'Braucht etwas mehr Akku. Bei manchen Handys „Akku-Optimierung“ für Alpha5 ausschalten.',
    replaceTitle: 'Es läuft noch eine Live-Begleitung',
    replaceText: 'Vielleicht auf einem anderen Gerät. Beenden und hier neu starten?',
    replaceYes: 'Beenden und neu starten',
    cancel: 'Abbrechen',
    shareTitle: 'Live-Begleitung',
    smsTo: (name: string) => `SMS an ${name}`,
    whatsappTo: (name: string) => `WhatsApp an ${name}`,
    emailTo: (name: string) => `E-Mail an ${name}`,
    nameRequired: 'Bitte deinen Namen für die Begleit-Seite eingeben (höchstens 30 Zeichen).',
    failed:
      'Live-Begleitung konnte nicht starten. Bitte Verbindung prüfen und noch einmal versuchen.',
    notSignedIn: 'Bitte zuerst anmelden.',
    demo: 'Testmodus: Der Link zeigt eine Demo-Seite mit ausgedachten Daten – es wird nichts gesendet.',
    copy: 'Text mit Link kopieren',
    copied: 'Link kopiert.',
  },

  banner: {
    active: 'Live-Begleitung aktiv',
    paused: 'Live-Begleitung pausiert',
    sharedWith: (names: string) => `Sichtbar für ${names}`,
    sharedLink: 'Sichtbar für alle mit deinem Link',
    offline: 'Gerade keine Verbindung – die neueste Position wird nachgereicht.',
    arrived: 'Angekommen',
    end: 'Beenden',
    shareAgain: 'Link erneut teilen',
    newLink: 'Neuen Link erzeugen',
    newLinkDone: 'Neuer Link erzeugt – der alte funktioniert nicht mehr.',
    a11y: (status: string, who: string) => `${status}. ${who}`,
  },

  closed: {
    arrived: 'Angekommen gemeldet – deine Position ist gelöscht.',
    ended: 'Live-Begleitung beendet – deine Position ist gelöscht.',
  },

  save: {
    title: 'Live-Begleitung läuft noch',
    text: 'Melde „Angekommen“, dann sehen deine Kontakte, dass alles gut ist. Beim Speichern oder Verwerfen endet die Begleitung automatisch.',
  },

  sos: {
    button: 'SOS',
    title: 'SOS – Hilfe holen',
    intro:
      'Öffnet SMS, WhatsApp oder Telefon mit vorbereitetem Text und deinem letzten Standort. Senden bzw. anrufen tippst du selbst.',
    call: (name: string) => `${name} anrufen`,
    sms: (name: string) => `SMS an ${name}`,
    whatsapp: (name: string) => `WhatsApp an ${name}`,
    email: (name: string) => `E-Mail an ${name}`,
    emergency: '112 anrufen',
    noContacts: 'Keine Notfallkontakte eingetragen.',
    noPosition: 'Noch kein Standort bekannt – der Text sagt das dazu.',
    close: 'Schließen',
    failed: 'Konnte die App nicht öffnen.',
  },

  reminder: {
    title: 'Alles in Ordnung?',
    body: 'Du bist länger unterwegs als geplant. Tippe auf „Mir geht’s gut“ oder öffne SOS.',
    ok: 'Mir geht’s gut',
    sos: 'SOS öffnen',
  },
} as const;
