import { describe, expect, it } from 'vitest';

import { inResidence } from './residence-header';

describe('inResidence', () => {
  it('fixe X-Residence-Id et garde méthode, corps et autres en-têtes', () => {
    const init = inResidence('res-A', { method: 'POST', body: '{}', headers: { 'X-Autre': '1' } });
    const headers = new Headers(init.headers);
    expect(headers.get('X-Residence-Id')).toBe('res-A');
    expect(headers.get('X-Autre')).toBe('1');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{}');
  });

  it('remplace une résidence déjà présente dans les en-têtes', () => {
    const init = inResidence('res-A', { headers: { 'X-Residence-Id': 'res-B' } });
    expect(new Headers(init.headers).get('X-Residence-Id')).toBe('res-A');
  });

  it('sans résidence, les options sont renvoyées telles quelles', () => {
    const options = { method: 'GET' };
    expect(inResidence(undefined, options)).toBe(options);
    expect(inResidence(undefined)).toEqual({});
  });
});
