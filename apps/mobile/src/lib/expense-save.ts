// Enregistrement d'une dépense : « URL d'envoi → envoi vers R2 → création ».
// Orchestration pure : les appels réseau sont injectés (voir expense-api.ts), donc testable
// avec une API simulée.
import type { CreateExpenseInput } from '@syndic/shared';

import type { InvoiceFile } from './invoice';

/** Réponse de POST /api/expenses/upload-url. */
export type UploadTarget = {
  uploadUrl: string;
  key: string;
  method: 'PUT';
  headers: Record<string, string>;
};

/** Contenu lu du fichier : octets à envoyer et leur taille exacte (incluse dans la signature). */
export type InvoiceBody = { body: unknown; size: number };

export type SaveExpenseDeps = {
  readFile: (uri: string) => Promise<InvoiceBody>;
  requestUploadUrl: (file: { contentType: string; size: number }) => Promise<UploadTarget>;
  putFile: (target: UploadTarget, file: InvoiceBody, onProgress: (ratio: number) => void) => Promise<void>;
  createExpense: (input: CreateExpenseInput) => Promise<unknown>;
};

/** Facture déjà envoyée vers R2 : réutilisée à un nouvel essai pour ne pas la renvoyer. */
export type UploadedInvoice = { uri: string; key: string };

export type SaveExpenseArgs = {
  /** Saisie validée (sans facture ni clientId). */
  fields: Omit<CreateExpenseInput, 'invoiceKey' | 'clientId'>;
  /** Identifiant créé à l'ouverture du formulaire : identique à chaque essai, jamais de doublon. */
  clientId: string;
  invoice?: InvoiceFile | undefined;
  /** Mémoire de la facture envoyée (modifiée ici) : un nouvel essai ne renvoie pas le fichier. */
  uploaded: { current: UploadedInvoice | undefined };
  deps: SaveExpenseDeps;
  onProgress?: (ratio: number) => void;
};

/**
 * Envoie la facture (si elle existe et n'est pas déjà envoyée), puis crée la dépense avec sa clé.
 * Une erreur est relancée telle quelle ; la saisie, le `clientId` et la facture déjà envoyée restent
 * valables pour le nouvel essai.
 */
export async function saveExpense({
  fields,
  clientId,
  invoice,
  uploaded,
  deps,
  onProgress,
}: SaveExpenseArgs): Promise<unknown> {
  let invoiceKey: string | undefined;

  if (invoice !== undefined) {
    if (uploaded.current?.uri !== invoice.uri) {
      uploaded.current = undefined;
      const file = await deps.readFile(invoice.uri);
      const target = await deps.requestUploadUrl({ contentType: invoice.contentType, size: file.size });
      await deps.putFile(target, file, onProgress ?? (() => undefined));
      uploaded.current = { uri: invoice.uri, key: target.key };
    }
    invoiceKey = uploaded.current.key;
  }

  return deps.createExpense({
    ...fields,
    ...(invoiceKey !== undefined ? { invoiceKey } : {}),
    clientId,
  });
}
