import {
  ENDURANCE_BEGINNER_WALK_RUN_WEEKS,
  ENDURANCE_DELOAD_VOLUME_FACTOR,
  ENDURANCE_EFFORT,
  ENDURANCE_SESSION_LIMITS,
  ENDURANCE_START_RULES,
} from '../constants';
import type { EnduranceDiscipline, EnduranceModality, GoalType } from '../enums';
import type { EnduranceStartGroup, PlanSafetyRules } from './safety';
import { capWeeklyIncrease, increasedMinutes, scaledMinutes } from './volume';

/**
 * Ausdauer-Tage ohne KI – „lockerer Dauerlauf“ bis Phase 10 (docs/PLAN-PHASE-3-ERWEITERUNG.md Abschnitte 5.5 und
 * 5.6). Reine Funktionen; feste deutsche Textbausteine (fachlich zu prüfen), keine Intervalle, keine Tempo-Zonen.
 */

/** Konkrete Form einer Ausdauer-Einheit (Name und Text), zur Modalität in planned_sessions. */
export type EnduranceVariant =
  'easy_run' | 'walk_run' | 'brisk_walk' | 'easy_bike' | 'ergometer' | 'easy_swim';

export const ENDURANCE_VARIANT_MODALITY: Readonly<Record<EnduranceVariant, EnduranceModality>> = {
  easy_run: 'run',
  walk_run: 'run',
  brisk_walk: 'walk',
  easy_bike: 'bike',
  ergometer: 'bike',
  easy_swim: 'swim',
};

/**
 * Feste Textbausteine (PRODUKTENTSCHEIDUNG, fachliche Prüfung vor Veröffentlichung). Die App zeigt `talkTest`
 * und `alternatives` zu jeder Ausdauer-Einheit (Etappe C); gespeichert werden Name, Auf- und Abwärmen.
 */
export const ENDURANCE_TEXTS_DE = {
  names: {
    easy_run: 'Lockerer Dauerlauf',
    walk_run: 'Geh-Lauf-Wechsel',
    brisk_walk: 'Zügiges Gehen',
    easy_bike: 'Lockere Radeinheit',
    ergometer: 'Ergometer locker',
    easy_swim: 'Lockeres Schwimmen',
  },
  warmup: {
    easy_run: '5 Minuten zügig gehen.',
    walk_run: '5 Minuten zügig gehen.',
    brisk_walk: '5 Minuten in normalem Tempo gehen.',
    easy_bike: '5 Minuten locker einrollen.',
    ergometer: '5 Minuten locker einrollen.',
    easy_swim: '5 Minuten locker einschwimmen.',
  },
  cooldown: {
    easy_run: '5 Minuten locker auslaufen bzw. gehen, leicht dehnen.',
    walk_run: '5 Minuten locker gehen, leicht dehnen.',
    brisk_walk: '5 Minuten langsam gehen, leicht dehnen.',
    easy_bike: '5 Minuten locker ausrollen, leicht dehnen.',
    ergometer: '5 Minuten locker ausrollen, leicht dehnen.',
    easy_swim: '5 Minuten locker ausschwimmen.',
  },
  walkRunPattern: '1 Minute laufen, 2 Minuten gehen – im Wechsel.',
  talkTest: (effort: number) =>
    `Anstrengung ${effort} von 10: Du kannst dich noch in ganzen Sätzen unterhalten.`,
  alternatives: 'Ausweichen bei schlechtem Wetter: Laufband, Ergometer oder Rudergerät.',
  alternativesPregnancy: 'Ausweichen: Laufband im Gehtempo oder Ergometer.',
  pregnancyDoctor: 'Bitte stimme dein Training mit deiner Ärztin oder deinem Arzt ab.',
} as const;

export interface EnduranceContext {
  readonly goalType: GoalType;
  readonly discipline: EnduranceDiscipline | null;
  readonly rules: Pick<
    PlanSafetyRules,
    | 'enduranceEffortMax'
    | 'enduranceWalkOnly'
    | 'enduranceStartGroup'
    | 'pregnancyNotice'
    | 'noHealthCheck'
  >;
  readonly experienceLevel: 'beginner' | 'advanced' | 'competitive';
}

const TRIATHLON: readonly (EnduranceDiscipline | null)[] = [
  'triathlon_sprint',
  'triathlon_olympic',
  'triathlon_middle',
  'triathlon_long',
];

