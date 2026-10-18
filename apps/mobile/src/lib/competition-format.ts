import {
  brickSplit,
  type CompetitionCountdown,
  type CompetitionDiscipline,
  type CompetitionFeasibility,
  type CompetitionPlanWeek,
  type FeasibilitySuggestion,
  intervalBlocks,
  isRunCompetitionDiscipline,
  type SessionPaceInfo,
  type Sport,
  type WorkoutStep,
} from '@fitnessapp/core';

import { t } from '@/i18n';

import { formatDateDe } from './format';

/**
 * Anzeige-Texte zum Wettkampf (Etappe WP4) – rein, ohne React Native (getestet in competition-format.test.ts). Keine
 * Fachlogik: Werte kommen aus packages/core, hier wird nur formuliert.
 */

const C = t.competition;

/** Distanz als Wort („Halbmarathon“, „Triathlon Sprint“); Rad mit Kilometern („Radrennen 120 km“, WP5). */
export function disciplineText(
  discipline: CompetitionDiscipline,
  distanceKm: number | null = null,
): string {
  if (discipline === 'cycling' && distanceKm !== null) return C.cyclingWithDistance(distanceKm);
  return C.disciplines[discipline];
}

/** Dauer eines Schritts: „3 min“, „20 s“, „1:30 min“. */
export function stepDurationText(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} min` : `${minutes}:${String(rest).padStart(2, '0')} min`;
}

/** Uhrzeit-Format für Timer und Zeiten: „4:05“, „1:52:30“. */
export function clockText(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Zeit für den Bildschirmleser: „1 Stunde 52 Minuten 30 Sekunden“. */
export function clockA11y(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const parts: string[] = [];
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) parts.push(hours === 1 ? '1 Stunde' : `${hours} Stunden`);
  if (minutes > 0) parts.push(minutes === 1 ? '1 Minute' : `${minutes} Minuten`);
  if (seconds > 0 || parts.length === 0) {
    parts.push(seconds === 1 ? '1 Sekunde' : `${seconds} Sekunden`);
  }
  return parts.join(' ');
}

/** Pace „6:05“ (min/km) aus Sekunden je km. */
export function paceText(secondsPerKm: number): string {
  const s = Math.round(secondsPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Kilometer mit Komma, höchstens eine Nachkommastelle: 12000 → „12“, 10500 → „10,5“. */
export function kmText(meters: number): string {
  const km = Math.round(meters / 100) / 10;
  return Number.isInteger(km) ? String(km) : String(km).replace('.', ',');
}

/** Wort zum Schritt („zügig“, „locker“, „locker traben“). */
export function stepKindText(step: WorkoutStep): string {
  return C.stepKinds[step.kind];
}

/**
 * Ein Schritt für den Timer: „Hauptteil: 3 min zügig“; mit Sportart (Koppeltraining, WP5) „Hauptteil (Laufen): 12 min
 * locker“.
 */
export function stepTitle(step: WorkoutStep, sport: Sport | null = null): string {
  const part = sport
    ? `${C.stepParts[step.part]} (${C.stepSports[sport]})`
    : C.stepParts[step.part];
  return `${part}: ${stepDurationText(step.seconds)} ${stepKindText(step)}`;
}

/**
 * Übersicht der Schritte (Plan-Ansicht), z. B. „6 × 3 min zügig (Anstrengung 8), dazwischen 2 min locker“. Mit
 * Sportart je Schritt (Koppeltraining, WP5): jeder Schritt eine Zeile mit „(Rad)“ bzw. „(Laufen)“.
 */
export function stepLines(
  steps: readonly WorkoutStep[],
  sports: readonly Sport[] | null = null,
): string[] {
  if (sports !== null) {
    return steps.map((s, i) =>
      C.stepLineSport(
        C.stepParts[s.part],
        C.stepSports[sports[i] ?? 'run'],
        stepDurationText(s.seconds),
        stepKindText(s),
        s.effort,
      ),
    );
  }
  return intervalBlocks(steps).map((block) => {
    if (block.kind === 'single') {
      const s = block.step;
      return C.stepLine(
        C.stepParts[s.part],
        stepDurationText(s.seconds),
        stepKindText(s),
        s.effort,
      );
    }
    return C.repeatLine(
      block.repeats,
      stepDurationText(block.work.seconds),
      stepKindText(block.work),
      block.work.effort,
      block.rest ? stepDurationText(block.rest.seconds) : null,
    );
  });
}

/**
 * Zusatz-Zeilen einer Wettkampf-Einheit: Art, beim Koppeltraining die zwei Teile (WP5), Pace (immer mit Hinweis),
 * Distanz-Richtwert.
 */
export function workoutInfoLines(
  session: {
    readonly workout_type?: keyof typeof C.workoutTypes | null;
    readonly estimated_minutes?: number;
  },
  info: SessionPaceInfo,
): string[] {
  const type = session.workout_type;
  if (!type) return [];
  const lines = [C.workoutTypeLine(C.workoutTypes[type], info.hard)];
  if (type === 'brick' && session.estimated_minutes !== undefined) {
    const split = brickSplit(session.estimated_minutes);
    lines.push(C.brickLine(split.bike, split.run));
  }
  if (info.pace) {
    lines.push(C.paceLine(paceText(info.pace.fastSPerKm), paceText(info.pace.slowSPerKm)));
    lines.push(C.paceNotice);
  }
  if (info.distanceM !== null) lines.push(C.distanceLine(kmText(info.distanceM)));
  return lines;
}

/** Phasen-Band „Aufbau · Woche 6 von 14“. */
export function phaseBandText(week: CompetitionPlanWeek): string {
  const phase = week.phase ? C.phases[week.phase] : null;
  if (week.weekNo === null) return phase ?? C.phases.recovery;
  if (week.weekNo === 0) return C.phaseBandIntro(phase ?? C.phases.base, week.totalWeeks);
  return phase
    ? C.phaseBand(phase, week.weekNo, week.totalWeeks)
    : C.phaseBandWeekOnly(week.weekNo, week.totalWeeks);
}

/** Countdown-Text („Noch 23 Tage bis zum Halbmarathon“). */
export function countdownText(
  countdown: CompetitionCountdown,
  discipline: CompetitionDiscipline,
  distanceKm: number | null = null,
): string {
  const distance = disciplineText(discipline, distanceKm);
  switch (countdown.kind) {
    case 'upcoming':
      return C.countdown(countdown.daysLeft, distance);
    case 'race_day':
      return C.raceDay(distance);
    case 'awaiting_result':
      return C.awaitingResult(distance);
    case 'done':
      return countdown.recovery ? C.recovery : C.result.done;
    case 'cancelled':
      return C.cancelled;
  }
}

/** Text eines Vorschlags der Ampel. */
export function suggestionText(suggestion: FeasibilitySuggestion): string {
  switch (suggestion.kind) {
    case 'shorter_distance':
      return C.suggestions.shorter_distance(
        disciplineText(suggestion.discipline, suggestion.distanceKm ?? null),
      );
    case 'later_date':
      return C.suggestions.later_date(formatDateDe(suggestion.raceDate));
    case 'more_training_time':
      return C.suggestions.more_training_time(suggestion.weeklyMinutes);
    case 'longer_long_run_day':
      return C.suggestions.longer_long_run_day(suggestion.minutes);
    case 'health_check':
      return C.suggestions.health_check;
    case 'without_competition':
      return C.suggestions.without_competition;
  }
}

/** Ampel als ein Satz (Zeichen + Wort + Erklärung) – Farbe nie allein. */
export function feasibilityHeadline(feasibility: Pick<CompetitionFeasibility, 'status'>): string {
  const s = C.status[feasibility.status];
  return `${s.symbol} ${s.label}`;
}

/** Zahlen zur Ampel (Vorlauf, Umfang, langer Lauf bzw. lange Ausfahrt) – nur, wenn sie etwas sagen. */
export function feasibilityFacts(
  f: CompetitionFeasibility,
  discipline: CompetitionDiscipline | null = null,
): string[] {
  if (f.status === 'not_available') return [];
  const lines = [C.leadInfo(f.leadWeeks, f.minimumLeadWeeks)];
  if (f.plannedPeakMinutes > 0) {
    lines.push(C.peakInfo(f.plannedPeakMinutes, f.requiredWeeklyMinutes));
  }
  if (f.plannedLongRunMinutes > 0) {
    const ride = discipline !== null && !isRunCompetitionDiscipline(discipline);
    lines.push(
      (ride ? C.longRideInfo : C.longRunInfo)(f.plannedLongRunMinutes, f.requiredLongRunMinutes),
    );
  }
  if (f.status === 'ok' || f.status === 'tight') lines.push(C.effectiveGoal[f.effectiveGoal]);
  return lines;
}

/** Sekunden aus Eingabe-Feldern (Stunden, Minuten, Sekunden; leere Felder = 0). null = ungültig/leer. */
export function secondsFromParts(hours: string, minutes: string, seconds: string): number | null {
  const parts = [hours, minutes, seconds].map((p) => p.trim());
  if (parts.every((p) => p === '')) return null;
  if (!parts.every((p) => p === '' || /^\d{1,2}$/.test(p))) return null;
  const [h, m, s] = parts.map((p) => (p === '' ? 0 : Number(p))) as [number, number, number];
  if (m > 59 || s > 59) return null;
  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}

/** Sekunden → Felder (Stunden, Minuten, Sekunden). */
export function partsFromSeconds(total: number | null): {
  hours: string;
  minutes: string;
  seconds: string;
} {
  if (total === null) return { hours: '', minutes: '', seconds: '' };
  return {
    hours: String(Math.floor(total / 3600)),
    minutes: String(Math.floor((total % 3600) / 60)),
    seconds: String(total % 60),
  };
}
