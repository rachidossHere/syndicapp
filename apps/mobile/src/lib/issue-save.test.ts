import { describe, expect, it, vi } from 'vitest';

import type { InvoiceFile } from './invoice';
import { saveIssue, type SaveIssueDeps, type UploadedPhoto } from './issue-save';

const photo = (uri: string): InvoiceFile => ({ uri, kind: 'image', contentType: 'image/jpeg' });

function deps(overrides: Partial<SaveIssueDeps> = {}): SaveIssueDeps {
  return {
    readFile: vi.fn(async () => ({ body: 'octets', size: 1234 })),
    requestUploadUrl: vi.fn(async () => ({
      uploadUrl: 'https://r2.example/put',
      key: 'residences/r1/issues/abc.jpg',
      method: 'PUT' as const,
      headers: { 'Content-Type': 'image/jpeg' },
    })),
    putFile: vi.fn(async (_target, _file, onProgress) => onProgress(1)),
    createIssue: vi.fn(async () => ({ id: 'i1' })),
    ...overrides,
  };
}

const fields = { title: 'Ascenseur bloqué', location: 'elevator', urgent: true } as const;

describe('envoi d’un signalement', () => {
  it('sans photo : une seule création, rien vers R2', async () => {
    const d = deps();
    await saveIssue({ fields, uploaded: { current: undefined }, deps: d });
    expect(d.requestUploadUrl).not.toHaveBeenCalled();
    expect(d.createIssue).toHaveBeenCalledWith({ title: 'Ascenseur bloqué', location: 'elevator', urgent: true });
  });

  it('avec photo : URL d’envoi avec le type et la taille exacts, envoi, puis création avec la clé', async () => {
    const d = deps();
    const progress = vi.fn();
    await saveIssue({ fields, photo: photo('file://a.jpg'), uploaded: { current: undefined }, deps: d, onProgress: progress });
    expect(d.requestUploadUrl).toHaveBeenCalledWith({ contentType: 'image/jpeg', size: 1234 });
    expect(progress).toHaveBeenCalledWith(1);
    expect(d.createIssue).toHaveBeenCalledWith({ ...fields, photoKey: 'residences/r1/issues/abc.jpg' });
  });

  it('un nouvel essai après un échec de création ne renvoie pas la photo', async () => {
    const createIssue = vi.fn().mockRejectedValueOnce(new Error('réseau')).mockResolvedValueOnce({ id: 'i1' });
    const d = deps({ createIssue });
    const uploaded: { current: UploadedPhoto | undefined } = { current: undefined };
    await expect(saveIssue({ fields, photo: photo('file://a.jpg'), uploaded, deps: d })).rejects.toThrow('réseau');
    await saveIssue({ fields, photo: photo('file://a.jpg'), uploaded, deps: d });
    expect(d.putFile).toHaveBeenCalledTimes(1);
    expect(createIssue).toHaveBeenCalledTimes(2);
    expect(createIssue).toHaveBeenLastCalledWith({ ...fields, photoKey: 'residences/r1/issues/abc.jpg' });
  });

  it('une autre photo est envoyée à nouveau', async () => {
    const d = deps();
    const uploaded: { current: UploadedPhoto | undefined } = { current: undefined };
    await saveIssue({ fields, photo: photo('file://a.jpg'), uploaded, deps: d });
    await saveIssue({ fields, photo: photo('file://b.jpg'), uploaded, deps: d });
    expect(d.putFile).toHaveBeenCalledTimes(2);
  });

  it('un échec d’envoi vers R2 ne crée aucun signalement', async () => {
    const d = deps({ putFile: vi.fn().mockRejectedValue(new Error('R2')) });
    const uploaded: { current: UploadedPhoto | undefined } = { current: undefined };
    await expect(saveIssue({ fields, photo: photo('file://a.jpg'), uploaded, deps: d })).rejects.toThrow('R2');
    expect(d.createIssue).not.toHaveBeenCalled();
    expect(uploaded.current).toBeUndefined();
  });
});
