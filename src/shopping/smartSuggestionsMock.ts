/** Types for smart shopping suggestions (built by `buildSmartSuggestionsCatalog`). */

export type SmartSuggestionTag = 'recipe' | 'smart';

export type SmartSuggestionMock = {
  id: string;
  /** Passed to `addShoppingItem` (normalized in hook). */
  addName: string;
  label: string;
  detail: string;
  tag: SmartSuggestionTag;
  recipeName?: string;
  suitabilityScore: number;
};
