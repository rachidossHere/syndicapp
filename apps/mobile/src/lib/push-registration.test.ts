// Tests de la logique des notifications push (plan 08, étape 1). Aucun module natif : expo-notifications,
// l'API et le stockage sont simulés. `getToken` simule `getExpoPushTokenAsync`.
import { describe, expect, it, vi } from 'vitest';

import {
  UNREGISTER_TIMEOUT_MS,
  enablePush,
  notificationRows,
  permissionNotice,
  pushTokenBody,
  registerPushToken,
  resetPushStateForTests,
  runPushStartup,
  shouldShowPushIntro,
  signOutWithPushCleanup,
  unregisterPushToken,
  type IntroStore,
  type PermissionState,
  type PushDeps,
} from './push-registration';

const TOKEN = 'ExponentPushToken[abc123_secret]';

type Overrides = Partial<PushDeps> & { permission?: PermissionState; afterRequest?: PermissionState };

/** Dépendances simulées : jeton obtenu, envois et suppressions enregistrés dans `calls`. */
function makeDeps(overrides: Overrides = {}) {
  const calls: string[] = [];
  const logs: string[] = [];
  let permission: PermissionState = overrides.permission ?? 'undetermined';
  const deps: PushDeps = {
    getPermission: async () => permission,
    requestPermission: async () => {
      calls.push('request');
      permission = overrides.afterRequest ?? 'granted';
      return permission;
    },
    getToken: async () => {
      calls.push('getToken');
      return TOKEN;
    },
    sendToken: async (token) => void calls.push(`send:${token}`),
    deleteToken: async (token) => void calls.push(`delete:${token}`),
    logCode: (code) => void logs.push(code),
    ...overrides,
  };
  return { deps, calls, logs };
}

const makeStore = (seen = false): IntroStore & { value: boolean } => {
  const store = {
    value: seen,
    isSeen: () => store.value,
    markSeen: () => {
      store.value = true;
    },
  };
  return store;
};

describe('« Activer » : demande système puis envoi du jeton', () => {
  it('demande l’autorisation, puis envoie le jeton obtenu (simulé) à POST /api/push-tokens', async () => {
    resetPushStateForTests();
    const { deps, calls } = makeDeps({ permission: 'undetermined' });
    expect(await enablePush(deps)).toBe('enabled');
    expect(calls).toEqual(['request', 'getToken', `send:${TOKEN}`]);
  });

  it('autorisation déjà accordée : pas de nouvelle demande, jeton envoyé', async () => {
    resetPushStateForTests();
    const { deps, calls } = makeDeps({ permission: 'granted' });
    expect(await enablePush(deps)).toBe('enabled');
    expect(calls).toEqual(['getToken', `send:${TOKEN}`]);
  });

  it('autorisation refusée : aucun jeton demandé ni envoyé', async () => {
    const { deps, calls } = makeDeps({ permission: 'undetermined', afterRequest: 'denied' });
    expect(await enablePush(deps)).toBe('denied');
    expect(calls).toEqual(['request']);
  });

  it('autorisation déjà refusée dans les réglages : pas de demande (impossible), résultat « denied »', async () => {
    const { deps, calls } = makeDeps({ permission: 'denied' });
    expect(await enablePush(deps)).toBe('denied');
    expect(calls).toEqual([]);
  });
});

