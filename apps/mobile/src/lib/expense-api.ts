// Appels réels de l'ajout de dépense : API Hono (apiFetch) et envoi direct vers R2 (XHR, pour la
// progression). Le fichier ne passe jamais par notre API. Rien n'est journalisé : ni URL signée,
// ni clé, ni contenu.
import type { CreateExpenseInput } from '@syndic/shared';

import { ApiError, apiFetch } from './api';
import type { InvoiceBody, SaveExpenseDeps, UploadTarget } from './expense-save';

/** Délai maximal d'un envoi vers R2 : au-delà, c'est une erreur réseau (« Réessayer »). */
const UPLOAD_TIMEOUT_MS = 60_000;

/** Code d'un refus de R2 (URL expirée, fichier refusé) : traduit par expenses.errors.uploadFailed. */
export const UPLOAD_FAILED_CODE = 'expenses.errors.uploadFailed';

async function readFile(uri: string): Promise<InvoiceBody> {
  try {
    const blob = await (await fetch(uri)).blob();
    return { body: blob, size: blob.size };
  } catch {
    throw new ApiError(0, 'network_error');
  }
}

const requestUploadUrl: SaveExpenseDeps['requestUploadUrl'] = (file) =>
  apiFetch<UploadTarget>('/api/expenses/upload-url', { method: 'POST', body: JSON.stringify(file) });

/** PUT vers l'URL signée, avec la progression (0 à 1). Pas de cookie : l'URL signée suffit. */
const putFile: SaveExpenseDeps['putFile'] = (target, file, onProgress) =>
  new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(target.method, target.uploadUrl);
    for (const [name, value] of Object.entries(target.headers)) request.setRequestHeader(name, value);
    request.timeout = UPLOAD_TIMEOUT_MS;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new ApiError(request.status, UPLOAD_FAILED_CODE));
      }
    };
    request.onerror = () => reject(new ApiError(0, 'network_error'));
    request.ontimeout = () => reject(new ApiError(0, 'network_error'));
    // Corps : le Blob lu du fichier (le type RN de send() n'accepte pas `unknown`).
    request.send(file.body as Blob);
  });

const createExpense: SaveExpenseDeps['createExpense'] = (input: CreateExpenseInput) =>
  apiFetch<unknown>('/api/expenses', { method: 'POST', body: JSON.stringify(input) });

export const expenseDeps: SaveExpenseDeps = { readFile, requestUploadUrl, putFile, createExpense };
