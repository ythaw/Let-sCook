import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ShoppingScreenProps } from '../navigation/types';
import { colors } from '../theme/tokens';
import { fonts } from '../theme/typography';

export function ShoppingScreen(_props: ShoppingScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Shopping</Text>
      <Text style={styles.sub}>Your list will live here.</Text>
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
