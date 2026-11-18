// Charge `assets/images/welcome.webp` si le fichier existe (image IA fournie par Rachid, voir le plan
// 02b) ; sinon `null` et l'écran de bienvenue affiche son illustration SVG. Le `require` est dans un
// try/catch : Metro le traite comme une dépendance facultative (le build ne casse pas sans fichier).
// L'image est dans l'appli (dossier assets), jamais dans R2.
function loadWelcomeImage(): number | null {
  try {
    return require('../../assets/images/welcome.webp') as number;
  } catch {
    return null;
  }
}

export const WELCOME_IMAGE: number | null = loadWelcomeImage();
