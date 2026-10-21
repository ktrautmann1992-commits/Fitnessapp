import { describe, expect, it } from 'vitest';

import {
  GOAL_ENERGY_ADJUSTMENT,
  GOAL_PAIR_RULES,
  PROTEIN_G_PER_KG,
  SURPLUS_CAP,
} from '../constants';
import {
  EXPERIENCE_LEVELS,
  GOAL_TEMPLATE_MAPPING,
  GOAL_TYPES,
  type GoalType,
  TEMPLATE_GOAL_TYPES,
} from '../enums';
import { applyGoalAdjustment, type CalorieLimitContext, dayCeilingKcal } from '../nutrition/limits';
import {
  energyDirectionOf,
  GOAL_COMBINATIONS,
  GOAL_PAIR_BLOCK_REASONS,
  goalEnergyAdjustment,
  goalPairBlockReason,
  goalEnergyDirection,
  goalProfile,
  goalProteinGPerKg,
  goalSelectionSchema,
  goalTemplate,
  goalUsesEnduranceCarbs,
  hasGoal,
  isAllowedGoalPair,
} from './profile';

/**
 * Ziel-Profil (docs/PLAN-ZIELE.md 4.2–4.5, Etappe Z1). Erwartungen UNABHÄNGIG aus den Plan-Tabellen abgeschrieben.
 */

/** Tabelle 4.2: erlaubte Paare Haupt > Neben (abgeschrieben, nicht aus GOAL_PAIR_RULES). */
const ALLOWED = [
  'fat_loss>muscle_gain',
  'fat_loss>endurance',
  'definition>endurance',
  'muscle_gain>fat_loss',
  'muscle_gain>endurance',
  'general_fitness>fat_loss',
  'general_fitness>endurance',
  'endurance>fat_loss',
  'endurance>definition',
  'endurance>muscle_gain',
  // Fit im Alter (FA1, FA-G6): nur Abnehmen als Nebenziel.
  'active_aging>fat_loss',
];

/** Tabelle 4.4: Energie-Anpassung, Eiweiß, KH nach Training. */
const TABLE_4_4: Record<string, { energy: number; protein: number; carbs: boolean }> = {
  'fat_loss>muscle_gain': { energy: -0.15, protein: 2.2, carbs: false },
  'muscle_gain>fat_loss': { energy: -0.1, protein: 2.2, carbs: false },
  'fat_loss>endurance': { energy: -0.15, protein: 2.0, carbs: true },
  'definition>endurance': { energy: -0.1, protein: 2.2, carbs: true },
  'muscle_gain>endurance': { energy: 0.05, protein: 1.8, carbs: true },
  'general_fitness>fat_loss': { energy: -0.15, protein: 2.0, carbs: false },
  'general_fitness>endurance': { energy: 0, protein: 1.4, carbs: true },
  'endurance>fat_loss': { energy: -0.1, protein: 2.0, carbs: true },
  'endurance>definition': { energy: -0.1, protein: 2.2, carbs: true },
  'endurance>muscle_gain': { energy: 0, protein: 1.8, carbs: true },
  // docs/PLAN-FIT-IM-ALTER.md 11: −10 %, Eiweiß 1,5 g/kg (Spanne 1,2–1,5), PRODUKTENTSCHEIDUNG.
  'active_aging>fat_loss': { energy: -0.1, protein: 1.5, carbs: false },
};

const ALL_ORDERED_PAIRS = GOAL_TYPES.flatMap((primary) =>
  GOAL_TYPES.map((secondary) => [primary, secondary] as const),
);
const key = (primary: GoalType, secondary: GoalType | null) => `${primary}>${secondary ?? ''}`;

