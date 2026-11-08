// Reçu PDF : contenu vérifié en extrayant le texte du fichier produit (pdfjs-dist, tests seulement).
// Des exemples sont enregistrés dans apps/api/tmp/receipts/ (dossier ignoré par git).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { formatMad } from '@syndic/shared';
import { describe, expect, it } from 'vitest';

import { colors } from '../../../../packages/ui/src/tokens/colors';
import { pdfText } from '../test-utils/pdf-text';
import { dateFr, periodLabelFr, recordedByLabel } from './labels-fr';
import { RECEIPT_COLORS, renderReceiptPdf, type ReceiptPdfData } from './pdf';

const SAMPLES_DIR = resolve(import.meta.dirname, '../../tmp/receipts');

const base: ReceiptPdfData = {
  number: '2026-0042',
  residenceName: 'Résidence Al Andalous',
  lotReference: 'A12',
  periodLabel: '2026-Q4',
  amount: 45_000,
  method: 'transfer',
  paidAt: new Date('2026-11-05T10:00:00Z'),
  recordedByRole: 'manager',
  cancelledAt: null,
};

describe('renderReceiptPdf', () => {
  it('commence par %PDF et contient le numéro, le montant et toutes les lignes', async () => {
    const bytes = await renderReceiptPdf(base);
    expect(Buffer.from(bytes.slice(0, 5)).toString('latin1')).toBe('%PDF-');
    mkdirSync(SAMPLES_DIR, { recursive: true });
    writeFileSync(resolve(SAMPLES_DIR, 'recu-2026-0042.pdf'), bytes);

    const text = await pdfText(bytes);
    expect(text).toContain('Reçu n° 2026-0042');
    expect(text).toContain('450 MAD');
    expect(formatMad(base.amount).replace(/\s/g, ' ')).toBe('450 MAD');
    for (const expected of [
      'SyndicApp',
      'Payé',
      'Résidence Al Andalous',
      'Appartement',
      'A12',
      '4e trimestre 2026',
      'Virement',
      '5 novembre 2026',
      'Encaissé par',
      'Le syndic',
      'Reçu généré par SyndicApp',
    ]) {
      expect(text).toContain(expected);
    }
    expect(text).not.toContain('ANNULÉ');
  });

  it('paiement annulé : mention « ANNULÉ » bien visible et date d\'annulation', async () => {
    const bytes = await renderReceiptPdf({
      ...base,
      method: 'cash',
      recordedByRole: 'treasurer',
      cancelledAt: new Date('2026-11-07T23:30:00Z'), // 8 novembre à Casablanca
    });
    mkdirSync(SAMPLES_DIR, { recursive: true });
    writeFileSync(resolve(SAMPLES_DIR, 'recu-2026-0042-annule.pdf'), bytes);

    const text = await pdfText(bytes);
    expect(text).toContain('ANNULÉ');
    expect(text).toContain('Paiement annulé le 8 novembre 2026');
    expect(text).toContain('Annulé');
    expect(text).toContain('Espèces');
    expect(text).toContain('Le trésorier');
    expect(text).toContain('2026-0042');
    expect(text).toContain('450 MAD');
  });

  it('nom de résidence très long : réduit ou tronqué, sans erreur', async () => {
    const bytes = await renderReceiptPdf({ ...base, residenceName: 'Résidence '.repeat(20) });
    expect(await pdfText(bytes)).toContain('Reçu n° 2026-0042');
  });

  it('montant avec centimes et séparateur de milliers', async () => {
    const text = await pdfText(await renderReceiptPdf({ ...base, amount: 1_842_050 }));
    expect(text).toContain('18 420,50 MAD');
  });
});

describe('libellés du reçu', () => {
  it('périodes, dates et rôles en français', () => {
    expect(periodLabelFr('2026-Q1')).toBe('1er trimestre 2026');
    expect(periodLabelFr('2026-Q4')).toBe('4e trimestre 2026');
    expect(periodLabelFr('2026-11')).toBe('novembre 2026');
    expect(dateFr(new Date('2026-12-31T23:30:00Z'))).toBe('1er janvier 2027');
    expect(recordedByLabel('manager')).toBe('Le syndic');
    expect(recordedByLabel('treasurer')).toBe('Le trésorier');
    expect(recordedByLabel(null)).toBe('Le bureau du syndic');
  });

  it('couleurs identiques aux jetons de @syndic/ui', () => {
    for (const [name, value] of Object.entries(RECEIPT_COLORS)) {
      expect(colors[name as keyof typeof colors], name).toBe(value);
    }
  });
});
