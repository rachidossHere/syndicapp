import { describe, expect, it } from 'vitest';

import { profileEntries, versionLabel } from './profile';

describe('onglet Profil', () => {
  it('la galerie visuelle n’existe pas hors __DEV__', () => {
    expect(profileEntries({ isDev: false, residenceCount: 1 })).not.toContain('gallery');
    expect(profileEntries({ isDev: false, residenceCount: 3 })).not.toContain('gallery');
  });

  it('la galerie visuelle existe en développement', () => {
    expect(profileEntries({ isDev: true, residenceCount: 1 })).toContain('gallery');
  });

  it('« Changer de résidence » n’existe que s’il y a plusieurs résidences', () => {
    expect(profileEntries({ isDev: false, residenceCount: 0 })).not.toContain('switchResidence');
    expect(profileEntries({ isDev: false, residenceCount: 1 })).not.toContain('switchResidence');
    expect(profileEntries({ isDev: false, residenceCount: 2 })).toContain('switchResidence');
  });

  it('notifications, langue, déconnexion et version sont toujours là, même sans résidence', () => {
    for (const residenceCount of [0, 1, 4]) {
      const entries = profileEntries({ isDev: false, residenceCount });
      for (const entry of ['notifications', 'language', 'signOut', 'version'] as const) expect(entries).toContain(entry);
    }
  });

  it('ordre : résidence, notifications, langue, déconnexion, version', () => {
    expect(profileEntries({ isDev: false, residenceCount: 1 })).toEqual([
      'residence',
      'notifications',
      'language',
      'signOut',
      'version',
    ]);
  });

  it('version : celle de l’appli, ou un tiret si elle est inconnue', () => {
    expect(versionLabel('1.0.0')).toBe('1.0.0');
    expect(versionLabel(' 2.3.1 ')).toBe('2.3.1');
    expect(versionLabel(undefined)).toBe('—');
    expect(versionLabel(null)).toBe('—');
    expect(versionLabel('  ')).toBe('—');
  });
});