describe('Erlaubte Paare (Tabelle 4.2)', () => {
  it('GOAL_COMBINATIONS = genau die 11 Paare der Tabelle (10 + Fit im Alter → Abnehmen)', () => {
    expect(GOAL_COMBINATIONS.map(([p, s]) => key(p, s)).sort()).toEqual([...ALLOWED].sort());
    expect(new Set(GOAL_COMBINATIONS.map(([p, s]) => key(p, s))).size).toBe(11);
  });

  it.each(ALL_ORDERED_PAIRS)(
    '%s → %s: erlaubt genau laut Tabelle (Schema und isAllowedGoalPair)',
    (p, s) => {
      const allowed = ALLOWED.includes(key(p, s));
      expect(isAllowedGoalPair(p, s)).toBe(allowed);
      expect(goalSelectionSchema.safeParse({ primary: p, secondary: s }).success).toBe(allowed);
    },
  );

  it('verboten: dasselbe Ziel doppelt, Definition + Abnehmen/Muskelaufbau, Fitness als Nebenziel', () => {
    for (const goal of GOAL_TYPES) expect(isAllowedGoalPair(goal, goal)).toBe(false);
    for (const other of ['fat_loss', 'muscle_gain'] as const) {
      expect(isAllowedGoalPair('definition', other)).toBe(false);
      expect(isAllowedGoalPair(other, 'definition')).toBe(false);
    }
    for (const goal of GOAL_TYPES) expect(isAllowedGoalPair(goal, 'general_fitness')).toBe(false);
  });

  it('kein Nebenziel ist immer erlaubt; Standard null (Wächter B1); strikt', () => {
    for (const goal of GOAL_TYPES) {
      expect(isAllowedGoalPair(goal, null)).toBe(true);
      expect(isAllowedGoalPair(goal, undefined)).toBe(true);
      expect(goalSelectionSchema.parse({ primary: goal })).toEqual({
        primary: goal,
        secondary: null,
      });
    }
    expect(goalSelectionSchema.safeParse({ primary: 'fat_loss', tertiary: 'x' }).success).toBe(
      false,
    );
    expect(goalSelectionSchema.safeParse({ primary: 'kraft' }).success).toBe(false);
    expect(goalSelectionSchema.safeParse({ primary: 'fat_loss', secondary: 'kraft' }).success).toBe(
      false,
    );
  });

  it('goalProfile wirft bei einem verbotenen Paar', () => {
    expect(() =>
      goalProfile({ primary: 'definition', secondary: 'fat_loss' }, 'beginner'),
    ).toThrow();
  });
});

describe('Invariante Einzelziele (4.5): exakt die bisherigen Werte', () => {
  it.each(GOAL_TYPES.flatMap((goal) => EXPERIENCE_LEVELS.map((level) => [goal, level] as const)))(
    '%s (%s)',
    (goal, level) => {
      const profile = goalProfile({ primary: goal }, level);
      const expectedAdjustment =
        goal === 'muscle_gain'
          ? GOAL_ENERGY_ADJUSTMENT.muscle_gain[level]
          : GOAL_ENERGY_ADJUSTMENT[goal];
      expect(profile).toEqual({
        primary: goal,
        secondary: null,
        templateGoal: GOAL_TEMPLATE_MAPPING[goal].goal,
        templateKind: GOAL_TEMPLATE_MAPPING[goal].kind,
        energy: {
          adjustment: expectedAdjustment,
          // bisher DEFICIT_GOALS = fat_loss, definition; Überschuss nur muscle_gain
          direction:
            goal === 'fat_loss' || goal === 'definition'
              ? 'deficit'
              : goal === 'muscle_gain'
                ? 'surplus'
                : 'maintenance',
        },
        proteinGPerKg: PROTEIN_G_PER_KG.byGoal[goal],
        enduranceCarbs: goal === 'endurance',
        strengthGoal: goal === 'muscle_gain' || goal === 'definition' ? 'primary' : null,
        enduranceRole: goal === 'endurance' ? 'primary' : null,
        equivalentTo: null,
        notices: [],
      });
      expect(applyGoalAdjustment(goal, level, 'full')).toBe(expectedAdjustment);
      expect(applyGoalAdjustment({ primary: goal, secondary: null }, level, 'full')).toBe(
        expectedAdjustment,
      );
    },
  );
});

describe('Paare (Tabelle 4.4)', () => {
  it.each(Object.entries(TABLE_4_4))('%s', (pair, row) => {
    const [primary, secondary] = pair.split('>') as [GoalType, GoalType];
    for (const level of EXPERIENCE_LEVELS) {
      const profile = goalProfile({ primary, secondary }, level);
      expect(profile.energy.adjustment).toBe(row.energy);
      expect(profile.proteinGPerKg).toBe(row.protein);
      expect(profile.enduranceCarbs).toBe(row.carbs);
      expect(goalEnergyAdjustment({ primary, secondary }, level)).toBe(row.energy);
      expect(applyGoalAdjustment({ primary, secondary }, level, 'full')).toBe(row.energy);
      // maintenance_only → immer 0, auch bei Paaren
      expect(applyGoalAdjustment({ primary, secondary }, level, 'maintenance_only')).toBe(0);
    }
    expect(goalProteinGPerKg({ primary, secondary })).toBe(row.protein);
    expect(goalUsesEnduranceCarbs({ primary, secondary })).toBe(row.carbs);
  });

  it('GOAL_PAIR_RULES: KH-Regel genau bei Ausdauer im Paar, Eiweiß nie über der Obergrenze', () => {
    for (const rule of GOAL_PAIR_RULES) {
      expect(rule.enduranceCarbs).toBe(
        rule.primary === 'endurance' || rule.secondary === 'endurance',
      );
      expect(rule.proteinGPerKg).toBeLessThanOrEqual(PROTEIN_G_PER_KG.max);
      expect(rule.primary).not.toBe(rule.secondary);
      // Nie stärker als das stärkste Einzelziel: Defizit höchstens wie Abnehmen, Überschuss höchstens wie
      // Muskelaufbau für Einsteiger.
      expect(rule.energyAdjustment).toBeGreaterThanOrEqual(GOAL_ENERGY_ADJUSTMENT.fat_loss);
      expect(rule.energyAdjustment).toBeLessThanOrEqual(
        GOAL_ENERGY_ADJUSTMENT.muscle_gain.beginner,
      );
    }
  });
});

