import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ChatScreenParams, HomeScreenProps } from '../navigation/types';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/typography';
import {
  DEMO_PROFILE,
  DEMO_RECIPES,
  filterRecipesByMeal,
  getAlmostThereRecipes,
  getFullyStockedRecipes,
  type MealFilter,
} from '../data';

const FILTERS: MealFilter[] = [
  'all',
  'breakfast',
  'lunch',
  'dinner',
  'vegetarian',
];

function greetingLabel(): string {
  const h = new Date().getHours();
  if (h < 12) return 'GOOD MORNING';
  if (h < 17) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
}

function chatParams(
  recommendedIds: string[],
  explainRecipeId?: string
): ChatScreenParams {
  return {
    recommendedIds,
    ...(explainRecipeId ? { explainRecipeId } : {}),
  };
}

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(width * 0.58, 220);
  const [meal, setMeal] = useState<MealFilter>('all');

  const base = useMemo(
    () => filterRecipesByMeal(DEMO_RECIPES, meal),
    [meal]
  );

  const recommended = useMemo(() => getFullyStockedRecipes(base), [base]);
  const almost = useMemo(() => getAlmostThereRecipes(base), [base]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <Text style={styles.kicker}>{greetingLabel()}</Text>
            <Text style={styles.title}>What to cook? 🌸</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{DEMO_PROFILE.initials}</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.chatBar,
            pressed && { opacity: 0.92 },
          ]}
          onPress={() =>
            navigation.navigate(
              'Chat',
              chatParams(recommended.map((r) => r.id))
            )
          }
        >
          <View style={styles.chatDot} />
          <Text style={styles.chatPlaceholder} numberOfLines={1}>
            Ask me what to cook tonight…
          </Text>
          <Ionicons name="arrow-forward" size={18} color={colors.chatBarAccent} />
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {FILTERS.map((f) => {
            const active = meal === f;
            const label =
              f === 'all'
                ? 'All'
                : f.charAt(0).toUpperCase() + f.slice(1);
            return (
              <Pressable
                key={f}
                onPress={() => setMeal(f)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Recommended</Text>
          <Text style={styles.seeAll}>see all</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {recommended.map((r) => (
            <Pressable
              key={r.id}
              style={[styles.recCard, { width: cardW }]}
              onPress={() =>
                navigation.navigate(
                  'Chat',
                  chatParams(recommended.map((x) => x.id), r.id)
                )
              }
            >
              <View style={styles.recImage}>
                <Text style={styles.recEmoji}>{r.emoji}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>✓ In pantry</Text>
                </View>
              </View>
              <Text style={styles.recTitle} numberOfLines={2}>
                {r.title}
              </Text>
              <Text style={styles.recMeta}>
                ⏱ {r.minutes} min · {r.difficulty}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.dividerWrap}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>
            ALMOST THERE — A FEW ITEMS MISSING
          </Text>
          <View style={styles.dividerLine} />
        </View>

        {almost.map((r) => (
          <View key={r.id} style={styles.almostCard}>
            <Pressable
              style={styles.almostMain}
              onPress={() =>
                navigation.navigate(
                  'Chat',
                  chatParams(recommended.map((x) => x.id), r.id)
                )
              }
            >
              <View style={styles.almostThumb}>
                <Text style={styles.thumbEmoji}>{r.emoji}</Text>
              </View>
              <View style={styles.almostBody}>
                <Text style={styles.almostTitle}>{r.title}</Text>
                <Text style={styles.almostMeta}>
                  {r.minutes} min · {r.difficulty}
                </Text>
                <View style={styles.tagRow}>
                  {r.missingFromPantry.map((m) => (
                    <View key={m} style={styles.tag}>
                      <Text style={styles.tagText}>+ {m}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Pressable>
            <Pressable style={styles.addBtn}>
              <Ionicons name="add" size={22} color={colors.white} />
            </Pressable>
          </View>
        ))}

        <View style={{ height: 28 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  headerTextCol: { flex: 1, paddingRight: 12 },
  kicker: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  title: {
    marginTop: 6,
    fontFamily: fonts.serifBold,
    fontSize: 28,
    color: colors.text,
    lineHeight: 34,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.peachDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.sansSemi,
    fontSize: 14,
    color: colors.text,
  },
  chatBar: {
    marginHorizontal: 22,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.chatBar,
    borderRadius: radii.lg,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  chatDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.chatBarAccent,
  },
  chatPlaceholder: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
  },
  chipsRow: {
    paddingHorizontal: 22,
    paddingVertical: 18,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 10,
  },
  chipActive: {
    backgroundColor: colors.terracotta,
    borderColor: colors.terracotta,
  },
  chipText: {
    fontFamily: fonts.sansSemi,
    fontSize: 13,
    color: colors.text,
  },
  chipTextActive: {
    color: colors.white,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 22,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: fonts.serifSemi,
    fontSize: 22,
    color: colors.text,
  },
  seeAll: {
    fontFamily: fonts.sansSemi,
    fontSize: 13,
    color: colors.terracotta,
  },
  carousel: {
    paddingHorizontal: 22,
    gap: 14,
    paddingBottom: 8,
  },
  recCard: {
    marginRight: 4,
  },
  recImage: {
    height: 148,
    borderRadius: radii.md,
    backgroundColor: colors.peach,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  recEmoji: {
    fontSize: 64,
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  badgeText: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    color: colors.text,
  },
  recTitle: {
    marginTop: 12,
    fontFamily: fonts.serifSemi,
    fontSize: 17,
    color: colors.text,
  },
  recMeta: {
    marginTop: 4,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    marginTop: 28,
    marginBottom: 18,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontFamily: fonts.sansSemi,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 200,
  },
  almostCard: {
    marginHorizontal: 22,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  almostMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  almostThumb: {
    width: 72,
    height: 72,
    borderRadius: radii.sm,
    backgroundColor: colors.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmoji: {
    fontSize: 36,
  },
  almostBody: {
    flex: 1,
    minWidth: 0,
  },
  almostTitle: {
    fontFamily: fonts.serifSemi,
    fontSize: 16,
    color: colors.text,
  },
  almostMeta: {
    marginTop: 4,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    backgroundColor: colors.pinkTag,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  tagText: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    color: colors.terracotta,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
