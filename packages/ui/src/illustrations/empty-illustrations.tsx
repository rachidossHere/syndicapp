import { Circle, G, Path, Rect } from 'react-native-svg';

import { useTheme } from '../theme/theme-provider';
import { type EmptyDomain } from './empty-domain';
import { IllustrationFrame, type IllustrationProps } from './illustration-frame';
import { ResidenceIllustration } from './residence-illustration';
import { palmCrown, sparklePath } from './shapes';

const VIEWBOX = { width: 120, height: 120 } as const;
const DEFAULT_SIZE = 120;

// Feuilles de part et d'autre du bas du dessin, calculées une seule fois.
const LEAVES = [...palmCrown(30, 100, [-165, -130], 22, 6), ...palmCrown(90, 100, [-50, -15], 22, 6)];

function Leaves({ color }: { color: string }) {
  return (
    <G fill={color}>
      {LEAVES.map((d) => (
        <Path key={d} d={d} />
      ))}
    </G>
  );
}

/** Signalements : presse-papiers coché. */
export function IssuesIllustration({ size, style, testID }: IllustrationProps) {
  const { colors } = useTheme();
  return (
    <IllustrationFrame {...VIEWBOX} defaultSize={DEFAULT_SIZE} size={size} style={style} testID={testID}>
      <Leaves color={colors.palm} />
      <Rect x={32} y={20} width={56} height={82} rx={9} fill={colors.surface} stroke={colors.primary} strokeWidth={3} />
      <Rect x={46} y={13} width={28} height={13} rx={5} fill={colors.primary} />
      <Path
        d="M45 58L56 69L76 46"
        fill="none"
        stroke={colors.primary}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x={42} y={80} width={36} height={3} rx={1.5} fill={colors.borderStrong} />
      <Rect x={42} y={88} width={24} height={3} rx={1.5} fill={colors.borderStrong} />
      <Circle cx={94} cy={30} r={4} fill={colors.saffron} />
    </IllustrationFrame>
  );
}

/** Annonces : mégaphone. */
export function AnnouncementsIllustration({ size, style, testID }: IllustrationProps) {
  const { colors } = useTheme();
  return (
    <IllustrationFrame {...VIEWBOX} defaultSize={DEFAULT_SIZE} size={size} style={style} testID={testID}>
      <Path
        d="M44 52L82 30V90L44 68Z"
        fill={colors.infoBg}
        stroke={colors.infoFg}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Rect x={28} y={50} width={18} height={20} rx={4} fill={colors.infoFg} />
      <Path
        d="M44 70L50 94Q51 98 55 98H60Q62 98 61 95L56 76"
        fill="none"
        stroke={colors.infoFg}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M92 48Q101 60 92 72" fill="none" stroke={colors.saffron} strokeWidth={4} strokeLinecap="round" />
      <Path d="M100 38Q116 60 100 82" fill="none" stroke={colors.saffron} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={30} cy={32} r={4} fill={colors.terracotta} />
    </IllustrationFrame>
  );
}

/** Charges : portefeuille et pièce. */
export function ChargesIllustration({ size, style, testID }: IllustrationProps) {
  const { colors } = useTheme();
  return (
    <IllustrationFrame {...VIEWBOX} defaultSize={DEFAULT_SIZE} size={size} style={style} testID={testID}>
      <Leaves color={colors.palm} />
      <Rect x={22} y={44} width={76} height={50} rx={10} fill={colors.successBg} stroke={colors.successFg} strokeWidth={3} />
      <Rect x={72} y={60} width={30} height={18} rx={9} fill={colors.surface} stroke={colors.successFg} strokeWidth={3} />
      <Circle cx={83} cy={69} r={3} fill={colors.successFg} />
      <Circle cx={80} cy={32} r={15} fill={colors.saffron} />
      <Circle cx={80} cy={32} r={9} fill="none" stroke={colors.terracotta} strokeWidth={2.5} />
    </IllustrationFrame>
  );
}

/** Dépenses : reçu à bord dentelé et tampon. */
export function ExpensesIllustration({ size, style, testID }: IllustrationProps) {
  const { colors } = useTheme();
  return (
    <IllustrationFrame {...VIEWBOX} defaultSize={DEFAULT_SIZE} size={size} style={style} testID={testID}>
      <Path
        d="M34 18H86V98L80 92L74 98L68 92L62 98L56 92L50 98L44 92L38 98L34 94Z"
        fill={colors.surface}
        stroke={colors.warningFg}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Rect x={44} y={30} width={32} height={4} rx={2} fill={colors.warningFg} />
      <Rect x={44} y={42} width={22} height={4} rx={2} fill={colors.borderStrong} />
      <Rect x={44} y={54} width={32} height={4} rx={2} fill={colors.borderStrong} />
      <Circle cx={74} cy={76} r={11} fill="none" stroke={colors.terracotta} strokeWidth={3} />
      <Path
        d="M69 76L73 80L79 72"
        fill="none"
        stroke={colors.terracotta}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={96} cy={28} r={4} fill={colors.saffron} />
    </IllustrationFrame>
  );
}

/** Appartements : l'immeuble de la résidence, en teal, sur fond clair. */
export function ApartmentsIllustration({ size, style, testID }: IllustrationProps) {
  return <ResidenceIllustration tone="light" size={size ?? DEFAULT_SIZE} style={style} testID={testID} />;
}

/** Générique : boîte ouverte et éclats. */
export function GenericIllustration({ size, style, testID }: IllustrationProps) {
  const { colors } = useTheme();
  return (
    <IllustrationFrame {...VIEWBOX} defaultSize={DEFAULT_SIZE} size={size} style={style} testID={testID}>
      <Path
        d="M28 56L60 70L92 56V92L60 106L28 92Z"
        fill={colors.primarySoft}
        stroke={colors.primary}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Path
        d="M28 56L44 40L60 48L76 40L92 56L60 70Z"
        fill={colors.surface}
        stroke={colors.primary}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Path d="M60 70V106" stroke={colors.primary} strokeWidth={3} />
      <Path d={sparklePath(92, 26, 9)} fill={colors.saffron} />
      <Circle cx={30} cy={34} r={3.5} fill={colors.terracotta} />
    </IllustrationFrame>
  );
}

/** Illustration d'un domaine d'état vide. */
export function EmptyIllustration({ domain, size, style, testID }: IllustrationProps & { domain: EmptyDomain }) {
  const props = { size, style, testID };
  switch (domain) {
    case 'issues':
      return <IssuesIllustration {...props} />;
    case 'announcements':
      return <AnnouncementsIllustration {...props} />;
    case 'charges':
      return <ChargesIllustration {...props} />;
    case 'expenses':
      return <ExpensesIllustration {...props} />;
    case 'apartments':
      return <ApartmentsIllustration {...props} />;
    case 'generic':
      return <GenericIllustration {...props} />;
  }
}
