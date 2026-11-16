// Choix des destinataires d'une notification (plan 08).
// Règles : toujours des membres ACTIFS de la résidence concernée (filtre residence_id, aucune
// exception) ; la préférence de l'utilisateur est respectée, sauf pour les types verrouillés
// (annonce urgente) ; un jeton n'apparaît qu'une fois.
import { schema, type Database } from '@syndic/db';
import { isLockedNotificationType, type NotificationAudience, type NotificationType, type PushLocale } from '@syndic/shared';
import { and, eq, inArray, isNull, or, type SQL } from 'drizzle-orm';

export type Recipient = { token: string; locale: PushLocale };

function audienceFilter(audience: NotificationAudience): SQL | undefined {
  const { membership } = schema;
  switch (audience.kind) {
    case 'all':
      return undefined;
    case 'roles':
      return inArray(membership.role, audience.roles);
    case 'users':
      return inArray(membership.userId, audience.userIds);
    case 'lot_owners':
      return and(eq(membership.lotId, audience.lotId), eq(membership.role, 'owner'));
  }
}

/** Jetons (et langue) des destinataires de la notification. */
export async function resolveRecipients(
  db: Pick<Database, 'select'>,
  residenceId: string,
  audience: NotificationAudience,
  type: NotificationType,
): Promise<Recipient[]> {
  const { membership, pushToken, notificationPreference } = schema;
  const conditions: (SQL | undefined)[] = [eq(membership.residenceId, residenceId), eq(membership.active, true), audienceFilter(audience)];
  // Préférence coupée = exclu, sauf type verrouillé. Absence de ligne = activé.
  if (!isLockedNotificationType(type)) {
    conditions.push(or(isNull(notificationPreference.enabled), eq(notificationPreference.enabled, true)));
  }
  const rows = await db
    .select({ token: pushToken.token, locale: pushToken.locale })
    .from(membership)
    .innerJoin(pushToken, eq(pushToken.userId, membership.userId))
    .leftJoin(
      notificationPreference,
      and(eq(notificationPreference.userId, membership.userId), eq(notificationPreference.type, type)),
    )
    .where(and(...conditions));
  const byToken = new Map<string, Recipient>();
  for (const row of rows) byToken.set(row.token, row);
  return [...byToken.values()];
}
