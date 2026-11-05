import {
  authFieldErrors,
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from '@syndic/shared';
import { useQueryClient } from '@tanstack/react-query';

import { authClient } from '@/lib/auth-client';
import { toAuthResult, type AuthResult } from '@/lib/auth-errors';

import { ME_QUERY_KEY } from './use-me';

/**
 * Session de l'utilisateur (Better Auth, stockée dans SecureStore).
 * Les formulaires sont validés avec les schémas partagés avant tout appel ;
 * les erreurs sont renvoyées sous forme de clés de traduction.
 */
export function useSession() {
  const session = authClient.useSession();
  const queryClient = useQueryClient();

  const signUp = async (input: SignUpInput): Promise<AuthResult> => {
    const parsed = signUpSchema.safeParse(input);
    if (!parsed.success) return { ok: false, fields: authFieldErrors(parsed.error) };

    const { name, email, password } = parsed.data;
    const { error } = await authClient.signUp.email({ name, email, password });
    if (!error) await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    return toAuthResult(error, 'signUp');
  };

  const signIn = async (input: SignInInput): Promise<AuthResult> => {
    const parsed = signInSchema.safeParse(input);
    if (!parsed.success) return { ok: false, fields: authFieldErrors(parsed.error) };

    const { error } = await authClient.signIn.email(parsed.data);
    if (!error) await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    return toAuthResult(error, 'signIn');
  };

  const signOut = async (): Promise<void> => {
    await authClient.signOut();
    queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
  };

  return {
    /** Utilisateur connecté, ou `null`. */
    user: session.data?.user ?? null,
    /** Vrai tant que la session n'est pas connue (lecture de SecureStore puis du serveur). */
    isLoading: session.isPending,
    signUp,
    signIn,
    signOut,
    refetch: session.refetch,
  };
}
