import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IngredientCategory } from '../data';
import { INGREDIENT_CATEGORY_ORDER } from '../data';
import type {
  ShoppingListItemSource,
  ShoppingListLine,
} from './purchaseConfirmation';
import { assignShoppingItemCategory } from './shoppingItemCategory';
import { normalizeShoppingItemInput } from './shoppingListInput';

export const SHOPPING_LIST_STORAGE_KEY = '@LetsCook/shoppingList/v1';

const CATEGORY_SET = new Set<string>(INGREDIENT_CATEGORY_ORDER);

const SOURCE_VALUES = new Set<ShoppingListItemSource>([
  'manual',
  'recipe',
  'chatbot',
  'suggestion',
]);

function parseOptionalSource(raw: unknown): ShoppingListItemSource | undefined {
  if (typeof raw !== 'string' || !SOURCE_VALUES.has(raw as ShoppingListItemSource)) {
    return undefined;
  }
  return raw as ShoppingListItemSource;
}

function parseOptionalRecipeName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

function parseStoredLine(raw: unknown): ShoppingListLine | null {
  if (raw === null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length === 0) return null;
  if (typeof o.name !== 'string') return null;
  const name = normalizeShoppingItemInput(o.name);
  if (!name) return null;
  const bought = o.bought === true;
  const cat = o.category;
  const category: IngredientCategory =
    typeof cat === 'string' && CATEGORY_SET.has(cat)
      ? (cat as IngredientCategory)
      : assignShoppingItemCategory(name);
  const source = parseOptionalSource(o.source);
  const recipeName = parseOptionalRecipeName(o.recipeName);
  const line: ShoppingListLine = { id: o.id, name, category, bought };
  if (source !== undefined) line.source = source;
  if (recipeName !== undefined) line.recipeName = recipeName;
  return line;
}

function parseStoredPayload(raw: unknown): ShoppingListLine[] {
  if (!Array.isArray(raw)) return [];
  const out: ShoppingListLine[] = [];
  for (const row of raw) {
    const line = parseStoredLine(row);
    if (line) out.push(line);
  }
  return out;
}

export async function loadShoppingListFromStorage(
  key: string
): Promise<ShoppingListLine[]> {
  try {
    const json = await AsyncStorage.getItem(key);
    if (json == null || json === '') return [];
    const parsed: unknown = JSON.parse(json);
    return parseStoredPayload(parsed);
  } catch {
    return [];
  }
}

export async function saveShoppingListToStorage(
  items: ShoppingListLine[],
  key: string
): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Quota or platform errors: keep in-memory list usable.
  }
}

/**
 * If the user changed the list before AsyncStorage finished loading, keep in-memory
 * rows and append disk-only rows (by canonical name) so nothing is silently dropped.
 */
export function mergeHydratedShoppingList(
  fromDisk: ShoppingListLine[],
  inMemory: ShoppingListLine[]
): ShoppingListLine[] {
  if (inMemory.length === 0) return fromDisk;
  const seen = new Set(inMemory.map((r) => r.name));
  const extra = fromDisk.filter((r) => !seen.has(r.name));
  return [...inMemory, ...extra];
}
