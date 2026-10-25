import { z } from 'zod';

import { isoDateSchema } from '../age';
import { PAIN_MODE, PAIN_REGION_LOAD, type PainRegionMatcher } from '../constants';
import type { Exercise } from '../content/schemas';
import { addDays, daysBetween } from '../dates';
import {
  BODY_REGIONS,
  type BodyRegion,
  type CautionTag,
  PAIN_INTENSITIES,
  type PainIntensity,
} from '../enums';

/**
 * Schmerz-/Verletzungsmodus (docs/PLAN-TRAINING-MODI.md 3, Gründer-Freigabe 25.10.2026). Rein und deterministisch,
 * ohne KI. Die Person tippt eine Körperregion, die Stärke (leicht/mittel/stark) und die Dauer (3/7/14 Tage); die
 * Anzeige des Plans tauscht Übungen, die diese Region belasten, gegen schonendere und senkt die Belastung.
 *
 * KEIN Diagnose- und KEIN Therapie-Werkzeug: Es gibt nur Orte und eine Selbsteinschätzung, keine Ursachen, keine
 * Behandlung. Bei „stark“, mehr als 14 Tagen am Stück oder wiederkehrenden Beschwerden: Hinweis „Bitte ärztlich
 * abklären lassen“ und konservativer Plan.
 *
 * Datenschutz: Einträge sind Gesundheitsdaten (Art. 9 DSGVO) – nur mit gültiger Einwilligung `health_data`, RLS,
 * Widerruf löscht, Export enthält sie. Nie in Logs, Analytics, Partner-Modus, Teilen-Bildern oder dem PDF.
 */

const timestamp = z.iso.datetime({ offset: true });
const durationSchema = z.union([z.literal(3), z.literal(7), z.literal(14)]);

/** Ein gespeicherter Eintrag (Tabelle `pain_episodes`, ohne user_id). Strikt – beim Lesen und Schreiben geprüft. */
export const painEpisodeSchema = z
  .strictObject({
    id: z.uuid(),
    region: z.enum(BODY_REGIONS),
    intensity: z.enum(PAIN_INTENSITIES),
    duration_days: durationSchema,
    started_on: isoDateSchema,
    /** Vorzeitig beendet an diesem Tag (ab diesem Tag wieder normaler Plan); null = läuft bis zum Ende der Dauer. */
    ended_early_on: isoDateSchema.nullable(),
    created_at: timestamp,
  })
  .refine((e) => e.ended_early_on === null || e.ended_early_on >= e.started_on, {
    path: ['ended_early_on'],
    message: 'Das Ende darf nicht vor dem Beginn liegen.',
  });
export type PainEpisode = z.output<typeof painEpisodeSchema>;

/**
 * Eingabe der App (Körperkarte): Region, Stärke, Dauer. Beginn ist immer heute (Zeitzone der App); der Server
 * duldet ±1 Tag (Zeitzonen).
 */
export function painEpisodeInputSchema(today: string) {
  return z.strictObject({
    region: z.enum(BODY_REGIONS),
    intensity: z.enum(PAIN_INTENSITIES),
    duration_days: durationSchema,
    started_on: isoDateSchema.refine((d) => d === today, 'Beginn ist immer heute.'),
  });
}
export type PainEpisodeInput = z.output<ReturnType<typeof painEpisodeInputSchema>>;

/** Gespeicherte Einträge lesen: ungültige fallen weg (kaputter Speicher), nach Beginn sortiert. */
export function parsePainEpisodes(rows: readonly unknown[]): PainEpisode[] {
  return rows
    .flatMap((row) => {
      const parsed = painEpisodeSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    })
    .sort((a, b) =>
      a.started_on === b.started_on
        ? a.created_at.localeCompare(b.created_at)
        : a.started_on.localeCompare(b.started_on),
    );
}

const INTENSITY_ORDER: readonly PainIntensity[] = PAIN_INTENSITIES;
const stronger = (a: PainIntensity, b: PainIntensity): PainIntensity =>
  INTENSITY_ORDER.indexOf(a) >= INTENSITY_ORDER.indexOf(b) ? a : b;

