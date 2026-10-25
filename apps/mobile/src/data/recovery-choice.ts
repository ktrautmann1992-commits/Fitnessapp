/**
 * Wahl „Leichter trainieren“ / „Wie geplant“ bei niedriger Erholung (25.10.2026). Bewusst NUR im Arbeitsspeicher und
 * nur für EINE Einheit an EINEM Tag: nichts wird gespeichert oder gesendet (kein neuer Gesundheitsdatensatz, nichts in
 * Logs). Startet die Person das Training, steckt die leichtere Vorgabe im Entwurf (der wie jeder Entwurf geschützt auf
 * dem Gerät liegt). Nach einem Neustart der App fragt die Karte einfach erneut. Der Plan selbst ändert sich nie.
 *
 * Später (Phase 9 ZY5 / Plan 8B 4.6): Spalte `session_logs.day_variant` – dann zählt ein leichterer Tag nicht für
 * Steigerungen. Bis dahin ist der Eintrag ein normaler Eintrag mit den tatsächlich gemachten Sätzen.
 */
export type RecoveryChoice = 'lighter' | 'as_planned';

interface Entry {
  readonly userId: string;
  readonly day: string;
  readonly sessionId: string;
  readonly choice: RecoveryChoice;
}

let current: Entry | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Wahl für diese Einheit heute (null = noch nicht gewählt bzw. anderes Konto/anderer Tag/andere Einheit). */
export function recoveryChoiceFor(
  userId: string | null,
  day: string,
  sessionId: string | null,
): RecoveryChoice | null {
  if (!current || !userId || !sessionId) return null;
  return current.userId === userId && current.day === day && current.sessionId === sessionId
    ? current.choice
    : null;
}

export function setRecoveryChoice(entry: Entry): void {
  current = entry;
  emit();
}

/** Wahl zurücknehmen („Doch wie geplant“ vor dem Start) bzw. alles vergessen (Abmelden, Widerruf). */
export function clearRecoveryChoice(): void {
  if (current === null) return;
  current = null;
  emit();
}

export function subscribeRecoveryChoice(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Für useSyncExternalStore: Schnappschuss (Objekt wechselt nur bei Änderung). */
export function recoveryChoiceSnapshot(): Entry | null {
  return current;
}
