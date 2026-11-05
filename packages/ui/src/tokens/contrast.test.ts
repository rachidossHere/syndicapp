import { describe, expect, it } from 'vitest';

import { colors, type ColorToken } from './colors';

/** Luminance relative WCAG 2.x d'une couleur `#RRGGBB`. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: ColorToken, background: ColorToken): number {
  const a = luminance(colors[foreground]);
  const b = luminance(colors[background]);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('contrastes du texte (WCAG, 4,5:1 minimum)', () => {
  it.each([
    // Paires demandées par la section « Vérification » du plan 02.
    ['textMuted', 'bg'],
    ['textInverse', 'primary'],
    ['successFg', 'successBg'],
    ['warningFg', 'warningBg'],
    ['dangerFg', 'dangerBg'],
    // Paires utilisées par les composants.
    ['infoFg', 'infoBg'],
    ['text', 'accent'],
    ['text', 'bg'],
    ['textMuted', 'surface'],
    ['textMuted', 'surfaceMuted'],
    ['primary', 'surface'],
    ['primary', 'primarySoft'],
    ['iconInactive', 'surface'],
    ['successFg', 'surface'],
    ['moneyOut', 'surface'],
    ['dangerFg', 'surfaceMuted'],
    ['textInverse', 'primaryPressed'],
  ] as const)('%s sur %s', (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});
