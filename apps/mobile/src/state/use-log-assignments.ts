import { type LogAssignment, upsertLogAssignment } from '@fitnessapp/core';
import { useCallback, useEffect, useState } from 'react';

import { deviceStore } from '@/data/create-backend';
import { createLogAssignmentStore } from '@/data/week-status';
import { useApp } from '@/state/app-state';

/**
 * Antworten auf „Soll diese Einheit für ‚…‘ am Samstag zählen?“ (docs/PLAN-AUSWERTUNG.md „Training-Übersicht“) – Gerätespeicher je Konto.
 * Der geladene Stand bleibt im Arbeitsspeicher und alle offenen Ansichten (Heute, Woche, Tages-Blatt) bekommen jede
 * Änderung sofort (wie use-wearables). Fehler beim Lesen → leer (die Frage kommt dann eben noch einmal).
 */

const store = createLogAssignmentStore(deviceStore);
let memory: { owner: string; list: readonly LogAssignment[] } | null = null;
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

export interface LogAssignmentsState {
  /** null = noch nicht geladen (dann keine Frage zeigen). */
  readonly assignments: readonly LogAssignment[] | null;
  /** Antwort speichern: `sessionId` = zählt dafür, null = zusätzliche Einheit. */
  readonly decide: (logId: string, sessionId: string | null) => Promise<void>;
}

export function useLogAssignments(): LogAssignmentsState {
  const app = useApp();
  const owner = app.session?.userId ?? null;
  const [, setVersion] = useState(0);

  useEffect(() => {
    const listener = () => setVersion((v) => v + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!owner || memory?.owner === owner) return;
    let active = true;
    void store
      .load(owner)
      .catch(() => [])
      .then((list) => {
        if (!active) return;
        memory = { owner, list };
        notify();
      });
    return () => {
      active = false;
    };
  }, [owner]);

  const decide = useCallback(
    async (logId: string, sessionId: string | null) => {
      if (!owner) return;
      const current = memory?.owner === owner ? memory.list : await store.load(owner);
      const next = upsertLogAssignment(current, {
        ownerUserId: owner,
        logId,
        sessionId,
        decidedAt: new Date().toISOString(),
      });
      memory = { owner, list: next };
      notify();
      await store.save(owner, next);
    },
    [owner],
  );

  return { assignments: owner && memory?.owner === owner ? memory.list : null, decide };
}
