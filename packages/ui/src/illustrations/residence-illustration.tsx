import { Circle, G, Path, Rect } from 'react-native-svg';

import { useTheme } from '../theme/theme-provider';
import { IllustrationFrame, type IllustrationProps } from './illustration-frame';
import { archPath, palmCrown } from './shapes';

export const RESIDENCE_VIEWBOX = { width: 160, height: 130 } as const;

// Trois rangées de trois arcades, calculées une seule fois.
const WINDOW_COLUMNS = [52, 75, 98] as const;
const WINDOW_ROWS = [46, 70, 94] as const;
const WINDOWS = WINDOW_ROWS.flatMap((y) => WINDOW_COLUMNS.map((x) => archPath(x, y, 14, 20)));
const FRONDS = palmCrown(28, 70, [-165, -125, -90, -55, -15], 22, 6);

export type ResidenceIllustrationProps = IllustrationProps & {
  /**
   * `dark` : sur un fond profond (`tealDeep`), façade sable aux arcades profondes.
   * `light` : sur un fond clair, façade teal aux arcades claires.
   */
  tone?: 'dark' | 'light';
};

/** L'immeuble à arcades, le soleil et le palmier de la résidence (écran 1 de docs/design-v2.png). */
export function ResidenceIllustration({ tone = 'dark', size, style, testID }: ResidenceIllustrationProps) {
  const { colors } = useTheme();
  const wall = tone === 'dark' ? colors.bg : colors.primary;
  const opening = tone === 'dark' ? colors.tealDeep : colors.surface;

  return (
    <IllustrationFrame
      {...RESIDENCE_VIEWBOX}
      defaultSize={160}
      size={size}
      style={style}
      testID={testID}>
      <Circle cx={128} cy={34} r={13} fill={colors.saffron} />
      <Rect x={30} y={120} width={100} height={4} rx={2} fill={colors.palm} />
      <Rect x={40} y={38} width={84} height={84} rx={3} fill={wall} />
      <Rect x={36} y={32} width={92} height={8} rx={3} fill={colors.terracotta} />
      <G fill={opening}>
        {WINDOWS.map((d) => (
          <Path key={d} d={d} />
        ))}
      </G>
      <Path
        d="M32 122Q22 96 28 70"
        fill="none"
        stroke={colors.terracotta}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <G fill={colors.palm}>
        {FRONDS.map((d) => (
          <Path key={d} d={d} />
        ))}
      </G>
    </IllustrationFrame>
  );
}
