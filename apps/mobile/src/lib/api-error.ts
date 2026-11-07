/** Erreur d'un appel à notre API : statut HTTP et code générique, jamais de détail interne. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    /** Références en conflit d'un 409 sur les lots (« A11 », « B12 »). */
    public readonly references: readonly string[] = [],
  ) {
    super(`Appel à l'API refusé (${status} ${code})`);
    this.name = 'ApiError';
  }
}
