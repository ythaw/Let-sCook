import type { PantryCategoryId } from '../pantry/types';
import { classifyIngredientCategory } from '../pantry/pantryItems';

/**
 * Category for a shopping line — matches Pantry’s `classifyIngredientCategory`.
 */
export function assignShoppingItemCategory(ingredientName: string): PantryCategoryId {
  return classifyIngredientCategory(ingredientName);
}
