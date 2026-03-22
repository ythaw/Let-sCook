import { INGREDIENT_CATEGORY_ORDER, type IngredientCategory } from '../data';
import type { ShoppingListLine } from './purchaseConfirmation';
import { assignShoppingItemCategory } from './shoppingItemCategory';

function sortLinesByName(rows: ShoppingListLine[]): ShoppingListLine[] {
  return [...rows].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

export function groupShoppingLinesByCategory(
  rows: ShoppingListLine[]
): Record<IngredientCategory, ShoppingListLine[]> {
  const buckets: Record<IngredientCategory, ShoppingListLine[]> = {
    produce: [],
    protein: [],
    pantry: [],
  };
  for (const row of rows) {
    buckets[row.category].push(row);
  }
  for (const cat of INGREDIENT_CATEGORY_ORDER) {
    buckets[cat] = sortLinesByName(buckets[cat]);
  }
  return buckets;
}

export function categoryForShoppingLine(canonicalName: string): IngredientCategory {
  return assignShoppingItemCategory(canonicalName);
}
