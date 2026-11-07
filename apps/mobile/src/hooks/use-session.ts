import {
  AUTH_ERROR_KEYS,
  authFieldErrors,
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from '@syndic/shared';
import { useQueryClient } from '@tanstack/react-query';

import { setActiveResidenceId } from '@/lib/active-residence';
import { authClient } from '@/lib/auth-client';
import { toAuthResult, type AuthResult } from '@/lib/auth-errors';
import { currentNetworkErrorKey } from '@/lib/network';
import { isFetchFailure } from '@/lib/network-errors';
import { markJustSignedUp } from '@/lib/welcome-flag';

import { ME_QUERY_KEY } from './use-me';

type ClientCall = () => Promise<{ error: unknown }>;

/**
 * Exécute un appel au client Better Auth sans jamais laisser de promesse rejetée :
 * une exception (réseau) est traitée comme une requête sans réponse.
 */
async function callClient(call: ClientCall): Promise<{ error: { status?: number; statusText?: string } | null }> {
  try {
    const { error } = await call();
    return { error: (error as { status?: number; statusText?: string } | null) ?? null };
  } catch {
    return { error: { status: 0 } };
  }
}

/** Remplace l'erreur réseau générique par « pas de connexion » ou « serveur injoignable ». */
async function refineNetworkError(result: AuthResult): Promise<AuthResult> {
  if (result.ok || result.formError !== AUTH_ERROR_KEYS.network) return result;
  return { ...result, formError: await currentNetworkErrorKey() };
}

/**
 * Session de l'utilisateur (Better Auth, stockée dans SecureStore).
 * Les formulaires sont validés avec les schémas partagés avant tout appel ;
 * les erreurs sont renvoyées sous forme de clés de traduction, jamais de promesse rejetée.
 */
export function useSession() {
  const session = authClient.useSession();
  const queryClient = useQueryClient();

  const signUp = async (input: SignUpInput): Promise<AuthResult> => {
    const parsed = signUpSchema.safeParse(input);
    if (!parsed.success) return { ok: false, fields: authFieldErrors(parsed.error) };

    const { name, email, password } = parsed.data;
    const { error } = await callClient(() => authClient.signUp.email({ name, email, password }));
    if (!error) {
      // Avant la redirection vers « Bonjour » : le toast de bienvenue s'affichera une fois.
      markJustSignedUp();
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    }
    return refineNetworkError(toAuthResult(error, 'signUp'));
  };

  const signIn = async (input: SignInInput): Promise<AuthResult> => {
    const parsed = signInSchema.safeParse(input);
    if (!parsed.success) return { ok: false, fields: authFieldErrors(parsed.error) };

    const { error } = await callClient(() => authClient.signIn.email(parsed.data));
    if (!error) await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    return refineNetworkError(toAuthResult(error, 'signIn'));
  };

  /** Déconnexion. Sans réseau, la session reste ouverte et une erreur traduite est renvoyée. */
  const signOut = async (): Promise<AuthResult> => {
    const { error } = await callClient(() => authClient.signOut());
    if (!error) {
      // Rien de l'utilisateur précédent ne doit rester : résidences, appartements, invitations.
      queryClient.clear();
      setActiveResidenceId(null);
      return { ok: true };
    }
    return refineNetworkError(
      isFetchFailure(error)
        ? { ok: false, formError: AUTH_ERROR_KEYS.network }
        : { ok: false, formError: AUTH_ERROR_KEYS.unknown },
    );
  };

  /** Relance la lecture de la session (bouton « Réessayer » au démarrage). */
  const refetch = async (): Promise<void> => {
    try {
      await session.refetch();
    } catch {
      // L'erreur est conservée dans `session.error` : rien à faire ici.
    }
  };

  return {
    /** Utilisateur connecté, ou `null`. */
    user: session.data?.user ?? null,
    /** Vrai tant que la session n'est pas connue (lecture de SecureStore puis du serveur). */
    isLoading: session.isPending,
    /** Vrai pendant une nouvelle lecture de la session. */
    isRefetching: session.isRefetching,
    /** Vrai si la dernière lecture de la session n'a pas pu joindre le serveur. */
    hasNetworkError: isFetchFailure(session.error as { status?: number; statusText?: string } | null),
    signUp,
    signIn,
    signOut,
    refetch,
  };
}
