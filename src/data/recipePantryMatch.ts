import { normalizePantryName } from '../pantry/pantryItems';
import type { PantryStockItem } from '../pantry/types';
import type { DemoRecipe } from './types';

export type ConsumptionPreviewLine = {
  pantryItemName: string;
  before: number;
  after: number;
  removesItem: boolean;
};

/** Simulate −1 unit per matched pantry row for each recipe ingredient line (best-effort). */
export function previewRecipeConsumption(
  recipe: DemoRecipe,
  pantryItems: PantryStockItem[]
): ConsumptionPreviewLine[] {
  const sim = pantryItems.map((x) => ({ ...x }));
  const lines: ConsumptionPreviewLine[] = [];
  for (const ing of recipe.ingredients) {
    const idx = sim.findIndex(
      (p) => p.quantity > 0 && pantryCoversIngredient(ing.name, [p])
    );
    if (idx < 0) continue;
    const p = sim[idx];
    const before = p.quantity;
    const after = before - 1;
    lines.push({
      pantryItemName: p.name,
      before,
      after,
      removesItem: before <= 1,
    });
    if (before <= 1) sim.splice(idx, 1);
    else sim[idx] = { ...p, quantity: after };
  }
  return lines;
}

export function applyRecipeConsumption(
  recipe: DemoRecipe,
  pantryItems: PantryStockItem[]
): PantryStockItem[] {
  const sim = pantryItems.map((x) => ({ ...x }));
  for (const ing of recipe.ingredients) {
    const idx = sim.findIndex(
      (p) => p.quantity > 0 && pantryCoversIngredient(ing.name, [p])
    );
    if (idx < 0) continue;
    const p = sim[idx];
    if (p.quantity <= 1) sim.splice(idx, 1);
    else sim[idx] = { ...p, quantity: p.quantity - 1 };
  }
  return sim;
}

/** Remove common quantity fragments so "200 g Spaghetti" still matches "spaghetti". */
function ingredientSearchBlob(name: string): string {
  return normalizePantryName(
    name
      .replace(/\b\d+(\.\d+)?\s*(g|kg|ml|l|oz|lb|cups?|tbsp|tsp|cloves?|pcs?|pieces?)\b/gi, '')
      .replace(/\b½|¼|¾\b/g, '')
      .replace(/\s+/g, ' ')
  );
}

export function pantryCoversIngredient(
  ingredientName: string,
  pantryItems: PantryStockItem[]
): boolean {
  const ing =
    ingredientSearchBlob(ingredientName) || normalizePantryName(ingredientName);
  if (!ing) return true;
  if (pantryItems.length === 0) return false;

  for (const p of pantryItems) {
    const pn = normalizePantryName(p.name);
    if (!pn) continue;
    if (pn.includes(ing) || ing.includes(pn)) return true;

    const ingTok = ing.split(/\s+/).filter((t) => t.length > 2);
    for (const t of ingTok) {
      if (pn.includes(t)) return true;
    }
    const pnTok = pn.split(/\s+/).filter((t) => t.length > 2);
    for (const t of pnTok) {
      if (ing.includes(t)) return true;
    }
  }
  return false;
}

/** Ingredient display names the user still needs, based on live pantry. */
export function computeRecipeMissingFromPantry(
  recipe: DemoRecipe,
  pantryItems: PantryStockItem[]
): string[] {
  return recipe.ingredients
    .filter((x) => !pantryCoversIngredient(x.name, pantryItems))
    .map((x) => x.name);
}

export function getRecipesFullyInPantry(
  recipes: DemoRecipe[],
  pantryItems: PantryStockItem[]
): DemoRecipe[] {
  return recipes.filter(
    (r) => computeRecipeMissingFromPantry(r, pantryItems).length === 0
  );
}

export function getRecipesAlmostInPantry(
  recipes: DemoRecipe[],
  pantryItems: PantryStockItem[]
): DemoRecipe[] {
  return recipes.filter((r) => {
    const m = computeRecipeMissingFromPantry(r, pantryItems);
    return m.length > 0 && m.length <= 2;
  });
}
