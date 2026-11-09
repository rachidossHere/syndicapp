// Android : sélecteur de date natif Material 3 (Jetpack Compose, @expo/ui), en couleur primary,
// avec les boutons « Annuler » et « Valider » de l'appli. Les noms des mois et des jours suivent
// la langue du téléphone : @expo/ui ne permet pas d'en imposer une autre.
import { DatePickerDialog, Host } from '@expo/ui/jetpack-compose';
import { useTheme } from '@syndic/ui';

import { useT } from '@/i18n/use-t';

import type { DatePickerSheetProps } from './date-picker-sheet';

export type { DatePickerSheetProps } from './date-picker-sheet';

export function DatePickerSheet({ visible, value, minimum, onConfirm, onClose }: DatePickerSheetProps) {
  const { colors } = useTheme();
  const t = useT();

  if (!visible) return null;

  return (
    <Host matchContents>
      <DatePickerDialog
        // Compose travaille en UTC : « 2026-12-15 » est minuit UTC, et la date choisie revient en UTC.
        initialDate={value}
        selectableDates={{ start: new Date(`${minimum}T00:00:00Z`) }}
        color={colors.primary}
        confirmButtonLabel={t('common.confirm')}
        dismissButtonLabel={t('common.cancel')}
        onDateSelected={(date) => onConfirm(date.toISOString().slice(0, 10))}
        onDismissRequest={onClose}
      />
    </Host>
  );
}
