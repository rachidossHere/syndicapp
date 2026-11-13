import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SHEET_CLOSE_FALLBACK_MS,
  createClosingGate,
  runCancelFlow,
  type CancelFlowDeps,
} from './cancel-flow';

/**
 * Modèle de l'écran « Détail d'une dépense » : une feuille (Modal) peut être montée au-dessus de
 * l'écran, et tant qu'elle l'est, elle capte tous les touchers. Le bouton de retour n'appelle la
 * navigation que si plus aucune feuille n'est montée.
 */
function createScreen() {
  const log: string[] = [];
  const gate = createClosingGate();
  const state = { sheetMounted: true, sheetVisible: true, cancelled: false, toast: false };
  const navigation = { back: vi.fn() };
  const submit = vi.fn(async () => {
    log.push('submit');
  });
  const deps: CancelFlowDeps = {
    submit,
    isAlreadyCancelled: (error) => error instanceof Error && error.message === 'already',
    closeSheet: () => {
      log.push('closeSheet');
      state.sheetVisible = false;
    },
    waitClosed: () => {
      log.push('waitClosed');
      return gate.wait();
    },
    unmountSheet: () => {
      log.push('unmountSheet');
      state.sheetMounted = false;
    },
    refresh: async () => {
      log.push('refresh');
      state.cancelled = true; // l'écran passe à « Annulée » : le pied de page disparaît
    },
    onCancelled: () => {
      log.push('toast');
      state.toast = true;
    },
    onFailure: () => {
      log.push('failure');
    },
  };
  const pressBack = () => {
    if (state.sheetMounted) return false; // touchers captés par la feuille
    navigation.back();
    return true;
  };
  return { log, gate, state, navigation, deps, pressBack, submit };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('annulation confirmée dans une feuille', () => {
  it('ferme la feuille, attend sa fermeture, la démonte, puis seulement actualise l’écran', async () => {
    const screen = createScreen();
    const done = runCancelFlow(screen.deps);
    await vi.advanceTimersByTimeAsync(0);

    // Feuille fermée mais fermeture pas encore terminée : l'écran dessous n'a pas changé.
    expect(screen.log).toEqual(['submit', 'waitClosed', 'closeSheet']);
    expect(screen.state).toMatchObject({ sheetVisible: false, sheetMounted: true, cancelled: false });
    expect(screen.pressBack()).toBe(false);

    screen.gate.notifyClosed(); // iOS : onDismiss de la Modal
    await expect(done).resolves.toBe('cancelled');
    expect(screen.log).toEqual(['submit', 'waitClosed', 'closeSheet', 'unmountSheet', 'refresh', 'toast']);
    expect(screen.state).toEqual({ sheetMounted: false, sheetVisible: false, cancelled: true, toast: true });
  });

  it('l’écran redevient interactif : le bouton de retour appelle la navigation', async () => {
    const screen = createScreen();
    const done = runCancelFlow(screen.deps);
    await vi.advanceTimersByTimeAsync(0);
    screen.gate.notifyClosed();
    await done;

    expect(screen.state.sheetMounted).toBe(false);
    expect(screen.pressBack()).toBe(true);
    expect(screen.navigation.back).toHaveBeenCalledTimes(1);
  });

  it('sans événement de fermeture (Android), le délai de secours démonte la feuille', async () => {
    const screen = createScreen();
    const done = runCancelFlow(screen.deps);
    await vi.advanceTimersByTimeAsync(SHEET_CLOSE_FALLBACK_MS - 1);
    expect(screen.state.sheetMounted).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await expect(done).resolves.toBe('cancelled');
    expect(screen.state).toMatchObject({ sheetMounted: false, cancelled: true });
    expect(screen.pressBack()).toBe(true);
  });

  it('un événement de fermeture arrivé pendant la fermeture n’est pas perdu', async () => {
    const screen = createScreen();
    // La Modal signale sa fermeture dès que visible passe à false, avant même le retour de closeSheet.
    const original = screen.deps.closeSheet;
    screen.deps.closeSheet = () => {
      original();
      screen.gate.notifyClosed();
    };
    await expect(runCancelFlow(screen.deps)).resolves.toBe('cancelled');
    expect(screen.state.sheetMounted).toBe(false);
  });

  it('en cas d’échec, la feuille reste ouverte, rien n’est actualisé, le motif est conservé', async () => {
    const screen = createScreen();
    screen.submit.mockRejectedValueOnce(new Error('network'));
    await expect(runCancelFlow(screen.deps)).resolves.toBe('failed');
    expect(screen.log).toEqual(['failure']);
    expect(screen.state).toMatchObject({ sheetMounted: true, sheetVisible: true, cancelled: false, toast: false });
  });

  it('« déjà annulée » : la feuille se ferme et se démonte, l’écran s’actualise, sans confirmation', async () => {
    const screen = createScreen();
    screen.submit.mockRejectedValueOnce(new Error('already'));
    const done = runCancelFlow(screen.deps);
    await vi.advanceTimersByTimeAsync(SHEET_CLOSE_FALLBACK_MS);
    await expect(done).resolves.toBe('alreadyCancelled');
    expect(screen.state).toMatchObject({ sheetMounted: false, cancelled: true, toast: false });
    expect(screen.pressBack()).toBe(true);
  });

  it('une actualisation en erreur ne bloque pas l’écran', async () => {
    const screen = createScreen();
    screen.deps.refresh = async () => {
      throw new Error('offline');
    };
    const done = runCancelFlow(screen.deps);
    await vi.advanceTimersByTimeAsync(SHEET_CLOSE_FALLBACK_MS);
    await expect(done).resolves.toBe('cancelled');
    expect(screen.state).toMatchObject({ sheetMounted: false, toast: true });
    expect(screen.pressBack()).toBe(true);
  });
});

describe('porte de fermeture', () => {
  it('se résout une seule fois et ne laisse aucun minuteur en attente', async () => {
    const gate = createClosingGate(500);
    const waiting = gate.wait();
    gate.notifyClosed();
    gate.notifyClosed();
    await expect(waiting).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('une nouvelle attente libère la précédente', async () => {
    const gate = createClosingGate(500);
    const first = gate.wait();
    const second = gate.wait();
    await expect(first).resolves.toBeUndefined();
    gate.notifyClosed();
    await expect(second).resolves.toBeUndefined();
  });
});
