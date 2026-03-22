import type { PantryCategoryId } from '../pantry/types';
import { PANTRY_CATEGORY_ORDER } from '../pantry/types';
import type { ShoppingListLine } from './purchaseConfirmation';
import { assignShoppingItemCategory } from './shoppingItemCategory';

function sortLinesByName(rows: ShoppingListLine[]): ShoppingListLine[] {
  return [...rows].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

function emptyBuckets(): Record<PantryCategoryId, ShoppingListLine[]> {
  return {
    produce: [],
    dairy: [],
    meat_seafood: [],
    dry_goods: [],
    spices: [],
    frozen: [],
  };
}

export function groupShoppingLinesByCategory(
  rows: ShoppingListLine[]
): Record<PantryCategoryId, ShoppingListLine[]> {
  const buckets = emptyBuckets();
  for (const row of rows) {
    buckets[row.category].push(row);
  }
  for (const cat of PANTRY_CATEGORY_ORDER) {
    buckets[cat] = sortLinesByName(buckets[cat]);
  }
  return buckets;
}

export function categoryForShoppingLine(canonicalName: string): PantryCategoryId {
  return assignShoppingItemCategory(canonicalName);
}
