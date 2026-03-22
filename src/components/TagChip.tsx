import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../theme/tokens';
import { fonts } from '../theme/typography';

const REMOVE_HIT = 44;

export type TagChipProps = {
  label: string;
  selected?: boolean;
  /** Shows a trailing “×” control; provide `onRemove` so it can dismiss the tag. */
  removable?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  accessibilityHint?: string;
};

/**
 * Pill chip for profile preferences: selectable presets, optional remove affordance.
 * Minimum ~44pt combined height for primary tap targets.
 */
export function TagChip({
  label,
  selected = false,
  removable = false,
  onPress,
  onRemove,
  accessibilityHint,
}: TagChipProps) {
  const showRemove = removable && typeof onRemove === 'function';

  const labelNode = (
    <Text
      style={[styles.label, selected && styles.labelSelected]}
      numberOfLines={1}
    >
      {label}
    </Text>
  );

  return (
    <View
      style={[
        styles.shell,
        selected ? styles.shellSelected : styles.shellIdle,
        showRemove && styles.shellWithRemove,
      ]}
    >
      {onPress ? (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.labelHit,
            showRemove ? styles.labelHitWithRemove : styles.labelHitSolo,
            pressed && { opacity: 0.88 },
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={label}
          accessibilityHint={accessibilityHint}
        >
          {labelNode}
        </Pressable>
      ) : (
        <View
          style={[
            styles.labelHit,
            showRemove ? styles.labelHitWithRemove : styles.labelHitSolo,
          ]}
          accessibilityRole="text"
          accessibilityLabel={label}
        >
          {labelNode}
        </View>
      )}

      {showRemove ? (
        <Pressable
          onPress={onRemove}
          style={({ pressed }) => [
            styles.removeHit,
            pressed && { opacity: 0.75 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.removeIconWrap}>
            <Ionicons
              name="close"
              size={20}
              color={selected ? colors.terracotta : colors.textMuted}
            />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: REMOVE_HIT,
    borderRadius: radii.pill,
    borderWidth: 1,
    overflow: 'hidden',
  },
  shellIdle: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  shellSelected: {
    backgroundColor: 'rgba(201, 107, 74, 0.12)',
    borderColor: colors.terracottaSoft,
  },
  shellWithRemove: {
    paddingRight: 4,
  },
  labelHit: {
    justifyContent: 'center',
    minHeight: REMOVE_HIT,
  },
  labelHitSolo: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  labelHitWithRemove: {
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 10,
  },
  label: {
    fontFamily: fonts.sansSemi,
    fontSize: 14,
    color: colors.text,
  },
  labelSelected: {
    color: colors.terracotta,
  },
  removeHit: {
    width: REMOVE_HIT,
    minHeight: REMOVE_HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(44, 36, 22, 0.07)',
  },
});
