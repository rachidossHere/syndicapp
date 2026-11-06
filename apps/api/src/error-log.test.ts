import { afterEach, describe, expect, it, vi } from 'vitest';

import { app } from './app';
import { describeError } from './error-log';

/** Erreur semblable à celles de Drizzle : requête SQL, paramètres (données personnelles) et code Postgres. */
class FakeDrizzleQueryError extends Error {
  override name = 'DrizzleQueryError';
  constructor() {
    super('Failed query: insert into "user" ("email", "name") values ($1, $2)\nparams: rachid@exemple.ma,Rachid Tazi', {
      cause: Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }),
    });
  }
}

// Route de test qui lève l'erreur : ajoutée à l'appli réelle pour passer par son onError.
app.post('/__test/boom', () => {
  throw new FakeDrizzleQueryError();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('journal des erreurs sans données sensibles', () => {
  it('describeError ne garde que le nom et le code (rangé dans cause par Drizzle)', () => {
    expect(describeError(new FakeDrizzleQueryError())).toEqual({ name: 'DrizzleQueryError', code: '23505' });
    expect(describeError(new TypeError('x'))).toEqual({ name: 'TypeError' });
    expect(describeError('texte')).toEqual({ name: 'string' });
  });

  it('500 : réponse { error, id } et journal sans SQL, paramètres ni corps de requête', async () => {
    const logged: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(' '));
    });

    const response = await app.request('/__test/boom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rachid@exemple.ma', password: 'Secret-123' }),
    });
    const body = (await response.json()) as { error: string; id: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe('internal_error');
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.keys(body).sort()).toEqual(['error', 'id']);

    const journal = logged.join('\n');
    expect(journal).toContain(body.id); // corrélation réponse ↔ journal
    expect(journal).toContain('DrizzleQueryError (code 23505)');
    for (const secret of ['insert into', 'params', 'rachid@exemple.ma', 'Rachid Tazi', 'Secret-123', 'duplicate key']) {
      expect(journal).not.toContain(secret);
    }
  });
});
