import { ROUTE_PRIVACY_TRIM, STORY_CARD, TRACKED_ROUTE_LIMITS } from '../constants';
import { isoDateInTimeZone } from '../dates';
import type { EnduranceModality, WalkKind } from '../enums';
import { type HikeKind, isHikeKind } from '../hiking/walk-kind';
import { formatDuration, paceSecondsPerKm, speedKmh } from '../log/cardio';
import type { LatLng } from '../routes/polyline';
import { privacyTrim } from '../routes/privacy-trim';

/**
 * Story-Bild einer einzelnen Einheit (Etappe E6, CLAUDE.md „Teilen-Ausnahme“, docs/PLAN-EINKAUFEN-AUSDAUER.md 8):
 * FESTE POSITIVLISTE – nur die Felder unten gelangen ins Bild. Nie: Puls, Körpergewicht, Körperdaten, Zyklus,
 * Gesundheits-Check, kcal, Ziele/Wunschgewicht, Uhrzeit, Ortsnamen, Notizen, App-Link mit Kennung.
 * Ausdauer: Linie nach privacyTrim (keine Kartenkacheln, EA-4), Sportart (beim Rad ggf. „E-Bike“), Datum ohne Uhrzeit, Gesamt-/Bewegungszeit,
 * Distanz, Ø-Pace bzw. km/h, Höhenmeter mit „ca.“. Kraft: Name der Einheit, Datum, Dauer, Anzahl Übungen (bis 5
 * Namen), Sätze, Volumen NUR aus Zusatzlast (Gewichtsübungen; Körpergewicht wird nie eingerechnet – sonst wäre das
 * Gewicht ablesbar). Erzeugt wird das Bild nur auf dem Gerät (kein Upload).
 */

/** Felder, die ein Story-Bild überhaupt enthalten darf (Prüfung in story-card.test.ts). */
export const STORY_CARD_FIELDS = [
  'kind',
  'sport',
  'eBike',
  // Sportarten Stufe 1 · Wandern (27.10.2026): „Wanderung“/„Bergwanderung“ statt „Gehen“ – kein Gesundheitsdatum.
  'walkKind',
  'title',
  'date',
  'stats',
  'exerciseNames',
  'moreExercises',
  'line',
  'lineState',
] as const;

/** Werte der Zahlenzeile (feste Liste). */
export const STORY_STAT_KEYS = [
  'duration',
  'moving',
  'distance',
  'pace',
  'speed',
  'elevation',
  'exercises',
  'sets',
  'volume',
] as const;
export type StoryStatKey = (typeof STORY_STAT_KEYS)[number];

export interface StoryStat {
  readonly key: StoryStatKey;
  readonly value: string;
}

/** `shown` = Linie im Bild; `hidden` = abgeschaltet; `too_short` = nach der Privatzone zu kurz; `none` = ohne GPS. */
export type StoryLineState = 'shown' | 'hidden' | 'too_short' | 'none';

export interface EnduranceStoryCard {
  readonly kind: 'endurance';
  readonly sport: EnduranceModality;
  /** „E-Bike“ statt „Rad“ (nur beim Rad; kein Gesundheitsdatum). */
  readonly eBike: boolean;
  /** Nur beim Gehen als Wanderung/Bergwanderung gesetzt (sonst fehlt das Feld). */
  readonly walkKind?: HikeKind;
  readonly date: string | null;
  readonly stats: readonly StoryStat[];
  readonly line: readonly LatLng[] | null;
  readonly lineState: StoryLineState;
}

export interface StrengthStoryCard {
  readonly kind: 'strength';
  readonly title: string;
  readonly date: string | null;
  readonly stats: readonly StoryStat[];
  readonly exerciseNames: readonly string[];
  readonly moreExercises: number;
}

export type StoryCard = EnduranceStoryCard | StrengthStoryCard;

export interface StoryOptions {
  /** „Strecke zeigen“ (Standard an). */
  readonly showLine: boolean;
  /** „Datum zeigen“ (Standard an). */
  readonly showDate: boolean;
}

const comma = (text: string) => text.replace('.', ',');

