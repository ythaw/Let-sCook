/** Shapes what we persist to AsyncStorage (no auth). */
export type PersistedProfilePreferences = {
  displayName: string;
  dietaryRestrictions: string[];
  allergies: string[];
  likes: string[];
  dislikes: string[];
  preferredCookingTime: string | null;
  availableEquipment: string[];
  goals: string[];
};

/** Safe defaults when storage is missing or invalid. */
export const DEFAULT_PERSISTED_PROFILE: PersistedProfilePreferences = {
  displayName: 'Emma Carter',
  dietaryRestrictions: ['Gluten-Free', 'Halal'],
  allergies: ['Peanuts', 'Shellfish'],
  likes: ['Garlic', 'Mushrooms', 'Spicy Food'],
  dislikes: ['Cilantro', 'Olives'],
  preferredCookingTime: '< 30m',
  availableEquipment: ['Oven', 'Air Fryer', 'Blender', 'Slow Cooker'],
  goals: [
    'Eat more veggies',
    'Meal prep',
    'High protein',
    'Quick meals',
  ],
};

/** Static UI copy — not persisted. Clarifies MVP: local storage only, no account. */
export const PROFILE_LOCAL_STORAGE_CAPTION =
  'Saved on this device · no sign-in required';