/** Letzter geplanter Tag (ohne vorzeitiges Ende): Beginn + Dauer − 1. */
export function plannedLastDay(episode: Pick<PainEpisode, 'started_on' | 'duration_days'>): string {
  return addDays(episode.started_on, episode.duration_days - 1);
}

/** Letzter wirksamer Tag (vorzeitiges Ende berücksichtigt); null = wirkt an keinem Tag (am Starttag beendet). */
export function lastActiveDay(
  episode: Pick<PainEpisode, 'started_on' | 'duration_days' | 'ended_early_on'>,
): string | null {
  const planned = plannedLastDay(episode);
  if (episode.ended_early_on === null) return planned;
  const early = addDays(episode.ended_early_on, -1);
  if (early < episode.started_on) return null;
  return early < planned ? early : planned;
}

/** Wirkt der Eintrag an diesem Tag? (Beginn ≤ Tag ≤ letzter wirksamer Tag – endet automatisch.) */
export function isPainEpisodeActive(
  episode: Pick<PainEpisode, 'started_on' | 'duration_days' | 'ended_early_on'>,
  date: string,
): boolean {
  const last = lastActiveDay(episode);
  return last !== null && episode.started_on <= date && date <= last;
}

/** Am Tag wirksame Einträge. */
export function activePainEpisodes<T extends PainEpisode>(
  episodes: readonly T[],
  date: string,
): T[] {
  return episodes.filter((e) => isPainEpisodeActive(e, date));
}

// ---------------------------------------------------------------------------------------------------------
// Ärztliche Abklärung: stark, länger als 14 Tage am Stück, wiederkehrend
// ---------------------------------------------------------------------------------------------------------

export const PAIN_ADVICE_REASONS = ['severe', 'long', 'recurring'] as const;
export type PainAdviceReason = (typeof PAIN_ADVICE_REASONS)[number];

/** Eine zusammenhängende Phase derselben Region (Folge-Einträge mit höchstens `chainGapDays` Lücke). */
export interface PainChain {
  readonly region: BodyRegion;
  readonly startedOn: string;
  /** Letzter geplanter bzw. wirksamer Tag der Phase. */
  readonly lastDay: string;
  readonly episodes: number;
}

/** Phasen je Region (nur Einträge mit mindestens einem wirksamen Tag), nach Beginn sortiert. */
export function painChains(episodes: readonly PainEpisode[], region: BodyRegion): PainChain[] {
  const own = episodes
    .filter((e) => e.region === region && lastActiveDay(e) !== null)
    .sort((a, b) => a.started_on.localeCompare(b.started_on));
  const chains: { startedOn: string; lastDay: string; episodes: number }[] = [];
  for (const e of own) {
    const last = lastActiveDay(e) as string;
    const current = chains.at(-1);
    if (current && daysBetween(current.lastDay, e.started_on) <= PAIN_MODE.chainGapDays + 1) {
      current.lastDay = last > current.lastDay ? last : current.lastDay;
      current.episodes += 1;
    } else {
      chains.push({ startedOn: e.started_on, lastDay: last, episodes: 1 });
    }
  }
  return chains.map((c) => ({ region, ...c }));
}

/**
 * Gründe für „Bitte ärztlich abklären lassen“ für die am Tag `date` wirksamen Regionen (leer = kein Hinweis):
 * - `severe`: ein wirksamer Eintrag ist „stark“,
 * - `long`: die laufende Phase einer Region dauert (geplant) länger als PAIN_MODE.maxChainDays,
 * - `recurring`: mindestens PAIN_MODE.recurring.episodes Phasen derselben Region begannen in den letzten
 *   PAIN_MODE.recurring.windowDays Tagen (die laufende eingeschlossen).
 */
