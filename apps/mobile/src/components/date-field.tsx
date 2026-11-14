import { Icon, Text, useTheme } from '@syndic/ui';
import CalendarIcon from 'lucide-react-native/icons/calendar';
import { useMemo, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';

import { todayCasablanca } from '@/lib/charges-format';
import { dateBoundsFor, type DateUsage } from '@/lib/date-bounds';

import { DatePickerSheet } from './date-picker-sheet';

export type DateFieldProps = {
  label: string;
  /** Date choisie, AAAA-MM-JJ. */
  value: string;
  /** Texte affiché (date formatée dans la langue active). */
  display: string;
  /**
   * Usage de la date, qui fixe les bornes : échéance des charges (aujourd'hui ou plus tard),
   * dépense et solde de départ (aujourd'hui ou plus tôt). Voir lib/date-bounds.ts.
   */
  usage: DateUsage;
  /** Titre de la feuille du calendrier (déjà traduit). */
  sheetTitle: string;
  onChange: (value: string) => void;
};

/**
 * Seul champ de date de l'appli (échéance des charges, date de dépense, date du solde de départ) :
 * même allure qu'un champ de saisie (jetons de @syndic/ui), avec une icône de calendrier. Le
 * toucher ferme le clavier, puis ouvre le calendrier de l'appli dans une feuille ; la date ne
 * change qu'à la validation.
 */
export function DateField({ label, value, display, usage, sheetTitle, onChange }: DateFieldProps) {
  const { colors, radius, spacing, sizes, borderWidth } = useTheme();
  const [open, setOpen] = useState(false);
  const { minimum, maximum } = useMemo(() => dateBoundsFor(usage, todayCasablanca()), [usage]);

  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="bodyStrong" importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${display}`}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          // Le clavier du montant ne doit pas rester ouvert par-dessus le calendrier.
          Keyboard.dismiss();
          setOpen(true);
        }}
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
        <Icon icon={CalendarIcon} color={colors.iconInactive} />
      </Pressable>
      <DatePickerSheet
        visible={open}
        title={sheetTitle}
        value={value}
        minimum={minimum}
        maximum={maximum}
        onConfirm={(date) => {
          onChange(date);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}