describe('jeton indisponible (Expo Go, pas de projectId, réseau)', () => {
  it('ne plante pas, n’envoie rien et journalise seulement un code, jamais le jeton', async () => {
    resetPushStateForTests();
    const { deps, calls, logs } = makeDeps({
      permission: 'granted',
      getToken: async () => {
        throw Object.assign(new Error(`message avec ${TOKEN}`), { code: 'no_project_id' });
      },
    });
    expect(await enablePush(deps)).toBe('unavailable');
    expect(await registerPushToken(deps)).toBe('unavailable');
    expect(calls).toEqual([]);
    expect(logs).toEqual(['push.token_unavailable:no_project_id', 'push.token_unavailable:no_project_id']);
    expect(logs.join(' ')).not.toContain('ExponentPushToken');
    expect(logs.join(' ')).not.toContain('secret');
  });

  it('échec d’envoi à l’API : résultat « failed », code journalisé, rien ne remonte à l’écran', async () => {
    resetPushStateForTests();
    const { deps, logs } = makeDeps({
      permission: 'granted',
      sendToken: async () => {
        throw Object.assign(new Error('boom'), { code: 500 });
      },
    });
    await expect(registerPushToken(deps)).resolves.toBe('failed');
    expect(logs).toEqual(['push.register_failed:500']);
  });

  it('un nom d’erreur sans code est journalisé tel quel, jamais son message', async () => {
    const { deps, logs } = makeDeps({
      permission: 'granted',
      getToken: async () => {
        throw new TypeError(`contient ${TOKEN}`);
      },
    });
    await registerPushToken(deps);
    expect(logs).toEqual(['push.token_unavailable:TypeError']);
  });

  it('retente à la prochaine ouverture de l’appli : l’enregistrement manqué est refait', async () => {
    resetPushStateForTests();
    let available = false;
    const { deps, calls } = makeDeps({
      permission: 'granted',
      getToken: async () => {
        if (!available) throw Object.assign(new Error('x'), { code: 'no_project_id' });
        return TOKEN;
      },
    });
    const store = makeStore(true);
    expect(await runPushStartup(deps, store)).toBe('synced');
    expect(calls).toEqual([]); // première ouverture : rien d'envoyé
    available = true;
    expect(await runPushStartup(deps, store)).toBe('synced'); // ouverture suivante
    expect(calls).toEqual([`send:${TOKEN}`]);
  });
});

describe('écran « Restez informé » : une seule fois', () => {
  it('s’affiche la première fois (autorisation jamais demandée), puis plus jamais une fois marqué', async () => {
    const store = makeStore();
    const { deps } = makeDeps({ permission: 'undetermined' });
    expect(await runPushStartup(deps, store)).toBe('show_intro');
    expect(await runPushStartup(deps, store)).toBe('show_intro'); // tant qu'il n'est pas marqué
    store.markSeen(); // « Activer » ou « Plus tard »
    expect(await runPushStartup(deps, store)).toBe('none');
    expect(await runPushStartup(deps, store)).toBe('none');
  });

  it('« Plus tard » : le marquage suffit, aucune demande système n’a été faite', async () => {
    const store = makeStore();
    const { deps, calls } = makeDeps({ permission: 'undetermined' });
    store.markSeen();
    await runPushStartup(deps, store);
    expect(calls).toEqual([]);
  });

  it('n’apparaît pas si l’autorisation est déjà accordée ou refusée', () => {
    expect(shouldShowPushIntro(makeStore(), 'granted')).toBe(false);
    expect(shouldShowPushIntro(makeStore(), 'denied')).toBe(false);
    expect(shouldShowPushIntro(makeStore(), 'undetermined')).toBe(true);
    expect(shouldShowPushIntro(makeStore(true), 'undetermined')).toBe(false);
  });

  it('autorisation déjà accordée : au lieu de l’écran, le jeton est réenregistré (changement de compte)', async () => {
    resetPushStateForTests();
    const { deps, calls } = makeDeps({ permission: 'granted' });
    expect(await runPushStartup(deps, makeStore())).toBe('synced');
    expect(calls).toEqual(['getToken', `send:${TOKEN}`]);
  });
});

