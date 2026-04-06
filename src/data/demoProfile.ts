import type { UserProfile } from './types';

/** Default chef context when Profile storage is empty; name matches `DEFAULT_PERSISTED_PROFILE`. */
export const DEMO_PROFILE: UserProfile = {
  displayName: 'Emma Carter',
  initials: 'EC',
  allergies: ['peanuts', 'shellfish'],
  dietaryNotes: ['No pork'],
  cuisinePreferences: ['Italian', 'Mediterranean', 'Japanese'],
  tastePreferences: ['Garlicky', 'Fresh herbs', 'Medium spice'],
  kitchenTools: ['Gas stove', 'Oven', 'Blender', 'Dutch oven', 'Chef knife'],
  householdSize: 2,
  typicalMealKcalTarget: 650,
};
