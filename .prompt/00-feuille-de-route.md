# 00 · Feuille de route de SyndicApp

Chaque fichier de ce dossier est un plan à donner à l'agent, **dans l'ordre**, étape par étape. Un plan ne commence que lorsque le précédent est terminé et vérifié. À la fin de chaque plan, appliquer sa section « Mises à jour d'AGENTS.md ».

| N° | Plan | Ce qu'il apporte | Dépend de |
| --- | --- | --- | --- |
| 01 | [Mise en place du projet](01-mise-en-place.md) | Monorepo, Expo, Hono, Drizzle, Neon `dev`, outils | — |
| 02 | [Design system](02-design-system.md) | Jetons, polices FR/AR, composants `@syndic/ui` | 01 |
| 03 | [Authentification](03-authentification.md) | Neon Auth, connexion, API protégée | 01, 02 |
| 04 | [Résidences, lots et rôles](04-residences-roles.md) | Créer une résidence, inviter, rôles par résidence | 03 |
| 05 | [Charges et encaissements](05-charges-encaissements.md) | Appels de charges, paiements, reçus PDF, impayés | 04 |
| 06 | [Dépenses et caisse](06-depenses-caisse.md) | Dépenses avec facture, solde, comptes transparents | 05 |
| 07 | [Signalements](07-signalements.md) | Signaler un problème avec photo, suivi des statuts | 04 |
| 08 | [Annonces et notifications](08-annonces-notifications.md) | Annonces, notifications push, relances d'impayés | 05, 07 |
| 09 | [Bureau et passation](09-bureau-passation.md) | Trésorier, adjoint, passation au nouveau syndic | 04 à 08 |
| 10 | [Mode hors ligne](10-hors-ligne.md) | Encaisser et ajouter une dépense sans réseau | 05, 06 |
| 11 | [Analyse produit](11-analyse-posthog.md) | PostHog anonyme, feature flags | 04 à 10 |
| 12 | [Déploiement et pilote](12-deploiement-pilote.md) | Production, build Android, 2 ou 3 résidences test | tous |

**Fin du MVP** après le plan 12. Les idées suivantes (paiement en ligne, votes d'AG, SMS, espace web syndic) feront l'objet de nouveaux plans à partir de 13, seulement après les retours des résidences pilotes.

## Comment donner un plan à l'agent

```
Lis AGENTS.md puis .prompt/NN-nom.md.
Réalise uniquement l'étape X. Respecte les Décisions et le Hors périmètre.
Quand l'étape est terminée, montre-moi ce qui prouve qu'elle respecte « Terminé quand », puis arrête-toi.
```

Après la dernière étape :

```
Exécute la section Vérification de .prompt/NN-nom.md et donne-moi le résultat point par point.
Ensuite, propose les modifications d'AGENTS.md listées à la fin du plan, sans les appliquer.
```
