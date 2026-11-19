import { useTheme } from '@syndic/ui';
import { Tabs } from 'expo-router';

import { RoleTabBar } from '@/features/navigation/role-tab-bar';
import { useActiveResidence } from '@/hooks/use-residences';
import { TAB_ROUTES, tabRoutesForRole } from '@/lib/tabs';

/**
 * Onglets de la résidence active (plan 02b, étape 3). Toutes les routes d'onglets existent ; la
 * barre n'affiche que celles du rôle (`tabsForRole`), et une route absente de la barre est marquée
 * `hidden` : elle ne s'ouvre pas, et si elle était affichée, Expo Router revient sur Accueil.
 * Les écrans de détail sont dans le groupe parent `(app)` : ils s'ouvrent au-dessus des onglets.
 * Aucune animation au changement d'onglet.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const { active, query } = useActiveResidence();
  const visible = tabRoutesForRole(active?.role ?? null);
  // Résidences pas encore connues : rien n'est caché (un lien profond ne doit pas être écarté).
  const known = query.data !== undefined;

  return (
    <Tabs
      tabBar={(props) => <RoleTabBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'none', sceneStyle: { backgroundColor: colors.bg } }}>
      {TAB_ROUTES.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ hidden: known && !visible.includes(name) }} />
      ))}
    </Tabs>
  );
}
