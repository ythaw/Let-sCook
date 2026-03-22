export {
  confirmPurchasedItems,
  purchasedCanonicalNames,
  type PurchaseConfirmationResult,
  type ShoppingListItemSource,
  type ShoppingListLine,
  type ShoppingListLineMeta,
} from './purchaseConfirmation';
export {
  syncPurchasedItemsToPantry,
  type PantryHandoffResult,
} from './pantryHandoff';
export { formatShoppingItemDisplay } from './shoppingListDisplay';
export {
  groupShoppingLinesByCategory,
  categoryForShoppingLine,
} from './shoppingListGrouping';
export { assignShoppingItemCategory } from './shoppingItemCategory';
export { buildSmartSuggestionsCatalog } from './buildSmartSuggestionsCatalog';
export {
  type SmartSuggestionMock,
  type SmartSuggestionTag,
} from './smartSuggestionsMock';
export {
  getSmartSuggestionById,
  refillSmartSlots,
  SMART_SUGGESTION_SLOT_COUNT,
  type SmartSlotTuple,
} from './smartSuggestionSlots';
export {
  buildShoppingLinesToAppend,
  mergeShoppingBatch,
  type BuildShoppingBatchResult,
} from './shoppingBatchAdd';
export {
  normalizeShoppingItemInput,
  newShoppingListItemId,
} from './shoppingListInput';
export {
  SHOPPING_LIST_STORAGE_KEY,
  loadShoppingListFromStorage,
  mergeHydratedShoppingList,
  saveShoppingListToStorage,
} from './shoppingListStorage';
export {
  useShoppingList,
  type AddMultipleShoppingItemsResult,
  type AddShoppingItemResult,
  type ConfirmShoppingPurchasesResult,
  type UseShoppingListOptions,
  type UseShoppingListResult,
} from './useShoppingList';