/** Ganze Zahl mit Tausenderpunkt („12.345“) – ohne Intl (gleich auf allen Geräten). */
export function groupedNumber(value: number): string {
  const n = Math.max(0, Math.round(value));
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export interface EnduranceStoryInput {
  readonly sport: EnduranceModality;
  /** Beginn (Zeitstempel) – im Bild nur das DATUM (Europe/Berlin). */
  readonly startedAt: string | null;
  /** Tag ohne Beginn (Eintrag ohne GPS). */
  readonly day: string;
  readonly durationS: number;
  readonly movingS: number;
  readonly distanceM: number | null;
  readonly elevationM: number | null;
  /** Gespeicherte Linie (dekodierte Polyline) oder null (ohne GPS). */
  readonly points: readonly LatLng[] | null;
  /** E-Bike (nur beim Rad wirksam); fehlt = normales Rad. */
  readonly eBike?: boolean;
  /** Art der Geh-Einheit (nur beim Gehen wirksam); fehlt/null = Gehen. */
  readonly walkKind?: WalkKind | null;
}

/** Inhalt des Story-Bilds einer Ausdauer-Einheit (nur Felder der Positivliste). */
export function enduranceStoryCard(
  input: EnduranceStoryInput,
  options: StoryOptions,
): EnduranceStoryCard {
  const stats: StoryStat[] = [{ key: 'duration', value: formatDuration(input.durationS) }];
  if (input.movingS > 0 && input.durationS - input.movingS >= 60) {
    stats.push({ key: 'moving', value: formatDuration(input.movingS) });
  }
  const distance = input.distanceM !== null && input.distanceM > 0 ? input.distanceM : null;
  if (distance !== null) {
    stats.push({
      key: 'distance',
      value: `${comma((Math.floor(distance / 10) / 100).toFixed(2))} km`,
    });
    const time = input.movingS > 0 ? input.movingS : input.durationS;
    if (input.sport === 'bike') {
      const kmh = speedKmh(time, distance);
      if (kmh !== null) stats.push({ key: 'speed', value: `${comma(kmh.toFixed(1))} km/h` });
    } else {
      const pace = paceSecondsPerKm(time, distance);
      if (pace !== null) stats.push({ key: 'pace', value: `${formatDuration(pace)} min/km` });
    }
  }
  if (input.elevationM !== null && input.elevationM > 0) {
    stats.push({ key: 'elevation', value: `ca. ${groupedNumber(input.elevationM)} m` });
  }
  let line: LatLng[] | null = null;
  let lineState: StoryLineState = 'none';
  if (input.points && input.points.length >= TRACKED_ROUTE_LIMITS.minPoints) {
    if (!options.showLine) {
      lineState = 'hidden';
    } else {
      line = privacyTrim(input.points, ROUTE_PRIVACY_TRIM.trimM);
      lineState = line ? 'shown' : 'too_short';
    }
  }
  return {
    kind: 'endurance',
    sport: input.sport,
    eBike: input.sport === 'bike' && input.eBike === true,
    ...(input.sport === 'walk' && isHikeKind(input.walkKind) ? { walkKind: input.walkKind } : {}),
    date: options.showDate
      ? input.startedAt
        ? isoDateInTimeZone(input.startedAt)
        : input.day
      : null,
    stats,
    line: line ? line.map((p) => ({ lat: p.lat, lng: p.lng })) : null,
    lineState,
  };
}

export interface StrengthStorySet {
  readonly reps: number | null;
  readonly weightKg: number | null;
  readonly done: boolean;
}

export interface StrengthStoryExercise {
  readonly nameDe: string;
  /** Nur `weight` zählt fürs Volumen (Zusatzlast); Körpergewicht/Zeit nie. */
  readonly loadType: 'weight' | 'bodyweight' | 'time' | string;
  readonly skipped: boolean;
  readonly sets: readonly StrengthStorySet[];
}

export interface StrengthStoryInput {
  readonly nameDe: string;
  readonly performedOn: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly exercises: readonly StrengthStoryExercise[];
}

/** Volumen in kg nur aus Zusatzlast: Σ Wiederholungen × Gewicht abgehakter Sätze von Gewichtsübungen. */
export function extraLoadVolumeKg(exercises: readonly StrengthStoryExercise[]): number {
  let total = 0;
  for (const e of exercises) {
    if (e.skipped || e.loadType !== 'weight') continue;
    for (const s of e.sets) {
      if (!s.done || s.reps === null || s.weightKg === null) continue;
      if (
        !Number.isFinite(s.reps) ||
        !Number.isFinite(s.weightKg) ||
        s.reps <= 0 ||
        s.weightKg <= 0
      )
        continue;
      total += s.reps * s.weightKg;
    }
  }
  return Math.round(total);
}

/** Inhalt des Story-Bilds einer Krafteinheit (nur Felder der Positivliste). */
export function strengthStoryCard(
  input: StrengthStoryInput,
  options: StoryOptions,
): StrengthStoryCard {
  const done = input.exercises.filter((e) => !e.skipped && e.sets.some((s) => s.done));
  const setCount = done.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const stats: StoryStat[] = [];
  if (input.startedAt && input.finishedAt) {
    const seconds = (Date.parse(input.finishedAt) - Date.parse(input.startedAt)) / 1000;
    if (
      Number.isFinite(seconds) &&
      seconds >= 60 &&
      seconds <= TRACKED_ROUTE_LIMITS.durationS.max
    ) {
      stats.push({ key: 'duration', value: formatDuration(seconds) });
    }
  }
  stats.push({ key: 'exercises', value: String(done.length) });
  stats.push({ key: 'sets', value: String(setCount) });
  const volume = extraLoadVolumeKg(done);
  if (volume > 0) stats.push({ key: 'volume', value: `${groupedNumber(volume)} kg` });
  const names = done.map((e) => e.nameDe);
  return {
    kind: 'strength',
    title: input.nameDe,
    date: options.showDate ? input.performedOn : null,
    stats,
    exerciseNames: names.slice(0, STORY_CARD.maxExerciseNames),
    moreExercises: Math.max(0, names.length - STORY_CARD.maxExerciseNames),
  };
}
