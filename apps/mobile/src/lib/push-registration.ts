// Jeton push du téléphone (plan 08, étape 1) : autorisation, enregistrement, suppression.
// Sans dépendance native : les appels à expo-notifications, à l'API et au stockage sont injectés
// (voir push-device.ts pour les vrais), ce qui permet de tout tester avec vitest.
//
// Règles :
// - le jeton n'est jamais stocké (ni cache persisté, ni SecureStore) : il vit en mémoire le temps
//   de la session de l'appli, et se redemande à Expo quand il faut le supprimer ;
// - si le jeton est indisponible (Expo Go, pas de projectId, réseau…), seul un CODE d'erreur est
//   journalisé, jamais le jeton, et l'enregistrement est retenté à la prochaine ouverture de l'appli ;
// - aucune de ces fonctions ne lève d'erreur vers l'écran : un échec ne se voit pas et ne plante pas.
import { can, type NotificationType, type Role } from '@syndic/shared';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export type PushDeps = {
  /** État actuel de l'autorisation système, sans rien demander. */
  getPermission: () => Promise<PermissionState>;
  /** Affiche la demande système et renvoie la réponse. */
  requestPermission: () => Promise<PermissionState>;
  /** Jeton Expo du téléphone (lève une erreur si indisponible). */
  getToken: () => Promise<string>;
  /** POST /api/push-tokens. */
  sendToken: (token: string) => Promise<void>;
  /** DELETE /api/push-tokens. */
  deleteToken: (token: string) => Promise<void>;
  /** Journal : un code d'erreur seulement. */
  logCode: (code: string) => void;
};

/** Jeton de la session de l'appli, en mémoire seulement. */
let currentToken: string | null = null;

/** Réservé aux tests. */
export function resetPushStateForTests(): void {
  currentToken = null;
}

/** Code d'une erreur (`error.code` s'il existe), jamais son message ni sa pile. */
export function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  if (typeof code === 'string' || typeof code === 'number') return String(code).slice(0, 60);
  return error instanceof Error ? error.name.slice(0, 60) : 'unknown';
}

export type RegisterResult = 'registered' | 'not_granted' | 'unavailable' | 'failed';

/**
 * Enregistre le jeton du téléphone auprès de l'API, si l'autorisation est accordée.
 * Idempotent : l'appeler à chaque ouverture de l'appli met à jour la dernière utilisation.
 */
export async function registerPushToken(deps: PushDeps): Promise<RegisterResult> {
  let permission: PermissionState;
  try {
    permission = await deps.getPermission();
  } catch (error) {
    deps.logCode(`push.permission:${errorCode(error)}`);
    return 'unavailable';
  }
  if (permission !== 'granted') return 'not_granted';

  let token: string;
  try {
    token = await deps.getToken();
  } catch (error) {
    deps.logCode(`push.token_unavailable:${errorCode(error)}`);
    return 'unavailable';
  }

  try {
    await deps.sendToken(token);
  } catch (error) {
    deps.logCode(`push.register_failed:${errorCode(error)}`);
    return 'failed';
  }
  currentToken = token;
  return 'registered';
}

export type EnableResult = 'enabled' | 'denied' | 'unavailable';

/**
 * Bouton « Activer » : déclenche la demande système (si elle n'a jamais été faite), puis enregistre
 * le jeton. Un refus système donne `denied` ; un jeton indisponible donne `unavailable` (aucune
 * erreur visible : l'autorisation est accordée, l'enregistrement sera retenté à la prochaine ouverture).
 */
export async function enablePush(deps: PushDeps): Promise<EnableResult> {
  let permission: PermissionState;
  try {
    permission = await deps.getPermission();
    if (permission === 'undetermined') permission = await deps.requestPermission();
  } catch (error) {
    deps.logCode(`push.permission:${errorCode(error)}`);
    return 'unavailable';
  }
  if (permission !== 'granted') return 'denied';
  const result = await registerPushToken(deps);
  return result === 'registered' ? 'enabled' : 'unavailable';
}

