import type { BalanceSupport } from '../aging-screening';
import { ACTIVE_AGING_RULES, BALANCE_PROGRESSION } from '../constants';
import type { TrainingSlotKind } from '../enums';

/**
 * Fit im Alter · Etappe FA1 Teil 2 (docs/PLAN-FIT-IM-ALTER.md 7.2, 9): Gleichgewichts-Vorspann vor Geh-Einheiten (N3),
 * Gleichgewichts-Stufen und schwerere Kraft-Variante NUR nach Bestätigung, Hinweise zu den Trainingstagen (S9).
 * Reine Regeln; die Texte gehen durch die Textregeln und die Fachprüfung (Entwurf).
 */

/**
 * Gleichgewichts-Vorspann einer Geh-Einheit (N3): fester Text, nicht protokolliert (V15/V17 greifen dort nicht).
 * „Beidhändig festhalten“ bei Sturz, Unsicherheit, Gehhilfe oder Blutverdünnern, sonst „Halt in Reichweite“.
 */
export const BALANCE_PRELUDE_DE: Readonly<Record<BalanceSupport, string>> = {
  hold_on:
    'Erst 10 Minuten Gleichgewicht: Halte dich mit beiden Händen an der Küchenzeile oder einer Stuhllehne fest.',
  chair_nearby:
    'Erst 10 Minuten Gleichgewicht: Küchenzeile oder Stuhl direkt neben dir, damit du dich jederzeit festhalten kannst.',
};

/** Aufwärm-Text einer Geh-Einheit mit Vorspann (nur beim Ziel „Fit im Alter“). */
export function withBalancePrelude(warmup: string, support: BalanceSupport): string {
  return `${BALANCE_PRELUDE_DE[support]} Dann: ${warmup}`;
}

// ---------------------------------------------------------------------------------------------------------
// Gleichgewicht in Stufen (Plan 9 Nr. 4, K3)
// ---------------------------------------------------------------------------------------------------------

/** Stand einer Gleichgewichtsübung: Stufe 1–4 und Haltezeit in Sekunden. */
export interface BalanceState {
  readonly stage: number;
  readonly holdS: number;
}

export type BalanceStep =
  /** Haltezeit +5 s (bis 30 s) – ohne Rückfrage. */
  | { readonly kind: 'longer_hold'; readonly next: BalanceState }
  /** Nächste Stufe möglich – erst nach Bestätigung („Möchtest du die nächste Stufe probieren?“). */
  | { readonly kind: 'ask_next_stage'; readonly next: BalanceState }
  /** Höchste erlaubte Stufe mit voller Haltezeit erreicht. */
  | { readonly kind: 'stay'; readonly next: BalanceState };

/**
 * Nächster Schritt nach einer geschafften Einheit. Nie automatisch eine neue Stufe: `ask_next_stage` liefert nur den
 * Vorschlag, übernommen wird er mit `confirmBalanceStage`. `maxStage` aus den Regeln (Sturz/Unsicherheit/Gehhilfe: 2).
 * Ungültige Eingaben werden in den erlaubten Bereich gezogen (strengere Richtung).
 */
export function nextBalanceStep(current: BalanceState, maxStage: number): BalanceStep {
  const { min, max } = ACTIVE_AGING_RULES.balanceHoldS;
  const cap = Math.max(1, Math.min(BALANCE_PROGRESSION.stages, Math.floor(maxStage)));
  const stage = Math.max(1, Math.min(cap, Math.floor(current.stage)));
  const holdS = Math.max(min, Math.min(max, Math.floor(current.holdS)));
  if (holdS < max) {
    return {
      kind: 'longer_hold',
      next: { stage, holdS: Math.min(max, holdS + BALANCE_PROGRESSION.holdStepS) },
    };
  }
  if (stage < cap) return { kind: 'ask_next_stage', next: { stage: stage + 1, holdS: min } };
  return { kind: 'stay', next: { stage, holdS } };
}

/** Bestätigung der nächsten Stufe: nur mit ausdrücklichem „Ja“, nie über die erlaubte Stufe. */
export function confirmBalanceStage(
  current: BalanceState,
  step: BalanceStep,
  confirmed: boolean,
): BalanceState {
  if (step.kind !== 'ask_next_stage') return step.next;
  return confirmed ? step.next : current;
}

/**
 * Schwerere Kraft-Variante (Plan 9 Nr. 3, z. B. Stuhl mit Armhilfe → Kniebeuge am Stuhl): Vorschlag erst nach
 * `harderVariantAfterSessions` Einheiten in Folge am oberen Ende der Wiederholungen – und nur nach Bestätigung.
 */
export function shouldOfferHarderVariant(consecutiveTopSessions: number): boolean {
  return (
    Number.isFinite(consecutiveTopSessions) &&
    consecutiveTopSessions >= BALANCE_PROGRESSION.harderVariantAfterSessions
  );
}

// ---------------------------------------------------------------------------------------------------------
// Trainingstage (Plan 7.2, S9): keine stille Einfügung, nur Hinweise
// ---------------------------------------------------------------------------------------------------------

export const ACTIVE_AGING_SCHEDULE_HINTS = [
  /** Nur Kraft-Tage (2): „3 kurze Tage sind besser als 2 lange“ – Vorschlag, kein Eingriff. */
  'add_third_short_day',
  /** 1 Tag: „Für Gleichgewicht helfen 3 Tage je Woche“. */
  'balance_needs_three_days',
  /** Mehr als 5 Wunschtage: Deckel 5, überzählige Tage → Hinweis. */
  'too_many_days',
] as const;
export type ActiveAgingScheduleHint = (typeof ACTIVE_AGING_SCHEDULE_HINTS)[number];

/** Hinweise zu den Wunschtagen beim Ziel „Fit im Alter“. Gleichgewicht gibt es an Kraft- UND Geh-Tagen (Vorspann). */
export function activeAgingScheduleHints(
  slots: readonly { readonly kind: TrainingSlotKind }[],
): ActiveAgingScheduleHint[] {
  const hints: ActiveAgingScheduleHint[] = [];
  if (slots.length > ACTIVE_AGING_RULES.maxSessionsPerWeek) hints.push('too_many_days');
  if (slots.length === 1) hints.push('balance_needs_three_days');
  else if (slots.length === 2 && slots.every((s) => s.kind !== 'endurance')) {
    hints.push('add_third_short_day');
  }
  return hints;
}

/**
 * Vorschlag im Onboarding (Plan 18 Nr. 3): 2 Kraft-Tage zu Hause und 2 Geh-Tage, Kraft mit Abstand (Mo/Do),
 * Gehen Mi/Sa, je 30 Minuten. PRODUKTENTSCHEIDUNG – Fachprüfung.
 */
export function suggestedActiveAgingSlots(): {
  readonly weekday: number;
  readonly kind: TrainingSlotKind;
  readonly minutes: number;
}[] {
  return [
    { weekday: 1, kind: 'strength_home', minutes: 30 },
    { weekday: 3, kind: 'endurance', minutes: 30 },
    { weekday: 4, kind: 'strength_home', minutes: 30 },
    { weekday: 6, kind: 'endurance', minutes: 30 },
  ];
}
