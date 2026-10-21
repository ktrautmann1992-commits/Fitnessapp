import type { Sex } from '../enums';
import type { CycleSettings } from './schemas';

/**
 * Zustand des Zyklus-Moduls (docs/PLAN-PHASE-9.md 7.2, 7.2a, 9.2):
 * - `hidden`: nicht anbieten (Geschlecht „männlich“ ohne Daten, oder Modul im Supabase-Modus nicht freigeschaltet
 *   ohne Einwilligung und ohne Daten),
 * - `manage_only`: nur Verwaltung (Pausieren, Löschen, Beenden, Export) – z. B. nach Wechsel auf „männlich“ oder
 *   nach Entzug der Freischaltung, solange Einwilligung oder Daten bestehen (Art. 15/17),
 * - `off`: angeboten, aber ohne Einwilligung → nur Einführung,
 * - `needs_status`: Einwilligung da, Status fehlt → Einrichtung,
 * - `paused`: pausiert (Daten bleiben),
 * - `paused_pregnancy`: Status „schwanger“ oder Flag `pregnancy` aus dem Gesundheits-Check → Pausen-Bildschirm,
 * - `active`: Tages-Check, Hinweise, Angebote.
 */
export type CycleModuleState =
  'hidden' | 'manage_only' | 'off' | 'needs_status' | 'paused' | 'paused_pregnancy' | 'active';

export interface CycleModuleStateInput {
  readonly sex: Sex | null;
  /** Gültige Einwilligung `cycle_data` (aktuelle Version). */
  readonly consentValid: boolean;
  /** Irgendeine (auch veraltete) aktive Einwilligung `cycle_data`. */
  readonly consentActive: boolean;
  /** Es gibt gespeicherte Zyklusdaten (Einträge oder Einstellungen). */
  readonly hasData: boolean;
  readonly settings: Pick<CycleSettings, 'status' | 'paused'> | null;
  /** Flag `pregnancy` aus dem Gesundheits-Check (nur mit health_data bekannt). */
  readonly pregnancyFlag: boolean;
  /** Supabase: Flag `cycle_module` an und Konto freigeschaltet; Testmodus: immer true. */
  readonly accessOpen: boolean;
}

/** Wird das Modul für dieses Geschlecht angeboten? „weiblich“, „divers“, „keine Angabe“ – nicht „männlich“ (ZY-G4). */
export function cycleModuleOffered(sex: Sex | null | undefined): boolean {
  return sex !== null && sex !== undefined && sex !== 'male';
}

export function cycleModuleState(input: CycleModuleStateInput): CycleModuleState {
  const hasSomething = input.consentActive || input.hasData;
  if (!cycleModuleOffered(input.sex) || !input.accessOpen) {
    return hasSomething ? 'manage_only' : 'hidden';
  }
  if (!input.consentValid) return hasSomething ? 'manage_only' : 'off';
  const status = input.settings?.status ?? null;
  if (status === 'pregnant' || input.pregnancyFlag) return 'paused_pregnancy';
  if (status === null) return 'needs_status';
  if (input.settings?.paused === true) return 'paused';
  return 'active';
}
