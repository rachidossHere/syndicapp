import { describe, expect, it, vi } from 'vitest';

import { ApiError } from './api-error';
import { saveExpense, type SaveExpenseDeps, type UploadedInvoice } from './expense-save';
import type { InvoiceFile } from './invoice';

const CLIENT_ID = '3f0c5d5e-6a41-4c0e-9d52-1a7d3a0b6e11';
const fields = { label: 'Plombier', amount: 60000, category: 'repairs', spentOn: '2026-11-08' } as const;
const photo: InvoiceFile = { uri: 'file:///cache/facture.jpg', kind: 'image', contentType: 'image/jpeg' };

/** API simulée : enregistre l'ordre des appels. */
function fakeApi(overrides: Partial<SaveExpenseDeps> = {}) {
  const calls: string[] = [];
  const deps: SaveExpenseDeps = {
    readFile: vi.fn(async () => {
      calls.push('read');
      return { body: 'octets', size: 412_000 };
    }),
    requestUploadUrl: vi.fn(async () => {
      calls.push('url');
      return {
        uploadUrl: 'https://r2.example/signed',
        key: 'residences/r1/invoices/abc.jpg',
        method: 'PUT' as const,
        headers: { 'Content-Type': 'image/jpeg' },
      };
    }),
    putFile: vi.fn(async (_target, _file, onProgress) => {
      calls.push('put');
      onProgress(0.64);
      onProgress(1);
    }),
    createExpense: vi.fn(async () => {
      calls.push('create');
      return { id: 'e1' };
    }),
    ...overrides,
  };
  return { deps, calls };
}

const memory = (): { current: UploadedInvoice | undefined } => ({ current: undefined });

describe('enregistrement d’une dépense', () => {
  it('avec facture : URL d’envoi → envoi → création avec la clé', async () => {
    const { deps, calls } = fakeApi();
    const progress: number[] = [];
    await saveExpense({
      fields,
      clientId: CLIENT_ID,
      invoice: photo,
      uploaded: memory(),
      deps,
      onProgress: (ratio) => progress.push(ratio),
    });

    expect(calls).toEqual(['read', 'url', 'put', 'create']);
    // La taille signée est celle du fichier réellement lu ; le type est celui de la facture.
    expect(deps.requestUploadUrl).toHaveBeenCalledWith({ contentType: 'image/jpeg', size: 412_000 });
    expect(deps.createExpense).toHaveBeenCalledWith({
      ...fields,
      invoiceKey: 'residences/r1/invoices/abc.jpg',
      clientId: CLIENT_ID,
    });
    expect(progress).toEqual([0.64, 1]);
  });

  it('sans facture : création directe, sans clé de facture', async () => {
    const { deps, calls } = fakeApi();
    await saveExpense({ fields, clientId: CLIENT_ID, uploaded: memory(), deps });
    expect(calls).toEqual(['create']);
    const sent = vi.mocked(deps.createExpense).mock.calls[0]![0];
    expect(sent).toEqual({ ...fields, clientId: CLIENT_ID });
    expect('invoiceKey' in sent).toBe(false);
  });

  it('un échec réseau de l’envoi ne crée aucune dépense', async () => {
    const { deps } = fakeApi({
      putFile: vi.fn(async () => {
        throw new ApiError(0, 'network_error');
      }),
    });
    const uploaded = memory();
    await expect(saveExpense({ fields, clientId: CLIENT_ID, invoice: photo, uploaded, deps })).rejects.toMatchObject({
      status: 0,
    });
    expect(deps.createExpense).not.toHaveBeenCalled();
    expect(uploaded.current).toBeUndefined();
  });

  it('un nouvel essai réutilise le même client_id (pas de doublon) et ne renvoie pas la facture', async () => {
    let attempts = 0;
    const { deps } = fakeApi({
      createExpense: vi.fn(async () => {
        attempts += 1;
        if (attempts === 1) throw new ApiError(0, 'network_error');
        return { id: 'e1' };
      }),
    });
    const uploaded = memory();

    await expect(saveExpense({ fields, clientId: CLIENT_ID, invoice: photo, uploaded, deps })).rejects.toBeInstanceOf(
      ApiError,
    );
    await saveExpense({ fields, clientId: CLIENT_ID, invoice: photo, uploaded, deps });

    const sent = vi.mocked(deps.createExpense).mock.calls.map(([input]) => input);
    expect(sent).toHaveLength(2);
    expect(new Set(sent.map((input) => input.clientId))).toEqual(new Set([CLIENT_ID]));
    expect(new Set(sent.map((input) => input.invoiceKey)).size).toBe(1);
    // Facture envoyée une seule fois.
    expect(deps.putFile).toHaveBeenCalledTimes(1);
    expect(deps.requestUploadUrl).toHaveBeenCalledTimes(1);
  });

  it('une autre facture est envoyée à son tour (l’ancienne clé n’est pas réutilisée)', async () => {
    const { deps } = fakeApi();
    const uploaded = memory();
    await saveExpense({ fields, clientId: CLIENT_ID, invoice: photo, uploaded, deps });
    await saveExpense({
      fields,
      clientId: CLIENT_ID,
      invoice: { ...photo, uri: 'file:///cache/autre.jpg' },
      uploaded,
      deps,
    });
    expect(deps.putFile).toHaveBeenCalledTimes(2);
  });
});
