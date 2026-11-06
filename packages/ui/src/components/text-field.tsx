import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import { useState, type ComponentRef, type Ref } from 'react';
import {
  Pressable,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/theme-provider';
import { Icon } from './icon';
import { Text } from './text';

export type TextFieldProps = Omit<
  TextInputProps,
  'style' | 'placeholderTextColor' | 'accessibilityLabel' | 'ref' | 'secureTextEntry'
> & {
  /** Libellé affiché au-dessus du champ et annoncé par les lecteurs d'écran (obligatoire). */
  label: string;
  /** Aide affichée sous le champ. */
  helper?: string;
  /** Message d'erreur (remplace l'aide), affiché en `dangerFg` et annoncé. */
  error?: string;
  /**
   * Champ de mot de passe : saisie masquée, avec un bouton (œil) pour l'afficher ou la masquer.
   */
  password?: boolean;
  /**
   * Saisie toujours de gauche à droite, même en arabe (e-mail, code, URL).
   */
  ltr?: boolean;
  /**
   * Référence vers le TextInput : compatible React Hook Form (`field.ref`).
   * Avec React 19, `ref` est une prop ordinaire : `forwardRef` n'est plus nécessaire.
   */
  ref?: Ref<ComponentRef<typeof TextInput>>;
  /** Mise en page du bloc (marges, flex). */
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * Champ de saisie : libellé, aide et erreur ; bordure `primary` au focus, `dangerFg` en erreur.
 * En option : mot de passe masquable (`password`) et saisie de gauche à droite (`ltr`).
 */
export function TextField({
  label,
  helper,
  error,
  password = false,
  ltr = false,
  ref,
  containerStyle,
  onFocus,
  onBlur,
  editable = true,
  ...inputProps
}: TextFieldProps) {
  const { colors, typography, radius, spacing, sizes, borderWidth, fontFamily, t } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const hasError = error !== undefined && error.length > 0;
  const message = hasError ? error : helper;

  const borderColor = hasError ? colors.dangerFg : focused ? colors.primary : colors.borderStrong;

  return (
    <View style={[{ gap: spacing.xs }, containerStyle]}>
      {/* Le libellé est porté par le champ lui-même : masqué ici pour ne pas être lu deux fois. */}
      <Text variant="bodyStrong" importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>

      <View
        style={{
          minHeight: sizes.input,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: borderWidth.thin,
          borderColor,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: focused ? colors.surface : colors.surfaceMuted,
        }}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={message}
          accessibilityState={{ disabled: !editable }}
          editable={editable}
          secureTextEntry={password && hidden}
          placeholderTextColor={colors.textMuted}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            {
              flex: 1,
              alignSelf: 'stretch',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              color: colors.text,
              fontSize: typography.body.fontSize,
              fontFamily: fontFamily(typography.body.fontWeight),
            },
            // E-mail, code : l'ordre des caractères reste de gauche à droite, même en arabe.
            ltr && { writingDirection: 'ltr' },
          ]}
          {...inputProps}
        />
        {password && (
          <Pressable
            onPress={() => setHidden((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? t('field.showPassword') : t('field.hidePassword')}
            style={{
              width: sizes.touchTarget,
              height: sizes.touchTarget,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon icon={hidden ? Eye : EyeOff} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {message !== undefined && message.length > 0 && (
        <Text
          variant="small"
          tone={hasError ? 'danger' : 'muted'}
          // L'erreur est annoncée dès qu'elle apparaît (Android) ; sur iOS, elle est lue avec le champ.
          accessibilityLiveRegion={hasError ? 'polite' : 'none'}>
          {message}
        </Text>
      )}
    </View>
  );
}
