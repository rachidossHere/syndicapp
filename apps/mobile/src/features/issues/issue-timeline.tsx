// Historique d'un signalement (« Suivi » de l'habitant, « Historique » du personnel) : une pastille
// de couleur par événement, reliée à la suivante, puis l'intitulé, le message et l'heure.
import { Text, useTheme } from '@syndic/ui';
import { View } from 'react-native';

import { useT } from '@/i18n/use-t';
import { eventTitleKey, eventTone, newestFirst, type IssueEvent } from '@/lib/issues';

import { useIssueFormat } from './use-issue-format';

/** Intitulé et détail d'un événement ; `actor` est déjà traduit (« vous », « le syndic », « A12 »…). */
export function useEventTexts() {
  const t = useT();
  const format = useIssueFormat();
  return (event: IssueEvent, actor: string, actorOnCreated: boolean) => {
    const title = t(eventTitleKey(event));
    const time = format.time(event.createdAt);
    // « Signalé » puis « Par vous · 9 h 10 » (habitant) ou « Signalé · A12 » (personnel) ; les autres :
    // « En cours · le syndic », puis le message et l'heure.
    const heading = event.type === 'created' && !actorOnCreated ? title : t('issues.event.titleBy', { title, actor });
    const detail =
      event.type === 'created'
        ? actorOnCreated
          ? time
          : t('issues.event.detail', { message: t('issues.event.by', { actor }), time })
        : event.message !== null
          ? t('issues.event.detail', { message: t('issues.event.quote', { message: event.message }), time })
          : time;
    return { heading, detail };
  };
}

export function TimelineEvent({
  event,
  heading,
  detail,
  last,
}: {
  event: Pick<IssueEvent, 'type' | 'toStatus'>;
  heading: string;
  detail: string;
  last: boolean;
}) {
  const { colors, spacing, borderWidth } = useTheme();
  const tone = eventTone(event);
  const dot =
    tone === 'comment' ? colors.infoFg : tone === 'resolved' ? colors.successFg : tone === 'in_progress' ? colors.warningFg : colors.dangerFg;

  return (
    <View accessible accessibilityLabel={`${heading}, ${detail}`} style={{ flexDirection: 'row', gap: spacing.md }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: spacing.md, height: spacing.md, borderRadius: spacing.md, backgroundColor: dot, marginTop: spacing.xs }} />
        {!last && <View style={{ flex: 1, borderStartWidth: borderWidth.thin, borderColor: colors.border }} />}
      </View>
      <View style={{ flex: 1, gap: spacing.xs, paddingBottom: spacing.md }}>
        <Text variant="bodyStrong">{heading}</Text>
        <Text variant="small" tone="muted">
          {detail}
        </Text>
      </View>
    </View>
  );
}

/** Historique du plus récent au plus ancien ; `actorOf` donne l'acteur déjà traduit de chaque événement. */
export function Timeline({
  events,
  actorOf,
  actorOnCreated,
}: {
  events: readonly IssueEvent[];
  actorOf: (event: IssueEvent) => string;
  actorOnCreated: boolean;
}) {
  const texts = useEventTexts();
  const ordered = newestFirst(events);
  return (
    <View>
      {ordered.map((event, index) => {
        const { heading, detail } = texts(event, actorOf(event), actorOnCreated);
        return <TimelineEvent key={event.id} event={event} heading={heading} detail={detail} last={index === ordered.length - 1} />;
      })}
    </View>
  );
}
