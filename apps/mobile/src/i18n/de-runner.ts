import type { CadenceHint, LoadLevel, RaceTargetId } from '@fitnessapp/core';

/**
 * Texte Lauf-Paket 2 (docs/PLAN-LAUF-PAKET-2.md): Pulszonen, Belastungs-Ampel, Zeitprognose, GAP, Kadenz, Dunkelheit.
 * Sanft und ohne medizinische Aussage; Ampel immer mit Wort UND Zeichen (nie nur Farbe). Eingebunden in `de.ts` unter
 * `runner`.
 */

const LEVELS: Record<LoadLevel, { symbol: string; label: string }> = {
  green: { symbol: '●', label: 'Passt' },
  yellow: { symbol: '▲', label: 'Etwas viel' },
  red: { symbol: '■', label: 'Deutlich mehr als gewohnt' },
};

const TARGETS: Record<RaceTargetId, string> = {
  '5k': '5 km',
  '10k': '10 km',
  half: 'Halbmarathon',
  marathon: 'Marathon',
};

const CADENCE_HINTS: Record<CadenceHint, string> = {
  low: 'Eher niedrig. Wenn du magst: etwas kürzere, schnellere Schritte (ca. 5 % mehr) können Knie und Hüfte entlasten. Kein Muss.',
  typical: 'Im üblichen Bereich vieler Freizeitläufer (ca. 150–185).',
  high: 'Eher hoch – das passt oft bei schnellem Tempo oder kurzen Schritten.',
};

