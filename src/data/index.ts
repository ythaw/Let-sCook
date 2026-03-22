export * from './types';
export {
  INGREDIENT_CATEGORY_LABELS,
  INGREDIENT_CATEGORY_ORDER,
  PANTRY_KEYWORD_HINTS,
  PRODUCE_KEYWORD_HINTS,
  PROTEIN_KEYWORD_HINTS,
  ingredientCategory,
  type IngredientCategory,
} from './ingredientCategory';
export { DEMO_PROFILE } from './demoProfile';
export { DEMO_PANTRY } from './demoPantry';
export { DEMO_RECIPES } from './demoRecipes';

import type { DemoRecipe, MealFilter } from './types';
import { DEMO_RECIPES } from './demoRecipes';

export function filterRecipesByMeal(
  recipes: DemoRecipe[],
  filter: MealFilter
): DemoRecipe[] {
  if (filter === 'all') return recipes;
  return recipes.filter((r) => r.mealTypes.includes(filter));
}

export function getFullyStockedRecipes(recipes: DemoRecipe[]): DemoRecipe[] {
  return recipes.filter((r) => r.missingFromPantry.length === 0);
}

export function getAlmostThereRecipes(recipes: DemoRecipe[]): DemoRecipe[] {
  return recipes.filter(
    (r) => r.missingFromPantry.length > 0 && r.missingFromPantry.length <= 2
  );
}

export function getRecipeById(id: string): DemoRecipe | undefined {
  return DEMO_RECIPES.find((r) => r.id === id);
}
