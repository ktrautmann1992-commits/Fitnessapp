import { addDays, startOfIsoWeek } from '../dates';
import type { CompetitionPhase } from '../plan/competition-schema';
import type { PreviousSession } from '../plan/schedule';

/**
 * Wochen eines Plans für die Live-Anpassung (docs/PLAN-PHASE-4B.md 5.2 Tausch-Regel und Invarianten). Eine Plan-Woche
 * ist (block_no, week_no) – so wie lastLoadWeekSessions() und der Folgeblock zählen. Verschobene Einheiten bleiben in
 * ihrer ISO-Woche (reschedule.ts), der Montag ist daher eindeutig.
 */

/** Einheit eines gespeicherten Plans (mit oder ohne ID/Status). */
export type AdjustSession = PreviousSession;

export interface PlanWeek<S extends AdjustSession = AdjustSession> {
  readonly blockNo: number;
  readonly weekNo: number;
  /** Montag der ISO-Woche (aus dem frühesten Datum der Woche). */
  readonly monday: string;
  /** Erholungswoche: alle Einheiten `is_deload` (gemischte Wochen gelten vorsichtig als Belastungswoche). */
  readonly isDeload: boolean;
  /** Woche 0 (angebrochene Startwoche) – zählt nie als Belastungswoche und ist nie Bezug. */
  readonly isWeekZero: boolean;
  readonly isIntro: boolean;
  /** Phase des Wettkampfplans (erste gesetzte); null = Plan ohne Wettkampf. */
  readonly phase: CompetitionPhase | null;
  readonly sessions: readonly S[];
}

const dateOf = (s: Pick<AdjustSession, 'scheduled_on'>) => s.scheduled_on;

/** Plan-Wochen nach Block und Woche sortiert; Einheiten je Woche nach Datum. */
export function planWeeks<S extends AdjustSession>(sessions: readonly S[]): PlanWeek<S>[] {
  const byKey = new Map<string, S[]>();
  for (const s of sessions) {
    const key = `${s.block_no}:${s.week_no}`;
    byKey.set(key, [...(byKey.get(key) ?? []), s]);
  }
  return [...byKey.values()]
    .map((list) => {
      const sorted = [...list].sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
      const first = sorted[0] as S;
      return {
        blockNo: first.block_no,
        weekNo: first.week_no,
        monday: startOfIsoWeek(dateOf(first)),
        isDeload: sorted.every((s) => s.is_deload),
        isWeekZero: first.week_no === 0,
        isIntro: sorted.some((s) => s.is_intro_week),
        phase: sorted.find((s) => s.training_phase !== undefined)?.training_phase ?? null,
        sessions: sorted,
      };
    })
    .sort((a, b) => a.blockNo - b.blockNo || a.weekNo - b.weekNo);
}

/** Belastungswoche im Sinne der Invarianten (Woche 0 nie, Einstiegswoche ja – Wächter S-n1). */
export const isLoadPlanWeek = (w: Pick<PlanWeek, 'isDeload' | 'isWeekZero'>) =>
  !w.isDeload && !w.isWeekZero;

/** Ist der Plan ein Wettkampfplan (mindestens eine Einheit mit Phase)? */
export function isCompetitionPlan(sessions: readonly AdjustSession[]): boolean {
  return sessions.some((s) => s.training_phase !== undefined);
}

/** Ausdauer-Minuten einer Woche (alle Einheiten, auch gestrichene – so wurde die Woche geplant). */
export function enduranceMinutes(sessions: readonly AdjustSession[]): number {
  return sessions
    .filter((s) => s.kind === 'endurance')
    .reduce((sum, s) => sum + s.estimated_minutes, 0);
}

/**
 * Einheiten, die eine Plan-Änderung treffen darf (Wächter S1, Plan 5.2): Status `planned`, Datum nach heute
 * (frühestens morgen) und KEIN Tagebuch-Eintrag zu dieser Einheit (auch nicht von einem zweiten Gerät). Eine heute
 * laufende Einheit oder eine mit gespeichertem Entwurf ist damit nie betroffen.
 */
export function eligiblePlannedSessions<S extends AdjustSession>(
  sessions: readonly S[],
  logs: readonly { readonly plannedSessionId: string | null }[],
  today: string,
): S[] {
  const logged = new Set(
    logs.map((l) => l.plannedSessionId).filter((id): id is string => id !== null),
  );
  return sessions.filter(
    (s) =>
      s.id !== undefined &&
      (s.status ?? 'planned') === 'planned' &&
      s.scheduled_on > today &&
      !logged.has(s.id),
  );
}

/** Frühestes Datum, ab dem eine Änderung gelten darf: morgen. */
export const tomorrowOf = (today: string) => addDays(today, 1);
