/**
 * Pantry handoff for **confirmed** in-store purchases only.
 *
 * - Call this exclusively from the "Confirm Purchased Items" flow after
 *   `confirmPurchasedItems` / `purchasedCanonicalNames`.
 * - Do **not** call when the user toggles checkboxes — checking only updates
 *   local `bought` state until they confirm.
 *
 * Default when `useShoppingList` is used without `handoffPurchasesToPantry`.
 * ShoppingListScreen wires `usePantryContext().addMultipleIngredients` instead.
 */

export type PantryHandoffResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Simulated async handoff of purchased ingredient names (canonical strings).
 * Returns when the simulated work finishes so the UI can update afterward.
 */
export async function syncPurchasedItemsToPantry(
  canonicalNames: string[]
): Promise<PantryHandoffResult> {
  if (canonicalNames.length === 0) {
    return { ok: true };
  }

  // Simulated latency / future I/O boundary.
  await Promise.resolve();

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(
      '[pantry handoff — simulated]',
      `${canonicalNames.length} item(s):`,
      canonicalNames
    );
  }

  return { ok: true };
}
