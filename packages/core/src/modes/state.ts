import type { BodyRegion, PainIntensity, TravelEquipment } from '../enums';
import type { DisplayModes } from './layer';
import {
  activePainEpisodes,
  lastActiveDay,
  type PainAdviceReason,
  painAdviceReasons,
  painEffectOn,
  type PainEpisode,
} from './pain';
import { currentOrNextTravelMode, travelOnDay, type TravelMode } from './travel';

/** Gespeicherte Trainings-Modi einer Person (Schmerz-Einträge und Reise-Zeiträume). */
export interface TrainingModesState {
  readonly pain: readonly PainEpisode[];
  readonly travel: readonly TravelMode[];
}

export const EMPTY_TRAINING_MODES: TrainingModesState = { pain: [], travel: [] };

/** Modi an einem Tag für prepareSessionForDisplay (Datum der Einheit, nicht heute – Wochenansicht, Kalender). */
export function displayModesOn(state: TrainingModesState | null, date: string): DisplayModes {
  if (!state) return {};
  return { travel: travelOnDay(state.travel, date), pain: painEffectOn(state.pain, date) };
}

/** Banner auf „Heute“: laufender bzw. nächster Reise-Zeitraum und laufender Schmerz-Modus (null = keiner). */
export interface ModesBanner {
  readonly travel: {
    readonly active: boolean;
    readonly startsOn: string;
    readonly endsOn: string;
    readonly equipment: TravelEquipment;
    readonly maxMinutes: number | null;
  } | null;
  readonly pain: {
    readonly regions: readonly { readonly region: BodyRegion; readonly intensity: PainIntensity }[];
    readonly until: string;
    readonly advice: readonly PainAdviceReason[];
  } | null;
}

export function modesBanner(state: TrainingModesState | null, today: string): ModesBanner {
  if (!state) return { travel: null, pain: null };
  const travel = currentOrNextTravelMode(state.travel, today);
  const active = activePainEpisodes(state.pain, today);
  return {
    travel: travel
      ? {
          active: travel.starts_on <= today,
          startsOn: travel.starts_on,
          endsOn: travel.ends_on,
          equipment: travel.equipment,
          maxMinutes: travel.max_minutes,
        }
      : null,
    pain:
      active.length > 0
        ? {
            // Angabe der Person (nicht die konservativ verschärfte Stufe) – je Region die zuletzt angelegte.
            regions: [...active]
              .sort((a, b) => a.created_at.localeCompare(b.created_at))
              .reduce<{ region: BodyRegion; intensity: PainIntensity }[]>((list, e) => {
                const rest = list.filter((r) => r.region !== e.region);
                return [...rest, { region: e.region, intensity: e.intensity }];
              }, []),
            until: active
              .map((e) => lastActiveDay(e) as string)
              .sort()
              .at(-1) as string,
            advice: painAdviceReasons(state.pain, today),
          }
        : null,
  };
}
