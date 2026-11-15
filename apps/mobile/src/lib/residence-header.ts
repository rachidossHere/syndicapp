// En-tête de résidence explicite (sans dépendance native : testé avec vitest).

/**
 * Options d'appel qui fixent la résidence visée (`X-Residence-Id`) à celle de la clé de cache de la
 * requête. Sans cela, `apiFetch` lit la résidence active au moment de l'envoi, après un `await` :
 * un changement de résidence entre-temps rangerait la réponse d'une résidence sous la clé de l'autre.
 * Les autres options (méthode, corps, en-têtes) sont conservées.
 */
export function inResidence(residenceId: string | undefined, init: RequestInit = {}): RequestInit {
  if (residenceId === undefined) return init;
  const headers = new Headers(init.headers);
  headers.set('X-Residence-Id', residenceId);
  return { ...init, headers };
}
