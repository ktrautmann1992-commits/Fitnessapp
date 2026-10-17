import { z } from 'zod';

import { GOAL_ENERGY_ADJUSTMENT, GOAL_PAIR_RULES, PROTEIN_G_PER_KG } from '../constants';
import {
  type ExperienceLevel,
  GOAL_TEMPLATE_MAPPING,
  GOAL_TYPES,
  type GoalType,
  type TemplateGoalType,
} from '../enums';

/**
 * Ziel-Profil aus Haupt- und optionalem Nebenziel (docs/PLAN-ZIELE.md Abschnitt 4, Etappe Z1).
 * Regel (Gründer-Entscheidung F1): Die Vorlage folgt dem Hauptziel, das Nebenziel ergänzt.
 * Alle Werte kommen aus `constants.ts` (GOAL_PAIR_RULES, GOAL_ENERGY_ADJUSTMENT, PROTEIN_G_PER_KG,
 * GOAL_TEMPLATE_MAPPING). Ohne Nebenziel liefert das Profil exakt die bisherigen Werte des Einzelziels (Invariante,
 * profile.test.ts). Das Profil enthält KEINE Körperdaten und keine Schutzgrenzen – die gelten ausschließlich in
 * `clampCalorieTarget`.
 */

/** Erlaubte Paare [Hauptziel, Nebenziel] (= GOAL_PAIR_RULES, gespiegelt in private.goal_pair_allowed). */
export const GOAL_COMBINATIONS: readonly (readonly [GoalType, GoalType])[] = GOAL_PAIR_RULES.map(
  (rule) => [rule.primary, rule.secondary] as const,
);

type PairRule = (typeof GOAL_PAIR_RULES)[number];

function pairRule(primary: GoalType, secondary: GoalType): PairRule | undefined {
  return GOAL_PAIR_RULES.find((rule) => rule.primary === primary && rule.secondary === secondary);
}

/** Ist das Paar erlaubt? Kein Nebenziel (`null`/fehlend) ist immer erlaubt. */
export function isAllowedGoalPair(primary: GoalType, secondary: GoalType | null | undefined) {
  return secondary == null || pairRule(primary, secondary) !== undefined;
}

const goalSchema = z.enum(GOAL_TYPES);

/**
 * Ziel-Auswahl: Hauptziel Pflicht, Nebenziel optional (Standard `null`, Wächter B1). Verbotene Paare werden
 * abgelehnt (Tabelle 4.2).
 */
export const goalSelectionSchema = z
  .strictObject({
    primary: goalSchema,
    secondary: goalSchema.nullable().default(null),
  })
  .refine((selection) => isAllowedGoalPair(selection.primary, selection.secondary), {
    path: ['secondary'],
    message: 'Diese Kombination von Zielen ist nicht möglich.',
  });
export type GoalSelection = z.output<typeof goalSelectionSchema>;
export type GoalSelectionInput = z.input<typeof goalSelectionSchema>;

/** Energie-Richtung des Profils – immer aus dem Vorzeichen der Anpassung abgeleitet (Wächter S11). */
export type EnergyDirection = 'deficit' | 'maintenance' | 'surplus';

export function energyDirectionOf(adjustment: number): EnergyDirection {
  return adjustment < 0 ? 'deficit' : adjustment > 0 ? 'surplus' : 'maintenance';
}

/** Feste Hinweis-Codes des Profils (Texte in der App). */
export const GOAL_PROFILE_NOTICES = ['concurrent_training'] as const;
export type GoalProfileNotice = (typeof GOAL_PROFILE_NOTICES)[number];

export type GoalRole = 'primary' | 'secondary';

export interface GoalProfile {
  readonly primary: GoalType;
  readonly secondary: GoalType | null;
  /** Ziel der Plan-Vorlage (folgt dem Hauptziel; Ausdauer + Kraft-Nebenziel → Muskelaufbau). */
  readonly templateGoal: TemplateGoalType;
  readonly templateKind: 'same' | 'mapped' | 'fallback';
  /** Standard-Anpassung ohne konkretes Abnehmziel und ihre Richtung (Vorzeichen). */
  readonly energy: { readonly direction: EnergyDirection; readonly adjustment: number };
  readonly proteinGPerKg: number;
  /** Kohlenhydrat-Richtwert nach Trainingsminuten (sobald Ausdauer eines der Ziele ist). */
  readonly enduranceCarbs: boolean;
  /** Rolle eines Kraft-Ziels (Muskelaufbau/Definition) – für die Mindest-Kraft-Tage. */
  readonly strengthGoal: GoalRole | null;
  /** Rolle des Ziels Ausdauer. */
  readonly enduranceRole: GoalRole | null;
  /** Gleichwertiges Einzelziel (Wächter K3): „Muskelaufbau → Abnehmen“ = Definition, „Fitness → Ausdauer“ = Ausdauer. */
  readonly equivalentTo: GoalType | null;
  readonly notices: readonly GoalProfileNotice[];
}

const STRENGTH_GOALS: readonly GoalType[] = ['muscle_gain', 'definition'];

function roleOf(selection: GoalSelection, test: (goal: GoalType) => boolean): GoalRole | null {
  if (test(selection.primary)) return 'primary';
  return selection.secondary !== null && test(selection.secondary) ? 'secondary' : null;
}

function parseSelection(selection: GoalSelectionInput): GoalSelection {
  return goalSelectionSchema.parse(selection);
}