describe('Energie-Richtung = Vorzeichen der Anpassung (Wächter S11)', () => {
  const selections = [
    ...GOAL_TYPES.map((goal) => ({ primary: goal, secondary: null })),
    ...GOAL_COMBINATIONS.map(([primary, secondary]) => ({ primary, secondary })),
  ];

  it('energyDirectionOf', () => {
    expect(energyDirectionOf(-0.0001)).toBe('deficit');
    expect(energyDirectionOf(0)).toBe('maintenance');
    expect(energyDirectionOf(0.0001)).toBe('surplus');
  });

  it.each(selections)(
    '$primary > $secondary: Richtung = Vorzeichen, für alle Level gleich',
    (selection) => {
      for (const level of EXPERIENCE_LEVELS) {
        const profile = goalProfile(selection, level);
        expect(profile.energy.direction).toBe(
          Math.sign(profile.energy.adjustment) < 0
            ? 'deficit'
            : Math.sign(profile.energy.adjustment) > 0
              ? 'surplus'
              : 'maintenance',
        );
        expect(goalEnergyDirection(selection)).toBe(profile.energy.direction);
      }
    },
  );

  it('Überschuss nur bei positiver Anpassung: Muskelaufbau und Muskelaufbau → Ausdauer – nie Abnehmen → Muskelaufbau', () => {
    const surplus = selections
      .filter((s) => goalEnergyDirection(s) === 'surplus')
      .map((s) => key(s.primary, s.secondary));
    expect(surplus.sort()).toEqual(['muscle_gain>', 'muscle_gain>endurance']);
    expect(goalEnergyDirection({ primary: 'fat_loss', secondary: 'muscle_gain' })).toBe('deficit');
    expect(goalEnergyDirection({ primary: 'endurance', secondary: 'muscle_gain' })).toBe(
      'maintenance',
    );
  });

  it('dayCeilingKcal: ohne Richtung „Überschuss“ dieselbe Obergrenze wie bei Erhalt (Verdrahtung über nutritionTargetsForWeek in nutrition/goal-pairs.test.ts)', () => {
    const context: CalorieLimitContext = {
      bmrForFloor: 1800,
      baseNeeds: 2600,
      needs: 2600,
      limitNeeds: 2610,
      weightKg: 80,
      ffmKg: 62,
      trainingGrossKcal: 0,
      trainingCapped: false,
      mode: 'full',
      goalIsSurplus: false,
      deficitCap: 0.25,
      surplusCap: SURPLUS_CAP.default,
    };
    const plain = dayCeilingKcal(context);
    for (const selection of selections) {
      const ceiling = dayCeilingKcal({
        ...context,
        goalIsSurplus: goalEnergyDirection(selection) === 'surplus',
      });
      if (goalEnergyDirection(selection) !== 'surplus') expect(ceiling).toBe(plain);
    }
  });
});

describe('Vorlage folgt dem Hauptziel (4.3)', () => {
  it('ohne Nebenziel und bei allen Paaren außer Ausdauer + Kraft-Nebenziel = GOAL_TEMPLATE_MAPPING[Hauptziel]', () => {
    for (const [primary, secondary] of GOAL_COMBINATIONS) {
      const template = goalTemplate({ primary, secondary });
      expect(TEMPLATE_GOAL_TYPES).toContain(template.goal);
      if (primary === 'endurance' && (secondary === 'muscle_gain' || secondary === 'definition')) {
        expect(template).toEqual({ goal: 'muscle_gain', kind: 'mapped' });
      } else {
        expect(template).toEqual(GOAL_TEMPLATE_MAPPING[primary]);
      }
    }
  });

  it('Recomposition (Muskelaufbau → Abnehmen) nutzt die Muskelaufbau-Vorlage, Abnehmen → Muskelaufbau die Fettverlust-Vorlage', () => {
    expect(
      goalProfile({ primary: 'muscle_gain', secondary: 'fat_loss' }, 'beginner').templateGoal,
    ).toBe('muscle_gain');
    expect(
      goalProfile({ primary: 'fat_loss', secondary: 'muscle_gain' }, 'beginner').templateGoal,
    ).toBe('fat_loss');
    expect(goalProfile({ primary: 'endurance', secondary: 'fat_loss' }, 'beginner')).toMatchObject({
      templateGoal: 'general_fitness',
      templateKind: 'fallback',
    });
  });
});

