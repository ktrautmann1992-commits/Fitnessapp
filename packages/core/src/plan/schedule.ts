import {
  DEFAULT_TRAINING_DAYS,
  INTRO_WEEK_RPE_REDUCTION,
  PARTIAL_START_WEEK_MIN_SHARE,
} from '../constants';
import type { Exercise } from '../content/schemas';
import { addDays, isoWeekday, startOfIsoWeek } from '../dates';
import type { SessionFocus } from '../enums';
import {
  adaptedSessionMinutes,
  type AdaptedSession,
  clampRpe,
  type PlannedExerciseDraft,
} from './adapt';
import { applyCurrentSafetyRules } from './apply-safety';
import { deloadDosage } from './deload';
import type { EquipmentProfile } from './equipment-profile';
import type { PlanSafetyRules } from './safety';

/**
 * Wochenplanung (docs/PLAN-PHASE-3.md Abschnitte 5.7 und 5.10): Trainingstage wählen, Einheiten verteilen
 * (Rotation bei weniger Tagen als Einheiten der Vorlage), Plan-Block mit Woche 0/Einstiegswoche und fester
 * Erholungswoche, Folgeblock.
 */

/** Eine geplante Einheit (Spalten von planned_sessions + Übungen). */
export interface GeneratedSession {
  readonly block_no: number;
  /** 0 = Woche 0 (angebrochene Startwoche), 1 … Belastungswochen, letzte = Erholungswoche. */
  readonly week_no: number;
  readonly is_intro_week: boolean;
  readonly is_deload: boolean;
  readonly template_day_index: number;
  readonly scheduled_on: string;
  readonly name_de: string;
  readonly focus: SessionFocus;
  readonly estimated_minutes: number;
  readonly warmup_de: string;
  readonly cooldown_de: string;
  readonly exercises: readonly PlannedExerciseDraft[];
}

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Kleinster Abstand zwischen zwei Trainingstagen, Woche als Kreis (So → Mo = 1 Tag). */
export function cyclicMinGap(days: readonly number[]): number {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length <= 1) return 7;
  let min = 7;
  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i] as number;
    const next = i + 1 < sorted.length ? (sorted[i + 1] as number) : (sorted[0] as number) + 7;
    min = Math.min(min, next - current);
  }
  return min;
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  const result: T[][] = [];
  items.forEach((item, i) => {
    for (const rest of combinations(items.slice(i + 1), size - 1)) {
      result.push([item, ...rest]);
    }
  });
  return result;
}

/** Anzahl der Paare an aufeinanderfolgenden Tagen (Woche als Kreis). */
export function adjacentPairs(days: readonly number[]): number {
  const set = new Set(days);
  if (set.size <= 1) return 0;
  return [...set].filter((d) => set.has(d === 7 ? 1 : d + 1)).length;
}

/**
 * Auswahl mit dem größten Mindestabstand; Gleichstand: weniger Tage direkt hintereinander, dann lexikografisch
 * kleinste.
 */
function bestSpread(candidates: number[][]): number[] {
  let best: number[] = candidates[0] ?? [];
  let bestGap = -1;
  let bestPairs = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const gap = cyclicMinGap(candidate);
    const pairs = adjacentPairs(candidate);
    if (gap > bestGap || (gap === bestGap && pairs < bestPairs)) {
      best = candidate;
      bestGap = gap;
      bestPairs = pairs;
    }
  }
  return best;
}

export interface ChosenDays {
  /** Sortierte ISO-Wochentage. */
  readonly days: readonly number[];
  /** Wunsch-Tage wurden ergänzt (Hinweis `days_added`). */
  readonly added: boolean;
}

/**
 * Welche Wochentage (Abschnitt 5.7): gleich viele Wunsch-Tage → genau diese; mehr → größte Abstände; weniger →
 * Wunsch-Tage behalten und mit größtmöglichem Abstand ergänzen; keine → Standardmuster.
 */
