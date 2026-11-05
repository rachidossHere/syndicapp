# 12 · Déploiement et pilote

Statut : brouillon

## Objectif

L'API tourne en production, l'appli Android s'installe depuis le Play Store en test fermé, et 2 ou 3 résidences pilotes l'utilisent pendant un mois avec un moyen simple de remonter les problèmes.

## Décisions

- Base : branche Neon **`production`**. Les migrations y sont appliquées uniquement par la procédure de déploiement, après validation sur `dev`.
- Auth : Neon Auth activé sur `production`, avec ses propres domaines de confiance et un **SMTP personnalisé** si la vérification d'e-mail est activée.
- API : hébergée sur **Render** (ou Railway), région la plus proche du Maroc disponible (Europe). Variables d'environnement saisies dans l'hébergeur, jamais dans le dépôt.
- Stockage : bucket R2 de production séparé de celui de développement.
- Mobile : builds avec **EAS Build**, profils `development`, `preview` et `production`. Android d'abord, distribution en **test fermé** sur Google Play. iOS plus tard.
- Mises à jour rapides : **EAS Update** pour corriger le JavaScript sans nouveau build, sur un canal `production`.
- Suivi des erreurs : **Sentry** (offre gratuite) dans l'appli et l'API, sans données personnelles (`sendDefaultPii: false`).
- Intégration continue : GitHub Actions qui lance `pnpm typecheck`, `pnpm lint` et les tests à chaque pull request.
- Retours des pilotes : bouton « Signaler un problème avec l'appli » dans les réglages (formulaire simple envoyé à l'API, distinct des signalements de la résidence).
- Mentions légales : page de politique de confidentialité (exigée par Google Play), qui mentionne la loi 09-08, les données collectées et leur usage.

## Hors périmètre

- Publication publique sur les stores et sur l'App Store d'Apple.
- Nom de domaine et site vitrine.
- Monitoring avancé, sauvegardes personnalisées au-delà de ce que propose Neon.

## Étapes

### 1. Intégration continue

Ajoute le workflow GitHub Actions (installation pnpm avec cache, typecheck, lint, tests) sur les pull requests et la branche principale.

Terminé quand : une pull request avec une erreur de typage est bloquée.

### 2. Production : base, auth, stockage, API

Prépare la branche Neon `production` (migrations appliquées, Neon Auth activé), le bucket R2 de production, et déploie l'API sur Render avec toutes les variables. Ajoute Sentry à l'API. Rédige `docs/deploiement.md` avec la procédure complète (y compris l'application des migrations et le retour arrière).

Terminé quand : `GET /health` répond en production, et `docs/deploiement.md` permet de redéployer sans aide.

### 3. Builds mobiles

Configure `eas.json` (profils, variables par profil, canal EAS Update), l'icône et l'écran de démarrage, Sentry dans l'appli, et le bouton de retour des pilotes. Produis un build `preview` Android à installer directement, puis un build `production` envoyé en test fermé sur Google Play.

Terminé quand : l'appli de production s'installe depuis le lien de test fermé et se connecte à l'API de production.

### 4. Lancement du pilote

Rédige `docs/pilote.md` : liste des résidences pilotes, contact de chaque syndic, guide de démarrage en une page (FR et AR) pour le syndic, liste des indicateurs à suivre dans PostHog, et rendez-vous de bilan à 2 et 4 semaines. Active les feature flags des résidences pilotes.

Terminé quand : le guide est prêt et la première résidence pilote est créée par son syndic.

## Vérification

- La CI passe sur la branche principale.
- Aucune donnée de développement en production ; aucun secret dans le dépôt (`git log -p` sur les noms de variables).
- Une erreur volontaire apparaît dans Sentry sans nom ni e-mail.
- Une correction publiée via EAS Update arrive sur un téléphone sans nouveau build.
- La politique de confidentialité est accessible depuis l'appli et la fiche Play Store.
- De bout en bout, en production, sur un téléphone neuf : installation depuis Google Play → inscription → création de la résidence → invitation d'un voisin → appel de charges → encaissement → dépense avec facture → signalement → annonce reçue en notification → retour envoyé par le bouton « Signaler un problème avec l'appli ».

## Mises à jour d'[AGENTS.md](../AGENTS.md)

- **Section 4 · Stack technique** : ajouter EAS Build et Update, Sentry, GitHub Actions, Render.
- **Section 6 · Règles de code** : ajouter « Les migrations ne sont appliquées sur `production` que via la procédure de `docs/deploiement.md`. »
- **Section 9 · Ce que l'agent ne doit jamais faire** : ajouter « Déployer, publier une mise à jour EAS sur le canal `production` ou modifier la branche Neon `production` sans validation explicite. »
