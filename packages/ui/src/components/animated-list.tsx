import type { ComponentType } from 'react';
import type { FlatListProps } from 'react-native';
import Animated from 'react-native-reanimated';

import { reflowTransition } from '../motion/animations';
import { useReducedMotion } from '../motion/use-reduced-motion';

type ReflowFlatList<T> = ComponentType<
  FlatListProps<T> & { itemLayoutAnimation?: typeof reflowTransition }
>;

/**
 * `FlatList` dont les éléments glissent à leur place quand un élément est ajouté ou retiré (un
 * paiement, un appartement, une relance) : animation de mise en page de Reanimated, sur le fil
 * d'interface, `motion.duration.normal` et courbe `out`. Mêmes propriétés qu'une `FlatList`.
 *
 * « Réduire les animations » activé : les éléments changent de place directement.
 */
export function AnimatedList<T>(props: FlatListProps<T>) {
  const reducedMotion = useReducedMotion();
  const List = Animated.FlatList as unknown as ReflowFlatList<T>;
  return <List {...props} itemLayoutAnimation={reducedMotion ? undefined : reflowTransition} />;
}
