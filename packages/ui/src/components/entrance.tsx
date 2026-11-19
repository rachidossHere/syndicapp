import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { ENTRANCE_WINDOW_MS, fadeOutFast, reflowTransition, riseIn } from '../motion/animations';
import { useReducedMotion } from '../motion/use-reduced-motion';
import { motion } from '../tokens/motion';

/** Fenêtre d'apparition d'une liste, créée par `useListEntrance`. */
export type ListEntrance = {
  /** Vrai pendant le premier affichage de la liste, faux ensuite (rafraîchissement, page suivante, retour). */
  isOpen: () => boolean;
};

/**
 * Autorise l'apparition en cascade d'une liste au PREMIER affichage de l'écran seulement : la fenêtre
 * reste ouverte le temps de la cascade, à partir du moment où les données sont là (`ready`), puis se
 * ferme pour de bon. Rien au rafraîchissement, au chargement des pages suivantes, ni quand on revient
 * sur un écran resté monté. La fenêtre est lue par `EntranceRow` à l'affichage d'une ligne : aucun
 * nouveau rendu quand elle se ferme.
 */
export function useListEntrance(ready: boolean): ListEntrance {
  const open = useRef(true);
  const [entrance] = useState<ListEntrance>(() => ({ isOpen: () => open.current }));

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      open.current = false;
    }, ENTRANCE_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  return entrance;
}

export type EntranceRowProps = {
  entrance: ListEntrance;
  /** Position de la ligne dans la liste : seules les `motion.staggerMax` premières s'animent. */
  index: number;
  /**
   * Liste NON virtualisée (ScrollView) : un élément ajouté plus tard apparaît par fondu, un élément
   * retiré disparaît par fondu, et les autres glissent à leur place. Ne jamais l'activer dans une
   * FlatList : ses lignes sont recyclées, l'animation repartirait à chaque défilement.
   */
  reflow?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Ligne de liste qui apparaît en cascade (fondu et léger glissement, `motion.stagger` entre deux
 * lignes) pour les `motion.staggerMax` premières lignes du premier affichage. Aucune animation sur les
 * autres : une longue liste ne coûte rien. L'animation est décidée une fois, à l'affichage de la ligne.
 *
 * « Réduire les animations » activé : ni cascade, ni glissement, ni mise en page animée.
 */
export function EntranceRow({
  entrance,
  index,
  reflow = false,
  style,
  children,
}: EntranceRowProps) {
  const reducedMotion = useReducedMotion();
  const [entering] = useState(() => {
    if (reducedMotion) return undefined;
    if (entrance.isOpen())
      return index < motion.staggerMax ? riseIn(index * motion.stagger) : undefined;
    return reflow ? riseIn() : undefined;
  });
  const animated = reflow && !reducedMotion;

  return (
    <Animated.View
      entering={entering}
      exiting={animated ? fadeOutFast : undefined}
      layout={animated ? reflowTransition : undefined}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
