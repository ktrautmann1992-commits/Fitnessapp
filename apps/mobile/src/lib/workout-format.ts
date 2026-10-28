import {
  cardioSpeed,
  type CardioSpeed,
  type EnduranceModality,
  formatDuration,
  type WorkoutItem,
} from '@fitnessapp/core';

import { type DraftTarget, draftTargetFrom } from '@/data/workout-draft';
import { t } from '@/i18n';

import { formatDecimal, formatKg } from './format';
import { cardioDurationText, kmText } from './history-format';
import { buildSummary, type ExerciseSummary, repsRange, reserveFromRpe } from './plan-format';

/**
 * Anzeige-Texte des Trainingsmodus (rein, getestet in workout-format.test.ts). Keine Fachlogik: Vorgabe und Hinweis
 * kommen aus packages/core (über den Entwurf), hier wird nur formuliert.
 */

/** „je Hantel“ bzw. „je Kugel“ bei Kurzhanteln/Kettlebells (Gewicht gilt je Stück). */
export function perPieceText(target: Pick<DraftTarget, 'perPiece'>): string | null {
  if (target.perPiece === 'kettlebell') return t.workout.perKettlebell;
  if (target.perPiece === 'dumbbell') return t.workout.perDumbbell;
  return null;
}

/** Gewicht mit Einheit, z. B. „22,5 kg je Hantel“. */
export function weightText(weightKg: number, perPiece: string | null): string {
  const kg = t.workout.weightKg(formatKg(weightKg));
  return perPiece ? `${kg} ${perPiece}` : kg;
}

/** Vorgabe einer Übung: „3 × 10 mit 22,5 kg je Hantel“, „3 × 30 Sekunden halten“, „3 × 8–12“. */
export function targetText(target: DraftTarget): string {
  const perPiece = perPieceText(target);
  const tg = target.targets;
  const sets = tg.target_sets ?? 1;
  if (target.loadType === 'time' && tg.target_duration_s !== null) {
    return t.workout.targetHold(sets, tg.target_duration_s);
  }
  const reps =
    tg.target_reps !== null
      ? String(tg.target_reps)
      : repsRange(tg.reps_min ?? 0, tg.reps_max ?? tg.reps_min ?? 0);
  const weight =
    target.loadType === 'weight' && tg.target_weight_kg !== null
      ? weightText(tg.target_weight_kg, perPiece)
      : null;
  return t.workout.target(sets, reps, weight);
}

/** Zusätzliche Zeilen: Startgewicht finden, Ziel-Reserve, Wiedereinstieg, Hinweis der Progression. */
export function targetNotes(target: DraftTarget): string[] {
  const lines: string[] = [];
  const tg = target.targets;
  if (target.loadType === 'weight' && tg.target_weight_kg === null) {
    lines.push(target.chooseLightest ? t.workout.chooseLightest : t.workout.findStartWeight);
  } else if (target.source === 'start_weight') {
    lines.push(t.workout.fromStartWeight);
  }
  if (tg.is_return) lines.push(t.workout.returnAfterPause);
  if (tg.target_rpe !== null) lines.push(t.workout.rpeTarget(reserveFromRpe(tg.target_rpe)));
  const hint = hintText(target);
  if (hint) lines.push(hint);
  return lines;
}

/**
 * Hinweis der Progression als fester Satz. `harder_variant` NUR mit Variantenname (progressHintForDisplay, Pflicht-
 * punkt der UI-Etappe) – ohne Namen kein Hinweis.
 */
export function hintText(target: Pick<DraftTarget, 'hint' | 'harderVariantName'>): string | null {
  switch (target.hint) {
    case 'harder_variant':
      return target.harderVariantName
        ? t.workout.hint.harder_variant(target.harderVariantName)
        : null;
    case 'stronger_band':
      return t.workout.hint.stronger_band;
    case 'no_heavier_weight':
      return t.workout.hint.no_heavier_weight;
    case 'confirm_weight':
      return t.workout.hint.confirm_weight;
    default:
      return null;
  }
}

/**
 * Übung für die kompakte Liste auf „Heute“ (Entwurf B): berechnete Vorgabe, Gewicht bzw. „Gewicht selbst finden“,
 * Pause, Reserve und die übrigen Hinweise (null = Übung nicht prüfbar → Plan-Dosierung).
 */
export function workoutTargetSummary(item: WorkoutItem): ExerciseSummary | null {
  if (!item.plan) return null;
  return targetSummary(draftTargetFrom(item.plan, item.shown), item.shown.rest_s);
}

