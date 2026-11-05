# 01 · Mise en place du projet

Statut : brouillon

## Objectif

Le dépôt contient un monorepo qui démarre : l'appli Expo s'ouvre sur un téléphone, l'API Hono répond sur une route de santé, et le package de base de données se connecte à la branche Neon `dev`.

## Décisions

- Gestionnaire de paquets : **pnpm** avec workspaces. Node 20 LTS minimum, version fixée dans `.nvmrc` et `engines`.
- Structure : `apps/mobile`, `apps/api`, `packages/db`, `packages/shared` (et `packages/ui` au plan 02).
- Préfixe des packages internes : `@syndic/` (`@syndic/db`, `@syndic/shared`).
- TypeScript **strict** partout, avec un `tsconfig.base.json` à la racine étendu par chaque package.
- Mobile : **Expo** (SDK stable le plus récent) avec **Expo Router**, créé avec `create-expo-app` et le modèle TypeScript.
- API : **Hono** sur Node avec `@hono/node-server`, lancé en développement avec `tsx watch`.
- Base de données : **Drizzle ORM** avec le pilote serverless de Neon (`@neondatabase/serverless`), `drizzle-kit` pour les migrations. Développement sur la branche Neon **`dev`** uniquement.
- Validation : **Zod** dans `packages/shared`.
- Qualité : ESLint et Prettier partagés, scripts `typecheck`, `lint` et `dev` à la racine.
- Variables d'environnement : `.env.local` (ignoré par git) et `.env.example` (versionné, sans valeurs).
- Fuseau d'affichage : `Africa/Casablanca`. Montants en centimes (entier), devise MAD.

## Hors périmètre

- Design system (plan 02) et authentification (plan 03).
- Tables métier : seule une table de test est autorisée, supprimée à la fin du plan.
- Déploiement, CI, builds EAS.

## Étapes

### 1. Créer le monorepo

Initialise un dépôt git avec pnpm workspaces (`pnpm-workspace.yaml` listant `apps/*` et `packages/*`), un `package.json` racine avec les scripts `dev`, `typecheck`, `lint` et `format`, un `tsconfig.base.json` strict, ESLint et Prettier partagés, `.nvmrc`, `.gitignore` (dont `.env*` sauf `.env.example`) et `AGENTS.md` à la racine.

Terminé quand : `pnpm install` et `pnpm typecheck` passent sur le dépôt vide.

### 2. Packages partagés

Crée `packages/shared` (Zod, exports depuis `src/index.ts`, avec un fichier `src/constants.ts` contenant la devise `MAD` et le fuseau `Africa/Casablanca`, et une fonction `formatMad(centimes)`). Crée `packages/db` avec Drizzle, le pilote Neon, un client exporté `db` qui lit `DATABASE_URL`, un dossier `src/schema/`, et `drizzle.config.ts`. Ajoute les scripts `db:generate`, `db:migrate` et `db:studio`.

Terminé quand : `formatMad(1842000)` renvoie `18 420 MAD`, et `pnpm typecheck` passe.

### 3. Connexion à Neon (branche `dev`)

Avec la CLI Neon, crée la branche `dev` du projet `wispy-silence-95275992` si elle n'existe pas, et place sa chaîne de connexion dans `.env.local` sans l'afficher. Si une connexion dans le navigateur est nécessaire, demande-moi de la terminer. Crée une table de test `healthcheck`, génère et applique la migration, insère et relis une ligne, puis supprime la table avec une nouvelle migration.

Terminé quand : les migrations s'appliquent sur `dev`, la lecture fonctionne, et la branche `production` n'a pas été modifiée.

### 4. API Hono

Crée `apps/api` avec Hono, `@hono/node-server`, le chargement des variables d'environnement, CORS configuré pour le développement, un gestionnaire d'erreurs global qui ne renvoie jamais de détails internes, et une route `GET /health` qui exécute `select 1` sur Neon et renvoie `{ status: "ok" }`.

Terminé quand : `pnpm --filter api dev` démarre et `GET /health` répond `200`.

### 5. Appli Expo

Crée `apps/mobile` avec `create-expo-app` (TypeScript, Expo Router), renomme l'appli « SyndicApp », définis le schéma `syndicapp` et l'identifiant `ma.syndicapp.app` dans `app.json`. Ajoute `@syndic/shared` aux dépendances et configure Metro pour le monorepo pnpm comme l'indique la documentation d'Expo. Crée un écran d'accueil temporaire qui appelle `GET /health` via `EXPO_PUBLIC_API_URL` et affiche le résultat.

Terminé quand : l'appli s'ouvre dans Expo Go sur un vrai téléphone et affiche « ok » venant de l'API.

## Vérification

- `pnpm install`, `pnpm typecheck` et `pnpm lint` passent à la racine.
- `pnpm dev` lance l'API et le serveur Expo.
- Sur le téléphone : l'écran affiche la réponse de `/health`.
- `git status` ne montre aucun fichier `.env.local` ; `.env.example` liste `DATABASE_URL` et `EXPO_PUBLIC_API_URL`.
- La table `healthcheck` n'existe plus, et aucune migration n'a touché `production`.

## Mises à jour d'[AGENTS.md](../AGENTS.md)

- **Section 5 · Structure du dépôt** : confirmer les chemins réels et le préfixe `@syndic/`.
- **Section 6 · Règles de code** : ajouter « Commandes : `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm --filter db db:generate` puis `db:migrate`. » et « Développement uniquement sur la branche Neon `dev`. »
