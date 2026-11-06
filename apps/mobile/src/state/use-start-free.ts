import type { EnduranceModality, Exercise, PlannedSessionKind } from '@fitnessapp/core';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';

import { newId } from '@/data/create-backend';
import { createFreeDraft } from '@/data/workout-draft';
import { berlinTodayIso } from '@/lib/format';
import { useApp } from '@/state/app-state';

export interface StartFreeInput {
  readonly kind: PlannedSessionKind;
  readonly modality: EnduranceModality;
  readonly exercises: readonly Pick<Exercise, 'id' | 'name_de' | 'load_type' | 'equipment_ids'>[];
  /** Trainingstag; heute = normaler Trainingsmodus, früher = Nachtragen (Regel in createFreeDraft). */
  readonly performedOn: string;
}

/**
 * Freie Einheit anlegen und den Trainingsmodus öffnen (`/workout/frei-<id>`) – gemeinsam für „Einheit eintragen“
 * (Kalender, Nachtragen) und „Krafttraining starten“ (Start-Blatt auf „Heute“). Der Entwurf wird zuerst gesichert
 * (offline, geschützter Gerätespeicher); scheitert das, liefert `start` false und `failed` true – nie still.
 */
export function useStartFreeSession(): {
  start: (input: StartFreeInput) => Promise<boolean>;
  busy: boolean;
  failed: boolean;
} {
  const app = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const ownerUserId = app.session?.userId ?? null;
  const { saveDraft } = app;

  const start = useCallback(
    async (input: StartFreeInput) => {
      if (!ownerUserId) return false;
      setBusy(true);
      setFailed(false);
      try {
        const draft = createFreeDraft({
          ownerUserId,
          kind: input.kind,
          modality: input.modality,
          exercises: input.exercises,
          performedOn: input.performedOn,
          // „Heute“ wie der Server (Europe/Berlin, Wächter H4).
          today: berlinTodayIso(),
          now: new Date().toISOString(),
          newId,
        });
        await saveDraft(draft);
        router.replace(`/workout/${draft.key}` as Href);
        return true;
      } catch {
        setFailed(true);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [ownerUserId, router, saveDraft],
  );

  return { start, busy, failed };
}
