// Filtre « Urgents » de la liste de traitement (plan 02b, étape 3) : ouvert par la pastille
// « signalements urgents » de l'accueil.
import { describe, expect, it } from 'vitest';

import { ar } from '../i18n/ar';
import { fr } from '../i18n/fr';
import {
  MANAGE_FILTERS,
  RESIDENT_FILTERS,
  filterCount,
  filterStatusParam,
  filterStatuses,
  needsMoreUrgent,
  parseFilterParam,
  urgentOnly,
} from './issues';

const item = (urgent: boolean) => ({ urgent });

describe('filtre « Urgents »', () => {
  it('existe pour le personnel (issues.manage), pas pour l’habitant', () => {
    expect(MANAGE_FILTERS).toContain('urgent');
    expect(RESIDENT_FILTERS).not.toContain('urgent');
  });

  it('demande à l’API les signalements non résolus (les urgents viennent en premier)', () => {
    expect(filterStatuses('urgent')).toEqual(['open', 'in_progress']);
    expect(filterStatusParam('urgent')).toBe('open,in_progress');
  });

  it('son compteur est celui des urgents non résolus', () => {
    expect(filterCount('urgent', { open: 4, in_progress: 2, resolved: 9, urgentUnresolved: 3 })).toBe(3);
  });

  it('la liste ne garde que les urgents', () => {
    expect(urgentOnly([item(true), item(false), item(true)])).toEqual([item(true), item(true)]);
    expect(urgentOnly([])).toEqual([]);
  });

  it('charge la page suivante tant que tous les éléments chargés sont urgents et qu’il en reste', () => {
    expect(needsMoreUrgent([item(true), item(true)], true)).toBe(true);
    expect(needsMoreUrgent([], true)).toBe(true);
    // Un élément non urgent est apparu : les urgents sont tous chargés (ils viennent en premier).
    expect(needsMoreUrgent([item(true), item(false)], true)).toBe(false);
    expect(needsMoreUrgent([item(true), item(true)], false)).toBe(false);
  });

  it('le paramètre de l’adresse choisit le filtre, sinon celui par défaut', () => {
    expect(parseFilterParam('urgent', 'manage')).toBe('urgent');
    expect(parseFilterParam('open', 'manage')).toBe('open');
    expect(parseFilterParam(undefined, 'manage')).toBe('all');
    expect(parseFilterParam('nimporte-quoi', 'manage')).toBe('all');
    // L'habitant n'a pas de filtre « Urgents » : le paramètre est ignoré.
    expect(parseFilterParam('urgent', 'resident')).toBe('active');
  });

  it('le libellé de la puce existe en français et en arabe', () => {
    expect(fr['issues.manage.filter.urgent']).toBe('Urgents · {count}');
    expect(ar['issues.manage.filter.urgent']).toMatch(/[؀-ۿ]/);
    expect(ar['issues.manage.filter.urgent']).toContain('{count}');
  });
});