describe('déconnexion : le jeton est supprimé côté API avant la fin de la session', () => {
  it('supprime le jeton enregistré (DELETE), puis seulement ensuite termine la session', async () => {
    resetPushStateForTests();
    const { deps, calls } = makeDeps({ permission: 'granted' });
    await registerPushToken(deps);
    calls.length = 0;
    const order: string[] = [];
    const result = await signOutWithPushCleanup({
      unregister: async () => {
        await unregisterPushToken(deps);
        order.push('unregistered');
      },
      signOut: async () => {
        order.push('signedOut');
        return 'ok';
      },
    });
    expect(result).toBe('ok');
    expect(calls).toEqual([`delete:${TOKEN}`]);
    expect(order).toEqual(['unregistered', 'signedOut']);
  });

  it('flux complet : Activer (envoi) puis déconnexion (suppression du même jeton)', async () => {
    resetPushStateForTests();
    const { deps, calls } = makeDeps({ permission: 'undetermined' });
    await enablePush(deps);
    await unregisterPushToken(deps);
    expect(calls).toEqual(['request', 'getToken', `send:${TOKEN}`, `delete:${TOKEN}`]);
  });

  it('appli rouverte (jeton plus en mémoire) : le jeton est redemandé à Expo pour être supprimé', async () => {
    resetPushStateForTests();
    const { deps, calls } = makeDeps({ permission: 'granted' });
    await unregisterPushToken(deps);
    expect(calls).toEqual(['getToken', `delete:${TOKEN}`]);
  });

  it('autorisation non accordée : il n’y a rien à supprimer, aucun appel', async () => {
    resetPushStateForTests();
    const { deps, calls } = makeDeps({ permission: 'undetermined' });
    await unregisterPushToken(deps);
    expect(calls).toEqual([]);
  });

  it('si l’appel échoue, la déconnexion se fait quand même (code journalisé, jamais le jeton)', async () => {
    resetPushStateForTests();
    const { deps, logs } = makeDeps({
      permission: 'granted',
      deleteToken: async () => {
        throw Object.assign(new Error(`échec ${TOKEN}`), { code: 'network_error' });
      },
    });
    await registerPushToken(deps);
    const signOut = vi.fn(async () => 'signed-out');
    await expect(signOutWithPushCleanup({ unregister: () => unregisterPushToken(deps), signOut })).resolves.toBe('signed-out');
    expect(signOut).toHaveBeenCalledOnce();
    expect(logs).toEqual(['push.unregister_failed:network_error']);
    expect(logs.join(' ')).not.toContain('ExponentPushToken');
  });

  it('si l’API ne répond pas, la déconnexion n’attend pas plus que le délai prévu', async () => {
    vi.useFakeTimers();
    try {
      resetPushStateForTests();
      const { deps, logs } = makeDeps({ permission: 'granted', deleteToken: () => new Promise<void>(() => undefined) });
      await registerPushToken(deps);
      const done = unregisterPushToken(deps);
      await vi.advanceTimersByTimeAsync(UNREGISTER_TIMEOUT_MS);
      await done;
      expect(logs).toEqual(['push.unregister_failed:timeout']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('le jeton n’est plus gardé après la déconnexion (jamais stocké)', async () => {
    resetPushStateForTests();
    const { deps, calls } = makeDeps({ permission: 'granted' });
    await registerPushToken(deps);
    await unregisterPushToken(deps);
    calls.length = 0;
    await unregisterPushToken(deps); // 2e déconnexion : il faut le redemander, rien n'est resté en mémoire
    expect(calls[0]).toBe('getToken');
  });
});

describe('écran « Notifications » : lignes selon le rôle', () => {
  it('« Annonces urgentes » est présente et verrouillée ; les autres types ne le sont pas', () => {
    for (const role of [null, 'owner', 'tenant', 'manager'] as const) {
      const { general } = notificationRows(role);
      expect(general.find((row) => row.type === 'announcement_urgent')).toEqual({ type: 'announcement_urgent', locked: true });
      expect(general.filter((row) => row.locked).map((row) => row.type)).toEqual(['announcement_urgent']);
      expect(general.map((row) => row.type)).toEqual([
        'announcement_urgent',
        'announcement',
        'issue_status',
        'charge_reminder',
        'payment_received',
      ]);
    }
  });

  it('« Signalements urgents » apparaît pour syndic, adjoint et gardien (issues.manage) seulement', () => {
    const visible = (role: Parameters<typeof notificationRows>[0]) =>
      notificationRows(role).office.map((row) => row.type);
    for (const role of ['manager', 'deputy', 'caretaker'] as const) expect(visible(role)).toEqual(['issue_urgent']);
    for (const role of ['treasurer', 'owner', 'tenant'] as const) expect(visible(role)).toEqual([]);
    expect(visible(null)).toEqual([]); // sans résidence active
    expect(notificationRows('manager').general.some((row) => row.type === 'issue_urgent')).toBe(false);
  });

  it('bandeau selon l’autorisation : réglages si refusée, bouton si jamais demandée, rien sinon', () => {
    expect(permissionNotice('denied')).toBe('open_settings');
    expect(permissionNotice('undetermined')).toBe('enable');
    expect(permissionNotice('granted')).toBe('none');
  });
});

describe('langue envoyée avec le jeton', () => {
  it('le corps de POST /api/push-tokens porte la langue de l’appli (fr ou ar)', () => {
    expect(pushTokenBody('ExponentPushToken[abc]', 'ar', 'iPhone')).toEqual({
      token: 'ExponentPushToken[abc]',
      locale: 'ar',
      device: 'iPhone',
    });
    expect(pushTokenBody('ExponentPushToken[abc]', 'fr', null)).toEqual({
      token: 'ExponentPushToken[abc]',
      locale: 'fr',
      device: undefined,
    });
  });
});
