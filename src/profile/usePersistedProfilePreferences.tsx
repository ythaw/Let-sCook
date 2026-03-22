import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { PersistedProfilePreferences } from './profilePreferencesDefaults';
import { DEFAULT_PERSISTED_PROFILE } from './profilePreferencesDefaults';
import {
  loadPersistedProfilePreferences,
  savePersistedProfilePreferences,
} from './profilePreferencesStorage';
import { buildRecipeFilterPreferences } from './recipeFilterPreferences';

export type PersistedProfilePreferencesApi = ReturnType<
  typeof usePersistedProfilePreferencesState
>;

const ProfilePreferencesContext =
  createContext<PersistedProfilePreferencesApi | null>(null);

/**
 * Loads profile preferences from AsyncStorage on mount, then saves after each change.
 * Does not write until the first load finishes (avoids overwriting with defaults).
 */
function usePersistedProfilePreferencesState() {
  const [hydrated, setHydrated] = useState(false);

  const [displayName, setDisplayName] = useState(
    DEFAULT_PERSISTED_PROFILE.displayName
  );
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>(() => [
    ...DEFAULT_PERSISTED_PROFILE.dietaryRestrictions,
  ]);
  const [allergies, setAllergies] = useState<string[]>(() => [
    ...DEFAULT_PERSISTED_PROFILE.allergies,
  ]);
  const [likes, setLikes] = useState<string[]>(() => [
    ...DEFAULT_PERSISTED_PROFILE.likes,
  ]);
  const [dislikes, setDislikes] = useState<string[]>(() => [
    ...DEFAULT_PERSISTED_PROFILE.dislikes,
  ]);
  const [preferredCookingTime, setPreferredCookingTime] = useState<string | null>(
    DEFAULT_PERSISTED_PROFILE.preferredCookingTime
  );
  const [availableEquipment, setAvailableEquipment] = useState<string[]>(() => [
    ...DEFAULT_PERSISTED_PROFILE.availableEquipment,
  ]);
  const [goals, setGoals] = useState<string[]>(() => [
    ...DEFAULT_PERSISTED_PROFILE.goals,
  ]);

  const applyLoaded = useCallback((p: PersistedProfilePreferences) => {
    setDisplayName(p.displayName);
    setDietaryRestrictions([...p.dietaryRestrictions]);
    setAllergies([...p.allergies]);
    setLikes([...p.likes]);
    setDislikes([...p.dislikes]);
    setPreferredCookingTime(p.preferredCookingTime);
    setAvailableEquipment([...p.availableEquipment]);
    setGoals([...p.goals]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadPersistedProfilePreferences().then((loaded) => {
      if (cancelled) return;
      applyLoaded(loaded);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [applyLoaded]);

  useEffect(() => {
    if (!hydrated) return;
    void savePersistedProfilePreferences({
      displayName,
      dietaryRestrictions,
      allergies,
      likes,
      dislikes,
      preferredCookingTime,
      availableEquipment,
      goals,
    });
  }, [
    hydrated,
    displayName,
    dietaryRestrictions,
    allergies,
    likes,
    dislikes,
    preferredCookingTime,
    availableEquipment,
    goals,
  ]);

  const recipeFilterPreferences = useMemo(
    () =>
      buildRecipeFilterPreferences({
        dietaryRestrictions,
        allergies,
        likes,
        dislikes,
        preferredCookingTime,
        availableEquipment,
        goals,
      }),
    [
      dietaryRestrictions,
      allergies,
      likes,
      dislikes,
      preferredCookingTime,
      availableEquipment,
      goals,
    ]
  );

  /** Clears to bundled defaults and persists (AsyncStorage). No server; safe for MVP. */
  const resetToDefaults = useCallback(() => {
    applyLoaded({ ...DEFAULT_PERSISTED_PROFILE });
  }, [applyLoaded]);

  return {
    displayName,
    setDisplayName,
    dietaryRestrictions,
    setDietaryRestrictions,
    allergies,
    setAllergies,
    likes,
    setLikes,
    dislikes,
    setDislikes,
    preferredCookingTime,
    setPreferredCookingTime,
    availableEquipment,
    setAvailableEquipment,
    goals,
    setGoals,
    /** Snapshot for future recipe filter / ranking (arrays copied). */
    recipeFilterPreferences,
    resetToDefaults,
  };
}

export function ProfilePreferencesProvider({ children }: { children: ReactNode }) {
  const value = usePersistedProfilePreferencesState();
  return (
    <ProfilePreferencesContext.Provider value={value}>
      {children}
    </ProfilePreferencesContext.Provider>
  );
}

export function usePersistedProfilePreferences(): PersistedProfilePreferencesApi {
  const ctx = useContext(ProfilePreferencesContext);
  if (ctx == null) {
    throw new Error(
      'usePersistedProfilePreferences must be used within ProfilePreferencesProvider'
    );
  }
  return ctx;
}
