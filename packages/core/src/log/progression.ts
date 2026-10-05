import { daysBetween } from '../dates';
import {
  CONSERVATIVE_PLAN_RULES,
  DELOAD_DOSAGE,
  LOAD_PROGRESSION,
  RETURN_AFTER_PAUSE,
  TEMPLATE_DOSAGE_LIMITS,
} from '../constants';
import { clampRpe } from '../plan/adapt';
import {
  type IncrementKind,
  nextLoad,
  type PerformedSession,
  type ProgressionState,
  type ProgressionStep,
  snapToAvailableWeight,
} from '../plan/loads';
import {
  calibrateFromSets,
  heaviestCompletedSet,
  initialProgress,
  progressFromStartWeight,
} from './calibration';
import { needsLighterConfirmation, needsWeightConfirmation } from './plausibility';
import type { ExerciseLogEntry, ExerciseProgress, ProgressionContext } from './types';

/**
 * Progression aus dem Tagebuch (docs/PLAN-PHASE-4.md Abschnitt 5.1) – berechnet, nie in den Plan geschrieben.
 *
 * - Gespeichert wird ein ROHER Zustand `state_*` (`ProgressResult.progress`): ortsunabhängig, nie auf ein angezeigtes
 *   (gerundetes) Gewicht gesenkt; nur ein Gewichtsschritt setzt einen neuen Rohwert (W4, Wächter Etappe A B1).
 * - Heute wirksam ist `ProgressResult.effective`: W = abgerundete Stufe des Orts. W = Rohwert → es zählen nur
 *   Einträge, deren Ort das Rohgewicht zeigen konnte (leichtere Orte werden übersprungen wie die Erholungswoche).
 *   W < Rohwert → Fortschritt nur aus Einträgen mit angezeigtem Gewicht W; er gilt nur für diesen Ort.
 * - nextLoad() bekommt den neuesten zählenden Eintrag und – nur wenn er mit DEMSELBEN Zustand trainiert wurde – den
 *   davor („zweimal in Folge“). Jede Einheit wird gegen ihre eigene geplante Satzzahl geprüft; Gewichtssprung und
 *   Zusatzsatz nur, wenn eine der beiden die Vorlagen-Satzzahl hatte (W7, in nextLoad()).
 * - Nicht zählend: Einstiegswoche, Erholungswoche, Wiedereinstieg nach Pause (RETURN_AFTER_PAUSE). Ohne Zustand
 *   (erster Eintrag – auch in der Einstiegswoche, R1 – oder nach Widerruf neutralisiert) wird aus den Ist-Werten
 *   kalibriert (calibration.ts).
 * - Selbst gewähltes Gewicht (Frage 5): alle Arbeitssätze gleich und anders als die ANGEZEIGTE Vorgabe → neuer
 *   Ausgangspunkt ohne zusätzlichen Sprung; schwerer über 10 % bzw. deutlich leichter nur mit Bestätigung (W5).
 * - Nie automatisch weniger Gewicht (Gratis-Grenze; Live-Anpassung ist Phase 4b).
 */

const EPS = 1e-9;

export type ProgressSource = 'none' | 'start_weight' | 'calibration' | 'logs';

export type ProgressHint =
  | 'harder_variant'
  | 'stronger_band'
  | 'no_heavier_weight'
  /** Erster Eintrag über der absoluten Schwelle ohne Bestätigung – nicht übernommen. */
  | 'confirm_weight';

