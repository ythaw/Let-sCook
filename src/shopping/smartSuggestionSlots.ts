import { normalizeShoppingItemInput } from './shoppingListInput';
import {
  SMART_SUGGESTION_MOCKS,
  type SmartSuggestionMock,
} from './smartSuggestionsMock';

export const SMART_SUGGESTION_SLOT_COUNT = 3;

export type SmartSlotTuple = [
  string | null,
  string | null,
  string | null,
];

const byId = new Map(
  SMART_SUGGESTION_MOCKS.map((s) => [s.id, s] as const)
);

export function getSmartSuggestionById(
  id: string | null
): SmartSuggestionMock | undefined {
  if (!id) return undefined;
  return byId.get(id);
}

type Scored = { suggestion: SmartSuggestionMock; sourceIndex: number };

function collectEligibleScored(
  dismissed: ReadonlySet<string>,
  onList: ReadonlySet<string>
): Scored[] {
  const out: Scored[] = [];
  SMART_SUGGESTION_MOCKS.forEach((suggestion, sourceIndex) => {
    if (dismissed.has(suggestion.id)) return;
    const c = normalizeShoppingItemInput(suggestion.addName);
    if (!c || onList.has(c)) return;
    out.push({ suggestion, sourceIndex });
  });
  return out;
}

/**
 * Picks the top three eligible suggestions by `suitabilityScore` (higher first).
 * Ties break on original mock order. After add/pass/list changes, the grid always
 * reflects the next most suitable options globally, not only newly empty slots.
 */
export function refillSmartSlots(
  _slots: SmartSlotTuple,
  dismissed: ReadonlySet<string>,
  onList: ReadonlySet<string>
): SmartSlotTuple {
  const eligible = collectEligibleScored(dismissed, onList);
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
