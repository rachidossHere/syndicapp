import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';

/**
 * Schéma compatible : les schémas Zod de @syndic/shared (signUpSchema, signInSchema).
 * Typage structurel : l'appli ne dépend pas directement de zod.
 */
type SafeParseSchema<TValues> = {
  safeParse(input: unknown):
    | { success: true; data: TValues }
    | { success: false; error: { issues: readonly { path: readonly PropertyKey[]; message: string; code: string }[] } };
};

/**
 * Adaptateur React Hook Form ↔ schéma Zod partagé (évite la dépendance @hookform/resolvers).
 * Le message de chaque erreur est une clé de traduction (`auth.errors.*`), jamais du texte.
 */
export function schemaResolver<TValues extends FieldValues>(schema: SafeParseSchema<TValues>): Resolver<TValues> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? 'root');
      errors[field] ??= { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as FieldErrors<TValues> };
  };
}
