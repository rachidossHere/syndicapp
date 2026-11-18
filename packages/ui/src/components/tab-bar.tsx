import type { LucideIcon } from 'lucide-react-native';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme-provider';
import { Icon } from './icon';
import { Text } from './text';

/** Nombre maximal d'onglets : 4 au plan 02, 5 depuis le plan 02b (Accueil, Charges, Signalements, Annonces, Profil). */
export const TAB_BAR_MAX_ITEMS = 5;

export type TabBarItem<Key extends string = string> = {
  key: Key;
  label: string;
  icon: LucideIcon;
};

export type TabBarProps<Key extends string = string> = {
  /** Onglets à afficher : 5 au maximum (les suivants sont ignorés). */
  items: readonly TabBarItem<Key>[];
  activeKey: Key;
  onChange: (key: Key) => void;
  /** Ajoute la marge de la zone sûre du bas (indicateur d'accueil). Par défaut : oui. */
  safeAreaBottom?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Barre d'onglets : icône 22 et libellé `caption`, `primary` si actif, `iconInactive` sinon.
 * L'onglet actif est en duotone et son libellé reste affiché : jamais la couleur seule. Aucune
 * animation au changement d'onglet (plan 02b).
 */
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
            <Icon icon={item.icon} color={color} size={sizes.tabIcon} variant={active ? 'duotone' : 'line'} />
            {/* Cinq libellés sur une ligne : le texte se réduit un peu plutôt que de passer à la ligne. */}
            <Text
              variant="caption"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{ color, textAlign: 'center', paddingHorizontal: spacing.xs }}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
