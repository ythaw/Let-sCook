import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ProfileScreenProps } from '../navigation/types';
import { colors } from '../theme/tokens';
import { fonts } from '../theme/typography';

export function ProfileScreen(_props: ProfileScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.sub}>Account and preferences coming soon.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 22,
    paddingTop: 16,
  },
  title: {
    fontFamily: fonts.serifBold,
    fontSize: 26,
    color: colors.text,
  },
  sub: {
    marginTop: 8,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.textMuted,
  },
});