export interface ProgressResult {
  /**
   * ROHER Zustand für die nächste Einheit (ortsunabhängig) – wird als `state_*` gespeichert und nie auf ein
   * angezeigtes (gerundetes) Gewicht gesenkt (Wächter Etappe A, B1).
   */
  readonly progress: ExerciseProgress;
  /**
   * Wirksamer Zustand am HEUTIGEN Ort: gleich `progress`, wenn der Ort das Rohgewicht zeigen kann; sonst
   * Gewicht W = abgerundete Stufe mit dem Wdh./Zusatzsatz-Fortschritt, der an diesem Gewicht erreicht wurde.
   * Daraus rechnet prescriptionForDisplay().
   */
  readonly effective: ExerciseProgress;
  readonly source: ProgressSource;
  /** Angewandter Schritt aus nextLoad() (null bei Kalibrierung, Startgewicht, eigenem Gewicht, ohne Verlauf). */
  readonly step: ProgressionStep | null;
  readonly hint: ProgressHint | null;
  /** RPE-Ziel der ERSTEN Einheit nach einem großen Gewichtssprung (sonst null). */
  readonly firstSessionRpeTarget: number | null;
  /** Selbst gewähltes Gewicht übernommen (Anzeige „dein Gewicht vom letzten Mal“). */
  readonly selfChosenWeight: boolean;
  /**
   * Wiedereinstieg nach Pause (RETURN_AFTER_PAUSE): mehr als 28 Tage ohne Training an mindestens dem heute
   * gezeigten Gewicht W (`effective`; auch am gerundeten Ort). Nur Anzeige (prescriptionForDisplay): `effective`
   * ×0,9, reps_min, kein Zusatzsatz, RPE −1; der Eintrag zählt nicht.
   */
  readonly returnAfterPause: boolean;
}

export interface ProgressOptions {
  /** Heutiges Datum (ISO, Pflicht) – für den Wiedereinstieg nach Pause (RETURN_AFTER_PAUSE). */
  readonly today: string;
  /** Eigenes Startgewicht (exercise_start_weights) – gilt nur ohne Eintrag. */
  readonly startWeightKg?: number | null;
  /** Startgewicht über der absoluten Schwelle bestätigt. */
  readonly startWeightConfirmed?: boolean;
}

/**
 * Zählt der Eintrag für „zweimal in Folge“ und als Zustands-Grundlage? Nicht: Einstiegswoche, Erholungswoche,
 * Wiedereinstieg nach Pause.
 */
export function isCountingEntry(
  entry: Pick<ExerciseLogEntry, 'isIntroWeek' | 'isDeload'> & { readonly isReturn?: boolean },
) {
  return !entry.isIntroWeek && !entry.isDeload && !(entry.isReturn ?? false);
}

function compareEntries(a: ExerciseLogEntry, b: ExerciseLogEntry): number {
  if (a.performedOn !== b.performedOn) return a.performedOn < b.performedOn ? -1 : 1;
  if (a.loggedAt !== b.loggedAt) return a.loggedAt < b.loggedAt ? -1 : 1;
  return 0;
}

/** Alle Einträge dieser Übung mit Sätzen, älteste zuerst (Reihenfolge der Eingabe egal – zwei Geräte). */
export function entriesForExercise(
  exerciseId: string,
  entries: readonly ExerciseLogEntry[],
): ExerciseLogEntry[] {
  return entries
    .filter((e) => e.exerciseId === exerciseId && e.status !== 'skipped')
    .sort(compareEntries);
}

function needsCalibration(state: ExerciseProgress | null, ctx: ProgressionContext): boolean {
  if (state === null) return true;
  if (ctx.loadType === 'weight') return state.weightKg === null;
  if (ctx.loadType === 'time') return state.durationS === null;
  return state.targetReps === null;
}

function sameProgress(a: ExerciseProgress | null, b: ExerciseProgress | null): boolean {
  if (a === null || b === null) return false;
  return (
    a.weightKg === b.weightKg &&
    a.targetReps === b.targetReps &&
    a.extraSet === b.extraSet &&
    a.durationS === b.durationS
  );
}

function repsCap(ctx: ProgressionContext): number | null {
  if (ctx.repsMax === null && ctx.repsMin === null) return null;
  const max = ctx.repsMax ?? ctx.repsMin ?? TEMPLATE_DOSAGE_LIMITS.reps.min;
  return Math.min(max + LOAD_PROGRESSION.extraRepsBuffer, TEMPLATE_DOSAGE_LIMITS.reps.max);
}

/** Ziel-Wdh. in [reps_min, reps_max + 2] (≤ 30) geklemmt – der Bereich des AKTUELLEN Plans. */
export function clampTargetReps(targetReps: number | null, ctx: ProgressionContext): number | null {
  if (ctx.repsMin === null) return null;
  const cap = repsCap(ctx) ?? ctx.repsMin;
  return Math.min(cap, Math.max(ctx.repsMin, targetReps ?? ctx.repsMin));
}

