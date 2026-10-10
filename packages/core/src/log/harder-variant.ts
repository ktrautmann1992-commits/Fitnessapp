import { HARDER_VARIANT_RULES } from '../constants';
import type { Exercise } from '../content/schemas';
import type { ExperienceLevel } from '../enums';
import { type EquipmentProfile, findHarderVariant } from '../plan/equipment-profile';
import type { PlanSafetyRules } from '../plan/safety';
import type { ProgressHint, ProgressResult } from './progression';

/**
 * Hinweis „schwerere Variante“ mit konkretem Vorschlag (docs/PLAN-KOERPERGEWICHT.md §5.5, Wächter A10).
 *
 * Die Progression (nextLoad/progressFromLogs) meldet nur `harder_variant`. Welche Variante es ist, entscheidet
 * findHarderVariant() mit den HEUTE wirksamen Sicherheitsregeln (planSafetyRules zum Anzeige-Datum) und dem
 * Geräte-Profil des Orts der Einheit – so wird nie eine gesperrte (z. B. ab 65 Tisch-Rudern, `high_skill`) oder nicht
 * machbare (fehlendes Gerät) Variante vorgeschlagen; Einsteiger und vorsichtige Pläne nur eine Stufe schwerer (W8). Gibt es keine, entfällt der Hinweis (der Zustand bleibt am
 * Puffer-Ende stehen). Nie ein automatischer Tausch: Macht die Person die Variante, trägt sie sie als Alternative
 * ein – mit eigenem Verlauf unter deren `exercise_id` (PLAN-PHASE-4 5.1, R2).
 */
export interface HarderVariantContext {
  /** Nur Inhalte, die die Engine nutzen darf (PlanLibrary.exercises). */
  readonly library: ReadonlyMap<string, Exercise>;
  /** Geräte am Ort der heutigen Einheit (equipmentProfile). */
  readonly profile: Pick<EquipmentProfile, 'available'>;
  /** Aktuelle Sicherheitsregeln (planSafetyRules mit dem heutigen Datum). */
  readonly rules: Pick<PlanSafetyRules, 'excludedCautionTags' | 'cautious'>;
  /** Level aus den Angaben: Einsteiger (wie vorsichtige Pläne) höchstens 1 Schwierigkeitsstufe schwerer (W8). */
  readonly experienceLevel: ExperienceLevel;
  /**
   * Nicht vorschlagen (Wächter S2, Etappe T1): Ausschlüsse des Orts („Mag ich nicht“/„Hier nicht machbar“) und
   * Übungen der Einheit – dann die nächste erlaubte schwerere Variante oder kein Hinweis.
   */
  readonly exclude?: ReadonlySet<string>;
}

export interface HarderVariantSuggestion {
  readonly exerciseId: string;
  readonly nameDe: string;
}

export interface DisplayHint {
  /** Hinweis für die Anzeige; `harder_variant` nur zusammen mit einem Vorschlag. */
  readonly hint: ProgressHint | null;
  readonly harderVariant: HarderVariantSuggestion | null;
}

/**
 * Hinweis der Progression für die Anzeige: Bei `harder_variant` die schwerere Variante der Übung (Alternative mit
 * Grund `harder`, machbar und erlaubt) – sonst kein Hinweis. Alle anderen Hinweise bleiben unverändert.
 */
export function progressHintForDisplay(
  exerciseId: string,
  result: Pick<ProgressResult, 'hint'>,
  ctx: HarderVariantContext,
): DisplayHint {
  if (result.hint !== 'harder_variant') {
    return { hint: result.hint, harderVariant: null };
  }
  const exercise = ctx.library.get(exerciseId);
  const variant = exercise
    ? findHarderVariant(exercise, {
        library: ctx.library,
        profile: ctx.profile,
        rules: ctx.rules,
        ...(ctx.exclude ? { exclude: ctx.exclude } : {}),
        ...(ctx.experienceLevel === 'beginner' || ctx.rules.cautious
          ? { maxDifficultyStep: HARDER_VARIANT_RULES.cautiousMaxDifficultyStep }
          : {}),
      })
    : null;
  return variant
    ? {
        hint: 'harder_variant',
        harderVariant: { exerciseId: variant.id, nameDe: variant.name_de },
      }
    : { hint: null, harderVariant: null };
}
