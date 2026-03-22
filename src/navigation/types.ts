import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** Passed when opening Chat from Home (AI bar or a recipe card). */
export type ChatScreenParams = {
  /** Current “Recommended” / in-pantry recipe ids from the home filter. */
  recommendedIds?: string[];
  /** If set, open with a full explanation already threaded in the chat. */
  explainRecipeId?: string;
};

export type RootStackParamList = {
  Home: undefined;
  Chat: ChatScreenParams | undefined;
};

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type ChatScreenProps = NativeStackScreenProps<RootStackParamList, 'Chat'>;
