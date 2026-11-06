/**
 * Description d'une erreur pour le journal : uniquement son nom et son code.
 * Jamais le message, la pile, la requête SQL, ses paramètres ni le corps de la requête,
 * qui peuvent contenir des données personnelles (e-mail, nom) ou un secret.
 */
export type ErrorSummary = { name: string; code?: string };

const asCode = (value: unknown): string | undefined =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;

export function describeError(error: unknown): ErrorSummary {
  const name = error instanceof Error ? error.name : typeof error;
  const withCode = error as { code?: unknown; cause?: { code?: unknown } } | null | undefined;
  // Les erreurs Postgres (ex. 23505, violation d'unicité) sont souvent rangées dans `cause` par Drizzle.
  const code = asCode(withCode?.code) ?? asCode(withCode?.cause?.code);
  return code === undefined ? { name } : { name, code };
}

/** Texte d'une ligne de journal : « NomErreur (code 23505) ». */
export function formatErrorSummary(summary: ErrorSummary): string {
  return summary.code === undefined ? summary.name : `${summary.name} (code ${summary.code})`;
}
