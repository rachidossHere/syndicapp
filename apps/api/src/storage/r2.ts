// Stockage des fichiers dans Cloudflare R2, par son API compatible S3 (@aws-sdk/client-s3).
// Le bucket est privé : un fichier ne se lit que par une URL signée de courte durée.
// Ni les clés, ni les URL signées, ni les clés d'objet ne sont jamais écrites dans les logs.
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '../env';

/** Durée de validité d'une URL signée de lecture : 5 minutes. */
export const SIGNED_URL_TTL_SECONDS = 300;

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

export type Storage = {
  putObject(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** URL de lecture valable 5 minutes ; `filename` est proposé au téléchargement. */
  getSignedReadUrl(
    key: string,
    options: { filename: string; contentType: string; signingDate?: Date },
  ): Promise<string>;
  deleteObject(key: string): Promise<void>;
};

/** Client R2 : point d'accès https://<compte>.r2.cloudflarestorage.com, région « auto ». */
export function createR2Storage(config: R2Config): Storage {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // Adresses en « chemin » (<point d'accès>/<bucket>/<clé>) : l'hôte reste celui du compte.
    forcePathStyle: true,
    // Les sommes de contrôle ajoutées par défaut aux versions récentes du SDK ne sont envoyées
    // que si l'opération l'exige (recommandation de Cloudflare pour R2).
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  return {
    async putObject(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: body.byteLength,
        }),
      );
    },

    getSignedReadUrl(key, { filename, contentType, signingDate }) {
      // Nom de fichier ASCII uniquement (recu-2026-0042.pdf) : pas d'échappement nécessaire.
      const safeName = filename.replace(/[^A-Za-z0-9._-]/g, '_');
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
          ResponseContentType: contentType,
          ResponseContentDisposition: `inline; filename="${safeName}"`,
        }),
        { expiresIn: SIGNED_URL_TTL_SECONDS, signingDate },
      );
    },

    async deleteObject(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}

let instance: Storage | undefined;

/** Stockage configuré par les variables R2_* (validées au démarrage par env.ts). */
export function getStorage(): Storage {
  if (instance) return instance;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    // Message sans valeur : seulement le fait que R2 n'est pas configuré.
    throw new Error('r2_not_configured');
  }
  instance = createR2Storage({
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
  });
  return instance;
}

/** Indique si R2 est configuré (tests d'intégration). */
export const isStorageConfigured = (): boolean =>
  Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET);

/** Remplace le stockage (tests : simulation d'une panne de R2). */
export function setStorageForTests(storage: Storage | undefined): void {
  instance = storage;
}
