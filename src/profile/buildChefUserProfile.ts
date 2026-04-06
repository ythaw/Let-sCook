import { DEMO_PROFILE } from '../data';
import type { UserProfile } from '../data/types';
import type { PersistedProfilePreferences } from './profilePreferencesDefaults';
import { initialsFromDisplayName } from './initialsFromDisplayName';

/**
 * Merges saved Profile tab data into the chef `UserProfile` used by chat (Gemini system prompt + offline mock).
 */
export function buildChefUserProfile(
  persisted: PersistedProfilePreferences
): UserProfile {
  const displayName = persisted.displayName.trim() || DEMO_PROFILE.displayName;
  const allergies =
    persisted.allergies.length > 0
      ? persisted.allergies.map((a) => a.toLowerCase())
      : DEMO_PROFILE.allergies;
  const dietaryNotes =
    persisted.dietaryRestrictions.length > 0
      ? [...persisted.dietaryRestrictions]
      : DEMO_PROFILE.dietaryNotes;
  const tastePreferences =
    persisted.likes.length > 0 || persisted.dislikes.length > 0
      ? [
          ...persisted.likes.map((x) => `Enjoys: ${x}`),
          ...persisted.dislikes.map((x) => `Avoids: ${x}`),
        ]
      : DEMO_PROFILE.tastePreferences;
  const kitchenTools =
    persisted.availableEquipment.length > 0
      ? [...persisted.availableEquipment]
      : DEMO_PROFILE.kitchenTools;

  return {
    ...DEMO_PROFILE,
    displayName,
    initials: initialsFromDisplayName(displayName),
    allergies,
    dietaryNotes,
    tastePreferences,
    kitchenTools,
  };
}
