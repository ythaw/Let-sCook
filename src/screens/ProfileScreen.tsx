/**
 * Local cooking preferences for the MVP: display name and filters are held in memory
 * and persisted with AsyncStorage via `usePersistedProfilePreferences`. No sign-in,
 * no backend — optional account features can layer on this shape later.
 *
 * For recipe filtering, use `recipeFilterPreferences` from the same hook, or
 * `buildRecipeFilterPreferences` / `loadRecipeFilterPreferences` from `../profile`.
 */
import {
  useCallback,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActionSheetIOS,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { TagChip } from '../components';
import type { ProfileScreenProps } from '../navigation/types';
import {
  initialsFromDisplayName,
  PROFILE_LOCAL_STORAGE_CAPTION,
  usePersistedProfilePreferences,
} from '../profile';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/typography';

const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Halal',
  'No Pork',
  'No Beef',
] as const;

/** Side-by-side taste cards when window is wide enough (large phones / small tablets). */
const TASTE_TWO_COLUMN_MIN_WIDTH = 420;

const PREFERRED_COOKING_TIME_SEGMENTS = [
  '< 15m',
  '< 30m',
  '< 45m',
  'Over 1hr',
] as const;

const DIETARY_OPTION_SET = new Set<string>(DIETARY_OPTIONS);

/** Returns a copy of `list` without `item` (chip / tag removal). */
function removeFromList(list: readonly string[], item: string): string[] {
  return list.filter((x) => x !== item);
}

/**
 * Multi-select chip lists: add `value` if missing, remove if present.
 * Does not mutate `list`.
 */
function toggleChipInList(list: readonly string[], value: string): string[] {
  return list.includes(value)
    ? removeFromList(list, value)
    : [...list, value];
}

function normalizeFreeformLabel(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t) return null;
  return t
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function listContainsCaseInsensitive(list: readonly string[], label: string): boolean {
  const lower = label.toLowerCase();
  return list.some((x) => x.toLowerCase() === lower);
}

type ChipRowMultiProps = {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
};

function ChipRowMulti({ options, selected, onChange }: ChipRowMultiProps) {
  return (
    <View style={styles.chipsWrap}>
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <TagChip
            key={opt}
            label={opt}
            selected={on}
            onPress={() => onChange(toggleChipInList(selected, opt))}
            accessibilityHint="Double tap to toggle"
          />
        );
      })}
    </View>
  );
}

type CookingTimeSegmentedProps = {
  value: string | null;
  onChange: (next: string | null) => void;
};