function toState(progress: ExerciseProgress, ctx: ProgressionContext): ProgressionState {
  return {
    loadType: ctx.loadType,
    repsMin: ctx.repsMin,
    repsMax: ctx.repsMax,
    targetReps: clampTargetReps(progress.targetReps, ctx),
    templateSets: ctx.templateSets,
    sets: ctx.templateSets + (progress.extraSet ? LOAD_PROGRESSION.extraSets : 0),
    durationS: progress.durationS,
    rpeTarget: ctx.rpeTarget,
    weightKg: progress.weightKg,
  };
}

function toPerformed(
  entry: ExerciseLogEntry,
  progress: ExerciseProgress,
  ctx: ProgressionContext,
): PerformedSession {
  // Mindestgewicht: der Zustand – oder die ANGEZEIGTE Vorgabe, wenn sie (Orts-Rundung) darunter lag. Sonst stünde
  // die Progression still, sobald der rohe Zustand (z. B. kalibriert 21 kg) nicht auf einer Stufe liegt (20 kg).
  const minWeight =
    ctx.loadType !== 'weight' || progress.weightKg === null
      ? null
      : entry.targetWeightKg !== null
        ? Math.min(progress.weightKg, entry.targetWeightKg)
        : progress.weightKg;
  return {
    plannedSets: entry.targetSets ?? Math.max(1, entry.sets.length),
    rpeTarget: entry.targetRpe ?? CONSERVATIVE_PLAN_RULES.rpeMax,
    sets: entry.sets.map((set) => {
      const heavyEnough =
        minWeight === null || (set.weightKg !== null && set.weightKg >= minWeight - EPS);
      const ok = set.done && heavyEnough;
      return { reps: ok ? set.reps : 0, durationS: ok ? set.durationS : 0, rpe: set.rpe };
    }),
  };
}

function applyStep(progress: ExerciseProgress, step: ProgressionStep): ExerciseProgress {
  switch (step.kind) {
    case 'add_rep':
      return { ...progress, targetReps: step.targetReps };
    case 'add_set':
      return { ...progress, extraSet: true };
    case 'increase_weight':
      return { ...progress, weightKg: step.weightKg, targetReps: step.targetReps, extraSet: false };
    case 'increase_duration':
      return { ...progress, durationS: step.durationS };
    default:
      return progress;
  }
}

function hintOf(step: ProgressionStep): ProgressHint | null {
  return step.kind === 'harder_variant' ||
    step.kind === 'stronger_band' ||
    step.kind === 'no_heavier_weight'
    ? step.kind
    : null;
}

/**
 * Selbst gewähltes Gewicht des Eintrags (alle geschafften Arbeitssätze gleich, abweichend von der ANGEZEIGTEN
 * Vorgabe – die Orts-Rundung selbst ist kein eigener Wunsch), das als neuer Ausgangspunkt gilt – oder null.
 * Schwerer: über 10 % von max(Zustand, Anzeige) nur mit Bestätigung (W5). Deutlich leichter (unter 50 % des
 * Zustands oder unter der kleinsten Stufe): nur mit Bestätigung („Absichtlich deutlich leichter?“).
 */
function selfChosenWeight(
  entry: ExerciseLogEntry,
  base: ExerciseProgress,
  steps: readonly number[],
): number | null {
  if (base.weightKg === null) return null;
  const working = entry.sets.filter(
    (s) => s.done && s.weightKg !== null && s.weightKg > 0 && (s.reps ?? 0) > 0,
  );
  if (working.length === 0) return null;
  const weight = working[0]?.weightKg as number;
  if (working.some((s) => Math.abs((s.weightKg as number) - weight) > EPS)) return null;
  const shown = entry.targetWeightKg ?? base.weightKg;
  if (Math.abs(weight - shown) <= EPS) return null;
  if (weight < shown) {
    return entry.weightConfirmed || !needsLighterConfirmation(weight, base.weightKg, steps)
      ? weight
      : null;
  }
  return entry.weightConfirmed ||
    !needsWeightConfirmation(weight, Math.max(base.weightKg, shown), 'none')
    ? weight
    : null;
}

