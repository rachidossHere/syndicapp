// Envoi d'un signalement : « photo vers R2 (si besoin) → création ». Orchestration pure, les appels
// réseau sont injectés (voir issue-api.ts) : testable avec une API simulée.
// La création n'est pas idempotente côté API : l'écran empêche le double envoi (bouton désactivé
// pendant l'envoi). En revanche, la photo déjà envoyée n'est jamais renvoyée à un nouvel essai.
import type { CreateIssueInput } from '@syndic/shared';

import type { InvoiceBody, UploadTarget } from './expense-save';
import type { InvoiceFile } from './invoice';

export type SaveIssueDeps = {
  readFile: (uri: string) => Promise<InvoiceBody>;
  requestUploadUrl: (file: { contentType: string; size: number }) => Promise<UploadTarget>;
  putFile: (target: UploadTarget, file: InvoiceBody, onProgress: (ratio: number) => void) => Promise<void>;
  createIssue: (input: CreateIssueInput) => Promise<unknown>;
};

/** Photo déjà envoyée vers R2 : réutilisée à un nouvel essai. */
export type UploadedPhoto = { uri: string; key: string };

export type SaveIssueArgs = {
  /** Saisie validée (sans photo). */
  fields: Omit<CreateIssueInput, 'photoKey'>;
  photo?: InvoiceFile | undefined;
  uploaded: { current: UploadedPhoto | undefined };
  deps: SaveIssueDeps;
  onProgress?: (ratio: number) => void;
};

export async function saveIssue({ fields, photo, uploaded, deps, onProgress }: SaveIssueArgs): Promise<unknown> {
  let photoKey: string | undefined;
  if (photo !== undefined) {
    if (uploaded.current?.uri !== photo.uri) {
      uploaded.current = undefined;
      const file = await deps.readFile(photo.uri);
      const target = await deps.requestUploadUrl({ contentType: photo.contentType, size: file.size });
      await deps.putFile(target, file, onProgress ?? (() => undefined));
      uploaded.current = { uri: photo.uri, key: target.key };
    }
    photoKey = uploaded.current.key;
  }
  return deps.createIssue({ ...fields, ...(photoKey !== undefined ? { photoKey } : {}) });
}
