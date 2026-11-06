/**
 * Code reçu par lien profond alors que l'utilisateur n'est pas connecté : gardé en mémoire
 * (rien n'est stocké sur le téléphone) jusqu'à la connexion ou l'inscription, puis repris une fois.
 */
let pendingCode: string | null = null;

export function setPendingInviteCode(code: string): void {
  pendingCode = code;
}

/** Renvoie le code en attente une seule fois, puis `null`. */
export function consumePendingInviteCode(): string | null {
  const code = pendingCode;
  pendingCode = null;
  return code;
}
