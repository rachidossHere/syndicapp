import { describe, expect, it } from 'vitest';

import { statuses } from '../tokens/status';
import { uiMessage, uiMessages } from './messages';

describe('textes du design system', () => {
  it('donne un libellé FR conforme au plan pour chaque statut', () => {
    expect(Object.fromEntries(Object.entries(statuses).map(([k, s]) => [k, uiMessage(s.labelKey, 'fr')]))).toEqual({
      paid: 'Payé',
      unpaid: 'Impayé',
      open: 'Ouvert',
      in_progress: 'En cours',
      resolved: 'Résolu',
    });
  });

  it('traduit chaque texte en arabe', () => {
    for (const key of Object.keys(uiMessages.fr) as (keyof typeof uiMessages.fr)[]) {
      const arabic = uiMessage(key, 'ar');
      expect(arabic.length).toBeGreaterThan(0);
      expect(arabic).toMatch(/[؀-ۿ]/);
    }
  });
});