/**
 * Modalität einer Ausdauer-Einheit – die strengste Zeile gewinnt (Tabelle 5.5):
 * Schwangerschaft → zügiges Gehen bzw. Ergometer (nie Rad im Freien), bei Schwimmen lockeres Schwimmen;
 * Flag/ab 65 → zügiges Gehen, bei Rad Ergometer, bei Schwimmen lockeres Schwimmen; ohne Check → Geh-Lauf-Wechsel;
 * Einsteiger in den ersten Belastungswochen → Geh-Lauf-Wechsel; sonst nach Disziplin (Triathlon abwechselnd).
 * `loadWeek` = Nummer der Belastungswoche seit Planstart (0 = Woche 0), `index` = laufende Nummer der
 * Ausdauer-Einheit (für den Wechsel beim Triathlon).
 */
export function enduranceVariant(
  ctx: Pick<EnduranceContext, 'discipline' | 'rules' | 'experienceLevel'>,
  loadWeek: number,
  index: number,
): EnduranceVariant {
  const d = ctx.discipline;
  const triathlon = TRIATHLON.includes(d);
  const alternate = index % 2 === 1;
  if (ctx.rules.pregnancyNotice || ctx.rules.enduranceWalkOnly) {
    if (d === 'swimming') return 'easy_swim';
    if (d === 'cycling') return 'ergometer';
    if (triathlon) return alternate ? 'ergometer' : 'brisk_walk';
    return 'brisk_walk';
  }
  const walkRun =
    ctx.rules.noHealthCheck ||
    (ctx.experienceLevel === 'beginner' && loadWeek <= ENDURANCE_BEGINNER_WALK_RUN_WEEKS);
  const run: EnduranceVariant = walkRun ? 'walk_run' : 'easy_run';
  if (d === 'swimming') return 'easy_swim';
  if (d === 'cycling') return 'easy_bike';
  if (triathlon) return alternate ? 'easy_bike' : run;
  return run;
}

/** Anstrengung (0–10): Einstiegs-/Erholungswoche und Woche 0 locker-unten, sonst bis zum Deckel der Regeln. */
export function enduranceEffort(
  rules: Pick<PlanSafetyRules, 'enduranceEffortMax'>,
  easyWeek: boolean,
): number {
  const max = Math.min(ENDURANCE_EFFORT.easyMax, rules.enduranceEffortMax);
  return easyWeek ? Math.min(ENDURANCE_EFFORT.easyMin, max) : max;
}

/** Startumfang S = min(Wunsch, Startumfang der Gruppe). */
export function enduranceStartMinutes(group: EnduranceStartGroup, wishWeekly: number): number {
  return Math.min(Math.floor(wishWeekly), ENDURANCE_START_RULES.startWeeklyMinutes[group]);
}

/** Start-Deckel je Einheit (null = keiner). */
export function enduranceStartSessionCap(group: EnduranceStartGroup): number | null {
  const caps: Partial<Record<EnduranceStartGroup, number>> =
    ENDURANCE_SESSION_LIMITS.startSessionMinutes;
  return caps[group] ?? null;
}

export type EnduranceWeekKind = 'week0' | 'intro' | 'load' | 'deload';

export interface EnduranceWeekInput {
  readonly kind: EnduranceWeekKind;
  /** Wunsch-Minuten der Ausdauer-Tage dieser Woche (in Tagesreihenfolge). */
  readonly wishes: readonly number[];
}

/** Bezug für einen Folgeblock (aus planned_sessions der letzten Belastungswoche, ohne gestrichene). */
export interface EnduranceReference {
  /** Summe der geplanten Ausdauer-Minuten der letzten Belastungswoche (ohne `skipped`). */
  readonly volume: number;
  /** Längste nicht gestrichene Ausdauer-Einheit dieser Woche (fortgeschriebener Start-Deckel). */
  readonly sessionCap: number | null;
}

export interface EnduranceWeekResult {
  /** Minuten je Tag (0 = gestrichen → Ruhetag). */
  readonly minutes: readonly number[];
  readonly budget: number;
  /** Wirksamer Deckel je Einheit dieser Woche (Infinity = keiner). */
  readonly sessionCap: number;
}

