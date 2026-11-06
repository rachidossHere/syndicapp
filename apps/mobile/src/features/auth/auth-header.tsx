import { IconButton, useTheme } from '@syndic/ui';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { View } from 'react-native';

import { LanguageToggle } from '@/components/language-toggle';
import { useT } from '@/i18n/use-t';

/** En-tête des écrans d'authentification : retour au début, langue à la fin (inversés en arabe). */
export function AuthHeader({ onBack }: { onBack?: () => void }) {
  const { spacing } = useTheme();
  const t = useT();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
      {onBack ? (
        <IconButton icon={ChevronLeft} flipInRtl accessibilityLabel={t('common.back')} onPress={onBack} />
      ) : (
        <View />
      )}
      <LanguageToggle />
    </View>
  );
}
