import { describe, expect, it } from 'vitest';

import { parseEnv } from './env';

const SECRET = 'secret-de-test-uniquement-pour-vitest-0123456789';
// Valeurs factices au bon format (aucune vraie clé).
const R2 = {
  R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
  R2_ACCESS_KEY_ID: 'cle-factice-0123456789',
  R2_SECRET_ACCESS_KEY: 'secret-factice-0123456789abcdef0123456789',
  R2_BUCKET: 'syndicapp-test',
};

describe('parseEnv : HTTPS obligatoire en production', () => {
  it('refuse de démarrer en production avec une URL en http://, avec un message clair', () => {
    expect(() =>
      parseEnv({ NODE_ENV: 'production', BETTER_AUTH_SECRET: SECRET, BETTER_AUTH_URL: 'http://api.syndicapp.ma' }),
    ).toThrow(/BETTER_AUTH_URL doit commencer par https:\/\/ en production/);
  });

  it('refuse aussi la production implicite (NODE_ENV absent) en http://', () => {
    expect(() => parseEnv({ BETTER_AUTH_SECRET: SECRET, BETTER_AUTH_URL: 'http://api.syndicapp.ma' })).toThrow(
      /https:\/\//,
    );
  });

  it('accepte la production en https://', () => {
    const env = parseEnv({ NODE_ENV: 'production', BETTER_AUTH_SECRET: SECRET, BETTER_AUTH_URL: 'https://api.syndicapp.ma', ...R2 });
    expect(env.NODE_ENV).toBe('production');
  });

  it.each(['development', 'test'])('accepte http:// en %s', (NODE_ENV) => {
    expect(parseEnv({ NODE_ENV, BETTER_AUTH_SECRET: SECRET, BETTER_AUTH_URL: 'http://localhost:3000' }).NODE_ENV).toBe(
      NODE_ENV,
    );
  });

  it('n’affiche jamais la valeur d’une variable dans le message d’erreur', () => {
    try {
      parseEnv({ NODE_ENV: 'production', BETTER_AUTH_SECRET: 'trop-court', BETTER_AUTH_URL: 'http://api.syndicapp.ma' });
      expect.unreachable();
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('BETTER_AUTH_SECRET');
      expect(message).not.toContain('trop-court');
    }
  });
});

describe('parseEnv : Cloudflare R2', () => {
  const base = { BETTER_AUTH_SECRET: SECRET, BETTER_AUTH_URL: 'http://localhost:3000' };

  it('obligatoire en production', () => {
    expect(() =>
      parseEnv({ ...base, NODE_ENV: 'production', BETTER_AUTH_URL: 'https://api.syndicapp.ma' }),
    ).toThrow(/R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET/);
  });

  it('facultatif en développement et en test, mais tout ou rien', () => {
    expect(parseEnv({ ...base, NODE_ENV: 'test' }).R2_BUCKET).toBeUndefined();
    expect(parseEnv({ ...base, NODE_ENV: 'development', ...R2 }).R2_BUCKET).toBe('syndicapp-test');
    expect(() => parseEnv({ ...base, NODE_ENV: 'test', R2_BUCKET: 'syndicapp-test' })).toThrow(
      /R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY/,
    );
  });

  it('format invalide : le nom de la variable, jamais sa valeur', () => {
    try {
      parseEnv({ ...base, NODE_ENV: 'test', ...R2, R2_ACCOUNT_ID: 'pas-un-identifiant' });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toContain('R2_ACCOUNT_ID');
      expect((error as Error).message).not.toContain('pas-un-identifiant');
      expect((error as Error).message).not.toContain(R2.R2_SECRET_ACCESS_KEY);
    }
  });
});