/** Standard-Energie-Anpassung (Anteil des Grundbedarfs ohne Training). Einzelziele: GOAL_ENERGY_ADJUSTMENT. */
export function goalEnergyAdjustment(
  selection: GoalSelectionInput,
  level: ExperienceLevel,
): number {
  const { primary, secondary } = parseSelection(selection);
  if (secondary === null) {
    return primary === 'muscle_gain'
      ? GOAL_ENERGY_ADJUSTMENT.muscle_gain[level]
      : GOAL_ENERGY_ADJUSTMENT[primary];
  }
  return (pairRule(primary, secondary) as PairRule).energyAdjustment;
}

/**
 * Energie-Richtung unabhängig vom Level (das Level ändert nur die Höhe des Überschusses beim Muskelaufbau, nie das
 * Vorzeichen – Eigenschaftstest in profile.test.ts). Ersetzt die frühere Liste DEFICIT_GOALS.
 */
export function goalEnergyDirection(selection: GoalSelectionInput): EnergyDirection {
  return energyDirectionOf(goalEnergyAdjustment(selection, 'beginner'));
}

/** Eiweiß-Richtwert in g/kg (vor den Deckeln aus `nutritionEligibility`). */
export function goalProteinGPerKg(selection: GoalSelectionInput): number {
  const { primary, secondary } = parseSelection(selection);
  return secondary === null
    ? PROTEIN_G_PER_KG.byGoal[primary]
    : (pairRule(primary, secondary) as PairRule).proteinGPerKg;
}

/** Kohlenhydrat-Richtwert nach Training (bisher nur beim Ziel Ausdauer). */
export function goalUsesEnduranceCarbs(selection: GoalSelectionInput): boolean {
  const { primary, secondary } = parseSelection(selection);
  return secondary === null
    ? primary === 'endurance'
    : (pairRule(primary, secondary) as PairRule).enduranceCarbs;
}

/** Ziel der Plan-Vorlage: Hauptziel über GOAL_TEMPLATE_MAPPING; Ausdauer + Kraft-Nebenziel → Muskelaufbau (4.3). */
export function goalTemplate(selection: GoalSelectionInput): {
  readonly goal: TemplateGoalType;
  readonly kind: 'same' | 'mapped' | 'fallback';
} {
  const { primary, secondary } = parseSelection(selection);
  if (primary === 'endurance' && secondary !== null && STRENGTH_GOALS.includes(secondary)) {
    return { goal: 'muscle_gain', kind: 'mapped' };
  }
  return GOAL_TEMPLATE_MAPPING[primary];
}

/** Ziel-Profil für Plan und Ernährung. Wirft bei einem verbotenen Paar (Zod). */
export function goalProfile(selection: GoalSelectionInput, level: ExperienceLevel): GoalProfile {
  const parsed = parseSelection(selection);
  const adjustment = goalEnergyAdjustment(parsed, level);
  const template = goalTemplate(parsed);
  const goals = [parsed.primary, parsed.secondary];
  const notices: GoalProfileNotice[] = [];
  if (goals.includes('muscle_gain') && goals.includes('endurance')) {
    notices.push('concurrent_training');
  }
  const pair = `${parsed.primary}>${parsed.secondary ?? ''}`;
  const equivalentTo: GoalType | null =
    pair === 'muscle_gain>fat_loss'
      ? 'definition'
      : pair === 'general_fitness>endurance'
        ? 'endurance'
        : null;
  return {
    primary: parsed.primary,
    secondary: parsed.secondary,
    templateGoal: template.goal,
    templateKind: template.kind,
    energy: { direction: energyDirectionOf(adjustment), adjustment },
    proteinGPerKg: goalProteinGPerKg(parsed),
    enduranceCarbs: goalUsesEnduranceCarbs(parsed),
    strengthGoal: roleOf(parsed, (goal) => STRENGTH_GOALS.includes(goal)),
    enduranceRole: roleOf(parsed, (goal) => goal === 'endurance'),
    equivalentTo,
    notices,
  };
}

/** Ist `goal` Haupt- oder Nebenziel? */
export function hasGoal(selection: GoalSelectionInput, goal: GoalType): boolean {
  const { primary, secondary } = parseSelection(selection);
  return primary === goal || secondary === goal;
}

/**
 * Grund, aus dem ein Nebenziel zum Hauptziel nicht wählbar ist (Tabelle 4.2, App-Schritt „Ziel“ in Etappe Z4: nicht
 * erlaubte Nebenziele ausgegraut mit Grund). `null` = erlaubt.
 * - `same`: dasselbe Ziel doppelt
 * - `overlap`: Definition zusammen mit Abnehmen bzw. Muskelaufbau („Definition verbindet schon …“)
 * - `fitness_secondary`: Fitness als Nebenziel (steckt in jedem Plan)
 * - `primary_preferred`: Kraft-Ziel neben dem Hauptziel Fitness – besser als Hauptziel wählen
 */
export const GOAL_PAIR_BLOCK_REASONS = [
  'same',
  'overlap',
  'fitness_secondary',
  'primary_preferred',
] as const;
export type GoalPairBlockReason = (typeof GOAL_PAIR_BLOCK_REASONS)[number];

const OVERLAPS_DEFINITION: readonly GoalType[] = ['fat_loss', 'muscle_gain'];

export function goalPairBlockReason(
  primary: GoalType,
  secondary: GoalType,
): GoalPairBlockReason | null {
  if (isAllowedGoalPair(primary, secondary)) return null;
  if (primary === secondary) return 'same';
  if (secondary === 'general_fitness') return 'fitness_secondary';
  if (
    (primary === 'definition' && OVERLAPS_DEFINITION.includes(secondary)) ||
    (secondary === 'definition' && OVERLAPS_DEFINITION.includes(primary))
  ) {
    return 'overlap';
  }
  return 'primary_preferred';
}
