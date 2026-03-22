import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** Passed when opening Chat from Home (AI bar or a recipe card). */
export type ChatScreenParams = {
  /** Current “Recommended” / in-pantry recipe ids from the home filter. */
  recommendedIds?: string[];
  /** If set, open with a full explanation already threaded in the chat. */
  explainRecipeId?: string;
};

export type MainTabParamList = {
  Home: undefined;
  Pantry: undefined;
  Shopping: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Chat: ChatScreenParams | undefined;
};

export type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type PantryScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Pantry'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type ShoppingScreenProps = BottomTabScreenProps<
  MainTabParamList,
  'Shopping'
>;

export type ProfileScreenProps = BottomTabScreenProps<
  MainTabParamList,
  'Profile'
>;

export type ChatScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Chat'
>;
