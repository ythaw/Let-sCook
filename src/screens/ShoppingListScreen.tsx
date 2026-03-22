import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ShoppingListScreenProps } from '../navigation/types';
import { usePantryContext } from '../pantry';
import { classifyIngredientCategory } from '../pantry/pantryItems';
import {
  PANTRY_CATEGORY_ORDER,
  PANTRY_SECTION_LABEL,
  type PantryCategoryId,
} from '../pantry/types';
import {
  buildSmartSuggestionsCatalog,
  formatShoppingItemDisplay,
  getSmartSuggestionById,
  groupShoppingLinesByCategory,
  normalizeShoppingItemInput,
  refillSmartSlots,
  SHOPPING_LIST_STORAGE_KEY,
  SMART_SUGGESTION_SLOT_COUNT,
  type SmartSlotTuple,
  useShoppingList,
} from '../shopping';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/typography';

type ShoppingListMode = 'planning' | 'shopping';

export function ShoppingListScreen(_props: ShoppingListScreenProps) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<ShoppingListMode>('planning');
  const { importParsedItems, items: pantryItems } = usePantryContext();

  const handoffPurchasesToPantry = useCallback(
    async (canonicalNames: string[]) => {
      importParsedItems(
        canonicalNames.map((name) => ({
          name,
          category: classifyIngredientCategory(name),
          quantity: 1,
        }))
      );
      return { ok: true as const };
    },
    [importParsedItems]
  );

  const {
    items,
    addShoppingItem,
    removeShoppingItem,
    toggleShoppingItem,
    confirmPurchasedItems,
  } = useShoppingList({
    persistKey: SHOPPING_LIST_STORAGE_KEY,
    handoffPurchasesToPantry,
  });
  const [draft, setDraft] = useState('');
  const [duplicateHint, setDuplicateHint] = useState(false);
  const [purchaseConfirmedBanner, setPurchaseConfirmedBanner] = useState(false);
  const [smartPanelOpen, setSmartPanelOpen] = useState(false);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<
    string[]
  >([]);
  const [slotIds, setSlotIds] = useState<SmartSlotTuple>(() => [
    null,
    null,
    null,
  ]);
  const [categoryOpen, setCategoryOpen] = useState<
    Record<PantryCategoryId, boolean>
  >({
    produce: true,
    dairy: false,
    meat_seafood: false,
    dry_goods: false,
    spices: false,
    frozen: false,
  });

  const smartCatalog = useMemo(
    () => buildSmartSuggestionsCatalog(pantryItems),
    [pantryItems]
  );

  const canSubmitAdd = useMemo(
    () => normalizeShoppingItemInput(draft) !== null,
    [draft]
  );

  useEffect(() => {
    setDuplicateHint(false);
  }, [draft]);

  useEffect(() => {
    if (!duplicateHint) return;
    const t = setTimeout(() => setDuplicateHint(false), 4500);
    return () => clearTimeout(t);
  }, [duplicateHint]);

  useEffect(() => {
    if (!purchaseConfirmedBanner) return;
    const t = setTimeout(() => setPurchaseConfirmedBanner(false), 3200);
    return () => clearTimeout(t);
  }, [purchaseConfirmedBanner]);

  const grouped = useMemo(
    () => groupShoppingLinesByCategory(items),
    [items]
  );

  const pickedCount = useMemo(
    () => items.filter((r) => r.bought).length,
    [items]
  );

  const remainingCount = useMemo(
    () => Math.max(0, items.length - pickedCount),
    [items.length, pickedCount]
  );

  const shoppingProgressPercent = useMemo(() => {
    if (items.length === 0) return 0;
    return pickedCount / items.length;
  }, [items.length, pickedCount]);

  const submitDraft = useCallback(() => {
    const result = addShoppingItem(draft);
    if (result.ok) {
      setDuplicateHint(false);
      setDraft('');
      return;
    }
    if (result.reason === 'duplicate') {
      setDuplicateHint(true);
    }
  }, [addShoppingItem, draft]);

  useEffect(() => {
    if (!smartPanelOpen || mode !== 'planning') return;
    const onList = new Set(items.map((r) => r.name));
    const dismissed = new Set(dismissedSuggestionIds);
    setSlotIds((prev) =>
      refillSmartSlots(smartCatalog, prev, dismissed, onList)
    );
  }, [smartPanelOpen, mode, items, dismissedSuggestionIds, smartCatalog]);

  const onAddFromSuggestionSlot = useCallback(
    (slotIndex: number) => {
      const id = slotIds[slotIndex];
      const s = getSmartSuggestionById(id, smartCatalog);
      if (!s) return;
      addShoppingItem(s.addName, { source: 'suggestion' });
    },
    [slotIds, addShoppingItem, smartCatalog]
  );

  const onPassSuggestion = useCallback((suggestionId: string) => {
    setDismissedSuggestionIds((d) =>
      d.includes(suggestionId) ? d : [...d, suggestionId]
    );
  }, []);

  const toggleCategory = useCallback((cat: PantryCategoryId) => {
    setCategoryOpen((p) => ({ ...p, [cat]: !p[cat] }));
  }, []);

  const onConfirmPurchased = useCallback(() => {
    void (async () => {
      const outcome = await confirmPurchasedItems();
      if (!outcome.ok) return;
      setMode('planning');
      setPurchaseConfirmedBanner(true);
    })();
  }, [confirmPurchasedItems]);

  const itemCountLabel =
    items.length === 1
      ? '1 item on your list'
      : `${items.length} items on your list`;

  const progressPickedLabel =
    items.length === 0
      ? '0 of 0 picked'
      : `${pickedCount} of ${items.length} picked`;

  const listEmpty = items.length === 0;
  const allItemsPicked =
    mode === 'shopping' &&
    items.length > 0 &&
    pickedCount === items.length;

  const scrollEmptyStyle = listEmpty ? styles.listContentEmpty : undefined;

  return (
    <SafeAreaView
      style={[styles.safe, mode === 'shopping' && styles.safeShopping]}
      edges={['top']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={mode === 'planning'}
      >
        <View style={styles.headerBlock}>
          {mode === 'planning' && purchaseConfirmedBanner ? (
            <View style={styles.successBanner} accessibilityLiveRegion="polite">
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={colors.terracotta}
              />
              <Text style={styles.successBannerText}>
                Purchased items confirmed
              </Text>
            </View>
          ) : null}
          <Text style={styles.screenTitle}>Shopping List</Text>

          <View
            style={styles.modeSegment}
            accessibilityRole="tablist"
            accessibilityLabel="List mode"
          >
            <Pressable
              onPress={() => setMode('planning')}
              style={({ pressed }) => [
                styles.modeSegmentSlot,
                mode === 'planning' && styles.modeSegmentSlotActive,
                pressed && { opacity: 0.92 },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === 'planning' }}
            >
              <Text
                style={[
                  styles.modeSegmentLabel,
                  mode === 'planning' && styles.modeSegmentLabelActive,
                ]}
              >
                Plan
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('shopping')}
              style={({ pressed }) => [
                styles.modeSegmentSlot,
                mode === 'shopping' && styles.modeSegmentSlotActive,
                pressed && { opacity: 0.92 },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === 'shopping' }}
            >
              <Text
                style={[
                  styles.modeSegmentLabel,
                  mode === 'shopping' && styles.modeSegmentLabelActive,
                ]}
              >
                Shop
              </Text>
            </Pressable>
          </View>

          {mode === 'planning' && items.length > 0 ? (
            <Text style={styles.itemCount}>{itemCountLabel}</Text>
          ) : null}
          {mode === 'shopping' && items.length > 0 ? (
            <Text style={styles.shopModeHint}>
              Tap items as you pick them up
            </Text>
          ) : null}
        </View>

        {mode === 'shopping' && items.length > 0 ? (
          <View style={styles.shoppingSummaryWrap}>
            <View style={styles.shoppingSummary}>
              <View style={styles.shoppingSummaryStats}>
                <View style={styles.shoppingStat}>
                  <Text style={styles.shoppingStatValue}>{items.length}</Text>
                  <Text style={styles.shoppingStatLabel}>Total</Text>
                </View>
                <View style={styles.shoppingStatRule} />
                <View style={styles.shoppingStat}>
                  <Text style={styles.shoppingStatValue}>{pickedCount}</Text>
                  <Text style={styles.shoppingStatLabel}>Picked</Text>
                </View>
                <View style={styles.shoppingStatRule} />
                <View style={styles.shoppingStat}>
                  <Text style={styles.shoppingStatValue}>{remainingCount}</Text>
                  <Text style={styles.shoppingStatLabel}>Left</Text>
                </View>
              </View>
              <Text
                style={styles.shoppingProgressLead}
                accessibilityRole="text"
              >
                {progressPickedLabel}
              </Text>
              <View
                style={styles.progressTrack}
                accessibilityRole="progressbar"
                accessibilityValue={{
                  min: 0,
                  max: items.length,
                  now: pickedCount,
                  text: progressPickedLabel,
                }}
              >
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(shoppingProgressPercent * 100)}%` },
                  ]}
                />
              </View>
            </View>
          </View>
        ) : null}

        {allItemsPicked ? (
          <View style={styles.allPickedWrap}>
            <Text style={styles.allPickedText}>
              Everything is picked. Confirm to update your pantry.
            </Text>
          </View>
        ) : null}

        {mode === 'planning' ? (
          <View style={styles.addBlock}>
            <View style={styles.inputShell}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Add item (e.g. olive oil)…"
                placeholderTextColor={colors.textMuted}
                style={styles.inputInner}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (canSubmitAdd) submitDraft();
                }}
              />
              <Pressable
                onPress={submitDraft}
                disabled={!canSubmitAdd}
                style={({ pressed }) => [
                  styles.inputAddBtn,
                  !canSubmitAdd && styles.inputAddBtnDisabled,
                  pressed && canSubmitAdd && { opacity: 0.88 },
                ]}
              >
                <Text
                  style={[
                    styles.inputAddBtnLabel,
                    !canSubmitAdd && styles.inputAddBtnLabelDisabled,
                  ]}
                >
                  Add
                </Text>
              </Pressable>
            </View>
            {duplicateHint ? (
              <Text
                style={styles.duplicateHint}
                accessibilityLiveRegion="polite"
              >
                That ingredient is already on your list.
              </Text>
            ) : null}
          </View>
        ) : null}

        {mode === 'planning' ? (
          <View style={styles.smartWrap}>
            <Pressable
              onPress={() => setSmartPanelOpen((o) => !o)}
              style={({ pressed }) => [
                styles.smartToggle,
                pressed && { opacity: 0.96 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ expanded: smartPanelOpen }}
              accessibilityLabel="Smart suggestions"
            >
              <View style={styles.smartToggleInner}>
                <Ionicons
                  name="sparkles"
                  size={20}
                  color={colors.terracotta}
                />
                <Text style={styles.smartToggleTitle}>Smart Suggestions</Text>
              </View>
            </Pressable>
            {smartPanelOpen ? (
              <View style={styles.smartExpanded}>
                {Array.from(
                  { length: SMART_SUGGESTION_SLOT_COUNT },
                  (_, slotIndex) => {
                    const id = slotIds[slotIndex];
                    const s = getSmartSuggestionById(id, smartCatalog);
                    return (
                      <View
                        key={`smart-slot-${slotIndex}`}
                        style={styles.smartCardFull}
                      >
                        {s ? (
                          <>
                            <View style={styles.smartCardHead}>
                              <Text style={styles.smartCardTitle}>
                                {s.label}
                              </Text>
                              <Pressable
                                onPress={() => onPassSuggestion(s.id)}
                                hitSlop={10}
                                accessibilityLabel={`Pass, ${s.label}`}
                                accessibilityHint="Replace with another suggestion"
                              >
                                <Ionicons
                                  name="close"
                                  size={22}
                                  color={colors.textMuted}
                                />
                              </Pressable>
                            </View>
                            <Text style={styles.smartDetail}>{s.detail}</Text>
                            <View style={styles.smartCardFooter}>
                              <View
                                style={
                                  s.tag === 'recipe'
                                    ? styles.smartTagRecipe
                                    : styles.smartTagSmart
                                }
                              >
                                <Text
                                  style={
                                    s.tag === 'recipe'
                                      ? styles.smartTagRecipeText
                                      : styles.smartTagSmartText
                                  }
                                  numberOfLines={1}
                                >
                                  {s.tag === 'recipe' && s.recipeName
                                    ? `Recipe: ${s.recipeName}`
                                    : 'Smart Suggestion'}
                                </Text>
                              </View>
                              <Pressable
                                onPress={() =>
                                  onAddFromSuggestionSlot(slotIndex)
                                }
                                style={({ pressed }) => [
                                  styles.smartCardAddBtn,
                                  pressed && { opacity: 0.9 },
                                ]}
                                accessibilityLabel={`Add ${s.label}`}
                              >
                                <Text style={styles.smartCardAddBtnLabel}>
                                  Add
                                </Text>
                              </Pressable>
                            </View>
                          </>
                        ) : (
                          <Text style={styles.smartEmptySlot}>
                            No more suggestions right now.
                          </Text>
                        )}
                      </View>
                    );
                  }
                )}
                <Text style={styles.recipesBlurb}>
                  Suggestions use your Pantry tab and the app&apos;s recipe list:
                  “recipe” picks finish meals you&apos;re almost ready to cook;
                  other picks are staples that unlock more dishes.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <ScrollView
          style={styles.list}
          contentContainerStyle={[styles.listContent, scrollEmptyStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {listEmpty ? (
            <View style={styles.emptyStateWrap}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name="basket-outline"
                  size={26}
                  color={colors.terracotta}
                />
              </View>
              <Text style={styles.emptyTitle}>
                Your shopping list is empty.
              </Text>
              <Text style={styles.emptySubtitle}>
                {mode === 'planning'
                  ? 'Add ingredients you need for upcoming meals.'
                  : 'Go back to planning to build your list.'}
              </Text>
            </View>
          ) : mode === 'planning' ? (
            <View style={styles.sectionsWrap}>
              {PANTRY_CATEGORY_ORDER.map((cat) => {
                const sectionRows = grouped[cat];
                if (sectionRows.length === 0) return null;
                const open = categoryOpen[cat] ?? true;
                return (
                  <View key={cat} style={styles.section}>
                    <Pressable
                      onPress={() => toggleCategory(cat)}
                      style={({ pressed }) => [
                        styles.categoryHeaderRow,
                        pressed && { opacity: 0.85 },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                    >
                      <Text style={styles.categoryHeaderLabel}>
                        {PANTRY_SECTION_LABEL[cat]}
                      </Text>
                      <Ionicons
                        name={open ? 'chevron-down' : 'chevron-forward'}
                        size={20}
                        color={colors.textMuted}
                      />
                    </Pressable>
                    {open ? (
                      <View style={styles.sectionRows}>
                        {sectionRows.map((row) => (
                          <View key={row.id} style={styles.planCard}>
                            <View style={styles.planCardBody}>
                              <Text
                                style={[
                                  styles.planItemName,
                                  row.bought && styles.itemNameBought,
                                ]}
                                numberOfLines={2}
                              >
                                {formatShoppingItemDisplay(row.name)}
                              </Text>
                            </View>
                            <Pressable
                              onPress={() => removeShoppingItem(row.id)}
                              style={({ pressed }) => [
                                styles.deleteBtn,
                                pressed && { opacity: 0.8 },
                              ]}
                              accessibilityLabel={`Remove ${formatShoppingItemDisplay(row.name)}`}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={20}
                                color={colors.textMuted}
                              />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.shoppingSectionsWrap}>
              {PANTRY_CATEGORY_ORDER.map((cat) => {
                const sectionRows = grouped[cat];
                if (sectionRows.length === 0) return null;
                const open = categoryOpen[cat] ?? true;
                return (
                  <View key={cat} style={styles.section}>
                    <Pressable
                      onPress={() => toggleCategory(cat)}
                      style={({ pressed }) => [
                        styles.categoryHeaderRow,
                        pressed && { opacity: 0.85 },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                    >
                      <Text style={styles.categoryHeaderLabel}>
                        {PANTRY_SECTION_LABEL[cat]}
                      </Text>
                      <Ionicons
                        name={open ? 'chevron-down' : 'chevron-forward'}
                        size={20}
                        color={colors.textMuted}
                      />
                    </Pressable>
                    {open ? (
                      <View style={styles.shoppingSectionRows}>
                        {sectionRows.map((row) => (
                          <Pressable
                            key={row.id}
                            onPress={() => toggleShoppingItem(row.id)}
                            style={({ pressed }) => [
                              styles.shoppingRow,
                              row.bought && styles.shoppingRowPicked,
                              pressed && { opacity: 0.92 },
                            ]}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: row.bought }}
                          >
                            <View
                              style={[
                                styles.shoppingCheck,
                                row.bought && styles.shoppingCheckOn,
                              ]}
                            >
                              {row.bought ? (
                                <Ionicons
                                  name="checkmark"
                                  size={26}
                                  color={colors.white}
                                />
                              ) : null}
                            </View>
                            <Text
                              style={[
                                styles.shoppingItemName,
                                row.bought && styles.shoppingItemNamePicked,
                              ]}
                              numberOfLines={2}
                            >
                              {formatShoppingItemDisplay(row.name)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {mode === 'shopping' ? (
          <View
            style={[
              styles.footer,
              styles.footerShopping,
              {
                paddingBottom: Math.max(14, insets.bottom + 10),
              },
            ]}
          >
            <Pressable
              onPress={onConfirmPurchased}
              style={({ pressed }) => [
                styles.footerBtnShopping,
                pressed && { opacity: 0.92 },
              ]}
            >
              <Text style={styles.footerBtnShoppingLabel}>
                Confirm Purchased Items
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ height: Math.max(12, insets.bottom) }} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeShopping: {
    backgroundColor: '#F3EDE6',
  },
  flex: {
    flex: 1,
  },
  headerBlock: {
    paddingTop: 4,
    paddingHorizontal: 22,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    backgroundColor: colors.peach,
    borderWidth: 1,
    borderColor: 'rgba(201, 107, 74, 0.2)',
  },
  successBannerText: {
    flex: 1,
    fontFamily: fonts.sansSemi,
    fontSize: 15,
    color: colors.text,
  },
  screenTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 28,
    color: colors.text,
    lineHeight: 34,
  },
  modeSegment: {
    flexDirection: 'row',
    marginTop: 16,
    padding: 3,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(44, 36, 22, 0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeSegmentSlot: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  modeSegmentSlotActive: {
    backgroundColor: colors.terracotta,
  },
  modeSegmentLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 14,
    color: colors.textMuted,
  },
  modeSegmentLabelActive: {
    color: colors.white,
  },
  itemCount: {
    marginTop: 12,
    fontFamily: fonts.sansSemi,
    fontSize: 15,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  shopModeHint: {
    marginTop: 10,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  shoppingSummaryWrap: {
    paddingHorizontal: 22,
    marginTop: 14,
    marginBottom: 4,
  },
  shoppingSummary: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shoppingSummaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shoppingStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  shoppingStatValue: {
    fontFamily: fonts.sansSemi,
    fontSize: 24,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  shoppingStatLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  shoppingStatRule: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    minHeight: 36,
    backgroundColor: colors.border,
  },
  shoppingProgressLead: {
    marginTop: 14,
    fontFamily: fonts.sansSemi,
    fontSize: 15,
    color: colors.text,
  },
  progressTrack: {
    marginTop: 8,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.peach,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.terracotta,
  },
  smartWrap: {
    paddingHorizontal: 22,
    marginTop: 16,
    marginBottom: 4,
    gap: 12,
  },
  smartToggle: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#2C2416',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  smartToggleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  smartToggleTitle: {
    fontFamily: fonts.serifSemi,
    fontSize: 18,
    color: colors.text,
  },
  smartExpanded: {
    gap: 12,
  },
  smartCardFull: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smartCardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  smartCardTitle: {
    flex: 1,
    fontFamily: fonts.sansSemi,
    fontSize: 17,
    color: colors.text,
    lineHeight: 22,
  },
  smartDetail: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    marginBottom: 14,
  },
  smartCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  smartTagRecipe: {
    flex: 1,
    alignSelf: 'flex-start',
    maxWidth: '62%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.pinkTag,
  },
  smartTagRecipeText: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    color: colors.text,
  },
  smartTagSmart: {
    flex: 1,
    alignSelf: 'flex-start',
    maxWidth: '62%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(44, 36, 22, 0.06)',
  },
  smartTagSmartText: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    color: colors.textMuted,
  },
  smartCardAddBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.terracotta,
  },
  smartCardAddBtnLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 14,
    color: colors.white,
  },
  smartEmptySlot: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
  },
  recipesBlurb: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  addBlock: {
    paddingHorizontal: 22,
    marginTop: 14,
    gap: 8,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingLeft: 16,
    paddingRight: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  inputInner: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    paddingRight: 10,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.text,
  },
  inputAddBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(44, 36, 22, 0.06)',
  },
  inputAddBtnDisabled: {
    opacity: 0.45,
  },
  inputAddBtnLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 14,
    color: colors.textMuted,
  },
  inputAddBtnLabelDisabled: {
    color: colors.textMuted,
  },
  duplicateHint: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.terracotta,
    lineHeight: 20,
    paddingLeft: 2,
  },
  list: {
    flex: 1,
    marginTop: 16,
  },
  listContent: {
    paddingHorizontal: 22,
    paddingBottom: 16,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 220,
    paddingVertical: 24,
  },
  emptyStateWrap: {
    alignItems: 'center',
    paddingHorizontal: 8,
    maxWidth: 320,
    alignSelf: 'center',
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.peach,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    textAlign: 'center',
    fontFamily: fonts.serifSemi,
    fontSize: 22,
    color: colors.text,
    lineHeight: 28,
  },
  emptySubtitle: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  allPickedWrap: {
    marginHorizontal: 22,
    marginTop: 10,
    marginBottom: 2,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    backgroundColor: 'rgba(201, 107, 74, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(201, 107, 74, 0.18)',
  },
  allPickedText: {
    textAlign: 'center',
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  sectionsWrap: {
    paddingTop: 4,
    gap: 22,
  },
  shoppingSectionsWrap: {
    paddingTop: 12,
    gap: 28,
  },
  section: {
    gap: 10,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingRight: 4,
  },
  categoryHeaderLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 13,
    letterSpacing: 0.85,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  sectionRows: {
    gap: 10,
  },
  shoppingSectionRows: {
    gap: 12,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planCardBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  planItemName: {
    fontFamily: fonts.serifSemi,
    fontSize: 18,
    color: colors.text,
    lineHeight: 24,
  },
  itemNameBought: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shoppingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    minHeight: 68,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  shoppingRowPicked: {
    backgroundColor: 'rgba(201, 107, 74, 0.07)',
    borderColor: 'rgba(44, 36, 22, 0.08)',
    borderLeftColor: colors.terracotta,
  },
  shoppingCheck: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.terracottaSoft,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shoppingCheckOn: {
    backgroundColor: colors.terracotta,
    borderColor: colors.terracotta,
    borderWidth: 2,
  },
  shoppingItemName: {
    flex: 1,
    fontFamily: fonts.serifSemi,
    fontSize: 20,
    color: colors.text,
    lineHeight: 26,
  },
  shoppingItemNamePicked: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
    opacity: 0.78,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 22,
    paddingTop: 14,
  },
  footerShopping: {
    backgroundColor: colors.surface,
    paddingTop: 16,
  },
  footerBtnShopping: {
    minHeight: 58,
    borderRadius: radii.md,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnShoppingLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 16,
    color: colors.white,
  },
});
