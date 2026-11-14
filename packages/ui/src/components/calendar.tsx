import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { Pressable, View } from 'react-native';

import { useTheme } from '../theme/theme-provider';
import {
  DAYS_PER_WEEK,
  isDateSelectable,
  isMonthReachable,
  monthWeeks,
  shiftMonth,
  type CalendarMonth,
} from './calendar-grid';
import { Icon } from './icon';
import { IconButton } from './icon-button';
import { Text } from './text';

export type CalendarProps = {
  /** Mois affiché. */
  month: CalendarMonth;
  onMonthChange: (month: CalendarMonth) => void;
  /** Date choisie, AAAA-MM-JJ. */
  value: string;
  /** Aujourd'hui, AAAA-MM-JJ (repéré par un contour). */
  today: string;
  /** Première date sélectionnable, AAAA-MM-JJ : les jours avant sont grisés. */
  minimum?: string | undefined;
  /** Dernière date sélectionnable, AAAA-MM-JJ : les jours après sont grisés. */
  maximum?: string | undefined;
  onSelect: (date: string) => void;
  /** Titre du mois (déjà traduit), ex. « Novembre 2026 ». */
  monthLabel: string;
  /** Les 7 jours de la semaine, du lundi au dimanche (déjà traduits, abrégés). */
  weekdayLabels: readonly string[];
  /** Libellé de la flèche « mois précédent » (déjà traduit). */
  previousLabel: string;
  /** Libellé de la flèche « mois suivant » (déjà traduit). */
  nextLabel: string;
  /** Libellé lu pour un jour, ex. « 15 décembre 2026 » (déjà traduit). */
  dayLabel: (date: string) => string;
  testID?: string;
};

/**
 * Calendrier d'un mois, entièrement dessiné avec les jetons (couleurs, tailles, rayons) : il ne
 * dépend ni du thème du téléphone ni de sa langue. La semaine commence le lundi. Les jours hors
 * bornes sont grisés (`textMuted`) et non appuyables ; le jour choisi est plein (`primary`) et
 * porte l'état « sélectionné » pour les lecteurs d'écran. En arabe, les flèches sont inversées.
 */
export function Calendar({
  month,
  onMonthChange,
  value,
  today,
  minimum,
  maximum,
  onSelect,
  monthLabel,
  weekdayLabels,
  previousLabel,
  nextLabel,
  dayLabel,
  testID,
}: CalendarProps) {
  const { colors, radius, sizes, spacing, borderWidth } = useTheme();
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const canGoPrevious = isMonthReachable(previous, minimum, maximum);
  const canGoNext = isMonthReachable(next, minimum, maximum);

  return (
    <View testID={testID} style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <NavButton
          label={previousLabel}
          disabled={!canGoPrevious}
          onPress={() => onMonthChange(previous)}
          icon={ChevronLeft}
        />
        <Text variant="bodyStrong" accessibilityRole="header" style={{ flex: 1, textAlign: 'center' }}>
          {monthLabel}
        </Text>
        <NavButton label={nextLabel} disabled={!canGoNext} onPress={() => onMonthChange(next)} icon={ChevronRight} />
      </View>

      <View style={{ flexDirection: 'row' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {weekdayLabels.slice(0, DAYS_PER_WEEK).map((label, index) => (
          <View key={index} style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="caption" tone="muted">
              {label}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.xs }}>
        {monthWeeks(month).map((week, weekIndex) => (
          <View key={weekIndex} style={{ flexDirection: 'row', gap: spacing.xs }}>
            {week.map((cell, cellIndex) => {
              if (cell === null) return <View key={cellIndex} style={{ flex: 1 }} />;
              const selected = cell.date === value;
              const selectable = isDateSelectable(cell.date, minimum, maximum);
              const isToday = cell.date === today;
              return (
                <Pressable
                  key={cellIndex}
                  accessibilityRole="button"
                  accessibilityLabel={dayLabel(cell.date)}
                  accessibilityState={{ selected, disabled: !selectable }}
                  disabled={!selectable}
                  onPress={() => onSelect(cell.date)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: sizes.touchTarget,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radius.md,
                    borderCurve: 'continuous',
                    borderWidth: borderWidth.thin,
                    // Aujourd'hui : contour ; jour choisi : fond plein (l'état n'est pas que la couleur).
                    borderColor: isToday || selected ? colors.primary : 'transparent',
                    backgroundColor: selected ? colors.primary : pressed ? colors.primarySoft : 'transparent',
                  })}>
                  <Text
                    variant={selected || isToday ? 'bodyStrong' : 'body'}
                    tone={selected ? 'inverse' : selectable ? 'default' : 'muted'}>
                    {cell.day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function NavButton({
  label,
  disabled,
  onPress,
  icon,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  icon: typeof ChevronLeft;
}) {
  const { colors, sizes } = useTheme();
  if (disabled) {
    // Flèche inactive : visible mais grisée, non appuyable, annoncée comme désactivée.
    return (
      <View
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: true }}
        style={{ width: sizes.touchTarget, height: sizes.touchTarget, alignItems: 'center', justifyContent: 'center' }}>
        <Icon icon={icon} color={colors.borderStrong} flipInRtl />
      </View>
    );
  }
  return <IconButton icon={icon} accessibilityLabel={label} onPress={onPress} flipInRtl />;
}
