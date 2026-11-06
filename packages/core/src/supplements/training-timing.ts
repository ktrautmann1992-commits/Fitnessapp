import { z } from 'zod';

import { CAFFEINE_LIMITS, SUPPLEMENT_RULES, SUPPLEMENT_TIMING_RULES } from '../constants';
import { clockLabel } from '../plan/session-time';
import { RATED_SUPPLEMENT_IDS, type RatedSupplementId } from '../supplement-ids';
import { caffeineSingleLimit, formatSupplementDose, supplementDose } from './dosage';
import type { RatedSupplementResult, SupplementRecommendations } from './eligibility';
import {
  defaultPlaceholderValues,
  fillSupplementPlaceholders,
  formatGermanNumber,
  formatClockTime,
  noticeLimitText,
} from './notices';
import { supplementScheduleAllowed } from './schedule';
import { type UserSupplementChoice, userSupplementStatus } from './user-data';

/**
 * Zeitpunkte der Supplemente rund um die Einheit (Gründer-Entscheidung 06.11.2026, docs/PLAN-SUPPLEMENTE-TRAINING.md).
 * Reine Regeln auf dem Gerät, gratis, keine KI. Grundlage ist die aktuelle Einordnung (`recommendSupplements`):
 * Es erscheinen nur Supplemente mit „passt zu dir“, die die Person nicht mit „Nicht für mich“ abgewählt hat, und
 * gewählte („Nehme ich“), die der Zeitplan erlaubt (z. B. Vitamin D als Info). Zink und Magnesium sind nie „passt“
 * und erscheinen deshalb nie. Koffein nur als neutrale Sicherheits-Info mit Grenzen (B2.3), ohne Zweck, nur an
 * Trainingstagen und nur, wenn die Koffein-Info `safety_info` (persönlich/allgemein) ist.
 *
 * Die Uhrzeit der Einheit kommt als Minuten nach Mitternacht (geplante `start_time` bzw. echter Beginn einer
 * erledigten Einheit – die App wählt, `sessionStartMinutes`). Ohne Uhrzeit gibt es Sätze ohne Uhrzeit.
 */

export const TRAINING_TIMING_SLOTS = [
  'before',
  'during',
  'after',
  'with_meals',
  'any_time',
  'no_caffeine',
] as const;
export type TrainingTimingSlot = (typeof TRAINING_TIMING_SLOTS)[number];

const minutesOfDay = z
  .number()
  .int()
  .min(0)
  .max(24 * 60 - 1);

export const trainingTimingSessionSchema = z.strictObject({
  /** Beginn in Minuten nach Mitternacht, `null` = keine Uhrzeit bekannt. */
  startMinutes: minutesOfDay.nullable(),
  /** Dauer in Minuten, `null` = unbekannt. */
  durationMinutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .nullable(),
});
export type TrainingTimingSession = z.infer<typeof trainingTimingSessionSchema>;

export interface TrainingTimingLine {
  readonly id: RatedSupplementId | 'caffeine';
  readonly slot: TrainingTimingSlot;
  /** Zeitfenster in Minuten nach Mitternacht (nur mit bekannter Uhrzeit), sonst `null`. */
  readonly fromMinutes: number | null;
  readonly toMinutes: number | null;
  readonly textDe: string;
}

export interface TrainingDayTiming {
  /** Mindestens eine Einheit heute. */
  readonly trainingDay: boolean;
  /** Uhrzeit der Einheit bekannt. */
  readonly startKnown: boolean;
  /** Sortiert nach Abschnitt (vorher, während, danach, Mahlzeiten, egal), dann RATED_SUPPLEMENT_IDS. */
  readonly lines: readonly TrainingTimingLine[];
}

/** Feste Texte mit Platzhaltern (`{from}`/`{to}` = Uhrzeiten, Zahlen nie im Text – Plan 3.8 Nr. 3). */
export const TRAINING_TIMING_TEXTS_DE = {
  creatine_training: 'Täglich, die Uhrzeit ist egal – zum Beispiel zur Mahlzeit nach dem Training.',
  creatine_rest: 'Täglich, auch am Ruhetag. Die Uhrzeit ist egal.',
  protein_after_time:
    'Nach dem Training, etwa {from} bis {to}. Oder zu einer Mahlzeit, wenn dir sonst Eiweiß fehlt.',
  protein_after: 'Nach dem Training. Oder zu einer Mahlzeit, wenn dir sonst Eiweiß fehlt.',
  eaa_around_time: 'Kurz vor dem Training (ab etwa {from}) oder direkt danach.',
  eaa_around: 'Kurz vor oder direkt nach dem Training.',
  beta_alanine: 'Über den Tag verteilt zu den Mahlzeiten, höchstens {limit} auf einmal.',
  electrolytes_time:
    'Während der langen Einheit ({from} bis {to}) etwa {dose} Natrium je Stunde, danach mit dem Essen.',
  electrolytes: 'Während der langen Einheit etwa {dose} Natrium je Stunde, danach mit dem Essen.',
  vitamin_d: 'Täglich zu einer Mahlzeit mit etwas Fett.',
  omega3: 'Täglich zu einer Mahlzeit.',
  caffeine_window: 'Falls du Koffein nutzt: etwa {from} bis {to}, höchstens {dose} auf einmal.',
  caffeine_window_cups:
    'Falls du Koffein nutzt: etwa {from} bis {to}, höchstens {cups} Tassen Kaffee auf einmal.',
  caffeine_unknown:
    'Falls du Koffein nutzt: etwa {before} vor dem Start und nur, wenn die Einheit vor {time} liegt.',
  caffeine_late: 'Deine Einheit beginnt nach {time}: Nimm vorher kein Koffein.',
} as const;
export type TrainingTimingTextKey = keyof typeof TRAINING_TIMING_TEXTS_DE;

