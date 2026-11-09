// iOS : calendrier SwiftUI (style « graphical »), affiché sous le champ.
import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle } from '@expo/ui/swift-ui/modifiers';

import { dateFromString, localDateString } from '@/lib/charges-format';

import type { NativeDatePickerProps } from './native-date-picker';

export type { NativeDatePickerProps } from './native-date-picker';

export function NativeDatePicker({ value, minimum, onChange }: NativeDatePickerProps) {
  return (
    <Host matchContents>
      <DatePicker
        selection={dateFromString(value)}
        range={{ start: dateFromString(minimum) }}
        displayedComponents={['date']}
        // Le calendrier donne une date à l'heure locale : on garde le jour affiché.
        onDateChange={(date) => onChange(localDateString(date))}
        modifiers={[datePickerStyle('graphical')]}
      />
    </Host>
  );
}
