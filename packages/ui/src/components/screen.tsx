import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme-provider';

/** Toutes les bordures de l'écran : encoche, barre d'état, indicateur d'accueil. */
const ALL_EDGES: readonly Edge[] = ['top', 'bottom', 'left', 'right'];

export type ScreenProps = {
  children: ReactNode;
  /** Active le défilement (ScrollView). Sinon, contenu fixe (View). */
  scroll?: boolean;
  /**
   * Pied d'écran fixe (bouton principal d'un formulaire, lien secondaire) : il reste visible
   * et remonte au-dessus du clavier, tandis que le contenu défile.
   */
  footer?: ReactNode;
  /** Style du contenu (fusionné en dernier) : mise en page uniquement. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Geste « tirer pour actualiser » (avec `scroll`) : appelé quand l'utilisateur tire l'écran. */
  onRefresh?: () => void;
  /** Actualisation en cours (indicateur du geste « tirer pour actualiser »). */
  refreshing?: boolean;
  testID?: string;
};

/**
 * Écran du design system : fond `bg`, marge latérale de 20, zone sûre sur tous les bords.
 * Le contenu ne passe jamais sous l'encoche ni sous les barres système.
 * Les sections sont espacées de `layout.sectionGap`.
 */
export function Screen({
  children,
  scroll = false,
  footer,
  contentStyle,
  onRefresh,
  refreshing = false,
  testID,
}: ScreenProps) {
  const { colors, layout } = useTheme();

  const content: ViewStyle = {
    paddingHorizontal: layout.screenPadding,
    paddingVertical: layout.sectionGap,
    gap: layout.sectionGap,
  };

  const body = scroll ? (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[content, contentStyle]}
      // La zone sûre est déjà appliquée par SafeAreaView : pas de second décalage sur iOS.
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh === undefined ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        )
      }>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, content, contentStyle]}>{children}</View>
  );

  // L'arbre est le même avec ou sans pied : un pied qui apparaît ou disparaît (les boutons d'une
  // dépense disparaissent quand elle est annulée) ne doit jamais changer le type du parent du
  // contenu. Sinon React démonte puis remonte tout le contenu, y compris une feuille (Modal)
  // encore présentée, et iOS garde une présentation fantôme qui capte les touchers.
  return (
    <SafeAreaView edges={ALL_EDGES} style={[styles.fill, { backgroundColor: colors.bg }]} testID={testID}>
      {/* iOS : le clavier recouvre l'écran, on remonte le pied ; Android redimensionne déjà la fenêtre. */}
      <KeyboardAvoidingView
        style={styles.fill}
        enabled={footer !== undefined}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
        {footer !== undefined && (
          <View
            style={{
              paddingHorizontal: layout.screenPadding,
              paddingBottom: layout.sectionGap,
              gap: layout.listGap,
            }}>
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