export interface EnduranceVolumesResult {
  readonly weeks: readonly EnduranceWeekResult[];
  /** Startumfang unter dem Wunsch → Hinweis endurance_volume_ramped. */
  readonly ramped: boolean;
  /** Mindestens ein Tag wegen der 10-Minuten-Grenze gestrichen → Hinweis rest_day_added. */
  readonly droppedDay: boolean;
}

/**
 * Verteilt `budget` Minuten auf die Tage (Erweiterungsplan 5.5 Punkt 6): proportional zu den Wunsch-Minuten
 * (Math.floor, Rest-Minuten der Reihe nach an die längsten Wunsch-Tage), dann je Einheit gedeckelt (Wunsch,
 * `sessionCap`, bei ≥ 2 Einheiten 50 % der Woche); Abgeschnittenes geht an Tage mit Luft (nie über deren Wunsch
 * oder Deckel), der Rest verfällt. Einheiten unter 10 Minuten werden
 * gestrichen, ihre Minuten gehen an die übrigen bis zu deren Deckel. Die Summe bleibt immer ≤ `budget`.
 */
export function distributeEnduranceMinutes(
  budget: number,
  wishes: readonly number[],
  sessionCap: number,
): { minutes: number[]; dropped: number } {
  const n = wishes.length;
  const total = wishes.reduce((sum, w) => sum + w, 0);
  if (n === 0 || total <= 0 || budget <= 0) {
    return { minutes: wishes.map(() => 0), dropped: 0 };
  }
  const B = Math.min(Math.floor(budget), total);
  const shareCap = Math.floor(B * ENDURANCE_SESSION_LIMITS.maxShareOfWeek);
  // 50 %-Deckel nur, solange mindestens 2 Einheiten übrig sind.
  const capFor = (i: number, active: number) =>
    Math.min(wishes[i] as number, sessionCap, active >= 2 ? shareCap : Number.POSITIVE_INFINITY);
  let caps = wishes.map((_, i) => capFor(i, n));
  // Reihenfolge für Rest-Minuten: längster Wunsch zuerst, bei Gleichstand der frühere Tag.
  const order = wishes
    .map((w, i) => ({ w, i }))
    .sort((a, b) => b.w - a.w || a.i - b.i)
    .map((x) => x.i);
  const alloc = wishes.map((w) => Math.floor((B * w) / total));
  let rest = B - alloc.reduce((sum, m) => sum + m, 0);
  for (const i of order) {
    if (rest <= 0) break;
    alloc[i] = (alloc[i] as number) + 1;
    rest -= 1;
  }
  for (let i = 0; i < n; i += 1) {
    alloc[i] = Math.min(alloc[i] as number, caps[i] as number);
  }
  // Was ein Deckel abschneidet, geht an Tage mit Luft – nie über deren Wunsch oder Deckel; der Rest verfällt.
  let surplus = B - alloc.reduce((sum, m) => sum + m, 0);
  for (const i of order) {
    if (surplus <= 0) break;
    const add = Math.min(surplus, (caps[i] as number) - (alloc[i] as number));
    if (add > 0) {
      alloc[i] = (alloc[i] as number) + add;
      surplus -= add;
    }
  }
  const min = ENDURANCE_SESSION_LIMITS.minSessionMinutes;
  const active = new Set(order);
  let dropped = 0;
  for (;;) {
    const short = [...active]
      .filter((i) => (alloc[i] as number) < min)
      .sort((a, b) => (alloc[a] as number) - (alloc[b] as number) || b - a)[0];
    if (short === undefined) break;
    let freed = alloc[short] as number;
    alloc[short] = 0;
    active.delete(short);
    dropped += 1;
    caps = wishes.map((_, i) => capFor(i, active.size));
    for (const i of order) {
      if (!active.has(i) || freed <= 0) continue;
      const add = Math.min(freed, (caps[i] as number) - (alloc[i] as number));
      if (add > 0) {
        alloc[i] = (alloc[i] as number) + add;
        freed -= add;
      }
    }
  }
  return { minutes: alloc, dropped };
}

