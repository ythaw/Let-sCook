import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { buildChefSystemPrompt } from '../ai/chefSystemPrompt';
import { explainRecipeById, getMockChefReply } from '../ai/mockChefAI';
import type { ChefChatTurn } from '../ai/chefChatTypes';
import { completeChefChat, readGeminiConfigFromEnv } from '../ai/geminiChef';
import { DEMO_PROFILE, getRecipeById, type DemoRecipe } from '../data';
import type { ChatScreenProps } from '../navigation/types';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/typography';

type Msg = { id: string; role: 'user' | 'assistant'; text: string };

const firstName = DEMO_PROFILE.displayName.split(' ')[0] ?? 'there';

function toChefTurns(msgs: Msg[]): ChefChatTurn[] {
  return msgs
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-24)
    .map((m) => ({ role: m.role, content: m.text }));
}

function buildOpeningThread(
  recommended: DemoRecipe[],
  explainRecipeId: string | undefined,
  liveModel: boolean
): Msg[] {
  const openedRecipe =
    explainRecipeId != null ? getRecipeById(explainRecipeId) : undefined;
  let welcomeText: string;
  if (recommended.length > 0) {
    welcomeText = `Hi ${firstName} — I’ve brought in your current “Recommended” list from home (all in pantry). Tap a recipe chip below for a full walkthrough, or type anything.`;
  } else if (openedRecipe) {
    welcomeText = `Hi ${firstName} — You opened “${openedRecipe.title}” from home. I’ve started the walkthrough below; use the chips to jump to other recipes when you have matches, or ask anything.`;
  } else {
    welcomeText = `Hi ${firstName} — There aren’t any fully-in-pantry matches for the filter you used on home, but you can still ask questions or use recipe chips if any appear.`;
  }

  const modeNote = liveModel
    ? 'Responses use Google Gemini (AI Studio key from .env). Never ship that key in a public app — use a backend proxy for production.'
    : 'No Gemini API key set — using offline demo replies. Add EXPO_PUBLIC_GEMINI_API_KEY (or EXPO_PUBLIC_GOOGLE_AI_API_KEY) to .env.';

  const msgs: Msg[] = [
    {
      id: 'welcome',
      role: 'assistant',
      text: `${welcomeText}\n\n(${modeNote})`,
    },
  ];

  if (recommended.length > 0) {
    msgs.push({
      id: 'recap',
      role: 'assistant',
      text:
        'Right now you can make:\n' +
        recommended
          .map(
            (r) =>
              `• ${r.title} — ${r.minutes} min · ${r.difficulty} · ~${r.caloriesPerServing} kcal/serving`
          )
          .join('\n'),
    });
  }

  if (explainRecipeId) {
    const recipe = getRecipeById(explainRecipeId);
    if (recipe) {
      msgs.push({
        id: 'open-user',
        role: 'user',
        text: `Walk me through “${recipe.title}”—ingredients, time, nutrition, and step-by-step.`,
      });
      const body = explainRecipeById(explainRecipeId);
      if (body) {
        msgs.push({
          id: 'open-assistant',
          role: 'assistant',
          text: body,
        });
      }
    }
  }

  return msgs;
}

