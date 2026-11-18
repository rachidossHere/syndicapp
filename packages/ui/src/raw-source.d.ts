// Import du texte d'un fichier source (`?raw`, géré par Vitest) : sert aux tests qui vérifient une
// garantie de câblage (ex. un bouton rendu seulement sous __DEV__). Jamais importé par l'appli.
declare module '*?raw' {
  const content: string;
  export default content;
}
