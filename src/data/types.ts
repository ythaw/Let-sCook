export type MealFilter = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'vegetarian';

export type UserProfile = {
  displayName: string;
  initials: string;
  allergies: string[];
  dietaryNotes: string[];
  cuisinePreferences: string[];
  tastePreferences: string[];
  kitchenTools: string[];
  householdSize: number;
  /** Rough daily kcal target for meal planning hints */
  typicalMealKcalTarget: number;
};

export type PantryItem = {
  id: string;
  name: string;
  quantity: string;
  category: string;
  purchasedAt: string;
  expiresAt?: string;
  perishable: boolean;
};

export type RecipeIngredient = {
  name: string;
  amount: string;
};

export type DemoRecipe = {
  id: string;
  title: string;
  mealTypes: MealFilter[];
  minutes: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  caloriesPerServing: number;
  servings: number;
  cuisine: string;
  ingredients: RecipeIngredient[];
  /** Ingredient names not currently in the demo pantry */
  missingFromPantry: string[];
  steps: string[];
  emoji: string;
  /** For mock allergy checks in chat */
  allergenHints?: string[];
};
