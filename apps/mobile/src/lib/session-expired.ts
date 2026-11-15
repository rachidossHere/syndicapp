// Session expirée ou révoquée (réponse 401 de l'API) : la session locale est vidée, ce qui renvoie
// vers la connexion (Stack.Protected dans app/_layout.tsx), puis tout ce qui appartient à
// l'utilisateur précédent est effacé de la mémoire : cache des requêtes et résidence active.
// Sans dépendance native : testé avec vitest.

export type SessionExpiredDeps = {
  /** Vide la session locale (cookie dans SecureStore) ; peut échouer sans réseau. */
  signOut: () => Promise<unknown>;
  /** Vide le cache des requêtes (résidences, appartements, signalements, comptes…). */
  clearCache: () => void;
  /** Oublie la résidence active mémorisée. */
  clearResidence: () => void;
};

let pending: Promise<void> | undefined;

/**
 * Plusieurs requêtes en cours reçoivent souvent le 401 ensemble : un seul nettoyage est exécuté.
 * La session est vidée en premier (les écrans protégés se ferment), le cache ensuite, pour qu'aucune
 * requête ne soit relancée par un écran encore affiché. Un échec de `signOut` n'empêche pas le nettoyage.
 */
export function expireSession(deps: SessionExpiredDeps): Promise<void> {
  pending ??= (async () => {
    try {
      await deps.signOut().catch(() => undefined);
    } finally {
      deps.clearCache();
      deps.clearResidence();
      pending = undefined;
    }
  })();
  return pending;
}
