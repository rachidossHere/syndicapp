// Barre d'onglets de l'appli (plan 02b, étape 3) : le composant `TabBar` de @syndic/ui, branché sur
// les onglets d'Expo Router. Les onglets affichés dépendent du rôle dans la résidence active
// (`tabsForRole`) ; changer de résidence ou de rôle les recalcule, et revient sur Accueil si l'onglet
// affiché n'existe plus.
//
// Pourquoi pas NativeTabs : il n'accepte comme icône que des symboles SF, des images ou une police
// d'icônes (`VectorIcon`), jamais un composant React. Nos icônes lucide ne peuvent donc y passer que
// par une autre route que `Icon`, ce qu'AGENTS.md interdit. Aucune animation au changement d'onglet.
import { TabBar, type IconComponent } from '@syndic/ui';
import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import Flag from 'lucide-react-native/icons/flag';
import House from 'lucide-react-native/icons/house';
import Megaphone from 'lucide-react-native/icons/megaphone';
import User from 'lucide-react-native/icons/user';
import Wallet from 'lucide-react-native/icons/wallet';
import { useEffect } from 'react';

import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { shouldResetToHome, tabsForRole, type TabIcon } from '@/lib/tabs';

const ICONS: Record<TabIcon, IconComponent> = {
  house: House,
  wallet: Wallet,
  'chart-column': ChartColumn,
  flag: Flag,
  megaphone: Megaphone,
  user: User,
};

export function RoleTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const t = useT();
  const { active, query } = useActiveResidence();
  // Tant que les résidences ne sont pas connues, on ne sait pas quel est le rôle : barre minimale
  // (Accueil et Profil) et aucune correction, pour ne pas écarter un lien ouvert au démarrage.
  const known = query.data !== undefined;
  const role = active?.role ?? null;
  const tabs = tabsForRole(known ? role : null);

  const focused = state.routes[state.index]?.name;
  const home = state.routes.find((route) => route.name === 'home');
  useEffect(() => {
    if (!known || focused === undefined || home === undefined) return;
    if (shouldResetToHome(role, focused)) navigateToTab(home.key);
  }, [known, role, focused, home, navigateToTab]);

  const items = tabs.flatMap((tab) => {
    const route = state.routes.find((candidate) => candidate.name === tab.route);
    return route === undefined ? [] : [{ key: route.key, label: t(tab.labelKey), icon: ICONS[tab.icon] }];
  });
  const activeKey = state.routes[state.index]?.key ?? '';

  return <TabBar items={items} activeKey={activeKey} onChange={navigateToTab} testID="role-tab-bar" />;
}
