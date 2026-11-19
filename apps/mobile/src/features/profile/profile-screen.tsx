// Écran 8 de docs/accordeons.png : onglet Profil (pas d'accordéon). Avatar, nom et e-mail au centre ; une carte
// qui groupe la résidence active (avec « changer de résidence » s'il y en a plusieurs), les notifications et
// la langue ; puis « Se déconnecter » ; puis la version. Galerie visuelle dans la carte, en développement
// seulement. Les réglages de la personne ne dépendent pas d'une résidence : l'onglet existe pour tous les
// rôles, et sans résidence.
import { Avatar, Button, Card, Chip, Icon, ListItem, Screen, SegmentedControl, Skeleton, Text, useTheme } from '@syndic/ui';
import type { Language } from '@syndic/shared';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import Bell from 'lucide-react-native/icons/bell';
import Building from 'lucide-react-native/icons/building';
import Image from 'lucide-react-native/icons/image';
import Languages from 'lucide-react-native/icons/languages';
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
  const { colors, spacing, sizes, borderWidth } = useTheme();
  const t = useT();
  const router = useRouter();
  const roleLabel = useRoleLabel();
  const { language, setLanguage } = useLanguage();
  const { signOut } = useSession();
  const me = useMe(true);
  const { active, residences, query: residencesQuery, setActive } = useActiveResidence();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | undefined>();
  // Liste des résidences, dépliée en touchant la ligne de la résidence active (plusieurs résidences seulement).
  const [switching, setSwitching] = useState(false);

  const entries = profileEntries({ isDev: __DEV__, residenceCount: residences?.length ?? 0 });
  const has = (entry: (typeof entries)[number]) => entries.includes(entry);
  const canSwitch = has('switchResidence') && residences !== undefined && active !== null;

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

  const divider = <View style={{ height: borderWidth.thin, backgroundColor: colors.border }} />;

  return (
    <Screen scroll>
      {/* Personne : avatar, nom, e-mail, au centre. */}
      {me.data !== undefined ? (
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Avatar name={me.data.name} single size={sizes.avatarLarge} />
          <Text variant="h3" accessibilityRole="header">
            {me.data.name}
          </Text>
          <Text variant="small" tone="muted" selectable>
            {me.data.email}
          </Text>
        </View>
      ) : me.error ? (
        <QueryFallback query={me} message={t('home.loadError')} />
      ) : (
        <View accessible accessibilityLabel={t('common.loading')} style={{ alignItems: 'center', gap: spacing.sm }}>
          <Skeleton width={sizes.avatarLarge} height={sizes.avatarLarge} rounded="pill" />
          <Skeleton width="40%" height={spacing.xl} />
          <Skeleton width="60%" />
        </View>
      )}

      {/* Une carte : résidence, notifications, langue (et galerie en développement). */}
      <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
        {active !== null ? (
          <ListItem
            plain
            leading={<Icon icon={Building} variant="tile" domain="residence" tileSize="sm" />}
            title={active.name}
            subtitle={canSwitch ? t('sections.profile.residenceHint', { role: roleLabel(active.role) }) : roleLabel(active.role)}
            onPress={canSwitch ? () => setSwitching((value) => !value) : undefined}
          />
        ) : (
          <View style={{ padding: spacing.lg }}>
            {residencesQuery.data !== undefined ? (
              <Text tone="muted">{t('profile.noResidence')}</Text>
            ) : residencesQuery.error ? (
              <QueryFallback query={residencesQuery} message={t('home.residenceError')} />
            ) : (
              <Skeleton width="60%" height={spacing.xl} />
            )}
          </View>
        )}
        {canSwitch && switching && (
          <View style={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
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
        {divider}

        {/* Notifications : écran existant (réglages liés à la personne). */}
        <ListItem
          plain
          title={t('home.notifications')}
          subtitle={t('home.notificationsBody')}
          leading={<Icon icon={Bell} variant="tile" domain="notifications" tileSize="sm" />}
          onPress={() => router.push('/notifications')}
        />
        {divider}

        {/* Langue : français ou arabe (la mise en page s'inverse en arabe). */}
        <ListItem
          plain
          title={t('profile.language')}
          subtitle={t('sections.profile.languageHint')}
          leading={<Icon icon={Languages} variant="tile" domain="residence" tileSize="sm" />}
        />
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
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
          <>
            {divider}
            <ListItem
              plain
              title={t('dev.gallery')}
              leading={<Icon icon={Image} variant="tile" domain="residence" tileSize="sm" />}
              onPress={() => router.push('/dev/design-v2')}
            />
          </>
        )}
      </Card>

      {signOutError !== undefined && <ErrorNotice errorKey={signOutError} />}
      <Button variant="danger" icon={LogOut} label={t('home.signOut')} loading={signingOut} onPress={() => void onSignOut()} />

      <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>
        {t('profile.version', { version: versionLabel(Constants.expoConfig?.version) })}
      </Text>
    </Screen>
  );
}
