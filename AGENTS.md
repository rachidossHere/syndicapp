# AGENTS.md — SyndicApp

Ce fichier définit le projet, la stack et les règles à respecter pour tout agent ou développeur qui travaille sur le code. En cas de conflit, l'ordre de priorité est :

1. les instructions explicites de Rachid dans la conversation ;
2. ce fichier ;
3. les Décisions et le Hors périmètre du plan en cours (`.prompt/NN-*.md`) ;
4. les skills installés ;
5. les habitudes ou préférences de l'agent.

---

## 1. Le projet

**SyndicApp** est une application mobile de gestion de copropriété pour le Maroc.

Au Maroc, le syndic est le plus souvent **un copropriétaire bénévole**, élu en assemblée générale (souvent pour un an), parfois aidé d'un trésorier et d'un adjoint. Il n'est ni comptable ni informaticien. Les sociétés de syndic professionnelles sont un marché secondaire.

**Objectif :** remplacer le cahier, les reçus papier et le groupe WhatsApp par une appli simple et transparente.

**Principes produit :**
- **Mobile d'abord** : le syndic fait tout depuis son téléphone. Le web est un bonus, plus tard.
- **Simplicité** : chaque action courante se fait en un à trois gestes, sans jargon comptable.
- **Transparence** : chaque dépense est visible par tous les copropriétaires, avec sa facture. Elle protège le syndic contre les soupçons.
- **Passation facile** : les données appartiennent à la résidence, pas à une personne. Un nouveau syndic récupère tout en un geste.
- **Bilingue** : français et arabe (RTL) dès la conception.

---

## 2. Utilisateurs et rôles

Les rôles sont **toujours liés à une résidence**, via la table `membership`. Une même personne peut être syndic d'une résidence et copropriétaire d'une autre. La source unique des rôles et des permissions est `packages/shared/src/roles.ts`.

| Rôle | Droits principaux |
| --- | --- |
| `syndic` | Tout gérer : charges, encaissements, dépenses, annonces, signalements, membres, invitations, passation |
| `tresorier` | Encaissements et dépenses, lecture de tout |
| `adjoint` | Annonces et signalements, lecture des comptes |
| `coproprietaire` | Voir ses charges et reçus, consulter les comptes, signaler, lire les annonces |
| `locataire` | Signaler et lire les annonces uniquement, aucun accès aux comptes |
| `gardien` | Recevoir et traiter les signalements, lire les annonces |

- Une résidence a **exactement un** syndic actif.
- L'accès à une résidence se fait **uniquement sur invitation** (code ou lien envoyé par le syndic).
- L'appli masque ce qu'un rôle ne peut pas faire, mais **c'est l'API qui refuse** : une permission n'est jamais vérifiée seulement côté appli.

---

## 3. Périmètre du MVP

Le MVP est découpé en plans dans `.prompt/` (voir `00-feuille-de-route.md`), réalisés dans l'ordre :

01 mise en place · 02 design system · 03 authentification · 04 résidences et rôles · 05 charges et encaissements · 06 dépenses et caisse · 07 signalements · 08 annonces et notifications · 09 bureau et passation · 10 hors ligne · 11 analyse produit · 12 déploiement et pilote.

**Hors périmètre du MVP** (ne rien implémenter sans validation explicite) :
- paiement en ligne (CMI, portefeuille mobile) ;
- connexion par SMS, téléphone, Google ou Apple ;
- votes d'assemblée générale en ligne ;
- réservation d'espaces communs ;
- tantièmes, montants de charges différents par lot, pénalités ;
- comptabilité avancée, exports comptables, rapprochement bancaire ;
- espace web du syndic, site vitrine, blog, CMS ;
- publication sur l'App Store d'Apple.

---

## 4. Stack technique

| Couche | Choix |
| --- | --- |
| Langage | **TypeScript strict** partout |
| Runtime | **Node 22 minimum** (`^22.13.0` ou `>=24.3.0`, exigé par Expo SDK 58), version fixée dans `.nvmrc` |
| Monorepo | **pnpm workspaces**, préfixe `@syndic/` |
| Mobile | **React Native avec Expo** + **Expo Router** |
| Données côté appli | **TanStack Query** |
| Formulaires et validation | **React Hook Form** + **Zod** (schémas partagés) |
| Design system | `@syndic/ui` : jetons + `StyleSheet`, polices **Plus Jakarta Sans** et **IBM Plex Sans Arabic** (`expo-font`), icônes **lucide-react-native** |
| API | **Hono** sur Node (`@hono/node-server`) |
| ORM | **Drizzle ORM** + `drizzle-kit` |
| Base de données | **Neon** (PostgreSQL), pilote `@neondatabase/serverless` |
| Authentification | **Better Auth** hébergé dans l'API Hono (adaptateur Drizzle, plugin `@better-auth/expo`), **bcryptjs** coût 12, session dans **SecureStore** côté mobile |
| Fichiers | **Cloudflare R2** (client S3, URL signées) |
| Reçus PDF | **pdf-lib**, générés côté API |
| Notifications | **Expo Push Notifications** (`expo-notifications`, `expo-server-sdk`) |
| Hors ligne | NetInfo + cache persisté de TanStack Query, file d'attente des actions |
| Analyse produit | **PostHog** (hébergement UE), après consentement |
| Erreurs | **Sentry** (sans données personnelles) |
| Builds et mises à jour | **EAS Build** et **EAS Update** |
| CI | **GitHub Actions** |
| Hébergement API | **Render** (ou Railway) |