export const deRunner = {
  zones: {
    title: 'Pulszonen',
    table: 'Zeit je Pulszone',
    zone: (n: number) => `Zone ${n}`,
    names: ['sehr leicht', 'leicht', 'mittel', 'hart', 'maximal'],
    range: (from: number, to: number, last: boolean) =>
      last ? `ab ${from}/min` : `${from}–${to - 1}/min`,
    minutes: (min: number) => `${min} min`,
    rowA11y: (zone: number, name: string, range: string, min: number) =>
      `Zone ${zone} (${name}), ${range}: ${min} Minuten`,
    noteReserve: (rest: number, max: number, own: boolean) =>
      `Zonen nach Herzfrequenz-Reserve (Ruhepuls ${rest}/min, Maximalpuls ${max}/min${own ? ', eigener Wert' : ', geschätzt aus dem Alter'}).`,
    noteMax: (max: number, own: boolean) =>
      `Zonen in % vom Maximalpuls (${max}/min${own ? ', eigener Wert' : ', geschätzt aus dem Alter'}).`,
    caution:
      'Pulszonen sind Schätzwerte. Medikamente wie Betablocker verändern den Puls. Nur für dich sichtbar, nie auf dem Bild zum Teilen.',
    adjust: 'Pulszonen anpassen',
    // Einstellungen (Smartwatch-Seite)
    settingsTitle: 'Pulszonen',
    settingsIntro:
      'Die Zeit je Pulszone rechnet die App beim Abgleich der Uhr. Mit Ruhepuls nutzt sie die Herzfrequenz-Reserve (Karvonen) – das passt meist besser zu deinem Puls als nur das Alter.',
    ownMax: 'Eigener Maximalpuls (optional)',
    ownMaxHint:
      'Zum Beispiel aus einem Leistungstest. Leer lassen = geschätzt aus dem Alter (208 − 0,7 × Alter).',
    ownMaxInvalid: (min: number, max: number) =>
      `Bitte eine ganze Zahl zwischen ${min} und ${max} eingeben – oder das Feld leer lassen.`,
    useResting: 'Ruhepuls einbeziehen (Herzfrequenz-Reserve)',
    restingKnown: (bpm: number) => `Dein Ruhepuls: ${bpm}/min (Uhr bzw. Körperdaten).`,
    restingUnknown:
      'Noch kein Ruhepuls bekannt – trag ihn in deinen Körperdaten ein oder gib „Ruhepuls“ in Health Connect frei.',
    preview: 'So sehen deine Zonen aus:',
    save: 'Pulszonen speichern',
    saved: 'Gespeichert. Gilt ab dem nächsten Abgleich der Uhr.',
    needsConsent:
      'Pulszonen brauchen deine Einwilligung für Gesundheitsdaten (Einstellungen → Einwilligungen).',
  },
  load: {
    title: 'Belastung',
    levels: LEVELS,
    text: {
      green: 'Deine Belastung der letzten 7 Tage passt zu dem, was du gewohnt bist.',
      low: 'Weniger als gewohnt – passt gut für eine Erholungswoche.',
      yellow:
        'Etwas mehr als gewohnt. Achte auf Schlaf und leichte Tage und steigere lieber in kleinen Schritten.',
      red: 'Deutlich mehr als gewohnt. Gönn dir ein paar leichtere Tage – dein Körper braucht Zeit, sich anzupassen.',
    },
    volume: (pct: number, current: string, previous: string) =>
      `Deine Lauf-Kilometer sind um ${pct} % gestiegen (${current} statt ${previous} km). Faustregel: höchstens etwa 10 % mehr pro Woche.`,
    ratio: (ratio: string) =>
      `Letzte 7 Tage im Vergleich zum Mittel der letzten 4 Wochen: ${ratio}`,
    a11y: (label: string, text: string) => `Belastung: ${label}. ${text}`,
    insufficient: {
      too_little_history:
        'Die Ampel erscheint, sobald dein Tagebuch drei Wochen umfasst – dann weiß die App, was du gewohnt bist.',
      too_little_load: 'Für die Ampel ist in den letzten vier Wochen noch zu wenig eingetragen.',
    },
    disclaimer:
      'Grobe Orientierung aus Dauer × Anstrengung deiner Einheiten – keine medizinische Aussage. Hör auf deinen Körper.',
  },
  race: {
    title: 'Zeitprognose',
    targets: TARGETS,
    value: (time: string) => `ca. ${time}`,
    range: (low: string, high: string) => `${low} – ${high}`,
    a11y: (target: string, time: string, low: string, high: string) =>
      `${target}: etwa ${time}, Bereich ${low} bis ${high}`,
    tooShort: (km: string) => `Dafür fehlt ein Lauf ab ${km} km.`,
    basedOn: (n: number) =>
      `Aus deinen ${n} Läufen ab 3 km der letzten 8 Wochen (Riegel-Formel). Gilt für flache Strecken und einen guten Tag – Training, Wetter und Strecke verändern die Zeit.`,
    insufficient: (n: number) =>
      n === 0
        ? 'Für eine Prognose braucht die App mindestens zwei Läufe ab 3 km in den letzten 8 Wochen.'
        : 'Noch ein Lauf ab 3 km in den letzten 8 Wochen, dann zeigt die App hier eine Prognose.',
  },
  gap: {
    label: 'Ø Tempo bergbereinigt',
    explain:
      'Bergbereinigt (GAP): So schnell wärst du mit gleicher Anstrengung auf flacher Strecke gewesen – berechnet aus dem Höhenprofil (ungefähr, GPS-Höhen sind ungenau).',
  },
  cadence: {
    label: 'Ø Kadenz',
    value: (spm: number) => `${spm} Schritte/min`,
    hints: CADENCE_HINTS,
    source: 'Aus den Schritten deiner Uhr während der Einheit (inkl. Pausen).',
  },
  dark: {
    title: 'Es wird dunkel',
    titleDark: 'Es ist dunkel',
    sunsetSoon: (time: string, min: number) =>
      `Sonnenuntergang heute um ${time} – in etwa ${min} min.`,
    dusk: (time: string) => `Die Sonne ist schon untergegangen, um ${time} ist es dunkel.`,
    dawn: (time: string) => `Sonnenaufgang um ${time} – bis dahin ist es noch dämmrig.`,
    dark: (sunrise: string | null) =>
      sunrise ? `Draußen ist es dunkel (Sonnenaufgang ${sunrise}).` : 'Draußen ist es dunkel.',
    tips: 'Helle oder reflektierende Kleidung und eine Stirn- oder Clip-Lampe helfen, gesehen zu werden.',
    basis: 'Berechnet auf deinem Handy aus Datum und grober Position (ohne Internet).',
    basisLast:
      'Berechnet auf deinem Handy aus Datum und dem Startort deines letzten Laufs (grob, ohne Internet).',
  },
} as const;
