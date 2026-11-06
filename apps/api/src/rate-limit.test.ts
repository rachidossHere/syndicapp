import { describe, expect, it } from 'vitest';

import { createAttemptLimiter } from './rate-limit';

describe('createAttemptLimiter', () => {
  it('autorise 10 tentatives puis refuse la 11e', () => {
    let time = 0;
    const limiter = createAttemptLimiter({ max: 10, windowMs: 60_000, now: () => time });
    for (let i = 0; i < 10; i++) expect(limiter.hit('ip:1.2.3.4').allowed).toBe(true);
    const eleventh = limiter.hit('ip:1.2.3.4');
    expect(eleventh).toEqual({ allowed: false, retryAfter: 60 });
    // Une autre clé n'est pas touchée.
    expect(limiter.hit('ip:5.6.7.8').allowed).toBe(true);
    // La fenêtre suivante repart à zéro.
    time = 60_001;
    expect(limiter.hit('ip:1.2.3.4').allowed).toBe(true);
  });
});
