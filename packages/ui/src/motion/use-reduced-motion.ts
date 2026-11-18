// « Réduire les animations » du téléphone (réglage d'accessibilité du système), lu par Reanimated.
// Exposé par @syndic/ui pour que les écrans n'importent jamais Reanimated directement.
// Toute animation de l'appli l'interroge : mouvement réduit = ni déplacement, ni échelle, ni
// rebond ; au plus un fondu ou un changement de couleur qui explique l'état.
export { useReducedMotion } from 'react-native-reanimated';
