import { normalizeShoppingItemInput } from './shoppingListInput';
import type { SmartSuggestionMock } from './smartSuggestionsMock';

export const SMART_SUGGESTION_SLOT_COUNT = 3;

export type SmartSlotTuple = [
  string | null,
  string | null,
  string | null,
];

type Scored = { suggestion: SmartSuggestionMock; sourceIndex: number };

function collectEligibleScored(
  catalog: readonly SmartSuggestionMock[],
  dismissed: ReadonlySet<string>,
  onList: ReadonlySet<string>
): Scored[] {
  const out: Scored[] = [];
  catalog.forEach((suggestion, sourceIndex) => {
    if (dismissed.has(suggestion.id)) return;
    const c = normalizeShoppingItemInput(suggestion.addName);
    if (!c || onList.has(c)) return;
    out.push({ suggestion, sourceIndex });
  });
  return out;
}

export function getSmartSuggestionById(
  id: string | null,
  catalog: readonly SmartSuggestionMock[]
): SmartSuggestionMock | undefined {
  if (!id) return undefined;
  return catalog.find((s) => s.id === id);
}

/**
 * Picks the top three eligible suggestions by `suitabilityScore` (higher first).
 * `catalog` should come from `buildSmartSuggestionsCatalog(pantryItems)`.
 */
export function refillSmartSlots(
  catalog: readonly SmartSuggestionMock[],
  _slots: SmartSlotTuple,
  dismissed: ReadonlySet<string>,
  onList: ReadonlySet<string>
): SmartSlotTuple {
  const eligible = collectEligibleScored(catalog, dismissed, onList);
  eligible.sort((a, b) => {
    const d = b.suggestion.suitabilityScore - a.suggestion.suitabilityScore;
    if (d !== 0) return d;
    return a.sourceIndex - b.sourceIndex;
  });

  const top = eligible.slice(0, SMART_SUGGESTION_SLOT_COUNT);
  return [
    top[0]?.suggestion.id ?? null,
    top[1]?.suggestion.id ?? null,
    top[2]?.suggestion.id ?? null,
  ] as SmartSlotTuple;
}
