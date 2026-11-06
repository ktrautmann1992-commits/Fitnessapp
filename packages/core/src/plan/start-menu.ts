import type { PlannedSessionKind } from '../enums';

/**
 * „Training starten“ (Gründer-Wunsch 06.11.2026): Welche Einträge zeigt das Blatt hinter dem „+“ auf „Heute“ bzw.
 * auf dem Tag „heute“ – und in welcher Reihenfolge? Geplante Einheiten von heute, die noch offen und startbar sind
 * (oder deren Training schon läuft), stehen immer zuerst; danach die freien Wege (Kraft, GPS, andere Sportart,
 * Nachtragen). Reine Regel ohne UI – die App liefert die Kandidaten (Wochen-Status, Startprüfung, Entwürfe).
 */

/** Höchstens so viele geplante Einheiten im Blatt (mehr als zwei an einem Tag sind die Ausnahme). */
export const START_MENU_MAX_PLANNED = 2;

export interface StartMenuCandidate {
  readonly sessionId: string;
  readonly name_de: string;
  readonly kind: PlannedSessionKind;
  /** Startprüfung bestanden (heute geplant bzw. nachholbar, nicht schon trainiert). */
  readonly startable: boolean;
  /** Es gibt schon einen offenen Entwurf (Training läuft) – „Fortsetzen“. */
  readonly hasDraft: boolean;
}

export type StartMenuEntry =
  | {
      readonly kind: 'planned';
      readonly sessionId: string;
      readonly name_de: string;
      readonly sessionKind: PlannedSessionKind;
      readonly resume: boolean;
    }
  | { readonly kind: 'free_strength' }
  | { readonly kind: 'gps' }
  | { readonly kind: 'other_sport' }
  | { readonly kind: 'backfill' };

export interface StartMenuInput {
  readonly candidates: readonly StartMenuCandidate[];
  /** Live-GPS ist auf diesem Gerät möglich (im Web-Browser nicht). */
  readonly gpsAvailable: boolean;
}

export function startTrainingMenu(input: StartMenuInput): StartMenuEntry[] {
  const seen = new Set<string>();
  const planned: StartMenuEntry[] = [];
  for (const candidate of input.candidates) {
    if (seen.has(candidate.sessionId)) continue;
    seen.add(candidate.sessionId);
    if (!candidate.startable && !candidate.hasDraft) continue;
    planned.push({
      kind: 'planned',
      sessionId: candidate.sessionId,
      name_de: candidate.name_de,
      sessionKind: candidate.kind,
      resume: candidate.hasDraft,
    });
  }
  // Laufende Trainings (Entwurf) vor neuen – nie zwei Einheiten parallel aus dem Blick verlieren.
  planned.sort((a, b) => Number(isResume(b)) - Number(isResume(a)));
  return [
    ...planned.slice(0, START_MENU_MAX_PLANNED),
    { kind: 'free_strength' },
    ...(input.gpsAvailable ? [{ kind: 'gps' } as const] : []),
    { kind: 'other_sport' },
    { kind: 'backfill' },
  ];
}

function isResume(entry: StartMenuEntry): boolean {
  return entry.kind === 'planned' && entry.resume;
}
