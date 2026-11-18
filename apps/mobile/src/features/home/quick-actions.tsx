// Grille d'accès rapide (écran 1 de docs/design-v2.png) : tuiles `ActionTile` à pastille duotone par
// domaine, deux par ligne (le libellé « Appartements » ne tient pas sur trois colonnes à 20 de marge).
// Un onglet s'ouvre avec `navigate` (aucun écran empilé) ; les autres écrans s'ouvrent au-dessus des onglets.
import { ActionTile, Text, useTheme, type IconComponent } from '@syndic/ui';
import { useRouter, type Href } from 'expo-router';
import Building from 'lucide-react-native/icons/building';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import Flag from 'lucide-react-native/icons/flag';
import Megaphone from 'lucide-react-native/icons/megaphone';
import Receipt from 'lucide-react-native/icons/receipt';
import Wallet from 'lucide-react-native/icons/wallet';
import { View } from 'react-native';

import type { TranslationKey } from '@/i18n/translate';
import { useT } from '@/i18n/use-t';
import type { QuickAction, QuickActionId } from '@/lib/home';

const TILES: Record<QuickActionId, { icon: IconComponent; labelKey: TranslationKey }> = {
  lots: { icon: Building, labelKey: 'home.lots' },
  charges: { icon: Wallet, labelKey: 'home.charges' },
  expense: { icon: Receipt, labelKey: 'home.quick.expense' },
  issues: { icon: Flag, labelKey: 'home.issues' },
  announcements: { icon: Megaphone, labelKey: 'home.announcements' },
  accounts: { icon: ChartColumn, labelKey: 'home.accounts' },
  report: { icon: Flag, labelKey: 'issues.new' },
};

/** Les tuiles par paires : une ligne de deux, la dernière complétée par un vide si le nombre est impair. */
function inPairs<T>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += 2) rows.push(items.slice(index, index + 2));
  return rows;
}

export function QuickActions({ actions, title }: { actions: readonly QuickAction[]; title?: string }) {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  if (actions.length === 0) return null;

  const open = (action: QuickAction) =>
    action.tab ? router.navigate(action.href as Href) : router.push(action.href as Href);

  return (
    <View style={{ gap: spacing.md }}>
      {title !== undefined && <Text variant="h3">{title}</Text>}
      {inPairs(actions).map((row) => (
        <View key={row[0]!.id} style={{ flexDirection: 'row', gap: spacing.md }}>
          {row.map((action) => (
            <ActionTile
              key={action.id}
              label={t(TILES[action.id].labelKey)}
              icon={TILES[action.id].icon}
              domain={action.domain}
              onPress={() => open(action)}
              style={{ flex: 1 }}
            />
          ))}
          {row.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}
