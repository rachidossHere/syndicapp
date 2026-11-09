import { describe, expect, it } from 'vitest';

// Import des jetons seuls : l'index du package exporte aussi les composants (react-native),
// que vitest ne charge pas sous Node.
import { colors, layout, opacity, radius, spacing, statuses, statusTones, typography } from './index';

describe('jetons de @syndic/ui', () => {
  it('reprend les couleurs clés du plan 02', () => {
    expect(colors.primary).toBe('#0F5257');
    expect(colors.accent).toBe('#F2B33D');
    expect(colors.bg).toBe('#F6F2EA');
  });

  it('écrit chaque couleur en hexadécimal à 6 chiffres', () => {
    for (const value of Object.values(colors)) {
      expect(value).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('reprend la typographie, les espacements et les rayons clés', () => {
    expect(typography.display).toEqual({ fontSize: 34, lineHeight: 40, fontWeight: '800' });
    expect(spacing.lg).toBe(16);
    expect(radius.pill).toBe(999);
    expect(layout).toEqual({ screenPadding: 20, listGap: 12, sectionGap: 16 });
  });

  it('garde des opacités entre 0 et 1, dont le fond assombri des feuilles', () => {
    expect(opacity.scrim).toBe(0.4);
    for (const value of Object.values(opacity)) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('garde des espacements multiples de 4', () => {
    for (const value of Object.values(spacing)) {
      expect(value % 4).toBe(0);
    }
  });

  it('couvre tous les statuts du tableau avec un ton valide', () => {
    expect(Object.keys(statuses).sort()).toEqual(
      ['cancelled', 'closed', 'in_progress', 'ongoing', 'open', 'paid', 'partial', 'resolved', 'unpaid'].sort(),
    );
    for (const [key, status] of Object.entries(statuses)) {
      expect(statusTones).toContain(status.tone);
      expect(status.labelKey).toBe(`status.${status.domain}.${key}`);
    }
  });

  it('associe chaque ton à une paire de couleurs fond / texte', () => {
    for (const tone of statusTones) {
      expect(colors).toHaveProperty(`${tone}Bg`);
      expect(colors).toHaveProperty(`${tone}Fg`);
    }
  });
});
