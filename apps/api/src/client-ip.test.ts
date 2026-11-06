import { describe, expect, it } from 'vitest';

import { resolveClientIp } from './client-ip';

describe('resolveClientIp : IP du client pour la limitation des tentatives', () => {
  describe('en-tête de confiance configuré (derrière le proxy de l’hébergeur)', () => {
    it('prend la dernière adresse, celle ajoutée par le proxy', () => {
      expect(resolveClientIp({ trustedHeaderValue: '198.51.100.7, 203.0.113.9' })).toBe('203.0.113.9');
    });

    it('ignore une fausse adresse ajoutée en tête de liste par le client', () => {
      // Le client envoie « x-forwarded-for: 1.2.3.4 » ; le proxy ajoute la vraie adresse à la fin.
      expect(resolveClientIp({ trustedHeaderValue: '1.2.3.4, 10.0.0.5, 203.0.113.9' })).toBe('203.0.113.9');
    });

    it('accepte une seule adresse et ignore les espaces et les entrées vides', () => {
      expect(resolveClientIp({ trustedHeaderValue: '203.0.113.9' })).toBe('203.0.113.9');
      expect(resolveClientIp({ trustedHeaderValue: ' 1.2.3.4 , , 203.0.113.9 ,' })).toBe('203.0.113.9');
    });

    it('n’utilise jamais l’adresse de la connexion (celle du proxy)', () => {
      expect(resolveClientIp({ trustedHeaderValue: '203.0.113.9', socketAddress: '10.0.0.1' })).toBe('203.0.113.9');
    });

    it('sans en-tête dans la requête : aucune adresse (pas de repli sur le proxy)', () => {
      expect(resolveClientIp({ trustedHeaderValue: null, socketAddress: '10.0.0.1' })).toBeUndefined();
      expect(resolveClientIp({ trustedHeaderValue: '  ,  ' })).toBeUndefined();
    });
  });

  describe('en-tête de confiance non configuré (développement)', () => {
    it('utilise l’adresse de la connexion', () => {
      expect(resolveClientIp({ socketAddress: '192.168.1.20' })).toBe('192.168.1.20');
    });

    it('sans adresse lisible : aucune adresse, sans erreur', () => {
      expect(resolveClientIp({})).toBeUndefined();
      expect(resolveClientIp({ socketAddress: '' })).toBeUndefined();
    });
  });
});
