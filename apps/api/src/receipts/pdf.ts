// Reçu PDF d'un paiement (plan 05, étape 3), généré côté API avec pdf-lib.
// Mise en page de l'écran 6 de docs/charges.png : marque, numéro, statut, puis une carte de
// lignes « libellé · valeur ». Aucun nom de personne : l'encaisseur est désigné par son rôle.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import fontkit from '@pdf-lib/fontkit';
import { formatMad, type PaymentMethod, type Role } from '@syndic/shared';
import { PDFDocument, degrees, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

import { FONTS_DIR } from '../assets-path';
import {
  RECEIPT_FR,
  dateFr,
  methodLabel,
  periodLabelFr,
  recordedByLabel,
} from './labels-fr';

export type ReceiptPdfData = {
  number: string;
  residenceName: string;
  lotReference: string;
  periodLabel: string;
  /** Centimes. */
  amount: number;
  method: PaymentMethod;
  paidAt: Date;
  /** Rôle de la personne qui a encaissé (jamais son nom). */
  recordedByRole: Role | null;
  cancelledAt: Date | null;
};

/**
 * Couleurs du reçu : mêmes valeurs que les jetons de @syndic/ui (tokens/colors.ts), dont l'index
 * charge react-native et ne peut pas être importé par l'API. Un test vérifie qu'elles sont égales.
 */
export const RECEIPT_COLORS = {
  primary: '#0F5257',
  bg: '#F6F2EA',
  surface: '#FFFFFF',
  border: '#E9E2D4',
  text: '#1D2327',
  textMuted: '#5C6670',
  successBg: '#DCEFE6',
  successFg: '#1F5E43',
  dangerBg: '#FBE3DA',
  dangerFg: '#8E3512',
} as const;

const color = (hex: string): RGB =>
  rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  );
const C = Object.fromEntries(
  Object.entries(RECEIPT_COLORS).map(([name, hex]) => [name, color(hex)]),
) as Record<keyof typeof RECEIPT_COLORS, RGB>;

/** Fichiers de police lus une seule fois. */
let fontFiles: { regular: Buffer; semiBold: Buffer; bold: Buffer } | undefined;
function loadFontFiles() {
  fontFiles ??= {
    regular: readFileSync(join(FONTS_DIR, 'PlusJakartaSans_400Regular.ttf')),
    semiBold: readFileSync(join(FONTS_DIR, 'PlusJakartaSans_600SemiBold.ttf')),
    bold: readFileSync(join(FONTS_DIR, 'PlusJakartaSans_700Bold.ttf')),
  };
  return fontFiles;
}

// A5 portrait, en points.
const PAGE = { width: 419.53, height: 595.28 };
const MARGIN = 32;

/** Texte qui tient dans `maxWidth` : taille réduite jusqu'à `minSize`, puis tronqué avec « … ». */
function fit(text: string, font: PDFFont, size: number, maxWidth: number, minSize = 8) {
  let current = size;
  while (current > minSize && font.widthOfTextAtSize(text, current) > maxWidth) current -= 0.5;
  let value = text;
  while (value.length > 1 && font.widthOfTextAtSize(value, current) > maxWidth) {
    value = `${value.slice(0, -2)}…`;
  }
  return { text: value, size: current };
}

function badge(page: PDFPage, font: PDFFont, label: string, right: number, top: number, fg: RGB, bg: RGB) {
  const size = 9;
  const width = font.widthOfTextAtSize(label, size) + 16;
  const height = 18;
  page.drawRectangle({ x: right - width, y: top - height, width, height, color: bg });
  page.drawText(label, { x: right - width + 8, y: top - height + 5.5, size, font, color: fg });
}

