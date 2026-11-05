# 03 · Authentification (Neon Auth)

Statut : brouillon

## Objectif

Un utilisateur peut créer un compte avec son e-mail et un mot de passe, se connecter depuis l'appli mobile, rester connecté après avoir fermé l'appli, et se déconnecter. Les routes de l'API Hono refusent toute requête sans jeton Neon Auth valide.

## Décisions

- Fournisseur : **Neon Auth** (Better Auth géré par Neon), avec le SDK de Neon (`@neon/neon-js/auth` ou `@neon/auth`, selon ce qu'indique le skill). Pas de Better Auth auto-hébergé dans l'API.
- Avant d'écrire du code, lire le skill neon-auth (https://neon.com/docs/ai/skills/neon-auth/SKILL.md) et le suivre. En cas de doute sur une commande ou une API, le skill et la documentation officielle de Neon l'emportent sur ce plan.
- Le support de React Native / Expo n'est pas documenté par Neon : l'étape 1 est un **test de faisabilité** avec une décision « on continue / on arrête ». Aucune autre étape ne commence avant qu'il soit validé.
- Méthode de connexion du MVP : **e-mail + mot de passe uniquement**.
- Hachage des mots de passe : géré par Neon. **bcrypt n'est plus utilisé** dans le projet.
- Les utilisateurs et les sessions vivent dans le schéma `neon_auth` de la base. Ce schéma appartient à Neon : **aucune migration Drizzle ne le crée ni ne le modifie**. Nos tables y font référence par l'identifiant de l'utilisateur (`text`).
- Plugins : la liste de Neon Auth est fixe et se configure via la console ou la CLI Neon, jamais dans le code du client.
- Branches : tout le développement se fait sur une branche Neon **`dev`**. Chaque branche a sa propre URL d'auth et ses propres utilisateurs. La branche `production` n'est touchée qu'au déploiement.
- API Hono : elle vérifie le **JWT** émis par Neon Auth avec la bibliothèque `jose`, contre les clés publiques de `NEON_AUTH_JWKS_URL`, et vérifie l'émetteur (dérivé de `NEON_AUTH_BASE_URL`). Le JWT expire après 15 minutes : l'appli récupère un jeton frais avant chaque appel, et l'API ne le met jamais en cache.
- Mobile : la session est conservée de façon sécurisée (SecureStore si le SDK permet de choisir le stockage). Jamais d'AsyncStorage pour un jeton.
- Navigation : Expo Router avec les groupes `(auth)` (connexion, inscription) et `(app)` (écrans protégés).
- Vérification de l'e-mail et mot de passe oublié : Neon envoie les e-mails sans service à configurer en développement (SMTP partagé). Ils restent **hors périmètre** de ce plan, mais deviennent faciles à ajouter. La production demandera un SMTP personnalisé.
- Messages d'erreur génériques côté client (« E-mail ou mot de passe incorrect »).
- Interface construite uniquement avec `@syndic/ui` (plan 02), textes via les traductions FR et AR.
- Secrets et URL (`NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `DATABASE_URL`…) uniquement dans les variables d'environnement, documentés dans `.env.example`. Ne jamais afficher de secret dans le terminal ni dans les logs.

## Hors périmètre

- Résidences, table `membership`, rôles et invitations : plan suivant (gérés dans nos propres tables, pas avec les organisations de Neon Auth, encore en bêta et sans rôles personnalisés).
- Connexion sociale (Google, Apple), téléphone ou SMS.
- Vérification de l'e-mail, mot de passe oublié, double authentification.
- Modification du profil.
- Tableau de bord web.

## Étapes

### 1. Test de faisabilité : Neon Auth dans Expo Go

Installe la CLI Neon (`npm install -g neon@latest`, ou `npx neon@latest` si l'installation échoue). Si une commande ouvre une connexion dans le navigateur, demande-moi de la terminer ; si elle échoue, demande-moi de lancer `neon login`, puis réessaie. Crée une branche **`dev`** sur le projet `wispy-silence-95275992`, lie le dépôt à cette branche avec `neon init` (services `postgres,auth`), puis active Neon Auth sur `dev` (`neon deploy` ou la commande indiquée par le skill). Les variables doivent arriver dans `.env.local` sans être affichées.

Ensuite, dans `apps/mobile`, installe le SDK de Neon Auth et crée un écran temporaire `/dev/auth-test` qui :
1. inscrit un utilisateur de test (e-mail jetable, mot de passe fort) ;
2. lit l'utilisateur courant ;
3. récupère un JWT ;
4. survit à une fermeture complète de l'appli (l'utilisateur est toujours connecté à la réouverture) ;
5. se déconnecte.

Ajoute l'URL du serveur Expo et le schéma de l'appli aux domaines de confiance de Neon Auth si le skill l'exige.

Terminé quand : les 5 points fonctionnent sur un vrai téléphone dans Expo Go, et tu m'as indiqué comment la session est stockée (cookie, jeton, quel stockage). **Si un point échoue**, arrête-toi et explique-moi précisément ce qui bloque, sans contourner le problème : je déciderai de revenir à Better Auth auto-hébergé.

### 2. Client d'authentification de l'appli

Supprime l'écran de test. Crée `apps/mobile/src/lib/auth-client.ts` qui configure le client Neon Auth avec l'URL lue depuis une variable `EXPO_PUBLIC_NEON_AUTH_URL`, et le stockage sécurisé retenu à l'étape 1. Crée un fournisseur ou un hook `useSession` qui expose l'utilisateur, l'état de chargement, `signIn`, `signUp`, `signOut`, et une fonction `getToken()` qui renvoie un JWT valide. Crée `apps/mobile/src/lib/api.ts`, un client HTTP vers l'API Hono qui ajoute automatiquement `Authorization: Bearer <jeton>` à chaque requête.

Terminé quand : `pnpm typecheck` passe et l'appli peut s'inscrire, se connecter, récupérer un jeton et se déconnecter via ces fonctions.

### 3. Vérification du jeton dans Hono

Dans `apps/api`, installe `jose`. Crée un middleware `requireAuth` qui lit l'en-tête `Authorization`, vérifie le JWT avec `createRemoteJWKSet(NEON_AUTH_JWKS_URL)` (algorithme EdDSA, émetteur attendu, expiration), renvoie `401` si le jeton est absent, invalide ou expiré, et place `userId` (le `sub` du jeton) dans le contexte Hono, typé. Ajoute une route protégée `GET /api/me` qui lit le nom et l'e-mail de l'utilisateur dans le schéma `neon_auth` (vérifie le nom exact de la table avec le skill ou la base) et ne renvoie que `id`, `name` et `email`. Pour lire ce schéma avec Drizzle, déclare la table en lecture seule dans `packages/db/src/schema/neon-auth.ts`, exclue des migrations (`schemaFilter` ou `tablesFilter` de drizzle-kit). Ajoute les variables à `.env.example`.

Terminé quand : `GET /api/me` renvoie l'utilisateur avec un jeton valide, et `401` sans jeton, avec un jeton modifié ou avec un jeton expiré. `drizzle-kit generate` ne produit aucune migration touchant `neon_auth`.

### 4. Validation partagée

Dans `packages/shared`, crée `src/auth.ts` avec `signUpSchema` (nom, e-mail, mot de passe, confirmation) et `signInSchema` (e-mail, mot de passe). Mot de passe : 8 caractères minimum (aligne la longueur maximale sur la règle de Neon Auth indiquée par le skill). Les messages d'erreur sont des clés de traduction.

Terminé quand : les formulaires refusent les entrées invalides avant tout appel à Neon.

### 5. Écrans et navigation protégée

Avec Expo Router, crée le groupe `(auth)` avec `sign-in` et `sign-up`, et le groupe `(app)` avec un accueil provisoire qui affiche « Bonjour {nom} » (données de `/api/me` via `api.ts`) et un bouton de déconnexion. Le layout racine affiche un écran de chargement tant que la session est inconnue, puis redirige vers `(auth)` ou `(app)`. Formulaires avec React Hook Form et les schémas de `packages/shared`, uniquement avec les composants de `@syndic/ui`. Le bouton de validation affiche un état de chargement et empêche le double envoi. Les erreurs de Neon Auth s'affichent sous forme de message générique traduit.

Terminé quand : un nouvel utilisateur s'inscrit et arrive sur l'accueil ; après fermeture et réouverture de l'appli, il est toujours connecté ; après déconnexion, il revient à la connexion et ne peut pas revenir à l'accueil.

## Vérification

- `pnpm typecheck` et le linter passent sur tout le monorepo.
- Le test de faisabilité de l'étape 1 a été validé sur un vrai téléphone, et son résultat est noté.
- Tout le travail a été fait sur la branche Neon `dev` ; la branche `production` n'a pas été modifiée.
- API : `GET /api/me` sans jeton → `401` ; jeton modifié → `401` ; jeton de plus de 15 minutes → `401` ; jeton valide → uniquement `id`, `name`, `email`.
- Après 15 minutes d'inactivité dans l'appli, l'appel à `/api/me` fonctionne toujours (jeton renouvelé automatiquement).
- Mauvais mot de passe et e-mail inconnu affichent le même message générique.
- Aucune migration Drizzle ne touche le schéma `neon_auth`.
- Aucun jeton dans AsyncStorage ; aucun secret ni jeton dans les logs ou dans le dépôt.
- Les écrans s'affichent correctement en français et en arabe (RTL).
- De bout en bout : inscription → accueil avec le nom → fermeture complète de l'appli → réouverture toujours connecté → attente de plus de 15 minutes → accueil toujours chargé → déconnexion → connexion avec le même compte → accueil.

## Mises à jour d'[AGENTS.md](../AGENTS.md)

- **Section 4 · Stack technique** : la ligne « Authentification : Better Auth avec hachage bcryptjs » est remplacée par « Authentification : Neon Auth (Better Auth géré par Neon), SDK de Neon côté mobile, vérification des JWT avec `jose` côté API ». Retirer bcryptjs de la stack.
- **Section 5 · Structure du dépôt** : ajouter `packages/db/src/schema/neon-auth.ts → tables du schéma neon_auth, en lecture seule, exclues des migrations`.
- **Section 6 · Règles de code, partie Base de données** : ajouter « Le schéma `neon_auth` appartient à Neon : ne jamais le modifier ni le migrer. Nos tables référencent l'utilisateur par son identifiant (`text`). »
- **Section 6 · Règles de code, partie API** : ajouter « Toute route métier passe par `requireAuth`, qui vérifie le JWT Neon Auth via JWKS ; seule la route de santé est publique. »
- **Section 6 · Règles de code** : ajouter « Développement uniquement sur la branche Neon `dev` ; ne jamais lancer de commande Neon sur `production` sans validation. »
- **Section 7 · Sécurité, partie Mots de passe** : les règles sur bcryptjs (coût 12, limite de 72 octets, hachage côté serveur) sont remplacées par « Les mots de passe sont gérés uniquement par Neon Auth : jamais stockés, hachés ni journalisés par notre code. »
- **Section 9 · Ce que l'agent ne doit jamais faire** : ajouter « Modifier le schéma `neon_auth` » et « Mettre en cache un JWT côté API ou le stocker dans AsyncStorage ».
