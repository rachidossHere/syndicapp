import { describe, expect, it, vi } from 'vitest';

import { expireSession } from './session-expired';

const deps = (signOut: () => Promise<unknown> = async () => undefined) => {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      signOut: vi.fn(async () => {
        calls.push('signOut');
        await signOut();
      }),
      clearCache: vi.fn(() => void calls.push('clearCache')),
      clearResidence: vi.fn(() => void calls.push('clearResidence')),
    },
  };
};

describe('expireSession (401 : session expirée)', () => {
  it('vide la session d’abord (retour à la connexion), puis le cache et la résidence active', async () => {
    const { calls, deps: d } = deps();
    await expireSession(d);
    expect(calls).toEqual(['signOut', 'clearCache', 'clearResidence']);
  });

  it('nettoie quand même le cache si la déconnexion échoue (pas de réseau)', async () => {
    const { calls, deps: d } = deps(async () => {
      throw new Error('réseau');
    });
    await expect(expireSession(d)).resolves.toBeUndefined();
    expect(calls).toEqual(['signOut', 'clearCache', 'clearResidence']);
  });

  it('plusieurs 401 simultanés ne déclenchent qu’un seul nettoyage, un nouveau 401 ensuite en déclenche un autre', async () => {
    const { deps: d } = deps();
    await Promise.all([expireSession(d), expireSession(d), expireSession(d)]);
    expect(d.signOut).toHaveBeenCalledTimes(1);
    expect(d.clearCache).toHaveBeenCalledTimes(1);
    await expireSession(d);
    expect(d.signOut).toHaveBeenCalledTimes(2);
  });
});
