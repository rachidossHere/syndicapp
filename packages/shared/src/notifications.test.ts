import { describe, expect, it } from 'vitest';

import { notificationAudienceSchema, notificationDataSchema, registerPushTokenSchema } from './notifications';

describe('jeton push : langue', () => {
  const token = 'ExponentPushToken[abc]';
  it('fr par défaut, fr et ar acceptées, autre refusée', () => {
    expect(registerPushTokenSchema.parse({ token }).locale).toBe('fr');
    expect(registerPushTokenSchema.parse({ token, locale: 'ar' }).locale).toBe('ar');
    expect(registerPushTokenSchema.safeParse({ token, locale: 'en' }).success).toBe(false);
  });
});

describe('audiences et données de notification', () => {
  it('valide les quatre audiences et refuse le reste', () => {
    expect(notificationAudienceSchema.safeParse({ kind: 'all' }).success).toBe(true);
    expect(notificationAudienceSchema.safeParse({ kind: 'roles', roles: ['owner'] }).success).toBe(true);
    expect(notificationAudienceSchema.safeParse({ kind: 'roles', roles: [] }).success).toBe(false);
    expect(notificationAudienceSchema.safeParse({ kind: 'users', userIds: ['u1'] }).success).toBe(true);
    expect(notificationAudienceSchema.safeParse({ kind: 'lot_owners', lotId: 'pas-un-uuid' }).success).toBe(false);
    expect(notificationAudienceSchema.safeParse({ kind: 'everyone' }).success).toBe(false);
  });
  it('les données ne portent qu’un identifiant d’élément', () => {
    expect(notificationDataSchema.parse({ itemId: '0b5f0c8e-1c1e-4c8e-9a53-6f1d2a7b9c10', title: 'Coupure d’eau' })).not.toHaveProperty('title');
  });
});
