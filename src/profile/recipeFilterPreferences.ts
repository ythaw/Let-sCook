import type { PersistedProfilePreferences } from './profilePreferencesDefaults';
import { loadPersistedProfilePreferences } from './profilePreferencesStorage';

/**
 * Subset of profile data used to filter / rank recipes (equipment, diet, time, etc.).
 * Built from persisted preferences; does not include display name or UI-only fields.
 */
export type RecipeFilterPreferences = {
  dietaryRestrictions: string[];
  allergies: string[];
  likes: string[];
  dislikes: string[];
  preferredCookingTime: string | null;
  availableEquipment: string[];
  goals: string[];
};

/** Any object that contains the seven recipe-filter fields (e.g. full `PersistedProfilePreferences`). */
export type RecipeFilterPreferencesSource = Pick<
  PersistedProfilePreferences,
  | 'dietaryRestrictions'
  | 'allergies'
  | 'likes'
  | 'dislikes'
  | 'preferredCookingTime'
  | 'availableEquipment'
  | 'goals'
>;

/**
 * Returns a fresh snapshot for recipe logic: copied arrays/strings so filters can
 * hold references without mutating profile state or stored JSON.
 *
 * Later: map `preferredCookingTime` to max minutes, match `allergies` to recipe
 * ingredients, intersect required equipment with `availableEquipment`, etc.
 */
export function buildRecipeFilterPreferences(
  source: RecipeFilterPreferencesSource
): RecipeFilterPreferences {
  return {
    dietaryRestrictions: [...source.dietaryRestrictions],
    allergies: [...source.allergies],
    likes: [...source.likes],
    dislikes: [...source.dislikes],
    preferredCookingTime: source.preferredCookingTime,
    availableEquipment: [...source.availableEquipment],
    goals: [...source.goals],
  };
}

/**
 * Async helper for non-React code (e.g. future recipe service): load storage then
 * return the recipe-filter shape with safe defaults applied.
 */
export async function loadRecipeFilterPreferences(): Promise<RecipeFilterPreferences> {
  const full = await loadPersistedProfilePreferences();
  return buildRecipeFilterPreferences(full);
}
