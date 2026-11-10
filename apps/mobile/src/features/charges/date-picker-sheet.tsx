// Choix d'une date : versions iOS (date-picker-sheet.ios.tsx, calendrier dans une feuille) et
// Android (date-picker-sheet.android.tsx, sélecteur natif). Ailleurs (web, hors MVP) : rien.
export type DatePickerSheetProps = {
  /** Feuille ou dialogue affiché. */
  visible: boolean;
  /** Titre de la feuille (déjà traduit). */
  title: string;
  /** Date choisie, AAAA-MM-JJ. */
  value: string;
  /** Première date sélectionnable, AAAA-MM-JJ : les dates passées sont grisées. */
  minimum?: string | undefined;
  /** Dernière date sélectionnable, AAAA-MM-JJ : les dates futures sont grisées (dépenses). */
  maximum?: string | undefined;
  /** Date validée. */
  onConfirm: (value: string) => void;
  /** Fermeture sans changement. */
  onClose: () => void;
};

export function DatePickerSheet(_props: DatePickerSheetProps) {
  return null;
}