function CookingTimeSegmented({ value, onChange }: CookingTimeSegmentedProps) {
  /** Fixed 2×2 grid so the last slot never grows full-width and overlaps content below. */
  const rows: (typeof PREFERRED_COOKING_TIME_SEGMENTS[number])[][] = [
    [PREFERRED_COOKING_TIME_SEGMENTS[0], PREFERRED_COOKING_TIME_SEGMENTS[1]],
    [PREFERRED_COOKING_TIME_SEGMENTS[2], PREFERRED_COOKING_TIME_SEGMENTS[3]],
  ];
  return (
    <View style={styles.cookTimeTrack}>
      {rows.map((row, rowIndex) => (
        <View
          key={`cook-time-row-${rowIndex}`}
          style={[
            styles.cookTimeRow,
            rowIndex === rows.length - 1 && styles.cookTimeRowLast,
          ]}
        >
          {row.map((seg) => {
            const on = value === seg;
            return (
              <Pressable
                key={seg}
                onPress={() => onChange(on ? null : seg)}
                style={({ pressed }) => [
                  styles.cookTimeSlot,
                  on && styles.cookTimeSlotActive,
                  pressed && !on && { opacity: 0.88 },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Preferred time ${seg}`}
              >
                <Text
                  style={[styles.cookTimeLabel, on && styles.cookTimeLabelActive]}
                  numberOfLines={1}
                >
                  {seg}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

type SectionCardProps = {
  title: string;
  children: ReactNode;
  /** Optional action (e.g. Add) aligned with the section title — matches SubBlock headers. */
  headerRight?: ReactNode;
};

function SectionCard({ title, children, headerRight }: SectionCardProps) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionCardHead}>
        <Text
          style={styles.sectionCardTitle}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title}
        </Text>
        {headerRight != null ? (
          <View style={styles.sectionCardHeaderRight}>{headerRight}</View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

type SubBlockProps = {
  label: string;
  children: ReactNode;
  /** e.g. "+ Add" aligned with the section label */
  headerRight?: ReactNode;
};

function SubBlock({ label, children, headerRight }: SubBlockProps) {
  return (
    <View style={styles.subBlock}>
      <View style={styles.subBlockHeader}>
        <Text style={styles.subBlockLabel}>{label}</Text>
        {headerRight ?? null}
      </View>
      {children}
    </View>
  );
}

function ChipListPlaceholder({ text }: { text: string }) {
  return (
    <View style={styles.chipListPlaceholderWrap}>
      <Text style={styles.chipListPlaceholder}>{text}</Text>
    </View>
  );
}

type ProfileAddButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
};

/** Single Add style across Profile: terracotta pill + icon (matches Pantry accent). */
function ProfileAddButton({
  label,
  onPress,
  accessibilityLabel,
}: ProfileAddButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.profileAddSolid,
        pressed && { opacity: 0.88 },
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
    >
      <Ionicons name="add-circle-outline" size={19} color={colors.terracotta} />
      <Text style={styles.profileAddSolidLabel}>{label}</Text>
    </Pressable>
  );
}

type TasteMiniCardProps = {
  title: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  items: string[];
  emptyPlaceholder: string;
  onRemoveItem: (label: string) => void;
  onAddPress: () => void;
  addAccessibilityLabel: string;
  iconTint: string;
  iconBg: string;
  twoColumnLayout: boolean;
};

function TasteMiniCard({
  title,
  icon,
  items,
  emptyPlaceholder,
  onRemoveItem,
  onAddPress,
  addAccessibilityLabel,
  iconTint,
  iconBg,
  twoColumnLayout,
}: TasteMiniCardProps) {
  return (
    <View
      style={[
        styles.tasteMiniCard,
        twoColumnLayout && styles.tasteMiniCardGrow,
      ]}
    >
      <View style={styles.tasteCardHead}>
        <View style={[styles.tasteCardIconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={18} color={iconTint} />
        </View>
        <Text style={styles.tasteCardTitle}>{title}</Text>
      </View>

      <View style={styles.tasteChipsWrap}>
        {items.length === 0 ? (
          <ChipListPlaceholder text={emptyPlaceholder} />
        ) : (
          items.map((item) => (
            <TagChip
              key={item}
              label={item}
              selected
              removable
              onRemove={() => onRemoveItem(item)}
            />
          ))
        )}
      </View>

      <View style={styles.tasteAddButtonWrap}>
        <ProfileAddButton
          label="Add"
          onPress={onAddPress}
          accessibilityLabel={addAccessibilityLabel}
        />
      </View>
    </View>
  );
}

export function ProfileScreen(_props: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { width: windowWidth } = useWindowDimensions();
  const tasteTwoColumn = windowWidth >= TASTE_TWO_COLUMN_MIN_WIDTH;

  const {
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
    resetToDefaults,
  } = usePersistedProfilePreferences();

  /** Transient UI for add rows; saved chips persist via the hook. */
  const [dietaryAddOpen, setDietaryAddOpen] = useState(false);
  const [dietaryDraft, setDietaryDraft] = useState('');
  const [allergyAddOpen, setAllergyAddOpen] = useState(false);
  const [allergyDraft, setAllergyDraft] = useState('');
  const [equipmentAddOpen, setEquipmentAddOpen] = useState(false);
  const [equipmentDraft, setEquipmentDraft] = useState('');
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const avatarInitials = useMemo(
    () => initialsFromDisplayName(displayName),
    [displayName]
  );

  const customDietaryRestrictions = useMemo(
    () => dietaryRestrictions.filter((d) => !DIETARY_OPTION_SET.has(d)),
    [dietaryRestrictions]
  );

  const commitDietaryDraft = useCallback(() => {
    const next = normalizeFreeformLabel(dietaryDraft);
    if (!next) return;
    setDietaryRestrictions((prev) => {
      if (listContainsCaseInsensitive(prev, next)) return prev;
      return [...prev, next];
    });
    setDietaryDraft('');
    setDietaryAddOpen(false);
  }, [dietaryDraft]);

  const toggleDietaryCustomAdd = useCallback(() => {
    setDietaryAddOpen((o) => !o);
    setDietaryDraft('');
  }, []);

  const removeDietaryCustom = useCallback((item: string) => {
    setDietaryRestrictions((prev) => removeFromList(prev, item));
  }, []);

  const removeAllergy = useCallback((item: string) => {
    setAllergies((prev) => removeFromList(prev, item));
  }, []);

  const commitAllergyDraft = useCallback(() => {
    const next = normalizeFreeformLabel(allergyDraft);
    if (!next) return;
    setAllergies((prev) => {
      if (listContainsCaseInsensitive(prev, next)) return prev;
      return [...prev, next];
    });
    setAllergyDraft('');
    setAllergyAddOpen(false);
  }, [allergyDraft]);

  const toggleAllergyAdd = useCallback(() => {
    setAllergyAddOpen((o) => !o);
    setAllergyDraft('');
  }, []);

  const removeLike = useCallback((item: string) => {
    setLikes((prev) => removeFromList(prev, item));
  }, []);

  const removeDislike = useCallback((item: string) => {
    setDislikes((prev) => removeFromList(prev, item));
  }, []);

  const onAddTasteLike = useCallback(() => {
    // Wire to modal / picker when taste add flow is ready.
  }, []);

  const onAddTasteDislike = useCallback(() => {
    // Wire to modal / picker when taste add flow is ready.
  }, []);

  const removeAvailableEquipment = useCallback((item: string) => {
    setAvailableEquipment((prev) => removeFromList(prev, item));
  }, []);

  const commitEquipmentDraft = useCallback(() => {
    const next = normalizeFreeformLabel(equipmentDraft);
    if (!next) return;
    setAvailableEquipment((prev) => {
      if (listContainsCaseInsensitive(prev, next)) return prev;
      return [...prev, next];
    });
    setEquipmentDraft('');
    setEquipmentAddOpen(false);
  }, [equipmentDraft]);

  const toggleEquipmentAdd = useCallback(() => {
    setEquipmentAddOpen((o) => !o);
    setEquipmentDraft('');
  }, []);

  const removeGoal = useCallback((item: string) => {
    setGoals((prev) => removeFromList(prev, item));
  }, []);

  const onAddGoalPress = useCallback(() => {
    // UI placeholder — wire to add-goal flow later.
  }, []);

  const openNameModal = useCallback(() => {
    setNameDraft(displayName);
    setNameModalOpen(true);
  }, [displayName]);

  const commitDisplayName = useCallback(() => {
    const t = nameDraft.trim();
    setDisplayName(t.length > 0 ? t : 'Home cook');
    setNameModalOpen(false);
  }, [nameDraft, setDisplayName]);

  const confirmResetPreferences = useCallback(() => {
    Alert.alert(
      'Reset all preferences?',
      'This clears diet, allergies, taste, equipment, and goals saved in this app on this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setDietaryAddOpen(false);
            setAllergyAddOpen(false);
            setEquipmentAddOpen(false);
            setDietaryDraft('');
            setAllergyDraft('');
            setEquipmentDraft('');
            resetToDefaults();
          },
        },
      ]
    );
  }, [resetToDefaults]);

  const onEditAvatarPress = useCallback(() => {
    Alert.alert(
      'Profile photo',
      'Optional profile photos may be added in a future update. Your preferences stay on this device only — nothing is uploaded.'
    );
  }, []);

  const openProfileSettingsMenu = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Preferences',
          message: 'Everything here is stored locally on this device.',
          options: ['Cancel', 'Edit display name', 'Reset preferences'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        (index) => {
          if (index === 1) openNameModal();
          if (index === 2) confirmResetPreferences();
        }
      );
      return;
    }

    Alert.alert('Preferences', 'Stored on this device only.', [
      { text: 'Edit display name', onPress: openNameModal },
      {
        text: 'Reset preferences',
        style: 'destructive',
        onPress: confirmResetPreferences,
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [confirmResetPreferences, openNameModal]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: Math.max(28, insets.bottom + 8) + tabBarHeight,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View style={styles.iconBtn} />
          <Text style={styles.screenTitle} accessibilityRole="header">
            Profile
          </Text>
          <Pressable
            onPress={openProfileSettingsMenu}
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && { opacity: 0.72 },
            ]}
            accessibilityLabel="Preferences menu"
            accessibilityHint="Edit display name or reset local preferences"
            accessibilityRole="button"
            hitSlop={10}
          >
            <Ionicons
              name="settings-outline"
              size={24}
              color={colors.textMuted}
            />
          </Pressable>
        </View>

        <Text style={styles.screenKicker}>
          Cooking preferences on this device — no account needed
        </Text>

        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarInitials}</Text>
            </View>
            <Pressable
              onPress={onEditAvatarPress}
              style={({ pressed }) => [
                styles.avatarEditBtn,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityLabel="About profile photo"
              accessibilityRole="button"
              hitSlop={6}
            >
              <Ionicons
                name="pencil"
                size={15}
                color={colors.terracotta}
              />
            </Pressable>
          </View>
          <Pressable
            onPress={openNameModal}
            accessibilityLabel="Edit display name"
            accessibilityRole="button"
            style={({ pressed }) => pressed && { opacity: 0.85 }}
          >
            <Text style={styles.displayName}>{displayName}</Text>
          </Pressable>
          <Text style={styles.localCaption}>{PROFILE_LOCAL_STORAGE_CAPTION}</Text>
        </View>

        <SectionCard title="Health & Diet">
          <SubBlock
            label="Dietary restrictions"
            headerRight={
              <ProfileAddButton
                label="Add"
                onPress={toggleDietaryCustomAdd}
                accessibilityLabel={
                  dietaryAddOpen
                    ? 'Cancel adding custom dietary restriction'
                    : 'Add custom dietary restriction'
                }
              />
            }
          >
            <Text style={styles.dietaryPresetsHint}>
              Quick picks — add your own below
            </Text>
            <ChipRowMulti
              options={DIETARY_OPTIONS}
              selected={dietaryRestrictions}
              onChange={setDietaryRestrictions}
            />
            {customDietaryRestrictions.length > 0 ? (
              <View style={styles.dietaryCustomChips}>
                {customDietaryRestrictions.map((d) => (
                  <TagChip
                    key={d}
                    label={d}
                    selected
                    removable
                    onRemove={() => removeDietaryCustom(d)}
                  />
                ))}
              </View>
            ) : null}
            {dietaryAddOpen ? (
              <View style={styles.allergyAddRow}>
                <TextInput
                  value={dietaryDraft}
                  onChangeText={setDietaryDraft}
                  placeholder="e.g. low sodium, dairy-free"
                  placeholderTextColor={colors.textMuted}
                  style={styles.allergyInput}
                  returnKeyType="done"
                  onSubmitEditing={commitDietaryDraft}
                  accessibilityLabel="Custom dietary restriction"
                />
                <Pressable
                  onPress={commitDietaryDraft}
                  style={({ pressed }) => [
                    styles.allergyAddConfirm,
                    pressed && { opacity: 0.9 },
                  ]}
                  accessibilityLabel="Save dietary restriction"
                >
                  <Text style={styles.allergyAddConfirmLabel}>Save</Text>
                </Pressable>
              </View>
            ) : null}
          </SubBlock>
          <SubBlock
            label="Allergies"
            headerRight={
              <ProfileAddButton
                label="Add"
                onPress={toggleAllergyAdd}
                accessibilityLabel={
                  allergyAddOpen ? 'Cancel adding allergy' : 'Add allergy'
                }
              />
            }
          >
            <View style={styles.allergyChipsWrap}>
              {allergies.length === 0 ? (
                <ChipListPlaceholder text="No allergies added" />
              ) : (
                allergies.map((a) => (
                  <TagChip
                    key={a}
                    label={a}
                    selected
                    removable
                    onRemove={() => removeAllergy(a)}
                  />
                ))
              )}
            </View>
            {allergyAddOpen ? (
              <View style={styles.allergyAddRow}>
                <TextInput
                  value={allergyDraft}
                  onChangeText={setAllergyDraft}
                  placeholder="e.g. tree nuts"
                  placeholderTextColor={colors.textMuted}
                  style={styles.allergyInput}
                  returnKeyType="done"
                  onSubmitEditing={commitAllergyDraft}
                  accessibilityLabel="New allergy name"
                />
                <Pressable
                  onPress={commitAllergyDraft}
                  style={({ pressed }) => [
                    styles.allergyAddConfirm,
                    pressed && { opacity: 0.9 },
                  ]}
                  accessibilityLabel="Save allergy"
                >
                  <Text style={styles.allergyAddConfirmLabel}>Save</Text>
                </Pressable>
              </View>
            ) : null}
          </SubBlock>
        </SectionCard>

        <SectionCard title="Taste Profile">
          <View
            style={[
              styles.tasteCardsRow,
              tasteTwoColumn
                ? styles.tasteCardsRowSideBySide
                : styles.tasteCardsRowStacked,
            ]}
          >
            <TasteMiniCard
              title="Likes"
              icon="thumbs-up"
              items={likes}
              emptyPlaceholder="No likes added"
              onRemoveItem={removeLike}
              onAddPress={onAddTasteLike}
              addAccessibilityLabel="Add a like"
              iconTint={colors.terracotta}
              iconBg="rgba(201, 107, 74, 0.14)"
              twoColumnLayout={tasteTwoColumn}
            />
            <TasteMiniCard
              title="Dislikes"
              icon="thumbs-down"
              items={dislikes}
              emptyPlaceholder="No dislikes added"
              onRemoveItem={removeDislike}
              onAddPress={onAddTasteDislike}
              addAccessibilityLabel="Add a dislike"
              iconTint={colors.textMuted}
              iconBg="rgba(44, 36, 22, 0.06)"
              twoColumnLayout={tasteTwoColumn}
            />
          </View>
        </SectionCard>

        <SectionCard title="Cooking Setup">
          <SubBlock label="Preferred cooking time">
            <CookingTimeSegmented
              value={preferredCookingTime}
              onChange={setPreferredCookingTime}
            />
          </SubBlock>
          <SubBlock
            label="Available equipment"
            headerRight={
              <ProfileAddButton
                label="Add"
                onPress={toggleEquipmentAdd}
                accessibilityLabel={
                  equipmentAddOpen ? 'Cancel adding equipment' : 'Add equipment'
                }
              />
            }
          >
            <View style={styles.allergyChipsWrap}>
              {availableEquipment.length === 0 ? (
                <ChipListPlaceholder text="No equipment added" />
              ) : (
                availableEquipment.map((item) => (
                  <TagChip
                    key={item}
                    label={item}
                    selected
                    removable
                    onRemove={() => removeAvailableEquipment(item)}
                  />
                ))
              )}
            </View>
            {equipmentAddOpen ? (
              <View style={styles.allergyAddRow}>
                <TextInput
                  value={equipmentDraft}
                  onChangeText={setEquipmentDraft}
                  placeholder="e.g. Instant Pot"
                  placeholderTextColor={colors.textMuted}
                  style={styles.allergyInput}
                  returnKeyType="done"
                  onSubmitEditing={commitEquipmentDraft}
                  accessibilityLabel="New equipment name"
                />
                <Pressable
                  onPress={commitEquipmentDraft}
                  style={({ pressed }) => [
                    styles.allergyAddConfirm,
                    pressed && { opacity: 0.9 },
                  ]}
                  accessibilityLabel="Save equipment"
                >
                  <Text style={styles.allergyAddConfirmLabel}>Save</Text>
                </Pressable>
              </View>
            ) : null}
          </SubBlock>
        </SectionCard>

        <SectionCard
          title="Goals"
          headerRight={
            <ProfileAddButton
              label="Add goal"
              onPress={onAddGoalPress}
              accessibilityLabel="Add goal"
            />
          }
        >
          <View style={styles.allergyChipsWrap}>
            {goals.length === 0 ? (
              <ChipListPlaceholder text="No goals added" />
            ) : (
              goals.map((g) => (
                <TagChip
                  key={g}
                  label={g}
                  selected
                  removable
                  onRemove={() => removeGoal(g)}
                />
              ))
            )}
          </View>
        </SectionCard>
      </ScrollView>

      <Modal
        visible={nameModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNameModalOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setNameModalOpen(false)}
            accessibilityLabel="Dismiss"
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalCenter}
            pointerEvents="box-none"
          >
            <View style={styles.modalCard} accessibilityViewIsModal>
              <Text style={styles.modalTitle}>Display name</Text>
              <Text style={styles.modalHint}>
                Used in the app only — not a username or login.
              </Text>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
                style={styles.modalInput}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={commitDisplayName}
                accessibilityLabel="Display name"
              />
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setNameModalOpen(false)}
                  style={({ pressed }) => [
                    styles.modalBtnSecondary,
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalBtnSecondaryLabel}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={commitDisplayName}
                  style={({ pressed }) => [
                    styles.modalBtnPrimary,
                    pressed && { opacity: 0.9 },
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalBtnPrimaryLabel}>Save</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 4,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: -8,
    marginBottom: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 22,
    color: colors.text,
    lineHeight: 28,
  },
  screenKicker: {
    marginBottom: 14,
    paddingHorizontal: 2,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  profileHeader: {
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginBottom: 22,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarWrap: {
    width: 100,
    height: 100,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.peach,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2C2416',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarText: {
    fontFamily: fonts.serifSemi,
    fontSize: 32,
    letterSpacing: 1,
    color: colors.terracotta,
  },
  avatarEditBtn: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.terracottaSoft,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2C2416',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  displayName: {
    fontFamily: fonts.serifSemi,
    fontSize: 22,
    color: colors.text,
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 6,
  },
  localCaption: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    textAlign: 'center',
    letterSpacing: 0.15,
    opacity: 0.92,
  },
  modalRoot: {
    flex: 1,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(44, 36, 22, 0.42)',
  },
  modalCenter: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    zIndex: 1,
  },
  modalCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  modalTitle: {
    fontFamily: fonts.serifSemi,
    fontSize: 20,
    color: colors.text,
    marginBottom: 6,
  },
  modalHint: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 14,
  },
  modalInput: {
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.text,
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalBtnSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalBtnSecondaryLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 16,
    color: colors.textMuted,
  },
  modalBtnPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: radii.md,
    backgroundColor: colors.terracotta,
  },
  modalBtnPrimaryLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 16,
    color: colors.white,
  },
  sectionCard: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 22,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  sectionCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionCardHeaderRight: {
    flexShrink: 0,
    maxWidth: '52%',
    alignItems: 'flex-end',
  },
  sectionCardTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.serifSemi,
    fontSize: 18,
    color: colors.text,
    lineHeight: 24,
  },
  subBlock: {
    gap: 12,
  },
  subBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  subBlockLabel: {
    flex: 1,
    fontFamily: fonts.sansSemi,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  allergyChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    rowGap: 12,
    alignItems: 'flex-start',
  },
  chipListPlaceholderWrap: {
    width: '100%',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  chipListPlaceholder: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 22,
    opacity: 0.85,
  },
  profileAddSolid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(201, 107, 74, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201, 107, 74, 0.22)',
  },
  profileAddSolidLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 14,
    color: colors.terracotta,
  },
  dietaryPresetsHint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 8,
  },
  dietaryCustomChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    rowGap: 12,
    alignItems: 'flex-start',
    marginTop: 4,
  },
  allergyAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  allergyInput: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.text,
  },
  allergyAddConfirm: {
    paddingHorizontal: 22,
    minHeight: 52,
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.terracotta,
  },
  allergyAddConfirmLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 16,
    color: colors.white,
  },
  cookTimeTrack: {
    padding: 4,
    borderRadius: radii.md,
    backgroundColor: 'rgba(44, 36, 22, 0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 0,
  },
  cookTimeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  cookTimeRowLast: {
    marginBottom: 0,
  },
  cookTimeSlot: {
    flex: 1,
    minHeight: 44,
    minWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  cookTimeSlotActive: {
    backgroundColor: colors.terracotta,
    borderColor: colors.terracotta,
  },
  cookTimeLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  cookTimeLabelActive: {
    color: colors.white,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'flex-start',
  },
  tasteCardsRow: {
    alignSelf: 'stretch',
  },
  tasteCardsRowSideBySide: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  tasteCardsRowStacked: {
    flexDirection: 'column',
    gap: 14,
  },
  tasteMiniCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  tasteMiniCardGrow: {
    flex: 1,
    minWidth: 0,
  },
  tasteCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  tasteCardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tasteCardTitle: {
    fontFamily: fonts.serifSemi,
    fontSize: 17,
    color: colors.text,
    lineHeight: 22,
  },
  tasteChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    rowGap: 10,
    alignItems: 'flex-start',
    minHeight: 44,
  },
  tasteAddButtonWrap: {
    marginTop: 12,
    alignItems: 'center',
  },
});
