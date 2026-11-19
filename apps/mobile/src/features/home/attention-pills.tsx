// Pastilles « À traiter » de l'accueil de gestion (écran 1 de docs/design-v2.png) : impayés,
// signalements urgents (ou à traiter pour le gardien). Cachées quand le nombre est 0, et tant que les
// nombres ne sont pas connus (un échec n'empêche pas l'accueil de s'afficher). Chaque pastille ouvre
// l'écran qui permet de traiter l'élément. Les nombres viennent des routes existantes.
import { Text, useTheme } from '@syndic/ui';
import { useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useChargeCalls } from '@/hooks/use-charges';
import { useIssueCounts } from '@/hooks/use-issues';
import { useT } from '@/i18n/use-t';
import { attentionItems, attentionKey, seesIssuesToHandle, seesUnpaid, type AttentionItem } from '@/lib/home';
import type { Role } from '@syndic/shared';

const TONE: Record<AttentionItem['kind'], 'danger' | 'warning'> = {
  unpaid: 'danger',
  urgent: 'danger',
  toHandle: 'warning',
};

export function AttentionPills({ role, residenceId }: { role: Role; residenceId: string }) {
  const { colors, radius, spacing, sizes, opacity } = useTheme();
  const t = useT();
  const router = useRouter();
  // Une requête n'est faite que si le rôle a la permission : l'API refuse de toute façon les autres.
  const calls = useChargeCalls(seesUnpaid(role) ? residenceId : undefined);
  const counts = useIssueCounts(seesIssuesToHandle(role) ? residenceId : undefined);
  const items = attentionItems(role, { calls: calls.data, counts: counts.data });

  if (items.length === 0) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="h3">{t('home.attention.title')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {items.map((item) => {
          const label = t(attentionKey(item.kind, item.count), { count: item.count });
          const tone = TONE[item.kind];
          return (
            <Pressable
              key={item.kind}
              accessibilityRole="button"
              accessibilityLabel={label}
              // Les impayés d'un appel s'ouvrent au-dessus des onglets ; Charges et Signalements sont des onglets.
              onPress={() =>
                item.href.pathname === '/unpaid/[id]' ? router.push(item.href as Href) : router.navigate(item.href as Href)
              }
              style={({ pressed }) => ({
                minHeight: sizes.touchTarget,
                justifyContent: 'center',
                paddingHorizontal: spacing.lg,
                borderRadius: radius.pill,
                backgroundColor: colors[`${tone}Bg`],
                opacity: pressed ? opacity.pressed : 1,
              })}>
              <Text variant="bodyStrong" style={{ color: colors[`${tone}Fg`] }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
