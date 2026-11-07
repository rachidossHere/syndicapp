# SyndicApp

Application mobile de gestion de copropriété pour le Maroc, pensée pour le syndic bénévole :
charges, dépenses avec factures, signalements et annonces, en français et en arabe.

## Fonctionnalités

| Fonctionnalité | État |
| --- | --- |
| Compte (inscription, connexion) | Fait |
| Résidences, appartements, invitations par code ou lien | Fait |
| Charges et encaissements, reçus PDF | À venir |
| Dépenses avec factures, solde de la caisse | À venir |
| Signalements | À venir |
| Annonces et notifications | À venir |
| Bureau du syndic et passation | À venir |
| Mode hors ligne pour le syndic | À venir |

## Stack

- **Mobile** : React Native avec Expo et Expo Router, TanStack Query, React Hook Form et Zod
- **Design system** : `@syndic/ui` (jetons, polices Plus Jakarta Sans et IBM Plex Sans Arabic, RTL)
- **API** : Hono sur Node.js
- **Base de données** : Neon (PostgreSQL) avec Drizzle ORM
- **Authentification** : Better Auth dans l'API, session stockée dans SecureStore sur le téléphone
- **Monorepo** : pnpm workspaces, TypeScript strict

## Structure

```
apps/
  mobile/     appli Expo
  api/        API Hono et Better Auth
packages/
  db/         schéma Drizzle et migrations
  shared/     schémas Zod, rôles et permissions, constantes
  ui/         design system
docs/         références visuelles (design-system.png, auth.png, residences.png)
.prompt/      plans de réalisation
```

## Prérequis

- Node.js 22.13 ou plus (version dans `.nvmrc`), pnpm
- Expo Go sur le téléphone
- Un projet Neon avec une branche `dev`
- Sous Windows : Visual C++ Redistributable x64 (nécessaire pour `pnpm lint`)

## Installation

```bash
pnpm install
cp .env.example .env.local
```

Crée aussi `apps/mobile/.env.local` : `pnpm ip` affiche la ligne `EXPO_PUBLIC_API_URL` à y mettre.

Remplis les variables :

| Variable | Fichier | Rôle |
| --- | --- | --- |
| `DATABASE_URL` | `.env.local` | Connexion à la branche Neon `dev` |
| `BETTER_AUTH_SECRET` | `.env.local` | Secret de Better Auth (32 caractères minimum, aléatoire) |
| `BETTER_AUTH_URL` | `.env.local` | URL de l'API |
| `NODE_ENV` | `.env.local` | `development` en local |
| `PORT` | `.env.local` | Port de l'API (3000 par défaut) |
| `CLIENT_IP_HEADER` | `.env.local` | Derrière un proxy de confiance uniquement ; vide en local |
| `EXPO_PUBLIC_API_URL` | `apps/mobile/.env.local` | URL de l'API vue par le téléphone (adresse IP locale du PC, pas `localhost`) |

Applique les migrations sur la branche `dev` :

```bash
pnpm --filter @syndic/db db:migrate
```

## Lancer en développement

```bash
pnpm dev                              # API
cd apps/mobile && npx expo start -c   # appli, à ouvrir dans Expo Go
```

Le téléphone et le PC doivent être sur le même réseau. Si l'adresse IP du PC change,
relance `pnpm ip`, mets à jour `EXPO_PUBLIC_API_URL` et relance Expo avec `-c`.

## Commandes utiles

| Commande | Rôle |
| --- | --- |
| `pnpm typecheck` | Vérifie les types de tous les packages |
| `pnpm test` | Lance tous les tests |
| `pnpm lint` | Lint |
| `pnpm format` | Formate le code avec Prettier |
| `pnpm ip` | Affiche l'adresse IP locale et l'URL de l'API pour le mobile |
| `pnpm --filter @syndic/db db:generate` | Génère une migration après un changement de schéma |
| `pnpm --filter @syndic/db db:migrate` | Applique les migrations |

## Façon de travailler

- Les règles du projet sont dans `AGENTS.md`.
- Chaque étape d'un plan (`.prompt/`) se fait sur sa propre branche `plan-NN/etape-X-titre`, créée depuis `master`.
- `master` est protégée : tout passe par une pull request.
- Développement uniquement sur la branche Neon `dev`. La branche `production` n'est jamais modifiée sans validation.

## Avancement

| Plan | État |
| --- | --- |
| 01 · Mise en place | Terminé |
| 02 · Design system | Terminé |
| 03 · Authentification | Terminé |
| 04 · Résidences et rôles | En vérification |
| 05 à 12 | À venir |
