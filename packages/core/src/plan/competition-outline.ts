import { SESSION_LOG_LIMITS } from '../constants';
import { addDays, daysBetween, startOfIsoWeek } from '../dates';
import type { CompetitionPhase } from './competition-schema';
import { macroCycle, type MacroCycleInputs } from './periodization';

/**
 * „So ist dein Plan aufgebaut“ (Gründer-Rückmeldung vom 20.10.2026: „Es sollte besser ersichtlich sein, wie der Plan
 * aufgebaut ist“): Zeitleiste aller Phasen des Wettkampfplans mit Wochen-Spanne, Datum, aktueller Woche, Erholungswochen
 * und Umfangs-Trend. Reine Anzeige – nichts wird gespeichert.
 *
 * Quelle der Phasen ist derselbe Makrozyklus wie beim Erstellen (`macroCycle`, rückwärts vom Renntag). Phasen hängen nur
 * von Disziplin, Renntag und Planstart ab; die Erholungswochen im Training zusätzlich von Level, Startgruppe und
 * „vorsichtig“. Für Wochen, die schon geplant sind, gilt deshalb, was gespeichert ist (`is_deload` der Einheiten); für
 * spätere Wochen die Vorschau aus dem Makrozyklus (`projected`). Die Wochenzählung ist die von `competitionPlanWeek`
 * („Woche X von Y“, angebrochene Startwoche = Woche 0, nach der Rennwoche keine Nummer).
 */

/** Umfangs-Trend einer Phase (Text-Schlüssel; die App formuliert). */
export type CompetitionVolumeTrend =
  /** Umfang steigt höchstens ~10 % pro Woche (Basis, Aufbau). */
  | 'rising'
  /** Höchster Umfang bleibt (Spitze). */
  | 'holding'
  /** Umfang sinkt deutlich (Tapering). */
  | 'falling'
  /** Wenig und locker (Rennwoche, Erholung nach dem Rennen). */
  | 'easy';

/** Trend je Phase (fest, Plan 3.1: Kette bis zum Spitzenumfang, dann Plateau; danach Tapering-Faktoren). */
export const COMPETITION_PHASE_TREND: Readonly<Record<CompetitionPhase, CompetitionVolumeTrend>> = {
  base: 'rising',
  build: 'rising',
  peak: 'holding',
  taper: 'falling',
  race_week: 'easy',
  recovery: 'easy',
};

export interface CompetitionOutlineWeek {
  /** Woche im Wettkampfplan wie `competitionPlanWeek`; 0 = Einstiegswoche; null = nach der Rennwoche. */
  readonly weekNo: number | null;
  readonly monday: string;
  readonly sunday: string;
  readonly phase: CompetitionPhase;
  /** Erholungswoche im Training (Basis/Aufbau/Spitze), nicht Tapering oder Erholung nach dem Rennen. */
  readonly recoveryWeek: boolean;
  /** true = noch nicht geplant, Erholungswoche nur als Vorschau aus dem Makrozyklus. */
  readonly projected: boolean;
  /** Angebrochene Startwoche (Woche 0). */
  readonly entryWeek: boolean;
  readonly raceWeek: boolean;
  /** Woche von `today`. */
  readonly current: boolean;
  /** Woche liegt ganz vor `today`. */
  readonly past: boolean;
  /** Umfang relativ zur letzten Belastungswoche in Prozent (Tapering, Rennwoche, Erholung); sonst null. */
  readonly volumePercent: number | null;
  /** Geplante Ausdauer-Minuten der Woche (gespeicherte Einheiten, ohne übersprungene); null = noch nicht geplant. */
  readonly plannedMinutes: number | null;
  /** Im Kalender zu öffnen (Kalender zeigt ab heute − Nachtrage-Fenster bis zur Rennwoche). */
  readonly inCalendar: boolean;
}

export interface CompetitionOutlinePhase {
  readonly phase: CompetitionPhase;
  readonly trend: CompetitionVolumeTrend;
  /** Erste/letzte Wochennummer der Phase (null bei „Erholung nach dem Rennen“). */
  readonly firstWeekNo: number | null;
  readonly lastWeekNo: number | null;
  /** Montag der ersten und Sonntag der letzten Woche. */
  readonly from: string;
  readonly to: string;
  readonly weeks: readonly CompetitionOutlineWeek[];
  /** Anzahl Erholungswochen im Training in dieser Phase. */
  readonly recoveryWeeks: number;
  /** Die aktuelle Woche liegt in dieser Phase. */
  readonly current: boolean;
}

export type CompetitionOutlineStatus =
  /** Planstart liegt noch in der Zukunft. */
  | 'before_start'
  | 'running'
  | 'race_week'
  /** Nach der Rennwoche, Erholung läuft noch. */
  | 'recovery'
  /** Plan ganz vorbei. */
  | 'finished';

