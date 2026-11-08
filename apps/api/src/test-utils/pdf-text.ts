// Tests seulement : texte d'un PDF, extrait avec pdfjs-dist (dépendance de développement).
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/** Texte de toutes les pages, espaces (y compris insécables) normalisés. */
export async function pdfText(bytes: Uint8Array): Promise<string> {
  const task = getDocument({ data: bytes.slice(), useSystemFonts: false });
  const doc = await task.promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    for (const item of content.items) if ('str' in item) parts.push(item.str);
  }
  await task.destroy();
  return parts.join(' ').replace(/\s+/g, ' ');
}
