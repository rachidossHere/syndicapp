// Onglet Profil (plan 02b, étape 3) : avatar, nom et e-mail, résidence active et rôle (avec
// « Changer de résidence » s'il y en a plusieurs), notifications, langue, galerie visuelle
// (développement seulement), déconnexion et version. Les réglages de la personne ne dépendent pas
// d'une résidence : l'onglet existe pour tous les rôles, et sans résidence.
import { Avatar, Button, Card, Chip, Icon, ListItem, Screen, SegmentedControl, Skeleton, Text, useTheme } from '@syndic/ui';
import type { Language } from '@syndic/shared';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import Bell from 'lucide-react-native/icons/bell';
import Image from 'lucide-react-native/icons/image';
import LogOut from 'lucide-react-native/icons/log-out';
import { useState } from 'react';
import { View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { QueryFallback } from '@/features/charges/query-fallback';
import { useRoleLabel } from '@/features/residences/use-role-label';
import { useMe } from '@/hooks/use-me';
import { useActiveResidence } from '@/hooks/use-residences';
import { useSession } from '@/hooks/use-session';
import { useT } from '@/i18n/use-t';
import { profileEntries, versionLabel } from '@/lib/profile';
import { useLanguage } from '@/providers/language-provider';

export function ProfileScreen() {
  const { spacing, sizes } = useTheme();
  const t = useT();
  const router = useRouter();
  const roleLabel = useRoleLabel();
  const { language, setLanguage } = useLanguage();
  const { signOut } = useSession();
  const me = useMe(true);
  const { active, residences, query: residencesQuery, setActive } = useActiveResidence();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | undefined>();

  const entries = profileEntries({ isDev: __DEV__, residenceCount: residences?.length ?? 0 });
  const has = (entry: (typeof entries)[number]) => entries.includes(entry);

  const onSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(undefined);
    // `signOut` supprime d'abord le jeton push côté API, puis ferme la session (voir use-session.ts).
    // En cas de succès, la navigation protégée renvoie à l'écran de bienvenue ; sans réseau, la
    // session reste ouverte et l'erreur est affichée.
    const result = await signOut();
    if (!result.ok) {
      setSignOutError(result.formError);
      setSigningOut(false);
    }
  };

  return (
    <Screen scroll>
      <Text variant="h2" accessibilityRole="header">
        {t('profile.title')}
      </Text>

      {/* Personne : avatar, nom, e-mail. */}
      {me.data !== undefined ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <Avatar name={me.data.name} single size={sizes.avatarLarge} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="h3">{me.data.name}</Text>
            <Text variant="small" tone="muted" selectable>
              {me.data.email}
            </Text>
          </View>
        </View>
      ) : me.error ? (
        <QueryFallback query={me} message={t('home.loadError')} />
      ) : (
        <View accessible accessibilityLabel={t('common.loading')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <Skeleton width={sizes.avatarLarge} height={sizes.avatarLarge} rounded="pill" />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Skeleton width="60%" height={spacing.xxl} />
            <Skeleton width="80%" />
          </View>
        </View>
      )}

      {/* Résidence active et rôle ; changer de résidence s'il y en a plusieurs. */}
      {has('residence') && (
        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <Text variant="caption" tone="muted">
                {t('profile.residence')}
              </Text>
              {active !== null ? (
                <>
                  <Text variant="h3">{active.name}</Text>
                  <Text variant="small" tone="muted">
                    {roleLabel(active.role)}
                  </Text>
                </>
              ) : residencesQuery.data !== undefined ? (
                <Text tone="muted">{t('profile.noResidence')}</Text>
              ) : residencesQuery.error ? (
                <QueryFallback query={residencesQuery} message={t('home.residenceError')} />
              ) : (
                <Skeleton width="60%" height={spacing.xxl} />
              )}
            </View>
            {has('switchResidence') && residences !== undefined && active !== null && (
              <View style={{ gap: spacing.sm }}>
                <Text variant="bodyStrong">{t('profile.switchResidence')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {residences.map((residence) => (
                    <Chip
                      key={residence.id}
                      label={residence.name}
                      selected={residence.id === active.id}
                      onPress={() => setActive(residence.id)}
                    />
                  ))}
                </View>
              </View>
            )}
          </View>
        </Card>
      )}

      {/* Notifications : écran existant (réglages liés à la personne). */}
      <ListItem
        title={t('home.notifications')}
        subtitle={t('home.notificationsBody')}
        leading={<Icon icon={Bell} variant="tile" domain="notifications" tileSize="sm" />}
        onPress={() => router.push('/notifications')}
      />

      {/* Langue : français ou arabe (la mise en page s'inverse en arabe). */}
      <View style={{ gap: spacing.sm }}>
        <Text variant="bodyStrong">{t('profile.language')}</Text>
        <SegmentedControl<Language>
          value={language}
          onChange={(value) => void setLanguage(value)}
          options={[
            { value: 'fr', label: t('profile.language.fr') },
            { value: 'ar', label: t('profile.language.ar') },
          ]}
        />
      </View>

      {/* Développement seulement : galerie de la refonte visuelle (plan 02b). */}
      {has('gallery') && (
        <ListItem
          title={t('dev.gallery')}
          leading={<Icon icon={Image} variant="tile" domain="residence" tileSize="sm" />}
          onPress={() => router.push('/dev/design-v2')}
        />
      )}

      {signOutError !== undefined && <ErrorNotice errorKey={signOutError} />}
      <Button variant="secondary" icon={LogOut} label={t('home.signOut')} loading={signingOut} onPress={() => void onSignOut()} />

      <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>
        {t('profile.version', { version: versionLabel(Constants.expoConfig?.version) })}
      </Text>
    </Screen>
  );
}