export interface CompetitionPlanOutline {
  readonly raceDate: string;
  /** „von Y“ – Woche des Renntags in der Zählung. */
  readonly totalWeeks: number;
  /** Aktuelle Woche („Woche X“); null vor dem Start, nach der Rennwoche bzw. nach dem Plan. */
  readonly currentWeekNo: number | null;
  readonly status: CompetitionOutlineStatus;
  readonly phases: readonly CompetitionOutlinePhase[];
}

export interface CompetitionOutlineSession {
  readonly scheduled_on: string;
  readonly kind: string;
  readonly status?: string;
  readonly estimated_minutes: number;
  readonly is_deload: boolean;
  readonly training_phase?: CompetitionPhase | null;
}

/**
 * Aufbau des Wettkampfplans für die Anzeige. `cycle` = Eingaben des Makrozyklus (Level/Startgruppe/„vorsichtig“ wie der
 * Plan), `planStart` = user_plans.start_date, `sessions` = gespeicherte Einheiten des aktiven Wettkampfplans.
 * null = kein Makrozyklus möglich (Renntag nicht nach dem Planstart bzw. zu kurz) – dann gibt es keinen Wettkampfplan.
 */
export function competitionPlanOutline(params: {
  readonly cycle: MacroCycleInputs;
  readonly planStart: string;
  readonly today: string;
  readonly sessions: readonly CompetitionOutlineSession[];
}): CompetitionPlanOutline | null {
  const { planStart, today, sessions } = params;
  const cycle = macroCycle(params.cycle, planStart);
  if (!cycle) return null;
  const startMonday = startOfIsoWeek(planStart);
  const offset = planStart !== startMonday ? 0 : 1;
  const raceMonday = startOfIsoWeek(cycle.raceDate);
  const raceIndex = daysBetween(startMonday, raceMonday) / 7;
  const todayMonday = startOfIsoWeek(today);
  const calendarFrom = startOfIsoWeek(addDays(today, -SESSION_LOG_LIMITS.backdateDays));

  const byWeek = new Map<string, CompetitionOutlineSession[]>();
  for (const s of sessions) {
    const monday = startOfIsoWeek(s.scheduled_on);
    byWeek.set(monday, [...(byWeek.get(monday) ?? []), s]);
  }

  const weeks: CompetitionOutlineWeek[] = cycle.weeks.map((w) => {
    const stored = byWeek.get(w.monday) ?? [];
    const planned = stored.length > 0;
    const trainingPhase = w.phase === 'base' || w.phase === 'build' || w.phase === 'peak';
    // Gespeicherter Stand hat Vorrang: Erholungswoche = alle Einheiten der Woche sind Erholungs-Einheiten.
    const recoveryWeek = trainingPhase && (planned ? stored.every((s) => s.is_deload) : w.deload);
    const endurance = stored.filter((s) => s.kind === 'endurance' && s.status !== 'skipped');
    return {
      weekNo: w.index > raceIndex ? null : w.index + offset,
      monday: w.monday,
      sunday: addDays(w.monday, 6),
      phase: w.phase,
      recoveryWeek,
      projected: !planned,
      entryWeek: w.partial,
      raceWeek: w.index === raceIndex,
      current: w.monday === todayMonday,
      past: w.monday < todayMonday,
      volumePercent: w.volumeFactor === null ? null : Math.round(w.volumeFactor * 100),
      plannedMinutes: planned ? endurance.reduce((sum, s) => sum + s.estimated_minutes, 0) : null,
      inCalendar: w.monday >= calendarFrom && w.monday <= raceMonday,
    };
  });

  const phases: CompetitionOutlinePhase[] = [];
  for (const week of weeks) {
    const last = phases.at(-1);
    if (last && last.phase === week.phase) {
      phases[phases.length - 1] = {
        ...last,
        lastWeekNo: week.weekNo,
        to: week.sunday,
        weeks: [...last.weeks, week],
        recoveryWeeks: last.recoveryWeeks + (week.recoveryWeek ? 1 : 0),
        current: last.current || week.current,
      };
    } else {
      phases.push({
        phase: week.phase,
        trend: COMPETITION_PHASE_TREND[week.phase],
        firstWeekNo: week.weekNo,
        lastWeekNo: week.weekNo,
        from: week.monday,
        to: week.sunday,
        weeks: [week],
        recoveryWeeks: week.recoveryWeek ? 1 : 0,
        current: week.current,
      });
    }
  }

  const lastSunday = weeks.at(-1)?.sunday ?? addDays(raceMonday, 6);
  const status: CompetitionOutlineStatus =
    today < planStart
      ? 'before_start'
      : todayMonday < raceMonday
        ? 'running'
        : todayMonday === raceMonday
          ? 'race_week'
          : today <= lastSunday
            ? 'recovery'
            : 'finished';
  const current = weeks.find((w) => w.current);
  return {
    raceDate: cycle.raceDate,
    totalWeeks: raceIndex + offset,
    currentWeekNo:
      status === 'running' || status === 'race_week' ? (current?.weekNo ?? null) : null,
    status,
    phases,
  };
}
