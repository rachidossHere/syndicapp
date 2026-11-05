import { describe, expect, it } from 'vitest';

import { typography } from '../tokens/typography';
import { fontFamilies, fontFamily } from './font';

describe('fontFamily', () => {
  it.each([
    ['400', 'PlusJakartaSans_400Regular'],
    ['500', 'PlusJakartaSans_500Medium'],
    ['600', 'PlusJakartaSans_600SemiBold'],
    ['700', 'PlusJakartaSans_700Bold'],
    ['800', 'PlusJakartaSans_800ExtraBold'],
  ] as const)('fr %s → %s', (weight, expected) => {
    expect(fontFamily(weight, 'fr')).toBe(expected);
  });

  it.each([
    ['400', 'IBMPlexSansArabic_400Regular'],
    ['500', 'IBMPlexSansArabic_500Medium'],
    ['600', 'IBMPlexSansArabic_600SemiBold'],
    ['700', 'IBMPlexSansArabic_700Bold'],
  ] as const)('ar %s → %s', (weight, expected) => {
    expect(fontFamily(weight, 'ar')).toBe(expected);
  });

  it('fait retomber la graisse 800 sur 700 en arabe', () => {
    expect(fontFamily('800', 'ar')).toBe('IBMPlexSansArabic_700Bold');
  });

  it('trouve une police pour chaque style de texte dans les deux langues', () => {
    for (const style of Object.values(typography)) {
      expect(Object.values(fontFamilies.fr)).toContain(fontFamily(style.fontWeight, 'fr'));
      expect(Object.values(fontFamilies.ar)).toContain(fontFamily(style.fontWeight, 'ar'));
    }
  });
});
