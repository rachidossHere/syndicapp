// Écran 5 de docs/signalements.png : traiter un signalement (issues.manage : syndic, adjoint, gardien).
// Statut, titre, appartement et auteur, date, photo ; choix du statut (Ouvert / En cours / Résolu),
// message facultatif aux habitants, « Mettre à jour » (actif seulement si le statut change ou qu'un
// message est saisi) ; historique du plus récent au plus ancien. Un message sans changement de statut
// est envoyé comme commentaire. Après la mise à jour : toast « Signalement mis à jour », données
// rafraîchies (liste, compteurs, détail), l'écran reste ouvert et « Retour » fonctionne. En cas
// d'échec, le brouillon est conservé.
import { Badge, Banner, Button, Screen, SegmentedControl, StatusBadge, Text, TextField, Toast, useTheme } from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import { ISSUE_STATUSES, type IssueStatus } from '@syndic/shared';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { AuthHeader } from '@/features/auth/auth-header';
import { QueryFallback } from '@/features/charges/query-fallback';
import { useIssue, useUpdateIssue } from '@/hooks/use-issues';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { issueErrorKey } from '@/lib/issue-api';
import {
  MAX_ISSUE_MESSAGE_LENGTH,
  issuesViewFor,
  manageEventActor,
  planIssueUpdate,
  staffLineParts,
} from '@/lib/issues';

import { IssuePhoto } from './issue-photo';
import { Timeline } from './issue-timeline';
import { useIssueFormat } from './use-issue-format';

/** Durée d'affichage du toast « Signalement mis à jour ». */
const TOAST_MS = 4000;

export function ManageIssueScreen({ issueId }: { issueId: string | undefined }) {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const format = useIssueFormat();
  const { active, query: residencesQuery } = useActiveResidence();
  const residenceId = active !== null && issuesViewFor(active.role) === 'manage' ? active.id : undefined;
  const detail = useIssue(residenceId, issueId);
  const update = useUpdateIssue(residenceId, issueId ?? '');
  // Statut choisi (absent tant que l'on n'a pas touché au choix : on suit alors le statut du serveur).
  const [chosen, setChosen] = useState<IssueStatus | undefined>();
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  useRefreshOnFocus(detail.refetch);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), TOAST_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  if (residencesQuery.data !== undefined && residenceId === undefined) return <Redirect href="/home" />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/issues'));
  const issue = detail.data;
  const selected = chosen ?? issue?.status ?? 'open';
  const plan = issue === undefined ? { kind: 'none' as const } : planIssueUpdate(issue.status, selected, message);

  const submit = async () => {
    if (plan.kind === 'none' || update.isPending) return;
    setFailure(undefined);
    setSaved(false);
    try {
      // Résolu après le rafraîchissement des listes, compteurs et détail (invalidation de la mutation).
      await update.mutateAsync(plan);
      setChosen(undefined);
      setMessage('');
      setSaved(true);
    } catch (caught) {
      // Le statut choisi et le message restent : un nouvel appui sur « Mettre à jour » réessaie.
      setFailure(issueErrorKey(caught));
    }
  };

  return (
    <Screen
      scroll
      onRefresh={() => void detail.refetch()}
      refreshing={detail.isRefetching}
      footer={
        issue !== undefined ? (
          <Button
            label={t('issues.manage.update')}
            disabled={plan.kind === 'none'}
            loading={update.isPending}
            onPress={() => void submit()}
          />
        ) : undefined
      }>
      <AuthHeader onBack={goBack} />
      {issue === undefined ? (
        <QueryFallback query={detail} message={t('issues.detail.loadError')} />
      ) : (
        <>
          {saved && <Toast message={t('issues.manage.updated')} />}
          {detail.isRefetchError && <Banner message={t('issues.detail.refreshError')} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <StatusBadge status={issue.status} />
            {issue.urgent && issue.status !== 'resolved' && <Badge tone="danger" label={t('issues.urgent')} />}
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text variant="h2">{issue.title}</Text>
            <Text tone="muted">{staffLineParts(issue, format.reportedLine(issue)).join(' · ')}</Text>
          </View>

          {issue.description !== null && <Text selectable>{issue.description}</Text>}

          {residenceId !== undefined && <IssuePhoto residenceId={residenceId} issue={issue} />}

          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong">{t('issues.manage.status')}</Text>
            <SegmentedControl
              options={ISSUE_STATUSES.map((value) => ({ value, label: t(`issues.status.${value}`) }))}
              value={selected}
              onChange={setChosen}
            />
          </View>

          <TextField
            label={t('issues.manage.message')}
            placeholder={t('issues.manage.messagePlaceholder')}
            value={message}
            onChangeText={setMessage}
            editable={!update.isPending}
            maxLength={MAX_ISSUE_MESSAGE_LENGTH}
            lines={3}
            multiline
          />
          {failure !== undefined && <ErrorNotice errorKey={failure} />}

          <View style={{ gap: spacing.md }}>
            <Text variant="h3">{t('issues.manage.history')}</Text>
            <Timeline
              events={issue.events}
              actorOnCreated
              actorOf={(event) => {
                const actor = manageEventActor(event, issue.author);
                return actor.kind === 'text' ? actor.text : t(actor.key);
              }}
            />
          </View>
        </>
      )}
    </Screen>
  );
}