describe('Rollen, gleichwertige Paare, Hinweise', () => {
  it('Kraft- und Ausdauer-Rolle', () => {
    const p = (primary: GoalType, secondary: GoalType | null) =>
      goalProfile({ primary, secondary }, 'advanced');
    expect(p('fat_loss', 'muscle_gain')).toMatchObject({
      strengthGoal: 'secondary',
      enduranceRole: null,
    });
    expect(p('endurance', 'definition')).toMatchObject({
      strengthGoal: 'secondary',
      enduranceRole: 'primary',
    });
    expect(p('muscle_gain', 'endurance')).toMatchObject({
      strengthGoal: 'primary',
      enduranceRole: 'secondary',
    });
    expect(p('general_fitness', 'endurance')).toMatchObject({
      strengthGoal: null,
      enduranceRole: 'secondary',
    });
    expect(hasGoal({ primary: 'general_fitness', secondary: 'fat_loss' }, 'fat_loss')).toBe(true);
    expect(hasGoal({ primary: 'general_fitness' }, 'fat_loss')).toBe(false);
  });

  it('gleichwertige Paare (Wächter K3): Muskelaufbau → Abnehmen = Definition, Fitness → Ausdauer = Ausdauer', () => {
    for (const level of EXPERIENCE_LEVELS) {
      const recomposition = goalProfile({ primary: 'muscle_gain', secondary: 'fat_loss' }, level);
      const definition = goalProfile({ primary: 'definition' }, level);
      expect(recomposition.equivalentTo).toBe('definition');
      expect(recomposition.energy).toEqual(definition.energy);
      expect(recomposition.proteinGPerKg).toBe(definition.proteinGPerKg);
      expect(recomposition.templateGoal).toBe(definition.templateGoal);
      const fitnessEndurance = goalProfile(
        { primary: 'general_fitness', secondary: 'endurance' },
        level,
      );
      const endurance = goalProfile({ primary: 'endurance' }, level);
      expect(fitnessEndurance.equivalentTo).toBe('endurance');
      expect(fitnessEndurance.energy).toEqual(endurance.energy);
      expect(fitnessEndurance.proteinGPerKg).toBe(endurance.proteinGPerKg);
      expect(fitnessEndurance.enduranceCarbs).toBe(endurance.enduranceCarbs);
      expect(fitnessEndurance.templateGoal).toBe(endurance.templateGoal);
    }
    const others = GOAL_COMBINATIONS.filter(
      ([p, s]) => key(p, s) !== 'muscle_gain>fat_loss' && key(p, s) !== 'general_fitness>endurance',
    );
    for (const [primary, secondary] of others) {
      expect(goalProfile({ primary, secondary }, 'beginner').equivalentTo).toBeNull();
    }
  });

  it('concurrent_training genau bei Muskelaufbau + Ausdauer (beide Reihenfolgen)', () => {
    for (const [primary, secondary] of GOAL_COMBINATIONS) {
      const expected =
        [primary, secondary].includes('muscle_gain') && [primary, secondary].includes('endurance');
      expect(goalProfile({ primary, secondary }, 'beginner').notices).toEqual(
        expected ? ['concurrent_training'] : [],
      );
    }
  });
});

describe('goalPairBlockReason (Tabelle 4.2, Etappe Z4)', () => {
  it('liefert genau bei verbotenen Paaren einen Grund', () => {
    for (const primary of GOAL_TYPES) {
      for (const secondary of GOAL_TYPES) {
        const reason = goalPairBlockReason(primary, secondary);
        expect(reason === null).toBe(isAllowedGoalPair(primary, secondary));
        if (reason !== null) expect(GOAL_PAIR_BLOCK_REASONS).toContain(reason);
      }
    }
  });

  it('ordnet die Gründe wie in Tabelle 4.2 zu', () => {
    expect(goalPairBlockReason('fat_loss', 'fat_loss')).toBe('same');
    expect(goalPairBlockReason('fat_loss', 'definition')).toBe('overlap');
    expect(goalPairBlockReason('definition', 'muscle_gain')).toBe('overlap');
    expect(goalPairBlockReason('muscle_gain', 'definition')).toBe('overlap');
    expect(goalPairBlockReason('fat_loss', 'general_fitness')).toBe('fitness_secondary');
    expect(goalPairBlockReason('endurance', 'general_fitness')).toBe('fitness_secondary');
    expect(goalPairBlockReason('general_fitness', 'muscle_gain')).toBe('primary_preferred');
    expect(goalPairBlockReason('general_fitness', 'definition')).toBe('primary_preferred');
    expect(goalPairBlockReason('muscle_gain', 'fat_loss')).toBeNull();
    expect(goalPairBlockReason('general_fitness', 'endurance')).toBeNull();
  });
});
