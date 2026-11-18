import type { CustomWorkoutArea } from '@fitnessapp/core';

/**
 * Texte „Eigenes Workout“ und „Übung tauschen“ in Workouts (docs/PLAN-EIGENE-WORKOUTS.md). Eigene Datei, direkt
 * importiert (wie de-yoga.ts) – andere Bereiche bleiben unberührt.
 */
const minutes = (n: number) => `${n} Min.`;

export const deMyWorkouts = {
  areas: {
    full_body: 'Ganzkörper',
    legs: 'Beine',
    glutes: 'Po',
    back: 'Rücken',
    chest: 'Brust',
    shoulders: 'Schultern',
    arms: 'Arme',
    core: 'Bauch/Core',
  } satisfies Record<CustomWorkoutArea, string>,
  list: {
    create: 'Eigenes Workout erstellen',
    createHint: 'Zeit, Muskelgruppen und Lieblingsübungen wählen – die App baut dein Workout.',
    title: 'Meine Workouts',
    empty:
      'Noch keine eigenen Workouts. Erstelle eins – es steht dann hier und lässt sich immer wieder starten.',
    meta: (min: number, tracks: number) => `${minutes(min)} · ${tracks} Tracks`,
    a11y: (name: string, min: number) => `${name}, eigenes Workout, etwa ${min} Minuten`,
    offline:
      'Offline: gespeicherter Stand. Änderungen werden übertragen, sobald du wieder online bist.',
    loadFailed: 'Deine Workouts konnten nicht geladen werden.',
  },
  wizard: {
    title: 'Eigenes Workout',
    durationTitle: 'Wie lange möchtest du trainieren?',
    durationChip: (n: number) => minutes(n),
    areasTitle: 'Welche Muskelgruppen?',
    areasHint: 'Mehrere möglich. Große Muskeln kommen zuerst, Bauch/Core zum Schluss.',
    equipmentTitle: 'Welche Geräte hast du dabei?',
    equipmentHint:
      'Vorausgewählt: deine Angaben im Profil. Ohne Auswahl wird es ein Workout ohne Geräte.',
    noEquipment: 'Ohne Geräte',
    favoritesTitle: 'Lieblingsübungen (freiwillig)',
    favoritesHint: 'Die App nimmt sie zuerst, wenn sie zu deinen Muskelgruppen und Geräten passen.',
    dislikesTitle: 'Übungen, die du nicht magst (freiwillig)',
    dislikesHint:
      'Diese Übungen kommen in keinem eigenen Workout und bei keinem Tausch mehr vor. Du kannst sie jederzeit wieder zulassen.',
    search: 'Übung suchen',
    searchPlaceholder: 'z. B. Kniebeuge',
    searchEmpty: 'Keine Übung gefunden.',
    searchHint: 'Mindestens zwei Buchstaben eingeben.',
    chosen: 'Ausgewählt',
    remove: (name: string) => `${name} entfernen`,
    next: 'Weiter',
    back: 'Zurück',
    build: 'Workout erstellen',
    chooseArea: 'Bitte mindestens eine Muskelgruppe wählen.',
    cancel: 'Abbrechen',
  },
  preview: {
    title: 'Dein Workout',
    total: (n: number) => `Gesamt etwa ${minutes(n)}`,
    totalA11y: (n: number, target: number) =>
      `Gesamtdauer etwa ${n} Minuten, Ziel ${target} Minuten`,
    target: (n: number) => `Ziel: ${minutes(n)}`,
    track: (n: number, label: string) => `Track ${n} – ${label}`,
    swap: 'Tauschen',
    swapA11y: (name: string) => `${name} tauschen`,
    remove: 'Entfernen',
    removeA11y: (name: string) => `${name} entfernen`,
    up: (name: string) => `${name} nach oben`,
    down: (name: string) => `${name} nach unten`,
    add: 'Übung hinzufügen',
    addA11y: (label: string) => `Übung zu ${label} hinzufügen`,
    full: 'Mehr als 12 Übungen gehen nicht – entferne erst eine.',
    keepOne: 'Aufwärmen und Dehnen behalten immer mindestens eine Übung.',
    reroll: 'Neu würfeln',
    save: 'Speichern',
    saveChanges: 'Änderungen speichern',
    start: 'Jetzt starten',
    edit: 'Bearbeiten',
    delete: 'Löschen',
    deleteTitle: 'Workout löschen?',
    deleteMessage: (name: string) =>
      `„${name}“ wird gelöscht. Das lässt sich nicht rückgängig machen.`,
    deleted: 'Workout gelöscht.',
    name: 'Name',
    nameHint: 'Unter diesem Namen steht das Workout in „Meine Workouts“.',
    nameInvalid: 'Bitte 3–60 Zeichen.',
    saved: 'Gespeichert. Du findest es unter „Meine Workouts“.',
    queued: 'Gespeichert – wird übertragen, sobald du online bist.',
    saveFailed: 'Speichern hat nicht geklappt. Bitte erneut versuchen.',
    limit: 'Du hast schon 50 eigene Workouts – lösche erst eins.',
    noWork:
      'Mit diesen Angaben passt keine Übung. Wähle andere Muskelgruppen, mehr Geräte oder lass weniger Übungen weg.',
    noCandidates: (areas: string) => `Für ${areas} passt mit deinen Angaben keine Übung.`,
    favoriteSkipped: (name: string, reason: string) => `„${name}“ ist nicht dabei: ${reason}`,
    favoriteReasons: {
      not_found: 'die Übung gibt es nicht (mehr).',
      not_eligible: 'die Übung gibt es nur in ihrem eigenen Workout.',
      disliked: 'sie steht auf „Mag ich nicht“.',
      equipment: 'dafür fehlt ein Gerät.',
      not_allowed: 'sie passt nicht zu deinem Gesundheits-Check.',
      too_hard: 'sie ist für deinen Stand noch zu schwer.',
      no_area: 'sie passt zu keiner gewählten Muskelgruppe.',
      no_room: 'es ist kein Platz mehr frei.',
    },
    durationShort: (n: number) =>
      `Mit diesen Übungen dauert das Workout nur etwa ${minutes(n)}. Füge Übungen hinzu oder wähle mehr Geräte.`,
    durationLong: (n: number) =>
      `Bei so vielen Muskelgruppen dauert das Workout etwa ${minutes(n)}. Weniger Gruppen machen es kürzer.`,
    notFound: 'Dieses Workout gibt es nicht (mehr).',
    backToList: 'Zurück zu den Workouts',
    safety:
      'Aufwärmen ist immer dabei. Bei Schmerzen, Schwindel oder Atemnot sofort aufhören. Die Schwierigkeit richtet sich nach deinem Stand und deinem Gesundheits-Check.',
  },
  swap: {
    title: 'Übung tauschen',
    insteadOf: (name: string) => `Statt „${name}“:`,
    none: 'Keine passende Alternative mit deinen Geräten und Vorlieben.',
    close: 'Schließen',
    pick: (name: string) => `${name} wählen`,
    reasons: {
      alternative: 'Empfohlene Alternative',
      same_pattern: 'Gleiche Bewegung',
      same_muscles: 'Gleiche Muskeln',
    },
    adjusted: 'angepasst',
    adjustedA11y: 'Von dir angepasst: einzelne Übungen getauscht',
    swappedFrom: (name: string) => `getauscht, statt ${name}`,
    restore: 'Original wiederherstellen',
    restored: 'Original wiederhergestellt.',
    saved: 'Getauscht. Beim nächsten Start gilt deine Variante.',
    failed: 'Tauschen hat nicht geklappt. Bitte erneut versuchen.',
  },
  add: {
    title: (label: string) => `Übung zu ${label}`,
    empty: 'Keine weitere passende Übung.',
  },
} as const;
