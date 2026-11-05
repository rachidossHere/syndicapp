# 03 · Authentification (Better Auth dans l'API)

Statut : brouillon

## Objectif

Un utilisateur peut créer un compte avec son e-mail et un mot de passe, se connecter depuis l'appli mobile, rester connecté après avoir fermé l'appli, et se déconnecter. Les routes de l'API Hono refusent toute requête sans session valide.

## Décisions

- **Pourquoi ce choix** : le test de faisabilité de Neon Auth (version précédente de ce plan) a échoué. Neon Auth refuse les requêtes sans en-tête `Origin` (cas d'une appli React Native) et son SDK n'autorise ni le plugin Expo ni le stockage de la session dans SecureStore. On revient donc à **Better Auth hébergé dans l'API Hono**, avec le plugin officiel **`@better-auth/expo`**. Neon reste la base de données.
- Avant d'écrire du code : lire le skill Better Auth s'il est installé, et la page « Expo Integration » de la documentation officielle de Better Auth. En cas de doute sur une API, la documentation officielle l'emporte sur ce plan.
- Méthode de connexion du MVP : **e-mail + mot de passe uniquement**.
- Hachage des mots de passe : **bcryptjs**, coût **12**, via l'option `emailAndPassword.password` (`hash` / `verify`) de Better Auth. Jamais le module natif `bcrypt`.
- Mot de passe : 8 caractères minimum, **72 octets maximum** (limite de bcrypt), validé par Zod.
- Tables : `user`, `session`, `account`, `verification` dans le schéma `public`, **générées par la CLI de Better Auth au format Drizzle** dans `packages/db/src/schema/auth.ts`, puis migrées avec `drizzle-kit`. Le dépôt est propriétaire de ces tables.
- Les tables `public.user`, `session`, `account`, `verification` déjà présentes sur Neon viennent d'un essai extérieur au dépôt et sont vides : elles sont supprimées **sur `dev` uniquement** (étape 1), puis recréées par notre migration. Celles de `production` seront traitées au plan 12.
- Neon Auth, activé sur `dev` pendant le test, est **désactivé** et ses variables retirées.
- API : Better Auth monté dans Hono sur **`/api/auth/*`**, avec le plugin serveur `expo()`. Un middleware `requireAuth` lit la session avec `auth.api.getSession({ headers })` et place `user` et `session` dans le contexte. Pas de JWT : l'API lit directement la session.
- `trustedOrigins` : le schéma de l'appli `syndicapp://` toujours ; les origines `exp://` de développement (Expo Go) **uniquement quand `NODE_ENV === "development"`**.
- Mobile : client `createAuthClient` de `better-auth/react` avec `expoClient` de `@better-auth/expo/client`, `scheme: "syndicapp"` et **`storage: SecureStore`**. Paquets client : `better-auth`, `@better-auth/expo`, `expo-secure-store`, `expo-network`.
- Appels à notre API : le client HTTP ajoute l'en-tête `Cookie` obtenu avec `authClient.getCookie()`, avec `credentials: "omit"`.
- Navigation : Expo Router avec les groupes `(auth)` (accueil, connexion, inscription) et `(app)` (écrans protégés).
- **Design** : celui de `docs/auth.png` : écran d'accueil, inscription, connexion, puis écran « Bonjour {prénom} » avec les deux choix « Créer ma résidence » et « J'ai un code d'invitation » (boutons sans action pour l'instant : plan 04). Uniquement les composants de `@syndic/ui`.
- Vérification de l'e-mail et mot de passe oublié : désactivés (pas encore de service d'envoi d'e-mails).
- Limitation des tentatives : rate limit intégré de Better Auth activé sur la connexion et l'inscription.
- Messages d'erreur génériques (« E-mail ou mot de passe incorrect »), sans révéler si un e-mail existe.
- Secrets : `BETTER_AUTH_SECRET` et `BETTER_AUTH_URL` uniquement dans `.env.local` et dans `.env.example` (sans valeur).

## Hors périmètre

- Résidences, rôles, invitations (plan 04) : les deux boutons de l'écran « Bonjour » ne font rien.
- Connexion sociale, téléphone, SMS, lien magique.
- Vérification de l'e-mail, mot de passe oublié, double authentification.
- Modification du profil.
- Tables de `production` (plan 12).

