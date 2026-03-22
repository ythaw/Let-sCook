export type PantryCategoryId =
  | 'produce'
  | 'dairy'
  | 'meat_seafood'
  | 'dry_goods'
  | 'spices'
  | 'frozen';

export type PantryStockItem = {
  id: string;
  name: string;
  category: PantryCategoryId;
  quantity: number;
  /** e.g. "1 head", "500 g" */
  unitLabel?: string;
  /** Show "Low stock" when quantity <= this */
  lowStockAt: number;
};

export const PANTRY_CATEGORY_ORDER: PantryCategoryId[] = [
  'produce',
  'dairy',
  'meat_seafood',
  'dry_goods',
  'spices',
  'frozen',
];

export const PANTRY_CATEGORY_LABELS: Record<PantryCategoryId, string> = {
  produce: 'Produce',
  dairy: 'Dairy & eggs',
  meat_seafood: 'Meat & seafood',
  dry_goods: 'Dry goods',
  spices: 'Spices',
  frozen: 'Frozen',
};

export const PANTRY_SECTION_LABEL: Record<PantryCategoryId, string> = {
  produce: 'PRODUCE',
  dairy: 'DAIRY & EGGS',
  meat_seafood: 'MEAT & SEAFOOD',
  dry_goods: 'DRY GOODS',
  spices: 'SPICES',
  frozen: 'FROZEN',
};

export const PANTRY_CATEGORY_EMOJI: Record<PantryCategoryId, string> = {
  produce: '🥬',
  dairy: '🥛',
  meat_seafood: '🥩',
  dry_goods: '🫙',
  spices: '🧂',
  frozen: '❄️',
};