/**
 * Gewicht, an dem ein Eintrag trainiert hat (Bezug der Pause): das angezeigte Gewicht – ein anderes gestemmtes nur,
 * wenn es als eigenes Gewicht gilt (alle geschafften Arbeitssätze einheitlich und plausibel bzw. bestätigt, wie
 * selfChosenWeight()). Tippfehler (200 kg unbestätigt) und einzelne schwerere Sätze zählen nicht. Ohne angezeigtes
 * Gewicht (erster Eintrag): der schwerste geschaffte Satz, wenn die Kalibrierung ihn annimmt (unter der absoluten
 * Schwelle oder bestätigt), sonst null.
 */
function trainedWeight(entry: ExerciseLogEntry, kind: IncrementKind): number | null {
  const shown = entry.targetWeightKg;
  if (shown === null) {
    const heaviest = heaviestCompletedSet(entry.sets);
    if (heaviest === null) return null;
    return entry.weightConfirmed || !needsWeightConfirmation(heaviest.weightKg, null, kind)
      ? heaviest.weightKg
      : null;
  }
  const base: ExerciseProgress = {
    weightKg: entry.state?.weightKg ?? shown,
    targetReps: null,
    extraSet: false,
    durationS: null,
  };
  return selfChosenWeight(entry, base, []) ?? shown;
}

/**
 * Wiedereinstieg nach Pause (RETURN_AFTER_PAUSE): Pause = mehr als 28 Tage ohne Training an mindestens dem HEUTE
 * gezeigten Gewicht `shownWeightKg` (W). Die Uhr setzen zurück: jede Wiedereinstiegs-Einheit (unabhängig vom
 * Gewicht) und jeder zählende Eintrag, dessen trainiertes Gewicht (trainedWeight(): angezeigt bzw. bestätigtes oder
 * plausibles, einheitliches eigenes Gewicht) ≥ W ist; ohne Gewichtsbezug (`shownWeightKg` null, Übungen ohne
 * Zusatzgewicht) jeder zählende Eintrag. Gibt es noch keinen zählenden Eintrag, gilt der neueste
 * Eintrag überhaupt (z. B. Einstiegswoche); ganz ohne Eintrag kein Wiedereinstieg (dann greift die Einstiegswoche).
 */
export function isReturnAfterPause(
  entries: readonly ExerciseLogEntry[],
  today: string,
  shownWeightKg: number | null,
  incrementKind: IncrementKind = 'none',
): boolean {
  if (entries.length === 0) return false;
  const counting = entries.filter(isCountingEntry);
  const resets =
    counting.length === 0
      ? entries
      : entries.filter(
          (e) =>
            (e.isReturn ?? false) ||
            (isCountingEntry(e) &&
              (shownWeightKg === null ||
                (trainedWeight(e, incrementKind) ?? -Infinity) >= shownWeightKg - EPS)),
        );
  const last = resets
    .map((e) => e.performedOn)
    .sort()
    .at(-1);
  return last === undefined || daysBetween(last, today) > RETURN_AFTER_PAUSE.pauseDays;
}

/** Konnte der Ort beim Eintrag das Rohgewicht zeigen (angezeigt ≥ Rohwert)? Sonst: Orts-Rundung nach unten. */
function isFullEntry(entry: ExerciseLogEntry): boolean {
  const raw = entry.state?.weightKg ?? null;
  return raw === null || entry.targetWeightKg === null || entry.targetWeightKg >= raw - EPS;
}

const sameWeight = (a: number | null, b: number | null) =>
  a !== null && b !== null && Math.abs(a - b) <= EPS;

/** Was an einem Eintrag angezeigt wurde, als Zustand (Gewicht, Wdh., Zusatzsatz) – für gerundete Orte. */
function shownProgress(entry: ExerciseLogEntry, fallback: ExerciseProgress): ExerciseProgress {
  return {
    weightKg: entry.targetWeightKg,
    targetReps: entry.targetReps ?? fallback.targetReps,
    extraSet: entry.targetExtraSet ?? false,
    durationS: fallback.durationS,
  };
}

