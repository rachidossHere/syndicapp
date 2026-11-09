import { MAX_INVOICE_SIZE_BYTES } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import {
  INVOICE_JPEG_QUALITY,
  INVOICE_MAX_WIDTH,
  invoiceCompressionPlan,
  isInvoiceTooLarge,
  isPdfAsset,
} from './invoice';

describe('compression de la facture', () => {
  it('fixe 1600 px de large au maximum et JPEG 0,7', () => {
    expect(INVOICE_MAX_WIDTH).toBe(1600);
    expect(INVOICE_JPEG_QUALITY).toBe(0.7);
  });

  it('réduit une photo de téléphone à 1600 px de large', () => {
    expect(invoiceCompressionPlan(4032)).toEqual({ resizeWidth: 1600, compress: 0.7 });
    expect(invoiceCompressionPlan(1601).resizeWidth).toBe(1600);
  });

  it('n’agrandit jamais une image étroite (mais la recompresse)', () => {
    expect(invoiceCompressionPlan(1600)).toEqual({ resizeWidth: undefined, compress: 0.7 });
    expect(invoiceCompressionPlan(800).resizeWidth).toBeUndefined();
  });

  it('largeur inconnue ou invalide : pas de redimensionnement, compression gardée', () => {
    expect(invoiceCompressionPlan(undefined)).toEqual({ resizeWidth: undefined, compress: 0.7 });
    expect(invoiceCompressionPlan(Number.NaN).resizeWidth).toBeUndefined();
  });
});

describe('PDF', () => {
  it('refuse plus de 10 Mo, accepte 10 Mo pile et une taille inconnue', () => {
    expect(MAX_INVOICE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    expect(isInvoiceTooLarge(MAX_INVOICE_SIZE_BYTES + 1)).toBe(true);
    expect(isInvoiceTooLarge(MAX_INVOICE_SIZE_BYTES)).toBe(false);
    expect(isInvoiceTooLarge(undefined)).toBe(false);
  });

  it('reconnaît un PDF par son type, sinon par son extension', () => {
    expect(isPdfAsset({ mimeType: 'application/pdf' })).toBe(true);
    expect(isPdfAsset({ mimeType: 'image/png', name: 'facture.pdf' })).toBe(false);
    expect(isPdfAsset({ name: 'Facture.PDF' })).toBe(true);
    expect(isPdfAsset({ name: 'programme.exe' })).toBe(false);
    expect(isPdfAsset({})).toBe(false);
  });
});
