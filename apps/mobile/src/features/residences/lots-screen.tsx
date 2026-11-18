// Écran 3 de docs/residences.png, groupé par bâtiment comme docs/batiments.png : liste des
// appartements en sections repliables, avec recherche et filtres.
import { can } from '@syndic/shared';
import {
  AccordionContent,
  AccordionHeader,
  Badge,
  Banner,
  Button,
  Chip,
  EmptyState,
  ListItem,
  Screen,
  Text,
  TextField,
  Toast,
  useTheme,
} from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import Building from 'lucide-react-native/icons/building';
import Plus from 'lucide-react-native/icons/plus';
import { useEffect, useMemo, useReducer, useState } from 'react';
import { SectionList, View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { AuthHeader } from '@/features/auth/auth-header';
import { useLots, type Lot } from '@/hooks/use-lots';
import { usePendingInvitations } from '@/hooks/use-invitations';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { ApiError } from '@/lib/api';
import { apiErrorKey } from '@/lib/api-errors';
import { setFlashMessage, useFlashMessage } from '@/lib/flash-message';
import { daysUntil } from '@/lib/invite-code';
import {
  buildingCount,
  getExpansion,
  groupLots,
  isSectionOpen,
  listSummaryParts,
  sectionSummaryParts,
  sectionViews,
  setExpansion,
  type CountPart,
  type Expansion,
  type LotFilter,
  type SectionView,
} from '@/lib/lot-groups';

import { useRoleLabel } from './use-role-label';

const FILTERS: readonly LotFilter[] = ['all', 'member', 'pending', 'free'];
/** Durée d'affichage du toast, en millisecondes. */
const TOAST_MS = 3000;
/** Séparateur des parties d'un résumé (« 15 appartements · 1 membre »). */
const SUMMARY_SEPARATOR = ' · ';

/** Une section de la liste : l'appartement n'est dans `data` que si la section est ouverte. */
type ListSection = { view: SectionView<Lot>; open: boolean; data: Lot[] };

export function LotsScreen() {
  const { colors, radius, spacing, sizes } = useTheme();
  const t = useT();
  const roleLabel = useRoleLabel();
  const router = useRouter();
  const { active, query: residencesQuery } = useActiveResidence();
  const allowed = active !== null && can(active.role, 'lots.write');
  const residenceId = allowed ? active.id : undefined;
  const lots = useLots(residenceId);
  const invitations = usePendingInvitations(active?.id, allowed);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LotFilter>('all');
  // Confirmation déposée par l'écran de génération ou par la fiche (« Appartement supprimé »…).
  const flash = useFlashMessage();
  const toastKey = flash?.startsWith('lots.toast.') ? flash : undefined;
  useEffect(() => {
    if (toastKey === undefined) return;
    const timer = setTimeout(() => setFlashMessage(undefined), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toastKey]);

  // Ouvertures choisies : gardées en mémoire par résidence (retour depuis la fiche d'un appartement).
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const stored: Expansion = residenceId === undefined ? {} : getExpansion(residenceId);
  // Ouvertures choisies pendant la recherche en cours : oubliées dès que la recherche change,
  // pour que l'état d'avant revienne quand elle est effacée.
  const needle = search.trim().toUpperCase();
  const searching = needle !== '';
  const [searchToggles, setSearchToggles] = useState<{ needle: string; value: Expansion }>({ needle: '', value: {} });
  const activeToggles: Expansion = searchToggles.needle === needle ? searchToggles.value : {};

  const counts = useMemo(() => {
    const result: Record<LotFilter, number> = { all: 0, member: 0, pending: 0, free: 0 };
    for (const lot of lots.data ?? []) {
      result.all += 1;
      result[lot.status] += 1;
    }
    return result;
  }, [lots.data]);

  const sections = useMemo(() => groupLots(lots.data ?? []), [lots.data]);
  const views = useMemo(() => sectionViews(sections, filter, search), [sections, filter, search]);
  const listSections: ListSection[] = views.map((view) => {
    const open = isSectionOpen({
      key: view.key,
      sectionCount: views.length,
      visible: view.visible.length,
      searching,
      stored,
      searchToggles: activeToggles,
    });
    return { view, open, data: open ? view.visible : [] };
  });
  const visibleTotal = views.reduce((sum, view) => sum + view.visible.length, 0);

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
  const filterLabel = (value: LotFilter) => t(`lots.filter.${value}`, { count: counts[value] });
  const openLot = (lot: Lot) => router.push({ pathname: '/lot/[id]', params: { id: lot.id } });
  const inviteLot = (lot: Lot) => router.push({ pathname: '/invite-neighbor', params: { lotId: lot.id } });
  const joinParts = (parts: readonly CountPart[]) => parts.map((part) => t(part.key, part.params)).join(SUMMARY_SEPARATOR);

  const toggleSection = (section: ListSection) => {
    const key = section.view.key;
    if (searching) {
      setSearchToggles({ needle, value: { ...activeToggles, [key]: !section.open } });
    } else if (residenceId !== undefined) {
      setExpansion(residenceId, { ...stored, [key]: !section.open });
      refresh();
    }
  };

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
          leading={leading}
          title={t('lots.row.memberTitle')}
          subtitle={t('lots.row.memberSubtitle')}
          trailing={<Badge tone="success" label={t('lots.status.member')} />}
          accessibilityLabel={t('lots.row.open', { reference: lot.reference })}
          onPress={() => openLot(lot)}
        />
      );
    }

    if (lot.status === 'pending') {
      const invitation = invitationByLot.get(lot.id);
      const days = invitation ? daysUntil(invitation.expiresAt) : undefined;
      return (
        <ListItem
          leading={leading}
          title={t('lots.row.pendingTitle')}
          subtitle={
            days === undefined ? undefined : days === 1 ? t('lots.row.expiresInOne') : t('lots.row.expiresIn', { days })
          }
          trailing={<Badge tone="warning" label={t('lots.status.pending')} />}
          // L'invitation en attente s'ouvre depuis la fiche de l'appartement.
          accessibilityLabel={t('lots.row.open', { reference: lot.reference })}
          onPress={() => openLot(lot)}
        />
      );
    }

    return (
      <ListItem
        leading={leading}
        title={t('lots.row.freeTitle')}
        subtitle={t('lots.row.freeSubtitle')}
        accessibilityLabel={t('lots.row.open', { reference: lot.reference })}
        onPress={() => openLot(lot)}
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

  const header = (
    <>
      <AuthHeader onBack={goBack} />
      <View style={{ gap: spacing.xs }}>
        {active !== null && (
          <Text variant="small" tone="muted">
            {t('lots.list.context', { name: active.name, role: roleLabel(active.role, { lower: true }) })}
          </Text>
        )}
        <Text variant="h2">{t('lots.list.title')}</Text>
        {lots.data !== undefined && lots.data.length > 0 && (
          <Text variant="small" tone="muted">
            {joinParts(listSummaryParts(buildingCount(sections), lots.data.length))}
          </Text>
        )}
      </View>
      {toastKey !== undefined && <Toast message={t(toastKey)} />}
    </>
  );

  // Chargement, erreur ou aucun appartement : écran simple, sans liste.
  let message;
  if (residencesQuery.error && residencesQuery.data === undefined) {
    message = (
      <ErrorNotice
        errorKey={apiErrorKey(residencesQuery.error)}
        onRetry={() => void residencesQuery.refetch()}
        retrying={residencesQuery.isFetching}
      />
    );
  } else if (lots.data === undefined) {
    message =
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
    message = (
      <EmptyState
        domain="apartments"
        title={t('lots.empty.title')}
        description={t('lots.empty.body')}
        action={<Button label={t('lots.add')} icon={Plus} onPress={() => router.push('/add-lots')} />}
      />
    );
  }

  if (message !== undefined) {
    return (
      <Screen scroll>
        {header}
        {message}
      </Screen>
    );
  }

  const listHeader = (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
      {header}
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
      {/* Les compteurs des puces sont ceux de toute la résidence, pas de la recherche. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {FILTERS.map((value) => (
          <Chip key={value} label={filterLabel(value)} selected={filter === value} onPress={() => setFilter(value)} />
        ))}
      </View>
    </View>
  );

  const listFooter =
    visibleTotal === 0 && (searching || filter !== 'all') ? (
      <View style={{ gap: spacing.md, paddingTop: spacing.md }}>
        <Text tone="muted">{t('lots.noResults.body')}</Text>
        <Button
          variant="secondary"
          label={t('lots.noResults.clear')}
          onPress={() => {
            setSearch('');
            setFilter('all');
          }}
        />
      </View>
    ) : undefined;

  return (
    <Screen footer={<Button variant="secondary" icon={Plus} label={t('lots.add')} onPress={() => router.push('/add-lots')} />}>
      <SectionList<Lot, ListSection>
        style={{ flex: 1 }}
        sections={listSections}
        keyExtractor={(lot) => lot.id}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({ section }) => {
          const { view } = section;
          return (
            <AccordionHeader
              icon={Building}
              title={view.building === null ? t('lots.building.none') : t('lots.building.title', { name: view.building })}
              subtitle={joinParts(sectionSummaryParts(view.stats, filter, searching, view.visible.length))}
              expanded={section.open}
              disabled={view.visible.length === 0}
              onToggle={() => toggleSection(section)}
            />
          );
        }}
        // Section fermée : un espace sépare son en-tête du suivant (ouverte, les lignes s'en chargent).
        renderSectionFooter={({ section }) => (section.open ? null : <View style={{ height: spacing.md }} />)}
        renderItem={({ item, index }) => (
          // Chaque ligne porte le filet de la section : il reste continu dans une liste virtualisée.
          <AccordionContent gap continued={index > 0}>
            {renderRow(item)}
          </AccordionContent>
        )}
      />
    </Screen>
  );
}