/** Platzhalter der Zeitpunkt-Texte (zusätzlich zu denen aus `notices.ts`). */
export const TRAINING_TIMING_PLACEHOLDERS = [
  'from',
  'to',
  'before',
  'dose',
  'limit',
  'cups',
  'time',
] as const;

const SLOT_ORDER: Readonly<Record<TrainingTimingSlot, number>> = {
  no_caffeine: 0,
  before: 1,
  during: 2,
  after: 3,
  with_meals: 4,
  any_time: 5,
};

function render(key: TrainingTimingTextKey, values: Record<string, string> = {}): string {
  const defaults = defaultPlaceholderValues();
  return fillSupplementPlaceholders(TRAINING_TIMING_TEXTS_DE[key], {
    cups: defaults.cups,
    time: defaults.time,
    ...values,
  });
}

const clamp = (minutes: number) => Math.min(Math.max(Math.round(minutes), 0), 24 * 60 - 1);
const clock = (minutes: number) => `${clockLabel(minutes)} Uhr`;

/**
 * Welche eingeordneten Supplemente erscheinen? „passt zu dir“ ohne „Nicht für mich“ sowie „Nehme ich“, soweit der
 * Zeitplan es erlaubt. Ohne persönliche Einordnung gibt es keine Auswahl (und kein „passt“).
 */
export function trainingTimingItems(
  recommendations: SupplementRecommendations,
  choices: readonly UserSupplementChoice[],
): RatedSupplementResult[] {
  return recommendations.items.filter((item) => {
    const choice = recommendations.personalized ? userSupplementStatus(choices, item.id) : null;
    if (choice === 'not_for_me') return false;
    if (item.status === 'recommended') return true;
    return choice === 'taking' && supplementScheduleAllowed(item);
  });
}

function lineFor(
  item: RatedSupplementResult,
  session: TrainingTimingSession | null,
): TrainingTimingLine | null {
  const start = session?.startMinutes ?? null;
  const duration = session?.durationMinutes ?? null;
  // Ende auf 5 Minuten gerundet (gut lesbare Uhrzeiten, z. B. 7:53 → 7:55).
  const end =
    start === null
      ? null
      : Math.round((start + (duration ?? SUPPLEMENT_TIMING_RULES.defaultSessionMinutes)) / 5) * 5;
  const base = { id: item.id, fromMinutes: null, toMinutes: null };
  switch (item.id) {
    case 'creatine':
      return {
        ...base,
        slot: 'any_time',
        textDe: render(session ? 'creatine_training' : 'creatine_rest'),
      };
    case 'protein_powder': {
      // An Ruhetagen deckt das Essen den Bedarf (Plan 3.5/3.7).
      if (!session) return null;
      if (end === null) return { ...base, slot: 'after', textDe: render('protein_after') };
      const { min, max } = SUPPLEMENT_TIMING_RULES.afterTrainingMinutes;
      const from = clamp(end + min);
      const to = clamp(end + max);
      return {
        ...base,
        slot: 'after',
        fromMinutes: from,
        toMinutes: to,
        textDe: render('protein_after_time', { from: clock(from), to: clock(to) }),
      };
    }
    case 'eaa': {
      if (!session) return null;
      if (start === null) return { ...base, slot: 'before', textDe: render('eaa_around') };
      const from = clamp(start - SUPPLEMENT_TIMING_RULES.eaaBeforeMinutes);
      return {
        ...base,
        slot: 'before',
        fromMinutes: from,
        toMinutes: start,
        textDe: render('eaa_around_time', { from: clock(from) }),
      };
    }
    case 'beta_alanine':
      return {
        ...base,
        slot: 'with_meals',
        textDe: render('beta_alanine', { limit: noticeLimitText('beta_alanine_split') ?? '' }),
      };
    case 'electrolytes': {
      // Nur an Tagen mit einer Einheit ab `minSessionMinutes` (unbekannte Dauer: sichere Richtung, keine Zeile).
      if (!session || duration === null) return null;
      if (duration < SUPPLEMENT_RULES.electrolytes.minSessionMinutes) return null;
      const dose = supplementDose(item);
      if (dose === null) return null;
      const doseText = formatSupplementDose(dose);
      if (start === null || end === null) {
        return { ...base, slot: 'during', textDe: render('electrolytes', { dose: doseText }) };
      }
      return {
        ...base,
        slot: 'during',
        fromMinutes: start,
        toMinutes: clamp(end),
        textDe: render('electrolytes_time', {
          from: clock(start),
          to: clock(end),
          dose: doseText,
        }),
      };
    }
    case 'vitamin_d':
      return { ...base, slot: 'with_meals', textDe: render('vitamin_d') };
    case 'omega3':
      return { ...base, slot: 'with_meals', textDe: render('omega3') };
    case 'zinc':
    case 'magnesium':
      // Nie „passt“ (nur Info) – hier nur der Vollständigkeit halber.
      return null;
  }
}

