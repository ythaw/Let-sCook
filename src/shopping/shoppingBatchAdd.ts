import type {
  ShoppingListLine,
  ShoppingListLineMeta,
} from './purchaseConfirmation';
import { assignShoppingItemCategory } from './shoppingItemCategory';
import { newShoppingListItemId, normalizeShoppingItemInput } from './shoppingListInput';

export type BuildShoppingBatchResult = {
  /** New lines to append (normalized names, categories set, `bought: false`). */
  toAppend: ShoppingListLine[];
  /** How many lines will be added (after normalize, batch dedupe, vs existing dedupe). */
  addedCount: number;
};

/**
 * From raw strings, build shopping lines that are not already on the list.
 * - Normalizes each name (trim, collapse spaces, lowercase); drops empties.
 * - Dedupes within the batch (first occurrence keeps order).
 * - Skips any canonical name already present on `existingLines`.
 */
export function buildShoppingLinesToAppend(
  existingLines: ShoppingListLine[],
  rawNames: string[],
  provenance?: ShoppingListLineMeta
): BuildShoppingBatchResult {
  const existingNames = new Set(existingLines.map((r) => r.name));
  const seenInBatch = new Set<string>();
  const toAppend: ShoppingListLine[] = [];

  for (const raw of rawNames) {
    const canonical = normalizeShoppingItemInput(raw);
    if (!canonical || seenInBatch.has(canonical)) continue;
    seenInBatch.add(canonical);
    if (existingNames.has(canonical)) continue;
    existingNames.add(canonical);
    const line: ShoppingListLine = {
      id: newShoppingListItemId(),
      name: canonical,
      category: assignShoppingItemCategory(canonical),
      bought: false,
    };
    if (provenance?.source !== undefined) line.source = provenance.source;
    if (provenance?.recipeName !== undefined) {
      line.recipeName = provenance.recipeName;
    }
    toAppend.push(line);
  }

  return { toAppend, addedCount: toAppend.length };
}

/**
 * Pure merge for tests / reducers: returns `prev` + new unique lines.
 */
export function mergeShoppingBatch(
  prev: ShoppingListLine[],
  rawNames: string[],
  provenance?: ShoppingListLineMeta
): ShoppingListLine[] {
  const { toAppend } = buildShoppingLinesToAppend(prev, rawNames, provenance);
  if (toAppend.length === 0) return prev;
  return [...prev, ...toAppend];
}