/** Durée maximale d'attente de l'API à la déconnexion : au-delà, on se déconnecte quand même. */
export const UNREGISTER_TIMEOUT_MS = 5000;

/**
 * Supprime le jeton côté API (à appeler AVANT la fin de la session : l'API exige la session).
 * Ne lève jamais d'erreur : si l'appel échoue ou tarde, la déconnexion se fait quand même.
 */
export async function unregisterPushToken(deps: PushDeps, timeoutMs = UNREGISTER_TIMEOUT_MS): Promise<void> {
  const work = async () => {
    let token = currentToken;
    if (token === null) {
      // Appli rouverte depuis l'enregistrement : le jeton se redemande à Expo, sans rien demander
      // à l'utilisateur (autorisation déjà accordée) ; sinon, il n'y a rien à supprimer.
      if ((await deps.getPermission()) !== 'granted') return;
      token = await deps.getToken();
    }
    await deps.deleteToken(token);
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'timeout' })), timeoutMs);
      }),
    ]);
  } catch (error) {
    deps.logCode(`push.unregister_failed:${errorCode(error)}`);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    currentToken = null;
  }
}

/** Déconnexion : le jeton est supprimé côté API avant la fin de la session, quoi qu'il arrive. */
export async function signOutWithPushCleanup<T>(deps: {
  unregister: () => Promise<void>;
  signOut: () => Promise<T>;
}): Promise<T> {
  await deps.unregister();
  return deps.signOut();
}

// --- Écran « Restez informé » (écran 1) : affiché une seule fois -------------------------------

export type IntroStore = {
  /** Vrai si l'écran a déjà été montré sur ce téléphone (valeur locale non sensible, pas un jeton). */
  isSeen: () => boolean;
  markSeen: () => void;
};

/** L'écran 1 s'affiche si on ne l'a jamais montré et si la demande système n'a jamais été faite. */
export function shouldShowPushIntro(store: IntroStore, permission: PermissionState): boolean {
  return !store.isSeen() && permission === 'undetermined';
}

export type StartupAction = 'show_intro' | 'synced' | 'none';

/**
 * À l'ouverture de l'appli connectée : montre l'écran 1 la première fois, sinon (autorisation déjà
 * accordée) réenregistre le jeton — c'est ce qui retente un enregistrement qui avait échoué, et
 * réattribue le jeton au compte connecté quand le téléphone change de compte.
 */
export async function runPushStartup(deps: PushDeps, store: IntroStore): Promise<StartupAction> {
  let permission: PermissionState;
  try {
    permission = await deps.getPermission();
  } catch (error) {
    deps.logCode(`push.permission:${errorCode(error)}`);
    return 'none';
  }
  if (shouldShowPushIntro(store, permission)) return 'show_intro';
  if (permission === 'granted') {
    await registerPushToken(deps);
    return 'synced';
  }
  return 'none';
}

// --- Écran « Notifications » (écran 2) ---------------------------------------------------------

export type NotificationRow = { type: NotificationType; locked: boolean };

/**
 * Lignes de l'écran 2. « Annonces urgentes » est toujours présente et verrouillée.
 * `office` (« Pour le bureau ») : « Signalements urgents », seulement pour les rôles avec
 * `issues.manage` dans la résidence active (syndic, adjoint, gardien). Sans résidence : absente.
 */
export function notificationRows(role: Role | null): { general: NotificationRow[]; office: NotificationRow[] } {
  return {
    general: [
      { type: 'announcement_urgent', locked: true },
      { type: 'announcement', locked: false },
      { type: 'issue_status', locked: false },
      { type: 'charge_reminder', locked: false },
      { type: 'payment_received', locked: false },
    ],
    office: role !== null && can(role, 'issues.manage') ? [{ type: 'issue_urgent', locked: false }] : [],
  };
}

/** Bandeau de l'écran 2 selon l'autorisation système. */
export function permissionNotice(permission: PermissionState): 'none' | 'open_settings' | 'enable' {
  if (permission === 'denied') return 'open_settings';
  if (permission === 'undetermined') return 'enable';
  return 'none';
}