function caffeineLine(
  recommendations: SupplementRecommendations,
  session: TrainingTimingSession,
  weightKg: number | null,
): TrainingTimingLine | null {
  const info = recommendations.caffeine;
  // Nur die neutrale Sicherheits-Info (persönlich/allgemein). Schwangerschaft, „ab 18“ und „ärztlich abklären“ → keine
  // Zeile (die Koffein-Seite zeigt den passenden Hinweis).
  if (info.status !== 'safety_info' || (info.mode !== 'personal' && info.mode !== 'general')) {
    return null;
  }
  const cutoff = CAFFEINE_LIMITS.latestTrainingStartMinutes;
  const start = session.startMinutes;
  const base = { id: 'caffeine' as const, fromMinutes: null, toMinutes: null };
  if (start === null) {
    const { min, max } = SUPPLEMENT_TIMING_RULES.caffeineBeforeMinutes;
    return {
      ...base,
      slot: 'before',
      textDe: render('caffeine_unknown', {
        before: `${formatGermanNumber(min)}–${formatGermanNumber(max)} Minuten`,
        time: formatClockTime(cutoff),
      }),
    };
  }
  if (start > cutoff) {
    return {
      ...base,
      slot: 'no_caffeine',
      textDe: render('caffeine_late', { time: formatClockTime(cutoff) }),
    };
  }
  const { min, max } = SUPPLEMENT_TIMING_RULES.caffeineBeforeMinutes;
  const from = clamp(start - max);
  const to = clamp(start - min);
  const window = { from: clock(from), to: clock(to) };
  const limit = info.mode === 'personal' ? caffeineSingleLimit(weightKg) : null;
  return {
    ...base,
    slot: 'before',
    fromMinutes: from,
    toMinutes: to,
    textDe:
      limit !== null && limit.kind === 'mg'
        ? render('caffeine_window', { ...window, dose: `${formatGermanNumber(limit.mg)} mg` })
        : render('caffeine_window_cups', window),
  };
}

/**
 * Zeitpunkte für heute. `session = null` = Ruhetag (nur tägliche Supplemente, kein Koffein). Gewicht nur mit
 * Einwilligung (für die persönliche Koffein-Grenze; ohne Gewicht der Tassen-Satz).
 */
export function supplementTrainingDayTiming(
  recommendations: SupplementRecommendations,
  choices: readonly UserSupplementChoice[],
  rawSession: TrainingTimingSession | null,
  weightKg: number | null = null,
): TrainingDayTiming {
  const session = rawSession === null ? null : trainingTimingSessionSchema.parse(rawSession);
  const lines = trainingTimingItems(recommendations, choices)
    .map((item) => lineFor(item, session))
    .filter((line): line is TrainingTimingLine => line !== null);
  if (session) {
    const caffeine = caffeineLine(recommendations, session, weightKg);
    if (caffeine) lines.push(caffeine);
  }
  const order = (id: TrainingTimingLine['id']) =>
    id === 'caffeine' ? -1 : RATED_SUPPLEMENT_IDS.indexOf(id);
  lines.sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot] || order(a.id) - order(b.id));
  return {
    trainingDay: session !== null,
    startKnown: session !== null && session.startMinutes !== null,
    lines,
  };
}

/**
 * Beginn der Einheit für die Zeitpunkte: der echte Beginn einer erledigten Einheit (Minuten, Ortszeit) hat Vorrang
 * vor der geplanten Uhrzeit; sonst `null`. Eigene kleine Regel (unabhängig von anderen Hilfen).
 */
export function timingStartMinutes(
  plannedMinutes: number | null,
  actualMinutes: number | null,
): number | null {
  if (actualMinutes !== null) return minutesOfDay.parse(Math.round(actualMinutes));
  if (plannedMinutes !== null) return minutesOfDay.parse(plannedMinutes);
  return null;
}
