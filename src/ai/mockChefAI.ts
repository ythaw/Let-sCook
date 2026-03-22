import type { DemoRecipe, PantryItem, UserProfile } from '../data/types';
import {
  DEMO_PANTRY,
  DEMO_PROFILE,
  DEMO_RECIPES,
  getFullyStockedRecipes,
} from '../data';

function profileSummary(p: UserProfile): string {
  return [
    `Household: ${p.householdSize} · Target ~${p.typicalMealKcalTarget} kcal/meal`,
    `Allergies: ${p.allergies.join(', ') || 'none recorded'}`,
    `Cuisines you like: ${p.cuisinePreferences.join(', ')}`,
    `Taste: ${p.tastePreferences.join(', ')}`,
    `Tools: ${p.kitchenTools.join(', ')}`,
  ].join('\n');
}

function expiringSoon(pantry: PantryItem[], days = 5): PantryItem[] {
  const now = Date.now();
  const ms = days * 86400000;
  return pantry.filter((i) => {
    if (!i.expiresAt) return false;
    const t = new Date(i.expiresAt).getTime();
    return t - now >= 0 && t - now <= ms;
  });
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

export function formatRecipePlan(recipe: DemoRecipe, profile: UserProfile): string {
  const warn = allergyConflict(recipe, profile);
  const ing = recipe.ingredients.map((x) => `• ${x.amount} ${x.name}`).join('\n');
  const steps = recipe.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const missing =
    recipe.missingFromPantry.length > 0
      ? `\n\nYou’d still need: ${recipe.missingFromPantry.map((m) => `+ ${m}`).join(', ')}.`
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

export function explainRecipeById(recipeId: string): string | null {
  const recipe = DEMO_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return null;
  return formatRecipePlan(recipe, DEMO_PROFILE);
}

/**
 * Demo “chef” — swap for a real LLM + tools later.
 * See user-facing docs in the project response for production needs.
 */
export function getMockChefReply(userMessage: string): string {
  const profile = DEMO_PROFILE;
  const pantry = DEMO_PANTRY;
  const lower = userMessage.toLowerCase().trim();
  if (!lower) {
    return 'Ask me what to cook, how to fix a dish, or say a recipe name for step-by-step help.';
  }

  const byName = findRecipeByMention(userMessage);
  if (byName) {
    return formatRecipePlan(byName, profile);
  }

  if (
    /suggest|what should i|ideas|tonight|dinner|lunch|breakfast|meal plan/.test(
      lower
    )
  ) {
    const stocked = getFullyStockedRecipes(DEMO_RECIPES);
    const choice = pickSuggestion(stocked, profile);
    const soon = expiringSoon(pantry);
    const useFirst =
      soon.length > 0
        ? `Your pantry has perishables to use soon: ${soon.map((i) => i.name).join(', ')}. `
        : '';
    return `${useFirst}Based on your saved preferences, I’d start with:\n\n${formatRecipePlan(choice, profile)}`;
  }

  if (/pantry|what do i have|expire|perish/.test(lower)) {
    const soon = expiringSoon(pantry, 7);
    const lines = pantry.map((i) => {
      const ex = i.expiresAt ? ` (use by ${i.expiresAt})` : '';
      return `• ${i.name} — ${i.quantity}${ex}`;
    });
    const extra =
      soon.length > 0
        ? `\n\nUse soon: ${soon.map((i) => i.name).join(', ')}.`
        : '';
    return `Here’s your demo pantry:\n${lines.join('\n')}${extra}`;
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
    'I’m a demo chef wired to your sample pantry + profile.',
    'Try: “Suggest dinner”, “What’s in my pantry?”, “Chicken Tikka Masala step by step”, or “My allergies”.',
    `\nYour context snapshot:\n${profileSummary(profile)}`,
  ].join('\n');
}
