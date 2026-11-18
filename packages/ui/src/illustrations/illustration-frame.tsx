import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg from 'react-native-svg';

export type IllustrationProps = {
  /** Largeur en px ; la hauteur suit les proportions du dessin. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type FrameProps = IllustrationProps & {
  /** Dimensions du dessin (viewBox) : définissent les proportions. */
  width: number;
  height: number;
  /** Largeur par défaut quand `size` n'est pas donné. */
  defaultSize: number;
  /** Cadrage : `xMidYMid meet` par défaut ; `xMidYMax slice` pour une scène qui remplit son cadre. */
  preserveAspectRatio?: string;
  children: ReactNode;
};

/**
 * Cadre commun des illustrations : décoratives, donc masquées aux lecteurs d'écran (VoiceOver,
 * TalkBack), sans toucher, et statiques. Rien n'est inversé en arabe : une illustration qui
 * indiquerait une direction le ferait elle-même.
 */
export function IllustrationFrame({
  size,
  style,
  testID,
  width,
  height,
  defaultSize,
  preserveAspectRatio,
  children,
}: FrameProps) {
  const w = size ?? defaultSize;
  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: w, height: (w * height) / width }, style]}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio={preserveAspectRatio}>
        {children}
      </Svg>
    </View>
  );
}