function stepOptions(ctx: ProgressionContext) {
  return {
    incrementKind: ctx.incrementKind,
    ...(ctx.steps ? { steps: ctx.steps } : {}),
    allowExtraSet: ctx.allowExtraSet ?? true,
  };
}

/**
 * Fortschritt an einem gerundeten Gewicht `weight` (Ort zeigt weniger als das Rohgewicht): nur aus Einträgen mit
 * genau diesem angezeigten Gewicht; ohne solche Einträge Start mit den Wdh. des Rohzustands. Gilt nur für diesen Ort.
 */
function progressAtWeight(
  weight: number,
  counting: readonly ExerciseLogEntry[],
  raw: ExerciseProgress,
  ctx: ProgressionContext,
): { progress: ExerciseProgress; step: ProgressionStep | null } {
  const atWeight = counting.filter((e) => sameWeight(e.targetWeightKg, weight));
  const anchor = atWeight.at(-1);
  if (!anchor) return { progress: { ...raw, weightKg: weight, extraSet: false }, step: null };
  const base = shownProgress(anchor, raw);
  const previous = atWeight.at(-2);
  const history = [
    ...(previous && sameProgress(shownProgress(previous, raw), base) ? [previous] : []),
    anchor,
  ].map((e) => toPerformed(e, base, ctx));
  const step = nextLoad(toState(base, ctx), history, stepOptions(ctx));
  return { progress: applyStep(base, step), step };
}

function firstRpe(step: ProgressionStep | null, ctx: ProgressionContext): number | null {
  return step?.kind === 'increase_weight' && step.firstSessionRpeTarget < ctx.rpeTarget
    ? step.firstSessionRpeTarget
    : null;
}

/**
 * Zustand für die nächste Einheit einer Übung aus den Einträgen (beliebige Reihenfolge, auch anderer Übungen).
 * `ctx` beschreibt die heutige Vorgabe aus dem aktuellen Plan (Wdh.-Bereich, Vorlagen-Sätze, Stufen des HEUTIGEN
 * Orts).
 *
 * Orts-Rundung (Wächter Etappe A, B1): Der gespeicherte Rohwert wird nie auf ein angezeigtes Gewicht gesenkt.
 * Heute wirksam ist W = snapToAvailableWeight(Rohwert, Stufen am heutigen Ort).
 * - W = Rohwert: Es zählen nur Einträge, deren angezeigtes Gewicht den Rohwert erreichte; leichtere (z. B. zu
 *   Hause) werden übersprungen wie die Erholungswoche – weiter mit dem letzten Stand am vollen Gewicht.
 * - W < Rohwert: gerechnet wird mit Basis W und nur Einträgen mit angezeigtem Gewicht W; der Wdh./Zusatzsatz-
 *   Fortschritt dort gilt nur für diesen Ort. Ein Gewichtsschritt von W (normal über den Puffer), der über dem
 *   Rohwert liegt, wird neuer Rohwert (kalibriert 21 → angezeigt 20 → mit Puffer 22,5 → Rohwert 22,5).
 */
