// iOS : calendrier SwiftUI (@expo/ui) dans une feuille de @syndic/ui, sur toute la largeur,
// dans la langue de l'appli (noms des mois et des jours, sens de lecture) et en couleur primary.
import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle, environment, frame, tint } from '@expo/ui/swift-ui/modifiers';
import { isRtlLanguage } from '@syndic/shared';
import { Button, Sheet, useTheme } from '@syndic/ui';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n/use-t';
import { dateFromString, localDateString } from '@/lib/charges-format';
import { useLanguage } from '@/providers/language-provider';

import type { DatePickerSheetProps } from './date-picker-sheet';

export type { DatePickerSheetProps } from './date-picker-sheet';

/** Langue de l'appli → locale du calendrier (Maroc pour l'arabe, chiffres latins). */
const CALENDAR_LOCALES = { fr: 'fr-FR', ar: 'ar-MA' } as const;

export function DatePickerSheet({ visible, title, value, minimum, onConfirm, onClose }: DatePickerSheetProps) {
  const { colors, spacing } = useTheme();
  const t = useT();
  const { language } = useLanguage();
  // Brouillon : la date du formulaire ne change qu'avec « Valider ».
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

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
      <Host
        // Hauteur calculée par SwiftUI ; largeur imposée par la feuille.
        matchContents={{ vertical: true }}
        // Sans cela, la zone du clavier est ajoutée à la hauteur du calendrier (espace vide).
        ignoreSafeArea="keyboard"
        layoutDirection={isRtlLanguage(language) ? 'rightToLeft' : 'leftToRight'}
        seedColor={colors.primary}
        style={{ width: '100%' }}>
        <DatePicker
          title={title}
          selection={dateFromString(draft)}
          range={{ start: dateFromString(minimum) }}
          displayedComponents={['date']}
          // Le calendrier donne une date à l'heure locale : on garde le jour affiché.
          onDateChange={(date) => setDraft(localDateString(date))}
          modifiers={[
            datePickerStyle('graphical'),
            environment('locale', CALENDAR_LOCALES[language]),
            tint(colors.primary),
            frame({ maxWidth: Infinity }),
          ]}
        />
      </Host>
    </Sheet>
  );
}
