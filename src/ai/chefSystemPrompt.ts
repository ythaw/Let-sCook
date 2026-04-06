import {
  computeRecipeMissingFromPantry,
  DEMO_RECIPES,
} from '../data';
import type { UserProfile } from '../data/types';
import type { PantryStockItem } from '../pantry/types';

export function buildChefSystemPrompt(
  homeRecommendedTitles: string[],
  pantryItems: PantryStockItem[],
  userProfile: UserProfile
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
${JSON.stringify(userProfile, null, 2)}

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

**Reply length and structure (critical — avoid cut-off mid-sentence):**
- Every reply must be short enough to finish naturally in one message. Do not write huge walls of text.
- If the user asks for several ideas (e.g. “suggest 3 meals” or multiple options): give **only a compact overview**—one or two sentences of context, then **3–5 bullets or lines** (title + rough time/difficulty/hook per option). **Do not** paste full ingredients or full step-by-step for more than one recipe in that same reply.
- Always end those overview replies with clear **follow-ups**, e.g. ask which dish they want deep detail on, or invite them to say “tell me more about [recipe name]” for ingredients and steps.
- **Full detail mode:** When the user picks one recipe or asks for “full detail”, “steps”, or “ingredients” for a **single** named dish, then give the complete walkthrough (ingredients, steps, times, notes) for **that recipe only** in that reply—still in clear sections, not endless repetition.
- If you are unsure you can fit everything, prioritize: summary + invitation to continue in the next message rather than truncating mid-step.`;
}
