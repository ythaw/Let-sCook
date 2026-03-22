import {
  computeRecipeMissingFromPantry,
  DEMO_PROFILE,
  DEMO_RECIPES,
} from '../data';
import type { PantryStockItem } from '../pantry/types';

export function buildChefSystemPrompt(
  homeRecommendedTitles: string[],
  pantryItems: PantryStockItem[]
): string {
  const pantryLine =
    pantryItems.length > 0
      ? pantryItems
          .map(
            (i) =>
              `${i.name} ×${i.quantity}${i.unitLabel ? ` (${i.unitLabel})` : ''} [${i.category}]`
          )
          .join('; ')
      : '(Pantry is empty in the app — suggest adding staples or ask the user to update pantry.)';

  const recipesPayload = DEMO_RECIPES.map((r) => ({
    id: r.id,
    title: r.title,
    cuisine: r.cuisine,
    minutes: r.minutes,
    difficulty: r.difficulty,
    caloriesPerServing: r.caloriesPerServing,
    servings: r.servings,
    mealTypes: r.mealTypes,
    ingredients: r.ingredients,
    missingFromPantry: computeRecipeMissingFromPantry(r, pantryItems),
    steps: r.steps,
    allergenHints: r.allergenHints ?? [],
  }));

  const highlight =
    homeRecommendedTitles.length > 0
      ? `\nThe user’s home screen currently highlights these in-pantry recommendations: ${homeRecommendedTitles.join(', ')}.`
      : '';

  return `You are "Sous Chef", a warm, practical cooking assistant in a mobile app.

USER PROFILE (always respect — user should not need to repeat these each time):
${JSON.stringify(DEMO_PROFILE, null, 2)}

PANTRY (what they have now):
${pantryLine}

RECIPE DATABASE (ground truth — prefer these dishes; adapt only slightly; call out missingFromPantry honestly):
${JSON.stringify(recipesPayload, null, 2)}
${highlight}

Guidelines:
- Honor allergies and dietaryNotes; warn when a recipe’s allergenHints conflict.
- Suggest meals that fit the live PANTRY list + profile; use each recipe’s missingFromPantry (computed vs that list) for “almost there” honesty.
- When giving steps, use the recipe’s steps as a base but you may clarify for the user’s tools and household size.
- Include time, servings, and calories from recipe data when relevant.
- Stay concise unless the user asks for detail.`;
}
