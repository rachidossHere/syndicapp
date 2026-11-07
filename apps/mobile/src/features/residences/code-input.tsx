import { INVITE_CODE_LENGTH } from '@syndic/shared';
import { Text, useTheme } from '@syndic/ui';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { sanitizeInviteInput } from '@/lib/invite-code';

export type CodeInputProps = {
  value: string;
  onChange: (code: string) => void;
  /** Libellé lu par les lecteurs d'écran (le champ visible est fait de 6 cases). */
  label: string;
  editable?: boolean;
  error?: boolean;
  autoFocus?: boolean;
};

/**
 * Saisie d'un code d'invitation en 6 cases. Un seul champ de saisie invisible reçoit le clavier,
 * le collage d'un code entier et la correction automatique désactivée ; chaque saisie est normalisée
 * (`sanitizeInviteInput`). Les cases restent de gauche à droite, même en arabe (`direction: 'ltr'`).
 */
export function CodeInput({ value, onChange, label, editable = true, error = false, autoFocus = false }: CodeInputProps) {
  const { colors, radius, spacing, sizes, borderWidth, typography, fontFamily } = useTheme();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(autoFocus);
  const activeIndex = Math.min(value.length, INVITE_CODE_LENGTH - 1);

  return (
    <View>
      <View style={{ flexDirection: 'row', direction: 'ltr', justifyContent: 'center', gap: spacing.sm }}>
        {Array.from({ length: INVITE_CODE_LENGTH }, (_, index) => {
          const isActive = focused && editable && index === activeIndex;
          return (
            <View
              key={index}
              style={{
                width: sizes.touchTarget,
                height: sizes.button.lg,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: borderWidth.thin,
                borderColor: error ? colors.dangerFg : isActive ? colors.primary : colors.borderStrong,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                backgroundColor: isActive ? colors.surface : colors.surfaceMuted,
              }}>
              <Text variant="h2" importantForAccessibility="no" accessibilityElementsHidden>
                {value[index] ?? ''}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChange(sanitizeInviteInput(text))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={editable}
        autoFocus={autoFocus}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        selectTextOnFocus
        caretHidden
        accessibilityLabel={label}
        // Invisible mais présent : c'est lui que touchent les lecteurs d'écran et le clavier.
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: 0,
            writingDirection: 'ltr',
            fontSize: typography.body.fontSize,
            fontFamily: fontFamily(typography.body.fontWeight),
          },
        ]}
      />
      {/* Toucher une case remet le focus sur le champ (Android ignore parfois le champ invisible). */}
      {!focused && editable && (
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no"
          onPress={() => inputRef.current?.focus()}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}
