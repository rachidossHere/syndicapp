// Écran 3 de docs/residences.png : liste des appartements, avec recherche et filtres.
import { can, type LotStatus } from '@syndic/shared';
import {
  Badge,
  Banner,
  Button,
  Chip,
  EmptyState,
  ListItem,
  Screen,
  Text,
  TextField,
  useTheme,
} from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import Building2 from 'lucide-react-native/icons/building-2';
import Plus from 'lucide-react-native/icons/plus';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { AuthHeader } from '@/features/auth/auth-header';
import { useLots, type Lot } from '@/hooks/use-lots';
import { usePendingInvitations } from '@/hooks/use-invitations';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { ApiError } from '@/lib/api';
import { apiErrorKey } from '@/lib/api-errors';
import { daysUntil } from '@/lib/invite-code';

import { useRoleLabel } from './use-role-label';

type Filter = 'all' | LotStatus;
const FILTERS: readonly Filter[] = ['all', 'member', 'pending', 'free'];

export function LotsScreen() {
  const { colors, radius, spacing, sizes } = useTheme();
  const t = useT();
  const roleLabel = useRoleLabel();
  const router = useRouter();
  const { active, query: residencesQuery } = useActiveResidence();
  const allowed = active !== null && can(active.role, 'lots.write');
  const lots = useLots(allowed ? active.id : undefined);
  const invitations = usePendingInvitations(active?.id, allowed);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: 0, member: 0, pending: 0, free: 0 };
    for (const lot of lots.data ?? []) {
      result.all += 1;
      result[lot.status] += 1;
    }
    return result;
  }, [lots.data]);

  const visible = useMemo(() => {
    const needle = search.trim().toUpperCase();
    return (lots.data ?? []).filter(
      (lot) =>
        (filter === 'all' || lot.status === filter) && (needle === '' || lot.reference.toUpperCase().includes(needle)),
    );
  }, [lots.data, search, filter]);

  // Invitation en attente la plus récente de chaque appartement.
  const invitationByLot = useMemo(() => {
    const map = new Map<string, { id: string; expiresAt: string }>();
    for (const invitation of invitations.data ?? []) {
      if (invitation.lotId !== null && !map.has(invitation.lotId)) map.set(invitation.lotId, invitation);
    }
    return map;
  }, [invitations.data]);

  // L'API refuse de toute façon : l'écran n'est proposé qu'aux rôles qui ont `lots.write`.
  if (residencesQuery.data !== undefined && !allowed) return <Redirect href="/home" />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  const filterLabel = (value: Filter) => t(`lots.filter.${value}`, { count: counts[value] });
  const inviteLot = (lot: Lot) => router.push({ pathname: '/invite-neighbor', params: { lotId: lot.id } });

  const renderRow = (lot: Lot) => {
    const leading = (
      <View
        style={{
          minWidth: sizes.iconBox,
          height: sizes.iconBox,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.sm,
          borderCurve: 'continuous',
          backgroundColor: colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text variant="bodyStrong" tone="primary">
          {lot.reference}
        </Text>
      </View>
    );

    if (lot.status === 'member') {
      return (
        <ListItem
          key={lot.id}
          leading={leading}
          title={t('lots.row.memberTitle')}
          subtitle={t('lots.row.memberSubtitle')}
          trailing={<Badge tone="success" label={t('lots.status.member')} />}
        />
      );
    }

    if (lot.status === 'pending') {
      const invitation = invitationByLot.get(lot.id);
      const days = invitation ? daysUntil(invitation.expiresAt) : undefined;
      return (
        <ListItem
          key={lot.id}
          leading={leading}
          title={t('lots.row.pendingTitle')}
          subtitle={
            days === undefined ? undefined : days === 1 ? t('lots.row.expiresInOne') : t('lots.row.expiresIn', { days })
          }
          trailing={<Badge tone="warning" label={t('lots.status.pending')} />}
          // Sans la liste des invitations (chargement ou erreur), la ligne n'ouvre rien.
          onPress={
            invitation
              ? () => router.push({ pathname: '/invitation/[id]', params: { id: invitation.id } })
              : undefined
          }
        />
      );
    }

    return (
      <ListItem
        key={lot.id}
        leading={leading}
        title={t('lots.row.freeTitle')}
        subtitle={t('lots.row.freeSubtitle')}
        trailing={
          <Button
            label={t('lots.invite')}
            accessibilityLabel={t('lots.inviteFor', { reference: lot.reference })}
            onPress={() => inviteLot(lot)}
          />
        }
      />
    );
  };

  let body;
  if (residencesQuery.error && residencesQuery.data === undefined) {
    body = (
      <ErrorNotice
        errorKey={apiErrorKey(residencesQuery.error)}
        onRetry={() => void residencesQuery.refetch()}
        retrying={residencesQuery.isFetching}
      />
    );
  } else if (lots.data === undefined) {
    body =
      lots.error !== null && lots.error !== undefined ? (
        <View style={{ gap: spacing.md }}>
          <Banner message={t('lots.loadError')} />
          {lots.error instanceof ApiError && lots.error.status === 0 && (
            <ErrorNotice errorKey={apiErrorKey(lots.error)} onRetry={() => void lots.refetch()} retrying={lots.isFetching} />
          )}
          {!(lots.error instanceof ApiError && lots.error.status === 0) && (
            <Button
              variant="secondary"
              label={t('common.retry')}
              loading={lots.isFetching}
              onPress={() => void lots.refetch()}
            />
          )}
        </View>
      ) : (
        <Text tone="muted">{t('common.loading')}</Text>
      );
  } else if (lots.data.length === 0) {
    body = (
      <EmptyState
        icon={Building2}
        title={t('lots.empty.title')}
        description={t('lots.empty.body')}
        action={<Button label={t('lots.add')} icon={Plus} onPress={() => router.push('/add-lots')} />}
      />
    );
  } else {
    body = (
      <>
        {/* Un échec d'actualisation garde la liste affichée, avec un message non bloquant. */}
        {lots.error && <Banner message={t('lots.loadError')} />}
        <TextField
          label={t('lots.list.search')}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {FILTERS.map((value) => (
            <Chip key={value} label={filterLabel(value)} selected={filter === value} onPress={() => setFilter(value)} />
          ))}
        </View>
        {visible.length === 0 ? (
          <EmptyState
            title={t('lots.noResults.title')}
            description={t('lots.noResults.body')}
            action={
              <Button
                variant="secondary"
                label={t('lots.noResults.clear')}
                onPress={() => {
                  setSearch('');
                  setFilter('all');
                }}
              />
            }
          />
        ) : (
          <View style={{ gap: spacing.md }}>{visible.map(renderRow)}</View>
        )}
      </>
    );
  }

  return (
    <Screen
      scroll
      footer={
        lots.data !== undefined && lots.data.length > 0 ? (
          <Button variant="secondary" icon={Plus} label={t('lots.add')} onPress={() => router.push('/add-lots')} />
        ) : undefined
      }>
      <AuthHeader onBack={goBack} />
      <View style={{ gap: spacing.xs }}>
        {active !== null && (
          <Text variant="small" tone="muted">
            {t('lots.list.context', { name: active.name, role: roleLabel(active.role, { lower: true }) })}
          </Text>
        )}
        <Text variant="h2">{t('lots.list.title')}</Text>
      </View>
      {body}
    </Screen>
  );
}
