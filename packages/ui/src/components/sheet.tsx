import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme-provider';
import { Text } from './text';

export type SheetProps = {
  /** Feuille affichée ou non. */
  visible: boolean;
  /** Titre de la feuille (déjà traduit). */
  title: string;
  /** Libellé lu par les lecteurs d'écran sur le fond assombri, qui ferme la feuille (déjà traduit). */
  dismissLabel: string;
  /** Fermeture sans valider : toucher en dehors, geste ou bouton retour d'Android. */
  onClose: () => void;
  children: ReactNode;
  /** Actions en bas de la feuille (ex. « Annuler » et « Valider »). */
  footer?: ReactNode;
  testID?: string;
};

/**
 * Feuille qui monte du bas de l'écran, au-dessus d'un fond assombri : fond `surface`, coins
 * supérieurs arrondis, marges de l'écran, zone sûre du bas respectée. Toucher le fond la ferme.
 */
export function Sheet({ visible, title, dismissLabel, onClose, children, footer, testID }: SheetProps) {
  const { colors, layout, opacity, radius } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      testID={testID}>
      {/* Le clavier ne doit pas recouvrir un champ de la feuille (ex. motif d'une annulation). */}
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.text, opacity: opacity.scrim }]}
        />
        <View
          accessibilityViewIsModal
          style={{
            gap: layout.sectionGap,
            paddingTop: layout.screenPadding,
            paddingHorizontal: layout.screenPadding,
            paddingBottom: insets.bottom + layout.sectionGap,
            borderTopStartRadius: radius.xl,
            borderTopEndRadius: radius.xl,
            borderCurve: 'continuous',
            backgroundColor: colors.surface,
          }}>
          <Text variant="h3">{title}</Text>
          {children}
          {footer}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
});
