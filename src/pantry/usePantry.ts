import { useCallback, useRef, useState } from 'react';
import { applyRecipeConsumption } from '../data/recipePantryMatch';
import type { DemoRecipe } from '../data/types';
import { createPantryStockItem, normalizePantryName } from './pantryItems';
import type { PantryCategoryId, PantryStockItem } from './types';

export type ParsedPantryImport = {
  name: string;
  category: PantryCategoryId;
  quantity: number;
  unit?: string;
};

export type UsePantryResult = {
  items: PantryStockItem[];
  getPantryItems: () => PantryStockItem[];
  addItem: (input: {
    name: string;
    category: PantryCategoryId;
    quantity: number;
    unitLabel?: string;
  }) => void;
  updateQuantity: (id: string, quantity: number) => void;
  adjustQuantity: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
  importParsedItems: (rows: ParsedPantryImport[]) => {
    added: number;
    merged: number;
  };
  /** Subtract ~1 unit per ingredient match (see previewRecipeConsumption). */
  consumeRecipeIngredients: (recipe: DemoRecipe) => void;
};

export function usePantry(initialItems: PantryStockItem[] = []): UsePantryResult {
  const [items, setItems] = useState<PantryStockItem[]>(initialItems);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const getPantryItems = useCallback(() => [...itemsRef.current], []);

  const addItem = useCallback(
    (input: {
      name: string;
      category: PantryCategoryId;
      quantity: number;
      unitLabel?: string;
    }) => {
      const row = createPantryStockItem({
        name: input.name,
        category: input.category,
        quantity: input.quantity,
        unitLabel: input.unitLabel,
      });
      setItems((prev) => [...prev, row]);
    },
    []
  );

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((prev) => {
      const q = Math.max(0, Math.floor(quantity));
      if (q <= 0) {
        return prev.filter((x) => x.id !== id);
      }
      return prev.map((x) => (x.id === id ? { ...x, quantity: q } : x));
    });
  }, []);

  const adjustQuantity = useCallback((id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((x) => {
          if (x.id !== id) return x;
          const q = x.quantity + delta;
          if (q < 1) return null;
          return { ...x, quantity: q };
        })
        .filter((x): x is PantryStockItem => x != null)
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const importParsedItems = useCallback((rows: ParsedPantryImport[]) => {
    let added = 0;
    let merged = 0;
    setItems((prev) => {
      const next = [...prev];
      for (const row of rows) {
        const norm = normalizePantryName(row.name);
        if (!norm) continue;
        const idx = next.findIndex((x) => normalizePantryName(x.name) === norm);
        const qty = Math.max(1, Math.floor(row.quantity || 1));
        if (idx >= 0) {
          const cur = next[idx];
          next[idx] = {
            ...cur,
            quantity: cur.quantity + qty,
            unitLabel: row.unit?.trim() || cur.unitLabel,
          };
          merged += 1;
        } else {
          next.push(
            createPantryStockItem({
              name: row.name,
              category: row.category,
              quantity: qty,
              unitLabel: row.unit,
            })
          );
          added += 1;
        }
      }
      return next;
    });
    return { added, merged };
  }, []);

  const consumeRecipeIngredients = useCallback((recipe: DemoRecipe) => {
    setItems((prev) => applyRecipeConsumption(recipe, prev));
  }, []);

  return {
    items,
    getPantryItems,
    addItem,
    updateQuantity,
    adjustQuantity,
    removeItem,
    importParsedItems,
    consumeRecipeIngredients,
  };
}
