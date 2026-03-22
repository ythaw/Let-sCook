import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_PERSISTED_PROFILE,
  type PersistedProfilePreferences,
} from './profilePreferencesDefaults';

export const PROFILE_PREFERENCES_STORAGE_KEY = '@LetsCook/profilePreferences/v1';

const VALID_COOKING_TIMES = new Set<string>([
  '< 15m',
  '< 30m',
  '< 45m',
  'Over 1hr',
]);

function safeNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const t = value.trim();
  return t.length > 0 ? t : fallback;
}

function safeStringList(value: unknown, fallback: readonly string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const out = value.filter((x): x is string => typeof x === 'string');
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

function safeCookingTime(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  return VALID_COOKING_TIMES.has(value) ? value : null;
}

/**
 * Merge unknown JSON with defaults so every field is always valid.
 */
export function mergePersistedProfilePreferences(
  raw: unknown
): PersistedProfilePreferences {
  const d = DEFAULT_PERSISTED_PROFILE;
  if (raw === null || typeof raw !== 'object') {
    return { ...d };
  }
  const o = raw as Record<string, unknown>;
  return {
    displayName: safeNonEmptyString(o.displayName, d.displayName),
    dietaryRestrictions: safeStringList(o.dietaryRestrictions, d.dietaryRestrictions),
    allergies: safeStringList(o.allergies, d.allergies),
    likes: safeStringList(o.likes, d.likes),
    dislikes: safeStringList(o.dislikes, d.dislikes),
    preferredCookingTime:
      o.preferredCookingTime === undefined
        ? d.preferredCookingTime
        : safeCookingTime(o.preferredCookingTime),
    availableEquipment: safeStringList(
      o.availableEquipment,
      d.availableEquipment
    ),
    goals: safeStringList(o.goals, d.goals),
  };
}

export async function loadPersistedProfilePreferences(): Promise<PersistedProfilePreferences> {
  try {
    const json = await AsyncStorage.getItem(PROFILE_PREFERENCES_STORAGE_KEY);
    if (json == null || json === '') {
      return { ...DEFAULT_PERSISTED_PROFILE };
    }
    const parsed: unknown = JSON.parse(json);
    return mergePersistedProfilePreferences(parsed);
  } catch {
    return { ...DEFAULT_PERSISTED_PROFILE };
  }
}

export async function savePersistedProfilePreferences(
  prefs: PersistedProfilePreferences
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PROFILE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(prefs)
    );
  } catch {
    // Quota / platform errors — keep in-memory UI usable.
  }
}
