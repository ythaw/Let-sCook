import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { analyzePantryImage } from '../ai/geminiPantryImage';
import { readGeminiConfigFromEnv } from '../ai/geminiChef';
import type { PantryScreenProps } from '../navigation/types';
import {
  PANTRY_CATEGORY_LABELS,
  PANTRY_CATEGORY_ORDER,
  PANTRY_SECTION_LABEL,
  usePantryContext,
  type PantryCategoryId,
  type PantryStockItem,
} from '../pantry';
import type { ParsedPantryImport } from '../pantry/usePantry';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/typography';

type FilterChip = 'all' | PantryCategoryId;

/** Distance above tab bar; keep FAB clear of nav but close to it. */
const TAB_BAR_CLEARANCE = 52;

type ImportDraftRow = {
  key: string;
  name: string;
  category: PantryCategoryId;
  quantity: number;
  unit: string;
};

function makeEmptyGrouped(): Record<PantryCategoryId, PantryStockItem[]> {
  return PANTRY_CATEGORY_ORDER.reduce(
    (acc, c) => {
      acc[c] = [];
      return acc;
    },
    {} as Record<PantryCategoryId, PantryStockItem[]>
  );
}

function parsedToDrafts(rows: ParsedPantryImport[]): ImportDraftRow[] {
  return rows.map((r, i) => ({
    key: `ai-${Date.now()}-${i}`,
    name: r.name,
    category: r.category,
    quantity: Math.max(1, r.quantity),
    unit: r.unit ?? '',
  }));
}

function itemEmoji(name: string): string {
  const n = name.toLowerCase();
  const map: [string, string][] = [
    ['broccoli', '🥦'],
    ['onion', '🧅'],
    ['garlic', '🧄'],
    ['tomato', '🍅'],
    ['carrot', '🥕'],
    ['potato', '🥔'],
    ['mushroom', '🍄'],
    ['corn', '🌽'],
    ['apple', '🍎'],
    ['banana', '🍌'],
    ['lemon', '🍋'],
    ['egg', '🥚'],
    ['milk', '🥛'],
    ['cheese', '🧀'],
    ['bread', '🍞'],
    ['rice', '🍚'],
    ['pasta', '🍝'],
    ['chicken', '🍗'],
    ['fish', '🐟'],
    ['butter', '🧈'],
  ];
  for (const [k, e] of map) {
    if (n.includes(k)) return e;
  }
  return '🛒';
}

