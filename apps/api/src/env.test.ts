import { describe, expect, it } from 'vitest';

import { parseEnv } from './env';

const SECRET = 'secret-de-test-uniquement-pour-vitest-0123456789';

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
    const env = parseEnv({ NODE_ENV: 'production', BETTER_AUTH_SECRET: SECRET, BETTER_AUTH_URL: 'https://api.syndicapp.ma' });
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
