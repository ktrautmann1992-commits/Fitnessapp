import { describe, expect, it } from 'vitest';

import { computeRecipeFacts } from '../nutrition/recipe-nutrients';
import { FIXTURE_FOODS, foodLookup, ing, makeRecipe } from './nutrition-fixtures';
import { checkRecipeTrainingTags, suggestedTrainingTags } from './recipe-checks';

/** Nährstoff-Timing T3 (R22T): Markierungen vor/nach dem Training nach Nährwerten je Portion – nur gelber Hinweis. */
const foods = foodLookup(FIXTURE_FOODS);

describe('Markierungen vor/nach dem Training (R22T)', () => {
  it('Banane: passt vor dem Training, kein Hinweis', () => {
    const banana = makeRecipe({
      id: 'banane-test',
      meal_types: ['snack'],
      training_tags: ['vor_training'],
      ingredients: [ing('banane', 1, 'piece')],
    });
    const facts = computeRecipeFacts(banana, foods);
    expect(checkRecipeTrainingTags(banana, facts)).toEqual([]);
    expect(suggestedTrainingTags(banana, facts)).toContain('vor_training');
    expect(suggestedTrainingTags(banana, facts)).not.toContain('nach_training');
  });

  it('fettreiches Gericht mit „vor dem Training“ → gelber Hinweis; eiweißarm „nach dem Training“ → Hinweis', () => {
    const heavy = makeRecipe({
      id: 'schwer-test',
      meal_types: ['main'],
      training_tags: ['vor_training', 'nach_training'],
      ingredients: [ing('mascarpone', 150, 'g'), ing('spaghetti', 50, 'g')],
    });
    const issues = checkRecipeTrainingTags(heavy, computeRecipeFacts(heavy, foods));
    expect(issues.map((i) => [i.rule, i.severity])).toEqual([
      ['R22T', 'warning'],
      ['R22T', 'warning'],
    ]);
    expect(issues[0]?.message).toContain('Fett');
  });
});
