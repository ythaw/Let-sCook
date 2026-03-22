import type { UserProfile } from './types';

/** Stand-in for future Profile screen — chatbot reads this for personalization. */
export const DEMO_PROFILE: UserProfile = {
  displayName: 'Jordan Lee',
  initials: 'JL',
  allergies: ['peanuts', 'shellfish'],
  dietaryNotes: ['No pork'],
  cuisinePreferences: ['Italian', 'Mediterranean', 'Japanese'],
  tastePreferences: ['Garlicky', 'Fresh herbs', 'Medium spice'],
  kitchenTools: ['Gas stove', 'Oven', 'Blender', 'Dutch oven', 'Chef knife'],
  householdSize: 2,
  typicalMealKcalTarget: 650,
};
