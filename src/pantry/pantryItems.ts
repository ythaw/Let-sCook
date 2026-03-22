/**
 * Pantry list helpers — safe to call from UI, hooks, or future services (chat, barcode).
 */

/** Trim + lowercase. Returns null if empty after trim. */
export function normalizePantryItem(raw: string): string | null {
  const n = raw.trim().toLowerCase();
  return n.length > 0 ? n : null;
}

export type AddPantryItemResult = {
  items: string[];
  added: boolean;
};

/** Returns next list and whether a new unique item was appended (items stay normalized). */
export function addPantryItemDeduped(
  prev: string[],
  raw: string
): AddPantryItemResult {
  const normalized = normalizePantryItem(raw);
  if (!normalized) return { items: prev, added: false };
  if (prev.includes(normalized)) return { items: prev, added: false };
  return { items: [...prev, normalized], added: true };
}

export type AddMultiplePantryItemsResult = {
  items: string[];
  /** How many new entries were appended (after normalize + batch dedupe + pantry dedupe). */
  addedCount: number;
};

/**
 * Normalize every string, drop empties, dedupe within `rawItems` (first occurrence wins),
 * then append only names not already in `prev`. Order of new items follows `rawItems`.
 */
export function addMultiplePantryItemsDeduped(
  prev: string[],
  rawItems: string[]
): AddMultiplePantryItemsResult {
  const existing = new Set(prev);
  const seenInBatch = new Set<string>();
  const toAppend: string[] = [];

  for (const raw of rawItems) {
    const n = normalizePantryItem(raw);
    if (!n || seenInBatch.has(n)) continue;
    seenInBatch.add(n);
    if (existing.has(n)) continue;
    existing.add(n);
    toAppend.push(n);
  }

  if (toAppend.length === 0) {
    return { items: prev, addedCount: 0 };
  }
  return { items: [...prev, ...toAppend], addedCount: toAppend.length };
}
