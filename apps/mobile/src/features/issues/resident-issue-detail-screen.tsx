// Écran 3 de docs/signalements.png : détail d'un signalement (habitant). Statut, badge « Urgent »,
// titre, emplacement et date, photo (URL signée demandée à l'ouverture, jamais gardée plus de
// 4 minutes), « Suivi » (historique du plus récent au plus ancien : « par vous », « le syndic »,
// « le gardien », jamais le nom d'un autre habitant), champ de commentaire et bouton « Rouvrir »
// réservés à l'auteur (le second seulement si le signalement est résolu depuis moins de 7 jours).
import { Badge, Banner, Button, IconButton, Screen, StatusBadge, Text, useTheme } from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import Send from 'lucide-react-native/icons/send';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { AuthHeader } from '@/features/auth/auth-header';
import { QueryFallback } from '@/features/charges/query-fallback';
import { useCommentIssue, useIssue, useReopenIssue } from '@/hooks/use-issues';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { issueErrorKey } from '@/lib/issue-api';
import {
  MAX_ISSUE_MESSAGE_LENGTH,
  canCommentOn,
  canShowReopen,
  canUseIssues,
  eventActorKey,
} from '@/lib/issues';

import { IssuePhoto } from './issue-photo';
import { Timeline } from './issue-timeline';
import { useIssueFormat } from './use-issue-format';

function CommentBar({ residenceId, issueId }: { residenceId: string; issueId: string }) {
  const { colors, radius, spacing, sizes, typography, borderWidth, fontFamily } = useTheme();
  const t = useT();
  const comment = useCommentIssue(residenceId, issueId);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState<string | undefined>();
  const trimmed = message.trim();

  const send = async () => {
    if (trimmed === '' || comment.isPending) return;
    setFailure(undefined);
    try {
      await comment.mutateAsync(trimmed);
      setMessage('');
    } catch (caught) {
      // Le texte saisi reste : un nouvel appui sur « Envoyer » réessaie.
      setFailure(issueErrorKey(caught));
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {failure !== undefined && <ErrorNotice errorKey={failure} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TextInput
          accessibilityLabel={t('issues.comment.placeholder')}
          placeholder={t('issues.comment.placeholder')}
          placeholderTextColor={colors.textMuted}
          value={message}
          onChangeText={setMessage}
          editable={!comment.isPending}
          maxLength={MAX_ISSUE_MESSAGE_LENGTH}
          returnKeyType="send"
          onSubmitEditing={() => void send()}
          style={{
            flex: 1,
            minHeight: sizes.input,
            paddingHorizontal: spacing.md,
            borderWidth: borderWidth.thin,
            borderColor: colors.borderStrong,
            borderRadius: radius.md,
            borderCurve: 'continuous',
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: typography.body.fontSize,
            fontFamily: fontFamily(typography.body.fontWeight),
          }}
        />
        <IconButton
          icon={Send}
          flipInRtl
          accessibilityLabel={t('issues.comment.send')}
          disabled={trimmed === '' || comment.isPending}
          onPress={() => void send()}
        />
      </View>
    </View>
  );
}

export function ResidentIssueDetailScreen({ issueId }: { issueId: string | undefined }) {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const format = useIssueFormat();
  const { active, query: residencesQuery } = useActiveResidence();
  const residenceId = active !== null && canUseIssues(active.role) ? active.id : undefined;
  const detail = useIssue(residenceId, issueId);
  const reopen = useReopenIssue(residenceId, issueId ?? '');
  const [reopenFailure, setReopenFailure] = useState<string | undefined>();

  // Rafraîchissement au retour sur l'écran.
  useRefreshOnFocus(detail.refetch);

  if (residencesQuery.data !== undefined && residenceId === undefined) return <Redirect href="/home" />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/issues'));
  const issue = detail.data;

  const onReopen = async () => {
    if (reopen.isPending) return;
    setReopenFailure(undefined);
    try {
      await reopen.mutateAsync();
    } catch (caught) {
      setReopenFailure(issueErrorKey(caught));
    }
  };

  return (
    <Screen
      scroll
      onRefresh={() => void detail.refetch()}
      refreshing={detail.isRefetching}
      footer={
        issue !== undefined && residenceId !== undefined && canCommentOn(issue) ? (
          <CommentBar residenceId={residenceId} issueId={issue.id} />
        ) : undefined
      }>
      <AuthHeader onBack={goBack} />
      {issue === undefined ? (
        <QueryFallback query={detail} message={t('issues.detail.loadError')} />
      ) : (
        <>
          {detail.isRefetchError && <Banner message={t('issues.detail.refreshError')} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <StatusBadge status={issue.status} />
            {issue.urgent && issue.status !== 'resolved' && <Badge tone="danger" label={t('issues.urgent')} />}
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text variant="h2">{issue.title}</Text>
            <Text tone="muted">{format.reportedLine(issue)}</Text>
          </View>

          {issue.description !== null && <Text selectable>{issue.description}</Text>}

          {residenceId !== undefined && <IssuePhoto residenceId={residenceId} issue={issue} />}

          {canShowReopen(issue) && (
            <View style={{ gap: spacing.sm }}>
              <Text variant="small" tone="muted">
                {t('issues.reopen.note')}
              </Text>
              <Button variant="secondary" label={t('issues.reopen.button')} loading={reopen.isPending} onPress={() => void onReopen()} />
              {reopenFailure !== undefined && <ErrorNotice errorKey={reopenFailure} />}
            </View>
          )}

          <View style={{ gap: spacing.md }}>
            <Text variant="h3">{t('issues.detail.follow')}</Text>
            <Timeline events={issue.events} actorOf={(event) => t(eventActorKey(event))} actorOnCreated={false} />
          </View>
        </>
      )}
    </Screen>
  );
}
