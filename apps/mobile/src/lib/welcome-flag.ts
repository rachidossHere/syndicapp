/**
 * Signal d'une inscription réussie : l'écran « Bonjour » affiche alors le toast de bienvenue
 * une seule fois. Valeur en mémoire uniquement (rien n'est stocké sur le téléphone).
 */
let justSignedUp = false;

export function markJustSignedUp(): void {
  justSignedUp = true;
}

/** Renvoie vrai une seule fois après une inscription, puis faux. */
export function consumeJustSignedUp(): boolean {
  const value = justSignedUp;
  justSignedUp = false;
  return value;
}
