// Appels réels des signalements : API Hono (apiFetch) ; la lecture du fichier et l'envoi vers R2
// (avec progression) sont ceux des factures. Rien n'est journalisé : ni URL signée, ni clé.
import type { CreateIssueInput } from '@syndic/shared';

import { ApiError, apiFetch } from './api';
import { apiErrorKey } from './api-errors';
import { UPLOAD_FAILED_CODE, expenseDeps } from './expense-api';
import type { SaveIssueDeps } from './issue-save';
import type { UploadTarget } from './expense-save';

export const issueDeps: SaveIssueDeps = {
  readFile: expenseDeps.readFile,
  putFile: expenseDeps.putFile,
  requestUploadUrl: (file) =>
    apiFetch<UploadTarget>('/api/issues/upload-url', { method: 'POST', body: JSON.stringify(file) }),
  createIssue: (input: CreateIssueInput) =>
    apiFetch<unknown>('/api/issues', { method: 'POST', body: JSON.stringify(input) }),
};

/** Refus de R2 (photo) : texte propre aux signalements, pas celui des factures. */
export function issueErrorKey(error: unknown): string {
  if (error instanceof ApiError && error.code === UPLOAD_FAILED_CODE) return 'issues.errors.uploadFailed';
  return apiErrorKey(error);
}