export function painAdviceReasons(
  episodes: readonly PainEpisode[],
  date: string,
): PainAdviceReason[] {
  const active = activePainEpisodes(episodes, date);
  const reasons = new Set<PainAdviceReason>();
  if (active.some((e) => e.intensity === 'severe')) reasons.add('severe');
  const regions = new Set(active.map((e) => e.region));
  const windowStart = addDays(date, -(PAIN_MODE.recurring.windowDays - 1));
  for (const region of regions) {
    const chains = painChains(episodes, region);
    const current = chains.find((c) => c.startedOn <= date && date <= c.lastDay);
    if (current && daysBetween(current.startedOn, current.lastDay) + 1 > PAIN_MODE.maxChainDays) {
      reasons.add('long');
    }
    const recent = chains.filter((c) => c.startedOn >= windowStart && c.startedOn <= date);
    if (recent.length >= PAIN_MODE.recurring.episodes) reasons.add('recurring');
  }
  return PAIN_ADVICE_REASONS.filter((r) => reasons.has(r));
}

// ---------------------------------------------------------------------------------------------------------
// Wirkung an einem Tag
// ---------------------------------------------------------------------------------------------------------

/** Was der Modus an einem Tag bewirkt (null = an diesem Tag kein Eintrag wirksam). JSON-serialisierbar. */
export interface PainEffect {
  /** Je Region die stärkste wirksame Stärke (sortiert wie BODY_REGIONS). */
  readonly regions: readonly { readonly region: BodyRegion; readonly intensity: PainIntensity }[];
  /** Stärkste Stärke über alle Regionen – bestimmt die Dosierung. */
  readonly level: PainIntensity;
  /** Arzt-Hinweis-Gründe; nicht leer → konservativer Plan. */
  readonly advice: readonly PainAdviceReason[];
  readonly conservative: boolean;
  /** Letzter wirksamer Tag (größter über alle Einträge) – für „bis …“. */
  readonly until: string;
}

export function painEffectOn(episodes: readonly PainEpisode[], date: string): PainEffect | null {
  const active = activePainEpisodes(episodes, date);
  if (active.length === 0) return null;
  const byRegion = new Map<BodyRegion, PainIntensity>();
  for (const e of active) {
    const own = byRegion.get(e.region);
    byRegion.set(e.region, own ? stronger(own, e.intensity) : e.intensity);
  }
  const advice = painAdviceReasons(episodes, date);
  const conservative = advice.length > 0;
  const regions = BODY_REGIONS.flatMap((region) => {
    const intensity = byRegion.get(region);
    if (!intensity) return [];
    // Konservativ: jede Region wie „stark“ (alle belastenden Übungen weg).
    return [{ region, intensity: conservative ? ('severe' as const) : intensity }];
  });
  const level = regions.reduce<PainIntensity>((acc, r) => stronger(acc, r.intensity), 'mild');
  const until = active
    .map((e) => lastActiveDay(e) as string)
    .sort()
    .at(-1) as string;
  return { regions, level, advice, conservative, until };
}

// ---------------------------------------------------------------------------------------------------------
// Welche Übung belastet welche Region?
// ---------------------------------------------------------------------------------------------------------

type RegionExercise = Pick<
  Exercise,
  'id' | 'movement_pattern' | 'primary_muscles' | 'caution_tags' | 'load_type'
>;

function matches(exercise: RegionExercise, matcher: PainRegionMatcher): boolean {
  if ('exercise' in matcher) return exercise.id === matcher.exercise;
  if ('tag' in matcher) return exercise.caution_tags.includes(matcher.tag);
  if ('muscle' in matcher) return exercise.primary_muscles.includes(matcher.muscle);
  return (
    exercise.movement_pattern === matcher.pattern &&
    (matcher.loadTypes === undefined || matcher.loadTypes.includes(exercise.load_type))
  );
}

/**
 * Belastet die Übung die Region bei dieser Stärke (PAIN_REGION_LOAD: „leicht“ nur `strong`, ab „mittel“ zusätzlich
 * `any`)? Unbekannte Übung (`undefined`) → true (vorsichtig).
 */
