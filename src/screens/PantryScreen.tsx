import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PantryScreenProps } from '../navigation/types';
import { usePantryContext } from '../pantry';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/typography';

type PantryCategory = 'produce' | 'protein' | 'pantry';

const CATEGORY_ORDER: PantryCategory[] = ['produce', 'protein', 'pantry'];

const CATEGORY_LABELS: Record<PantryCategory, string> = {
  produce: 'Produce',
  protein: 'Protein',
  pantry: 'Pantry',
};

/** Rough keyword buckets for demo — first match wins (produce → protein → pantry). */
function ingredientCategory(name: string): PantryCategory {
  const n = name.toLowerCase();

  const produceHints = [
    'lettuce',
    'spinach',
    'kale',
    'arugula',
    'onion',
    'garlic',
    'tomato',
    'carrot',
    'potato',
    'pepper',
    'celery',
    'cucumber',
    'broccoli',
    'cauliflower',
    'zucchini',
    'squash',
    'mushroom',
    'corn',
    'apple',
    'banana',
    'orange',
    'lemon',
    'lime',
    'berry',
    'avocado',
    'cilantro',
    'parsley',
    'basil',
    'mint',
    'scallion',
    'green onion',
    'asparagus',
    'cabbage',
    'chard',
    'herb',
    'ginger',
  ];

  const proteinHints = [
    'chicken',
    'beef',
    'pork',
    'turkey',
    'lamb',
    'duck',
    'steak',
    'bacon',
    'sausage',
    'salmon',
    'tuna',
    'fish',
    'shrimp',
    'prawn',
    'cod',
    'tilapia',
    'egg',
    'tofu',
    'tempeh',
    'yogurt',
    'cheese',
    'milk',
    'ricotta',
    'mozzarella',
    'feta',
    'paneer',
  ];

  if (produceHints.some((kw) => n.includes(kw))) return 'produce';
  if (proteinHints.some((kw) => n.includes(kw))) return 'protein';
  return 'pantry';
}

type GroupedEntry = { name: string; index: number };

function groupByCategory(items: string[]): Record<PantryCategory, GroupedEntry[]> {
  const buckets: Record<PantryCategory, GroupedEntry[]> = {
    produce: [],
    protein: [],
    pantry: [],
  };
  items.forEach((name, index) => {
    const cat = ingredientCategory(name);
    buckets[cat].push({ name, index });
  });
  return buckets;
}

export function PantryScreen({ navigation }: PantryScreenProps) {
  const { items, addIngredient, removeIngredientAt } = usePantryContext();
  const [draft, setDraft] = useState('');

  const submitDraft = useCallback(() => {
    if (addIngredient(draft)) setDraft('');
  }, [addIngredient, draft]);

  const grouped = useMemo(() => groupByCategory(items), [items]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          {navigation.canGoBack() ? (
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && { opacity: 0.75 },
              ]}
              hitSlop={12}
            >
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.iconBtn} />
          )}
          <Text style={styles.screenTitle}>My Pantry</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <View style={styles.addRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="e.g. olive oil, garlic…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={submitDraft}
          />
          <Pressable
            onPress={submitDraft}
            style={({ pressed }) => [
              styles.addBtn,
              pressed && { opacity: 0.92 },
            ]}
          >
            <Text style={styles.addBtnLabel}>Add</Text>
          </Pressable>
        </View>

        {items.length > 0 ? (
          <Text style={styles.hint}>
            {items.length} ingredient{items.length === 1 ? '' : 's'} saved
          </Text>
        ) : null}

        <ScrollView
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            items.length === 0 && styles.listContentEmpty,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {items.length === 0 ? (
            <Text style={styles.emptyMessage}>No ingredients yet</Text>
          ) : (
            <View style={styles.groupedWrap}>
              {CATEGORY_ORDER.map((cat) => {
                const entries = grouped[cat];
                if (entries.length === 0) return null;
                return (
                  <View key={cat} style={styles.categoryBlock}>
                    <Text style={styles.categoryTitle}>
                      {CATEGORY_LABELS[cat]}
                    </Text>
                    <View style={styles.chipsWrap}>
                      {entries.map(({ name, index }) => (
                        <View key={`${index}-${name}`} style={styles.chip}>
                          <Text style={styles.chipLabel} numberOfLines={1}>
                            {name}
                          </Text>
                          <Pressable
                            onPress={() => removeIngredientAt(index)}
                            style={({ pressed }) => [
                              styles.chipRemove,
                              pressed && { opacity: 0.7 },
                            ]}
                            hitSlop={8}
                            accessibilityLabel={`Remove ${name}`}
                          >
                            <Ionicons
                              name="close"
                              size={16}
                              color={colors.textMuted}
                            />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarSpacer: {
    width: 40,
  },
  screenTitle: {
    fontFamily: fonts.serifBold,
    fontSize: 22,
    color: colors.text,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    marginTop: 8,
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.text,
  },
  addBtn: {
    paddingHorizontal: 22,
    minHeight: 52,
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.terracotta,
  },
  addBtnLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 16,
    color: colors.white,
  },
  hint: {
    marginTop: 16,
    paddingHorizontal: 22,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  list: {
    flex: 1,
    marginTop: 14,
  },
  listContent: {
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 80,
  },
  emptyMessage: {
    textAlign: 'center',
    fontFamily: fonts.sansSemi,
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 22,
  },
  groupedWrap: {
    paddingTop: 4,
    gap: 22,
  },
  categoryBlock: {
    gap: 10,
  },
  categoryTitle: {
    fontFamily: fonts.serifSemi,
    fontSize: 18,
    color: colors.text,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 4,
  },
  chipLabel: {
    flexShrink: 1,
    fontFamily: fonts.sansSemi,
    fontSize: 14,
    color: colors.text,
  },
  chipRemove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pinkTag,
  },
});
