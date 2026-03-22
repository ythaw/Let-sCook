/**
 * Input normalization for shopping lines — shared by UI and `useShoppingList`.
 */

/** Trim ends, collapse whitespace, lowercase. Returns null if empty. */
export function normalizeShoppingItemInput(raw: string): string | null {
  const collapsed = raw.trim().replace(/\s+/g, ' ');
  const n = collapsed.toLowerCase();
  return n.length > 0 ? n : null;
}

export function newShoppingListItemId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
