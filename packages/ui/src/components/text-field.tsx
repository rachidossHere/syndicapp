import { useState, type ComponentRef, type Ref } from 'react';
import {
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/theme-provider';
import { Text } from './text';

export type TextFieldProps = Omit<
  TextInputProps,
  'style' | 'placeholderTextColor' | 'accessibilityLabel' | 'ref'
> & {
  /** Libellé affiché au-dessus du champ et annoncé par les lecteurs d'écran (obligatoire). */
  label: string;
  /** Aide affichée sous le champ. */
  helper?: string;
  /** Message d'erreur (remplace l'aide), affiché en `dangerFg` et annoncé. */
  error?: string;
  /**
   * Référence vers le TextInput : compatible React Hook Form (`field.ref`).
   * Avec React 19, `ref` est une prop ordinaire : `forwardRef` n'est plus nécessaire.
   */
  ref?: Ref<ComponentRef<typeof TextInput>>;
  /** Mise en page du bloc (marges, flex). */
  containerStyle?: StyleProp<ViewStyle>;
};

/** Champ de saisie : libellé, aide et erreur ; bordure `primary` au focus, `dangerFg` en erreur. */
export function TextField({
  label,
  helper,
  error,
  ref,
  containerStyle,
  onFocus,
  onBlur,
  editable = true,
  ...inputProps
}: TextFieldProps) {
  const { colors, typography, radius, spacing, sizes, borderWidth, fontFamily } = useTheme();
  const [focused, setFocused] = useState(false);
  const hasError = error !== undefined && error.length > 0;
  const message = hasError ? error : helper;

  const borderColor = hasError ? colors.dangerFg : focused ? colors.primary : colors.borderStrong;

  return (
    <View style={[{ gap: spacing.xs }, containerStyle]}>
      {/* Le libellé est porté par le champ lui-même : masqué ici pour ne pas être lu deux fois. */}
      <Text variant="bodyStrong" importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>

      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={message}
        accessibilityState={{ disabled: !editable }}
        editable={editable}
        placeholderTextColor={colors.textMuted}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={{
          minHeight: sizes.input,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderWidth: borderWidth.thin,
          borderColor,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: focused ? colors.surface : colors.surfaceMuted,
          color: colors.text,
          fontSize: typography.body.fontSize,
          fontFamily: fontFamily(typography.body.fontWeight),
        }}
        {...inputProps}
      />

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