export function ChatScreen({ navigation, route }: ChatScreenProps) {
  const listRef = useRef<FlatList<Msg>>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pickerRecipes, setPickerRecipes] = useState<DemoRecipe[]>([]);
  const [sending, setSending] = useState(false);

  const { apiKey: geminiKey, model: geminiModel, apiBaseUrl: geminiBase } =
    useMemo(() => readGeminiConfigFromEnv(), []);
  const liveModel = Boolean(geminiKey);

  const params = route.params;

  useFocusEffect(
    useCallback(() => {
      const ids = params?.recommendedIds ?? [];
      const resolved = ids
        .map((id) => getRecipeById(id))
        .filter((x): x is DemoRecipe => Boolean(x));
      setPickerRecipes(resolved);
      setMessages(
        buildOpeningThread(resolved, params?.explainRecipeId, liveModel)
      );
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: false })
      );
    }, [params?.recommendedIds, params?.explainRecipeId, liveModel])
  );

  const recipeChips = useMemo(() => {
    const m = new Map(pickerRecipes.map((r) => [r.id, r]));
    const extraId = params?.explainRecipeId;
    if (extraId) {
      const ex = getRecipeById(extraId);
      if (ex) m.set(ex.id, ex);
    }
    return [...m.values()];
  }, [pickerRecipes, params?.explainRecipeId]);

  const appendRecipeExplanation = useCallback(
    async (recipe: DemoRecipe) => {
      if (sending) return;
      const userMsg: Msg = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: `Explain “${recipe.title}” in full detail (ingredients, time, nutrition, allergies, step-by-step).`,
      };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);
      try {
        let assistantText: string;
        if (geminiKey) {
          const systemPrompt = buildChefSystemPrompt(
            pickerRecipes.map((r) => r.title)
          );
          const history = toChefTurns([...messages, userMsg]);
          assistantText = await completeChefChat({
            apiKey: geminiKey,
            model: geminiModel,
            systemPrompt,
            messages: history,
            apiBaseUrl: geminiBase,
          });
        } else {
          assistantText =
            explainRecipeById(recipe.id) ?? 'I couldn’t find that recipe.';
        }
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', text: assistantText },
        ]);
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        const fallback =
          explainRecipeById(recipe.id) ?? 'I couldn’t find that recipe.';
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: `Couldn’t reach the model (${err}). Offline version:\n\n${fallback}`,
          },
        ]);
      } finally {
        setSending(false);
        requestAnimationFrame(() =>
          listRef.current?.scrollToEnd({ animated: true })
        );
      }
    },
    [
      sending,
      geminiKey,
      geminiModel,
      geminiBase,
      pickerRecipes,
      messages,
    ]
  );

  const send = useCallback(async () => {
    const t = input.trim();
    if (!t || sending) return;
    setInput('');
    const userMsg: Msg = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: t,
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    try {
      let assistantText: string;
      if (geminiKey) {
        const systemPrompt = buildChefSystemPrompt(
          pickerRecipes.map((r) => r.title)
        );
        const history = toChefTurns([...messages, userMsg]);
        assistantText = await completeChefChat({
          apiKey: geminiKey,
          model: geminiModel,
          systemPrompt,
          messages: history,
          apiBaseUrl: geminiBase,
        });
      } else {
        assistantText = getMockChefReply(t);
      }
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', text: assistantText },
      ]);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      const fallback = getMockChefReply(t);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: `Couldn’t reach the model (${err}). Offline reply:\n\n${fallback}`,
        },
      ]);
    } finally {
      setSending(false);
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: true })
      );
    }
  }, [
    input,
    sending,
    messages,
    geminiKey,
    geminiModel,
    geminiBase,
    pickerRecipes,
  ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <View style={styles.topTitleWrap}>
            <Text style={styles.topKicker}>Chef assistant</Text>
            <Text style={styles.topTitle}>Ask anything</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubbleRow,
                item.role === 'user' && styles.bubbleRowUser,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  item.role === 'user' ? styles.bubbleUser : styles.bubbleBot,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    item.role === 'user' && styles.bubbleTextUser,
                  ]}
                >
                  {item.text}
                </Text>
              </View>
            </View>
          )}
        />

        {recipeChips.length > 0 ? (
          <View style={styles.chipSection}>
            <Text style={styles.chipSectionLabel}>Recipes</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScroll}
            >
              {recipeChips.map((r) => (
                <Pressable
                  key={r.id}
                  style={({ pressed }) => [
                    styles.recipeChip,
                    pressed && { opacity: 0.88 },
                  ]}
                  onPress={() => void appendRecipeExplanation(r)}
                  disabled={sending}
                >
                  <Text style={styles.recipeChipEmoji}>{r.emoji}</Text>
                  <Text style={styles.recipeChipTitle} numberOfLines={2}>
                    {r.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="e.g. Suggest dinner with what I have…"
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
          />
          <Pressable
            style={[
              styles.sendBtn,
              (!input.trim() || sending) && styles.sendBtnDisabled,
            ]}
            onPress={() => void send()}
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons name="send" size={20} color={colors.white} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitleWrap: { flex: 1, alignItems: 'center' },
  topKicker: {
    fontFamily: fonts.sansSemi,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  topTitle: {
    fontFamily: fonts.serifSemi,
    fontSize: 18,
    color: colors.text,
  },
  listContent: {
    padding: 16,
    paddingBottom: 12,
  },
  bubbleRow: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bubbleRowUser: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bubbleUser: {
    backgroundColor: colors.terracotta,
  },
  bubbleBot: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  bubbleTextUser: {
    color: colors.white,
  },
  chipSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: colors.background,
  },
  chipSectionLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.textMuted,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  chipScroll: {
    paddingHorizontal: 12,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  recipeChip: {
    width: 112,
    minHeight: 72,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginHorizontal: 4,
  },
  recipeChipEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  recipeChipTitle: {
    fontFamily: fonts.sansSemi,
    fontSize: 12,
    color: colors.text,
    lineHeight: 16,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.chatBar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
});
