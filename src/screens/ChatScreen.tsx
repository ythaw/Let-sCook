import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMockChefReply } from '../ai/mockChefAI';
import type { ChatScreenProps } from '../navigation/types';
import { DEMO_PROFILE } from '../data';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/typography';

type Msg = { id: string; role: 'user' | 'assistant'; text: string };

const firstName = DEMO_PROFILE.displayName.split(' ')[0] ?? 'there';

export function ChatScreen({ navigation }: ChatScreenProps) {
  const listRef = useRef<FlatList<Msg>>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Hi ${firstName} — I’m your cooking companion (demo). I already know your allergies, cuisines you like, tools, and pantry from your profile. Ask for meal ideas, “what’s expiring?”, or a recipe name for step-by-step help.`,
    },
  ]);

  const send = useCallback(() => {
    const t = input.trim();
    if (!t) return;
    setInput('');
    const userMsg: Msg = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: t,
    };
    const reply: Msg = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: getMockChefReply(t),
    };
    setMessages((m) => [...m, userMsg, reply]);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [input]);

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
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!input.trim()}
          >
            <Ionicons name="send" size={20} color={colors.white} />
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
    paddingBottom: 24,
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
