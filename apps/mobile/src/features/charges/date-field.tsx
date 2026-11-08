import { Icon, Text, useTheme } from '@syndic/ui';
import Calendar from 'lucide-react-native/icons/calendar';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { NativeDatePicker } from './native-date-picker';

export type DateFieldProps = {
  label: string;
  /** Date choisie, AAAA-MM-JJ. */
  value: string;
  /** Texte affiché (date formatée dans la langue active). */
  display: string;
  /** Première date proposée, AAAA-MM-JJ. */
  minimum: string;
  helper?: string;
  onChange: (value: string) => void;
};

/**
 * Champ de date : même allure qu'un champ de saisie (jetons de @syndic/ui), avec une icône de
 * calendrier. Le toucher ouvre le sélecteur natif (calendrier iOS, dialogue Android).
 */
export function DateField({ label, value, display, minimum, helper, onChange }: DateFieldProps) {
  const { colors, radius, spacing, sizes, borderWidth } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="bodyStrong" importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${display}`}
        accessibilityHint={helper}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => ({
          minHeight: sizes.input,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          borderWidth: borderWidth.thin,
          borderColor: open ? colors.primary : colors.borderStrong,
          backgroundColor: pressed ? colors.bg : colors.surface,
        })}>
        <Text>{display}</Text>
        <Icon icon={Calendar} color={colors.iconInactive} />
      </Pressable>
      {helper !== undefined && (
        <Text variant="small" tone="muted">
          {helper}
        </Text>
      )}
      {open && (
        <NativeDatePicker value={value} minimum={minimum} onChange={onChange} onClose={() => setOpen(false)} />
      )}
    </View>
  );
}
