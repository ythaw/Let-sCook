import type { IngredientCategory } from '../data';

/** Where the line came from; optional on stored rows for backward compatibility. */
export type ShoppingListItemSource =
  | 'manual'
  | 'recipe'
  | 'chatbot'
  | 'suggestion';

/**
 * Optional provenance (recipe/chat flows). Keep fields small and serializable;
 * extend here as integrations land.
 */
export type ShoppingListLineMeta = {
  source?: ShoppingListItemSource;
  recipeName?: string;
};

/** One line on the shopping list (planning + in-store). */
export type ShoppingListLine = {
  id: string;
  /** Canonical name (trimmed, lowercase). */
  name: string;
  category: IngredientCategory;
  /** In shopping mode: user marks items as picked. */
  bought: boolean;
} & ShoppingListLineMeta;

export type PurchaseConfirmationResult = {
  /** Unchecked lines — stay on the list for the next trip. */
  remaining: ShoppingListLine[];
  /** Checked lines — treated as purchased; removed from the list UI. */
  purchased: ShoppingListLine[];
};

/**
 * Split list after "Confirm Purchased Items".
 * Remaining rows are reset to `bought: false` for a clean checklist next time.
 */
export function confirmPurchasedItems(
  rows: ShoppingListLine[]
): PurchaseConfirmationResult {
  const purchased = rows.filter((r) => r.bought);
  const remaining = rows
    .filter((r) => !r.bought)
    .map((r) => ({ ...r, bought: false }));
  return { remaining, purchased };
}

/** Names to pass into pantry sync (already canonical). */
export function purchasedCanonicalNames(
  purchased: ShoppingListLine[]
): string[] {
  return purchased.map((p) => p.name);
}
