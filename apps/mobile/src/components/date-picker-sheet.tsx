// Choix d'une date, sur iOS comme sur Android : un calendrier dessiné avec les jetons de @syndic/ui
// (components/calendar), dans une feuille. Il ne dépend ni du thème du téléphone (clair ou
// sombre) ni de sa langue : mois et jours dans la langue de l'appli, semaine du lundi au dimanche,
// chiffres latins, bornes appliquées (jours hors bornes grisés et non appuyables).
import { Button, Calendar, Sheet, monthOf, useTheme, type CalendarMonth } from '@syndic/ui';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useChargeFormat } from '@/features/charges/use-charge-format';
import type { TranslationKey } from '@/i18n/translate';
import { useT } from '@/i18n/use-t';
import { todayCasablanca } from '@/lib/charges-format';

export type DatePickerSheetProps = {
  /** Feuille affichée. */
  visible: boolean;
  /** Titre de la feuille (déjà traduit). */
  title: string;
  /** Date choisie, AAAA-MM-JJ. */
  value: string;
  /** Première date sélectionnable, AAAA-MM-JJ : les dates passées sont grisées. */
  minimum?: string | undefined;
  /** Dernière date sélectionnable, AAAA-MM-JJ : les dates futures sont grisées. */
  maximum?: string | undefined;
  /** Date validée. */
  onConfirm: (value: string) => void;
  /** Fermeture sans changement. */
  onClose: () => void;
};

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Mois à afficher à l'ouverture : celui de la date choisie, ramené dans les bornes. */
export function initialMonth(value: string, minimum?: string, maximum?: string): CalendarMonth {
  let shown = value;
  if (minimum !== undefined && shown < minimum) shown = minimum;
  if (maximum !== undefined && shown > maximum) shown = maximum;
  return monthOf(shown);
}

export function DatePickerSheet({ visible, title, value, minimum, maximum, onConfirm, onClose }: DatePickerSheetProps) {
  const { spacing } = useTheme();
  const t = useT();
  const format = useChargeFormat();
  // Brouillon : la date du formulaire ne change qu'avec « Valider ».
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState(() => initialMonth(value, minimum, maximum));

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setMonth(initialMonth(value, minimum, maximum));
    }
  }, [visible, value, minimum, maximum]);

  const monthName = t(`charges.months.${month.month}` as TranslationKey);

  return (
    <Sheet
      visible={visible}
      title={title}
      dismissLabel={t('common.closeSheet')}
      onClose={onClose}
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button label={t('common.cancel')} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button label={t('common.confirm')} onPress={() => onConfirm(draft)} style={{ flex: 1 }} />
        </View>
      }>
      <Calendar
        month={month}
        onMonthChange={setMonth}
        value={draft}
        today={todayCasablanca()}
        minimum={minimum}
        maximum={maximum}
        onSelect={setDraft}
        monthLabel={t('charges.period.month', { month: monthName, year: month.year })}
        weekdayLabels={WEEKDAYS.map((day) => t(`calendar.weekday.${day}` as TranslationKey))}
        previousLabel={t('calendar.previousMonth')}
        nextLabel={t('calendar.nextMonth')}
        dayLabel={(date) => format.date(date, 'long')}
      />
    </Sheet>
  );
}
