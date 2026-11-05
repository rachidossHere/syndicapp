import { authClient } from './auth-client';
import { API_URL } from './config';

/** Erreur d'un appel à notre API : statut HTTP et code générique, jamais de détail interne. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`Appel à l'API refusé (${status} ${code})`);
    this.name = 'ApiError';
  }
}

/**
 * Appel à notre API Hono avec la session Better Auth.
 * - En-tête `Cookie` obtenu avec `authClient.getCookie()` (session lue dans SecureStore).
 * - `credentials: "omit"` : le cookie est ajouté à la main, la pile réseau ne doit pas en ajouter.
 * - 401 : la session a expiré ou a été révoquée → la session locale est vidée (`signOut`),
 *   ce qui renvoie l'utilisateur à l'état déconnecté.
 * Rien n'est journalisé : ni cookie ni corps de requête.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cookie = await authClient.getCookie();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (cookie) headers.set('Cookie', cookie);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'omit' });
  } catch {
    throw new ApiError(0, 'network_error');
  }

  if (response.status === 401) {
    // Vide le cookie et le cache de session dans SecureStore, même si le serveur ne répond pas.
    await authClient.signOut().catch(() => undefined);
    throw new ApiError(401, 'unauthorized');
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: unknown };
    throw new ApiError(response.status, typeof body.error === 'string' ? body.error : 'request_error');
  }

  return (await response.json()) as T;
}
