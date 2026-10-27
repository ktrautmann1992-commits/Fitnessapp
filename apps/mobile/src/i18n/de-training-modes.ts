import type {
  BodyRegion,
  ModeNotice,
  PainAdviceReason,
  PainIntensity,
  TravelEquipment,
} from '@fitnessapp/core';

/**
 * Texte der Trainings-Modi (docs/PLAN-TRAINING-MODI.md): Schmerz-/Verletzungsmodus, Reise-Modus, Aufwärmen & Dehnen.
 * Eigene Datei, damit i18n/de.ts unberührt bleibt. Kurze Sätze, „du“. Keine Diagnosen, keine Behandlungs- oder
 * Heilversprechen (Textregeln-Test: training-modes-texts.test.ts); immer nur „schonen“ und „ärztlich abklären lassen“.
 */
export const deModes = {
  settings: {
    section: 'Trainings-Modi',
    pain: 'Schmerz-/Verletzungsmodus',
    painDescription: 'Eine Stelle für ein paar Tage schonen',
    travel: 'Reise-Modus',
    travelDescription: 'Unterwegs mit wenig Geräten trainieren',
    warmup: 'Aufwärmen & Dehnen',
    warmupOn: 'An: ca. 5 Minuten davor, 5 Minuten danach',
    warmupOff: 'Aus',
    warmupHint:
      'Vor jedem Krafttraining ein kurzes Aufwärmen für die Muskeln des Tages, danach ruhiges Dehnen. Im Training kannst du beides überspringen.',
  },
  regions: {
    knee: 'Knie',
    shoulder: 'Schulter',
    lower_back: 'Unterer Rücken',
    elbow: 'Ellenbogen',
    wrist: 'Handgelenk',
    hip: 'Hüfte',
    ankle: 'Sprunggelenk',
    neck: 'Nacken',
  } satisfies Record<BodyRegion, string>,
  intensities: {
    mild: 'leicht',
    moderate: 'mittel',
    severe: 'stark',
  } satisfies Record<PainIntensity, string>,
  intensityHints: {
    mild: 'Merkbar, stört aber kaum',
    moderate: 'Stört bei manchen Bewegungen',
    severe: 'Stört deutlich, auch im Alltag',
  } satisfies Record<PainIntensity, string>,
  pain: {
    title: 'Schmerz-/Verletzungsmodus',
    intro:
      'Tippe die Stelle an, die gerade Beschwerden macht. Für die gewählte Zeit tauscht die App Übungen, die diese Stelle belasten, gegen schonendere und senkt die Belastung. Danach gilt automatisch wieder dein Plan.',
    disclaimer:
      'Das ersetzt keinen ärztlichen Rat. Die App stellt nichts fest – sie plant für ein paar Tage nur vorsichtiger.',
    stopRule: 'Hör bei Schmerzen während einer Übung sofort auf.',
    mapTitle: 'Wo hast du Beschwerden?',
    mapA11y: 'Körperkarte. Tippe eine Stelle an oder wähle sie unten aus der Liste.',
    front: 'Vorne',
    back: 'Hinten',
    listLabel: 'Stelle auswählen',
    intensityLabel: 'Wie stark?',
    durationLabel: 'Wie lange schonen?',
    days: (n: number) => `${n} Tage`,
    start: 'Schon-Modus starten',
    regionRequired: 'Bitte wähle eine Stelle.',
    intensityRequired: 'Bitte wähle, wie stark es ist.',
    durationRequired: 'Bitte wähle eine Dauer.',
    saved: (region: string, until: string) =>
      `Gespeichert. Bis ${until} schont dein Plan: ${region}.`,
    activeTitle: 'Läuft gerade',
    activeLine: (region: string, intensity: string, until: string) =>
      `${region} (${intensity}) – bis ${until}`,
    replaceHint: 'Neue Angabe für dieselbe Stelle ersetzt die laufende.',
    end: 'Beenden',
    endA11y: (region: string) => `Schon-Modus für ${region} beenden`,
    ended: 'Beendet. Ab heute gilt wieder dein normaler Plan.',
    adviceTitle: 'Bitte ärztlich abklären lassen',
    advice: {
      severe: 'Du hast starke Beschwerden angegeben.',
      long: 'Die Beschwerden halten schon länger als zwei Wochen an.',
      recurring: 'Die Beschwerden kommen an derselben Stelle immer wieder.',
    } satisfies Record<PainAdviceReason, string>,
    adviceBody:
      'Bitte lass das ärztlich abklären. Bis dahin plant die App besonders vorsichtig: schonende Übungen, weniger Sätze, niedrige Anstrengung.',
    adviceEmergency:
      'Bei sehr starken oder plötzlichen Schmerzen, Taubheit, Lähmung oder nach einem Unfall: sofort ärztliche Hilfe holen (Notruf 112).',
    previewAdvice: 'Mit dieser Angabe rät die App zur ärztlichen Abklärung.',
    consentTitle: 'Einwilligung nötig',
    consentBody:
      'Angaben zu Beschwerden sind Gesundheitsdaten. Dafür brauchst du die Einwilligung „Gesundheitsdaten“ in der aktuellen Fassung.',
    consentButton: 'Einwilligung ansehen',
    consentPending:
      'Der Schon-Modus braucht eine neue Fassung der Einwilligung „Gesundheitsdaten“. Sie wird gerade rechtlich geprüft – danach kannst du ihn nutzen.',
    historyTitle: 'Frühere Einträge',
    historyEmpty: 'Noch keine früheren Einträge.',
    historyLine: (region: string, intensity: string, from: string, to: string) =>
      `${region} (${intensity}): ${from} – ${to}`,
    historyNote: 'Einträge werden nach 12 Monaten automatisch gelöscht.',
    deleteAll: 'Alle Einträge löschen',
    deleteAllTitle: 'Alle Einträge löschen?',
    deleteAllBody:
      'Alle Angaben im Schon-Modus werden gelöscht – auch laufende. Dein Plan gilt dann wieder normal.',
    deleted: 'Alle Einträge gelöscht.',
    privacy: 'Privat: nur für dich, nie im Partner-Modus, nie auf Teilen-Bildern, nie im PDF.',
  },
  equipment: {
    bodyweight: 'Nur Körpergewicht',
    dumbbells: 'Kurzhanteln',
    hotel_gym: 'Hotel-Gym',
    band: 'Widerstandsband',
    suspension_trainer: 'Schlingentrainer',
    rings: 'Turnringe',
    outdoor_park: 'Calisthenics-Park',
  } satisfies Record<TravelEquipment, string>,
  equipmentHints: {
    bodyweight: 'Keine Geräte',
    dumbbells: 'Ein Paar Kurzhanteln',
    hotel_gym: 'Kurzhanteln, Bank, Laufband oder Rad',
    band: 'Ein Widerstandsband',
    suspension_trainer: 'Gurte mit Griffen, Anker an Tür oder Stange',
    rings: 'Ringe zum Aufhängen',
    outdoor_park: 'Klimmzugstange und Barren draußen',
  } satisfies Record<TravelEquipment, string>,
  travel: {
    title: 'Reise-Modus',
    intro:
      'Für die Reisetage stellt die App deine Einheiten auf die Geräte unterwegs um. Dein Plan bleibt gespeichert – nach dem letzten Reisetag gilt er automatisch wieder.',
    from: 'Erster Reisetag',
    to: 'Letzter Reisetag',
    equipmentLabel: 'Was hast du dabei?',
    minutesLabel: 'Kürzere Einheiten? (optional)',
    minutesNone: 'Wie geplant',
    minutes: (n: number) => `${n} min`,
    start: 'Reise-Modus speichern',
    dateInvalid: 'Bitte gib gültige Daten ein (TT.MM.JJJJ).',
    startPast: 'Der erste Reisetag darf nicht in der Vergangenheit liegen.',
    endBeforeStart: 'Der letzte Reisetag liegt vor dem ersten.',
    tooLong: 'Höchstens 6 Wochen. Für längere Reisen erstelle besser einen neuen Plan.',
    tooFar: 'Der erste Reisetag liegt zu weit in der Zukunft.',
    equipmentRequired: 'Bitte wähle, was du dabei hast.',
    overlap: 'In diesem Zeitraum gibt es schon einen Reise-Modus.',
    saved: (from: string, to: string) => `Gespeichert: Reise-Modus vom ${from} bis ${to}.`,
    plannedTitle: 'Geplant und laufend',
    line: (from: string, to: string, equipment: string) => `${from} – ${to} · ${equipment}`,
    lineMinutes: (minutes: number) => `Einheiten höchstens ${minutes} min`,
    end: 'Beenden',
    remove: 'Entfernen',
    ended: 'Beendet. Ab heute gilt wieder dein normaler Plan.',
    removed: 'Reise-Modus entfernt.',
    suspensionNote:
      'Für den Schlingentrainer gibt es noch keine eigenen Übungen. Bis dahin plant die App mit Übungen ohne Geräte.',
  },
  banner: {
    travelActive: (until: string) => `Reise-Modus bis ${until}`,
    travelUpcoming: (from: string, until: string) => `Reise-Modus vom ${from} bis ${until}`,
    travelDetail: (equipment: string) => `Training mit: ${equipment}`,
    travelMinutes: (minutes: number) => `Einheiten höchstens ${minutes} min`,
    painActive: (until: string) => `Schon-Modus bis ${until}`,
    painRegions: (regions: string) => `Geschont: ${regions}`,
    manageTravel: 'Reise-Modus ändern',
    managePain: 'Schon-Modus ändern',
  },
  notices: {
    travel_active: 'Reise-Modus: Übungen passend zu den Geräten unterwegs.',
    travel_swapped: 'Für die Reise getauscht.',
    travel_removed: 'Einige Übungen entfallen auf der Reise (keine passende Übung).',
    travel_shortened: 'Auf die Reise-Dauer gekürzt.',
    pain_active: 'Schon-Modus: weniger Belastung, schonende Übungen.',
    pain_swapped: 'Übungen getauscht, um die Stelle zu schonen.',
    pain_removed: 'Einige Übungen entfallen heute – es gibt keine schonende Alternative.',
    pain_session_empty:
      'Heute passt keine Übung. Gönn der Stelle eine Pause – lockeres Gehen ist in Ordnung, wenn es sich gut anfühlt.',
    pain_medical_advice: 'Bitte lass die Beschwerden ärztlich abklären.',
    pain_endurance_easier:
      'Heute kürzer und locker (Anstrengung höchstens 3 von 10). Gelenkschonend geht z. B. Rad-Ergometer oder Schwimmen – nur, wenn es sich gut anfühlt.',
    pain_endurance_check:
      'Diese Einheit hat einen festen Ablauf. Mach sie heute nur, wenn sie sich gut anfühlt – sonst lieber locker oder Pause.',
    pain_row_alternative:
      'Rudern belastet unteren Rücken, Knie und Handgelenke. Heute lieber Rad-Ergometer oder zügiges Gehen mit derselben Dauer – nur, wenn es sich gut anfühlt.',
    travel_row_hotel_gym:
      'Rudern geht, wenn im Hotel-Gym ein Rudergerät steht – sonst Laufband, Rad-Ergometer oder zügiges Gehen.',
    travel_row_alternative:
      'Unterwegs ohne Rudergerät: Mach die Einheit als zügiges Gehen oder lockeren Lauf mit derselben Dauer.',
  } satisfies Record<ModeNotice, string>,
  marks: {
    travel: 'für die Reise getauscht',
    pain: 'heute geschont',
  },
  swapPaused: 'Während ein Modus läuft, wählt die App die Übungen selbst aus.',
  warmup: {
    title: 'Aufwärmen',
    forMuscles: (muscles: string) => `Für ${muscles}`,
    cooldownTitle: 'Dehnen danach',
    minutes: (n: number) => `ca. ${n} min`,
    skip: 'Überspringen',
    skipA11y: (title: string) => `${title} überspringen`,
    skipped: 'Übersprungen.',
    show: 'Wieder anzeigen',
    seconds: (n: number) => `${n} s`,
    reps: (n: number) => `${n} Wdh.`,
    perSide: 'je Seite',
    rampSets: (sets: number, reps: number) => `${sets} × ${reps} Wdh.`,
    light_weight: 'leichtes Gewicht (etwa die Hälfte)',
    half_reps: 'ruhig, halbe Wiederholungen',
    fallbackWarmup: 'Aufwärmen laut Plan',
    fallbackCooldown: 'Cool-down laut Plan',
    draft: 'Testinhalt',
    stretchNote: 'Ruhig atmen, nicht wippen.',
  },
} as const;
