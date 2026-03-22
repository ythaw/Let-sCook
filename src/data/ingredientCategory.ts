export type IngredientCategory = 'produce' | 'protein' | 'pantry';

export const INGREDIENT_CATEGORY_ORDER: IngredientCategory[] = [
  'produce',
  'protein',
  'pantry',
];

export const INGREDIENT_CATEGORY_LABELS: Record<IngredientCategory, string> = {
  produce: 'Produce',
  protein: 'Protein',
  pantry: 'Pantry',
};

/**
 * Produce keywords (substring match, lowercased name). Extend this list to tune categorization.
 */
export const PRODUCE_KEYWORD_HINTS: readonly string[] = [
  'lettuce',
  'spinach',
  'kale',
  'arugula',
  'onion',
  'garlic',
  'tomato',
  'carrot',
  'potato',
  'pepper',
  'celery',
  'cucumber',
  'broccoli',
  'cauliflower',
  'zucchini',
  'squash',
  'mushroom',
  'corn',
  'apple',
  'banana',
  'orange',
  'lemon',
  'lime',
  'berry',
  'avocado',
  'cilantro',
  'parsley',
  'basil',
  'mint',
  'scallion',
  'green onion',
  'asparagus',
  'cabbage',
  'chard',
  'herb',
  'ginger',
  'eggplant',
];

/**
 * Protein keywords (substring match). Checked after produce.
 */
export const PROTEIN_KEYWORD_HINTS: readonly string[] = [
  'chicken',
  'beef',
  'pork',
  'turkey',
  'lamb',
  'duck',
  'steak',
  'bacon',
  'sausage',
  'salmon',
  'tuna',
  'fish',
  'shrimp',
  'prawn',
  'cod',
  'tilapia',
  'egg',
  'tofu',
  'tempeh',
  'yogurt',
  'cheese',
  'milk',
  'ricotta',
  'mozzarella',
  'feta',
  'paneer',
];

/**
 * Pantry / dry goods hints. Checked after produce + protein so e.g. "tomato paste" can still be produce first if you add "tomato" hit.
 * Anything that matches none of the three buckets still defaults to Pantry.
 */
export const PANTRY_KEYWORD_HINTS: readonly string[] = [
  'rice',
  'pasta',
  'flour',
  'soy sauce',
  'olive oil',
  'vinegar',
  'sugar',
  'salt',
  'honey',
  'noodle',
  'couscous',
  'quinoa',
  'oats',
  'cereal',
  'stock',
  'broth',
  'oil',
  'spice',
  'seasoning',
];

/**
 * Keyword buckets — order: produce → protein → pantry hints → default Pantry.
 */
export function ingredientCategory(name: string): IngredientCategory {
  const n = name.toLowerCase();

  if (PRODUCE_KEYWORD_HINTS.some((kw) => n.includes(kw))) return 'produce';
  if (PROTEIN_KEYWORD_HINTS.some((kw) => n.includes(kw))) return 'protein';
  if (PANTRY_KEYWORD_HINTS.some((kw) => n.includes(kw))) return 'pantry';
  return 'pantry';
}
