// Sélecteur de date natif : versions iOS (native-date-picker.ios.tsx) et Android
// (native-date-picker.android.tsx). Ailleurs (web, non pris en charge par le MVP) : rien.
export type NativeDatePickerProps = {
  /** Date choisie, AAAA-MM-JJ. */
  value: string;
  /** Première date proposée, AAAA-MM-JJ. */
  minimum: string;
  onChange: (value: string) => void;
  /** Fermeture sans choix (dialogue Android). */
  onClose: () => void;
};

export function NativeDatePicker(_props: NativeDatePickerProps) {
  return null;
}