## Étapes

### 1. Nettoyage de l'essai Neon Auth sur `dev`

Sur la branche Neon `dev` uniquement (projet `wispy-silence-95275992`) :
1. supprime l'utilisateur de test `syndicapp-probe-…@example.com` créé pendant le diagnostic ;
2. désactive Neon Auth avec la CLI Neon (ou indique-moi la manipulation à faire dans la console si la CLI ne le permet pas) ;
3. retire `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL` du `.env.local` racine et `EXPO_PUBLIC_NEON_AUTH_URL` de `apps/mobile/.env.local` ;
4. vérifie que les tables `public.user`, `session`, `account`, `verification` sont toujours vides, puis supprime-les sur `dev` (suppression autorisée ici, uniquement pour ces quatre tables vides et uniquement sur `dev`).

Aucune commande sur `production`.

Terminé quand : Neon Auth n'est plus actif sur `dev`, le schéma `public` de `dev` ne contient plus ces quatre tables, les variables Neon Auth ont disparu, et `production` n'a pas été touchée.

### 2. Better Auth côté serveur et schéma

Dans `apps/api`, installe `better-auth`, `@better-auth/expo` et `bcryptjs` (avec ses types). Crée `apps/api/src/auth.ts` : adaptateur Drizzle (`provider: "pg"`) branché sur `@syndic/db`, `emailAndPassword` activé avec `hash` / `verify` basés sur bcryptjs (coût 12), plugin `expo()`, `trustedOrigins` comme décrit dans les Décisions, rate limit activé. Génère le schéma Drizzle des tables avec la CLI de Better Auth, place-le dans `packages/db/src/schema/auth.ts`, exporte-le, puis génère et applique la migration sur `dev`. Ajoute `BETTER_AUTH_SECRET` et `BETTER_AUTH_URL` à `.env.example` et, avec une valeur générée, à `.env.local`.

Terminé quand : les tables existent sur `dev` via notre migration, l'API démarre, et `pnpm typecheck` passe.

### 3. Brancher Better Auth dans Hono

Monte le handler de Better Auth sur `/api/auth/*`. Crée le middleware `requireAuth` (session lue avec `auth.api.getSession({ headers: c.req.raw.headers })`, `401` sans session, `user` et `session` typés dans le contexte Hono). Ajoute `GET /api/me` qui renvoie uniquement `id`, `name` et `email`. Vérifie que le logger maison n'écrit jamais les en-têtes `Cookie` et `Authorization`.

Terminé quand : avec un client HTTP, l'inscription et la connexion fonctionnent, `GET /api/me` renvoie l'utilisateur avec le cookie de session et `401` sans.

### 4. Validation partagée

Dans `packages/shared`, crée `src/auth.ts` avec `signUpSchema` (nom, e-mail, mot de passe, confirmation) et `signInSchema`. Mot de passe : 8 caractères minimum, 72 octets maximum en UTF-8 (pas en caractères). Messages d'erreur = clés de traduction. L'API valide l'inscription avec `signUpSchema` avant Better Auth (hook `before` ou validation de route, selon la documentation). Tests unitaires, dont un mot de passe de 72 et de 73 octets avec des caractères arabes.

Terminé quand : un mot de passe trop court ou de plus de 72 octets est refusé par l'appli et par l'API.

### 5. Client d'authentification dans l'appli

Dans `apps/mobile`, installe avec `npx expo install` : `better-auth`, `@better-auth/expo`, `expo-network` (et `expo-secure-store` est déjà là). Crée `src/lib/auth-client.ts` avec `createAuthClient` (`better-auth/react`), `baseURL` = URL de l'API + `/api/auth` lue depuis `EXPO_PUBLIC_API_URL`, et `expoClient({ scheme: "syndicapp", storage: SecureStore })`. Crée un hook `useSession` (utilisateur, chargement, `signIn`, `signUp`, `signOut`) et `src/lib/api.ts` qui ajoute l'en-tête `Cookie` de `authClient.getCookie()` à chaque appel, avec `credentials: "omit"`. Ne touche pas à la config Metro sauf si la documentation l'exige (ne jamais désactiver `unstable_enablePackageExports`).