export function progressFromLogs(
  exerciseId: string,
  entries: readonly ExerciseLogEntry[],
  ctx: ProgressionContext,
  options: ProgressOptions,
): ProgressResult {
  const own = entriesForExercise(exerciseId, entries);
  const steps = ctx.steps ?? [];

  /** Ergebnis mit wirksamem Zustand am heutigen Ort. */
  const finish = (
    rawInput: ExerciseProgress,
    source: ProgressSource,
    extra: Partial<Omit<ProgressResult, 'progress' | 'effective' | 'source'>> = {},
  ): ProgressResult => {
    let raw = rawInput;
    let shown: ExerciseProgress | null = null;
    let step = extra.step ?? null;
    let firstSessionRpeTarget = extra.firstSessionRpeTarget ?? null;
    let hint = extra.hint ?? null;
    if (ctx.loadType === 'weight' && raw.weightKg !== null) {
      const counting = own.filter(isCountingEntry);
      const latest = counting.at(-1);
      // Gewichtsschritt aus dem Fortschritt an einem gerundeten Gewicht über den Rohwert → neuer Rohwert.
      const raise = (at: { progress: ExerciseProgress; step: ProgressionStep | null }) => {
        const current = raw.weightKg as number;
        if (at.step?.kind !== 'increase_weight' || at.step.weightKg <= current + EPS) return false;
        raw = {
          ...raw,
          weightKg: at.step.weightKg,
          targetReps: at.step.targetReps,
          extraSet: false,
        };
        step = at.step;
        hint = null;
        firstSessionRpeTarget = firstRpe(at.step, ctx);
        return true;
      };
      if (latest && !isFullEntry(latest) && latest.targetWeightKg !== null) {
        raise(progressAtWeight(latest.targetWeightKg, counting, raw, ctx));
      }
      const w = snapToAvailableWeight(raw.weightKg as number, steps);
      if (w !== null && w < (raw.weightKg as number) - EPS) {
        const at = progressAtWeight(w, counting, raw, ctx);
        if (!raise(at)) {
          shown = at.progress;
          step = at.step;
          hint = at.step ? hintOf(at.step) : null;
          firstSessionRpeTarget = firstRpe(at.step, ctx);
        }
      }
    }
    const effective = shown ?? raw;
    // Bezug der Pause: heute gezeigtes Gewicht W – nach einem Gewichtsschritt das Gewicht davor (sonst sähe der
    // erste Tag am neuen Gewicht wie eine Pause aus).
    const pauseReference = (
      eff: ExerciseProgress,
      appliedStep: ProgressionStep | null,
    ): number | null => {
      if (ctx.loadType !== 'weight' || eff.weightKg === null) return null;
      const w = snapToAvailableWeight(eff.weightKg, steps) ?? eff.weightKg;
      const before = own.filter(isCountingEntry).at(-1)?.targetWeightKg ?? null;
      return appliedStep?.kind === 'increase_weight' && before !== null ? Math.min(w, before) : w;
    };
    return {
      progress: raw,
      effective,
      source,
      step,
      hint,
      firstSessionRpeTarget,
      selfChosenWeight: extra.selfChosenWeight ?? false,
      // Pause = 28 Tage ohne Training an mindestens dem heute gezeigten Gewicht (×0,9 dann auf `effective`).
      returnAfterPause: isReturnAfterPause(
        own,
        options.today,
        pauseReference(effective, step),
        ctx.incrementKind,
      ),
    };
  };

  if (own.length === 0) {
    if (options.startWeightKg != null) {
      const start = progressFromStartWeight(
        options.startWeightKg,
        options.startWeightConfirmed ?? false,
        ctx,
      );
      if (start.kind === 'ok') return finish(start.progress, 'start_weight');
      if (start.kind === 'needs_confirmation') {
        return finish(initialProgress(ctx), 'none', { hint: 'confirm_weight' });
      }
    }
    return finish(initialProgress(ctx), 'none');
  }

  const counting = own.filter(isCountingEntry);
  const latest = counting.at(-1) ?? (own.at(-1) as ExerciseLogEntry);

  if (needsCalibration(latest.state, ctx)) {
    const calibrated = calibrateFromSets(latest.sets, latest.weightConfirmed, ctx);
    if (calibrated.kind === 'calibrated') return finish(calibrated.progress, 'calibration');
    const fallback = latest.state ?? initialProgress(ctx);
    return finish(fallback, 'none', {
      hint: calibrated.kind === 'needs_confirmation' ? 'confirm_weight' : null,
    });
  }
  const latestState = latest.state as ExerciseProgress;
  // Nur Einstiegs-/Erholungswoche bisher: Zustand bleibt unverändert.
  if (!isCountingEntry(latest)) return finish(latestState, 'logs');

  if (ctx.loadType === 'weight') {
    const chosen = selfChosenWeight(latest, latestState, steps);
    if (chosen !== null) {
      return finish({ ...latestState, weightKg: chosen }, 'logs', { selfChosenWeight: true });
    }
  }

  // Rohwert: nur aus Einträgen, deren Ort das Rohgewicht zeigen konnte. War der neueste zählende Eintrag gerundet
  // (z. B. zu Hause), gilt sein gespeicherter Rohwert unverändert (übersprungen wie eine Erholungswoche).
  if (!isFullEntry(latest)) return finish(latestState, 'logs');
  const full = counting.filter(isFullEntry);
  const previous = full.at(-2);
  const history = [
    ...(previous && sameProgress(previous.state, latestState) ? [previous] : []),
    latest,
  ].map((e) => toPerformed(e, latestState, ctx));
  const step = nextLoad(toState(latestState, ctx), history, stepOptions(ctx));
  return finish(applyStep(latestState, step), 'logs', {
    step,
    hint: hintOf(step),
    firstSessionRpeTarget: firstRpe(step, ctx),
  });
}

