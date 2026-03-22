import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import * as ExpoAV from 'expo-av';
import {
  InterruptionModeAndroid,
  InterruptionModeIOS,
} from 'expo-av';
import { File, Paths } from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buildChefSystemPrompt } from '../ai/chefSystemPrompt';
import {
  readElevenLabsConfigFromEnv,
  synthesizeSpeechToMp3,
  transcribeAudioFromUri,
} from '../ai/elevenlabsVoice';
import { completeChefChat, readGeminiConfigFromEnv } from '../ai/geminiChef';
import { explainRecipeById, getMockChefReply } from '../ai/mockChefAI';
import type { ChefChatTurn } from '../ai/chefChatTypes';
import {
  DEMO_PROFILE,
  getRecipeById,
  previewRecipeConsumption,
  type ConsumptionPreviewLine,
  type DemoRecipe,
} from '../data';
import type { ChatScreenProps } from '../navigation/types';
import { parseVoiceCookCommand } from '../chef/voiceCookCommands';
import { usePantryContext } from '../pantry';
import type { PantryStockItem } from '../pantry/types';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/typography';

type Msg = { id: string; role: 'user' | 'assistant'; text: string };

type VoiceCookSession = { recipeId: string; stepIndex: number };

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
  liveModel: boolean,
  pantryItems: PantryStockItem[]
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
    ? 'Replies use smart AI, tuned to your pantry and these recipes.'
    : 'You can open any recipe below for full walkthroughs.';

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
      const body = explainRecipeById(explainRecipeId, pantryItems);
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
  const [pantryCookRecipe, setPantryCookRecipe] = useState<DemoRecipe | null>(
    null
  );
  const { items: pantryItems, consumeRecipeIngredients } = usePantryContext();

  const { apiKey: geminiKey, model: geminiModel, apiBaseUrl: geminiBase } =
    useMemo(() => readGeminiConfigFromEnv(), []);
  const liveModel = Boolean(geminiKey);

  const elevenLabsCfg = useMemo(() => readElevenLabsConfigFromEnv(), []);
  const elevenVoiceReady = Boolean(
    elevenLabsCfg.apiKey && elevenLabsCfg.voiceId
  );
  const canVoiceInput =
    Platform.OS !== 'web' && Boolean(elevenLabsCfg.apiKey);

  type ChefRecording = Awaited<
    ReturnType<typeof ExpoAV.Audio.Recording.createAsync>
  >['recording'];
  const recordingRef = useRef<ChefRecording | null>(null);
  const soundRef = useRef<ExpoAV.Audio.Sound | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [voiceCookSession, setVoiceCookSession] =
    useState<VoiceCookSession | null>(null);
  const voiceCookRef = useRef<VoiceCookSession | null>(null);
  voiceCookRef.current = voiceCookSession;

  const params = route.params;

  const stopPlayback = useCallback(async () => {
    const s = soundRef.current;
    soundRef.current = null;
    if (s) {
      try {
        await s.stopAsync();
        await s.unloadAsync();
      } catch {
        /* already unloaded */
      }
    }
  }, []);

  /** ElevenLabs TTS + playback. Native File.write() expects one argument (bytes), not base64 + options. */
  const speakElevenLabsText = useCallback(
    async (
      plainText: string,
      options: { honorSpeakToggle: boolean }
    ): Promise<void> => {
      if (!plainText.trim()) return;
      if (!elevenLabsCfg.apiKey || !elevenLabsCfg.voiceId) return;
      if (options.honorSpeakToggle && !speakReplies) return;
      const { apiKey, voiceId, ttsModel } = elevenLabsCfg;
      await stopPlayback();
      setVoiceBusy(true);
      try {
        const ab = await synthesizeSpeechToMp3({
          apiKey,
          voiceId,
          text: plainText,
          modelId: ttsModel,
        });
        if (Platform.OS === 'web') {
          const blob = new Blob([ab], { type: 'audio/mpeg' });
          const url = URL.createObjectURL(blob);
          await new Promise<void>((resolve, reject) => {
            const HtmlAudio = globalThis.Audio;
            if (typeof HtmlAudio === 'undefined') {
              throw new Error('Web Audio not available');
            }
            const audioEl = new HtmlAudio(url);
            audioEl.onended = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audioEl.onerror = () => {
              URL.revokeObjectURL(url);
              reject(new Error('Playback failed'));
            };
            void audioEl.play().catch(reject);
          });
        } else {
          const outfile = new File(Paths.cache, `chef-tts-${Date.now()}.mp3`);
          outfile.create({ overwrite: true });
          outfile.write(new Uint8Array(ab));
          const { sound } = await ExpoAV.Audio.Sound.createAsync(
            { uri: outfile.uri },
            { shouldPlay: true }
          );
          soundRef.current = sound;
          await new Promise<void>((resolve) => {
            sound.setOnPlaybackStatusUpdate((status) => {
              if (!status.isLoaded) return;
              if (status.didJustFinish) {
                sound.setOnPlaybackStatusUpdate(null);
                void sound
                  .unloadAsync()
                  .then(() => resolve())
                  .catch(() => resolve());
              }
            });
          });
          soundRef.current = null;
        }
      } catch (e) {
        console.warn('ElevenLabs TTS', e);
      } finally {
        setVoiceBusy(false);
      }
    },
    [elevenLabsCfg, speakReplies, stopPlayback]
  );

  const playAssistantSpeech = useCallback(
    (plainText: string) =>
      void speakElevenLabsText(plainText, { honorSpeakToggle: true }),
    [speakElevenLabsText]
  );

  const playVoiceGuidance = useCallback(
    (plainText: string) =>
      void speakElevenLabsText(plainText, { honorSpeakToggle: false }),
    [speakElevenLabsText]
  );

  useFocusEffect(
    useCallback(() => {
      const ids = params?.recommendedIds ?? [];
      const resolved = ids
        .map((id) => getRecipeById(id))
        .filter((x): x is DemoRecipe => Boolean(x));
      setPickerRecipes(resolved);
      setMessages(
        buildOpeningThread(
          resolved,
          params?.explainRecipeId,
          liveModel,
          pantryItems
        )
      );
      const opened = params?.explainRecipeId
        ? getRecipeById(params.explainRecipeId)
        : undefined;
      setPantryCookRecipe(opened ?? null);
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: false })
      );
      return () => {
        void stopPlayback();
        setVoiceCookSession(null);
        const r = recordingRef.current;
        recordingRef.current = null;
        if (r) {
          void r.stopAndUnloadAsync().catch(() => {});
        }
        setIsRecording(false);
      };
    }, [
      params?.recommendedIds,
      params?.explainRecipeId,
      liveModel,
      pantryItems,
      stopPlayback,
    ])
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
            pickerRecipes.map((r) => r.title),
            pantryItems
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
            explainRecipeById(recipe.id, pantryItems) ??
            'I couldn’t find that recipe.';
        }
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', text: assistantText },
        ]);
        setPantryCookRecipe(recipe);
        void playAssistantSpeech(assistantText);
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        const fallback =
          explainRecipeById(recipe.id, pantryItems) ??
          'I couldn’t find that recipe.';
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: `Couldn’t reach the model (${err}). Offline version:\n\n${fallback}`,
          },
        ]);
        setPantryCookRecipe(recipe);
        void playAssistantSpeech(fallback);
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
      pantryItems,
      playAssistantSpeech,
    ]
  );

  const submitUserMessage = useCallback(
    async (rawText: string) => {
      const t = rawText.trim();
      if (!t || sending) return;
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
            pickerRecipes.map((r) => r.title),
            pantryItems
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
          assistantText = getMockChefReply(t, pantryItems);
        }
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', text: assistantText },
        ]);
        void playAssistantSpeech(assistantText);
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        const fallback = getMockChefReply(t, pantryItems);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: `Couldn’t reach the model (${err}). Offline reply:\n\n${fallback}`,
          },
        ]);
        void playAssistantSpeech(fallback);
      } finally {
        setSending(false);
        requestAnimationFrame(() =>
          listRef.current?.scrollToEnd({ animated: true })
        );
      }
    },
    [
      sending,
      messages,
      geminiKey,
      geminiModel,
      geminiBase,
      pickerRecipes,
      pantryItems,
      playAssistantSpeech,
    ]
  );

  const send = useCallback(() => {
    const t = input.trim();
    if (!t) return;
    setInput('');
    void submitUserMessage(t);
  }, [input, submitUserMessage]);

  const processVoiceCookInput = useCallback(
    async (transcript: string) => {
      const session = voiceCookRef.current;
      if (!session) return;
      const recipe = getRecipeById(session.recipeId);
      const steps = recipe?.steps ?? [];
      if (!steps.length) {
        setVoiceCookSession(null);
        return;
      }

      const cmd = parseVoiceCookCommand(transcript);
      let nextSession: VoiceCookSession | null = session;
      let chatLine = '';
      const speakLines: string[] = [];

      switch (cmd) {
        case 'exit':
          nextSession = null;
          chatLine = 'Leaving voice cooking mode.';
          speakLines.push('Okay. Leaving voice cooking mode.');
          break;
        case 'repeat': {
          const i = session.stepIndex;
          chatLine = `Step ${i + 1}: ${steps[i]}`;
          speakLines.push(`Step ${i + 1}. ${steps[i]}`);
          break;
        }
        case 'previous': {
          if (session.stepIndex <= 0) {
            chatLine = "You're on step 1 — nothing before this.";
            speakLines.push("You're on the first step.");
          } else {
            const pi = session.stepIndex - 1;
            nextSession = { ...session, stepIndex: pi };
            chatLine = `Step ${pi + 1}: ${steps[pi]}`;
            speakLines.push(`Step ${pi + 1}. ${steps[pi]}`);
          }
          break;
        }
        case 'next': {
          if (session.stepIndex >= steps.length - 1) {
            nextSession = null;
            chatLine = 'All steps complete — enjoy your meal!';
            speakLines.push('That was the last step. Enjoy your meal.');
          } else {
            const ni = session.stepIndex + 1;
            nextSession = { ...session, stepIndex: ni };
            chatLine = `Step ${ni + 1}: ${steps[ni]}`;
            speakLines.push(`Step ${ni + 1}. ${steps[ni]}`);
          }
          break;
        }
        default:
          chatLine =
            'Try: next, back, repeat, or stop cooking (you can say or type them).';
          speakLines.push('Say next, back, repeat, or stop cooking.');
      }

      setVoiceCookSession(nextSession);
      setMessages((p) => [
        ...p,
        { id: `vc-${Date.now()}`, role: 'assistant', text: chatLine },
      ]);
      for (const s of speakLines) {
        await speakElevenLabsText(s, { honorSpeakToggle: false });
      }
    },
    [speakElevenLabsText]
  );

  const startVoiceCooking = useCallback(
    async (recipe: DemoRecipe) => {
      if (sending || voiceBusy) return;
      if (!recipe.steps.length) {
        Alert.alert('No steps', 'This recipe has no steps to walk through.');
        return;
      }
      if (!elevenLabsCfg.apiKey) {
        Alert.alert('Voice cooking', 'Add EXPO_PUBLIC_ELEVENLABS_API_KEY in .env.');
        return;
      }
      if (!elevenLabsCfg.voiceId) {
        Alert.alert(
          'Voice cooking',
          'Add EXPO_PUBLIC_ELEVENLABS_VOICE_ID so steps can be read aloud.'
        );
        return;
      }
      await stopPlayback();
      setVoiceCookSession({ recipeId: recipe.id, stepIndex: 0 });
      const n = recipe.steps.length;
      const intro = `Voice cooking — ${recipe.title}. ${n} step${n === 1 ? '' : 's'}. Say “next” when you finish a step, “back” to go back, “repeat” to hear again, or “stop cooking” to exit.`;
      const step1 = `Step 1: ${recipe.steps[0]}`;
      setMessages((p) => [
        ...p,
        {
          id: `vc-start-${Date.now()}`,
          role: 'assistant',
          text: `${intro}\n\n${step1}`,
        },
      ]);
      await speakElevenLabsText(intro, { honorSpeakToggle: false });
      await speakElevenLabsText(`Step 1. ${recipe.steps[0]}`, {
        honorSpeakToggle: false,
      });
    },
    [elevenLabsCfg, sending, voiceBusy, speakElevenLabsText, stopPlayback]
  );

  const exitVoiceCooking = useCallback(() => {
    setVoiceCookSession(null);
    void stopPlayback();
  }, [stopPlayback]);

  const startRecording = useCallback(async () => {
    if (!canVoiceInput || sending || voiceBusy || isRecording) return;
    await stopPlayback();
    const perm = await ExpoAV.Audio.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Microphone',
        'Allow mic access to ask the chef while your hands are busy.'
      );
      return;
    }
    await ExpoAV.Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false,
    });
    try {
      const { recording } = await ExpoAV.Audio.Recording.createAsync(
        ExpoAV.Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (e) {
      Alert.alert('Recording', e instanceof Error ? e.message : String(e));
    }
  }, [canVoiceInput, sending, voiceBusy, isRecording, stopPlayback]);

  const stopRecordingAndSend = useCallback(async () => {
    const rec = recordingRef.current;
    recordingRef.current = null;
    setIsRecording(false);
    if (!rec) return;
    const key = elevenLabsCfg.apiKey;
    if (!key) {
      Alert.alert('Voice', 'Add your ElevenLabs API key in .env to use voice.');
      return;
    }
    try {
      await rec.stopAndUnloadAsync();
    } catch {
      return;
    }
    const uri = rec.getURI();
    if (!uri) return;
    const lower = uri.toLowerCase();
    const ext = lower.includes('.webm')
      ? 'webm'
      : lower.includes('.caf')
        ? 'caf'
        : lower.includes('.mp4')
          ? 'mp4'
          : 'm4a';
    const mime =
      ext === 'webm'
        ? 'audio/webm'
        : ext === 'caf'
          ? 'audio/x-caf'
          : ext === 'mp4'
            ? 'audio/mp4'
            : 'audio/m4a';
    setVoiceBusy(true);
    try {
      const text = await transcribeAudioFromUri({
        apiKey: key,
        fileUri: uri,
        filename: `chef-voice.${ext}`,
        mimeType: mime,
        modelId: elevenLabsCfg.sttModel,
      });
      if (!text.trim()) {
        Alert.alert(
          'Didn’t catch that',
          'Try again a bit closer to the mic, or a quieter spot.'
        );
        return;
      }
      if (voiceCookRef.current) {
        setMessages((p) => [
          ...p,
          { id: `vu-${Date.now()}`, role: 'user', text },
        ]);
        void processVoiceCookInput(text);
        return;
      }
      void submitUserMessage(text);
    } catch (e) {
      Alert.alert(
        'Transcription',
        e instanceof Error ? e.message : String(e)
      );
    } finally {
      setVoiceBusy(false);
    }
  }, [elevenLabsCfg, submitUserMessage, processVoiceCookInput]);

  const onMicPress = useCallback(() => {
    if (!canVoiceInput) {
      Alert.alert(
        'Voice on device',
        'Hands-free voice works in Expo Go on a phone, not in the web preview.'
      );
      return;
    }
    if (voiceBusy && !isRecording) return;
    if (isRecording) {
      void stopRecordingAndSend();
    } else {
      void startRecording();
    }
  }, [
    canVoiceInput,
    voiceBusy,
    isRecording,
    startRecording,
    stopRecordingAndSend,
  ]);

  const promptConsumePantry = useCallback(() => {
    if (!pantryCookRecipe) return;
    const preview = previewRecipeConsumption(pantryCookRecipe, pantryItems);
    if (preview.length === 0) {
      Alert.alert(
        'No pantry matches',
        'None of this recipe’s ingredients matched your pantry by name. Add or rename items if you want automatic subtraction.'
      );
      return;
    }
    const lines = preview
      .map(
        (l: ConsumptionPreviewLine) =>
          `• ${l.pantryItemName}: ${l.before} → ${l.after}${
            l.removesItem ? ' (remove row)' : ''
          }`
      )
      .join('\n');
    Alert.alert(
      'Update pantry after cooking?',
      `This subtracts 1 from each matched pantry item (best effort). Unmatched recipe lines are skipped.\n\n${lines}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: () => {
            consumeRecipeIngredients(pantryCookRecipe);
            setPantryCookRecipe(null);
          },
        },
      ]
    );
  }, [pantryCookRecipe, pantryItems, consumeRecipeIngredients]);

  const voiceCookRecipe = useMemo(
    () =>
      voiceCookSession
        ? getRecipeById(voiceCookSession.recipeId)
        : undefined,
    [voiceCookSession]
  );

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
          style={styles.flex}
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

        {voiceCookSession && voiceCookRecipe ? (
          <View style={styles.voiceCookBanner}>
            <View style={styles.voiceCookBannerText}>
              <Text style={styles.voiceCookKicker}>Voice cooking</Text>
              <Text style={styles.voiceCookRecipeTitle} numberOfLines={1}>
                {voiceCookRecipe.title}
              </Text>
              <Text style={styles.voiceCookStepLine}>
                Step {voiceCookSession.stepIndex + 1} of{' '}
                {voiceCookRecipe.steps.length}
              </Text>
              <Text style={styles.voiceCookHint} numberOfLines={2}>
                Use the mic: say “next”, “back”, “repeat”, or “stop cooking”.
              </Text>
            </View>
            <Pressable
              style={styles.voiceCookExit}
              onPress={exitVoiceCooking}
              hitSlop={8}
            >
              <Text style={styles.voiceCookExitText}>Exit</Text>
            </Pressable>
          </View>
        ) : null}

        {recipeChips.length > 0 ? (
          <View style={styles.chipSection}>
            <Text style={styles.chipSectionLabel}>Recipes</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScroll}
            >
              {recipeChips.map((r) => (
                <View key={r.id} style={styles.recipeChipWrap}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.recipeChipMain,
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
                  <Pressable
                    style={({ pressed }) => [
                      styles.startCookingBtn,
                      (sending || voiceBusy) && { opacity: 0.45 },
                    ]}
                    onPress={() => void startVoiceCooking(r)}
                    disabled={sending || voiceBusy}
                  >
                    <Ionicons
                      name="restaurant"
                      size={13}
                      color={colors.terracotta}
                    />
                    <Text style={styles.startCookingBtnText}>Start cooking</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {pantryCookRecipe ? (
          <View style={styles.cookBar}>
            <Text style={styles.cookBarText} numberOfLines={2}>
              Cooked “{pantryCookRecipe.title}”? Subtract matched pantry items.
            </Text>
            <View style={styles.cookBarActions}>
              <Pressable
                style={styles.cookBarDismiss}
                onPress={() => setPantryCookRecipe(null)}
              >
                <Text style={styles.cookBarDismissText}>Not now</Text>
              </Pressable>
              <Pressable
                style={styles.cookBarPrimary}
                onPress={promptConsumePantry}
              >
                <Text style={styles.cookBarPrimaryText}>Review & update</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.composer}>
          {canVoiceInput ? (
            <Pressable
              style={[
                styles.micBtn,
                isRecording && styles.micBtnRecording,
                (sending || (voiceBusy && !isRecording)) && styles.micBtnDisabled,
              ]}
              onPress={onMicPress}
              disabled={sending || (voiceBusy && !isRecording)}
              accessibilityLabel={
                voiceCookSession
                  ? isRecording
                    ? 'Stop and send step command'
                    : 'Record step command'
                  : isRecording
                    ? 'Stop recording and send'
                    : 'Record voice question'
              }
            >
              {voiceBusy && !isRecording ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Ionicons
                  name={isRecording ? 'stop' : 'mic'}
                  size={22}
                  color={colors.white}
                />
              )}
            </Pressable>
          ) : null}
          {elevenVoiceReady ? (
            <Pressable
              style={styles.speakToggle}
              onPress={() => setSpeakReplies((v) => !v)}
              hitSlop={8}
              accessibilityLabel={
                speakReplies ? 'Turn off read aloud' : 'Turn on read aloud'
              }
            >
              <Ionicons
                name={speakReplies ? 'volume-high' : 'volume-mute'}
                size={22}
                color={speakReplies ? colors.terracotta : colors.textMuted}
              />
            </Pressable>
          ) : null}
          <TextInput
            style={styles.input}
            placeholder={
              voiceCookSession
                ? 'Ask anything, or use the mic for next / back / repeat…'
                : 'e.g. Suggest dinner with what I have…'
            }
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
            onPress={() => send()}
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
  recipeChipWrap: {
    width: 124,
    marginHorizontal: 4,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  recipeChipMain: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
    minHeight: 68,
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
  startCookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.peach,
  },
  startCookingBtnText: {
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    color: colors.terracotta,
  },
  voiceCookBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(196, 93, 74, 0.12)',
    gap: 10,
  },
  voiceCookBannerText: {
    flex: 1,
    minWidth: 0,
  },
  voiceCookKicker: {
    fontFamily: fonts.sansSemi,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.terracotta,
    marginBottom: 2,
  },
  voiceCookRecipeTitle: {
    fontFamily: fonts.serifSemi,
    fontSize: 16,
    color: colors.text,
  },
  voiceCookStepLine: {
    fontFamily: fonts.sansSemi,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  voiceCookHint: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 15,
  },
  voiceCookExit: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  voiceCookExitText: {
    fontFamily: fonts.sansSemi,
    fontSize: 13,
    color: colors.text,
  },
  cookBar: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.peach,
  },
  cookBarText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
    marginBottom: 10,
  },
  cookBarActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    alignItems: 'center',
  },
  cookBarDismiss: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cookBarDismissText: {
    fontFamily: fonts.sansSemi,
    fontSize: 14,
    color: colors.textMuted,
  },
  cookBarPrimary: {
    backgroundColor: colors.terracotta,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.md,
  },
  cookBarPrimaryText: {
    fontFamily: fonts.sansSemi,
    fontSize: 14,
    color: colors.white,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.chatBar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnRecording: {
    backgroundColor: colors.terracotta,
  },
  micBtnDisabled: {
    opacity: 0.45,
  },
  speakToggle: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
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
