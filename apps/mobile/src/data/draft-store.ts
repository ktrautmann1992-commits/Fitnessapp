import { CONSERVATIVE_PLAN_RULES, neutralSessionName } from '@fitnessapp/core';

import type { ProtectedStore } from './protected-store';
import { DRAFT_FORMAT, type WorkoutDraft } from './workout-draft';

/**
 * Geschützter Entwurfs-Speicher (docs/PLAN-PHASE-4.md 4.1/4.2): laufende Einheiten sowie abgelehnte und
 * Konflikt-Fassungen, als EIN Text im eigenen geschützten Speicher `workoutDraft` (App verschlüsselt, Browser
 * sessionStorage). Jeder Entwurf trägt sein Konto (R5).
 */
interface StoredDrafts {
  format: typeof DRAFT_FORMAT;
  drafts: WorkoutDraft[];
}

export class DraftStore {
  private drafts: WorkoutDraft[] | null = null;

  constructor(private readonly store: ProtectedStore) {}

  async all(): Promise<WorkoutDraft[]> {
    if (this.drafts) return this.drafts;
    const raw = await this.store.read();
    // Gleichzeitiges erstes Laden: ein inzwischen geänderter Stand gewinnt.
    if (this.drafts) return this.drafts;
    let drafts: WorkoutDraft[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StoredDrafts;
        drafts =
          parsed.format === DRAFT_FORMAT && Array.isArray(parsed.drafts) ? parsed.drafts : [];
      } catch {
        drafts = [];
      }
    }
    this.drafts = drafts;
    return drafts;
  }

  /** Entwürfe dieses Kontos. */
  async forOwner(userId: string): Promise<WorkoutDraft[]> {
    return (await this.all()).filter((d) => d.ownerUserId === userId);
  }

  /** Liegen Entwürfe eines ANDEREN Kontos auf dem Gerät (R5)? */
  async hasForeign(userId: string): Promise<boolean> {
    return (await this.all()).some((d) => d.ownerUserId !== userId);
  }

  /** Aktueller Stand NACH dem Laden – synchron gelesen, damit gleichzeitige Änderungen sich nicht überschreiben. */
  private async current(): Promise<WorkoutDraft[]> {
    await this.all();
    return this.drafts ?? [];
  }

  async put(draft: WorkoutDraft): Promise<void> {
    const drafts = await this.current();
    await this.persist([...drafts.filter((d) => d.key !== draft.key), draft]);
  }

  async remove(key: string): Promise<void> {
    const drafts = await this.current();
    if (!drafts.some((d) => d.key === key)) return;
    await this.persist(drafts.filter((d) => d.key !== key));
  }

  async removeWhere(predicate: (draft: WorkoutDraft) => boolean): Promise<void> {
    const drafts = await this.current();
    await this.persist(drafts.filter((d) => !predicate(d)));
  }

  /**
   * Widerruf bzw. ungültige Einwilligung (S1, R3): Entwürfe aus Plänen mit Gesundheits-Check neutralisieren
   * (Vorgaben/Zustand leer, Name neutral) oder – bei „auch löschen“ – entfernen.
   */
  async cleanHealthPlanDrafts(mode: 'neutralize' | 'delete'): Promise<void> {
    const drafts = await this.current();
    if (!drafts.some((d) => d.fromHealthPlan)) return;
    await this.persist(
      mode === 'delete'
        ? drafts.filter((d) => !d.fromHealthPlan)
        : drafts.map((d) => (d.fromHealthPlan ? neutralizeDraft(d) : d)),
    );
  }

  /** Daten UND Schlüssel löschen (Abmelden, Konto löschen, Testdaten löschen). */
  async clear(): Promise<void> {
    await this.persist([]);
  }

  /** Schreibvorgänge nacheinander (Wächter C1 B1) – der zuletzt veranlasste Stand landet zuletzt. */
  private persistChain: Promise<void> = Promise.resolve();

  private persist(drafts: WorkoutDraft[]): Promise<void> {
    this.drafts = drafts;
    const snapshot =
      drafts.length === 0
        ? null
        : JSON.stringify({ format: DRAFT_FORMAT, drafts } satisfies StoredDrafts);
    const run = () => (snapshot === null ? this.store.clear() : this.store.write(snapshot));
    const next = this.persistChain.then(run, run);
    this.persistChain = next.catch(() => undefined);
    return next;
  }
}

const NO_TARGETS = {
  target_sets: null,
  reps_min: null,
  reps_max: null,
  target_reps: null,
  target_extra_set: null,
  target_weight_kg: null,
  target_duration_s: null,
  target_rpe: null,
  is_return: false,
} as const;
const NO_STATE = {
  state_weight_kg: null,
  state_target_reps: null,
  state_extra_set: null,
  state_duration_s: null,
} as const;

/** Entwurf ohne Vorgaben, Zustand und Varianten-Namen (S1); Ist-Werte bleiben. */
export function neutralizeDraft(draft: WorkoutDraft): WorkoutDraft {
  const neutralTarget = <T extends WorkoutDraft['exercises'][number]['planned']>(t: T): T => ({
    ...t,
    targets: { ...NO_TARGETS, is_return: t.targets.is_return },
    state: { ...NO_STATE },
    heavierReferenceKg: null,
    lighterReferenceKg: null,
    hint: null,
    harderVariantName: null,
  });
  return {
    ...draft,
    fromHealthPlan: false,
    // Ohne Vorgaben ist kein Tausch mehr berechenbar – wie beim Ändern eines Eintrags.
    editing: true,
    nameDe: neutralSessionName(draft.kind),
    exercises: draft.exercises.map((e) => ({
      ...e,
      dosage: {
        ...e.dosage,
        sets: Math.max(1, e.sets.length),
        reps_min: null,
        reps_max: null,
        duration_s: null,
        rpe_target: CONSERVATIVE_PLAN_RULES.rpeMax,
      },
      reference: {
        templateSets: Math.max(1, e.sets.length),
        rpeTarget: CONSERVATIVE_PLAN_RULES.rpeMax,
      },
      planned: neutralTarget(e.planned),
      alternative: e.alternative ? neutralTarget(e.alternative) : null,
    })),
  };
}
