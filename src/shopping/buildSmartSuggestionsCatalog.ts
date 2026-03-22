import { DEMO_RECIPES } from '../data/demoRecipes';
import {
  computeRecipeMissingFromPantry,
  getRecipesAlmostInPantry,
  getRecipesFullyInPantry,
  pantryCoversIngredient,
} from '../data/recipePantryMatch';
import {
  capitalizeWords,
  classifyIngredientCategory,
  createPantryStockItem,
} from '../pantry/pantryItems';
import type { PantryStockItem } from '../pantry/types';
import { normalizeShoppingItemInput } from './shoppingListInput';
import type { SmartSuggestionMock } from './smartSuggestionsMock';

type Agg = {
  normalized: string;
  displayName: string;
  recipes: { id: string; title: string }[];
};

function aggregateAlmostThere(pantry: PantryStockItem[]): Agg[] {
  const map = new Map<string, Agg>();
  const almost = getRecipesAlmostInPantry(DEMO_RECIPES, pantry);
  for (const r of almost) {
    const missing = computeRecipeMissingFromPantry(r, pantry);
    for (const miss of missing) {
      const n = normalizeShoppingItemInput(miss);
      if (!n) continue;
      let entry = map.get(n);
      if (!entry) {
        entry = {
          normalized: n,
          displayName: capitalizeWords(miss.trim()),
          recipes: [],
        };
        map.set(n, entry);
      }
      if (!entry.recipes.some((x) => x.id === r.id)) {
        entry.recipes.push({ id: r.id, title: r.title });
      }
    }
  }
  const list = [...map.values()];
  list.sort((a, b) => {
    const d = b.recipes.length - a.recipes.length;
    if (d !== 0) return d;
    return a.normalized.localeCompare(b.normalized);
  });
  return list;
}

function detailForAlmost(a: Agg): string {
  if (a.recipes.length === 1) {
    return `Last ingredient for “${a.recipes[0].title}” — you’re one shop away from cooking it.`;
  }
  return `Finishes ${a.recipes.length} meals you’re close to, starting with “${a.recipes[0].title}”.`;
}

function buildAlmostThereMocks(pantry: PantryStockItem[]): SmartSuggestionMock[] {
  const aggs = aggregateAlmostThere(pantry);
  let score = 100;
  return aggs.map((a) => {
    const mock: SmartSuggestionMock = {
      id: `smart-almost-${a.normalized}`,
      addName: a.displayName,
      label: a.displayName,
      detail: detailForAlmost(a),
      tag: 'recipe',
      recipeName: a.recipes[0].title,
      suitabilityScore: score,
    };
    score = Math.max(70, score - 1);
    return mock;
  });
}

/** Staples we evaluate for “unlocks more cookable recipes” when added to pantry. */
const STAPLE_SHOPPING: { addName: string; label: string }[] = [
  { addName: 'rice', label: 'Rice' },
  { addName: 'pasta', label: 'Pasta' },
  { addName: 'eggs', label: 'Eggs' },
  { addName: 'onions', label: 'Onions' },
  { addName: 'olive oil', label: 'Olive oil' },
  { addName: 'butter', label: 'Butter' },
  { addName: 'milk', label: 'Milk' },
  { addName: 'chicken breast', label: 'Chicken breast' },
  { addName: 'garlic', label: 'Garlic' },
  { addName: 'potatoes', label: 'Potatoes' },
  { addName: 'heavy cream', label: 'Heavy cream' },
  { addName: 'canned tomatoes', label: 'Canned tomatoes' },
  { addName: 'soy sauce', label: 'Soy sauce' },
];

function fullyStockedCount(p: PantryStockItem[]): number {
  return getRecipesFullyInPantry(DEMO_RECIPES, p).length;
}

function buildStapleMocks(
  pantry: PantryStockItem[],
  excludeNormalized: Set<string>
): SmartSuggestionMock[] {
  const baseFull = fullyStockedCount(pantry);
  const candidates: SmartSuggestionMock[] = [];

  for (const { addName, label } of STAPLE_SHOPPING) {
    const n = normalizeShoppingItemInput(addName);
    if (!n || excludeNormalized.has(n)) continue;
    if (pantryCoversIngredient(addName, pantry)) continue;

    const virtual: PantryStockItem[] = [
      ...pantry,
      createPantryStockItem({
        name: label,
        category: classifyIngredientCategory(addName),
        quantity: 1,
      }),
    ];
    const delta = fullyStockedCount(virtual) - baseFull;
    if (delta <= 0) continue;

    const detail =
      delta === 1
        ? 'Unlocks 1 more recipe from your list with what you already have at home.'
        : `Unlocks ${delta} more recipes you can make once this is in your pantry.`;

    candidates.push({
      id: `smart-staple-${n}`,
      addName,
      label,
      detail,
      tag: 'smart',
      /** Keep below “almost there” rows (those start at 100, floor 70). */
      suitabilityScore: Math.min(55, 38 + Math.min(17, delta * 4)),
    });
  }

  candidates.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  return candidates;
}

/**
 * Shopping smart suggestions: (1) missing ingredients for “almost there” recipes,
 * (2) staple items that increase how many demo recipes are fully cookable with your pantry.
 */
export function buildSmartSuggestionsCatalog(
  pantryItems: PantryStockItem[]
): SmartSuggestionMock[] {
  const almost = buildAlmostThereMocks(pantryItems);
  const exclude = new Set(
    almost
      .map((m) => normalizeShoppingItemInput(m.addName))
      .filter((x): x is string => Boolean(x))
  );
  const staples = buildStapleMocks(pantryItems, exclude);
  return [...almost, ...staples];
}