export function PantryScreen(_props: PantryScreenProps) {
  const insets = useSafeAreaInsets();
  const {
    items,
    addItem,
    adjustQuantity,
    importParsedItems,
  } = usePantryContext();

  const geminiCfg = useMemo(() => readGeminiConfigFromEnv(), []);

  const [search, setSearch] = useState('');
  const [chip, setChip] = useState<FilterChip>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [lockedCategory, setLockedCategory] = useState<PantryCategoryId | null>(
    null
  );
  const [draftName, setDraftName] = useState('');
  const [draftCategory, setDraftCategory] =
    useState<PantryCategoryId>('produce');
  const [draftQty, setDraftQty] = useState(1);
  const [draftUnit, setDraftUnit] = useState('');

  const [aiBusy, setAiBusy] = useState(false);
  const [importDrafts, setImportDrafts] = useState<ImportDraftRow[] | null>(
    null
  );

  const openAddModal = useCallback((lock: PantryCategoryId | null) => {
    setLockedCategory(lock);
    setDraftCategory(lock ?? 'produce');
    setDraftName('');
    setDraftQty(1);
    setDraftUnit('');
    setAddOpen(true);
  }, []);

  const submitManualAdd = useCallback(() => {
    const name = draftName.trim();
    if (!name) {
      Alert.alert('Name required', 'Enter an item name.');
      return;
    }
    const cat = lockedCategory ?? draftCategory;
    addItem({
      name,
      category: cat,
      quantity: Math.max(1, draftQty),
      unitLabel: draftUnit.trim() || undefined,
    });
    setAddOpen(false);
  }, [addItem, draftCategory, draftName, draftQty, draftUnit, lockedCategory]);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (q && !it.name.toLowerCase().includes(q)) return false;
      if (chip !== 'all' && it.category !== chip) return false;
      if (lowStockOnly && it.quantity > it.lowStockAt) return false;
      return true;
    });
  }, [items, search, chip, lowStockOnly]);

  const grouped = useMemo(() => {
    const m = makeEmptyGrouped();
    for (const it of visibleItems) {
      m[it.category].push(it);
    }
    return m;
  }, [visibleItems]);

  const showCategoryBlock = useCallback(
    (cat: PantryCategoryId) => chip === 'all' || chip === cat,
    [chip]
  );

  const launchAiImport = useCallback(
    async (source: 'camera' | 'library') => {
      if (!geminiCfg.apiKey) {
        Alert.alert(
          'API key missing',
          'Add EXPO_PUBLIC_GEMINI_API_KEY (or GOOGLE_AI_API_KEY) to your .env file.'
        );
        return;
      }

      try {
        if (source === 'camera') {
          const cam = await ImagePicker.requestCameraPermissionsAsync();
          if (!cam.granted) {
            Alert.alert('Permission', 'Camera access is needed to take a photo.');
            return;
          }
        } else {
          const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!lib.granted) {
            Alert.alert(
              'Permission',
              'Photo library access is needed to pick an image.'
            );
            return;
          }
        }

        const picker =
          source === 'camera'
            ? ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.85,
                base64: true,
              })
            : ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.85,
                base64: true,
              });

        const result = await picker;
        if (result.canceled || !result.assets[0]) return;
        const asset = result.assets[0];
        const b64 = asset.base64;
        if (!b64) {
          Alert.alert('Error', 'Could not read image data. Try another photo.');
          return;
        }

        setAiBusy(true);
        const rows = await analyzePantryImage({
          apiKey: geminiCfg.apiKey,
          model: geminiCfg.model,
          apiBaseUrl: geminiCfg.apiBaseUrl,
          base64: b64,
          mimeType: asset.mimeType ?? 'image/jpeg',
        });
        setAiBusy(false);
        if (rows.length === 0) {
          Alert.alert(
            'Nothing detected',
            'No food items were found. Try a clearer photo or a receipt.'
          );
          return;
        }
        setImportDrafts(parsedToDrafts(rows));
      } catch (e) {
        setAiBusy(false);
        const msg = e instanceof Error ? e.message : String(e);
        Alert.alert('Could not analyze image', msg);
      }
    },
    [geminiCfg]
  );

  const updateImportDraft = useCallback(
    (key: string, patch: Partial<Omit<ImportDraftRow, 'key'>>) => {
      setImportDrafts((prev) =>
        prev
          ? prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
          : null
      );
    },
    []
  );

  const removeImportDraft = useCallback((key: string) => {
    setImportDrafts((prev) =>
      prev ? prev.filter((r) => r.key !== key) : null
    );
  }, []);

  const addBlankImportDraft = useCallback(() => {
    setImportDrafts((prev) => [
      ...(prev ?? []),
      {
        key: `new-${Date.now()}`,
        name: '',
        category: 'produce',
        quantity: 1,
        unit: '',
      },
    ]);
  }, []);

  const confirmImportDrafts = useCallback(() => {
    if (!importDrafts?.length) return;
    const rows: ParsedPantryImport[] = importDrafts
      .map((d) => ({
        name: d.name.trim(),
        category: d.category,
        quantity: Math.max(1, Math.floor(d.quantity) || 1),
        unit: d.unit.trim() || undefined,
      }))
      .filter((r) => r.name.length > 0);
    if (rows.length === 0) {
      Alert.alert('Nothing to add', 'Enter at least one item name.');
      return;
    }
    const { added, merged } = importParsedItems(rows);
    setImportDrafts(null);
    Alert.alert(
      'Pantry updated',
      `Added ${added} new item(s), merged ${merged} with matching names.`
    );
  }, [importDrafts, importParsedItems]);

  const onFabPress = useCallback(() => {
    if (aiBusy) return;
    const buttons: {
      text: string;
      onPress?: () => void;
      style?: 'cancel' | 'destructive' | 'default';
    }[] = [
      {
        text: 'Photo library',
        onPress: () => void launchAiImport('library'),
      },
    ];
    if (Platform.OS !== 'web') {
      buttons.unshift({
        text: 'Take photo',
        onPress: () => void launchAiImport('camera'),
      });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(
      'Add from photo',
      'Take a picture or choose one from your library. We’ll read groceries or a receipt and let you confirm before adding.',
      buttons
    );
  }, [aiBusy, launchAiImport]);

  const fabBottom = insets.bottom + TAB_BAR_CLEARANCE;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.column}>
        <View style={styles.topSection}>
        <View style={styles.header}>
          <Text style={styles.title}>My Pantry</Text>
          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [styles.roundBtn, pressed && { opacity: 0.85 }]}
              onPress={() => openAddModal(null)}
            >
              <Ionicons name="add" size={24} color={colors.text} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.roundBtn, pressed && { opacity: 0.85 }]}
              onPress={() => setLowStockOnly((v) => !v)}
            >
              <Ionicons
                name="options-outline"
                size={22}
                color={lowStockOnly ? colors.terracotta : colors.text}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search pantry items…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.chipBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={styles.chipScroll}
          >
            <Pressable
              style={[styles.filterChip, chip === 'all' && styles.filterChipOn]}
              onPress={() => setChip('all')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  chip === 'all' && styles.filterChipTextOn,
                ]}
              >
                All
              </Text>
            </Pressable>
            {PANTRY_CATEGORY_ORDER.map((c) => (
              <Pressable
                key={c}
                style={[styles.filterChip, chip === c && styles.filterChipOn]}
                onPress={() => setChip(c)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    chip === c && styles.filterChipTextOn,
                  ]}
                >
                  {PANTRY_CATEGORY_LABELS[c]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {lowStockOnly ? (
          <Text style={styles.filterHint}>Showing low-stock items only</Text>
        ) : null}
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: fabBottom + 130 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {items.length === 0 ? (
            <Text style={styles.empty}>
              Tap + or a dashed row to add items, or use the AI button for a
              photo or receipt.
            </Text>
          ) : null}

          {PANTRY_CATEGORY_ORDER.map((cat) => {
            if (!showCategoryBlock(cat)) return null;
            const list = grouped[cat];
            const label = PANTRY_SECTION_LABEL[cat];
            return (
              <View key={cat} style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {label}{' '}
                  <Text style={styles.sectionCount}>
                    {list.length} {list.length === 1 ? 'ITEM' : 'ITEMS'}
                  </Text>
                </Text>

                {list.map((it) => {
                  const low = it.quantity <= it.lowStockAt;
                  const subParts: string[] = [];
                  if (it.unitLabel) subParts.push(it.unitLabel);
                  if (low) subParts.push('Low stock');
                  const subtitle =
                    subParts.join(' · ') ||
                    `${it.quantity} on hand`;

                  return (
                    <View key={it.id} style={styles.itemCard}>
                      <Text style={styles.itemEmoji}>{itemEmoji(it.name)}</Text>
                      <View style={styles.itemBody}>
                        <Text style={styles.itemName}>{it.name}</Text>
                        <Text
                          style={[styles.itemSub, low && styles.itemSubWarn]}
                          numberOfLines={2}
                        >
                          {subtitle}
                        </Text>
                      </View>
                      <View style={styles.stepper}>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() => adjustQuantity(it.id, -1)}
                          hitSlop={8}
                        >
                          <Text style={styles.stepBtnText}>−</Text>
                        </Pressable>
                        <Text style={styles.stepQty}>{it.quantity}</Text>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() => adjustQuantity(it.id, 1)}
                          hitSlop={8}
                        >
                          <Text style={styles.stepBtnText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}

                <Pressable
                  style={styles.addDashed}
                  onPress={() => openAddModal(cat)}
                >
                  <Text style={styles.addDashedText}>
                    + Add {PANTRY_CATEGORY_LABELS[cat].toLowerCase()} manually
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>

        <View
          style={[styles.fabWrap, { bottom: fabBottom }]}
          pointerEvents="box-none"
        >
          <View style={styles.fabTooltip}>
            <Text style={styles.fabTooltipText}>
              Add items from a photo or receipt.
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.fab,
              pressed && { opacity: 0.9 },
              aiBusy && { opacity: 0.6 },
            ]}
            onPress={onFabPress}
            disabled={aiBusy}
          >
            {aiBusy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Ionicons name="camera" size={28} color={colors.white} />
            )}
          </Pressable>
        </View>
      </View>

      <Modal
        visible={importDrafts != null}
        animationType="slide"
        transparent
        onRequestClose={() => setImportDrafts(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalDismiss}
            onPress={() => setImportDrafts(null)}
          />
          <View style={[styles.modalSheet, styles.importSheet]}>
            <Text style={styles.modalTitle}>Review detected items</Text>
            <Text style={styles.importSub}>
              Edit names, categories, and amounts before adding to your pantry.
            </Text>
            <ScrollView
              style={styles.importScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {(importDrafts ?? []).map((row) => (
                <View key={row.key} style={styles.importRow}>
                  <View style={styles.importRowTop}>
                    <TextInput
                      style={[styles.modalInput, styles.importNameInput]}
                      placeholder="Item name"
                      placeholderTextColor={colors.textMuted}
                      value={row.name}
                      onChangeText={(t) => updateImportDraft(row.key, { name: t })}
                    />
                    <Pressable
                      style={styles.importRemove}
                      onPress={() => removeImportDraft(row.key)}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.importCatRow}
                  >
                    {PANTRY_CATEGORY_ORDER.map((c) => (
                      <Pressable
                        key={c}
                        style={[
                          styles.importCatChip,
                          row.category === c && styles.importCatChipOn,
                        ]}
                        onPress={() =>
                          updateImportDraft(row.key, { category: c })
                        }
                      >
                        <Text
                          style={[
                            styles.importCatChipText,
                            row.category === c && styles.importCatChipTextOn,
                          ]}
                          numberOfLines={1}
                        >
                          {PANTRY_CATEGORY_LABELS[c]}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <View style={styles.importQtyRow}>
                    <Text style={styles.importMiniLabel}>Qty</Text>
                    <View style={styles.importStepper}>
                      <Pressable
                        style={styles.importStepBtn}
                        onPress={() =>
                          updateImportDraft(row.key, {
                            quantity: Math.max(1, row.quantity - 1),
                          })
                        }
                      >
                        <Text style={styles.stepBtnText}>−</Text>
                      </Pressable>
                      <Text style={styles.importQtyNum}>{row.quantity}</Text>
                      <Pressable
                        style={styles.importStepBtn}
                        onPress={() =>
                          updateImportDraft(row.key, {
                            quantity: row.quantity + 1,
                          })
                        }
                      >
                        <Text style={styles.stepBtnText}>+</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.importMiniLabel}>Unit</Text>
                    <TextInput
                      style={[styles.modalInput, styles.importUnitInput]}
                      placeholder="optional"
                      placeholderTextColor={colors.textMuted}
                      value={row.unit}
                      onChangeText={(t) =>
                        updateImportDraft(row.key, { unit: t })
                      }
                    />
                  </View>
                </View>
              ))}
            </ScrollView>
            <Pressable style={styles.importAddRow} onPress={addBlankImportDraft}>
              <Text style={styles.importAddRowText}>+ Add row</Text>
            </Pressable>
            <Pressable style={styles.modalPrimary} onPress={confirmImportDrafts}>
              <Text style={styles.modalPrimaryText}>Add to pantry</Text>
            </Pressable>
            <Pressable
              style={styles.modalCancel}
              onPress={() => setImportDrafts(null)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={addOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalDismiss}
            onPress={() => setAddOpen(false)}
          />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {lockedCategory
                ? `Add to ${PANTRY_CATEGORY_LABELS[lockedCategory]}`
                : 'Add pantry item'}
            </Text>
            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Broccoli"
              placeholderTextColor={colors.textMuted}
              value={draftName}
              onChangeText={setDraftName}
            />

            {lockedCategory == null ? (
              <>
                <Text style={styles.modalLabel}>Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.modalChipRow}
                >
                  {PANTRY_CATEGORY_ORDER.map((c) => (
                    <Pressable
                      key={c}
                      style={[
                        styles.modalCatChip,
                        draftCategory === c && styles.modalCatChipOn,
                      ]}
                      onPress={() => setDraftCategory(c)}
                    >
                      <Text
                        style={[
                          styles.modalCatChipText,
                          draftCategory === c && styles.modalCatChipTextOn,
                        ]}
                      >
                        {PANTRY_CATEGORY_LABELS[c]}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}

            <Text style={styles.modalLabel}>Quantity</Text>
            <View style={styles.modalStepper}>
              <Pressable
                style={styles.modalStepBtn}
                onPress={() => setDraftQty((q) => Math.max(1, q - 1))}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
              <Text style={styles.modalQtyNum}>{draftQty}</Text>
              <Pressable
                style={styles.modalStepBtn}
                onPress={() => setDraftQty((q) => q + 1)}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>

            <Text style={styles.modalLabel}>Unit (optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 1 head, 500 g"
              placeholderTextColor={colors.textMuted}
              value={draftUnit}
              onChangeText={setDraftUnit}
            />

            <Pressable style={styles.modalPrimary} onPress={submitManualAdd}>
              <Text style={styles.modalPrimaryText}>Add to pantry</Text>
            </Pressable>
            <Pressable
              style={styles.modalCancel}
              onPress={() => setAddOpen(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
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
  column: {
    flex: 1,
  },
  topSection: {
    flexShrink: 0,
  },
  /** No maxHeight: native horizontal ScrollView clips cross-axis overflow, which hid chip labels. */
  chipBar: {
    flexGrow: 0,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 12,
  },
  title: {
    fontFamily: fonts.serifBold,
    fontSize: 26,
    color: colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.text,
    padding: 0,
  },
  chipScroll: {
    paddingHorizontal: 22,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 8,
  },
  filterChipOn: {
    backgroundColor: colors.terracotta,
    borderColor: colors.terracotta,
  },
  filterChipText: {
    fontFamily: fonts.sansSemi,
    fontSize: 13,
    color: colors.text,
  },
  filterChipTextOn: {
    color: colors.white,
  },
  filterHint: {
    paddingHorizontal: 22,
    paddingBottom: 4,
    fontFamily: fonts.sansSemi,
    fontSize: 12,
    color: colors.terracotta,
  },
  importSheet: {
    maxHeight: '88%',
  },
  importSub: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 12,
    lineHeight: 20,
  },
  importScroll: {
    maxHeight: 340,
    marginBottom: 8,
  },
  importRow: {
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  importRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  importNameInput: {
    flex: 1,
    marginBottom: 0,
  },
  importRemove: {
    padding: 8,
  },
  importCatRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
    marginBottom: 8,
  },
  importCatChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 6,
    maxWidth: 140,
  },
  importCatChipOn: {
    backgroundColor: colors.terracotta,
    borderColor: colors.terracotta,
  },
  importCatChipText: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    color: colors.text,
  },
  importCatChipTextOn: {
    color: colors.white,
  },
  importQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  importMiniLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    color: colors.textMuted,
  },
  importStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  importStepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importQtyNum: {
    minWidth: 28,
    textAlign: 'center',
    fontFamily: fonts.sansSemi,
    fontSize: 16,
    color: colors.text,
  },
  importUnitInput: {
    flex: 1,
    minWidth: 120,
    marginBottom: 0,
  },
  importAddRow: {
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  importAddRowText: {
    fontFamily: fonts.sansSemi,
    fontSize: 14,
    color: colors.terracotta,
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
  },
  section: {
    marginBottom: 26,
  },
  sectionTitle: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.textMuted,
    marginBottom: 12,
  },
  sectionCount: {
    fontFamily: fonts.sansSemi,
    color: colors.textMuted,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 12,
  },
  itemEmoji: {
    fontSize: 36,
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontFamily: fonts.serifSemi,
    fontSize: 17,
    color: colors.text,
  },
  itemSub: {
    marginTop: 4,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  itemSubWarn: {
    color: '#C44B4B',
    fontFamily: fonts.sansSemi,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    fontFamily: fonts.sansSemi,
    color: colors.text,
    marginTop: -2,
  },
  stepQty: {
    minWidth: 24,
    textAlign: 'center',
    fontFamily: fonts.sansSemi,
    fontSize: 16,
    color: colors.text,
  },
  addDashed: {
    marginTop: 4,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.terracottaSoft,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  addDashedText: {
    fontFamily: fonts.sansSemi,
    fontSize: 14,
    color: colors.terracotta,
  },
  fabWrap: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
  },
  fabTooltip: {
    maxWidth: 200,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.chatBar,
  },
  fabTooltipText: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 16,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalDismiss: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 32,
  },
  modalTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 22,
    color: colors.text,
    marginBottom: 16,
  },
  modalLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
    marginTop: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  modalChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  modalCatChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalCatChipOn: {
    backgroundColor: colors.terracotta,
    borderColor: colors.terracotta,
  },
  modalCatChipText: {
    fontFamily: fonts.sansSemi,
    fontSize: 13,
    color: colors.text,
  },
  modalCatChipTextOn: {
    color: colors.white,
  },
  modalStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 4,
  },
  modalStepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalQtyNum: {
    fontFamily: fonts.sansSemi,
    fontSize: 20,
    color: colors.text,
    minWidth: 36,
    textAlign: 'center',
  },
  modalPrimary: {
    marginTop: 22,
    backgroundColor: colors.terracotta,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalPrimaryText: {
    fontFamily: fonts.sansSemi,
    fontSize: 16,
    color: colors.white,
  },
  modalCancel: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontFamily: fonts.sansSemi,
    fontSize: 15,
    color: colors.textMuted,
  },
});
