import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { useTheme } from '../theme/theme-provider';
import { archPath, palmCrown } from './shapes';

const WINDOW_COLUMNS = [110, 154, 198, 242] as const;
const WINDOW_ROWS = [150, 214, 278, 342] as const;
const WINDOWS = WINDOW_ROWS.flatMap((y) => WINDOW_COLUMNS.map((x) => archPath(x, y, 28, 44)));
const FRONDS = palmCrown(52, 214, [-170, -135, -100, -65, -30, 5], 64, 16);

export type WelcomeSceneProps = {
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Scène de bienvenue en SVG (coucher de soleil, immeuble à arcades, palmier) : remplace l'image IA
 * `welcome.webp` tant qu'elle n'existe pas. Remplit son cadre (cadrage « slice »), décorative.
 */
export function WelcomeScene({ style, testID }: WelcomeSceneProps) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 360 440" preserveAspectRatio="xMidYMax slice">
        <Defs>
          <LinearGradient id="welcome-sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.terracotta} />
            <Stop offset="1" stopColor={colors.saffron} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={360} height={440} fill="url(#welcome-sky)" />
        <Circle cx={256} cy={104} r={46} fill={colors.bg} fillOpacity={0.55} />
        <Rect x={90} y={128} width={200} height={312} rx={4} fill={colors.bg} />
        <Rect x={82} y={116} width={216} height={16} rx={4} fill={colors.tealDeep} />
        <G fill={colors.tealDeep}>
          {WINDOWS.map((d) => (
            <Path key={d} d={d} />
          ))}
        </G>
        <Path
          d="M56 440Q30 330 52 214"
          fill="none"
          stroke={colors.tealDeep}
          strokeWidth={10}
          strokeLinecap="round"
        />
        <G fill={colors.palm}>
          {FRONDS.map((d) => (
            <Path key={d} d={d} />
          ))}
        </G>
      </Svg>
    </View>
  );
}
