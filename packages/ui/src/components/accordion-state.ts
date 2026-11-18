// Accessibilité et chevron de l'Accordion : logique pure, testée sans rendu.

export type AccordionA11yInput = {
  title: string;
  subtitle?: string;
  expanded: boolean;
  disabled?: boolean;
};

/**
 * Propriétés d'accessibilité de l'en-tête : un bouton dont l'état ouvert ou fermé est annoncé
 * (`expanded`), avec le titre et le sous-titre comme libellé.
 */
export function accordionA11y({ title, subtitle, expanded, disabled = false }: AccordionA11yInput) {
  return {
    accessibilityRole: 'button' as const,
    accessibilityLabel: [title, subtitle].filter(Boolean).join(', '),
    accessibilityState: { expanded, disabled },
  };
}

/**
 * Chevron de l'en-tête : vers le bas quand la section est ouverte, vers la fin de ligne quand elle
 * est fermée (inversé en arabe par `Icon`).
 */
export const accordionChevron = (expanded: boolean): 'down' | 'forward' => (expanded ? 'down' : 'forward');
