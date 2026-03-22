import { useCallback, useRef, useState } from 'react';
import { addMultiplePantryItemsDeduped, addPantryItemDeduped } from './pantryItems';

export type UsePantryResult = {
  items: string[];
  /** Snapshot of current list (copy) — safe for chatbot / services to read anytime. */
  getPantryItems: () => string[];
  /** Normalizes (trim + lowercase), skips empty / duplicates. Returns true if list changed. */
  addIngredient: (item: string) => boolean;
  /**
   * Bulk add for receipt scan / AI lists: normalize all, dedupe within batch and vs pantry,
   * append only new. Returns how many were added.
   */
  addMultipleIngredients: (items: string[]) => number;
  removeIngredientAt: (index: number) => void;
};

export function usePantry(initialItems: string[] = []): UsePantryResult {
  const [items, setItems] = useState<string[]>(initialItems);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const getPantryItems = useCallback(() => [...itemsRef.current], []);

  const addIngredient = useCallback((item: string) => {
    let added = false;
    setItems((prev) => {
      const result = addPantryItemDeduped(prev, item);
      added = result.added;
      return result.items;
    });
    return added;
  }, []);

  const addMultipleIngredients = useCallback((batch: string[]) => {
    let addedCount = 0;
    setItems((prev) => {
      const result = addMultiplePantryItemsDeduped(prev, batch);
      addedCount = result.addedCount;
      return result.items;
    });
    return addedCount;
  }, []);

  const removeIngredientAt = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    items,
    getPantryItems,
    addIngredient,
    addMultipleIngredients,
    removeIngredientAt,
  };
}
