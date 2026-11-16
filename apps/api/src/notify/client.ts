// Client Expo Push (expo-server-sdk) : seul endroit qui le crée. Les tests le remplacent par un faux.
import {
  Expo,
  type ExpoPushMessage,
  type ExpoPushReceipt,
  type ExpoPushReceiptId,
  type ExpoPushTicket,
} from 'expo-server-sdk';

/** Ce dont `notify` a besoin du SDK : un faux client n'a qu'à implémenter ces quatre méthodes. */
export type PushClient = {
  chunkPushNotifications(messages: ExpoPushMessage[]): ExpoPushMessage[][];
  sendPushNotificationsAsync(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]>;
  chunkPushNotificationReceiptIds(ids: ExpoPushReceiptId[]): ExpoPushReceiptId[][];
  getPushNotificationReceiptsAsync(ids: ExpoPushReceiptId[]): Promise<Record<string, ExpoPushReceipt>>;
};

let override: PushClient | undefined;
let real: PushClient | undefined;

export function getPushClient(): PushClient {
  if (override) return override;
  // EXPO_ACCESS_TOKEN est facultatif (jamais journalisé).
  real ??= new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN || undefined });
  return real;
}

/** Réservé aux tests : remplace (ou, sans argument, rétablit) le client Expo. */
export function setPushClientForTests(client?: PushClient): void {
  override = client;
}
