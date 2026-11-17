import { useEffect, useRef, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
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

/** Délai laissé au clavier et au pied d'écran pour finir de bouger avant de faire défiler. */
const KEYBOARD_SETTLE_MS = 100;

/** Partie visible du contenu qui défile : position et hauteur (mises à jour sans nouveau rendu). */
type Viewport = { offset: number; height: number };

/**
 * Fait défiler le contenu pour que le champ actif reste visible, au-dessus du pied d'écran.
 * Le pied remonte avec le clavier et réduit la zone qui défile, mais ne fait pas défiler : sans cela,
 * un champ placé sous les autres (ex. « Du 1er étage ») reste caché derrière le bouton.
 */
function revealFocusedInput(scrollView: ScrollViewInstance | null, viewport: Viewport, margin: number): void {
  const input = TextInput.State.currentlyFocusedInput();
  const content = scrollView?.getInnerViewRef();
  if (!scrollView || !input || !content || viewport.height === 0) return;
  input.measureLayout(
    content,
    (_x, y, _width, height) => {
      const bottom = y + height + margin;
      if (bottom > viewport.offset + viewport.height) {
        scrollView.scrollTo({ y: bottom - viewport.height, animated: true });
      } else if (y - margin < viewport.offset) {
        scrollView.scrollTo({ y: Math.max(0, y - margin), animated: true });
      }
    },
    // Le champ actif n'est pas dans cet écran : rien à faire.
    () => undefined,
  );
}

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
  const { colors, layout, spacing } = useTheme();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const viewport = useRef<Viewport>({ offset: 0, height: 0 });
  const hasFooter = footer !== undefined;

  // Clavier ouvert avec un pied d'écran : le champ actif défile jusqu'à rester visible.
  useEffect(() => {
    if (!scroll || !hasFooter) return;
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => revealFocusedInput(scrollRef.current, viewport.current, spacing.md), KEYBOARD_SETTLE_MS);
    });
    return () => subscription.remove();
  }, [scroll, hasFooter, spacing.md]);

  const content: ViewStyle = {
    paddingHorizontal: layout.screenPadding,
    paddingVertical: layout.sectionGap,
    gap: layout.sectionGap,
  };

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      onLayout={(event: LayoutChangeEvent) => {
        viewport.current.height = event.nativeEvent.layout.height;
      }}
      onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
        viewport.current.offset = event.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
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