**Explicitement écartés :**
- **Clerk** : ferait doublon avec Better Auth et stockerait les utilisateurs hors de notre base.
- **Neon Auth** : refuse les requêtes sans `Origin` et n'autorise ni le plugin Expo ni SecureStore (test du 5 novembre 2026).
- **NativeWind / Tailwind** et bibliothèques de composants tierces : le style passe par les jetons de `@syndic/ui`.
- **Expo API Routes** : l'API est dans Hono.
- **Sanity** : pas de contenu éditorial dans le MVP.
- **Spring Boot** : le projet est entièrement en TypeScript.

Ne jamais ajouter de dépendance majeure (framework, ORM, service payant, SDK tiers) sans la justifier et la faire valider. Les paquets Expo et React Native s'installent avec `npx expo install`, pas avec `pnpm add`.

---

## 5. Skills

Avant de coder, lire le skill correspondant à l'outil concerné et le suivre. En cas de conflit, ce fichier et le plan en cours l'emportent sur le skill.

| Sujet | Skill |
| --- | --- |
| Écrans, styles natifs | `expo-native-ui` |
| Navigation, Expo Router | `expo-router` |
| Jetons et composants du design system | `expo-design-system` |
| Animations, gestes | `expo-animation` |
| Requêtes, TanStack Query, cache | `expo-data-fetching` |
| Base Neon, Drizzle, branches `dev` / `production` | `neon-postgres` |
| Authentification, Better Auth | `better-auth-best-practices`, `better-auth-security-best-practices`, `email-and-password-best-practices`, `create-auth` ; pour l'appli : documentation officielle (page « Expo Integration ») |
| Build de développement | `expo-dev-client` |
| Build et publication sur les stores | `eas-app-stores` |
| Mises à jour EAS Update | `eas-update` |
| Pipelines EAS (CI/CD) | `eas-workflows` |
| Montée de version du SDK Expo | `expo-upgrade` |

À ignorer pour ce projet : `expo-tailwind-setup`, `expo-api-routes`, `use-dom`, `neon-auth` (Neon Auth écarté), `organization-best-practices` et `two-factor-authentication-best-practices` (hors périmètre du MVP). Ne jamais installer un nouveau skill sans validation.

---

## 6. Structure du dépôt

```
syndicapp/
  apps/
    mobile/                       → Expo (React Native), Expo Router
    api/                          → Hono
      src/auth.ts                 → configuration Better Auth (seul endroit)
  packages/
    db/                           → client Neon, schéma Drizzle, migrations (@syndic/db)
      src/schema/auth.ts          → tables Better Auth, générées par sa CLI, ne pas modifier à la main
    shared/                       → schémas Zod, types, rôles, permissions, constantes, événements analytics (@syndic/shared)
      src/roles.ts                → rôles et permissions (source unique)
      src/analytics.ts            → liste fermée des événements PostHog
    ui/                           → design system : jetons, thème, composants (@syndic/ui)
  .prompt/                        → plans de réalisation (00 à 12)
  docs/                           → références visuelles (design-system.png, auth.png), déploiement, pilote
  AGENTS.md
  .env.example
  pnpm-workspace.yaml
```

- Le schéma Drizzle vit **uniquement** dans `packages/db`.
- Les schémas Zod, rôles et constantes partagés vivent **uniquement** dans `packages/shared`.
- L'appli mobile **n'accède jamais directement** à la base de données : tout passe par l'API.

