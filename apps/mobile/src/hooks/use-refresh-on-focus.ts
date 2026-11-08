import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Rafraîchit les données quand on revient sur l'écran (retour depuis un autre écran),
 * sans doubler la requête du premier affichage.
 */
export function useRefreshOnFocus(refetch: () => unknown) {
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void refetch();
    }, [refetch]),
  );
}