export function loadsRegion(
  exercise: RegionExercise | undefined,
  region: BodyRegion,
  intensity: PainIntensity,
): boolean {
  if (!exercise) return true;
  const rules = PAIN_REGION_LOAD[region];
  const list: readonly PainRegionMatcher[] =
    intensity === 'mild' ? rules.strong : [...rules.strong, ...rules.any];
  return list.some((m) => matches(exercise, m));
}

/** Ist die Übung an diesem Tag gesperrt (belastet eine wirksame Region bzw. konservative Ausschlüsse)? */
export function isBlockedByPain(exercise: RegionExercise | undefined, effect: PainEffect): boolean {
  if (!exercise) return true;
  if (effect.conservative) {
    const tags: readonly CautionTag[] = PAIN_MODE.conservative.excludedCautionTags;
    if (exercise.caution_tags.some((t) => tags.includes(t))) return true;
  }
  return effect.regions.some((r) => loadsRegion(exercise, r.region, r.intensity));
}

/** Regionen, die die Übung bei „mittel“ belastet (für Tests und die Erklärung in der Doku). */
export function regionsLoadedBy(exercise: RegionExercise): BodyRegion[] {
  return BODY_REGIONS.filter((region) => loadsRegion(exercise, region, 'moderate'));
}

/** Gehört eine Region zum Unterkörper (Ausdauer schonen, PAIN_MODE.endurance)? */
export function isLowerBodyRegion(region: BodyRegion): boolean {
  const lower: readonly BodyRegion[] = PAIN_MODE.endurance.lowerBodyRegions;
  return lower.includes(region);
}

// ---------------------------------------------------------------------------------------------------------
// Verwaltung (App + Testmodus): anlegen, vorzeitig beenden, aufräumen
// ---------------------------------------------------------------------------------------------------------

/** Neuen Eintrag aus der geprüften Eingabe bauen (ID und Zeitstempel kommen vom Aufrufer). */
export function newPainEpisode(
  input: PainEpisodeInput,
  meta: { readonly id: string; readonly createdAt: string },
): PainEpisode {
  return painEpisodeSchema.parse({
    id: meta.id,
    region: input.region,
    intensity: input.intensity,
    duration_days: input.duration_days,
    started_on: input.started_on,
    ended_early_on: null,
    created_at: meta.createdAt,
  });
}

/**
 * Vorzeitig beenden (ab heute normaler Plan). Schon beendete oder abgelaufene Einträge bleiben unverändert;
 * gleiche Region, gleicher Tag: die neue Angabe ersetzt die alte (siehe replaceSameDay in der App).
 */
export function endPainEpisode(episode: PainEpisode, today: string): PainEpisode {
  if (!isPainEpisodeActive(episode, today)) return episode;
  return { ...episode, ended_early_on: today };
}

/**
 * Einträge einer Region, die heute noch laufen, werden beim neuen Eintrag derselben Region beendet (eine Region hat
 * höchstens einen laufenden Eintrag – die neue Angabe gilt). Ältere als PAIN_MODE.historyDays fallen weg.
 */
export function withNewPainEpisode(
  episodes: readonly PainEpisode[],
  next: PainEpisode,
  today: string,
): PainEpisode[] {
  const cutoff = addDays(today, -PAIN_MODE.historyDays);
  return [
    ...episodes
      .filter((e) => (lastActiveDay(e) ?? e.started_on) >= cutoff)
      .map((e) => (e.region === next.region ? endPainEpisode(e, today) : e)),
    next,
  ];
}

/** Vorschau: Würde dieser neue Eintrag einen Arzt-Hinweis auslösen (vor dem Speichern anzeigen)? */
export function adviceForNewEpisode(
  episodes: readonly PainEpisode[],
  input: PainEpisodeInput,
  today: string,
): PainAdviceReason[] {
  const candidate = newPainEpisode(input, {
    id: '00000000-0000-4000-8000-000000000000',
    createdAt: `${today}T00:00:00Z`,
  });
  return painAdviceReasons(withNewPainEpisode(episodes, candidate, today), today);
}
