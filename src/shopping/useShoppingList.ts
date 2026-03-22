import { useCallback, useEffect, useRef, useState } from 'react';
import {
  confirmPurchasedItems as partitionConfirmedPurchases,
  purchasedCanonicalNames,
  type ShoppingListLine,
  type ShoppingListLineMeta,
} from './purchaseConfirmation';
import { buildShoppingLinesToAppend } from './shoppingBatchAdd';
import { newShoppingListItemId, normalizeShoppingItemInput } from './shoppingListInput';
import { assignShoppingItemCategory } from './shoppingItemCategory';
import {
  syncPurchasedItemsToPantry,
  type PantryHandoffResult,
} from './pantryHandoff';
import {
  loadShoppingListFromStorage,
  mergeHydratedShoppingList,
  saveShoppingListToStorage,
} from './shoppingListStorage';

export type AddShoppingItemResult =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'duplicate' };

export type ConfirmShoppingPurchasesResult =
  | { ok: true; purchasedNames: string[]; purchasedCount: number }
  | { ok: false; error: string };

export type UseShoppingListOptions = {
  /** Used only when `persistKey` is not set. */
  initialItems?: ShoppingListLine[];
  /**
   * AsyncStorage key: load on mount, save whenever `items` change after hydrate.
   * Checked state (`bought`) is included in the payload.
   */
  persistKey?: string;
  /**
   * Runs after the user confirms purchased items (checked lines only).
   * Defaults to `syncPurchasedItemsToPantry` (log-only stub). Wire `usePantryContext`
   * from the screen to add purchased names to the pantry.
   */
  handoffPurchasesToPantry?: (
    canonicalNames: string[]
  ) => Promise<PantryHandoffResult>;
};

export type AddMultipleShoppingItemsResult = {
  /** Lines actually appended after normalize, batch dedupe, and vs-list dedupe. */
  addedCount: number;
};

export type UseShoppingListResult = {
  items: ShoppingListLine[];
  /** Replace all lines (AsyncStorage hydrate, remote sync, etc.). */
  setShoppingItems: (next: ShoppingListLine[]) => void;
  addShoppingItem: (
    name: string,
    meta?: ShoppingListLineMeta
  ) => AddShoppingItemResult;
  /**
   * Bulk add for recipes / chatbot: same rules as single add, batch dedupe, skips existing.
   * Optional `provenance` is applied to every line appended in this call.
   */
  addMultipleShoppingItems: (
    items: string[],
    provenance?: ShoppingListLineMeta
  ) => AddMultipleShoppingItemsResult;
  removeShoppingItem: (id: string) => void;
  toggleShoppingItem: (id: string) => void;
  /**
   * Confirms checked lines as purchased: pantry handoff, then removes them from the list.
   * Unchecked lines stay; their `bought` flags are cleared.
   */
  confirmPurchasedItems: () => Promise<ConfirmShoppingPurchasesResult>;
  getCheckedItems: () => ShoppingListLine[];
  getUncheckedItems: () => ShoppingListLine[];
};

export function useShoppingList(
  options: UseShoppingListOptions = {}
): UseShoppingListResult {
  const { initialItems = [], persistKey, handoffPurchasesToPantry } = options;
  const [items, setItems] = useState<ShoppingListLine[]>(() =>
    persistKey ? [] : initialItems
  );
  const [storageHydrated, setStorageHydrated] = useState(persistKey == null);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (!persistKey) return;
    let cancelled = false;
    void loadShoppingListFromStorage(persistKey).then((fromDisk) => {
      if (cancelled) return;
      setItems((inMemory) => mergeHydratedShoppingList(fromDisk, inMemory));
      setStorageHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [persistKey]);

  useEffect(() => {
    if (!persistKey || !storageHydrated) return;
    void saveShoppingListToStorage(items, persistKey);
  }, [items, persistKey, storageHydrated]);

  const setShoppingItems = useCallback((next: ShoppingListLine[]) => {
    setItems(next);
  }, []);

  const getCheckedItems = useCallback((): ShoppingListLine[] => {
    return items.filter((r) => r.bought);
  }, [items]);

  const getUncheckedItems = useCallback((): ShoppingListLine[] => {
    return items.filter((r) => !r.bought);
  }, [items]);

  const addShoppingItem = useCallback(
    (name: string, meta?: ShoppingListLineMeta): AddShoppingItemResult => {
      const canonical = normalizeShoppingItemInput(name);
      if (!canonical) {
        return { ok: false, reason: 'empty' };
      }

      if (itemsRef.current.some((row) => row.name === canonical)) {
        return { ok: false, reason: 'duplicate' };
      }

      const source = meta?.source ?? 'manual';
      const recipeName = meta?.recipeName;

      setItems((prev) => {
        if (prev.some((row) => row.name === canonical)) return prev;
        const line: ShoppingListLine = {
          id: newShoppingListItemId(),
          name: canonical,
          category: assignShoppingItemCategory(canonical),
          bought: false,
          source,
        };
        if (recipeName !== undefined) line.recipeName = recipeName;
        return [...prev, line];
      });
      return { ok: true };
    },
    []
  );

  const addMultipleShoppingItems = useCallback(
    (
      rawNames: string[],
      provenance?: ShoppingListLineMeta
    ): AddMultipleShoppingItemsResult => {
      let addedCount = 0;
      setItems((prev) => {
        const { toAppend, addedCount: n } = buildShoppingLinesToAppend(
          prev,
          rawNames,
          provenance
        );
        addedCount = n;
        if (toAppend.length === 0) return prev;
        return [...prev, ...toAppend];
      });
      return { addedCount };
    },
    []
  );

  const removeShoppingItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const toggleShoppingItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, bought: !row.bought } : row
      )
    );
  }, []);

  const confirmPurchasedItems = useCallback(async (): Promise<ConfirmShoppingPurchasesResult> => {
    const snapshot = itemsRef.current;
    const result = partitionConfirmedPurchases(snapshot);
    const names = purchasedCanonicalNames(result.purchased);

    const runHandoff =
      handoffPurchasesToPantry ?? syncPurchasedItemsToPantry;
    const handoff = await runHandoff(names);
    if (!handoff.ok) {
      return { ok: false, error: handoff.error };
    }

    setItems(result.remaining);
    return {
      ok: true,
      purchasedNames: names,
      purchasedCount: names.length,
    };
  }, [handoffPurchasesToPantry]);

  return {
    items,
    setShoppingItems,
    addShoppingItem,
    addMultipleShoppingItems,
    removeShoppingItem,
    toggleShoppingItem,
    confirmPurchasedItems,
    getCheckedItems,
    getUncheckedItems,
  };
}
