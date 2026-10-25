import { z } from 'zod';

import { isoDateSchema } from './age';
import { WIDGET_SNAPSHOT } from './constants';
import { trainingToday } from './dashboard';
import { addDays } from './dates';
import { calorieRing } from './nutrition/day-ring';
import type { StoredSession } from './plan/view';
import { stepProgress } from './wearables/steps';

/**
 * Widget auf dem Startbildschirm (docs/PLAN-WIDGET.md, Gründer-Entscheidung 25.10.2026): Training heute (Name oder
 * Ruhetag), Schritte-Ring und „kcal übrig“. Die App schreibt beim Öffnen, beim Wechsel in den Hintergrund und nach
 * jedem Abgleich einen kleinen Stand (`buildWidgetSnapshot`); das Widget zeigt ihn an (`widgetView`).
 *
 * Datensparsam (CLAUDE.md, DSGVO Art. 9): Der Stand enthält NUR Trainingsnamen der nächsten 7 Tage, die heutigen
 * Schritte mit Ziel und die kcal-Zahl „übrig“ bzw. „zu viel“ – kein Gewicht, kein Zyklus, keine Namen von
 * Beschwerden, kein Gesundheits-Check, kein Zielgewicht, keine Mahlzeiten. Ist das Widget ausgeschaltet (Standard),
 * gibt es GAR keinen Stand. Schritte nur mit gültiger Einwilligung und verbundener Uhr, kcal nur mit „Kalorienzahlen
 * anzeigen“ (nicht in Schwangerschaft/Stillzeit) und gültiger Einwilligung Gesundheitsdaten – exakt wie die Kacheln
 * der Übersicht; die App gibt diese Freigaben mit, hier werden sie ein zweites Mal geprüft.
 */

/** Training eines Tages im Widget. */
export type WidgetTraining =
  | { readonly kind: 'session'; readonly name: string; readonly done: boolean }
  | { readonly kind: 'rest' }
  | { readonly kind: 'no_plan' };

/** Gespeicherter Stand (Aufbau `WIDGET_SNAPSHOT.version`). */
export interface WidgetSnapshot {
  readonly v: typeof WIDGET_SNAPSHOT.version;
  /** Zeitpunkt des Schreibens (ms seit 1970). */
  readonly savedAt: number;
  /** Tag der App beim Schreiben (Gerätezeit, ISO) – Schritte und kcal gelten nur für diesen Tag. */
  readonly date: string;
  /** Training von `date` bis `date + days − 1`, aufsteigend. */
  readonly days: readonly { readonly date: string; readonly training: WidgetTraining }[];
  readonly steps: { readonly steps: number; readonly goal: number } | null;
  readonly kcal: { readonly state: 'open' | 'reached' | 'over'; readonly value: number } | null;
}

export interface WidgetSnapshotInput {
  /** Schalter „Widget auf dem Startbildschirm“ (Standard aus). */
  readonly enabled: boolean;
  readonly nowMs: number;
  /** Heute (Gerätezeit, ISO). */
  readonly today: string;
  /** Einheiten des aktiven Plans; null = kein aktiver Plan. */
  readonly sessions: readonly StoredSession[] | null;
  /** Angezeigte (sichere) Namen je Einheit wie in „Heute“ (z. B. „Lockerer Dauerlauf“ statt „Intervalle“). */
  readonly displayNames?: ReadonlyMap<string, string>;
  readonly steps: {
    /** Einwilligungen gültig und Uhr verbunden (wie die Kachel „Schritte“). */
    readonly allowed: boolean;
    /** Heutige Schritte der Uhr; null = heute noch kein Wert. */
    readonly today: number | null;
    readonly goal: number;
  };
  readonly kcal: {
    /** „Kalorienzahlen anzeigen“ an UND keine Schwangerschaft/Stillzeit in der Woche (`showNumbers` der App). */
    readonly showNumbers: boolean;
    /** Einwilligung Gesundheitsdaten gültig (Ernährungstagebuch). */
    readonly consentValid: boolean;
    /** Tagesziel; null = kein Ziel berechenbar. */
    readonly targetKcal: number | null;
    /** Heute gegessen laut Tagebuch; null = keine Zahl (z. B. Einträge ohne Nährwerte). */
    readonly eatenKcal: number | null;
  };
}