/** Génère le reçu PDF (octets). */
export async function renderReceiptPdf(data: ReceiptPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const files = loadFontFiles();
  const regular = await pdf.embedFont(files.regular, { subset: true });
  const semiBold = await pdf.embedFont(files.semiBold, { subset: true });
  const bold = await pdf.embedFont(files.bold, { subset: true });

  const cancelled = data.cancelledAt !== null;
  pdf.setTitle(RECEIPT_FR.title(data.number));
  pdf.setSubject(cancelled ? RECEIPT_FR.cancelled : RECEIPT_FR.paid);
  pdf.setCreator(RECEIPT_FR.brand);
  pdf.setProducer(RECEIPT_FR.brand);
  pdf.setLanguage('fr-MA');

  const page = pdf.addPage([PAGE.width, PAGE.height]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: C.bg });
  const contentWidth = PAGE.width - 2 * MARGIN;
  let y = PAGE.height - MARGIN;

  // Titre : « Reçu n° 2026-0042 ».
  y -= 22;
  page.drawText(RECEIPT_FR.title(data.number), { x: MARGIN, y, size: 22, font: bold, color: C.text });

  // Annulation : date bien visible sous le titre.
  if (cancelled) {
    y -= 22;
    page.drawText(RECEIPT_FR.cancelledOn(dateFr(data.cancelledAt!)), {
      x: MARGIN,
      y,
      size: 12,
      font: bold,
      color: C.dangerFg,
    });
  }

  // Carte : marque et statut, puis les lignes.
  const rows: [string, string][] = [
    [RECEIPT_FR.residence, data.residenceName],
    [RECEIPT_FR.lot, data.lotReference],
    [RECEIPT_FR.period, periodLabelFr(data.periodLabel)],
    [RECEIPT_FR.amount, formatMad(data.amount)],
    [RECEIPT_FR.method, methodLabel(data.method)],
    [RECEIPT_FR.date, dateFr(data.paidAt)],
    [RECEIPT_FR.recordedBy, recordedByLabel(data.recordedByRole)],
  ];
  const rowHeight = 30;
  const padding = 16;
  const headerHeight = 40;
  const cardHeight = headerHeight + rows.length * rowHeight + padding / 2;
  const cardTop = y - 20;
  page.drawRectangle({
    x: MARGIN,
    y: cardTop - cardHeight,
    width: contentWidth,
    height: cardHeight,
    color: C.surface,
    borderColor: C.border,
    borderWidth: 1,
  });
  const left = MARGIN + padding;
  const right = MARGIN + contentWidth - padding;

  page.drawText(RECEIPT_FR.brand, { x: left, y: cardTop - 26, size: 14, font: bold, color: C.text });
  badge(
    page,
    semiBold,
    cancelled ? RECEIPT_FR.cancelled : RECEIPT_FR.paid,
    right,
    cardTop - 12,
    cancelled ? C.dangerFg : C.successFg,
    cancelled ? C.dangerBg : C.successBg,
  );

  let rowY = cardTop - headerHeight;
  for (const [index, [label, value]] of rows.entries()) {
    const baseline = rowY - rowHeight / 2 - 4;
    page.drawText(label, { x: left, y: baseline, size: 11, font: regular, color: C.textMuted });
    const labelWidth = regular.widthOfTextAtSize(label, 11);
    const valueFit = fit(value, semiBold, 11, right - left - labelWidth - 16);
    page.drawText(valueFit.text, {
      x: right - semiBold.widthOfTextAtSize(valueFit.text, valueFit.size),
      y: baseline,
      size: valueFit.size,
      font: semiBold,
      color: C.text,
    });
    if (index < rows.length - 1) {
      page.drawLine({
        start: { x: left, y: rowY - rowHeight },
        end: { x: right, y: rowY - rowHeight },
        thickness: 0.75,
        color: C.border,
      });
    }
    rowY -= rowHeight;
  }

  // Tampon « ANNULÉ » en travers de la carte.
  if (cancelled) {
    const size = 64;
    const text = RECEIPT_FR.cancelledStamp;
    const width = bold.widthOfTextAtSize(text, size);
    const angle = 20;
    const rad = (angle * Math.PI) / 180;
    const centerX = PAGE.width / 2;
    const centerY = cardTop - cardHeight / 2;
    page.drawText(text, {
      x: centerX - (width / 2) * Math.cos(rad) + (size / 3) * Math.sin(rad),
      y: centerY - (width / 2) * Math.sin(rad) - (size / 3) * Math.cos(rad),
      size,
      font: bold,
      color: C.dangerFg,
      opacity: 0.35,
      rotate: degrees(angle),
    });
  }

  // Mention de pied de page.
  const footerSize = 10;
  page.drawText(RECEIPT_FR.footer, {
    x: (PAGE.width - regular.widthOfTextAtSize(RECEIPT_FR.footer, footerSize)) / 2,
    y: cardTop - cardHeight - 24,
    size: footerSize,
    font: regular,
    color: C.textMuted,
  });

  return pdf.save();
}