/**
 * Wochenumfänge eines Blocks (Erweiterungsplan 5.5 Punkte 1–6):
 * - Startumfang S = min(Wunsch, Startumfang der Gruppe); Woche 0 bekommt höchstens den Anteil von S für ihre
 *   Resttage und ist nie Bezug,
 * - Belastungswoche ≤ floor(1,1 × letzte Belastungswoche); ohne Bezug gilt S (capWeeklyIncrease),
 * - Erholungswoche = floor(0,6 × letzte Belastungswoche), nie Bezug,
 * - Deckel je Einheit: Start-Deckel (Einsteiger 30, vorsichtig 20) in der ersten Belastungswoche, danach
 *   floor(1,1 × Deckel der Vorwoche); in der ersten Belastungswoche des Plans höchstens 90 Minuten; bei ≥ 2
 *   Einheiten höchstens 50 % der Woche; nie über dem Wunsch.
 * `reference` = Folgeblock (Bezug aus der letzten Belastungswoche des bisherigen Plans).
 */
export function enduranceWeekVolumes(
  weeks: readonly EnduranceWeekInput[],
  options: {
    readonly group: EnduranceStartGroup;
    /** Summe der Wunsch-Minuten einer vollen Woche. */
    readonly wishWeekly: number;
    readonly reference?: EnduranceReference | null;
    /**
     * Folgeblock mit STRENGERER Startgruppe als bisher (z. B. ab 65, neues Flag): Bezug höchstens der Startumfang der
     * neuen Gruppe, Deckel je Einheit beginnt wieder beim Start-Deckel (wie eine erste Belastungswoche).
     */
    readonly stricterGroup?: boolean;
  },
): EnduranceVolumesResult {
  const S = enduranceStartMinutes(options.group, options.wishWeekly);
  const startCap = enduranceStartSessionCap(options.group);
  const reference = options.reference ?? null;
  const restart = reference !== null && (options.stricterGroup ?? false);
  let refVolume = reference
    ? restart
      ? Math.min(reference.volume, ENDURANCE_START_RULES.startWeeklyMinutes[options.group])
      : reference.volume
    : 0;
  // Deckel je Einheit der letzten Belastungswoche (null = noch keine Belastungswoche).
  let lastCap: number | null =
    reference && !restart && startCap !== null ? (reference.sessionCap ?? startCap) : null;
  let hadLoadWeek = reference !== null && !restart;
  let droppedDay = false;
  const results: EnduranceWeekResult[] = [];
  for (const week of weeks) {
    const wish = week.wishes.reduce((sum, w) => sum + w, 0);
    let budget: number;
    let cap: number;
    if (week.kind === 'week0') {
      budget = options.wishWeekly > 0 ? Math.floor((S * wish) / options.wishWeekly) : 0;
      cap = Math.min(
        startCap ?? Number.POSITIVE_INFINITY,
        ENDURANCE_SESSION_LIMITS.firstLoadWeekMaxMinutes,
      );
    } else if (week.kind === 'deload') {
      budget = Math.min(
        wish,
        scaledMinutes(refVolume > 0 ? refVolume : S, ENDURANCE_DELOAD_VOLUME_FACTOR),
      );
      cap = lastCap ?? startCap ?? Number.POSITIVE_INFINITY;
    } else {
      budget = capWeeklyIncrease(refVolume, wish, S);
      if (!hadLoadWeek) {
        cap = Math.min(
          startCap ?? Number.POSITIVE_INFINITY,
          ENDURANCE_SESSION_LIMITS.firstLoadWeekMaxMinutes,
        );
      } else if (startCap !== null) {
        cap = lastCap === null ? startCap : increasedMinutes(lastCap);
      } else {
        cap = Number.POSITIVE_INFINITY;
      }
    }
    const { minutes, dropped } = distributeEnduranceMinutes(budget, week.wishes, cap);
    if (dropped > 0) droppedDay = true;
    if (week.kind === 'intro' || week.kind === 'load') {
      refVolume = minutes.reduce((sum, m) => sum + m, 0);
      if (startCap !== null) lastCap = cap;
      hadLoadWeek = true;
    }
    results.push({ minutes, budget, sessionCap: cap });
  }
  return { weeks: results, ramped: S < Math.floor(options.wishWeekly), droppedDay };
}

/** Höchstens so viele Ausdauer-Einheiten je Woche (ENDURANCE_START_RULES.maxSessionsPerWeek). */
export function maxEnduranceSessions(group: EnduranceStartGroup): number {
  return ENDURANCE_START_RULES.maxSessionsPerWeek[group];
}
