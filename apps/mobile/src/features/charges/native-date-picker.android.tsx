// Android : dialogue de date Material 3 (Jetpack Compose).
import { DatePickerDialog, Host } from '@expo/ui/jetpack-compose';

import type { NativeDatePickerProps } from './native-date-picker';

export type { NativeDatePickerProps } from './native-date-picker';

export function NativeDatePicker({ value, minimum, onChange, onClose }: NativeDatePickerProps) {
  return (
    <Host matchContents>
      <DatePickerDialog
        // Compose travaille en UTC : « 2026-12-15 » est minuit UTC, et la date choisie revient en UTC.
        initialDate={value}
        selectableDates={{ start: new Date(`${minimum}T00:00:00Z`) }}
        onDateSelected={(date) => {
          onChange(date.toISOString().slice(0, 10));
          onClose();
        }}
        onDismissRequest={onClose}
      />
    </Host>
  );
}