/** Kern von workoutTargetSummary (rein, getestet): Vorgabe + Pause der angezeigten Übung. */
export function targetSummary(target: DraftTarget, restSeconds: number): ExerciseSummary {
  const tg = target.targets;
  const hold = target.loadType === 'time' && tg.target_duration_s !== null;
  const needsWeight = target.loadType === 'weight' && tg.target_weight_kg === null;
  const notes: string[] = [];
  if (!needsWeight && target.source === 'start_weight') notes.push(t.workout.fromStartWeight);
  if (tg.is_return) notes.push(t.workout.returnAfterPause);
  const hint = hintText(target);
  if (hint) notes.push(hint);
  return buildSummary({
    sets: tg.target_sets ?? 1,
    reps: hold
      ? null
      : tg.target_reps !== null
        ? String(tg.target_reps)
        : repsRange(tg.reps_min ?? 0, tg.reps_max ?? tg.reps_min ?? 0),
    holdSeconds: hold ? tg.target_duration_s : null,
    restSeconds,
    reserve: tg.target_rpe !== null ? reserveFromRpe(tg.target_rpe) : null,
    weight:
      target.loadType === 'weight' && tg.target_weight_kg !== null
        ? weightText(tg.target_weight_kg, perPieceText(target))
        : null,
    findWeight: needsWeight ? (target.chooseLightest ? 'lightest' : 'find') : null,
    notes,
  });
}

/** Pace bzw. Geschwindigkeit (live beim Ausdauer-Eintrag): Anzeige und Bildschirmleser (km ausgeschrieben, 6.5). */
export function cardioSpeedTexts(speed: CardioSpeed): { text: string; a11y: string }[] {
  const kmh = formatDecimal(speed.kmh);
  const speedLine = { text: t.workout.cardio.speed(kmh), a11y: t.workout.cardio.speedA11y(kmh) };
  if (speed.kind === 'kmh' || speed.paceS === null) return [speedLine];
  const minutes = Math.floor(speed.paceS / 60);
  const seconds = speed.paceS % 60;
  // Rudern (Etappe R): Split je 500 m statt km/h.
  if (speed.kind === 'per_500m') {
    return [
      {
        text: t.rowing.split(formatDuration(speed.paceS)),
        a11y: t.rowing.splitA11y(minutes, seconds),
      },
    ];
  }
  const pace =
    speed.kind === 'per_km'
      ? {
          text: t.workout.cardio.paceKm(formatDuration(speed.paceS)),
          a11y: t.workout.cardio.paceKmA11y(minutes, seconds),
        }
      : {
          text: t.workout.cardio.pace100(formatDuration(speed.paceS)),
          a11y: t.workout.cardio.pace100A11y(minutes, seconds),
        };
  return speed.kind === 'per_km' ? [pace, speedLine] : [pace];
}

/** Eine Werte-Kachel (StatValue): Beschriftung, großer Wert, Ansage und testID. */
export interface CardioStatTile {
  readonly key: 'duration' | 'distance' | 'elevation' | 'pace' | 'speed';
  readonly label: string;
  readonly value: string;
  readonly a11y: string;
}

/**
 * Werte-Kacheln eines Ausdauer-Eintrags ohne aufgezeichnete Strecke (`/log/[id]`, 28.10.2026): Dauer, Distanz,
 * Höhenmeter, Ø-Pace (bzw. /100 m, Split /500 m) und Ø-Tempo – statt reiner Textzeilen. Werte nur, wenn vorhanden.
 */
export function cardioStatTiles(cardio: {
  readonly modality: EnduranceModality;
  readonly duration_s: number;
  readonly distance_m: number | null;
  readonly elevation_m: number | null;
}): CardioStatTile[] {
  const T = t.logEntry.tiles;
  const duration = cardioDurationText(cardio.duration_s);
  const tiles: CardioStatTile[] = [
    {
      key: 'duration',
      label: T.duration,
      value: formatDuration(cardio.duration_s),
      a11y: duration.a11y,
    },
  ];
  if (cardio.distance_m !== null && cardio.distance_m > 0) {
    const km = kmText(cardio.distance_m);
    tiles.push({
      key: 'distance',
      label: T.distance,
      value: T.km(km),
      a11y: t.logEntry.distanceA11y(km),
    });
  }
  if (cardio.elevation_m !== null && cardio.elevation_m > 0) {
    tiles.push({
      key: 'elevation',
      label: T.elevation,
      value: T.meters(cardio.elevation_m),
      a11y: T.elevationA11y(cardio.elevation_m),
    });
  }
  const speed = cardioSpeed(cardio.modality, cardio.duration_s, cardio.distance_m);
  if (!speed) return tiles;
  const [first, second] = cardioSpeedTexts(speed);
  const kmh = { key: 'speed', label: T.speed, value: T.kmh(formatDecimal(speed.kmh)) } as const;
  if (speed.kind === 'kmh' || speed.paceS === null) {
    return [...tiles, { ...kmh, a11y: first?.a11y ?? '' }];
  }
  const pace = formatDuration(speed.paceS);
  const paceTile: CardioStatTile = {
    key: 'pace',
    label: speed.kind === 'per_500m' ? T.split : T.pace,
    value:
      speed.kind === 'per_km'
        ? T.paceKm(pace)
        : speed.kind === 'per_100m'
          ? T.pace100(pace)
          : T.split500(pace),
    a11y: first?.a11y ?? '',
  };
  return speed.kind === 'per_km' && second
    ? [...tiles, paceTile, { ...kmh, a11y: second.a11y }]
    : [...tiles, paceTile];
}

/** Restzeit der Pause, z. B. „1:30“, und für den Bildschirmleser. */
export function restTexts(remaining: number): { text: string; a11y: string } {
  return {
    text: formatDuration(remaining),
    a11y: t.workout.rest.remainingA11y(Math.floor(remaining / 60), remaining % 60),
  };
}
