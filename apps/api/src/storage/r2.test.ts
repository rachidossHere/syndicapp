// URL signées : calculées localement, sans appel réseau (clés factices).
import { describe, expect, it } from 'vitest';

import { SIGNED_URL_TTL_SECONDS, createR2Storage } from './r2';

const storage = createR2Storage({
  accountId: '0123456789abcdef0123456789abcdef',
  accessKeyId: 'cle-factice-0123456789',
  secretAccessKey: 'secret-factice-0123456789abcdef0123456789',
  bucket: 'syndicapp-test',
});

describe('getSignedReadUrl', () => {
  it('URL du point d\'accès R2, valable 5 minutes (X-Amz-Expires=300)', async () => {
    const url = new URL(
      await storage.getSignedReadUrl('residences/r/receipts/2026/2026-0042.pdf', {
        filename: 'recu-2026-0042.pdf',
        contentType: 'application/pdf',
      }),
    );
    expect(SIGNED_URL_TTL_SECONDS).toBe(300);
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com');
    expect(url.pathname).toBe('/syndicapp-test/residences/r/receipts/2026/2026-0042.pdf');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get('X-Amz-Credential')).toContain('/auto/s3/aws4_request');
    expect(url.searchParams.get('response-content-type')).toBe('application/pdf');
    expect(url.searchParams.get('response-content-disposition')).toBe(
      'inline; filename="recu-2026-0042.pdf"',
    );
    // Le secret n'apparaît jamais dans l'URL.
    expect(url.toString()).not.toContain('secret-factice');
  });

  it('nom de fichier assaini', async () => {
    const url = new URL(
      await storage.getSignedReadUrl('k.pdf', {
        filename: 'reçu "x".pdf',
        contentType: 'application/pdf',
      }),
    );
    expect(url.searchParams.get('response-content-disposition')).toBe(
      'inline; filename="re_u__x_.pdf"',
    );
  });
});
