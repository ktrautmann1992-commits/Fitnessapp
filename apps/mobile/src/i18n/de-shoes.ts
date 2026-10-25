import type { ShoeSport, ShoeStatus } from '@fitnessapp/core';

/**
 * Texte des Schuh-Kilometerzählers (docs/PLAN-PHASE-10.md Abschnitt 22). Hinweise immer mit Wort UND Zeichen (nie nur
 * Farbe). Die Kilometer-Faustregel ist eine Material-Angabe, keine Gesundheitsaussage (keine Verletzungs-Versprechen).
 * Wird in `de.ts` unter `shoes` eingebunden.
 */

const SPORTS: Record<ShoeSport, string> = {
  run: 'Laufen',
  walk: 'Gehen und Wandern',
  bike: 'Rad',
};

const STATUS: Record<ShoeStatus, { symbol: string; label: string }> = {
  ok: { symbol: '✓', label: 'Gut in Schuss' },
  soon: { symbol: '!', label: 'Bald wechseln' },
  replace: { symbol: '‼', label: 'Wechsel empfohlen' },
};

export const deShoes = {
  title: 'Meine Schuhe',
  intro:
    'Die App zählt die Kilometer deiner Schuhe. Jeder Lauf bekommt automatisch deinen Standard-Schuh – ändern kannst du ihn am Lauf.',
  rule: 'Faustregel: Laufschuhe halten etwa 500–800 km, dann lassen Dämpfung und Profil nach. Das ist ein Richtwert für das Material, keine Gesundheitsaussage.',
  sports: SPORTS,
  status: STATUS,
  km: (km: string) => `${km} km`,
  kmOf: (km: string, limit: string) => `${km} von ${limit} km`,
  progressA11y: (name: string, km: string, limit: string, status: string) =>
    `${name}: ${km} von ${limit} Kilometern, ${status}`,
  runs: (n: number) => (n === 1 ? '1 Lauf' : `${n} Läufe`),
  startKmNote: (km: string) => `inkl. ${km} km vorher`,
  defaultBadge: 'Standard',
  retiredBadge: 'Ausgemustert',
  empty: 'Noch keine Schuhe. Lege deinen ersten Schuh an – ab dann zählt die App mit.',
  open: 'Schuhe verwalten',
  openA11y: 'Meine Schuhe verwalten',
  add: 'Schuh hinzufügen',
  edit: 'Bearbeiten',
  offline: 'Ohne Verbindung: Änderungen werden gesendet, sobald du wieder online bist.',
  loadFailed: 'Deine Schuhe konnten nicht geladen werden.',
  retry: 'Erneut versuchen',
  form: {
    titleNew: 'Neuer Schuh',
    titleEdit: 'Schuh bearbeiten',
    name: 'Name',
    nameHint: 'z. B. Pegasus 41',
    brand: 'Marke (freiwillig)',
    sport: 'Wofür?',
    startKm: 'Schon gelaufen (km)',
    startKmHint: 'Kilometer, die der Schuh vor der App schon hatte.',
    replaceKm: 'Wechsel-Hinweis ab (km)',
    replaceKmHint: (warn: string) =>
      `Standard 800 km. „Bald wechseln“ zeigen wir ab 75 % (bei 800 km also ab ${warn} km).`,
    since: 'In Gebrauch seit',
    makeDefault: 'Als Standard-Schuh verwenden (neue Läufe bekommen ihn automatisch)',
    save: 'Speichern',
    cancel: 'Abbrechen',
    nameError: 'Bitte gib einen Namen ein (höchstens 40 Zeichen).',
    brandError: 'Höchstens 40 Zeichen.',
    startKmError: 'Bitte eine ganze Zahl von 0 bis 5.000.',
    replaceKmError: 'Bitte eine ganze Zahl von 200 bis 2.000 – oder leer lassen.',
    dateError: 'Bitte ein gültiges Datum, nicht in der Zukunft.',
    tooMany: 'Du hast schon 30 Schuhe angelegt. Lösche zuerst einen alten.',
  },
  actions: {
    makeDefault: 'Als Standard',
    makeDefaultA11y: (name: string) => `${name} als Standard-Schuh verwenden`,
    retire: 'Ausmustern',
    retireA11y: (name: string) => `${name} ausmustern`,
    unretire: 'Wieder verwenden',
    delete: 'Löschen',
    deleteTitle: 'Schuh löschen?',
    deleteText:
      'Der Schuh und seine Zuordnungen werden gelöscht. Deine Läufe bleiben – sie bekommen wieder automatisch den Standard-Schuh.',
    deleteYes: 'Löschen',
    retiredDone: (name: string) => `${name} ist ausgemustert.`,
    defaultDone: (name: string) => `${name} ist jetzt dein Standard-Schuh.`,
    saved: 'Gespeichert.',
    queued: 'Gespeichert – wird gesendet, sobald du online bist.',
    newDefaultHint: 'Dein Standard-Schuh ist ausgemustert. Wähle einen neuen Standard-Schuh.',
  },
  deleteAll: 'Alle Schuh-Angaben löschen',
  deleteAllTitle: 'Alle Schuh-Angaben löschen?',
  deleteAllText:
    'Alle Schuhe, Standards und Zuordnungen werden gelöscht. Deine Läufe bleiben erhalten.',
  deleteAllYes: 'Alles löschen',
  deletedAll: 'Alle Schuh-Angaben sind gelöscht.',
  chip: {
    label: (name: string, km: string) => `Schuh: ${name} (${km}\u00a0km)`,
    none: 'Schuh: keiner',
    auto: 'automatisch',
    a11y: (text: string) => `${text}. Ändern`,
    title: 'Schuh für diesen Lauf',
    text: 'Wähle, in welchem Schuh du unterwegs warst.',
    automatic: (name: string | null) =>
      name ? `Automatisch (Standard: ${name})` : 'Automatisch (kein Standard)',
    without: 'Ohne Schuh',
    save: 'Übernehmen',
    noShoes: 'Noch keine Schuhe angelegt.',
    manage: 'Schuhe verwalten',
  },
} as const;