Terminé quand : depuis un écran de développement, l'appli peut s'inscrire, se connecter, appeler `/api/me` et se déconnecter dans Expo Go.

### 6. Écrans et navigation protégée

Reproduis le design de `docs/auth.png` avec `@syndic/ui` : groupe `(auth)` avec l'accueil, `sign-in` et `sign-up` ; groupe `(app)` avec l'écran « Bonjour {prénom} » (données de `/api/me`), les deux choix sans action et « Se déconnecter ». Le layout racine affiche un chargement tant que la session est inconnue, puis redirige. Formulaires avec React Hook Form et les schémas de `packages/shared`. Bouton de validation en chargement et sans double envoi. Afficher / masquer le mot de passe. Textes en FR et AR, e-mail toujours saisi de gauche à droite. Supprime l'écran temporaire de santé de l'API s'il ne sert plus (garde `/dev/design-system`).

Terminé quand : un nouvel utilisateur s'inscrit et arrive sur « Bonjour » ; après fermeture complète de l'appli, il est toujours connecté ; après déconnexion, il revient à l'accueil et ne peut pas revenir en arrière.

## Vérification

- `pnpm typecheck`, `pnpm test` et `pnpm lint` passent.
- En base (`dev`) : le mot de passe dans `account` commence par `$2a$12$` ou `$2b$12$`. Aucun mot de passe en clair, ni en base ni dans les logs.
- `GET /api/me` sans session → `401` ; avec session → uniquement `id`, `name`, `email`.
- Mauvais mot de passe et e-mail inconnu → même message générique.
- Plusieurs échecs de connexion d'affilée → `429`.
- Mots de passe de 7 caractères, 72 octets et 73 octets : seuls les cas valides sont acceptés.
- La session est dans SecureStore, jamais dans AsyncStorage ; aucun cookie ni jeton dans les logs.
- Les origines `exp://` ne sont acceptées qu'en développement.
- Écrans corrects en français et en arabe, conformes à `docs/auth.png`.
- `production` n'a pas été modifiée.
- De bout en bout dans Expo Go : inscription → « Bonjour » → fermeture complète → réouverture toujours connecté → déconnexion → connexion avec le même compte → « Bonjour ».

## Mises à jour d'[AGENTS.md](../AGENTS.md)

- **Section 4 · Stack technique** : « Authentification : Better Auth hébergé dans l'API Hono (adaptateur Drizzle, plugin `@better-auth/expo`), bcryptjs coût 12, session dans SecureStore côté mobile ». Retirer `jose`. Dans « Explicitement écartés », remplacer la ligne « Better Auth auto-hébergé et bcrypt » par « Neon Auth : refuse les requêtes sans `Origin` et n'autorise ni le plugin Expo ni SecureStore (test du 5 novembre 2026) ».
- **Section 5 · Skills** : retirer `neon-auth` et `neon-postgres-branches` (disparu) ; remplacer `native-data-fetching` par `expo-data-fetching` ; ajouter le skill Better Auth s'il est installé.
- **Section 6 · Structure** : remplacer la ligne `neon-auth.ts` par `src/schema/auth.ts → tables Better Auth, générées par sa CLI, ne pas modifier à la main` ; ajouter `apps/api/src/auth.ts → configuration Better Auth (seul endroit)`.
- **Section 7 · Base de données** : remplacer la règle sur `neon_auth` par « Les tables d'authentification sont générées par la CLI de Better Auth ; nos tables référencent `user.id` ».
- **Section 7 · API** : `requireAuth` lit la session Better Auth (`auth.api.getSession`) ; seules `/health` et `/api/auth/*` sont publiques ; retirer la règle sur le cache des JWT.
- **Section 7 · Mobile** : « La session est gérée uniquement par le client Better Auth avec `expoClient` et SecureStore ; les appels à l'API passent par `src/lib/api.ts`. »
- **Section 8 · Authentification** : « Mots de passe hachés par bcryptjs (coût 12) uniquement dans l'API ; 72 octets maximum ; jamais journalisés. »
- **Section 9 · Limites** : retirer la ligne Neon Auth.
- **Section 10** : remplacer « Modifier le schéma `neon_auth` » par « Modifier à la main les tables générées par Better Auth » ; ajouter « Accepter les origines `exp://` hors développement ».