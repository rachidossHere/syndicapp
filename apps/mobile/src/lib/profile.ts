// Onglet Profil (plan 02b, étape 3) : ce qui s'affiche selon le contexte. Fonction pure, sans React :
// testée avec vitest. Les réglages de la personne (notifications, langue, déconnexion) existent
// même sans résidence ; « Changer de résidence » n'existe que s'il y en a plusieurs ; la galerie
// visuelle n'existe qu'en développement.
export type ProfileEntry =
  | 'residence'
  | 'switchResidence'
  | 'notifications'
  | 'language'
  | 'gallery'
  | 'signOut'
  | 'version';

export function profileEntries(input: { isDev: boolean; residenceCount: number }): ProfileEntry[] {
  return [
    'residence',
    ...(input.residenceCount > 1 ? (['switchResidence'] as const) : []),
    'notifications',
    'language',
    ...(input.isDev ? (['gallery'] as const) : []),
    'signOut',
    'version',
  ];
}

/** Version de l'appli affichée : celle d'app.json, ou « — » si elle est inconnue. */
export const versionLabel = (version: string | null | undefined): string =>
  version !== undefined && version !== null && version.trim() !== '' ? version.trim() : '—';
