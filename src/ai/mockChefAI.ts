import type { DemoRecipe, UserProfile } from '../data/types';
import {
  computeRecipeMissingFromPantry,
  DEMO_PROFILE,
  DEMO_RECIPES,
  getRecipesAlmostInPantry,
  getRecipesFullyInPantry,
} from '../data';
import type { PantryStockItem } from '../pantry/types';

function profileSummary(p: UserProfile): string {
  return [
    `Household: ${p.householdSize} · Target ~${p.typicalMealKcalTarget} kcal/meal`,
    `Allergies: ${p.allergies.join(', ') || 'none recorded'}`,
    `Cuisines you like: ${p.cuisinePreferences.join(', ')}`,
    `Taste: ${p.tastePreferences.join(', ')}`,
    `Tools: ${p.kitchenTools.join(', ')}`,
  ].join('\n');
}

function lowStockHighlight(items: PantryStockItem[]): string {
  const low = items.filter((i) => i.quantity <= i.lowStockAt);
  if (low.length === 0) return '';
  return `Items running low: ${low.map((i) => i.name).join(', ')}. `;
}

function formatPantryLines(items: PantryStockItem[]): string {
  if (items.length === 0) {
    return 'Your in-app pantry is empty — add items on the Pantry tab or send a grocery photo to the AI there.';
  }
  return items
    .map(
      (i) =>
        `• ${i.name} — ×${i.quantity}${i.unitLabel ? ` ${i.unitLabel}` : ''} (${i.category})`
    )
    .join('\n');
}

function allergyConflict(
  recipe: DemoRecipe,
  profile: UserProfile
): string | null {
  const hints = recipe.allergenHints ?? [];
  const hit = hints.find((h) =>
    profile.allergies.some((a) => a.toLowerCase().includes(h.toLowerCase()))
  );
  if (hit) {
    return `Allergy note: "${recipe.title}" may involve ${hit} — skip or substitute safely.`;
  }
  return null;
}

export function formatRecipePlan(
  recipe: DemoRecipe,
  profile: UserProfile,
  liveMissing?: string[]
): string {
  const warn = allergyConflict(recipe, profile);
  const ing = recipe.ingredients.map((x) => `• ${x.amount} ${x.name}`).join('\n');
  const steps = recipe.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const missingList = liveMissing ?? recipe.missingFromPantry;
  const missing =
    missingList.length > 0
      ? `\n\nYou’d still need: ${missingList.map((m) => `+ ${m}`).join(', ')}.`
      : '';

  return [
    `${recipe.title} (${recipe.cuisine})`,
    `⏱ ${recipe.minutes} min · ${recipe.difficulty} · ~${recipe.caloriesPerServing} kcal/serving · ${recipe.servings} servings (adjust for ${profile.householdSize} people).`,
    warn ? `\n${warn}` : '',
    `\nIngredients\n${ing}`,
    `\nStep by step\n${steps}`,
    missing,
  ]
    .filter(Boolean)
    .join('');
}

function findRecipeByMention(text: string): DemoRecipe | undefined {
  const t = text.toLowerCase();
  return DEMO_RECIPES.find((r) => {
    const title = r.title.toLowerCase();
    if (t.includes(title)) return true;
    return title
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .some((w) => t.includes(w));
  });
}

function pickSuggestion(recipes: DemoRecipe[], profile: UserProfile): DemoRecipe {
  const preferred = recipes.filter((r) =>
    profile.cuisinePreferences.some((c) =>
      r.cuisine.toLowerCase().includes(c.toLowerCase())
    )
  );
  const pool = preferred.length ? preferred : recipes;
  return pool[0] ?? recipes[0];
}

export function explainRecipeById(
  recipeId: string,
  pantryItems?: PantryStockItem[]
): string | null {
  const recipe = DEMO_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return null;
  const missing =
    pantryItems != null
      ? computeRecipeMissingFromPantry(recipe, pantryItems)
      : recipe.missingFromPantry;
  return formatRecipePlan(recipe, DEMO_PROFILE, missing);
}

/**
 * Offline / fallback chef — uses the same live pantry as the rest of the app.
 */
export function getMockChefReply(
  userMessage: string,
  pantryItems: PantryStockItem[]
): string {
  const profile = DEMO_PROFILE;
  const lower = userMessage.toLowerCase().trim();
  if (!lower) {
    return 'Ask me what to cook, how to fix a dish, or say a recipe name for step-by-step help.';
  }

  const byName = findRecipeByMention(userMessage);
  if (byName) {
    const missing = computeRecipeMissingFromPantry(byName, pantryItems);
    return formatRecipePlan(byName, profile, missing);
  }

  if (
    /suggest|what should i|ideas|tonight|dinner|lunch|breakfast|meal plan/.test(
      lower
    )
  ) {
    const stocked = getRecipesFullyInPantry(DEMO_RECIPES, pantryItems);
    const almost = getRecipesAlmostInPantry(DEMO_RECIPES, pantryItems);
    const useFirst = lowStockHighlight(pantryItems);
    if (stocked.length > 0) {
      const choice = pickSuggestion(stocked, profile);
      return `${useFirst}Based on your saved preferences and current pantry, I’d start with:\n\n${formatRecipePlan(choice, profile, computeRecipeMissingFromPantry(choice, pantryItems))}`;
    }
    if (almost.length > 0) {
      const choice = pickSuggestion(almost, profile);
      const miss = computeRecipeMissingFromPantry(choice, pantryItems);
      return `${useFirst}You’re close — pick up ${miss.join(', ')} for:\n\n${formatRecipePlan(choice, profile, miss)}`;
    }
    return `${useFirst}Nothing in the recipe list fully matches your pantry yet. Open Pantry to add ingredients, or ask for a recipe by name.`;
  }

  if (/pantry|what do i have|expire|perish|stock/.test(lower)) {
    return `Here’s what’s in your app pantry:\n${formatPantryLines(pantryItems)}`;
  }

  if (/allerg|diet|preference|profile/.test(lower)) {
    return `From your profile (you won’t need to repeat this each time):\n${profileSummary(profile)}`;
  }

  if (/calorie|nutrition|kcal|macro/.test(lower)) {
    return `For any recipe in this demo, ask by name (e.g. “Pasta Aglio e Olio nutrition”) or say “suggest” and I’ll pick one with calories per serving and timing. Your rough meal target is ~${profile.typicalMealKcalTarget} kcal.`;
  }

  if (/tool|equipment|oven|blender|pot/.test(lower)) {
    return `Your saved tools: ${profile.kitchenTools.join(', ')}. Tell me a dish and I’ll keep instructions compatible (e.g. no pressure-cooker steps if you don’t list one).`;
  }

  return [
    'I’m the offline chef — I see your live Pantry list from the app.',
    'Try: “Suggest dinner”, “What’s in my pantry?”, a recipe name, or “My allergies”.',
    `\nYour context snapshot:\n${profileSummary(profile)}`,
  ].join('\n');
}
