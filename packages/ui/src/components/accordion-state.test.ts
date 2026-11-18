import { describe, expect, it } from 'vitest';

import { accordionA11y, accordionChevron } from './accordion-state';

describe('Accordion : accessibilité', () => {
  it('l’en-tête est un bouton qui annonce l’état ouvert', () => {
    const props = accordionA11y({ title: 'Bâtiment A', subtitle: '15 appartements · 1 membre', expanded: true });
    expect(props.accessibilityRole).toBe('button');
    expect(props.accessibilityState).toEqual({ expanded: true, disabled: false });
    expect(props.accessibilityLabel).toBe('Bâtiment A, 15 appartements · 1 membre');
  });

  it('… et l’état fermé', () => {
    const props = accordionA11y({ title: 'Bâtiment B', expanded: false });
    expect(props.accessibilityState).toEqual({ expanded: false, disabled: false });
    expect(props.accessibilityLabel).toBe('Bâtiment B');
  });

  it('un en-tête désactivé le dit aux lecteurs d’écran', () => {
    expect(accordionA11y({ title: 'Bâtiment C', expanded: false, disabled: true }).accessibilityState.disabled).toBe(true);
  });
});

describe('Accordion : chevron', () => {
  it('vers le bas quand la section est ouverte, vers la fin de ligne (inversé en arabe) quand elle est fermée', () => {
    expect(accordionChevron(true)).toBe('down');
    expect(accordionChevron(false)).toBe('forward');
  });
});
