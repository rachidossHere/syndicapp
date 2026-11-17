import { LOT_DELETE_BLOCKERS, LOT_ERRORS } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import { translate } from '../i18n/translate';
import { ApiError } from './api-error';
import { apiErrorKey } from './api-errors';
import { canSaveReference, deleteState, referenceDraft } from './lot-edit';

describe('modifier la référence', () => {
  it('actif seulement si la saisie est valide et différente de la référence actuelle', () => {
    expect(canSaveReference(referenceDraft('A11', 'A11'))).toBe(false);
    expect(canSaveReference(referenceDraft('  A11 ', 'A11'))).toBe(false);
    expect(canSaveReference(referenceDraft('A12', 'A11'))).toBe(true);
    expect(canSaveReference(referenceDraft('', 'A11'))).toBe(false);
    expect(canSaveReference(referenceDraft('   ', 'A11'))).toBe(false);
    expect(canSaveReference(referenceDraft('X'.repeat(21), 'A11'))).toBe(false);
    expect(referenceDraft(' B12 ', 'A11').value).toBe('B12');
  });

  it('l’erreur de doublon de l’API s’affiche avec un message clair, en français et en arabe', () => {
    const key = apiErrorKey(new ApiError(409, LOT_ERRORS.referenceExists));
    expect(key).toBe('lots.errors.referenceExists');
    expect(translate('fr', key)).toBe('Cette référence existe déjà dans la résidence.');
    expect(translate('ar', key)).toMatch(/[؀-ۿ]/);
  });
});

describe('supprimer un appartement', () => {
  it('actif quand rien n’est rattaché à l’appartement', () => {
    expect(deleteState(null)).toEqual({ disabled: false, reasonKey: undefined });
    expect(deleteState(undefined).disabled).toBe(false);
  });

  it('désactivé avec la raison, pour chaque obstacle (membre, invitation, paiement, charge, signalement)', () => {
    const reasons = LOT_DELETE_BLOCKERS.map((blocker) => {
      const state = deleteState(blocker);
      expect(state.disabled).toBe(true);
      expect(state.reasonKey).toBeDefined();
      return translate('fr', state.reasonKey!);
    });
    expect(new Set(reasons).size).toBe(LOT_DELETE_BLOCKERS.length);
    expect(translate('fr', deleteState('charge').reasonKey!)).toBe(
      'Cet appartement a des charges : il ne peut pas être supprimé.',
    );
    expect(translate('fr', deleteState('member').reasonKey!)).toContain('membre');
    expect(translate('fr', deleteState('invitation').reasonKey!)).toContain('invitation');
    expect(translate('fr', deleteState('payment').reasonKey!)).toContain('paiements');
  });

  it('le refus 409 de l’API dit pourquoi (même clé que le bouton désactivé)', () => {
    for (const blocker of LOT_DELETE_BLOCKERS) {
      const key = deleteState(blocker).reasonKey!;
      expect(apiErrorKey(new ApiError(409, key))).toBe(key);
    }
  });
});