export function chooseTrainingDays(count: number, preferred: readonly number[]): ChosenDays {
  const n = Math.max(1, Math.min(7, count));
  const wish = [...new Set(preferred)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  if (wish.length === n) {
    return { days: wish, added: false };
  }
  if (wish.length > n) {
    return { days: bestSpread(combinations(wish, n)), added: false };
  }
  if (wish.length === 0) {
    const standard = DEFAULT_TRAINING_DAYS[n];
    return {
      days: standard ? [...standard] : bestSpread(combinations([...ALL_DAYS], n)),
      added: false,
    };
  }
  const free = ALL_DAYS.filter((d) => !wish.includes(d));
  const extended = combinations(free, n - wish.length).map((extra) =>
    [...wish, ...extra].sort((a, b) => a - b),
  );
  return { days: bestSpread(extended), added: true };
}

type WeekKind = 'intro' | 'load' | 'deload';

/** Dosierung je Wochenart; RPE immer innerhalb des Deckels der Sicherheitsregeln. */
export function dosageForWeek(
  item: PlannedExerciseDraft,
  kind: WeekKind,
  rules: Pick<PlanSafetyRules, 'rpeMax'>,
): PlannedExerciseDraft {
  if (kind === 'deload') {
    const deloaded = deloadDosage(item);
    return { ...deloaded, rpe_target: clampRpe(deloaded.rpe_target, rules.rpeMax) };
  }
  const reduction = kind === 'intro' ? INTRO_WEEK_RPE_REDUCTION : 0;
  return { ...item, rpe_target: clampRpe(item.rpe_target - reduction, rules.rpeMax) };
}

function makeSession(
  base: AdaptedSession,
  info: { blockNo: number; weekNo: number; kind: WeekKind; date: string },
  rules: Pick<PlanSafetyRules, 'rpeMax'>,
): GeneratedSession {
  const exercises = base.exercises.map((e) => dosageForWeek(e, info.kind, rules));
  return {
    block_no: info.blockNo,
    week_no: info.weekNo,
    is_intro_week: info.kind === 'intro',
    is_deload: info.kind === 'deload',
    template_day_index: base.template_day_index,
    scheduled_on: info.date,
    name_de: base.name_de,
    focus: base.focus,
    estimated_minutes: adaptedSessionMinutes({ exercises }),
    warmup_de: base.warmup_de,
    cooldown_de: base.cooldown_de,
    exercises,
  };
}

interface WeekPlan {
  readonly weekNo: number;
  readonly monday: string;
  readonly days: readonly number[];
  readonly kind: WeekKind;
}

function placeWeeks(
  weeks: readonly WeekPlan[],
  sessions: readonly AdaptedSession[],
  blockNo: number,
  rotationStart: number,
  rules: Pick<PlanSafetyRules, 'rpeMax'>,
): GeneratedSession[] {
  const result: GeneratedSession[] = [];
  let index = rotationStart;
  for (const week of weeks) {
    for (const day of week.days) {
      const base = sessions[index % sessions.length] as AdaptedSession;
      index += 1;
      result.push(
        makeSession(
          base,
          { blockNo, weekNo: week.weekNo, kind: week.kind, date: addDays(week.monday, day - 1) },
          rules,
        ),
      );
    }
  }
  return result;
}

export interface BuildPlanBlockOptions {
  /** Angepasste Einheiten in Vorlagen-Reihenfolge (A, B, C … bzw. Oberkörper/Unterkörper im Wechsel). */
  readonly sessions: readonly AdaptedSession[];
  /** Sortierte ISO-Wochentage, Länge = Einheiten pro Woche. */
  readonly trainingDays: readonly number[];
  /** Erzeugungsdatum. Einheiten vor diesem Tag entfallen. */
  readonly today: string;
  readonly loadWeeks: number;
  readonly rules: Pick<PlanSafetyRules, 'rpeMax'>;
}

/**
 * Erster Plan-Block (Abschnitt 5.7): Passt mindestens die Hälfte der Wochen-Einheiten in den Rest der aktuellen
 * Woche, ist sie Woche 1 (Einstiegswoche). Sonst laufen diese Einheiten als Woche 0 (= Einstiegswoche, zählt nicht
 * zum Block) und Woche 1 beginnt am nächsten Montag (normale Belastungswoche). Ist nichts mehr frei, beginnt
 * Woche 1 am nächsten Montag als Einstiegswoche. Danach Belastungswochen bis `loadWeeks`, dann die Erholungswoche.
 */
export function buildPlanBlock(options: BuildPlanBlockOptions): GeneratedSession[] {
  const { sessions, trainingDays, today, loadWeeks, rules } = options;
  if (sessions.length === 0 || trainingDays.length === 0) return [];
  const monday = startOfIsoWeek(today);
  const weekday = isoWeekday(today);
  const remaining = trainingDays.filter((d) => d >= weekday);
  const weeks: WeekPlan[] = [];
  let week1Monday: string;
  let week1Days: readonly number[] = trainingDays;
  let introInWeekZero = false;
  if (remaining.length === 0) {
    week1Monday = addDays(monday, 7);
  } else if (remaining.length >= trainingDays.length * PARTIAL_START_WEEK_MIN_SHARE) {
    week1Monday = monday;
    week1Days = remaining;
  } else {
    weeks.push({ weekNo: 0, monday, days: remaining, kind: 'intro' });
    week1Monday = addDays(monday, 7);
    introInWeekZero = true;
  }
  for (let w = 1; w <= loadWeeks + 1; w += 1) {
    const kind: WeekKind =
      w === loadWeeks + 1 ? 'deload' : w === 1 && !introInWeekZero ? 'intro' : 'load';
    weeks.push({
      weekNo: w,
      monday: addDays(week1Monday, (w - 1) * 7),
      days: w === 1 ? week1Days : trainingDays,
      kind,
    });
  }
  return placeWeeks(weeks, sessions, 1, 0, rules);
}

/**
 * Einheiten, auf denen ein Folgeblock aufbaut: je Vorlagen-Einheit die letzte Fassung aus einer Belastungswoche
 * (sonst aus der Einstiegswoche – deren RPE ist niedriger und damit sicher), sortiert nach Vorlagen-Index.
 */
export function baseSessionsFromBlock(previous: readonly GeneratedSession[]): AdaptedSession[] {
  const pick = new Map<number, GeneratedSession>();
  const ordered = [...previous].sort((a, b) => (a.scheduled_on < b.scheduled_on ? -1 : 1));
  for (const kind of ['intro', 'load'] as const) {
    for (const s of ordered) {
      if (s.is_deload) continue;
      if ((kind === 'intro') !== s.is_intro_week) continue;
      pick.set(s.template_day_index, s);
    }
  }
  return [...pick.values()]
    .sort((a, b) => a.template_day_index - b.template_day_index)
    .map((s) => ({
      template_day_index: s.template_day_index,
      name_de: s.name_de,
      focus: s.focus,
      warmup_de: s.warmup_de,
      cooldown_de: s.cooldown_de,
      exercises: s.exercises,
    }));
}

export interface NextPlanBlockOptions {
  readonly trainingDays: readonly number[];
  readonly loadWeeks: number;
  /** AKTUELLE Sicherheitsregeln (Flags und Alter zum Start des neuen Blocks). */
  readonly rules: Pick<PlanSafetyRules, 'rpeMax' | 'excludedCautionTags' | 'cautious'>;
  readonly library: ReadonlyMap<string, Exercise>;
  readonly profile?: Pick<EquipmentProfile, 'available'>;
}

/**
 * Folgeblock (Abschnitt 5.10): aus dem Schnappschuss des bisherigen Plans (unabhängig davon, ob die Vorlage noch
 * freigegeben ist) plus aktuelle Sicherheitsregeln; beginnt am Montag nach der letzten Woche, `block_no + 1`,
 * ohne Woche 0 und ohne Einstiegswoche; die Rotation läuft ab der Einheit nach der letzten geplanten weiter.
 */
export function nextPlanBlock(
  previous: readonly GeneratedSession[],
  options: NextPlanBlockOptions,
): GeneratedSession[] {
  if (previous.length === 0) return [];
  const blockNo = Math.max(...previous.map((s) => s.block_no)) + 1;
  const lastDate = previous
    .map((s) => s.scheduled_on)
    .sort()
    .at(-1) as string;
  const monday = addDays(startOfIsoWeek(lastDate), 7);
  const base = baseSessionsFromBlock(previous)
    .map((s) => applyCurrentSafetyRules(s, options.rules, options).session)
    .filter((s) => s.exercises.length > 0);
  if (base.length === 0) return [];
  const weeks: WeekPlan[] = [];
  for (let w = 1; w <= options.loadWeeks + 1; w += 1) {
    weeks.push({
      weekNo: w,
      monday: addDays(monday, (w - 1) * 7),
      days: options.trainingDays,
      kind: w === options.loadWeeks + 1 ? 'deload' : 'load',
    });
  }
  // Rotation ab der Vorlagen-Einheit NACH der letzten geplanten Einheit weiterzählen.
  const last = [...previous].sort((a, b) => (a.scheduled_on < b.scheduled_on ? -1 : 1)).at(-1);
  const lastIndex = base.findIndex((s) => s.template_day_index === last?.template_day_index);
  return placeWeeks(weeks, base, blockNo, lastIndex + 1, options.rules);
}

/**
 * Zwei Einheiten an aufeinanderfolgenden Tagen mit Ganzkörper bzw. gleichem Schwerpunkt (Hinweis
 * `back_to_back_sessions`, mind. 48 h Erholung für dieselben Muskeln).
 */
export function hasBackToBackSessions(
  sessions: readonly Pick<GeneratedSession, 'scheduled_on' | 'focus'>[],
): boolean {
  const sorted = [...sessions].sort((a, b) => (a.scheduled_on < b.scheduled_on ? -1 : 1));
  for (let i = 1; i < sorted.length; i += 1) {
    const a = sorted[i - 1] as Pick<GeneratedSession, 'scheduled_on' | 'focus'>;
    const b = sorted[i] as Pick<GeneratedSession, 'scheduled_on' | 'focus'>;
    if (addDays(a.scheduled_on, 1) === b.scheduled_on) {
      if (a.focus === 'full_body' || b.focus === 'full_body' || a.focus === b.focus) {
        return true;
      }
    }
  }
  return false;
}
