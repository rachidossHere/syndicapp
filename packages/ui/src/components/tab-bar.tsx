import type { LucideIcon } from 'lucide-react-native';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme-provider';
import { Icon } from './icon';
import { Text } from './text';

/** Nombre maximal d'onglets (plan 02). */
export const TAB_BAR_MAX_ITEMS = 4;

export type TabBarItem<Key extends string = string> = {
  key: Key;
  label: string;
  icon: LucideIcon;
};

export type TabBarProps<Key extends string = string> = {
  /** Onglets à afficher : 4 au maximum (les suivants sont ignorés). */
  items: readonly TabBarItem<Key>[];
  activeKey: Key;
  onChange: (key: Key) => void;
  /** Ajoute la marge de la zone sûre du bas (indicateur d'accueil). Par défaut : oui. */
  safeAreaBottom?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Barre d'onglets : icône 22 et libellé `caption`, `primary` si actif, `iconInactive` sinon. */
export function TabBar<Key extends string>({
  items,
  activeKey,
  onChange,
  safeAreaBottom = true,
  style,
  testID,
}: TabBarProps<Key>) {
  const { colors, spacing, sizes, borderWidth } = useTheme();
  const insets = useSafeAreaInsets();

  if (items.length > TAB_BAR_MAX_ITEMS) {
    console.warn(`[TabBar] ${items.length} onglets reçus : seuls les ${TAB_BAR_MAX_ITEMS} premiers sont affichés.`);
  }

  return (
    <View
      accessibilityRole="tablist"
      testID={testID}
      style={[
        {
          flexDirection: 'row',
          backgroundColor: colors.surface,
          borderTopWidth: borderWidth.thin,
          borderTopColor: colors.border,
          paddingBottom: safeAreaBottom ? insets.bottom : 0,
        },
        style,
      ]}>
      {items.slice(0, TAB_BAR_MAX_ITEMS).map((item) => {
        const active = item.key === activeKey;
        const color = active ? colors.primary : colors.iconInactive;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: sizes.touchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              paddingVertical: spacing.sm,
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            })}>
            <Icon icon={item.icon} color={color} size={sizes.tabIcon} />
            <Text variant="caption" style={{ color, textAlign: 'center' }}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