**Commandes :**
- `pnpm dev` : lance l'API (Expo se lance à part, voir plus bas).
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format`.
- `pnpm --filter db db:generate` puis `pnpm --filter db db:migrate` : migrations (branche `dev`).
- `cd apps/mobile && npx expo start` : appli seule.

---

## 7. Règles de code

### Général
- TypeScript `strict`, pas de `any` sauf justification en commentaire.
- Noms de variables, fonctions et tables **en anglais**. Textes affichés **en français et en arabe** via les fichiers de traduction, jamais en dur dans les composants.
- Montants stockés en **centimes (entier)**, devise MAD. Jamais de nombre à virgule pour l'argent. Affichage `18 420 MAD` via `formatMad` et le composant `Amount`.
- Dates stockées en UTC, affichées dans le fuseau `Africa/Casablanca`.
- Chaque étape se fait sur sa propre branche `plan-NN/etape-X-titre`, créée depuis `master` ; tout est commité avec des messages clairs en français ; jamais de fusion dans `master` ni de push sans validation.

### Base de données (Drizzle + Neon)
- Chaque table métier a une colonne `residence_id`.
- **Chaque requête métier filtre sur `residence_id`** et vérifie le rôle de l'utilisateur dans cette résidence. Aucune exception.
- Les tables d'authentification sont générées par la CLI de Better Auth ; nos tables référencent `user.id`.
- Toute modification de schéma passe par une migration Drizzle versionnée (`drizzle-kit generate`).
- Les opérations qui touchent l'argent se font dans une **transaction**, et tout statut calculé (dû `paid`, `partial`, `unpaid`) est mis à jour dans la même transaction.
- Le **solde de la caisse est toujours calculé**, jamais stocké.
- Pas de suppression physique des paiements et des dépenses : annulation tracée (qui, quand, motif obligatoire).
- Les données appartiennent à la résidence, jamais à une personne.
- Les actions sensibles (changements de rôle, passations, annulations) sont journalisées avec `logAudit` dès qu'il existe (plan 09).
- Développement **uniquement sur la branche Neon `dev`**. Les migrations ne sont appliquées sur `production` que via la procédure de `docs/deploiement.md`.

### API (Hono)
- Chaque route valide son entrée avec un schéma Zod de `packages/shared`.
- Toute route métier passe par `requireAuth` (session Better Auth lue avec `auth.api.getSession`), puis `requireMembership` (résidence active envoyée dans l'en-tête `X-Residence-Id`), puis `requirePermission`. Seules `GET /health` et `/api/auth/*` sont publiques.
- Les réponses sont adaptées au rôle : un champ réservé (nom d'un auteur, montant d'un autre lot) n'est jamais envoyé puis masqué par l'appli.
- Les erreurs renvoyées ne contiennent jamais de détails internes (requête SQL, stack trace).
- Toute création possible hors ligne (paiement, dépense) accepte un `client_id` et est **idempotente**.
- Toute notification passe par le module `notify`.

### Mobile (Expo)
- **Aucune couleur, taille de police, espacement ou rayon codé en dur** dans `apps/mobile` : utiliser les jetons et composants de `@syndic/ui`. Un besoin non couvert se traite en ajoutant un jeton ou un composant au package.
- Les statuts métier s'affichent toujours avec `StatusBadge`, les montants toujours avec `Amount`.
- Zones tactiles d'au moins **44 px**, contraste du texte d'au moins **4,5:1**, espacements en `start`/`end` (jamais `left`/`right`), états jamais signalés par la couleur seule.
- Les références visuelles sont dans `docs/` : `design-system.png` pour les composants, `auth.png` pour l'authentification. Les écrans doivent leur correspondre ; les valeurs exactes viennent des jetons de `@syndic/ui`.
- Icônes lucide importées une par une (`lucide-react-native/icons/<nom>`), jamais depuis l'index du paquet (tout le paquet serait chargé).
- Les écrans affichés dépendent du rôle dans la résidence active.
- La session est gérée uniquement par le client Better Auth avec `expoClient` et SecureStore ; les appels à l'API passent par `src/lib/api.ts`. Jamais de jeton stocké à la main ni dans AsyncStorage.
- Préférences locales non sensibles (langue…) dans `expo-secure-store` ou le `localStorage` d'`expo-sqlite`, jamais dans AsyncStorage.
- Toute image est compressée avant envoi (1600 px de large, JPEG 0,7). Les fichiers partent directement vers R2 avec une URL signée.
- Encaissements et dépenses passent par la file d'attente hors ligne ; le cache persisté ne contient jamais de jeton.
- Les événements PostHog passent uniquement par le helper `track`.

---

## 8. Sécurité et données personnelles

**Authentification**
- Mots de passe hachés par bcryptjs (coût 12) uniquement dans l'API ; 72 octets maximum ; jamais journalisés.
- Messages d'erreur génériques qui ne révèlent pas si un e-mail existe.
- Les codes d'invitation ont une durée de vie limitée, sont à usage unique, et leurs tentatives sont limitées.
- Risque connu : l'inscription révèle qu'un e-mail est déjà utilisé, tant que la vérification d'e-mail n'existe pas. Atténué par la limite de tentatives et un message neutre dans l'appli. À corriger quand l'envoi d'e-mails sera en place.

**Secrets**
- Aucun secret dans le code ni dans le dépôt : uniquement dans les variables d'environnement (`.env.local` en local, hébergeur en production).
- `.env.example` liste toutes les variables, sans valeurs.
- Ne jamais afficher un secret ou un jeton dans le terminal, les logs ou une réponse.

**Données personnelles (loi marocaine 09-08, CNDP)**
- Ne collecter que le nécessaire : nom, e-mail, lot, rôle.
- Factures, reçus et photos dans R2 accessibles uniquement par URL signées de courte durée. Rien n'est public.
- Un locataire ne voit jamais les comptes ni les paiements. Un copropriétaire ne voit que les dus et reçus de son lot.
- Le journal des mouvements montre « Charge reçue · B12 », jamais le nom de la personne qui a payé.
- **Notifications** : jamais de montant, de nom ni de numéro de lot dans le texte (visible sur l'écran verrouillé). Jetons push supprimés à la déconnexion et quand Expo les signale invalides.
- **PostHog** : uniquement les événements et propriétés de `packages/shared/src/analytics.ts`, identifiants hachés, après consentement. Jamais de nom, e-mail, téléphone, lot, montant, texte libre, nom ou adresse de résidence. Pas de replay ni d'autocapture des clics.
- **Sentry** : `sendDefaultPii: false`, aucune donnée personnelle dans les erreurs.

---

## 9. Limites des services gratuits

Le projet démarre sur des offres gratuites, dont les conditions changent : les vérifier avant tout déploiement.

- **Neon** : mise en veille possible avec un délai au réveil, stockage et calcul limités. Chaque branche a sa propre base.
- **Cloudflare R2** : quota gratuit de stockage et d'opérations ; d'où la compression des images.
- **Render / Railway** : mise en veille et ressources limitées.
- **PostHog** : quota mensuel d'événements ; n'envoyer que les événements utiles.
- **Expo / EAS** : nombre de builds cloud gratuits limité ; privilégier Expo Go et les builds locaux en développement.
- **Sentry** : quota d'erreurs limité.
- **Stores** : Google Play (frais unique) et Apple App Store (abonnement annuel) sont payants.

---

## 10. Ce que l'agent ne doit jamais faire

- Écrire une requête métier sans filtre `residence_id` ni vérification du rôle.
- Stocker un mot de passe en clair, le hacher ailleurs que dans l'API (bcryptjs), le journaliser, ou stocker un jeton dans AsyncStorage.
- Mettre une clé, un mot de passe ou un jeton dans le code, un commit ou un log.
- Modifier à la main les tables générées par Better Auth.
- Accepter les origines `exp://` hors développement.
- Lancer une migration destructive (suppression de table ou de colonne) sans validation explicite.
- Supprimer définitivement un paiement ou une dépense.
- Envoyer des données personnelles ou financières à PostHog, Sentry ou tout service tiers.
- Laisser l'appli mobile se connecter directement à la base de données.
- Coder une couleur, une taille ou un espacement en dur dans `apps/mobile`.
- Ajouter un service payant, une dépendance majeure ou un skill sans validation.
- Implémenter une fonctionnalité hors périmètre (section 3) ou hors du plan en cours sans validation.
- Exécuter une commande Neon sur la branche `production`, déployer l'API ou publier une mise à jour EAS sur le canal `production` sans validation explicite.
- Passer à l'étape suivante d'un plan sans avoir montré que « Terminé quand » est respecté.

---

## 11. Avant de considérer une tâche terminée

- [ ] `pnpm typecheck` et `pnpm lint` passent.
- [ ] Les entrées sont validées par Zod.
- [ ] Les règles d'accès (authentification, résidence, rôle) sont vérifiées par l'API et testées.
- [ ] Les textes affichés passent par les traductions (FR et AR) et l'écran fonctionne en RTL.
- [ ] Aucune valeur de style codée en dur ; seulement `@syndic/ui`.
- [ ] Aucune donnée sensible n'est envoyée à un service tiers ni écrite dans les logs.
- [ ] Une migration Drizzle accompagne tout changement de schéma, testée sur `dev`.
- [ ] Le critère « Terminé quand » de l'étape est démontré.
- [ ] Les modifications d'`AGENTS.md` demandées par le plan sont proposées (pas appliquées sans validation).
- [ ] Les comptes et données de test créés pendant une étape sont supprimés à la fin de l'étape.