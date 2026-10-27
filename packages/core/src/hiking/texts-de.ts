import { HIKING_SAFETY } from '../constants';
import type { HikingSafetyNoticeId } from './safety';

/**
 * Textbausteine der Bergwander-Hinweise (HIKING_SAFETY_DE, docs/PLAN-SPORTARTEN-STUFE-1.md 2.2/4). Nie blockierend,
 * keine Diagnose, kein Heilversprechen, kein Notruf-Ersatz. ENTWURF – vor Livegang fachlich prüfen (Bergführer:in,
 * Ärzt:in; Entscheidung 12).
 */

const thousands = (n: number) => n.toLocaleString('de-DE');

export const HIKING_SAFETY_DE = {
  title: {
    before: 'Bevor du losgehst',
    after: 'Gut zu wissen nach deiner Tour',
  },
  intro: 'Hinweise für unterwegs – du entscheidest selbst.',
  notices: {
    weather:
      'Wetter prüfen: Am Berg ändert es sich schnell. Bei Gewitter-Gefahr früh starten oder die Tour verschieben; Grate und Gipfel bei Gewitter meiden.',
    turnaround:
      'Umkehrzeit festlegen: Lege vorher fest, bis wann du spätestens umdrehst – und halte dich daran, auch kurz vor dem Ziel.',
    live_companion:
      'Live-Begleitung: Teile deinen Standort während der Tour mit einer Vertrauensperson – nur auf deinen Tipp, jederzeit beendbar.',
    emergency: 'Notruf: Wähle im Notfall die Nummer des Landes, in dem du gerade bist.',
    battery:
      'Akku: GPS braucht Strom. Starte mit vollem Akku, nimm eine Powerbank mit und schalte Unnötiges aus.',
    drink:
      'Trinken und Essen: Nimm genug Wasser und etwas zu essen mit – auf vielen Wegen gibt es unterwegs nichts.',
    altitude: `Über ${thousands(HIKING_SAFETY.altitudeHintM)} m: Steig langsam auf und achte auf Warnzeichen wie Kopfschmerzen, Übelkeit, Schwindel oder ungewöhnliche Erschöpfung. Werden sie stärker, steig ab. Bei mehrtägigen Touren gilt als Faustregel: Schlafhöhe um höchstens ${HIKING_SAFETY.sleepGainPerDayM.min}–${HIKING_SAFETY.sleepGainPerDayM.max} m pro Tag steigern.`,
    descent:
      'Abstieg: Bergab belastet Knie und Oberschenkel stärker als bergauf. Stöcke helfen, kurze Schritte und ein ruhiges Tempo auch.',
    pain_joints:
      'Schon-Modus: Du schonst gerade Knie oder Sprunggelenk. Wähle lieber eine Tour mit wenig Abstieg, nutze Stöcke und brich ab, wenn es schmerzt.',
    doctor: `Bergtouren über ${thousands(HIKING_SAFETY.altitudeHintM)} m bitte vorher ärztlich besprechen (Hinweis aus deinem Gesundheits-Check).`,
    sac_outside:
      'Alpines Gelände (T4 oder schwerer): Das liegt außerhalb dessen, was die App begleitet. Unsere Hinweise reichen dafür nicht – plane mit Erfahrung, passender Ausrüstung oder einer Bergführerin bzw. einem Bergführer.',
  } satisfies Record<HikingSafetyNoticeId, string>,
  emergencyCountries: { DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz', IT: 'Italien' },
  emergencyKinds: {
    general: 'Euronotruf',
    alpine: 'Alpinnotruf',
    rega: 'Rega (Luftrettung)',
    ambulance: 'Rettungsdienst',
  },
  emergencyNote: 'Die App ersetzt keinen Notruf.',
  /** SAC-Wanderskala kurz (Auswahl T1–T3, T4+ nur Hinweis). */
  sac: {
    label: 'Schwierigkeit (SAC-Skala, optional)',
    none: 'Keine Angabe',
    grades: {
      1: 'T1 Wandern – gut gebahnte Wege',
      2: 'T2 Bergwandern – Wege mit Steigungen, Trittsicherheit',
      3: 'T3 Anspruchsvolles Bergwandern – teils weglos, Hände zum Halten',
    },
    outside: 'T4 oder schwerer',
  },
} as const;