// ---------------------------------------------------------------------------------------------------------
// Vorgabe für heute
// ---------------------------------------------------------------------------------------------------------

/** Die geplante Übung des heutigen Termins (planned_exercises, nach den Sicherheitsregeln). */
export interface PlannedDosage {
  readonly sets: number;
  readonly reps_min: number | null;
  readonly reps_max: number | null;
  readonly duration_s: number | null;
  readonly rpe_target: number;
}

export interface DisplayOptions {
  readonly isDeload: boolean;
  /** Stufen am Ort der Einheit (Kurzhanteln/Kettlebells bzw. barbellLoadSteps()); leer = 0,5-kg-Raster. */
  readonly steps?: readonly number[];
  /** false = Zusatzsatz würde die Wochensatz-Obergrenze (V9) überschreiten. */
  readonly allowExtraSet?: boolean;
  /** Aktueller RPE-Deckel (Sicherheitsregeln). prepareSessionForDisplay() wendet ihn zusätzlich an. */
  readonly rpeMax?: number;
}

export interface Prescription {
  readonly sets: number;
  /** Zusatzsatz aus dem Puffer ist enthalten. */
  readonly extraSet: boolean;
  /** Wiedereinstieg nach Pause (zählt nicht für die Progression, wird im Eintrag vermerkt). */
  readonly isReturn: boolean;
  readonly targetReps: number | null;
  /** Auf die Stufen des Orts ABGERUNDET; null = noch kein Gewicht bzw. keine passende Stufe. */
  readonly weightKg: number | null;
  /** Zustand hat ein Gewicht, aber keine Stufe am Ort ist leicht genug → „leichteste Stufe wählen“. */
  readonly chooseLightest: boolean;
  readonly durationS: number | null;
  readonly rpeTarget: number;
}

/**
 * Vorgabe für heute aus Plan-Termin und Zustand: Sätze der Fassung (+1 Zusatzsatz nur außerhalb der
 * Erholungswoche und im Rahmen von V9, höchstens 6), Wdh.-Ziel in [reps_min, reps_max + 2] geklemmt, Gewicht ×0,9
 * in der Erholungswoche und auf die Stufen des Orts abgerundet, RPE −1 in der ersten Einheit nach großem Sprung.
 * Danach wendet die App prepareSessionForDisplay() mit den aktuellen Sicherheitsregeln an – die strengste Regel
 * gewinnt; dieses Ergebnis hebt das RPE nie über die Vorgabe des Plans.
 */
