// Image de l'écran de bienvenue (plan 02b, étape 2) : choix pur entre l'image IA fournie
// (`assets/images/welcome.webp`) et l'illustration SVG de remplacement. Sans React, testé avec vitest.
export type WelcomeArt<Source> = { kind: 'image'; source: Source } | { kind: 'illustration' };

/** L'image est utilisée si le fichier existe, sinon l'illustration SVG occupe le même cadre. */
export const welcomeArtFor = <Source>(image: Source | null): WelcomeArt<Source> =>
  image === null ? { kind: 'illustration' } : { kind: 'image', source: image };
