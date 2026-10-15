import type { MoveBlockReason, MoveTarget, RecoveryConflict } from '@fitnessapp/core';

import { BackendError } from '@/data/backend';
import { t } from '@/i18n';

import { errorText } from './error-text';

import { dayLabel } from './plan-format';

/**
 * Texte des Trainingskalenders (Etappe A1a) – rein, ohne React Native, getestet in calendar-format.test.ts. Keine
 * Fachlogik: Erlaubt/Grund kommt aus packages/core (moveTargets/validateMove), hier wird nur formuliert.
 */

/** Name einer Einheit nach ID (null = unbekannt, z. B. Einheit eines alten Plans ohne Namen). */
export type SessionName = (id: string) => string | null;

interface Blocked {
  readonly reason?: MoveBlockReason | undefined;
  readonly partner?: boolean | undefined;
  readonly otherSessionId?: string | undefined;
  readonly conflict?: RecoveryConflict | undefined;
}

/** Grund eines gesperrten Tages in Worten („Zu nah an deiner Einheit „Beine“ am Mittwoch, 07.10. …“). */
export function blockText(blocked: Blocked, nameOf: SessionName): string {
  const reason = blocked.reason ?? 'not_found';
  if (blocked.partner && blocked.otherSessionId) {
    const other = nameOf(blocked.otherSessionId);
    if (other) return t.calendar.partner(other, t.calendar.partnerReasons[reason]);
  }
  if (reason === 'recovery_48h' && blocked.conflict) {
    const name = nameOf(blocked.conflict.sessionId);
    if (name) return t.calendar.recoveryWith(name, dayLabel(blocked.conflict.date));
  }
  return t.calendar.reasons[reason];
}

/** Eintrag im Menü „Verschieben …“: Tag + „hierhin verschieben“ / „tauschen mit …“ / Grund. */
export function menuLabel(target: MoveTarget, nameOf: SessionName): string {
  const day = dayLabel(target.date);
  if (target.allowed) {
    const other = target.otherSessionId ? nameOf(target.otherSessionId) : null;
    return target.kind === 'swap' && other
      ? t.calendar.menuSwap(day, other)
      : t.calendar.menuMove(day);
  }
  return t.calendar.menuBlocked(day, blockText(target, nameOf));
}

/** Kurztext am Tag während des Ziehens. */
export function dropLabel(target: MoveTarget, nameOf: SessionName): string {
  if (target.allowed) {
    const other = target.otherSessionId ? nameOf(target.otherSessionId) : null;
    return target.kind === 'swap' && other ? t.calendar.dropSwap(other) : t.calendar.dropMove;
  }
  return blockText(target, nameOf);
}

/**
 * Fehlertext beim Verschieben/Tauschen (Wächter A1a S2): Regel, geänderter Stand, vorübergehend, offline – nie der
 * Regel-Text für andere Ursachen. Der Plan wird danach immer neu geladen (moveSessionTo).
 */
export function moveErrorText(caught: unknown): string {
  if (caught instanceof BackendError) {
    if (caught.code === 'plan_rejected') {
      return caught.moveReason === 'move_rules'
        ? t.calendar.rejectedRules
        : caught.moveReason === 'plan_changed'
          ? t.calendar.rejectedChanged
          : t.calendar.rejectedOther;
    }
    if (caught.code === 'online_only') return t.calendar.swapOffline;
    if (caught.code === 'network' && caught.sensitive) return t.errors.networkPlan;
  }
  return errorText(caught);
}

/**
 * Hinweis „Dein Essensplan passt eventuell nicht mehr“ (Wächter A1a H10): nur wenn die Ernährung eingerichtet ist und
 * ein betroffener Tag heute oder später liegt (das Tagesziel vergangener Tage hängt nur an erledigten Einheiten). Nach
 * den Verschiebe-Regeln liegt der Ziel-Tag immer ab heute – die Prüfung bleibt als Absicherung.
 */
export function nutritionHintNeeded(input: {
  supportsNutrition: boolean;
  nutritionSetUp: boolean;
  days: readonly string[];
  today: string;
}): boolean {
  return (
    input.supportsNutrition && input.nutritionSetUp && input.days.some((day) => day >= input.today)
  );
}

/** Rückmeldung nach dem Verschieben bzw. Tauschen. */
export function outcomeText(
  outcome:
    | { kind: 'moved'; to: string }
    | { kind: 'swapped'; otherSessionId: string; from: string; to: string },
  nameOf: SessionName,
): string {
  if (outcome.kind === 'moved') return t.calendar.moved(dayLabel(outcome.to));
  return t.calendar.swapped(
    dayLabel(outcome.to),
    nameOf(outcome.otherSessionId) ?? '',
    dayLabel(outcome.from),
  );
}
