// Annulation confirmée dans une feuille (Modal) : ordre des étapes, sans React, testable avec vitest.
//
// Pourquoi cet ordre : l'écran sous la feuille change quand l'annulation est enregistrée (boutons
// retirés, badge « Annulée »). Si ce changement arrive pendant que la feuille est encore présentée
// ou se ferme, iOS peut garder une présentation fantôme qui capte tous les touchers (bouton de
// retour mort, alors que l'écran affiche bien « Annulée »). On ferme donc la feuille, on attend
// sa fermeture complète, on la démonte, et seulement ensuite on actualise l'écran.

/** Délai de secours : Android n'envoie pas d'événement de fermeture, et un événement perdu ne doit pas bloquer. */
export const SHEET_CLOSE_FALLBACK_MS = 600;

export type ClosingGate = {
  /** Promesse résolue à la fermeture de la feuille (`notifyClosed`) ou après le délai de secours. */
  wait: () => Promise<void>;
  /** À appeler quand la feuille a fini de se fermer (`onDismissed` de la feuille). */
  notifyClosed: () => void;
};

export function createClosingGate(timeoutMs: number = SHEET_CLOSE_FALLBACK_MS): ClosingGate {
  let pending: { resolve: () => void; timer: ReturnType<typeof setTimeout> } | undefined;
  const settle = () => {
    if (pending === undefined) return;
    const { resolve, timer } = pending;
    pending = undefined;
    clearTimeout(timer);
    resolve();
  };
  return {
    wait: () =>
      new Promise<void>((resolve) => {
        settle();
        pending = { resolve, timer: setTimeout(settle, timeoutMs) };
      }),
    notifyClosed: settle,
  };
}

export type CancelOutcome = 'cancelled' | 'alreadyCancelled' | 'failed';

export type CancelFlowDeps = {
  /** Envoie l'annulation à l'API. */
  submit: () => Promise<void>;
  /** L'erreur signifie-t-elle « déjà annulée » ? Alors la feuille se ferme et l'écran s'actualise. */
  isAlreadyCancelled: (error: unknown) => boolean;
  /** Ferme la feuille (visible = false). */
  closeSheet: () => void;
  /** Promesse résolue quand la feuille a fini de se fermer : appelée AVANT `closeSheet`. */
  waitClosed: () => Promise<void>;
  /** Démonte la feuille : plus aucune Modal n'existe sous l'écran. */
  unmountSheet: () => void;
  /** Actualise les données de l'écran (il passe à « Annulée »). */
  refresh: () => Promise<unknown> | void;
  /** Confirmation affichée à l'utilisateur. */
  onCancelled: () => void;
  /** Échec : la feuille reste ouverte, le motif saisi est conservé pour réessayer. */
  onFailure: (error: unknown) => void;
};

async function closeThenRefresh(deps: CancelFlowDeps): Promise<void> {
  const closed = deps.waitClosed(); // armé avant la fermeture : l'événement ne peut pas être manqué
  deps.closeSheet();
  await closed;
  deps.unmountSheet();
  try {
    await deps.refresh();
  } catch {
    // L'écran affiche lui-même l'erreur d'actualisation (bandeau) : rien à faire ici.
  }
}

/** Enchaîne : envoi, fermeture de la feuille, attente de sa fermeture, démontage, actualisation. */
export async function runCancelFlow(deps: CancelFlowDeps): Promise<CancelOutcome> {
  try {
    await deps.submit();
  } catch (error) {
    if (!deps.isAlreadyCancelled(error)) {
      deps.onFailure(error);
      return 'failed';
    }
    await closeThenRefresh(deps);
    return 'alreadyCancelled';
  }
  await closeThenRefresh(deps);
  deps.onCancelled();
  return 'cancelled';
}
