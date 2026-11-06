import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';

type Issue = { path: readonly PropertyKey[]; message: string; code: string };
type SafeParseSchema<TValues> = {
  safeParse(
    input: unknown,
  ): { success: true; data: TValues } | { success: false; error: { issues: readonly Issue[] } };
};

/**
 * Comme `schemaResolver`, mais chaque champ en erreur reçoit sa propre clé de traduction
 * (les messages de Zod ne sont jamais affichés).
 */
export function keyedResolver<TValues extends FieldValues>(
  schema: SafeParseSchema<TValues>,
  keys: Record<string, string>,
): Resolver<TValues> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? 'root');
      errors[field] ??= { type: issue.code, message: keys[field] ?? 'auth.errors.invalidInput' };
    }
    return { values: {}, errors: errors as FieldErrors<TValues> };
  };
}
