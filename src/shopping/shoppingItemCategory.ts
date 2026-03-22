import type { IngredientCategory } from '../data';
import { ingredientCategory } from '../data';

/**
 * Category for a shopping-line ingredient from its display or raw name.
 * Uses shared keyword lists in `src/data/ingredientCategory.ts` (extend those arrays to tune behavior).
 *
 * - Produce / protein checked first; then pantry keywords; else **Pantry**.
 */
export function assignShoppingItemCategory(ingredientName: string): IngredientCategory {
  const normalized = ingredientName.trim().toLowerCase();
  return ingredientCategory(normalized);
}