/** Name kürzen (Platz im Widget), Leerraum vereinheitlichen. */
export function widgetName(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim();
  const max = WIDGET_SNAPSHOT.maxNameLength;
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

function trainingOn(
  sessions: readonly StoredSession[] | null,
  date: string,
  names: ReadonlyMap<string, string> | undefined,
): WidgetTraining {
  const result = trainingToday(sessions, date);
  if (result.kind === 'no_plan') return { kind: 'no_plan' };
  if (result.kind === 'rest') return { kind: 'rest' };
  const name = widgetName(names?.get(result.session.id) ?? result.session.name_de);
  return { kind: 'session', name, done: result.done };
}

/**
 * Stand für das Widget. `null` = Widget aus → nichts speichern (vorhandenen Stand löschen).
 */
export function buildWidgetSnapshot(input: WidgetSnapshotInput): WidgetSnapshot | null {
  if (!input.enabled) return null;
  const today = isoDateSchema.parse(input.today);
  const days = Array.from({ length: WIDGET_SNAPSHOT.days }, (_, i) => {
    const date = addDays(today, i);
    return { date, training: trainingOn(input.sessions, date, input.displayNames) };
  });

  const stepsIn = input.steps;
  const steps =
    stepsIn.allowed && stepsIn.today !== null
      ? (() => {
          const progress = stepProgress({ steps: stepsIn.today, goal: stepsIn.goal });
          return { steps: progress.steps, goal: progress.goal };
        })()
      : null;

  const k = input.kcal;
  let kcal: WidgetSnapshot['kcal'] = null;
  if (k.showNumbers && k.consentValid && k.targetKcal !== null && k.eatenKcal !== null) {
    const ring = calorieRing({ targetKcal: k.targetKcal, eatenKcal: k.eatenKcal });
    if (ring.kind === 'ring') {
      kcal =
        ring.state === 'over'
          ? { state: 'over', value: ring.overKcal }
          : ring.state === 'reached'
            ? { state: 'reached', value: 0 }
            : { state: 'open', value: ring.remainingKcal };
    }
  }

  return {
    v: WIDGET_SNAPSHOT.version,
    savedAt: Math.round(input.nowMs),
    date: today,
    days,
    steps,
    kcal,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Anzeige im Widget
// ---------------------------------------------------------------------------------------------------------

const trainingSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('session'),
    name: z.string().min(1).max(WIDGET_SNAPSHOT.maxNameLength),
    done: z.boolean(),
  }),
  z.object({ kind: z.literal('rest') }),
  z.object({ kind: z.literal('no_plan') }),
]);

/** Prüfung beim Lesen (Speicher = Grenze): alles Unerwartete gilt als „kein Stand“. */
export const widgetSnapshotSchema = z.object({
  v: z.literal(WIDGET_SNAPSHOT.version),
  savedAt: z.number().int().nonnegative(),
  date: isoDateSchema,
  days: z
    .array(z.object({ date: isoDateSchema, training: trainingSchema }))
    .min(1)
    .max(WIDGET_SNAPSHOT.days),
  steps: z
    .object({ steps: z.number().int().nonnegative(), goal: z.number().int().positive() })
    .nullable(),
  kcal: z
    .object({
      state: z.enum(['open', 'reached', 'over']),
      value: z.number().int().nonnegative(),
    })
    .nullable(),
});

export type WidgetView =
  /** Schalter in der App aus (Standard) – das Widget zeigt nur, wo man es einschaltet. */
  | { readonly kind: 'off' }
  /** Kein, ungültiger oder zu alter Stand (> 24 h) → „App öffnen zum Aktualisieren“. */
  | { readonly kind: 'refresh' }
  | {
      readonly kind: 'ready';
      readonly training: WidgetTraining;
      readonly steps: {
        readonly steps: number;
        readonly goal: number;
        readonly fraction: number;
        readonly percent: number;
        readonly reached: boolean;
      } | null;
      readonly kcal: WidgetSnapshot['kcal'];
      /**
       * Neuer Tag seit dem Schreiben: Schritte/kcal von gestern werden NICHT gezeigt; war etwas da, erscheint der
       * kurze Hinweis „App öffnen zum Aktualisieren“.
       */
      readonly metricsOutdated: boolean;
    };

/**
 * Was das Widget jetzt zeigt. `snapshot` ist der gelesene (ungeprüfte) Stand, `today` der Tag der Gerätezeit.
 */
export function widgetView(input: {
  readonly enabled: boolean;
  readonly snapshot: unknown;
  readonly nowMs: number;
  readonly today: string;
}): WidgetView {
  if (!input.enabled) return { kind: 'off' };
  const parsed = widgetSnapshotSchema.safeParse(input.snapshot);
  if (!parsed.success) return { kind: 'refresh' };
  const snapshot = parsed.data;
  const age = input.nowMs - snapshot.savedAt;
  if (age > WIDGET_SNAPSHOT.staleAfterHours * 3_600_000) return { kind: 'refresh' };
  if (age < -WIDGET_SNAPSHOT.futureToleranceMinutes * 60_000) return { kind: 'refresh' };
  const today = isoDateSchema.parse(input.today);
  const day = snapshot.days.find((d) => d.date === today);
  if (!day) return { kind: 'refresh' };
  const sameDay = snapshot.date === today;
  const steps =
    sameDay && snapshot.steps
      ? (() => {
          const p = stepProgress(snapshot.steps);
          return {
            steps: p.steps,
            goal: p.goal,
            fraction: p.fraction,
            percent: p.percent,
            reached: p.reached,
          };
        })()
      : null;
  return {
    kind: 'ready',
    training: day.training,
    steps,
    kcal: sameDay ? snapshot.kcal : null,
    metricsOutdated: !sameDay && (snapshot.steps !== null || snapshot.kcal !== null),
  };
}
