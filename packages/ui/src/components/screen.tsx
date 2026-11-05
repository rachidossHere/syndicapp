import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme-provider';

/** Toutes les bordures de l'écran : encoche, barre d'état, indicateur d'accueil. */
const ALL_EDGES: readonly Edge[] = ['top', 'bottom', 'left', 'right'];

export type ScreenProps = {
  children: ReactNode;
  /** Active le défilement (ScrollView). Sinon, contenu fixe (View). */
  scroll?: boolean;
  /** Style du contenu (fusionné en dernier) : mise en page uniquement. */
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Écran du design system : fond `bg`, marge latérale de 20, zone sûre sur tous les bords.
 * Le contenu ne passe jamais sous l'encoche ni sous les barres système.
 * Les sections sont espacées de `layout.sectionGap`.
 */
export function Screen({ children, scroll = false, contentStyle, testID }: ScreenProps) {
  const { colors, layout } = useTheme();

  const content: ViewStyle = {
    paddingHorizontal: layout.screenPadding,
    paddingVertical: layout.sectionGap,
    gap: layout.sectionGap,
  };

  return (
    <SafeAreaView edges={ALL_EDGES} style={[styles.fill, { backgroundColor: colors.bg }]} testID={testID}>
      {scroll ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[content, contentStyle]}
          // La zone sûre est déjà appliquée par SafeAreaView : pas de second décalage sur iOS.
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, content, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
