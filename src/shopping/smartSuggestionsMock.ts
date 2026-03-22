/** Demo data — swap for recipe / pantry gap analysis later. */

export type SmartSuggestionTag = 'recipe' | 'smart';

export type SmartSuggestionMock = {
  id: string;
  /** Value passed to `addShoppingItem` with `{ source: 'suggestion' }` (normalized in hook). */
  addName: string;
  /** Short title shown on the card. */
  label: string;
  /** Why buying this helps — assistant-style copy. */
  detail: string;
  tag: SmartSuggestionTag;
  /** When `tag === 'recipe'`, shown on the chip. */
  recipeName?: string;
  /**
   * Higher = more suitable; used to order slots and replacements.
   * Recipe-linked / multi-meal copy should outrank generic staples.
   */
  suitabilityScore: number;
};

export const SMART_SUGGESTION_MOCKS: SmartSuggestionMock[] = [
  {
    id: 'smart-garlic',
    addName: 'garlic',
    label: 'Garlic',
    detail: 'Used in 2 of your planned meals.',
    tag: 'recipe',
    recipeName: 'Lemon Herb Chicken',
    suitabilityScore: 100,
  },
  {
    id: 'smart-bell-peppers',
    addName: 'bell peppers',
    label: 'Bell Peppers',
    detail: 'Used in 2 of your planned meals.',
    tag: 'recipe',
    recipeName: 'Sheet Pan Fajitas',
    suitabilityScore: 99,
  },
  {
    id: 'smart-tomatoes',
    addName: 'tomatoes',
    label: 'Tomatoes',
    detail: 'Used in 2 of your planned meals.',
    tag: 'recipe',
    recipeName: 'Summer Pasta',
    suitabilityScore: 98,
  },
  {
    id: 'smart-chicken',
    addName: 'chicken',
    label: 'Chicken',
    detail: 'High-protein dinners you almost have ingredients for.',
    tag: 'recipe',
    recipeName: 'Coconut Curry Bowl',
    suitabilityScore: 92,
  },
  {
    id: 'smart-avocado',
    addName: 'avocado',
    label: 'Avocado',
    detail: 'Toast and bowls on your weekend plan.',
    tag: 'recipe',
    recipeName: 'Brunch Bowl',
    suitabilityScore: 90,
  },
  {
    id: 'smart-lime',
    addName: 'lime',
    label: 'Lime',
    detail: 'Finishes tacos and soups on your plan.',
    tag: 'recipe',
    recipeName: 'Coconut Curry Bowl',
    suitabilityScore: 88,
  },
  {
    id: 'smart-eggs',
    addName: 'eggs',
    label: 'Eggs',
    detail: 'Unlocks fried rice and quick breakfast meals.',
    tag: 'smart',
    suitabilityScore: 82,
  },
  {
    id: 'smart-onion',
    addName: 'onions',
    label: 'Onions',
    detail: 'Buy onions to unlock more stir fry options.',
    tag: 'smart',
    suitabilityScore: 80,
  },
  {
    id: 'smart-rice',
    addName: 'rice',
    label: 'Rice',
    detail: 'Pairs with several meals you saved.',
    tag: 'smart',
    suitabilityScore: 78,
  },
  {
    id: 'smart-spinach',
    addName: 'spinach',
    label: 'Spinach',
    detail: 'Salads and pastas for the week ahead.',
    tag: 'smart',
    suitabilityScore: 76,
  },
  {
    id: 'smart-olive-oil',
    addName: 'olive oil',
    label: 'Olive Oil',
    detail: 'Pantry staple running low.',
    tag: 'smart',
    suitabilityScore: 72,
  },
  {
    id: 'smart-parmesan',
    addName: 'parmesan',
    label: 'Parmesan',
    detail: 'Pantry staple running low.',
    tag: 'smart',
    suitabilityScore: 70,
  },
  {
    id: 'smart-yogurt',
    addName: 'greek yogurt',
    label: 'Greek Yogurt',
    detail: 'Breakfast parfaits and marinades.',
    tag: 'smart',
    suitabilityScore: 66,
  },
  {
    id: 'smart-cilantro',
    addName: 'cilantro',
    label: 'Cilantro',
    detail: 'Fresh finish for bowls and tacos.',
    tag: 'smart',
    suitabilityScore: 62,
  },
  {
    id: 'smart-black-beans',
    addName: 'black beans',
    label: 'Black Beans',
    detail: 'Bulk up burritos and salads.',
    tag: 'smart',
    suitabilityScore: 58,
  },
];
