import { useEffect, useRef, useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

import { easeOut } from '../motion/animations';
import { useReducedMotion } from '../motion/use-reduced-motion';
import { useTheme } from '../theme/theme-provider';
import { ARABIC_LINE_HEIGHT_FACTOR } from '../tokens/typography';
import { Amount, type AmountProps } from './amount';
import { formatAmount, formatAmountWorklet } from './amount-format';
import { toneColors } from './text';

// Un `TextInput` en lecture seule : sa propriété `text` se met à jour sur le fil d'interface, image par
// image, sans aucun nouveau rendu React (un `Text` ne le permet pas).
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * Montant qui compte jusqu'à sa valeur au PREMIER affichage (de 0 à la valeur, en `motion.duration.count`,
 * courbe `out`), puis change directement aux mises à jour suivantes : un solde qui bouge parce qu'un
 * paiement vient d'être enregistré ne recompte pas. Pendant le comptage, seuls les dirhams entiers
 * défilent ; la valeur exacte (avec ses centimes) s'affiche à l'arrivée.
 *
 * « Réduire les animations » activé : la valeur s'affiche directement (un `Amount` ordinaire).
 * Lu par les lecteurs d'écran avec sa valeur finale, jamais avec un nombre intermédiaire.
 * À placer dans une colonne (il prend toute la largeur, comme un texte) : un `TextInput` ne se
 * redimensionne pas quand son texte change.
 */
export function AnimatedAmount({
  centimes,
  direction = 'neutral',
  variant = 'bodyStrong',
  tone = 'default',
  style,
  testID,
}: AmountProps) {
  const { colors, typography, fontFamily, isRtl, motion } = useTheme();
  const reducedMotion = useReducedMotion();
  const shown = useSharedValue(reducedMotion ? centimes : 0);
  const firstDisplay = useRef(true);
  // Texte avant la première image du compteur : 0, pour ne jamais montrer la valeur finale puis la reprendre.
  const [initialText] = useState(() => formatAmount(reducedMotion ? centimes : 0, direction));

  useEffect(() => {
    if (firstDisplay.current && !reducedMotion) {
      firstDisplay.current = false;
      shown.set(withTiming(centimes, { duration: motion.duration.count, easing: easeOut }));
      return;
    }
    firstDisplay.current = false;
    shown.set(centimes);
  }, [centimes, reducedMotion, motion.duration.count, shown]);

  const animatedProps = useAnimatedProps(() => {
    const current = shown.get();
    const value = current === centimes ? centimes : Math.round(current / 100) * 100;
    const text = formatAmountWorklet(value, direction);
    // `text` n'est pas dans les types de `TextInput`, mais c'est la propriété native qui affiche le texte.
    return { text, defaultValue: text } as Partial<TextInputProps>;
  });

  if (reducedMotion) {
    return (
      <Amount
        centimes={centimes}
        direction={direction}
        variant={variant}
        tone={tone}
        style={style}
        testID={testID}
      />
    );
  }

  const token = typography[variant];
  const color =
    direction === 'in'
      ? colors.successFg
      : direction === 'out'
        ? colors.moneyOut
        : colors[toneColors[tone]];
  const lineHeight = isRtl
    ? Math.round(token.lineHeight * ARABIC_LINE_HEIGHT_FACTOR)
    : token.lineHeight;

  return (
    <AnimatedTextInput
      accessible
      accessibilityRole="text"
      accessibilityLabel={formatAmount(centimes, direction)}
      animatedProps={animatedProps}
      defaultValue={initialText}
      editable={false}
      pointerEvents="none"
      scrollEnabled={false}
      testID={testID}
      style={[
        {
          color,
          fontSize: token.fontSize,
          lineHeight,
          height: lineHeight,
          padding: 0,
          margin: 0,
          fontFamily: fontFamily(token.fontWeight),
          textAlign: 'auto',
          fontVariant: ['tabular-nums'],
          writingDirection: 'ltr',
        },
        style,
      ]}
    />
  );
}
