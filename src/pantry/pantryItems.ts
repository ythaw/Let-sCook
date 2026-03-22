/**
 * Pantry list helpers — normalization, classification, dedupe.
 */

import type { PantryCategoryId, PantryStockItem } from './types';
import { PANTRY_CATEGORY_ORDER } from './types';

/** Map legacy / AI labels to current category ids. */
const CATEGORY_ALIASES: Record<string, PantryCategoryId> = {
  grains: 'dry_goods',
  grain: 'dry_goods',
  pantry: 'dry_goods',
  canned: 'dry_goods',
  protein: 'meat_seafood',
  proteins: 'meat_seafood',
  meat: 'meat_seafood',
  seafood: 'meat_seafood',
  'meat & seafood': 'meat_seafood',
  'meat_seafood': 'meat_seafood',
  dry: 'dry_goods',
  'dry goods': 'dry_goods',
  dry_goods: 'dry_goods',
  oil: 'dry_goods',
  baking: 'dry_goods',
  condiments: 'dry_goods',
  frozen: 'frozen',
  spice: 'spices',
  herbs: 'spices',
  dairy_eggs: 'dairy',
  'dairy & eggs': 'dairy',
};

export function normalizePantryName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function capitalizeWords(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

/** Guess category from ingredient name when the user or model omits it. */
export function classifyIngredientCategory(name: string): PantryCategoryId {
  const n = normalizePantryName(name);

  const frozenHints = [
    'frozen',
    'ice cream',
    'popsicle',
    'waffle frozen',
    'frozen pea',
    'frozen corn',
    'frozen berry',
  ];

  const produceHints = [
    'lettuce',
    'spinach',
    'kale',
    'arugula',
    'onion',
    'garlic',
    'tomato',
    'carrot',
    'potato',
    'bell pepper',
    'celery',
    'cucumber',
    'broccoli',
    'cauliflower',
    'zucchini',
    'squash',
    'mushroom',
    'corn on',
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
    'ginger root',
    'scallions',
    'shallot',
    'radish',
    'beet',
    'eggplant',
    'aubergine',
    'romaine',
    'sprout',
    'fresh herb',
  ];

  const dairyHints = [
    'milk',
    'cream cheese',
    'cream',
    'butter',
    'cheese',
    'yogurt',
    'yoghurt',
    'ricotta',
    'mozzarella',
    'feta',
    'parmesan',
    'cheddar',
    'paneer',
    'cottage',
    'sour cream',
    'half and half',
    'heavy cream',
    'egg',
    'eggs',
    'spread',
    'not butter',
  ];

  const meatHints = [
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
    'tofu',
    'tempeh',
    'ground beef',
    'ground turkey',
    'ribs',
    'ham',
    'seafood',
    'mussel',
    'clam',
    'crab',
    'lobster',
  ];

  const dryGoodsHints = [
    'oil',
    'olive oil',
    'vegetable oil',
    'sesame oil',
    'vinegar',
    'pasta',
    'spaghetti',
    'noodle',
    'rice',
    'flour',
    'oats',
    'quinoa',
    'couscous',
    'bread',
    'cereal',
    'arborio',
    'tortilla',
    'cracker',
    'bun',
    'bagel',
    'penne',
    'macaroni',
    'linguine',
    'sugar',
    'honey',
    'maple syrup',
    'stock',
    'broth',
    'canned',
    'can ',
    'beans',
    'lentil',
    'chickpea',
    'nut ',
    'nuts',
    'almond',
    'walnut',
    'peanut butter',
    'jam',
    'jelly',
    'syrup',
    'soy sauce',
    'fish sauce',
    'worcestershire',
    'mustard',
    'ketchup',
    'mayo',
    'mayonnaise',
    'tomato passata',
    'coconut milk',
    'baking powder',
    'baking soda',
    'yeast',
    'chocolate chip',
  ];

  const spicesHints = [
    'salt',
    'pepper',
    'black pepper',
    'oregano',
    'cumin',
    'paprika',
    'cinnamon',
    'nutmeg',
    'clove',
    'turmeric',
    'curry powder',
    'thyme',
    'rosemary',
    'bay leaf',
    'chili powder',
    'red pepper flake',
    'vanilla extract',
    'garam masala',
    'seasoning',
    'stock cube',
    'bouillon cube',
    'dried',
    'herb mix',
  ];

  if (frozenHints.some((kw) => n.includes(kw))) return 'frozen';
  if (produceHints.some((kw) => n.includes(kw))) return 'produce';
  if (dairyHints.some((kw) => n.includes(kw))) return 'dairy';
  if (meatHints.some((kw) => n.includes(kw))) return 'meat_seafood';
  if (spicesHints.some((kw) => n.includes(kw))) return 'spices';
  if (dryGoodsHints.some((kw) => n.includes(kw))) return 'dry_goods';
  return 'dry_goods';
}

/** Fix invalid AI category strings. */
export function coercePantryCategory(
  raw: string | undefined,
  fallbackName: string
): PantryCategoryId {
  const c = (raw ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
  const aliased = CATEGORY_ALIASES[c];
  if (aliased) return aliased;
  if (PANTRY_CATEGORY_ORDER.includes(c as PantryCategoryId)) {
    return c as PantryCategoryId;
  }
  return classifyIngredientCategory(fallbackName);
}

export function newPantryItemId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createPantryStockItem(input: {
  name: string;
  category: PantryCategoryId;
  quantity: number;
  unitLabel?: string;
  lowStockAt?: number;
}): PantryStockItem {
  return {
    id: newPantryItemId(),
    name: capitalizeWords(input.name),
    category: input.category,
    quantity: Math.max(1, Math.floor(input.quantity)),
    unitLabel: input.unitLabel?.trim() || undefined,
    lowStockAt: input.lowStockAt ?? 2,
  };
}
