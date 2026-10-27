import type { HyroxDivision, HyroxSplitSegment, HyroxStation } from '../enums';

/**
 * Feste deutsche Textbausteine Hyrox (docs/PLAN-SPORTARTEN-STUFE-1.md 2.1/4, Etappe H): Stationen, Kombi- und Stations-
 * Einheit, Hinweise. „Hyrox“ nur beschreibend (Entscheidung 3), keine Heilversprechen, keine Ranglisten oder Vergleiche.
 * PRODUKTENTSCHEIDUNG – fachliche Prüfung vor Veröffentlichung (Entscheidung 12).
 */
export const HYROX_TEXTS_DE = {
  /** Name der Disziplin (Ziel, „Mein Wettkampf“). */
  discipline: 'Hyrox-Wettkampf',
  stations: {
    ski_erg: 'Ski-Ergometer',
    sled_push: 'Schlitten schieben',
    sled_pull: 'Schlitten ziehen',
    burpee_broad_jumps: 'Burpee-Weitsprünge',
    rowing: 'Rudern',
    farmers_carry: "Farmer's Carry",
    sandbag_lunges: 'Sandsack-Ausfallschritte',
    wall_balls: 'Wall Balls',
  } satisfies Record<HyroxStation, string>,
  divisions: {
    open: 'Open',
    pro: 'Pro',
    doubles: 'Doubles (zu zweit)',
    relay: 'Staffel',
  } satisfies Record<HyroxDivision, string>,
  divisionHint:
    'Open und Pro unterscheiden sich in den Gewichten. Doubles und Staffel trainieren mit demselben Plan wie Open.',
  minorDivisionHint: 'Unter 18 planen wir nur die Division Open.',
  combo: {
    name: 'Hyrox-Kombi',
    simulationName: 'Hyrox-Simulation',
    techniqueName: 'Technik-Kombi (locker)',
    warmup: '8 Minuten locker einlaufen, dann 2–3 lockere Steigerungen.',
    cooldown: '4 Minuten locker auslaufen, dann gehen und leicht dehnen.',
    techniqueWarmup: '8 Minuten locker einlaufen.',
    main: (rounds: number, distance: string, parts: string) =>
      `${rounds} Runden: je ca. ${distance} zügig laufen, direkt danach die Station – ${parts}. Wechsel ohne Pause, aber kontrolliert.`,
    simulation: (parts: string) =>
      `Alle Stationen einmal in Rennreihenfolge mit halber Menge: je ca. 500 m zügig laufen, dann die Station – ${parts}. Nie „alles geben“.`,
    technique: (rounds: number, parts: string, walk = false) =>
      `${rounds} Runden ganz locker: je ein paar Minuten ${walk ? 'zügig gehen' : 'locker laufen'}, dann die Station in Ruhe üben – ${parts}. Sprechen bleibt immer möglich.`,
  },
  stationSession: {
    name: 'Hyrox-Stationen',
    warmup:
      '5–8 Minuten locker warm machen (Rudergerät, Seilspringen oder Gehen), dann Armkreisen, Hüftkreisen und ein paar Kniebeugen ohne Gewicht.',
    cooldown: '5 Minuten locker gehen, dann Beine, Hüfte und Schultern leicht dehnen.',
    stationNote: (station: string) => `Station: ${station}`,
    replacedNote: (station: string) => `Ersatz für die Station ${station}`,
  },
  /** Hinweis, wenn eine Station ersetzt wird (Plan 2.1, wie „Training ohne Geräte“). */
  replacedNotice: {
    sled: 'Ohne Schlitten – wir ersetzen die Station.',
    other: 'Ohne Spezialgerät – wir ersetzen die Station durch eine ähnliche Übung.',
  },
  noStationDay:
    'Für die Stations-Einheit brauchst du einen Kraft-Tag in deiner Woche. Ohne Kraft-Tag planen wir nur Lauf und Kombi.',
  seniorConfirmation:
    'Ab 65 erstellen wir einen Hyrox-Plan nur, wenn du bestätigst, dass du dich fit genug fühlst und das Vorhaben mit deiner Ärztin oder deinem Arzt besprochen hast. Burpee-Weitsprünge lassen wir weg.',
  medicalHint:
    'Wegen deines Gesundheits-Checks gibt es keine harten Kombi-Einheiten – stattdessen eine lockere Technik-Kombi.',
  pregnancy:
    'In der Schwangerschaft erstellen wir keinen Hyrox-Plan. Sprich bitte mit deiner Ärztin oder deinem Arzt.',
  painRunOnly: 'Schon-Modus: Heute nur den Lauf-Teil der Kombi, die Stationen lässt du weg.',
  travelCircuit: 'Reise: Stationen als Körpergewicht-Zirkel.',
  /** Reise-Modus im Timer (Restpunkte 27.10.2026): Kombi als „Lauf + Körpergewicht-Zirkel“. */
  travel: {
    name: 'Lauf + Körpergewicht-Zirkel',
    notice:
      'Reise-Modus: Statt der Stationen machst du eine Übung mit deinen Reise-Geräten – gleiche Zeit, gleiches Muster.',
    step: (exercise: string | null) =>
      exercise === null ? 'Zirkel: locker weiterlaufen' : `Zirkel: ${exercise}`,
  },
  result: {
    name: 'Hyrox-Rennen',
    total: 'Gesamtzeit',
    splitsOptional: 'Teilzeiten (freiwillig)',
    private: 'Dein Ergebnis bleibt privat – keine Ranglisten, kein Vergleich.',
  },
  segments: {
    run_1: 'Lauf 1',
    ski_erg: 'Ski-Ergometer',
    run_2: 'Lauf 2',
    sled_push: 'Schlitten schieben',
    run_3: 'Lauf 3',
    sled_pull: 'Schlitten ziehen',
    run_4: 'Lauf 4',
    burpee_broad_jumps: 'Burpee-Weitsprünge',
    run_5: 'Lauf 5',
    rowing: 'Rudern',
    run_6: 'Lauf 6',
    farmers_carry: "Farmer's Carry",
    run_7: 'Lauf 7',
    sandbag_lunges: 'Sandsack-Ausfallschritte',
    run_8: 'Lauf 8',
    wall_balls: 'Wall Balls',
    roxzone: 'Wechselzone (Roxzone)',
  } satisfies Record<HyroxSplitSegment, string>,
} as const;
