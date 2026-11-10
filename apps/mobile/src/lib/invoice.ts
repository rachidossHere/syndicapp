// Facture d'une dépense : règles de choix et de compression, sans React ni module natif
// (testables avec vitest). Les modules natifs sont appelés dans features/expenses.
import { MAX_INVOICE_SIZE_BYTES } from '@syndic/shared';

/** Largeur maximale d'une image de facture envoyée, en pixels (AGENTS.md : 1600 px). */
export const INVOICE_MAX_WIDTH = 1600;
/** Qualité JPEG des images de facture (AGENTS.md : 0,7). */
export const INVOICE_JPEG_QUALITY = 0.7;

/** Facture prête à être envoyée : image déjà compressée en JPEG, ou PDF tel quel. */
export type InvoiceFile = {
  uri: string;
  kind: 'image' | 'pdf';
  contentType: 'image/jpeg' | 'application/pdf';
  /** Nom du PDF, pour l'afficher à la place de l'aperçu. */
  name?: string;
};

/**
 * Paramètres de compression d'une image : réduite à 1600 px de large au plus (jamais agrandie),
 * puis enregistrée en JPEG de qualité 0,7. `resizeWidth` est absent si l'image est assez étroite.
 */
export function invoiceCompressionPlan(width: number | undefined): {
  resizeWidth: number | undefined;
  compress: number;
} {
  const tooWide = width !== undefined && Number.isFinite(width) && width > INVOICE_MAX_WIDTH;
  return { resizeWidth: tooWide ? INVOICE_MAX_WIDTH : undefined, compress: INVOICE_JPEG_QUALITY };
}

/** Un PDF de plus de 10 Mo est refusé avant tout envoi. Une taille inconnue passe (l'API revérifie). */
export function isInvoiceTooLarge(size: number | undefined): boolean {
  return size !== undefined && size > MAX_INVOICE_SIZE_BYTES;
}

/** Le type du fichier choisi est bien un PDF (type MIME, sinon extension). */
export function isPdfAsset(asset: { mimeType?: string | undefined; name?: string | undefined }): boolean {
  if (asset.mimeType !== undefined) return asset.mimeType.toLowerCase() === 'application/pdf';
  return asset.name?.toLowerCase().endsWith('.pdf') ?? false;
}