export function prescriptionForDisplay(
  planned: PlannedDosage,
  progress: Pick<ProgressResult, 'progress' | 'firstSessionRpeTarget'> & {
    readonly effective?: ExerciseProgress;
    readonly returnAfterPause?: boolean;
  },
  options: DisplayOptions,
): Prescription {
  const state = progress.effective ?? progress.progress;
  // Wiedereinstieg nach Pause (nur Anzeige): ×0,9, reps_min, kein Zusatzsatz, RPE −1. In der Erholungswoche
  // gewinnt je Größe die strengere Regel – nie doppelt ×0,9 bzw. RPE −2 −1.
  const isReturn = progress.returnAfterPause ?? false;
  const extra =
    state.extraSet && !options.isDeload && !isReturn && (options.allowExtraSet ?? true)
      ? LOAD_PROGRESSION.extraSets
      : 0;
  const sets = Math.min(TEMPLATE_DOSAGE_LIMITS.sets.max, planned.sets + extra);
  let targetReps: number | null = null;
  if (planned.reps_min !== null) {
    const cap = Math.min(
      (planned.reps_max ?? planned.reps_min) + LOAD_PROGRESSION.extraRepsBuffer,
      TEMPLATE_DOSAGE_LIMITS.reps.max,
    );
    targetReps = isReturn
      ? planned.reps_min
      : Math.min(cap, Math.max(planned.reps_min, state.targetReps ?? planned.reps_min));
  }
  let weightKg: number | null = null;
  let chooseLightest = false;
  if (state.weightKg !== null) {
    const factor = Math.min(
      options.isDeload ? DELOAD_DOSAGE.loadFactor : 1,
      isReturn ? RETURN_AFTER_PAUSE.loadFactor : 1,
    );
    weightKg = snapToAvailableWeight(state.weightKg * factor, options.steps ?? []);
    chooseLightest = weightKg === null;
  }
  let durationS: number | null = null;
  if (planned.duration_s !== null) {
    durationS =
      options.isDeload || isReturn
        ? planned.duration_s
        : Math.min(TEMPLATE_DOSAGE_LIMITS.durationS.max, state.durationS ?? planned.duration_s);
  }
  let rpeTarget = planned.rpe_target;
  if (progress.firstSessionRpeTarget !== null && !options.isDeload) {
    rpeTarget = Math.min(rpeTarget, progress.firstSessionRpeTarget);
  }
  if (isReturn && !options.isDeload) {
    // Erholungswoche hat schon RPE −2 (strenger) – dort kein zusätzlicher Abschlag.
    rpeTarget = Math.max(
      TEMPLATE_DOSAGE_LIMITS.rpe.min,
      Math.min(rpeTarget, planned.rpe_target - RETURN_AFTER_PAUSE.rpeReduction),
    );
  }
  if (options.rpeMax !== undefined) rpeTarget = clampRpe(rpeTarget, options.rpeMax);
  return {
    sets,
    extraSet: extra > 0,
    targetReps,
    weightKg,
    chooseLightest,
    durationS,
    rpeTarget,
    isReturn,
  };
}

/**
 * Zustand, der mit dem Eintrag dieser Einheit als `state_*` gespeichert wird (= Zustand VOR der Einheit). Bei
 * `alternative` ist das der Zustand der ALTERNATIV-Übung aus deren eigenem Verlauf (R2) – nie der der geplanten
 * Übung; ohne eigenen Verlauf null (dann wird später kalibriert).
 */
export function stateToStore(result: ProgressResult): ExerciseProgress | null {
  return result.source === 'none' ? null : result.progress;
}

/**
 * Baut den Eintrag einer Übung so, wie die App ihn speichert: Zustand VOR der Einheit (stateToStore) und die
 * angezeigte Vorgabe als Schnappschuss. Bei `alternative` müssen `progress`/`prescription` die der
 * ALTERNATIV-Übung sein (deren eigener Verlauf, deren angezeigte Vorgabe) – nie die der geplanten Übung (R2).
 */
export function buildExerciseLogEntry(params: {
  readonly exerciseId: string;
  readonly performedOn: string;
  readonly loggedAt: string;
  readonly status: ExerciseLogEntry['status'];
  readonly loadType: ExerciseLogEntry['loadType'];
  readonly isIntroWeek: boolean;
  readonly isDeload: boolean;
  readonly progress: ProgressResult | null;
  readonly prescription: Prescription | null;
  readonly weightConfirmed?: boolean;
  readonly sets: ExerciseLogEntry['sets'];
}): ExerciseLogEntry {
  const { prescription } = params;
  return {
    exerciseId: params.exerciseId,
    performedOn: params.performedOn,
    loggedAt: params.loggedAt,
    status: params.status,
    loadType: params.loadType,
    isIntroWeek: params.isIntroWeek,
    isDeload: params.isDeload,
    targetSets: prescription?.sets ?? null,
    targetWeightKg: prescription?.weightKg ?? null,
    targetReps: prescription?.targetReps ?? null,
    targetExtraSet: prescription ? prescription.extraSet : null,
    isReturn: prescription?.isReturn ?? false,
    targetRpe: prescription?.rpeTarget ?? null,
    state: params.progress ? stateToStore(params.progress) : null,
    weightConfirmed: params.weightConfirmed ?? false,
    sets: params.status === 'skipped' ? [] : params.sets,
  };
}
